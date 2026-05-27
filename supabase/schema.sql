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
  'Invite, manage, and recipient tokens are bearer secrets. Do not expose broad anon select/update/delete. Token-based reads and management actions must be implemented through a trusted server/API or SECURITY DEFINER RPC in later work.';

comment on table balloon_gifts is
  'Gift rows are scoped by gift_rooms bearer tokens. Do not expose broad anon select/update/delete. Token-based reads and management actions must be implemented through a trusted server/API or SECURITY DEFINER RPC in later work.';

create policy "anon can create gift rooms"
  on gift_rooms
  for insert
  to anon
  with check (true);

create policy "anon can create balloon gifts"
  on balloon_gifts
  for insert
  to anon
  with check (true);
