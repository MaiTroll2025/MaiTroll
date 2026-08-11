-- Migration: Mai Sing Off — Virtual Talent Show revamp.
-- Adds: show scheduling (timestamptz/UTC, scheduled|cancelled states), unified
-- judge/host role applications, host records, LiveKit-safe role revocation,
-- championship seasons with editable grand prizes (auto-qualify on demand),
-- aggregated upcoming-events read model for EPaper, idempotency guards, and
-- audit logging for staff actions.
-- Date: 2026-08-08

-- =========================================================================
-- 1. Sessions: scheduling + cancelled state
-- =========================================================================

alter table public.mai_singoff_sessions
  add column if not exists title text,
  add column if not exists scheduled_at timestamptz;

-- Expand status lifecycle: scheduled -> setup -> active -> ended (or cancelled)
alter table public.mai_singoff_sessions
  drop constraint if exists mai_singoff_sessions_status_check;

alter table public.mai_singoff_sessions
  add constraint mai_singoff_sessions_status_check
  check (status in ('setup','scheduled','active','ended','cancelled'));

-- =========================================================================
-- 2. Role applications (judge + host) — replaces judge_applications
-- =========================================================================

create table if not exists public.mai_singoff_role_applications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.user_profiles(id),
  application_type text not null default 'judge' check (application_type in ('judge','host')),
  status          text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  statement       text,
  experience      text,
  broadcasting_experience text,
  agreement       boolean not null default false,
  reviewed_by     uuid references public.user_profiles(id),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, application_type)
);

create index on public.mai_singoff_role_applications (status, created_at);
create index on public.mai_singoff_role_applications (user_id);

-- Data migration: carry existing judge applications into the new table.
insert into public.mai_singoff_role_applications
  (id, user_id, application_type, status, statement, experience, broadcasting_experience,
   agreement, reviewed_by, reviewed_at, created_at, updated_at)
select
  id, user_id, 'judge', status, statement, experience, broadcasting_experience,
  agreement, reviewed_by, reviewed_at, created_at, updated_at
from public.mai_singoff_judge_applications;

-- Drop legacy table (its RLS policies go with it).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_judge_applications' AND relkind = 'r') THEN
    DROP TABLE public.mai_singoff_judge_applications;
  ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_judge_applications' AND relkind = 'v') THEN
    DROP VIEW public.mai_singoff_judge_applications;
  END IF;
END; $$;

-- Backward-compatible read view (security_invoker keeps RLS intact).
create or replace view public.mai_singoff_judge_applications
with (security_invoker = true) as
select
  id, user_id, status, statement, experience, broadcasting_experience,
  agreement, reviewed_by, reviewed_at, created_at, updated_at
from public.mai_singoff_role_applications
where application_type = 'judge';

-- =========================================================================
-- 3. Hosts table (mirrors judges) + audit logs + revocation events
-- =========================================================================

create table if not exists public.mai_singoff_hosts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.user_profiles(id),
  session_id  uuid references public.mai_singoff_sessions(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  is_active   boolean not null default true,
  unique (user_id, session_id)
);

create table if not exists public.mai_singoff_audit_logs (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references public.user_profiles(id),
  target_user_id uuid references public.user_profiles(id),
  session_id     uuid references public.mai_singoff_sessions(id) on delete set null,
  action         text not null,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index on public.mai_singoff_audit_logs (session_id, created_at);
create index on public.mai_singoff_audit_logs (actor_user_id, created_at);
create index on public.mai_singoff_audit_logs (target_user_id, created_at);

-- LiveKit revocation path: DB state is the source of truth, but the media
-- disconnect is delivered to the client / re-validated by the livekit-token
-- edge function via this event stream. Frontend subscribes by user_id.
create table if not exists public.mai_singoff_revocation_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.user_profiles(id),
  session_id   uuid references public.mai_singoff_sessions(id) on delete cascade,
  kind         text not null default 'role_revoked',
  reason       text,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  consumed_at  timestamptz
);

create index on public.mai_singoff_revocation_events (user_id, created_at);
create index on public.mai_singoff_revocation_events (session_id, created_at);

-- =========================================================================
-- 4. Championships: season numbers + grand prizes + completion
-- =========================================================================

alter table public.mai_singoff_championships
  add column if not exists season_number integer,
  add column if not exists grand_prize_coins bigint not null default 0,
  add column if not exists grand_prize_description text,
  add column if not exists entries_limit integer not null default 16,
  add column if not exists bracket jsonb not null default '{}'::jsonb,
  add column if not exists champion_user_id uuid references public.user_profiles(id),
  add column if not exists completed_at timestamptz;

create index if not exists mai_singoff_championships_season_idx
  on public.mai_singoff_championships (season_number);

-- =========================================================================
-- 5. RLS for new/changed tables
-- =========================================================================

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_role_applications' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_role_applications ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_hosts' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_hosts ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_audit_logs' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_audit_logs ENABLE ROW LEVEL SECURITY; END IF; END; $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_singoff_revocation_events' AND relkind = 'r') THEN ALTER TABLE public.mai_singoff_revocation_events ENABLE ROW LEVEL SECURITY; END IF; END; $$;

-- role_applications: self read/insert; staff read + manage
DROP POLICY IF EXISTS "role apps select self" on public.mai_singoff_role_applications
 ; CREATE POLICY "role apps select self" on public.mai_singoff_role_applications
  for select using (auth.uid() = user_id);
DROP POLICY IF EXISTS "role apps select staff" on public.mai_singoff_role_applications
 ; CREATE POLICY "role apps select staff" on public.mai_singoff_role_applications
  for select using (public.singoff_is_staff(auth.uid()));
DROP POLICY IF EXISTS "role apps insert self" on public.mai_singoff_role_applications
 ; CREATE POLICY "role apps insert self" on public.mai_singoff_role_applications
  for insert with check (auth.uid() = user_id);
DROP POLICY IF EXISTS "role apps manage staff" on public.mai_singoff_role_applications
 ; CREATE POLICY "role apps manage staff" on public.mai_singoff_role_applications
  for update using (public.singoff_is_staff(auth.uid()));

-- hosts: read authenticated; manage staff
DROP POLICY IF EXISTS "hosts select" on public.mai_singoff_hosts
 ; CREATE POLICY "hosts select" on public.mai_singoff_hosts
  for select using (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "hosts manage" on public.mai_singoff_hosts
 ; CREATE POLICY "hosts manage" on public.mai_singoff_hosts
  for all using (public.singoff_is_staff(auth.uid())) with check (public.singoff_is_staff(auth.uid()));

-- audit_logs: staff only
DROP POLICY IF EXISTS "audit logs select staff" on public.mai_singoff_audit_logs
 ; CREATE POLICY "audit logs select staff" on public.mai_singoff_audit_logs
  for select using (public.singoff_is_staff(auth.uid()));
DROP POLICY IF EXISTS "audit logs insert staff" on public.mai_singoff_audit_logs
 ; CREATE POLICY "audit logs insert staff" on public.mai_singoff_audit_logs
  for insert with check (public.singoff_is_staff(auth.uid()));

-- revocation_events: self read (so clients can disconnect), staff read/insert
DROP POLICY IF EXISTS "revocation select self" on public.mai_singoff_revocation_events
 ; CREATE POLICY "revocation select self" on public.mai_singoff_revocation_events
  for select using (auth.uid() = user_id);
DROP POLICY IF EXISTS "revocation select staff" on public.mai_singoff_revocation_events
 ; CREATE POLICY "revocation select staff" on public.mai_singoff_revocation_events
  for select using (public.singoff_is_staff(auth.uid()));
DROP POLICY IF EXISTS "revocation insert staff" on public.mai_singoff_revocation_events
 ; CREATE POLICY "revocation insert staff" on public.mai_singoff_revocation_events
  for insert with check (public.singoff_is_staff(auth.uid()));

-- =========================================================================
-- 6. Shared audit helper
-- =========================================================================

create or replace function public.singoff_audit_log(
  p_actor uuid,
  p_target uuid,
  p_session uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
) returns void language sql as $$
  insert into public.mai_singoff_audit_logs (actor_user_id, target_user_id, session_id, action, metadata)
  values (p_actor, p_target, p_session, p_action, p_metadata);
$$;

-- =========================================================================
-- 7. Scheduling RPCs
-- =========================================================================

create or replace function public.singoff_schedule_show(
  p_user_id uuid,
  p_title text,
  p_scheduled_at timestamptz,
  p_config jsonb default '{}'::jsonb
) returns table (session_id uuid, room_name text) language plpgsql as $$
begin
  if not public.singoff_is_staff(p_user_id) then
    raise exception 'only staff may schedule a Sing Off show' using errcode = '22023';
    return query select null::uuid, null::text;
  end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'scheduled_at must be in the future' using errcode = '22023';
    return query select null::uuid, null::text;
  end if;

  return query
  insert into public.mai_singoff_sessions (host_id, status, config, room_name, title, scheduled_at)
  values (p_user_id, 'scheduled', p_config, 'mai-singoff-' || gen_random_uuid()::text,
          coalesce(p_title, 'Mai Sing Off'), p_scheduled_at)
  returning mai_singoff_sessions.id, mai_singoff_sessions.room_name;
end;
$$;

create or replace function public.singoff_update_scheduled_show(
  p_session_id uuid,
  p_user_id uuid,
  p_title text default null,
  p_scheduled_at timestamptz default null
) returns json language plpgsql as $$
begin
  if not public.singoff_can_manage_session(p_session_id, p_user_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;
  if p_title is null and p_scheduled_at is null then
    return json_build_object('success', false, 'error', 'nothing to update');
  end if;
  if p_scheduled_at is not null and p_scheduled_at <= now() then
    return json_build_object('success', false, 'error', 'scheduled_at must be in the future');
  end if;

  update public.mai_singoff_sessions
  set title = coalesce(p_title, title),
      scheduled_at = coalesce(p_scheduled_at, scheduled_at),
      updated_at = now()
  where id = p_session_id and status = 'scheduled';

  if not found then
    return json_build_object('success', false, 'error', 'scheduled show not found');
  end if;

  perform public.singoff_audit_log(p_user_id, null, p_session_id, 'update_scheduled_show',
    json_build_object('title', p_title, 'scheduled_at', p_scheduled_at));
  return json_build_object('success', true);
end;
$$;

create or replace function public.singoff_cancel_scheduled_show(p_session_id uuid, p_user_id uuid)
returns json language plpgsql as $$
begin
  if not public.singoff_can_manage_session(p_session_id, p_user_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  update public.mai_singoff_sessions
  set status = 'cancelled', updated_at = now()
  where id = p_session_id and status = 'scheduled';

  if not found then
    return json_build_object('success', false, 'error', 'show not scheduled or not found');
  end if;

  perform public.singoff_audit_log(p_user_id, null, p_session_id, 'cancel_scheduled_show', '{}'::jsonb);
  return json_build_object('success', true);
end;
$$;

create or replace function public.singoff_list_scheduled_shows()
returns json language sql stable as $$
  select coalesce(json_agg(json_build_object(
    'id', s.id,
    'title', s.title,
    'room_name', s.room_name,
    'host_id', s.host_id,
    'scheduled_at', s.scheduled_at,
    'status', s.status,
    'config', s.config
  ) order by s.scheduled_at), '[]'::json)
  from public.mai_singoff_sessions s
  where s.status = 'scheduled' and s.scheduled_at >= now();
$$;

-- =========================================================================
-- 8. Role application RPCs (judge + host)
-- =========================================================================

create or replace function public.singoff_apply_role(
  p_user_id uuid,
  p_application_type text,
  p_statement text,
  p_experience text,
  p_broadcasting_experience text,
  p_agreement boolean
) returns json language plpgsql as $$
begin
  if p_application_type not in ('judge','host') then
    return json_build_object('success', false, 'error', 'invalid application type');
  end if;
  if not p_agreement then
    return json_build_object('success', false, 'error', 'agreement required');
  end if;

  insert into public.mai_singoff_role_applications
    (user_id, application_type, statement, experience, broadcasting_experience, agreement, status)
  values
    (p_user_id, p_application_type, p_statement, p_experience, p_broadcasting_experience, p_agreement, 'pending')
  on conflict (user_id, application_type) do update
    set statement = excluded.statement,
        experience = excluded.experience,
        broadcasting_experience = excluded.broadcasting_experience,
        agreement = excluded.agreement,
        status = 'pending',
        reviewed_by = null,
        reviewed_at = null,
        updated_at = now()
    where mai_singoff_role_applications.status in ('pending','rejected','suspended');

  return json_build_object('success', true);
end;
$$;

-- Backward-compatible judge-only wrapper.
create or replace function public.singoff_apply_judge(
  p_user_id uuid,
  p_statement text,
  p_experience text,
  p_broadcasting_experience text,
  p_agreement boolean
) returns json language plpgsql as $$
begin
  return public.singoff_apply_role(p_user_id, 'judge', p_statement, p_experience, p_broadcasting_experience, p_agreement);
end;
$$;

-- Approve / reject / suspend an application. Idempotent (approving an
-- already-approved application is a no-op success).
create or replace function public.singoff_review_application(
  p_application_id uuid,
  p_assigner_id uuid,
  p_action text,
  p_reason text default null
) returns json language plpgsql as $$
declare
  v_status text;
  v_user_id uuid;
  v_type text;
  v_session uuid;
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

  select user_id, application_type into v_user_id, v_type
  from public.mai_singoff_role_applications
  where id = p_application_id;

  if not found then
    return json_build_object('success', false, 'error', 'application not found');
  end if;

  if v_status = 'approved' then
    if exists (select 1 from public.mai_singoff_role_applications
               where id = p_application_id and status = 'approved') then
      return json_build_object('success', true, 'status', 'approved', 'user_id', v_user_id,
                               'application_type', v_type, 'already', true);
    end if;
  end if;

  update public.mai_singoff_role_applications
  set status = v_status, reviewed_by = p_assigner_id, reviewed_at = now(), updated_at = now()
  where id = p_application_id;

  if v_status = 'approved' then
    select id into v_session
    from public.mai_singoff_sessions
    where status = 'active' and ended_at is null
    order by created_at desc limit 1;

    if v_type = 'judge' then
      insert into public.mai_singoff_judges (user_id, session_id, seat_index, is_active)
      values (v_user_id, v_session, (
        select least(coalesce(max(seat_index), 0) + 1, 4)
        from public.mai_singoff_judges
        where session_id is not distinct from v_session and is_active
      ), true)
      on conflict (user_id) do update
        set is_active = true,
            session_id = coalesce(excluded.session_id, mai_singoff_judges.session_id),
            assigned_at = now();
    else
      insert into public.mai_singoff_hosts (user_id, session_id, is_active)
      values (v_user_id, v_session, true)
      on conflict (user_id) do update
        set is_active = true,
            session_id = coalesce(excluded.session_id, mai_singoff_hosts.session_id),
            assigned_at = now();
    end if;
  end if;

  perform public.singoff_audit_log(p_assigner_id, v_user_id, null, 'review_application:' || p_action,
    json_build_object('application_id', p_application_id, 'application_type', v_type, 'reason', p_reason));

  return json_build_object('success', true, 'status', v_status, 'user_id', v_user_id, 'application_type', v_type);
end;
$$;

-- Backward-compatible wrapper used by the legacy admin panel.
create or replace function public.singoff_set_judge_status(
  p_application_id uuid,
  p_assigner_id uuid,
  p_action text,
  p_reason text default null
) returns json language plpgsql as $$
begin
  return public.singoff_review_application(p_application_id, p_assigner_id, p_action, p_reason);
end;
$$;

-- =========================================================================
-- 9. Release judge / host — instant access removal.
--    DB state is authoritative AND a revocation event is emitted so the
--    client + livekit-token edge function can drop the media connection.
-- =========================================================================

create or replace function public.singoff_release_role(
  p_user_id uuid,
  p_role text,
  p_assigner_id uuid,
  p_session_id uuid default null,
  p_reason text default null
) returns json language plpgsql as $$
declare
  v_target_session uuid;
begin
  if not public.singoff_is_staff(p_assigner_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;
  if p_role not in ('judge','host') then
    return json_build_object('success', false, 'error', 'invalid role');
  end if;

  if p_session_id is not null then
    v_target_session := p_session_id;
  else
    select id into v_target_session
    from public.mai_singoff_sessions
    where status = 'active' and ended_at is null
    order by created_at desc limit 1;
  end if;

  if p_role = 'judge' then
    update public.mai_singoff_judges set is_active = false
    where user_id = p_user_id and (v_target_session is null or session_id = v_target_session);
    if not found and v_target_session is not null then
      update public.mai_singoff_judges set is_active = false where user_id = p_user_id;
    end if;
  else
    update public.mai_singoff_hosts set is_active = false
    where user_id = p_user_id and (v_target_session is null or session_id = v_target_session);
    if not found and v_target_session is not null then
      update public.mai_singoff_hosts set is_active = false where user_id = p_user_id;
    end if;
  end if;

  -- Authoritative DB revocation: strip role/position/publish immediately.
  if v_target_session is not null then
    update public.mai_singoff_participants
    set role = 'audience', position = null, can_publish = false, updated_at = now()
    where session_id = v_target_session
      and user_id = p_user_id
      and role in ('judge','host','host_judge','ceo_judge','challenger');

    update public.mai_singoff_queue
    set status = 'kicked', updated_at = now()
    where session_id = v_target_session
      and user_id = p_user_id
      and status in ('waiting','called','countdown','on_stage');
  end if;

  -- LiveKit control-path event: client watches this and disconnects; the
  -- livekit-token edge function re-validates singoff_validate_token_access
  -- which now fails for this user.
  insert into public.mai_singoff_revocation_events (user_id, session_id, kind, reason, payload)
  values (p_user_id, v_target_session, 'role_revoked:' || p_role, p_reason,
          json_build_object('actor', p_assigner_id, 'role', p_role));

  perform public.singoff_audit_log(p_assigner_id, p_user_id, v_target_session, 'release_' || p_role,
    json_build_object('reason', p_reason));

  return json_build_object('success', true, 'user_id', p_user_id, 'role', p_role, 'session_id', v_target_session);
end;
$$;

-- =========================================================================
-- 10. Championship RPCs
-- =========================================================================

-- Create a championship season and auto-qualify top winners from completed
-- rounds. Idempotent: refuses to create a second season while one is
-- upcoming/active (prevents accidental duplicate seasons).
create or replace function public.singoff_generate_championship(
  p_user_id uuid,
  p_name text default null,
  p_grand_prize_coins bigint default 100000,
  p_grand_prize_description text default null,
  p_entries_limit integer default 16
) returns json language plpgsql as $$
declare
  v_championship_id uuid;
  v_season integer;
begin
  if not public.singoff_is_staff(p_user_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  if exists (select 1 from public.mai_singoff_championships where status in ('upcoming','active')) then
    return json_build_object('success', false, 'error', 'an active or upcoming championship already exists',
                             'already', true);
  end if;

  select coalesce(max(season_number), 0) + 1 into v_season
  from public.mai_singoff_championships;

  insert into public.mai_singoff_championships
    (name, status, season_number, grand_prize_coins, grand_prize_description, entries_limit, bracket,
     start_at, end_at)
  values
    (coalesce(p_name, 'Mai Sing Off Championship Season ' || v_season), 'upcoming', v_season,
     p_grand_prize_coins, p_grand_prize_description, greatest(p_entries_limit, 2),
     jsonb_build_object('rounds', 0, 'entries', jsonb_build_array()),
     now(), now() + interval '30 days')
  returning id into v_championship_id;

  -- Auto-qualify the top winners from completed rounds.
  insert into public.mai_singoff_championship_entries (championship_id, user_id, status, round_label)
  select v_championship_id, winner_id, 'pending', 'auto-qualified'
  from (
    select winner_id, count(*) as wins
    from public.mai_singoff_rounds
    where winner_id is not null
    group by winner_id
    order by wins desc
    limit greatest(p_entries_limit, 2)
  ) w
  on conflict (championship_id, user_id) do nothing;

  perform public.singoff_audit_log(p_user_id, null, null, 'generate_championship',
    json_build_object('championship_id', v_championship_id, 'season', v_season,
                      'prize_coins', p_grand_prize_coins));

  return json_build_object('success', true, 'championship_id', v_championship_id,
                           'season_number', v_season, 'entries_limit', greatest(p_entries_limit, 2));
end;
$$;

create or replace function public.singoff_edit_grand_prize(
  p_championship_id uuid,
  p_user_id uuid,
  p_coins bigint default null,
  p_description text default null
) returns json language plpgsql as $$
begin
  if not public.singoff_is_staff(p_user_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;
  if p_coins is null and p_description is null then
    return json_build_object('success', false, 'error', 'nothing to update');
  end if;

  update public.mai_singoff_championships
  set grand_prize_coins = coalesce(p_coins, grand_prize_coins),
      grand_prize_description = coalesce(p_description, grand_prize_description),
      updated_at = now()
  where id = p_championship_id;

  if not found then
    return json_build_object('success', false, 'error', 'championship not found');
  end if;

  perform public.singoff_audit_log(p_user_id, null, null, 'edit_grand_prize',
    json_build_object('championship_id', p_championship_id, 'coins', p_coins, 'description', p_description));

  return json_build_object('success', true);
end;
$$;

create or replace function public.singoff_complete_championship(
  p_championship_id uuid,
  p_user_id uuid,
  p_champion_user_id uuid
) returns json language plpgsql as $$
begin
  if not public.singoff_is_staff(p_user_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  update public.mai_singoff_championships
  set status = 'completed', champion_user_id = p_champion_user_id, completed_at = now(),
      updated_at = now()
  where id = p_championship_id;

  if not found then
    return json_build_object('success', false, 'error', 'championship not found');
  end if;

  perform public.singoff_audit_log(p_user_id, p_champion_user_id, null, 'complete_championship',
    json_build_object('championship_id', p_championship_id));

  return json_build_object('success', true, 'champion_user_id', p_champion_user_id);
end;
$$;

create or replace function public.singoff_list_championships()
returns json language sql stable as $$
  select coalesce(json_agg(json_build_object(
    'id', c.id,
    'name', c.name,
    'status', c.status,
    'season_number', c.season_number,
    'grand_prize_coins', c.grand_prize_coins,
    'grand_prize_description', c.grand_prize_description,
    'entries_limit', c.entries_limit,
    'champion_user_id', c.champion_user_id,
    'start_at', c.start_at,
    'end_at', c.end_at,
    'completed_at', c.completed_at,
    'entries', (
      select coalesce(json_agg(json_build_object(
        'user_id', e.user_id,
        'status', e.status,
        'round_label', e.round_label,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url
      )), '[]'::json)
      from public.mai_singoff_championship_entries e
      left join public.user_profiles p on p.id = e.user_id
      where e.championship_id = c.id
    )
  ) order by c.season_number desc nulls last), '[]'::json)
  from public.mai_singoff_championships c;
$$;

-- =========================================================================
-- 11. EPaper aggregated upcoming-events read model
-- =========================================================================

create or replace function public.singoff_get_upcoming_events()
returns json language sql stable as $$
  select coalesce(json_agg(e.event order by e.sort_key), '[]'::json)
  from (
    select json_build_object(
      'event_type', 'show',
      'event_id', s.id::text,
      'title', coalesce(s.title, 'Mai Sing Off'),
      'status', s.status,
      'scheduled_at', s.scheduled_at,
      'season_number', null::integer,
      'grand_prize_coins', null::bigint,
      'grand_prize_description', null::text,
      'route', '/mai-sing-off/live/' || s.id
    ) as event,
    s.scheduled_at as sort_key
    from public.mai_singoff_sessions s
    where s.status = 'scheduled' and s.scheduled_at >= now()

    union all

    select json_build_object(
      'event_type', 'championship',
      'event_id', c.id::text,
      'title', c.name,
      'status', c.status,
      'scheduled_at', coalesce(c.start_at, c.created_at),
      'season_number', c.season_number,
      'grand_prize_coins', c.grand_prize_coins,
      'grand_prize_description', c.grand_prize_description,
      'route', '/mai-sing-off?view=championship'
    ) as event,
    coalesce(c.start_at, c.created_at) as sort_key
    from public.mai_singoff_championships c
    where c.status in ('upcoming','active')
  ) e;
$$;

-- =========================================================================
-- 12. Management read models for the statistics/control panel
-- =========================================================================

create or replace function public.singoff_list_role_applications(p_user_id uuid)
returns json language sql stable as $$
  select case when public.singoff_is_staff(p_user_id) then
    (select coalesce(json_agg(json_build_object(
      'id', a.id,
      'user_id', a.user_id,
      'application_type', a.application_type,
      'status', a.status,
      'statement', a.statement,
      'experience', a.experience,
      'broadcasting_experience', a.broadcasting_experience,
      'agreement', a.agreement,
      'created_at', a.created_at,
      'updated_at', a.updated_at,
      'username', p.username,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url,
      'level', p.level,
      'troll_coins', p.troll_coins
    ) order by a.created_at desc), '[]'::json)
    from public.mai_singoff_role_applications a
    left join public.user_profiles p on p.id = a.user_id)
  else
    (select coalesce(json_agg(json_build_object(
      'id', a.id,
      'user_id', a.user_id,
      'application_type', a.application_type,
      'status', a.status,
      'statement', a.statement,
      'experience', a.experience,
      'broadcasting_experience', a.broadcasting_experience,
      'agreement', a.agreement,
      'created_at', a.created_at,
      'updated_at', a.updated_at,
      'username', p.username,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url,
      'level', p.level,
      'troll_coins', p.troll_coins
    ) order by a.created_at desc), '[]'::json)
    from public.mai_singoff_role_applications a
    left join public.user_profiles p on p.id = a.user_id
    where a.user_id = p_user_id)
  end;
$$;

create or replace function public.singoff_list_active_roles(p_user_id uuid)
returns json language sql stable as $$
  select json_build_object(
    'judges', case when public.singoff_is_staff(p_user_id) then
      (select coalesce(json_agg(json_build_object(
        'user_id', j.user_id,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'seat_index', j.seat_index,
        'session_id', j.session_id,
        'is_active', j.is_active
      )), '[]'::json)
      from public.mai_singoff_judges j
      left join public.user_profiles p on p.id = j.user_id
      where j.is_active)
    else '[]'::json end,
    'hosts', case when public.singoff_is_staff(p_user_id) then
      (select coalesce(json_agg(json_build_object(
        'user_id', h.user_id,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'session_id', h.session_id,
        'is_active', h.is_active
      )), '[]'::json)
      from public.mai_singoff_hosts h
      left join public.user_profiles p on p.id = h.user_id
      where h.is_active)
    else '[]'::json end
  );
$$;

-- =========================================================================
-- 13. Idempotent start/end show + audit
-- =========================================================================

create or replace function public.singoff_start_show(p_session_id uuid, p_user_id uuid)
returns json language plpgsql as $$
declare
  v_status text;
begin
  if not public.singoff_can_manage_session(p_session_id, p_user_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  select status into v_status from public.mai_singoff_sessions where id = p_session_id;

  if v_status = 'active' then
    return json_build_object('success', true, 'already', true, 'session_id', p_session_id);
  end if;

  update public.mai_singoff_sessions
  set status = 'active', started_at = now(), updated_at = now()
  where id = p_session_id;

  -- upsert the host participant as the center-stage host
  insert into public.mai_singoff_participants (session_id, user_id, role, position, can_publish)
  values (p_session_id, p_user_id, 'host', 'host_stage', true)
  on conflict (session_id, user_id) do update
    set role = 'host', position = 'host_stage', can_publish = true, updated_at = now();

  perform public.singoff_audit_log(p_user_id, null, p_session_id, 'start_show', '{}'::jsonb);

  return json_build_object('success', true, 'session_id', p_session_id);
end;
$$;

create or replace function public.singoff_end_show(p_session_id uuid, p_user_id uuid)
returns json language plpgsql as $$
declare
  v_status text;
begin
  if not public.singoff_can_manage_session(p_session_id, p_user_id) then
    return json_build_object('success', false, 'error', 'not authorized');
  end if;

  select status into v_status from public.mai_singoff_sessions where id = p_session_id;

  if v_status = 'ended' then
    return json_build_object('success', true, 'already', true);
  end if;

  update public.mai_singoff_sessions
  set status = 'ended', ended_at = now(), updated_at = now()
  where id = p_session_id;

  -- revoke publishing for everyone
  update public.mai_singoff_participants
  set can_publish = false, position = 'audience', role = 'audience', updated_at = now()
  where session_id = p_session_id and role in ('challenger','host','judge','host_judge','ceo_judge');

  -- deactivate show-scoped judges/hosts
  update public.mai_singoff_judges set is_active = false where session_id = p_session_id;
  update public.mai_singoff_hosts set is_active = false where session_id = p_session_id;

  perform public.singoff_audit_log(p_user_id, null, p_session_id, 'end_show', '{}'::jsonb);

  return json_build_object('success', true);
end;
$$;

-- =========================================================================
-- 14. Grantees
-- =========================================================================

grant usage on schema public to authenticated, anon;
grant execute on function
  public.singoff_schedule_show,
  public.singoff_update_scheduled_show,
  public.singoff_cancel_scheduled_show,
  public.singoff_list_scheduled_shows,
  public.singoff_apply_role,
  public.singoff_apply_judge,
  public.singoff_review_application,
  public.singoff_set_judge_status,
  public.singoff_release_role,
  public.singoff_generate_championship,
  public.singoff_edit_grand_prize,
  public.singoff_complete_championship,
  public.singoff_list_championships,
  public.singoff_get_upcoming_events,
  public.singoff_list_role_applications,
  public.singoff_list_active_roles,
  public.singoff_audit_log
to authenticated, anon;



