create extension if not exists pgcrypto;

create table if not exists public.admin_supabase_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_key text not null,
  billing_period_start date,
  billing_period_end date,
  captured_at timestamptz not null default now(),
  metrics jsonb not null default '{}'::jsonb,
  estimated_monthly_cost numeric(12,2) not null default 0,
  confidence text not null default 'medium',
  source text not null default 'estimated',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_supabase_metric_snapshots enable row level security;

create index if not exists idx_admin_supabase_metric_snapshots_project_key
  on public.admin_supabase_metric_snapshots (project_key);

create index if not exists idx_admin_supabase_metric_snapshots_captured_at
  on public.admin_supabase_metric_snapshots (captured_at desc);

create or replace function public.set_admin_supabase_metric_snapshots_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_admin_supabase_metric_snapshots_updated_at on public.admin_supabase_metric_snapshots;
create trigger trg_admin_supabase_metric_snapshots_updated_at
before update on public.admin_supabase_metric_snapshots
for each row execute function public.set_admin_supabase_metric_snapshots_updated_at();

create or replace function public.prune_admin_supabase_metric_snapshots()
returns void as $$
begin
  delete from public.admin_supabase_metric_snapshots
  where captured_at < now() - interval '180 days';
end;
$$ language plpgsql;

create policy if not exists "service_role_select_admin_supabase_metric_snapshots"
  on public.admin_supabase_metric_snapshots
  for select to service_role using (true);

create policy if not exists "service_role_insert_admin_supabase_metric_snapshots"
  on public.admin_supabase_metric_snapshots
  for insert to service_role with check (true);

create policy if not exists "service_role_update_admin_supabase_metric_snapshots"
  on public.admin_supabase_metric_snapshots
  for update to service_role using (true) with check (true);
