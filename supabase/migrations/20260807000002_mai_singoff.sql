-- Migration: Mai Sing Off — live singing competition feature.
-- Authoritative schema + server-side RPCs. Reuses existing user_profiles
-- (coins/levels/roles), coin_transactions/spend_coins, notifications, and
-- LiveKit token gating is enforced via singoff_validate_token_access.
-- Date: 2026-08-07

-- =========================================================================
-- Helpers
-- =========================================================================

-- True if the user is staff (CEO / admin / officers) authorized for Sing Off.
create or replace function public.singoff_is_staff(p_user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = p_user_id
      and (
        p.is_ceo or p.is_admin
        or p.role in ('admin','superadmin','ceo','lead_troll_officer','troll_officer')
      )
  );
$$;

-- =========================================================================
-- Tables
-- =========================================================================

create table if not exists public.mai_singoff_sessions (
  id              uuid primary key default gen_random_uuid(),
  room_name       text unique not null,
  host_id         uuid references public.user_profiles(id),
  status          text not null default 'setup' check (status in ('setup','active','ended')),
  round_number    integer not null default 0,
  config          jsonb not null default '{}'::jsonb,
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.mai_singoff_participants (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.mai_singoff_sessions(id) on delete cascade,
  user_id         uuid not null references public.user_profiles(id),
  role            text not null default 'audience' check (role in ('audience','queue','challenger','host','judge','host_judge','ceo_judge')),
  position        text check (position in ('challenger_a','host_stage','challenger_b','judge_1','judge_2','judge_3','judge_4','host_judge','ceo','audience','queue')),
  display_name    text,
  avatar_url      text,
  level           integer,
  troll_coins     bigint,
  can_publish     boolean not null default false,
  joined_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (session_id, user_id),
  unique (session_id, position)
);

create table if not exists public.mai_singoff_queue (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.mai_singoff_sessions(id) on delete cascade,
  user_id         uuid not null references public.user_profiles(id),
  display_name    text,
  avatar_url      text,
  level           integer,
  troll_coins     bigint,
  status          text not null default 'waiting' check (status in ('waiting','called','countdown','on_stage','completed','kicked','left')),
  requested_position text check (requested_position in ('challenger_a','challenger_b')),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (session_id, user_id),
  unique (session_id, sort_order)
);

create table if not exists public.mai_singoff_judge_applications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.user_profiles(id),
  status          text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  statement       text,
  experience      text,
  broadcasting_experience text,
  agreement       boolean not null default false,
  reviewed_by     uuid references public.user_profiles(id),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.mai_singoff_judges (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.user_profiles(id),
  session_id      uuid references public.mai_singoff_sessions(id) on delete cascade,
  seat_index      integer check (seat_index between 1 and 4),
  assigned_at     timestamptz not null default now(),
  is_active       boolean not null default true,
  unique (session_id, seat_index)
);

create table if not exists public.mai_singoff_rounds (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.mai_singoff_sessions(id) on delete cascade,
  round_number    integer not null,
  status          text not null default 'pending' check (status in ('pending','active','completed')),
  challenger_a_id uuid references public.user_profiles(id),
  challenger_b_id uuid references public.user_profiles(id),
  winner_id       uuid references public.user_profiles(id),
  created_at      timestamptz not null default now(),
  unique (session_id, round_number)
);

create table if not exists public.mai_singoff_decisions (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.mai_singoff_sessions(id) on delete cascade,
  round_id        uuid not null references public.mai_singoff_rounds(id) on delete cascade,
  judge_id        uuid not null references public.user_profiles(id),
  challenger_id   uuid not null references public.user_profiles(id),
  decision        text not null check (decision in ('no','yes','mai_winner')),
  created_at      timestamptz not null default now(),
  unique (session_id, round_id, judge_id, challenger_id)
);

create table if not exists public.mai_singoff_championships (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  status          text not null default 'upcoming' check (status in ('upcoming','active','completed')),
  start_at        timestamptz,
  end_at          timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.mai_singoff_championship_entries (
  id              uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.mai_singoff_championships(id) on delete cascade,
  user_id         uuid not null references public.user_profiles(id),
  round_label     text,
  status          text not null default 'pending' check (status in ('pending','active','completed','eliminated')),
  created_at      timestamptz not null default now(),
  unique (championship_id, user_id)
);

create table if not exists public.mai_singoff_gifts (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.mai_singoff_sessions(id) on delete cascade,
  sender_id       uuid not null references public.user_profiles(id),
  receiver_id     uuid references public.user_profiles(id),
  gift_id         text not null,
  gift_name       text not null,
  quantity        integer not null default 1,
  coins           integer not null,
  created_at      timestamptz not null default now()
);

create table if not exists public.mai_singoff_chat (
  id              bigint generated always as identity primary key,
  session_id      uuid not null references public.mai_singoff_sessions(id) on delete cascade,
  user_id         uuid references public.user_profiles(id) on delete set null,
  sender_name     text not null,
  body            text not null,
  role_at_time     text,
  is_gift         boolean not null default false,
  gift_data       jsonb,
  created_at      timestamptz not null default now()
);

create index on public.mai_singoff_chat (session_id, created_at);
create index on public.mai_singoff_participants (session_id, position);
create index on public.mai_singoff_queue (session_id, status, sort_order);
create index on public.mai_singoff_decisions (session_id, round_id);

-- =========================================================================
-- Helpers (defined after tables so SQL functions can reference them)
-- =========================================================================

-- True if the user may manage a given Sing Off session (host OR staff).
create or replace function public.singoff_can_manage_session(p_session_id uuid, p_user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.mai_singoff_sessions s
    where s.id = p_session_id
      and (
        s.host_id = p_user_id
        or (
          select (p.is_ceo or p.is_admin
                  or p.role in ('admin','superadmin','ceo','lead_troll_officer','troll_officer'))
          from public.user_profiles p
          where p.id = p_user_id
        )
      )
  );
$$;

-- True if the user is an active judge assigned to the session.
create or replace function public.singoff_is_active_judge(p_session_id uuid, p_user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.mai_singoff_participants p
    where p.session_id = p_session_id
      and p.user_id = p_user_id
      and p.role in ('judge','host_judge','ceo_judge')
      and p.position is not null
  );
$$;

-- =========================================================================
-- RLS
-- =========================================================================

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_sessions' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_sessions ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_participants' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_participants ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_queue' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_queue ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_judge_applications' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_judge_applications ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_judges' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_judges ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_rounds' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_rounds ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_decisions' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_decisions ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_championships' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_championships ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_championship_entries' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_championship_entries ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_gifts' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_gifts ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_chat' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_chat ENABLE ROW LEVEL SECURITY; END IF; END; $$;

-- sessions: staff can read/write everything; users can read active sessions
DROP POLICY IF EXISTS "staff full access to sessions" on public.mai_singoff_sessions
 ; CREATE POLICY "staff full access to sessions" on public.mai_singoff_sessions
  for all using (public.singoff_is_staff(auth.uid())) with check (public.singoff_is_staff(auth.uid()));
DROP POLICY IF EXISTS "public read active sessions" on public.mai_singoff_sessions
 ; CREATE POLICY "public read active sessions" on public.mai_singoff_sessions
  for select using (status = 'active');

-- participants: read by anyone authenticated; manage by session staff; self is audience
DROP POLICY IF EXISTS "participants select authenticated" on public.mai_singoff_participants
 ; CREATE POLICY "participants select authenticated" on public.mai_singoff_participants
  for select using (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "participants manage" on public.mai_singoff_participants
 ; CREATE POLICY "participants manage" on public.mai_singoff_participants
  for all using (public.singoff_can_manage_session(session_id, auth.uid()))
  with check (public.singoff_can_manage_session(session_id, auth.uid()) or auth.uid() = user_id);

-- queue: read by authenticated; insert by self (waiting) or manage by staff
DROP POLICY IF EXISTS "queue select authenticated" on public.mai_singoff_queue ; CREATE POLICY "queue select authenticated" on public.mai_singoff_queue for select using (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "queue self insert" on public.mai_singoff_queue ; CREATE POLICY "queue self insert" on public.mai_singoff_queue for insert with check (auth.uid() = user_id);
DROP POLICY IF EXISTS "queue manage" on public.mai_singoff_queue ; CREATE POLICY "queue manage" on public.mai_singoff_queue for update using (public.singoff_can_manage_session(session_id, auth.uid()))
  with check (public.singoff_can_manage_session(session_id, auth.uid()) or auth.uid() = user_id);

-- judge applications: self read/insert; staff read
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_judge_applications' AND relkind = 'r') THEN
    DROP POLICY IF EXISTS "judge apps self" on public.mai_singoff_judge_applications;
    CREATE POLICY "judge apps self" on public.mai_singoff_judge_applications for select using (auth.uid() = user_id);
    DROP POLICY IF EXISTS "judge apps staff read" on public.mai_singoff_judge_applications;
    CREATE POLICY "judge apps staff read" on public.mai_singoff_judge_applications for select using (public.singoff_is_staff(auth.uid()));
    DROP POLICY IF EXISTS "judge apps self insert" on public.mai_singoff_judge_applications;
    CREATE POLICY "judge apps self insert" on public.mai_singoff_judge_applications for insert with check (auth.uid() = user_id);
    DROP POLICY IF EXISTS "judge apps staff manage" on public.mai_singoff_judge_applications;
    CREATE POLICY "judge apps staff manage" on public.mai_singoff_judge_applications for update using (public.singoff_is_staff(auth.uid()));
  END IF;
END; $$;

-- judges: staff manage
DROP POLICY IF EXISTS "judges manage" on public.mai_singoff_judges ; CREATE POLICY "judges manage" on public.mai_singoff_judges for all using (public.singoff_is_staff(auth.uid())) with check (public.singoff_is_staff(auth.uid()));

-- rounds / decisions / championships: read by authenticated, write by staff/session manage
DROP POLICY IF EXISTS "rounds read" on public.mai_singoff_rounds ; CREATE POLICY "rounds read" on public.mai_singoff_rounds for select using (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "rounds manage" on public.mai_singoff_rounds ; CREATE POLICY "rounds manage" on public.mai_singoff_rounds for all using (public.singoff_is_staff(auth.uid())) with check (public.singoff_can_manage_session(session_id, auth.uid()));
DROP POLICY IF EXISTS "decisions read" on public.mai_singoff_decisions ; CREATE POLICY "decisions read" on public.mai_singoff_decisions for select using (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "decisions manage" on public.mai_singoff_decisions ; CREATE POLICY "decisions manage" on public.mai_singoff_decisions for all using (public.singoff_is_staff(auth.uid())) with check (exists (select 1 from public.mai_singoff_rounds r where r.id = round_id and public.singoff_can_manage_session(r.session_id, auth.uid())));
DROP POLICY IF EXISTS "championships read" on public.mai_singoff_championships ; CREATE POLICY "championships read" on public.mai_singoff_championships for select using (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "championships manage" on public.mai_singoff_championships ; CREATE POLICY "championships manage" on public.mai_singoff_championships for all using (public.singoff_is_staff(auth.uid())) with check (public.singoff_is_staff(auth.uid()));
DROP POLICY IF EXISTS "championship entries read" on public.mai_singoff_championship_entries ; CREATE POLICY "championship entries read" on public.mai_singoff_championship_entries for select using (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "championship entries manage" on public.mai_singoff_championship_entries ; CREATE POLICY "championship entries manage" on public.mai_singoff_championship_entries for all using (public.singoff_is_staff(auth.uid())) with check (public.singoff_is_staff(auth.uid()));

-- gifts: sender can insert; read by authenticated; delete by sender/staff
DROP POLICY IF EXISTS "gifts read" on public.mai_singoff_gifts ; CREATE POLICY "gifts read" on public.mai_singoff_gifts for select using (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "gifts sender insert" on public.mai_singoff_gifts ; CREATE POLICY "gifts sender insert" on public.mai_singoff_gifts for insert with check (auth.uid() = sender_id);
DROP POLICY IF EXISTS "gifts delete" on public.mai_singoff_gifts ; CREATE POLICY "gifts delete" on public.mai_singoff_gifts for delete using (auth.uid() = sender_id or public.singoff_is_staff(auth.uid()));

-- chat: read by authenticated; insert by authenticated (sender must be in session)
DROP POLICY IF EXISTS "chat read" on public.mai_singoff_chat ; CREATE POLICY "chat read" on public.mai_singoff_chat for select using (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "chat insert" on public.mai_singoff_chat ; CREATE POLICY "chat insert" on public.mai_singoff_chat for insert with check (
  auth.uid() = user_id
  or public.singoff_is_staff(auth.uid())
  or sender_name = 'Mai Sing Off'
);

-- =========================================================================
-- Token validation (called by livekit-token edge function)
-- =========================================================================

create or replace function public.singoff_validate_token_access(p_room_name text, p_user_id uuid, p_mode text)
returns boolean language plpgsql stable as $$
declare
  v_session uuid;
begin
  select s.id into v_session
  from public.mai_singoff_sessions s
  where s.room_name = p_room_name
    and s.status = 'active'
    and s.ended_at is null;

  if v_session is null then
    return false;
  end if;

  if p_mode = 'singoff-viewer' then
    return exists (select 1 from public.mai_singoff_participants p where p.session_id = v_session and p.user_id = p_user_id);
  end if;

  if p_mode = 'singoff-publisher' then
    return exists (
      select 1 from public.mai_singoff_participants p
      where p.session_id = v_session
        and p.user_id = p_user_id
        and p.role in ('host','challenger','judge','host_judge','ceo_judge')
        and p.position is not null
    );
  end if;

  return false;
end;
$$;

-- =========================================================================
-- RPCs
-- =========================================================================

-- Create a new Sing Off session (CEO / admins only)
create or replace function public.singoff_create_session(p_user_id uuid, p_config jsonb default '{}'::jsonb)
returns table (session_id uuid, room_name text) language plpgsql as $$
begin
if not public.singoff_is_staff(p_user_id) then
    raise exception 'only staff may create a Sing Off session' using errcode = '22023';
    return query select null::uuid, null::text;
  end if;

  return query
  insert into public.mai_singoff_sessions (host_id, status, config, room_name)
  values (p_user_id, 'setup', p_config, 'mai-singoff-' || gen_random_uuid()::text)
  returning mai_singoff_sessions.id, mai_singoff_sessions.room_name;
end;
$$;

-- Start the show (host / staff)
create or replace function public.singoff_start_show(p_session_id uuid, p_user_id uuid)
returns json language plpgsql as $$
declare
  v json;
begin
  if not public.singoff_can_manage_session(p_session_id, p_user_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  update public.mai_singoff_sessions
  set status = 'active', started_at = now(), updated_at = now()
  where id = p_session_id;

  -- upsert the host participant as the center-stage host
  insert into public.mai_singoff_participants (session_id, user_id, role, position, can_publish)
  values (p_session_id, p_user_id, 'host', 'host_stage', true)
  on conflict (session_id, user_id) do update
    set role = 'host', position = 'host_stage', can_publish = true, updated_at = now();

  -- pull profile snapshot
  v := json_build_object('success', true, 'session_id', p_session_id);
  return v;
end;
$$;

-- End the show (host / staff)
create or replace function public.singoff_end_show(p_session_id uuid, p_user_id uuid)
returns json language plpgsql as $$
begin
  if not public.singoff_can_manage_session(p_session_id, p_user_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  update public.mai_singoff_sessions
  set status = 'ended', ended_at = now(), updated_at = now()
  where id = p_session_id;

  -- revoke publishing for everyone
  update public.mai_singoff_participants
  set can_publish = false, position = 'audience', role = 'audience', updated_at = now()
  where session_id = p_session_id and role in ('challenger','host','judge','host_judge','ceo_judge');

  return json_build_object('success', true);
end;
$$;

-- Join as audience
create or replace function public.singoff_join_session(p_session_id uuid, p_user_id uuid)
returns json language plpgsql as $$
begin
  insert into public.mai_singoff_participants (session_id, user_id, role, position, can_publish)
  values (p_session_id, p_user_id, 'audience', null, false)
  on conflict (session_id, user_id) do nothing;

  return json_build_object('success', true);
end;
$$;

-- Assign a position to a participant (host / staff). Server-authoritative.
create or replace function public.singoff_assign_position(
  p_session_id uuid,
  p_target_user_id uuid,
  p_position text,
  p_role text,
  p_assigner_id uuid
) returns json language plpgsql as $$
declare
  v_role text;
  v_position text;
begin
  if not public.singoff_can_manage_session(p_session_id, p_assigner_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  v_role := p_role;
  v_position := p_position;

  update public.mai_singoff_participants
  set role = v_role,
      position = v_position,
      can_publish = (v_role in ('host','challenger','judge','host_judge','ceo_judge')),
      updated_at = now()
  where session_id = p_session_id and user_id = p_target_user_id;

  if not found then
    insert into public.mai_singoff_participants (session_id, user_id, role, position, can_publish)
    values (p_session_id, p_target_user_id, v_role, v_position, (v_role in ('host','challenger','judge','host_judge','ceo_judge')));
  end if;

  return json_build_object('success', true, 'user_id', p_target_user_id, 'role', v_role, 'position', v_position);
end;
$$;

-- Host sit / speak: move the host between host_stage and host_judge
create or replace function public.singoff_move_host(p_session_id uuid, p_host_user_id uuid, p_target_position text)
returns json language plpgsql as $$
declare
  v_ok boolean;
begin
  select true into v_ok from public.mai_singoff_participants p
  join public.mai_singoff_sessions s on s.id = p.session_id
  where p.session_id = p_session_id
    and p.user_id = p_host_user_id
    and p.role = 'host'
    and s.host_id = p_host_user_id;

  if not v_ok then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  if p_target_position not in ('host_stage','host_judge') then
    return json_build_object('success', false, 'error', 'invalid position');
  end if;

  update public.mai_singoff_participants
  set position = p_target_position, can_publish = true, updated_at = now()
  where session_id = p_session_id and user_id = p_host_user_id and role = 'host';

  return json_build_object('success', true, 'position', p_target_position);
end;
$$;

-- Call a queued user to a challenger slot; advances their queue status to 'called'
create or replace function public.singoff_call_to_stage(
  p_session_id uuid,
  p_user_id uuid,
  p_position text,
  p_caller_id uuid
) returns json language plpgsql as $$
begin
  if not public.singoff_can_manage_session(p_session_id, p_caller_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  if p_position not in ('challenger_a','challenger_b') then
    return json_build_object('success', false, 'error', 'invalid position');
  end if;

  -- mark queue entry as called
  update public.mai_singoff_queue
  set status = 'called', requested_position = p_position, updated_at = now()
  where session_id = p_session_id and user_id = p_user_id;

  -- assign stage position (can_publish true; the 10s countdown is UI-enforced)
  update public.mai_singoff_participants
  set role = 'challenger', position = p_position, can_publish = true, updated_at = now()
  where session_id = p_session_id and user_id = p_user_id;

  if not found then
    insert into public.mai_singoff_participants (session_id, user_id, role, position, can_publish)
    values (p_session_id, p_user_id, 'challenger', p_position, true);
  end if;

  return json_build_object('success', true, 'user_id', p_user_id, 'position', p_position);
end;
$$;

-- Request to join the queue
create or replace function public.singoff_request_queue(
  p_session_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_avatar_url text,
  p_level integer,
  p_troll_coins bigint,
  p_requested_position text
) returns json language plpgsql as $$
declare
  v_count integer;
  v_sort integer;
begin
  -- only audience members already in the session may queue
  if not exists (
    select 1 from public.mai_singoff_participants p
    where p.session_id = p_session_id and p.user_id = p_user_id and p.role = 'audience'
  ) then
    return json_build_object('success', false, 'error', 'must be in the audience first');
  end if;

  if p_requested_position is not null and p_requested_position not in ('challenger_a','challenger_b') then
    return json_build_object('success', false, 'error', 'invalid position');
  end if;

  select count(*) into v_count from public.mai_singoff_queue q
  where q.session_id = p_session_id and q.status in ('waiting','called','countdown','on_stage');

  v_sort := v_count + 1;

  insert into public.mai_singoff_queue
    (session_id, user_id, display_name, avatar_url, level, troll_coins, status, requested_position, sort_order)
  values
    (p_session_id, p_user_id, p_display_name, p_avatar_url, p_level, p_troll_coins, 'waiting', p_requested_position, v_sort)
  on conflict (session_id, user_id) do update
    set status = 'waiting', requested_position = p_requested_position, sort_order = v_sort, updated_at = now()
    where mai_singoff_queue.status in ('left','kicked','completed');

  return json_build_object('success', true);
end;
$$;

-- Host updates a queue entry's status (e.g. kick / move)
create or replace function public.singoff_update_queue_status(
  p_session_id uuid,
  p_entry_id uuid,
  p_new_status text,
  p_updater_id uuid
) returns json language plpgsql as $$
begin
  if not public.singoff_can_manage_session(p_session_id, p_updater_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  update public.mai_singoff_queue
  set status = p_new_status, updated_at = now()
  where id = p_entry_id and session_id = p_session_id;

  if not found then
    return json_build_object('success', false, 'error', 'entry not found');
  end if;

  return json_build_object('success', true, 'status', p_new_status);
end;
$$;

-- Judge submits a vote for a challenger (idempotent)
create or replace function public.singoff_submit_decision(
  p_session_id uuid,
  p_round_id uuid,
  p_judge_id uuid,
  p_challenger_id uuid,
  p_decision text,
  p_is_mai_winner boolean default false
) returns json language plpgsql as $$
declare
  v_decision text;
begin
  if p_decision not in ('no','yes','mai_winner') then
    return json_build_object('success', false, 'error', 'invalid decision');
  end if;

  if not public.singoff_is_active_judge(p_session_id, p_judge_id) then
    return json_build_object('success', false, 'error', 'not an active judge');
  end if;

  if p_is_mai_winner then
    v_decision := 'mai_winner';
    -- only one Mai Winner per round
    if exists (
      select 1 from public.mai_singoff_decisions
      where session_id = p_session_id and round_id = p_round_id and decision = 'mai_winner'
    ) then
      return json_build_object('success', false, 'error', 'a Mai Winner is already declared for this round');
    end if;
  else
    v_decision := p_decision;
  end if;

  insert into public.mai_singoff_decisions
    (session_id, round_id, judge_id, challenger_id, decision)
  values
    (p_session_id, p_round_id, p_judge_id, p_challenger_id, v_decision)
  on conflict (session_id, round_id, judge_id, challenger_id) do update
    set decision = v_decision, created_at = now();

  return json_build_object('success', true, 'decision', v_decision);
end;
$$;

-- Convenience wrapper for the CEO / Mai seat to call an instant winner
create or replace function public.singoff_mai_winner(
  p_session_id uuid,
  p_round_id uuid,
  p_judge_id uuid,
  p_challenger_id uuid
) returns json language plpgsql as $$
begin
  return (select public.singoff_submit_decision(p_session_id, p_round_id, p_judge_id, p_challenger_id, 'mai_winner', true));
end;
$$;

-- Host ends a round: picks a winner if a majority exists or a Mai Winner was declared.
create or replace function public.singoff_end_round(p_session_id uuid, p_round_id uuid, p_closer_id uuid)
returns json language plpgsql as $$
declare
  v_winner uuid;
  v_a uuid; v_b uuid;
  v_yes_a integer; v_yes_b integer;
  v_mai boolean;
begin
  if not public.singoff_can_manage_session(p_session_id, p_closer_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  select challenger_a_id, challenger_b_id into v_a, v_b
  from public.mai_singoff_rounds where id = p_round_id and session_id = p_session_id;

  select count(*) filter (where challenger_id = v_a and decision = 'yes') into v_yes_a
  from public.mai_singoff_decisions where round_id = p_round_id;
  select count(*) filter (where challenger_id = v_b and decision = 'yes') into v_yes_b
  from public.mai_singoff_decisions where round_id = p_round_id;
  select exists (select 1 from public.mai_singoff_decisions where round_id = p_round_id and decision = 'mai_winner') into v_mai;

  if v_mai then
    select challenger_id into v_winner
    from public.mai_singoff_decisions where round_id = p_round_id and decision = 'mai_winner' limit 1;
  elsif v_yes_a >= 2 and v_yes_a > v_yes_b then
    v_winner := v_a;
  elsif v_yes_b >= 2 and v_yes_b > v_yes_a then
    v_winner := v_b;
  else
    return json_build_object('success', false, 'error', 'no majority yet', 'votes_a', v_yes_a, 'votes_b', v_yes_b);
  end if;

  update public.mai_singoff_rounds set status = 'completed', winner_id = v_winner
  where id = p_round_id;

  return json_build_object('success', true, 'winner_id', v_winner);
end;
$$;

-- Staff kick a user out of the current show
create or replace function public.singoff_kick_user(p_session_id uuid, p_target_user_id uuid, p_actor_id uuid)
returns json language plpgsql as $$
begin
  if not public.singoff_can_manage_session(p_session_id, p_actor_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  update public.mai_singoff_participants
  set role = 'audience', position = null, can_publish = false, updated_at = now()
  where session_id = p_session_id and user_id = p_target_user_id;

  update public.mai_singoff_queue
  set status = 'kicked', updated_at = now()
  where session_id = p_session_id and user_id = p_target_user_id;

  return json_build_object('success', true);
end;
$$;

-- Judge application
create or replace function public.singoff_apply_judge(
  p_user_id uuid,
  p_statement text,
  p_experience text,
  p_broadcasting_experience text,
  p_agreement boolean
) returns json language plpgsql as $$
begin
  if not p_agreement then
    return json_build_object('success', false, 'error', 'agreement required');
  end if;

  insert into public.mai_singoff_judge_applications
    (user_id, statement, experience, broadcasting_experience, agreement, status)
  values
    (p_user_id, p_statement, p_experience, p_broadcasting_experience, p_agreement, 'pending')
  on conflict (user_id) do update
    set statement = excluded.statement,
        experience = excluded.experience,
        broadcasting_experience = excluded.broadcasting_experience,
        agreement = excluded.agreement,
        status = 'pending',
        reviewed_by = null,
        reviewed_at = null,
        updated_at = now()
    where mai_singoff_judge_applications.status in ('pending','rejected','suspended');

  return json_build_object('success', true);
end;
$$;

-- Approve / reject / suspend a judge application (staff)
create or replace function public.singoff_set_judge_status(p_application_id uuid, p_assigner_id uuid, p_action text, p_reason text default null)
returns json language plpgsql as $$
declare
  v_status text;
  v_user_id uuid;
begin
  if not public.singoff_is_staff(p_assigner_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  case p_action
    when 'approve' then v_status := 'approved';
    when 'reject' then v_status := 'rejected';
    when 'suspend' then v_status := 'suspended';
    else return json_build_object('success', false, 'error', 'invalid action');
  end case;

  update public.mai_singoff_judge_applications
  set status = v_status, reviewed_by = p_assigner_id, reviewed_at = now(), updated_at = now()
  where id = p_application_id
  returning user_id into v_user_id;

  if not found then
    return json_build_object('success', false, 'error', 'application not found');
  end if;

  -- if approved, grant the judge role on the current active session (if any)
  if v_status = 'approved' then
    update public.mai_singoff_participants
    set role = 'judge', position = 'judge_1', can_publish = true
    where session_id in (select id from public.mai_singoff_sessions where status = 'active' and ended_at is null)
      and user_id = v_user_id
      and role = 'audience';
  end if;

  return json_build_object('success', true, 'status', v_status, 'user_id', v_user_id);
end;
$$;

-- Read: full session state for a joining viewer
create or replace function public.singoff_get_session_state(p_session_id uuid, p_user_id uuid)
returns json language sql stable as $$
  select json_build_object(
    'session', to_json(s),
    'participants', (select json_agg(to_json(p)) from public.mai_singoff_participants p where p.session_id = s.id),
'queue', (select json_agg(to_json(q) order by q.sort_order) from public.mai_singoff_queue q where q.session_id = s.id and q.status in ('waiting','called','countdown','on_stage')),
'rounds', (select json_agg(to_json(r) order by r.round_number) from public.mai_singoff_rounds r where r.session_id = s.id),
    'decisions', (select json_agg(to_json(d)) from public.mai_singoff_decisions d where d.session_id = s.id),
    'host_id', s.host_id,
    'is_staff', public.singoff_is_staff(p_user_id),
    'is_host', s.host_id = p_user_id,
    'is_ceo', (select p.is_ceo from public.user_profiles p where p.id = p_user_id),
    'is_judge', public.singoff_is_active_judge(s.id, p_user_id)
  )
  from public.mai_singoff_sessions s
  where s.id = p_session_id;
$$;

-- Read: platform-wide + personal stats
create or replace function public.singoff_get_stats(p_user_id uuid default null)
returns json language sql stable as $$
  select json_build_object(
    'total_shows', (select count(*) from public.mai_singoff_sessions where status in ('active','ended')),
    'active_shows', (select count(*) from public.mai_singoff_sessions where status = 'active' and ended_at is null),
    'total_rounds', (select count(*) from public.mai_singoff_rounds where status = 'completed'),
    'top_winners', (select json_agg(json_build_object('user_id', user_id, 'wins', wins)) from (
      select winner_id as user_id, count(*) as wins
      from public.mai_singoff_rounds where winner_id is not null
      group by winner_id order by wins desc limit 10
    ) w),
    'my_wins', (select count(*) from public.mai_singoff_rounds where winner_id = p_user_id),
    'my_judged', (select count(*) from public.mai_singoff_decisions where judge_id = p_user_id)
  );
$$;

-- Update session config (staff)
create or replace function public.singoff_update_config(p_session_id uuid, p_user_id uuid, p_config jsonb)
returns json language plpgsql as $$
begin
  if not public.singoff_can_manage_session(p_session_id, p_user_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  update public.mai_singoff_sessions
  set config = mai_singoff_sessions.config || p_config, updated_at = now()
  where id = p_session_id;

  return json_build_object('success', true);
end;
$$;

-- Create a new round (host pulls next two queue entrants as challengers)
create or replace function public.singoff_start_round(p_session_id uuid, p_creator_id uuid)
returns json language plpgsql as $$
declare
  v_round_num integer;
  v_prev_winner uuid;
  v_a uuid; v_b uuid;
  v_round_id uuid;
begin
  if not public.singoff_can_manage_session(p_session_id, p_creator_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  select coalesce(max(round_number), 0) + 1 into v_round_num
  from public.mai_singoff_rounds where session_id = p_session_id;

  -- the previous round's winner takes the center Host seat for this round
  select winner_id into v_prev_winner
  from public.mai_singoff_rounds
  where session_id = p_session_id and status = 'completed'
  order by round_number desc limit 1;

  if v_prev_winner is not null then
    update public.mai_singoff_participants
    set role = 'host', position = 'host_stage', can_publish = true, updated_at = now()
    where session_id = p_session_id and user_id = v_prev_winner;
  end if;

  -- grab the next two waiting queue entrants as challengers
  select user_id into v_a from public.mai_singoff_queue
  where session_id = p_session_id and status = 'waiting'
  order by sort_order limit 1;

  select user_id into v_b from public.mai_singoff_queue
  where session_id = p_session_id and status = 'waiting' and user_id <> v_a
  order by sort_order limit 1;

  if v_a is null or v_b is null then
    return json_build_object('success', false, 'error', 'not enough challengers in queue');
  end if;

  insert into public.mai_singoff_rounds (session_id, round_number, status, challenger_a_id, challenger_b_id)
  values (p_session_id, v_round_num, 'active', v_a, v_b)
  returning id into v_round_id;

  update public.mai_singoff_participants
  set role = 'challenger', position = 'challenger_a', can_publish = true, updated_at = now()
  where session_id = p_session_id and user_id = v_a;
  update public.mai_singoff_participants
  set role = 'challenger', position = 'challenger_b', can_publish = true, updated_at = now()
  where session_id = p_session_id and user_id = v_b;

  update mai_singoff_queue set status = 'on_stage' where session_id = p_session_id and user_id in (v_a, v_b);

  update public.mai_singoff_sessions set round_number = v_round_num, updated_at = now()
  where id = p_session_id;

  return json_build_object('success', true, 'round_id', v_round_id, 'round_number', v_round_num, 'challenger_a', v_a, 'challenger_b', v_b, 'host_winner_previous', v_prev_winner);
end;
$$;




