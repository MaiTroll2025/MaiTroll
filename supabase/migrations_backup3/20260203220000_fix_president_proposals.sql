
-- Migration: Fix President Proposals Table
-- Description: Re-applies the president proposals schema to ensure it exists.

-- 1. Proposals
create table if not exists president_proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  type text not null check (type in ('tax', 'event', 'challenge', 'giveaway', 'other')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  reviewed_by uuid references user_profiles(id),
  reviewed_at timestamptz,
  review_note text,
  metadata jsonb default '{}'::jsonb
);

-- 2. Audit Logs
create table if not exists president_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references user_profiles(id),
  action text not null,
  target_id uuid, -- Optional target (user, proposal, etc.)
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 3. Announcements (Presidential)
create table if not exists president_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  is_active boolean default true,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- RLS
alter table president_proposals enable row level security;
alter table president_audit_logs enable row level security;
alter table president_announcements enable row level security;

-- Policies

-- Proposals
drop policy if exists "Public read proposals" on president_proposals;
create policy "Public read proposals" on president_proposals for select using (true);

drop policy if exists "President/VP create proposals" on president_proposals;
create policy "President/VP create proposals" on president_proposals for insert with check (
  exists (
    select 1 from user_role_grants urg
    join system_roles sr on urg.role_id = sr.id
    where urg.user_id = auth.uid()
    and sr.name in ('president', 'vice_president')
    and (urg.expires_at is null or urg.expires_at > now())
  )
);

drop policy if exists "Admin/Secretary manage proposals" on president_proposals;
create policy "Admin/Secretary manage proposals" on president_proposals for update using (
  exists (
    select 1 from user_profiles
    where id = auth.uid()
    and (is_admin = true or role = 'secretary')
  )
);

-- Audit Logs
drop policy if exists "Admins view audit logs" on president_audit_logs;
create policy "Admins view audit logs" on president_audit_logs for select using (
  exists (
    select 1 from user_profiles
    where id = auth.uid()
    and is_admin = true
  )
);

-- Announcements
drop policy if exists "Public read president announcements" on president_announcements;
create policy "Public read president announcements" on president_announcements for select using (true);

-- Functions

-- 1. Helper: Log Action
create or replace function log_president_action(
  p_action text,
  p_details jsonb,
  p_target_id uuid default null
)
returns void
security definer
language plpgsql
as $$
begin
  insert into president_audit_logs (actor_id, action, target_id, details)
  values (auth.uid(), p_action, p_target_id, p_details);
end;
$$;

-- 2. Create Proposal
create or replace function create_president_proposal(
  p_title text,
  p_description text,
  p_type text
)
returns uuid
security definer
language plpgsql
as $$
declare
  v_id uuid;
begin
  -- Check Role
  if not exists (
    select 1 from user_role_grants urg
    join system_roles sr on urg.role_id = sr.id
    where urg.user_id = auth.uid()
    and sr.name in ('president', 'vice_president')
    and (urg.expires_at is null or urg.expires_at > now())
  ) then
    raise exception 'Not authorized';
  end if;

  insert into president_proposals (title, description, type, created_by)
  values (p_title, p_description, p_type, auth.uid())
  returning id into v_id;

  -- Log
  perform log_president_action('create_proposal', jsonb_build_object('title', p_title, 'type', p_type), v_id);

  return v_id;
end;
$$;

-- 3. Post Announcement (Rate Limited)
create or replace function post_president_announcement(p_message text)
returns uuid
security definer
language plpgsql
as $$
declare
  v_last_post timestamptz;
  v_id uuid;
  v_limit_hours int := 4; -- Configurable limit
begin
  -- Check Role
  if not exists (
    select 1 from user_role_grants urg
    join system_roles sr on urg.role_id = sr.id
    where urg.user_id = auth.uid()
    and sr.name in ('president', 'vice_president')
    and (urg.expires_at is null or urg.expires_at > now())
  ) then
    raise exception 'Not authorized';
  end if;

  -- Check Rate Limit
  select created_at into v_last_post
  from president_announcements
  where created_by = auth.uid()
  order by created_at desc
  limit 1;

  if v_last_post is not null and v_last_post > now() - (v_limit_hours || ' hours')::interval then
    raise exception 'Rate limit exceeded. Try again later.';
  end if;

  -- Insert into President Announcements
  insert into president_announcements (message, created_by, expires_at)
  values (p_message, auth.uid(), now() + interval '24 hours')
  returning id into v_id;

  -- Insert into Troll Posts (for public feed visibility)
  -- We use 'announcement' as post_type to trigger special styling
  -- Check if troll_posts exists first or just try insert
  -- Assuming troll_posts exists as it is core
  begin
    insert into troll_posts (user_id, content, post_type)
    values (auth.uid(), p_message, 'announcement');
  exception when others then
    -- Ignore if troll_posts issues, but likely we want it
    null;
  end;

  -- Log
  perform log_president_action('post_announcement', jsonb_build_object('message_snippet', substring(p_message from 1 for 50)), v_id);

  return v_id;
end;
$$;

-- 4. Spend Treasury (Safeguarded)
create or replace function spend_president_treasury(
  p_amount_cents bigint,
  p_reason text,
  p_recipient_id uuid default null 
)
returns void
security definer
language plpgsql
as $$
declare
  v_balance bigint;
  v_daily_spend bigint;
  v_daily_limit bigint := 100000; -- $1000.00 limit per day
  v_max_tx bigint := 25000; -- $250.00 max per transaction
begin
  -- Check Role
  if not exists (
    select 1 from user_role_grants urg
    join system_roles sr on urg.role_id = sr.id
    where urg.user_id = auth.uid()
    and sr.name = 'president' 
    and (urg.expires_at is null or urg.expires_at > now())
  ) then
    -- Check VP
     if not exists (
      select 1 from user_role_grants urg
      join system_roles sr on urg.role_id = sr.id
      where urg.user_id = auth.uid()
      and sr.name = 'vice_president'
      and (urg.expires_at is null or urg.expires_at > now())
    ) then
      raise exception 'Not authorized';
    end if;
  end if;

  -- Check Limits
  if p_amount_cents > v_max_tx then
    raise exception 'Transaction exceeds maximum limit';
  end if;

  -- Check Daily Spend
  select coalesce(sum(abs(amount_cents)), 0) into v_daily_spend
  from president_treasury_ledger
  where actor_id = auth.uid()
  and kind = 'spend'
  and created_at > now() - interval '24 hours';

  if v_daily_spend + p_amount_cents > v_daily_limit then
    raise exception 'Daily spending limit exceeded';
  end if;

  -- Check Balance
  select coalesce(sum(amount_cents), 0) into v_balance from president_treasury_ledger where currency = 'USD';
  
  if v_balance < p_amount_cents then
    raise exception 'Insufficient funds';
  end if;

  -- Execute Spend
  insert into president_treasury_ledger (amount_cents, kind, currency, actor_id, metadata)
  values (-p_amount_cents, 'spend', 'USD', auth.uid(), jsonb_build_object('reason', p_reason, 'recipient', p_recipient_id));

  -- Log
  perform log_president_action('spend_treasury', jsonb_build_object('amount', p_amount_cents, 'reason', p_reason));

end;
$$;

-- 5. Flag User (Influence)
create or replace function president_flag_user(
  p_target_user_id uuid,
  p_reason text
)
returns void
security definer
language plpgsql
as $$
begin
   -- Check Role
  if not exists (
    select 1 from user_role_grants urg
    join system_roles sr on urg.role_id = sr.id
    where urg.user_id = auth.uid()
    and sr.name in ('president', 'vice_president')
    and (urg.expires_at is null or urg.expires_at > now())
  ) then
    raise exception 'Not authorized';
  end if;

  perform log_president_action('flag_user', jsonb_build_object('reason', p_reason), p_target_user_id);
end;
$$;
