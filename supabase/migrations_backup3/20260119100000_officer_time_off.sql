
create table if not exists officer_time_off_requests (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null references user_profiles(id) on delete cascade,
  date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references user_profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS
alter table officer_time_off_requests enable row level security;

-- Officers can view their own requests
create policy "Officers can view their own time off requests"
  on officer_time_off_requests for select
  using (auth.uid() = officer_id);

-- Officers can create their own requests
create policy "Officers can create time off requests"
  on officer_time_off_requests for insert
  with check (auth.uid() = officer_id);

-- Admins and Lead Officers can view all requests
create policy "Admins and Lead Officers can view all time off requests"
  on officer_time_off_requests for select
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid()
      and (role = 'admin' or is_lead_officer = true or is_admin = true)
    )
  );

-- Admins and Lead Officers can update requests
create policy "Admins and Lead Officers can update time off requests"
  on officer_time_off_requests for update
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid()
      and (role = 'admin' or is_lead_officer = true or is_admin = true)
    )
  );

-- Function to check if a user is allowed to approve requests (for UI convenience, logic in RLS)
