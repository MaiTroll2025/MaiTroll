-- ============================================================================
-- Employees Office — unified non-admin employee workspace
-- New tables only (no existing tables modified). RLS enforced server-side.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Audit log (immutable, append-only). Written only via log_employee_audit().
-- ---------------------------------------------------------------------------
create table if not exists public.employee_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_id uuid references auth.users(id) on delete set null,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  department text,
  related_record text,
  created_at timestamptz not null default now()
);
create index if not exists idx_employee_audit_actor on public.employee_audit_log(actor_id);
create index if not exists idx_employee_audit_target on public.employee_audit_log(target_id);
create index if not exists idx_employee_audit_created on public.employee_audit_log(created_at desc);

-- ---------------------------------------------------------------------------
-- Employee records (employment status, supervisor, location for tax)
-- ---------------------------------------------------------------------------
create table if not exists public.employee_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  employment_status text not null default 'active'
    check (employment_status in ('active','inactive','suspended','terminated')),
  department text,
  job_title text,
  supervisor_id uuid references auth.users(id) on delete set null,
  hire_date timestamptz,
  location_city text,
  location_state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_employee_records_status on public.employee_records(employment_status);

-- Supervisor assignment (reporting chain). Falls back to role defaults in app.
create table if not exists public.employee_supervisors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  supervisor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create table if not exists public.employee_announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text not null,
  level text not null default 'normal' check (level in ('normal','important','urgent')),
  department text,
  created_at timestamptz not null default now()
);
create index if not exists idx_employee_announcements_created on public.employee_announcements(created_at desc);

create table if not exists public.employee_announcement_acks (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.employee_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acked_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table if not exists public.employee_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_date timestamptz,
  status text not null default 'assigned'
    check (status in ('assigned','in_progress','blocked','awaiting_review','completed','cancelled')),
  department text,
  comments jsonb default '[]'::jsonb,
  attachments jsonb default '[]'::jsonb,
  completion_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_employee_tasks_assignee on public.employee_tasks(assigned_to);
create index if not exists idx_employee_tasks_assigner on public.employee_tasks(assigned_by);

-- ---------------------------------------------------------------------------
-- Reports (role-based, routed to supervisor)
-- ---------------------------------------------------------------------------
create table if not exists public.employee_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text,
  subject text not null,
  description text,
  submitted_by uuid references auth.users(id) on delete set null,
  related_user uuid references auth.users(id) on delete set null,
  related_employee uuid references auth.users(id) on delete set null,
  related_broadcast uuid,
  related_incident uuid,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  confidential boolean not null default false,
  status text not null default 'submitted'
    check (status in ('submitted','received','under_review','more_info_needed','action_taken','closed','escalated')),
  supervisor_id uuid references auth.users(id) on delete set null,
  responses jsonb default '[]'::jsonb,
  evidence jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_employee_reports_submitter on public.employee_reports(submitted_by);
create index if not exists idx_employee_reports_supervisor on public.employee_reports(supervisor_id);

-- ---------------------------------------------------------------------------
-- Change requests (vote / comment / attach; no auto-approve)
-- ---------------------------------------------------------------------------
create table if not exists public.employee_change_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null default 'platform_change' check (type in ('platform_change','workflow','employee_tool')),
  author_id uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open','under_review','approved','rejected','implemented')),
  votes integer not null default 0,
  comments jsonb default '[]'::jsonb,
  attachments jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.employee_change_request_votes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.employee_change_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (request_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Chat (channels + messages). Visibility enforced by role_scope.
-- ---------------------------------------------------------------------------
create table if not exists public.employee_chat_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'general' check (kind in ('general','department','role','direct')),
  role_scope text[] not null default '{}', -- empty = all employees
  created_at timestamptz not null default now()
);
create table if not exists public.employee_chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.employee_chat_channels(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  body text not null,
  parent_id uuid references public.employee_chat_messages(id) on delete cascade,
  reactions jsonb default '{}'::jsonb,
  attachments jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_employee_chat_channel on public.employee_chat_messages(channel_id, created_at desc);

-- Seed default channels
insert into public.employee_chat_channels (name, kind, role_scope) values
  ('All Employees', 'general', '{}'),
  ('Troll Officers', 'role', ARRAY['troll_officer','lead_troll_officer']),
  ('Lead Troll Officers', 'role', ARRAY['lead_troll_officer']),
  ('Assistants', 'role', ARRAY['ceo_assistant','noah_assistant','secretary']),
  ('Secretary Office', 'role', ARRAY['secretary','ceo','ceo_assistant','noah_assistant']),
  ('Management', 'role', ARRAY['lead_troll_officer','secretary','ceo','ceo_assistant','noah_assistant','admin','superadmin']),
  ('Safety', 'general', '{}'),
  ('Announcements', 'general', '{}'),
  ('Platform Changes', 'general', '{}'),
  ('Scheduling', 'general', '{}')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Frontend Studio (config-only drafts; no source/SQL/terminal access)
-- ---------------------------------------------------------------------------
create table if not exists public.frontend_studio_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','published','rolled_back')),
  author_id uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Payroll (MAI CORP / Mai Mai Troll). Real location/state for tax.
-- ---------------------------------------------------------------------------
create table if not exists public.employee_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft','approved','paid')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.employee_paystubs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.employee_payroll_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pay_period_start date not null,
  pay_period_end date not null,
  pay_date date not null,
  hours numeric not null default 0,
  rate numeric not null default 0,
  gross_pay numeric not null default 0,
  federal_tax numeric not null default 0,
  state_tax numeric not null default 0,
  fica numeric not null default 0,
  medicare numeric not null default 0,
  net_pay numeric not null default 0,
  location_city text,
  location_state text,
  created_at timestamptz not null default now()
);
create index if not exists idx_employee_paystubs_user on public.employee_paystubs(user_id, pay_period_end desc);

-- Perk pay (rate per employee role). Edited by Secretary/CEO/Admin only.
create table if not exists public.employee_perk_pay (
  id uuid primary key default gen_random_uuid(),
  role text not null unique,
  amount numeric not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Disciplinary actions
-- ---------------------------------------------------------------------------
create table if not exists public.employee_disciplinary_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  reason text not null,
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_employee_discipline_user on public.employee_disciplinary_actions(user_id);

-- ===========================================================================
-- RPC: server-side permission check
-- ===========================================================================
create or replace function public.employee_can(p_user uuid, p_action text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_is_lead boolean;
  v_is_troll boolean;
  v_is_admin boolean;
begin
  if p_user is null then return false; end if;
  select role, coalesce(is_lead_officer,false), coalesce(is_troll_officer,false),
         (coalesce(is_admin,false) or role in ('admin','superadmin'))
    into v_role, v_is_lead, v_is_troll, v_is_admin
  from user_profiles where id = p_user;

  if v_role is null then return false; end if;
  if v_is_admin then return true; end if;

  case p_action
    when 'edit_payroll' then
      return v_role in ('secretary','ceo','ceo_assistant','noah_assistant');
    when 'publish_frontend' then
      return v_role in ('admin','ceo','superadmin','secretary')
             or v_role like '%dev%' or v_role like '%design%' or v_role like '%developer%';
    when 'hire' then
      return v_is_lead;
    when 'fire' then
      return v_is_lead;
    when 'manage_reports' then
      return v_is_lead or v_role in ('secretary','ceo_assistant','noah_assistant');
    when 'manage_announcements' then
      return v_is_lead or v_role in ('secretary','ceo','admin','superadmin');
    when 'correct_attendance' then
      return v_is_lead;
    when 'view_management' then
      return v_is_lead or v_role in ('secretary','ceo_assistant','noah_assistant','ceo','admin','superadmin');
    when 'admin_preview' then
      return v_is_admin;
    when 'view_records' then
      return v_is_lead or v_role in ('secretary','ceo','admin','superadmin');
    when 'assign_tasks' then
      return v_is_lead or v_role in ('secretary','ceo_assistant','noah_assistant','ceo','admin','superadmin');
    else return false;
  end case;
end;
$$;

-- ===========================================================================
-- RPC: immutable audit log (server-side enforced)
-- ===========================================================================
create or replace function public.log_employee_audit(
  p_actor uuid,
  p_action text,
  p_target uuid default null,
  p_previous jsonb default null,
  p_new jsonb default null,
  p_reason text default null,
  p_department text default null,
  p_related text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_actor_role text;
begin
  if p_actor is null or auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  -- Actor must be the caller, or an admin acting on someone's behalf.
  select role into v_actor_role from user_profiles where id = p_actor;
  if p_actor <> auth.uid() and coalesce((select is_admin from user_profiles where id = auth.uid()), false) = false
     and (select role from user_profiles where id = auth.uid()) not in ('admin','superadmin','ceo') then
    raise exception 'unauthorized';
  end if;

  insert into public.employee_audit_log
    (actor_id, target_id, action, previous_value, new_value, reason, department, related_record)
  values (p_actor, p_target, p_action, p_previous, p_new, p_reason, p_department, p_related)
  returning id into v_id;
  return v_id;
end;
$$;

-- ===========================================================================
-- RPC: run payroll for a period (SECURITY DEFINER, authorized only)
-- ===========================================================================
create or replace function public.run_employee_payroll(
  p_period_start date,
  p_period_end date,
  p_actor uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_run uuid;
  v_rec record;
  v_perk numeric;
  v_hours numeric;
  v_rate numeric;
  v_gross numeric;
  v_fed numeric;
  v_state numeric;
  v_fica numeric;
  v_medicare numeric;
  v_net numeric;
begin
  if not public.employee_can(p_actor, 'edit_payroll') then
    raise exception 'unauthorized';
  end if;

  insert into public.employee_payroll_runs (period_start, period_end, status, created_by)
  values (p_period_start, p_period_end, 'approved', p_actor)
  returning id into v_run;

  for v_rec in
    select up.id as user_id, up.role, er.location_city, er.location_state
    from user_profiles up
    left join employee_records er on er.user_id = up.id
    where coalesce((select employment_status from employee_records where user_id = up.id), 'active') = 'active'
      and up.role in (
        'troll_officer','lead_troll_officer','secretary','ceo_assistant','noah_assistant',
        'ceo','ceo','pastor','attorney','prosecutor','journalist','auctioneer','troller',
        'agency_hr_manager','agency_leader','agency_hr','hr_admin','hr_manager','president',
        'vice_president','troll_city_secretary','troll_city_treasurer','executive_secretary',
        'academy_teacher','admissions_officer'
      )
  loop
    select coalesce(amount,0) into v_perk from employee_perk_pay where role = v_rec.role;
    v_rate := v_perk;

    select coalesce(sum(
      extract(epoch from (coalesce(clock_out, now()) - clock_in)) / 3600.0), 0)
      into v_hours
    from officer_work_sessions
    where officer_id = v_rec.user_id
      and clock_in::date between p_period_start and p_period_end;

    v_gross := round((v_hours * v_rate)::numeric, 2);
    v_fed := round((v_gross * 0.12)::numeric, 2);
    v_state := round((v_gross * 0.05)::numeric, 2);
    v_fica := round((v_gross * 0.062)::numeric, 2);
    v_medicare := round((v_gross * 0.0145)::numeric, 2);
    v_net := round((v_gross - v_fed - v_state - v_fica - v_medicare)::numeric, 2);

    insert into public.employee_paystubs
      (run_id, user_id, pay_period_start, pay_period_end, pay_date, hours, rate,
       gross_pay, federal_tax, state_tax, fica, medicare, net_pay, location_city, location_state)
    values (v_run, v_rec.user_id, p_period_start, p_period_end, p_period_end + interval '3 days',
       v_hours, v_rate, v_gross, v_fed, v_state, v_fica, v_medicare, v_net,
       v_rec.location_city, v_rec.location_state);
  end loop;

  return v_run;
end;
$$;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.employee_audit_log enable row level security;
alter table public.employee_records enable row level security;
alter table public.employee_supervisors enable row level security;
alter table public.employee_announcements enable row level security;
alter table public.employee_announcement_acks enable row level security;
alter table public.employee_tasks enable row level security;
alter table public.employee_reports enable row level security;
alter table public.employee_change_requests enable row level security;
alter table public.employee_change_request_votes enable row level security;
alter table public.employee_chat_channels enable row level security;
alter table public.employee_chat_messages enable row level security;
alter table public.frontend_studio_drafts enable row level security;
alter table public.employee_payroll_runs enable row level security;
alter table public.employee_paystubs enable row level security;
alter table public.employee_perk_pay enable row level security;
alter table public.employee_disciplinary_actions enable row level security;

-- Audit log: readable by all authed employees; only the SECURITY DEFINER RPC inserts.
create policy "employee_audit_select" on public.employee_audit_log
  for select using (auth.uid() is not null);
create policy "employee_audit_no_direct_insert" on public.employee_audit_log
  for insert with check (false);
create policy "employee_audit_no_update" on public.employee_audit_log
  for update using (false);
create policy "employee_audit_no_delete" on public.employee_audit_log
  for delete using (false);

-- Records: employees see their own; management sees all.
create policy "employee_records_select" on public.employee_records
  for select using (
    auth.uid() = user_id
    or public.employee_can(auth.uid(), 'view_records')
  );
create policy "employee_records_write" on public.employee_records
  for all using (public.employee_can(auth.uid(), 'view_records'))
  with check (public.employee_can(auth.uid(), 'view_records'));

create policy "employee_supervisors_select" on public.employee_supervisors
  for select using (auth.uid() = user_id or public.employee_can(auth.uid(),'view_records'));
create policy "employee_supervisors_write" on public.employee_supervisors
  for all using (public.employee_can(auth.uid(),'view_records'))
  with check (public.employee_can(auth.uid(),'view_records'));

-- Announcements: all authed employees read; management/secretary/ceo create.
create policy "employee_announcements_select" on public.employee_announcements
  for select using (auth.uid() is not null);
create policy "employee_announcements_insert" on public.employee_announcements
  for insert with check (public.employee_can(auth.uid(),'manage_announcements'));
create policy "employee_announcements_update" on public.employee_announcements
  for update using (public.employee_can(auth.uid(),'manage_announcements'));
create policy "employee_announcements_delete" on public.employee_announcements
  for delete using (public.employee_can(auth.uid(),'manage_announcements'));

create policy "employee_acks_select" on public.employee_announcement_acks
  for select using (auth.uid() = user_id or public.employee_can(auth.uid(),'manage_announcements'));
create policy "employee_acks_upsert" on public.employee_announcement_acks
  for insert with check (auth.uid() = user_id);
create policy "employee_acks_delete" on public.employee_announcement_acks
  for delete using (auth.uid() = user_id);

-- Tasks
create policy "employee_tasks_select" on public.employee_tasks
  for select using (auth.uid() = assigned_to or auth.uid() = assigned_by or public.employee_can(auth.uid(),'assign_tasks'));
create policy "employee_tasks_insert" on public.employee_tasks
  for insert with check (auth.uid() = assigned_by or public.employee_can(auth.uid(),'assign_tasks'));
create policy "employee_tasks_update" on public.employee_tasks
  for update using (auth.uid() = assigned_to or auth.uid() = assigned_by or public.employee_can(auth.uid(),'assign_tasks'));
create policy "employee_tasks_delete" on public.employee_tasks
  for delete using (public.employee_can(auth.uid(),'assign_tasks'));

-- Reports
create policy "employee_reports_select" on public.employee_reports
  for select using (
    auth.uid() = submitted_by
    or auth.uid() = supervisor_id
    or public.employee_can(auth.uid(),'manage_reports')
    or (confidential = false and public.employee_can(auth.uid(),'manage_reports'))
  );
create policy "employee_reports_insert" on public.employee_reports
  for insert with check (auth.uid() = submitted_by);
create policy "employee_reports_update" on public.employee_reports
  for update using (auth.uid() = submitted_by or auth.uid() = supervisor_id or public.employee_can(auth.uid(),'manage_reports'));
create policy "employee_reports_delete" on public.employee_reports
  for delete using (public.employee_can(auth.uid(),'manage_reports'));

-- Change requests
create policy "employee_change_select" on public.employee_change_requests
  for select using (auth.uid() is not null);
create policy "employee_change_insert" on public.employee_change_requests
  for insert with check (auth.uid() = author_id);
create policy "employee_change_update" on public.employee_change_requests
  for update using (auth.uid() = author_id or public.employee_can(auth.uid(),'manage_announcements'));
create policy "employee_change_delete" on public.employee_change_requests
  for delete using (auth.uid() = author_id or public.employee_can(auth.uid(),'manage_announcements'));

create policy "employee_change_votes_select" on public.employee_change_request_votes
  for select using (auth.uid() = user_id);
create policy "employee_change_votes_upsert" on public.employee_change_request_votes
  for insert with check (auth.uid() = user_id);
create policy "employee_change_votes_delete" on public.employee_change_request_votes
  for delete using (auth.uid() = user_id);

-- Chat channels: visible if scope empty or matches caller role (or admin)
create policy "employee_channels_select" on public.employee_chat_channels
  for select using (
    auth.uid() is not null and (
      cardinality(role_scope) = 0
      or exists (
        select 1 from user_profiles up
        where up.id = auth.uid()
          and (role_scope @> array[up.role] or up.is_admin or up.role in ('admin','superadmin'))
      )
    )
  );

-- Chat messages: readable if member of channel; sender only inserts.
create policy "employee_messages_select" on public.employee_chat_messages
  for select using (
    exists (
      select 1 from employee_chat_channels c
      where c.id = channel_id and (
        cardinality(c.role_scope) = 0
        or exists (
          select 1 from user_profiles up where up.id = auth.uid()
            and (c.role_scope @> array[up.role] or up.is_admin or up.role in ('admin','superadmin'))
        )
      )
    )
  );
create policy "employee_messages_insert" on public.employee_chat_messages
  for insert with check (auth.uid() = sender_id);
create policy "employee_messages_delete" on public.employee_chat_messages
  for delete using (auth.uid() = sender_id or public.employee_can(auth.uid(),'manage_announcements'));

-- Frontend studio: all authed read; only authorized publish.
create policy "frontend_studio_select" on public.frontend_studio_drafts
  for select using (auth.uid() is not null);
create policy "frontend_studio_insert" on public.frontend_studio_drafts
  for insert with check (auth.uid() = author_id);
create policy "frontend_studio_update" on public.frontend_studio_drafts
  for update using (auth.uid() = author_id or public.employee_can(auth.uid(),'publish_frontend'));
create policy "frontend_studio_delete" on public.frontend_studio_drafts
  for delete using (auth.uid() = author_id or public.employee_can(auth.uid(),'publish_frontend'));

-- Payroll runs: management/secretary/ceo/admin read + create.
create policy "payroll_runs_select" on public.employee_payroll_runs
  for select using (public.employee_can(auth.uid(),'edit_payroll'));
create policy "payroll_runs_insert" on public.employee_payroll_runs
  for insert with check (public.employee_can(auth.uid(),'edit_payroll'));

-- Paystubs: employees see their own; management sees all.
create policy "paystubs_select" on public.employee_paystubs
  for select using (auth.uid() = user_id or public.employee_can(auth.uid(),'edit_payroll'));

-- Perk pay: all read; only secretary/ceo/admin edit.
create policy "perk_pay_select" on public.employee_perk_pay
  for select using (auth.uid() is not null);
create policy "perk_pay_write" on public.employee_perk_pay
  for all using (public.employee_can(auth.uid(),'edit_payroll'))
  with check (public.employee_can(auth.uid(),'edit_payroll'));

-- Disciplinary: management reads; management writes.
create policy "disciplinary_select" on public.employee_disciplinary_actions
  for select using (public.employee_can(auth.uid(),'view_records'));
create policy "disciplinary_write" on public.employee_disciplinary_actions
  for all using (public.employee_can(auth.uid(),'view_records'))
  with check (public.employee_can(auth.uid(),'view_records'));

-- Realtime
alter publication supabase_realtime add table public.employee_announcements;
alter publication supabase_realtime add table public.employee_tasks;
alter publication supabase_realtime add table public.employee_reports;
alter publication supabase_realtime add table public.employee_chat_messages;
alter publication supabase_realtime add table public.employee_change_requests;
alter publication supabase_realtime add table public.employee_paystubs;
