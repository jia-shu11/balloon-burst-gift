create table if not exists gift_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  recipient_name text not null,
  prompt_text text not null default '',
  invite_token text not null unique,
  manage_token text not null unique,
  recipient_token text not null unique,
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
