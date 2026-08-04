-- ============================================================================
-- Employment Verification
-- Extends the existing employee_records table with a verifiable employment
-- record (legal name, employee number, classification, pay, manager) and adds
-- generated employment_verifications + a secured generation RPC.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend employee_records (preserve existing columns/rows used by RecordsTab)
-- ---------------------------------------------------------------------------
alter table public.employee_records
  add column if not exists id uuid,
  add column if not exists employee_number text,
  add column if not exists legal_name text,
  add column if not exists preferred_name text,
  add column if not exists employment_classification text,
  add column if not exists employment_type text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists pay_type text,
  add column if not exists hourly_rate numeric(12,2),
  add column if not exists annual_salary numeric(12,2),
  add column if not exists manager_user_id uuid,
  add column if not exists verification_enabled boolean;

-- Backfill existing records so the NOT NULL columns are satisfiable.
update public.employee_records er
set
  id = gen_random_uuid(),
  employee_number = 'EMP-' || upper(replace(er.user_id::text, '-', '')),
  legal_name = coalesce(
    (select up.full_name from public.user_profiles up where up.id = er.user_id),
    (select up.username from public.user_profiles up where up.id = er.user_id),
    er.user_id::text
  ),
  employment_classification = 'employee',
  start_date = coalesce(er.hire_date::date, current_date),
  verification_enabled = true,
  manager_user_id = er.supervisor_id
where er.id is null
   or er.employee_number is null
   or er.legal_name is null
   or er.employment_classification is null
   or er.start_date is null
   or er.verification_enabled is null;

-- Enforce constraints now that backfill is complete.
alter table public.employee_records
  alter column id set not null,
  alter column employee_number set not null,
  alter column legal_name set not null,
  alter column employment_classification set not null,
  alter column start_date set not null,
  alter column verification_enabled set not null,
  alter column verification_enabled set default true;

alter table public.employee_records
  add constraint employee_records_id_key unique (id);

alter table public.employee_records
  add constraint employee_records_employee_number_key unique (employee_number);

-- Expand the status enum to include 'leave' (matches verification spec).
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.employee_records'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%employment_status%';

  if v_conname is not null then
    execute format('alter table public.employee_records drop constraint %I', v_conname);
  end if;
end $$;

alter table public.employee_records
  add constraint employee_records_employment_status_check
  check (employment_status in ('active', 'leave', 'suspended', 'terminated', 'inactive'));

alter table public.employee_records
  add constraint employee_records_classification_check
  check (
    employment_classification in (
      'employee',
      'independent_contractor',
      'volunteer',
      'pro_bono',
      'intern'
    )
  );

alter table public.employee_records
  add constraint employee_records_employment_type_check
  check (
    employment_type is null
    or employment_type in (
      'full_time', 'part_time', 'temporary', 'seasonal', 'on_call', 'unpaid'
    )
  );

alter table public.employee_records
  add constraint employee_records_pay_type_check
  check (
    pay_type is null
    or pay_type in ('hourly', 'salary', 'stipend', 'commission', 'unpaid')
  );

alter table public.employee_records
  add constraint employee_records_manager_fkey
  foreign key (manager_user_id)
  references auth.users(id)
  on delete set null;

create index if not exists employee_records_manager_idx
  on public.employee_records(manager_user_id);

-- ---------------------------------------------------------------------------
-- 2. Generated verification records
-- ---------------------------------------------------------------------------
create table if not exists public.employment_verifications (
  id uuid primary key default gen_random_uuid(),

  employee_record_id uuid not null
    references public.employee_records(id)
    on delete cascade,

  employee_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  generated_by uuid not null
    references auth.users(id)
    on delete restrict,

  verification_code text not null unique,

  verification_purpose text,
  recipient_name text,
  include_compensation boolean not null default false,
  include_average_hours boolean not null default false,

  snapshot jsonb not null,

  status text not null default 'valid'
    check (status in ('valid', 'revoked', 'expired')),

  expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id)
);

create index if not exists employment_verifications_employee_idx
  on public.employment_verifications(employee_user_id);

create index if not exists employment_verifications_code_idx
  on public.employment_verifications(verification_code);

-- ---------------------------------------------------------------------------
-- 3. RLS: verifications readable by the subject / generator / HR;
--    inserts only via the SECURITY DEFINER RPC (direct DML blocked).
-- ---------------------------------------------------------------------------
alter table public.employment_verifications enable row level security;

create policy "employment_verifications_select" on public.employment_verifications
  for select using (
    auth.uid() = employee_user_id
    or auth.uid() = generated_by
    or public.employee_can(auth.uid(), 'view_records')
  );

create policy "employment_verifications_no_direct_insert" on public.employment_verifications
  for insert with check (false);

create policy "employment_verifications_no_update" on public.employment_verifications
  for update using (false);

create policy "employment_verifications_no_delete" on public.employment_verifications
  for delete using (false);

-- ---------------------------------------------------------------------------
-- 4. Secure generation RPC
-- ---------------------------------------------------------------------------
create or replace function public.generate_employment_verification(
  p_employee_user_id uuid default null,
  p_purpose text default null,
  p_recipient_name text default null,
  p_include_compensation boolean default false,
  p_include_average_hours boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid := auth.uid();
  v_target_user_id uuid;
  v_requester_role text;
  v_employee public.employee_records%rowtype;
  v_verification_id uuid;
  v_verification_code text;
  v_average_hours numeric := 0;
  v_snapshot jsonb;
begin
  if v_requester_id is null then
    raise exception 'Authentication required';
  end if;

  v_target_user_id := coalesce(p_employee_user_id, v_requester_id);

  select role
  into v_requester_role
  from public.user_profiles
  where id = v_requester_id;

  if v_target_user_id <> v_requester_id
     and coalesce(v_requester_role, '') not in (
       'admin',
       'owner',
       'ceo',
       'agency_hr'
     )
  then
    raise exception 'You are not authorized to generate this verification';
  end if;

  select *
  into v_employee
  from public.employee_records
  where user_id = v_target_user_id
    and verification_enabled = true;

  if not found then
    raise exception 'No eligible employment record was found';
  end if;

  if v_employee.employment_status = 'terminated' then
    raise exception 'Current employment verification cannot be generated for a terminated record';
  end if;

  /*
   * Only the employee or authorized HR/admin can request compensation.
   */
  if p_include_compensation
     and v_target_user_id <> v_requester_id
     and coalesce(v_requester_role, '') not in (
       'admin',
       'owner',
       'ceo',
       'agency_hr'
     )
  then
    raise exception 'You are not authorized to include compensation';
  end if;

  if p_include_average_hours then
    select coalesce(
      round(
        avg(
          extract(
            epoch from (
              coalesce(clock_out, now()) - clock_in
            )
          ) / 3600
        ),
        2
      ),
      0
    )
    into v_average_hours
    from public.officer_work_sessions
    where officer_id = v_target_user_id
      and clock_in >= now() - interval '90 days'
      and clock_out is not null;
  end if;

  v_verification_code :=
    upper(
      substr(encode(gen_random_bytes(8), 'hex'), 1, 4)
      || '-' ||
      substr(encode(gen_random_bytes(8), 'hex'), 1, 4)
      || '-' ||
      substr(encode(gen_random_bytes(8), 'hex'), 1, 4)
    );

  v_snapshot := jsonb_build_object(
    'employee_number', v_employee.employee_number,
    'legal_name', v_employee.legal_name,
    'preferred_name', v_employee.preferred_name,
    'job_title', v_employee.job_title,
    'department', v_employee.department,
    'employment_classification', v_employee.employment_classification,
    'employment_status', v_employee.employment_status,
    'employment_type', v_employee.employment_type,
    'start_date', v_employee.start_date,
    'end_date', v_employee.end_date,
    'pay_type',
      case
        when p_include_compensation then v_employee.pay_type
        else null
      end,
    'hourly_rate',
      case
        when p_include_compensation then v_employee.hourly_rate
        else null
      end,
    'annual_salary',
      case
        when p_include_compensation then v_employee.annual_salary
        else null
      end,
    'average_hours',
      case
        when p_include_average_hours then v_average_hours
        else null
      end,
    'generated_at', now()
  );

  insert into public.employment_verifications (
    employee_record_id,
    employee_user_id,
    generated_by,
    verification_code,
    verification_purpose,
    recipient_name,
    include_compensation,
    include_average_hours,
    snapshot,
    expires_at
  )
  values (
    v_employee.id,
    v_employee.user_id,
    v_requester_id,
    v_verification_code,
    nullif(trim(p_purpose), ''),
    nullif(trim(p_recipient_name), ''),
    p_include_compensation,
    p_include_average_hours,
    v_snapshot,
    now() + interval '90 days'
  )
  returning id into v_verification_id;

  return jsonb_build_object(
    'success', true,
    'verification_id', v_verification_id,
    'verification_code', v_verification_code,
    'expires_at', now() + interval '90 days',
    'snapshot', v_snapshot
  );
end;
$$;

revoke all on function public.generate_employment_verification(
  uuid, text, text, boolean, boolean
) from public;

grant execute on function public.generate_employment_verification(
  uuid, text, text, boolean, boolean
) to authenticated;
