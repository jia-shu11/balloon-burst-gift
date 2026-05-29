create table if not exists gift_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  recipient_name text not null,
  prompt_text text not null default '',
  invite_token text not null unique,
  manage_token text not null unique,
  recipient_token text not null unique,
  constraint gift_rooms_distinct_invite_manage check (invite_token <> manage_token),
  constraint gift_rooms_distinct_invite_recipient check (invite_token <> recipient_token),
  constraint gift_rooms_distinct_manage_recipient check (manage_token <> recipient_token),
  status text not null check (status in ('draft', 'published')) default 'draft',
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists balloon_gifts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references gift_rooms(id) on delete cascade,
  giver_name text not null,
  audio_url text not null,
  audio_duration_sec numeric not null,
  average_volume numeric not null,
  peak_volume numeric not null,
  transcript text not null,
  edited_transcript text not null,
  extra_text text not null default '',
  image_urls text[] not null default '{}',
  image_bytes bigint not null default 0,
  balloon_params jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists balloon_gifts_room_id_idx on balloon_gifts(room_id);
create index if not exists balloon_gifts_active_idx on balloon_gifts(room_id, deleted_at);

alter table gift_rooms enable row level security;
alter table balloon_gifts enable row level security;

comment on table gift_rooms is
  'Invite, manage, and recipient tokens are bearer secrets. No broad anon table access should be exposed. All public app operations must go through token-scoped trusted server/API or SECURITY DEFINER RPC functions.';

comment on table balloon_gifts is
  'Gift rows are scoped by gift_rooms bearer tokens. No broad anon table access should be exposed. All public app operations must go through token-scoped trusted server/API or SECURITY DEFINER RPC functions.';

drop policy if exists "anon can create gift rooms" on gift_rooms;
drop policy if exists "anon can create balloon gifts" on balloon_gifts;

create or replace function create_gift_room(
  p_title text,
  p_recipient_name text,
  p_prompt_text text default ''
)
returns gift_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  created gift_rooms;
begin
  insert into gift_rooms (
    title,
    recipient_name,
    prompt_text,
    invite_token,
    manage_token,
    recipient_token
  )
  values (
    p_title,
    p_recipient_name,
    coalesce(p_prompt_text, ''),
    'invite_' || replace(gen_random_uuid()::text, '-', ''),
    'manage_' || replace(gen_random_uuid()::text, '-', ''),
    'recipient_' || replace(gen_random_uuid()::text, '-', '')
  )
  returning * into created;

  return created;
end;
$$;

create or replace function get_room_by_invite_token(p_invite_token text)
returns table (
  id uuid,
  title text,
  recipient_name text,
  prompt_text text,
  invite_token text,
  manage_token text,
  recipient_token text,
  status text,
  created_at timestamptz,
  published_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id,
    r.title,
    r.recipient_name,
    r.prompt_text,
    r.invite_token,
    ''::text as manage_token,
    ''::text as recipient_token,
    r.status,
    r.created_at,
    r.published_at
  from gift_rooms r
  where r.invite_token = p_invite_token;
$$;

create or replace function get_room_by_manage_token(p_manage_token text)
returns setof gift_rooms
language sql
security definer
set search_path = public
stable
as $$
  select *
  from gift_rooms
  where manage_token = p_manage_token;
$$;

create or replace function get_published_room_by_recipient_token(p_recipient_token text)
returns table (
  id uuid,
  title text,
  recipient_name text,
  prompt_text text,
  invite_token text,
  manage_token text,
  recipient_token text,
  status text,
  created_at timestamptz,
  published_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id,
    r.title,
    r.recipient_name,
    r.prompt_text,
    ''::text as invite_token,
    ''::text as manage_token,
    r.recipient_token,
    r.status,
    r.created_at,
    r.published_at
  from gift_rooms r
  where r.recipient_token = p_recipient_token
    and r.status = 'published';
$$;

create or replace function publish_gift_room(p_manage_token text)
returns setof gift_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  published gift_rooms;
begin
  update gift_rooms
  set
    status = 'published',
    published_at = coalesce(published_at, now())
  where manage_token = p_manage_token
  returning * into published;

  if published.id is null then
    raise exception '管理链接无效';
  end if;

  return next published;
end;
$$;

create or replace function create_balloon_gift(
  p_room_id uuid,
  p_invite_token text,
  p_giver_name text,
  p_audio_url text,
  p_audio_duration_sec numeric,
  p_average_volume numeric,
  p_peak_volume numeric,
  p_transcript text,
  p_edited_transcript text,
  p_extra_text text,
  p_image_urls text[],
  p_image_bytes bigint,
  p_balloon_params jsonb
)
returns balloon_gifts
language plpgsql
security definer
set search_path = public
as $$
declare
  created balloon_gifts;
begin
  insert into balloon_gifts (
    room_id,
    giver_name,
    audio_url,
    audio_duration_sec,
    average_volume,
    peak_volume,
    transcript,
    edited_transcript,
    extra_text,
    image_urls,
    image_bytes,
    balloon_params
  )
  select
    r.id,
    p_giver_name,
    p_audio_url,
    p_audio_duration_sec,
    p_average_volume,
    p_peak_volume,
    p_transcript,
    p_edited_transcript,
    coalesce(p_extra_text, ''),
    coalesce(p_image_urls, '{}'),
    coalesce(p_image_bytes, 0),
    p_balloon_params
  from gift_rooms r
  where r.id = p_room_id
    and r.invite_token = p_invite_token
    and r.status = 'draft'
  returning * into created;

  if created.id is null then
    raise exception '邀请链接无效';
  end if;

  return created;
end;
$$;

create or replace function list_gifts_for_manage_token(
  p_room_id uuid,
  p_manage_token text
)
returns setof balloon_gifts
language sql
security definer
set search_path = public
stable
as $$
  select g.*
  from balloon_gifts g
  join gift_rooms r on r.id = g.room_id
  where g.room_id = p_room_id
    and r.manage_token = p_manage_token
    and g.deleted_at is null
  order by g.created_at asc;
$$;

create or replace function list_published_gifts_for_recipient_token(
  p_room_id uuid,
  p_recipient_token text
)
returns setof balloon_gifts
language sql
security definer
set search_path = public
stable
as $$
  select g.*
  from balloon_gifts g
  join gift_rooms r on r.id = g.room_id
  where g.room_id = p_room_id
    and r.recipient_token = p_recipient_token
    and r.status = 'published'
    and g.deleted_at is null
  order by g.created_at asc;
$$;

create or replace function delete_balloon_gift(
  p_gift_id uuid,
  p_manage_token text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_id uuid;
begin
  update balloon_gifts g
  set deleted_at = now()
  from gift_rooms r
  where g.id = p_gift_id
    and g.room_id = r.id
    and r.manage_token = p_manage_token
  returning g.id into deleted_id;

  if deleted_id is null then
    raise exception '管理链接无效';
  end if;
end;
$$;

grant execute on function create_gift_room(text, text, text) to anon;
grant execute on function get_room_by_invite_token(text) to anon;
grant execute on function get_room_by_manage_token(text) to anon;
grant execute on function get_published_room_by_recipient_token(text) to anon;
grant execute on function publish_gift_room(text) to anon;
grant execute on function create_balloon_gift(uuid, text, text, text, numeric, numeric, numeric, text, text, text, text[], bigint, jsonb) to anon;
grant execute on function list_gifts_for_manage_token(uuid, text) to anon;
grant execute on function list_published_gifts_for_recipient_token(uuid, text) to anon;
grant execute on function delete_balloon_gift(uuid, text) to anon;

insert into storage.buckets (id, name, public)
values ('gift-media', 'gift-media', true)
on conflict (id) do update set public = true;

drop policy if exists "gift media public read" on storage.objects;
create policy "gift media public read"
on storage.objects
for select
to anon
using (bucket_id = 'gift-media');

drop policy if exists "gift media anonymous upload" on storage.objects;
create policy "gift media anonymous upload"
on storage.objects
for insert
to anon
with check (bucket_id = 'gift-media');
