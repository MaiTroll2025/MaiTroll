-- Create mobile_error_logs table
create table if not exists public.mobile_error_logs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    error_message text not null,
    stack_trace text,
    component_stack text,
    user_agent text,
    url text,
    user_id uuid references auth.users(id),
    metadata jsonb default '{}'::jsonb
);

-- Enable RLS
alter table public.mobile_error_logs enable row level security;

-- Allow anyone (anon/auth) to insert logs
create policy "Anyone can insert error logs"
    on public.mobile_error_logs for insert
    with check (true);

-- Allow admins to view logs (assuming admins have a way to be identified, or just authenticated users for now)
-- Adjust this policy based on your admin role logic
create policy "Admins can view error logs"
    on public.mobile_error_logs for select
    using (auth.role() = 'authenticated'); -- Simplified for now, restrict to admins in prod
