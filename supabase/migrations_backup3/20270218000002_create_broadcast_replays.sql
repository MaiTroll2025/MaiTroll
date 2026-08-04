-- broadcast_replays table for Cloudflare R2 archived broadcast recordings
-- Stores metadata only; actual video files live in R2

create table if not exists public.broadcast_replays (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  title text,
  cloudflare_r2_key text not null,
  replay_url text not null,
  thumbnail_url text,
  duration_seconds integer,
  file_size bigint,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_broadcast_replays_stream_id
  on public.broadcast_replays(stream_id);

create index if not exists idx_broadcast_replays_user_id
  on public.broadcast_replays(user_id);

create index if not exists idx_broadcast_replays_created_at
  on public.broadcast_replays(created_at desc);

alter table public.broadcast_replays enable row level security;

create policy "Users can view their own replays"
  on public.broadcast_replays
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own replays"
  on public.broadcast_replays
  for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own replays"
  on public.broadcast_replays
  for delete
  using (auth.uid() = user_id);

-- Add save_replay flag to streams table
alter table public.streams
  add column if not exists save_replay boolean default false;
