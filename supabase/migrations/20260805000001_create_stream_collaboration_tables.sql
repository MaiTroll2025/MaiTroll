create table if not exists public.stream_collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null,
  requester_stream_id uuid not null,
  requester_platform text not null,
  receiver_user_id uuid not null,
  receiver_stream_id uuid not null,
  receiver_platform text not null,
  requested_session_id uuid,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.stream_collaboration_sessions (
  id uuid primary key default gen_random_uuid(),
  primary_broadcaster_id uuid not null,
  primary_stream_id uuid not null,
  canonical_livekit_room text,
  canonical_platform text not null,
  status text not null default 'active',
  maximum_broadcasters integer not null default 6,
  maximum_guest_seats integer not null default 3,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  ended_by uuid,
  end_reason text,
  current_battle_proposal_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.stream_collaboration_participants (
  id uuid primary key default gen_random_uuid(),
  collaboration_session_id uuid not null references public.stream_collaboration_sessions(id) on delete cascade,
  broadcaster_user_id uuid not null,
  original_stream_id uuid not null,
  platform text not null,
  role text not null default 'broadcaster',
  participant_status text not null default 'active',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  removed_by uuid,
  remove_reason text,
  current_livekit_identity text,
  original_livekit_room text,
  migration_status text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.stream_collaboration_blocks (
  id uuid primary key default gen_random_uuid(),
  blocking_user_id uuid not null,
  blocked_user_id uuid not null,
  created_at timestamptz not null default now(),
  reason text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_stream_collaboration_requests_receiver_status on public.stream_collaboration_requests(receiver_user_id, status, expires_at);
create index if not exists idx_stream_collaboration_requests_requester_status on public.stream_collaboration_requests(requester_user_id, status, expires_at);
create index if not exists idx_stream_collaboration_participants_session on public.stream_collaboration_participants(collaboration_session_id, broadcaster_user_id);
create index if not exists idx_stream_collaboration_sessions_status on public.stream_collaboration_sessions(status, created_at);

alter table public.stream_collaboration_requests enable row level security;
alter table public.stream_collaboration_sessions enable row level security;
alter table public.stream_collaboration_participants enable row level security;
alter table public.stream_collaboration_blocks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stream_collaboration_requests'
      and policyname = 'stream_collaboration_requests_select_own'
  ) then
    create policy stream_collaboration_requests_select_own
      on public.stream_collaboration_requests
      for select
      using (
        auth.uid() = requester_user_id or auth.uid() = receiver_user_id
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stream_collaboration_requests'
      and policyname = 'stream_collaboration_requests_insert_own'
  ) then
    create policy stream_collaboration_requests_insert_own
      on public.stream_collaboration_requests
      for insert
      with check (auth.uid() = requester_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stream_collaboration_requests'
      and policyname = 'stream_collaboration_requests_update_own'
  ) then
    create policy stream_collaboration_requests_update_own
      on public.stream_collaboration_requests
      for update
      using (
        auth.uid() = requester_user_id or auth.uid() = receiver_user_id
      )
      with check (
        auth.uid() = requester_user_id or auth.uid() = receiver_user_id
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stream_collaboration_sessions'
      and policyname = 'stream_collaboration_sessions_select_participant'
  ) then
    create policy stream_collaboration_sessions_select_participant
      on public.stream_collaboration_sessions
      for select
      using (
        auth.uid() = primary_broadcaster_id or exists (
          select 1 from public.stream_collaboration_participants p
          where p.collaboration_session_id = stream_collaboration_sessions.id
            and p.broadcaster_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stream_collaboration_sessions'
      and policyname = 'stream_collaboration_sessions_insert_own'
  ) then
    create policy stream_collaboration_sessions_insert_own
      on public.stream_collaboration_sessions
      for insert
      with check (auth.uid() = primary_broadcaster_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stream_collaboration_participants'
      and policyname = 'stream_collaboration_participants_select_participant'
  ) then
    create policy stream_collaboration_participants_select_participant
      on public.stream_collaboration_participants
      for select
      using (
        exists (
          select 1 from public.stream_collaboration_sessions s
          where s.id = stream_collaboration_participants.collaboration_session_id
            and (
              s.primary_broadcaster_id = auth.uid() or exists (
                select 1 from public.stream_collaboration_participants p
                where p.collaboration_session_id = s.id and p.broadcaster_user_id = auth.uid()
              )
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stream_collaboration_participants'
      and policyname = 'stream_collaboration_participants_insert_participant'
  ) then
    create policy stream_collaboration_participants_insert_participant
      on public.stream_collaboration_participants
      for insert
      with check (auth.uid() = broadcaster_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stream_collaboration_blocks'
      and policyname = 'stream_collaboration_blocks_select_own'
  ) then
    create policy stream_collaboration_blocks_select_own
      on public.stream_collaboration_blocks
      for select
      using (
        auth.uid() = blocking_user_id or auth.uid() = blocked_user_id
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stream_collaboration_blocks'
      and policyname = 'stream_collaboration_blocks_insert_own'
  ) then
    create policy stream_collaboration_blocks_insert_own
      on public.stream_collaboration_blocks
      for insert
      with check (auth.uid() = blocking_user_id);
  end if;
end $$;
