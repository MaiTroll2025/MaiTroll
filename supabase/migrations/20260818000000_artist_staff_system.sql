-- ============================================================
-- MAI RECORD LABEL — ARTIST STAFF / ARTIST MANAGEMENT SYSTEM
-- ============================================================

-- ============================================================
-- NOTIFICATION TYPES (extend existing enum-like union type)
-- ============================================================

-- No DB change needed for notification types; they are stored as text.
-- We will use these new types from the frontend:
--   artist_staff_offer
--   artist_staff_offer_accepted
--   artist_staff_offer_declined
--   artist_staff_suspended
--   artist_staff_terminated
--   artist_staff_reactivated

-- ============================================================
-- ARTIST STAFF MEMBERSHIPS
-- ============================================================

create table if not exists public.artist_staff_memberships (
  id uuid primary key default gen_random_uuid(),

  artist_id uuid not null
    references public.record_label_artist_profiles(id) on delete cascade,

  employee_user_id uuid not null
    references public.user_profiles(id) on delete cascade,

  "position" text not null,

  status text not null default 'pending'
    check (status in ('pending', 'active', 'declined', 'suspended', 'terminated', 'expired')),

  pay_type text not null default 'fixed'
    check (pay_type in ('fixed', 'hourly', 'commission', 'percentage')),

  pay_amount bigint not null default 0
    check (pay_amount >= 0),

  pay_currency text not null default 'troll_coins',

  pay_frequency text not null default 'monthly'
    check (pay_frequency in ('one_time', 'weekly', 'biweekly', 'monthly', 'per_release', 'per_post', 'commission')),

  permissions jsonb not null default '{}'::jsonb,

  start_date timestamptz,
  end_date timestamptz,

  offered_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  terminated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  created_by uuid
    references public.user_profiles(id) on delete set null,

   termination_reason text,
   notes text,

   constraint uq_artist_staff_unique_active
     unique (artist_id, employee_user_id, status)
 );

 create unique index if not exists uq_artist_staff_unique_active_idx
   on public.artist_staff_memberships(artist_id, employee_user_id, status)
   where status in ('pending', 'active', 'suspended');

create index if not exists idx_artist_staff_artist
  on public.artist_staff_memberships(artist_id);

create index if not exists idx_artist_staff_employee
  on public.artist_staff_memberships(employee_user_id);

create index if not exists idx_artist_staff_status
  on public.artist_staff_memberships(status);

-- ============================================================
-- ARTIST STAFF PAYMENTS
-- ============================================================

create table if not exists public.artist_staff_payments (
  id uuid primary key default gen_random_uuid(),

  membership_id uuid not null
    references public.artist_staff_memberships(id) on delete cascade,

  artist_id uuid not null
    references public.record_label_artist_profiles(id) on delete cascade,

  employee_user_id uuid not null
    references public.user_profiles(id) on delete cascade,

  amount bigint not null
    check (amount > 0),

  currency text not null default 'troll_coins',

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'paid', 'cancelled', 'failed')),

  payment_type text,
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  notes text
);

create index if not exists idx_artist_staff_payments_membership
  on public.artist_staff_payments(membership_id);

create index if not exists idx_artist_staff_payments_artist
  on public.artist_staff_payments(artist_id);

create index if not exists idx_artist_staff_payments_employee
  on public.artist_staff_payments(employee_user_id);

create index if not exists idx_artist_staff_payments_status
  on public.artist_staff_payments(status);

-- ============================================================
-- ARTIST STAFF AUDIT LOG
-- ============================================================

create table if not exists public.artist_staff_audit_log (
  id uuid primary key default gen_random_uuid(),

  artist_id uuid not null
    references public.record_label_artist_profiles(id) on delete cascade,

  membership_id uuid
    references public.artist_staff_memberships(id) on delete set null,

  actor_user_id uuid
    references public.user_profiles(id) on delete set null,

  action text not null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_artist_staff_audit_artist
  on public.artist_staff_audit_log(artist_id);

create index if not exists idx_artist_staff_audit_membership
  on public.artist_staff_audit_log(membership_id);

create index if not exists idx_artist_staff_audit_created
  on public.artist_staff_audit_log(created_at desc);

-- ============================================================
-- RLS
-- ============================================================

alter table public.artist_staff_memberships enable row level security;
alter table public.artist_staff_payments enable row level security;
alter table public.artist_staff_audit_log enable row level security;

-- Artist can view their own staff memberships
create policy "Artist can view own staff"
  on public.artist_staff_memberships
  for select
  using (
    exists (
      select 1 from public.record_label_artist_profiles rlap
      where rlap.id = artist_staff_memberships.artist_id
        and rlap.user_id = auth.uid()
    )
  );

-- Artist can insert staff offers for their own artist profile
create policy "Artist can create own staff offers"
  on public.artist_staff_memberships
  for insert
  with check (
    exists (
      select 1 from public.record_label_artist_profiles rlap
      where rlap.id = artist_staff_memberships.artist_id
        and rlap.user_id = auth.uid()
    )
  );

-- Artist can update their own staff memberships
create policy "Artist can update own staff"
  on public.artist_staff_memberships
  for update
  using (
    exists (
      select 1 from public.record_label_artist_profiles rlap
      where rlap.id = artist_staff_memberships.artist_id
        and rlap.user_id = auth.uid()
    )
  );

-- Employee can view their own staff memberships
create policy "Employee can view own memberships"
  on public.artist_staff_memberships
  for select
  using (employee_user_id = auth.uid());

-- Employee can update their own membership for acceptance/decline
create policy "Employee can update own membership status"
  on public.artist_staff_memberships
  for update
  using (
    employee_user_id = auth.uid()
    and status in ('pending', 'active')
    and (
      accepted_at is null
      and declined_at is null
      and terminated_at is null
    )
  );

-- Artist can view payments for their artist
create policy "Artist can view own staff payments"
  on public.artist_staff_payments
  for select
  using (
    exists (
      select 1 from public.record_label_artist_profiles rlap
      where rlap.id = artist_staff_payments.artist_id
        and rlap.user_id = auth.uid()
    )
  );

-- Employee can view their own payments
create policy "Employee can view own payments"
  on public.artist_staff_payments
  for select
  using (employee_user_id = auth.uid());

-- Artist can insert payments for their artist
create policy "Artist can create own staff payments"
  on public.artist_staff_payments
  for insert
  with check (
    exists (
      select 1 from public.record_label_artist_profiles rlap
      where rlap.id = artist_staff_payments.artist_id
        and rlap.user_id = auth.uid()
    )
  );

-- Artist can update their own staff payments
create policy "Artist can update own staff payments"
  on public.artist_staff_payments
  for update
  using (
    exists (
      select 1 from public.record_label_artist_profiles rlap
      where rlap.id = artist_staff_payments.artist_id
        and rlap.user_id = auth.uid()
    )
  );

-- Artist can view audit log for their artist
create policy "Artist can view own staff audit log"
  on public.artist_staff_audit_log
  for select
  using (
    exists (
      select 1 from public.record_label_artist_profiles rlap
      where rlap.id = artist_staff_audit_log.artist_id
        and rlap.user_id = auth.uid()
    )
  );

-- System can insert audit log
create policy "System can insert staff audit log"
  on public.artist_staff_audit_log
  for insert
  with check (true);

-- Admin can view all staff records
create policy "Admin can view all staff records"
  on public.artist_staff_memberships
  for select
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and (up.is_admin = true or up.role = 'admin' or up.role = 'superadmin')
    )
  );

create policy "Admin can view all staff payments"
  on public.artist_staff_payments
  for select
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and (up.is_admin = true or up.role = 'admin' or up.role = 'superadmin')
    )
  );

create policy "Admin can view all staff audit logs"
  on public.artist_staff_audit_log
  for select
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and (up.is_admin = true or up.role = 'admin' or up.role = 'superadmin')
    )
  );

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create or replace function public.update_artist_staff_memberships_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trigger_artist_staff_memberships_updated_at
  before update on public.artist_staff_memberships
  for each row
  execute function public.update_artist_staff_memberships_updated_at();

create or replace function public.update_artist_staff_payments_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trigger_artist_staff_payments_updated_at
  before update on public.artist_staff_payments
  for each row
  execute function public.update_artist_staff_payments_updated_at();

-- ============================================================
-- SECURE RPC FUNCTIONS
-- ============================================================

-- Search candidates
create or replace function public.search_artist_staff_candidates(
  p_artist_id uuid,
  p_search text,
  p_limit int default 20
)
  returns table (
    user_id uuid,
    username text,
    display_name text,
    avatar_url text
  )
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (
    select 1 from public.record_label_artist_profiles rlap
    where rlap.id = p_artist_id
      and rlap.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    up.id,
    up.username,
    up.display_name,
    up.avatar_url
  from public.user_profiles up
  where up.id != (
    select user_id from public.record_label_artist_profiles where id = p_artist_id
  )
  and (
    p_search = ''
    or up.username ilike '%' || p_search || '%'
    or up.display_name ilike '%' || p_search || '%'
  )
  and not exists (
    select 1 from public.artist_staff_memberships asm
    where asm.artist_id = p_artist_id
      and asm.employee_user_id = up.id
      and asm.status in ('pending', 'active', 'suspended')
  )
  limit p_limit;
end;
$$;

-- Create offer
create or replace function public.create_artist_staff_offer(
  p_artist_id uuid,
  p_employee_user_id uuid,
  p_position text,
  p_pay_type text,
  p_pay_amount bigint,
  p_pay_frequency text,
  p_permissions jsonb,
  p_start_date timestamptz default null,
  p_notes text default null
)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_membership_id uuid;
  v_artist_user_id uuid;
begin
  select user_id into v_artist_user_id
  from public.record_label_artist_profiles
  where id = p_artist_id;

  if v_artist_user_id != auth.uid() then
    raise exception 'Not authorized';
  end if;

  if p_employee_user_id = v_artist_user_id then
    raise exception 'Cannot hire yourself';
  end if;

  if exists (
    select 1 from public.artist_staff_memberships
    where artist_id = p_artist_id
      and employee_user_id = p_employee_user_id
      and status in ('pending', 'active', 'suspended')
  ) then
    raise exception 'Duplicate active/pending membership';
  end if;

  insert into public.artist_staff_memberships (
    artist_id,
    employee_user_id,
    "position",
    pay_type,
    pay_amount,
    pay_frequency,
    permissions,
    start_date,
    notes,
    created_by
  ) values (
    p_artist_id,
    p_employee_user_id,
    p_position,
    p_pay_type,
    p_pay_amount,
    p_pay_frequency,
    p_permissions,
    p_start_date,
    p_notes,
    auth.uid()
  )
  returning id into v_membership_id;

  insert into public.artist_staff_audit_log (
    artist_id,
    membership_id,
    actor_user_id,
    action,
    metadata
  ) values (
    p_artist_id,
    v_membership_id,
    auth.uid(),
    'offer_created',
    jsonb_build_object(
      'position', p_position,
      'pay_type', p_pay_type,
      'pay_amount', p_pay_amount,
      'pay_frequency', p_pay_frequency
    )
  );

  return v_membership_id;
end;
$$;

-- Respond to offer
create or replace function public.respond_to_artist_staff_offer(
  p_membership_id uuid,
  p_accept boolean
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (
    select 1 from public.artist_staff_memberships
    where id = p_membership_id
      and employee_user_id = auth.uid()
      and status = 'pending'
  ) then
    raise exception 'Not authorized or not pending';
  end if;

  if p_accept then
    update public.artist_staff_memberships
    set status = 'active',
        accepted_at = now(),
        start_date = coalesce(start_date, now())
    where id = p_membership_id;

    insert into public.artist_staff_audit_log (
      artist_id,
      membership_id,
      actor_user_id,
      action,
      metadata
    ) select
      artist_id,
      p_membership_id,
      auth.uid(),
      'offer_accepted',
      jsonb_build_object()
    from public.artist_staff_memberships
    where id = p_membership_id;
  else
    update public.artist_staff_memberships
    set status = 'declined',
        declined_at = now()
    where id = p_membership_id;

    insert into public.artist_staff_audit_log (
      artist_id,
      membership_id,
      actor_user_id,
      action,
      metadata
    ) select
      artist_id,
      p_membership_id,
      auth.uid(),
      'offer_declined',
      jsonb_build_object()
    from public.artist_staff_memberships
    where id = p_membership_id;
  end if;
end;
$$;

-- Update staff member
create or replace function public.update_artist_staff_member(
  p_membership_id uuid,
  p_position text default null,
  p_pay_type text default null,
  p_pay_amount bigint default null,
  p_pay_frequency text default null,
  p_permissions jsonb default null,
  p_notes text default null
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (
    select 1 from public.artist_staff_memberships asm
    join public.record_label_artist_profiles rlap on rlap.id = asm.artist_id
    where asm.id = p_membership_id
      and rlap.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  update public.artist_staff_memberships
  set
    "position" = coalesce(p_position, "position"),
    pay_type = coalesce(p_pay_type, pay_type),
    pay_amount = coalesce(p_pay_amount, pay_amount),
    pay_frequency = coalesce(p_pay_frequency, pay_frequency),
    permissions = coalesce(p_permissions, permissions),
    notes = coalesce(p_notes, notes)
  where id = p_membership_id;

  insert into public.artist_staff_audit_log (
    artist_id,
    membership_id,
    actor_user_id,
    action,
    metadata
  ) select
    artist_id,
    p_membership_id,
    auth.uid(),
    'member_updated',
    jsonb_build_object(
      'position', p_position,
      'pay_type', p_pay_type,
      'pay_amount', p_pay_amount,
      'pay_frequency', p_pay_frequency
    )
  from public.artist_staff_memberships
  where id = p_membership_id;
end;
$$;

-- Suspend staff member
create or replace function public.suspend_artist_staff_member(
  p_membership_id uuid,
  p_reason text default null
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (
    select 1 from public.artist_staff_memberships asm
    join public.record_label_artist_profiles rlap on rlap.id = asm.artist_id
    where asm.id = p_membership_id
      and rlap.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  update public.artist_staff_memberships
  set status = 'suspended',
      updated_at = now()
  where id = p_membership_id;

  insert into public.artist_staff_audit_log (
    artist_id,
    membership_id,
    actor_user_id,
    action,
    metadata
  ) select
    artist_id,
    p_membership_id,
    auth.uid(),
    'member_suspended',
    jsonb_build_object('reason', p_reason)
  from public.artist_staff_memberships
  where id = p_membership_id;
end;
$$;

-- Terminate staff member
create or replace function public.terminate_artist_staff_member(
  p_membership_id uuid,
  p_reason text default null
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (
    select 1 from public.artist_staff_memberships asm
    join public.record_label_artist_profiles rlap on rlap.id = asm.artist_id
    where asm.id = p_membership_id
      and rlap.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  update public.artist_staff_memberships
  set status = 'terminated',
      terminated_at = now(),
      termination_reason = p_reason,
      updated_at = now()
  where id = p_membership_id;

  insert into public.artist_staff_audit_log (
    artist_id,
    membership_id,
    actor_user_id,
    action,
    metadata
  ) select
    artist_id,
    p_membership_id,
    auth.uid(),
    'member_terminated',
    jsonb_build_object('reason', p_reason)
  from public.artist_staff_memberships
  where id = p_membership_id;
end;
$$;

-- Reactivate staff member
create or replace function public.reactivate_artist_staff_member(
  p_membership_id uuid
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (
    select 1 from public.artist_staff_memberships asm
    join public.record_label_artist_profiles rlap on rlap.id = asm.artist_id
    where asm.id = p_membership_id
      and rlap.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  update public.artist_staff_memberships
  set status = 'active',
      start_date = coalesce(start_date, now()),
      updated_at = now()
  where id = p_membership_id;

  insert into public.artist_staff_audit_log (
    artist_id,
    membership_id,
    actor_user_id,
    action,
    metadata
  ) select
    artist_id,
    p_membership_id,
    auth.uid(),
    'member_reactivated',
    jsonb_build_object()
  from public.artist_staff_memberships
  where id = p_membership_id;
end;
$$;

-- Get artist staff
create or replace function public.get_artist_staff(
  p_artist_id uuid
)
  returns table (
    id uuid,
    artist_id uuid,
    employee_user_id uuid,
    "position" text,
    status text,
    pay_type text,
    pay_amount bigint,
    pay_currency text,
    pay_frequency text,
    permissions jsonb,
    start_date timestamptz,
    end_date timestamptz,
    offered_at timestamptz,
    accepted_at timestamptz,
    declined_at timestamptz,
    terminated_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    created_by uuid,
    termination_reason text,
    notes text,
    employee_username text,
    employee_display_name text,
    employee_avatar_url text
  )
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (
    select 1 from public.record_label_artist_profiles rlap
    where rlap.id = p_artist_id
      and rlap.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

   return query
   select
     asm.id,
     asm.artist_id,
     asm.employee_user_id,
     asm."position",
     asm.status,
    asm.pay_type,
    asm.pay_amount,
    asm.pay_currency,
    asm.pay_frequency,
    asm.permissions,
    asm.start_date,
    asm.end_date,
    asm.offered_at,
    asm.accepted_at,
    asm.declined_at,
    asm.terminated_at,
    asm.created_at,
    asm.updated_at,
    asm.created_by,
    asm.termination_reason,
    asm.notes,
    up.username,
    up.display_name,
    up.avatar_url
  from public.artist_staff_memberships asm
  join public.user_profiles up on up.id = asm.employee_user_id
  where asm.artist_id = p_artist_id
  order by
    case asm.status
      when 'active' then 1
      when 'pending' then 2
      when 'suspended' then 3
      when 'terminated' then 4
      when 'declined' then 5
      when 'expired' then 6
      else 7
    end,
    asm.offered_at desc;
end;
$$;

-- Get my artist staff jobs
create or replace function public.get_my_artist_staff_jobs()
  returns table (
    id uuid,
    artist_id uuid,
    "position" text,
    status text,
    pay_type text,
    pay_amount bigint,
    pay_currency text,
    pay_frequency text,
    permissions jsonb,
    start_date timestamptz,
    end_date timestamptz,
    offered_at timestamptz,
    accepted_at timestamptz,
    created_at timestamptz,
    artist_stage_name text,
    artist_user_id uuid
  )
  language plpgsql
  security definer
  set search_path = public
as $$
begin
   return query
   select
     asm.id,
     asm.artist_id,
     asm."position",
     asm.status,
     asm.pay_type,
     asm.pay_amount,
     asm.pay_currency,
     asm.pay_frequency,
     asm.permissions,
     asm.start_date,
     asm.end_date,
     asm.offered_at,
     asm.accepted_at,
     asm.created_at,
     rlap.stage_name,
     rlap.user_id
   from public.artist_staff_memberships asm
   join public.record_label_artist_profiles rlap on rlap.id = asm.artist_id
   where asm.employee_user_id = auth.uid()
     and asm.status in ('pending', 'active', 'suspended')
   order by
     case asm.status
       when 'active' then 1
       when 'pending' then 2
       when 'suspended' then 3
       else 4
     end,
     asm.offered_at desc;
end;
$$;

-- Get artist staff dashboard
create or replace function public.get_artist_staff_dashboard(
  p_artist_id uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_artist_user_id uuid;
  v_is_staff boolean;
  v_result jsonb;
begin
  select user_id into v_artist_user_id
  from public.record_label_artist_profiles
  where id = p_artist_id;

  if v_artist_user_id = auth.uid() then
    v_is_staff := true;
  elsif exists (
    select 1 from public.artist_staff_memberships
    where artist_id = p_artist_id
      and employee_user_id = auth.uid()
      and status = 'active'
      and permissions ? 'view_artist_analytics'
  ) then
    v_is_staff := true;
  else
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'active_count', (
      select count(*) from public.artist_staff_memberships
      where artist_id = p_artist_id and status = 'active'
    ),
    'pending_count', (
      select count(*) from public.artist_staff_memberships
      where artist_id = p_artist_id and status = 'pending'
    ),
    'suspended_count', (
      select count(*) from public.artist_staff_memberships
      where artist_id = p_artist_id and status = 'suspended'
    ),
    'monthly_cost', (
      select coalesce(sum(pay_amount), 0)
      from public.artist_staff_memberships
      where artist_id = p_artist_id
        and status in ('active', 'pending')
        and pay_frequency = 'monthly'
    ),
    'active_positions', (
      select coalesce(jsonb_agg(distinct "position"), '[]'::jsonb)
      from public.artist_staff_memberships
      where artist_id = p_artist_id and status = 'active'
    )
  ) into v_result;

  return v_result;
end;
$$;

-- Get staff payments
create or replace function public.get_artist_staff_payments(
  p_artist_id uuid
)
  returns table (
    id uuid,
    membership_id uuid,
    employee_user_id uuid,
    amount bigint,
    currency text,
    status text,
    payment_type text,
    period_start timestamptz,
    period_end timestamptz,
    paid_at timestamptz,
    created_at timestamptz,
    notes text,
    employee_username text,
    employee_display_name text,
    "position" text
  )
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (
    select 1 from public.record_label_artist_profiles rlap
    where rlap.id = p_artist_id
      and rlap.user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    asp.id,
    asp.membership_id,
    asp.employee_user_id,
    asp.amount,
    asp.currency,
    asp.status,
    asp.payment_type,
    asp.period_start,
    asp.period_end,
    asp.paid_at,
    asp.created_at,
    asp.notes,
    up.username,
    up.display_name,
    asm."position"
  from public.artist_staff_payments asp
  join public.artist_staff_memberships asm on asm.id = asp.membership_id
  join public.user_profiles up on up.id = asp.employee_user_id
  where asp.artist_id = p_artist_id
  order by asp.created_at desc;
end;
$$;
