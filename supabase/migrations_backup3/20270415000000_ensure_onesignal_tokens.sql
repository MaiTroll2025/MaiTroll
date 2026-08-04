-- Add push notification support for stream chat and messages
-- This migration ensures the onesignal_tokens table is properly configured

-- Ensure the table exists (may already exist from previous migration)
create table if not exists public.onesignal_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create indexes if they don't exist
create index if not exists idx_onesignal_tokens_user_id on public.onesignal_tokens (user_id);
create index if not exists idx_onesignal_tokens_active on public.onesignal_tokens (is_active);

-- Enable RLS
alter table public.onesignal_tokens enable row level security;

-- RLS policies
drop policy if exists "Users can insert their OneSignal token" on public.onesignal_tokens;
drop policy if exists "Users can update their OneSignal token" on public.onesignal_tokens;
drop policy if exists "Users can read their OneSignal token" on public.onesignal_tokens;

create policy "Users can insert their OneSignal token"
  on public.onesignal_tokens
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their OneSignal token"
  on public.onesignal_tokens
  for update
  using (auth.uid() = user_id);

create policy "Users can read their own OneSignal token"
  on public.onesignal_tokens
  for select
  using (auth.uid() = user_id);

create policy "Service role can manage all tokens"
  on public.onesignal_tokens
  for all
  using (auth.role() = 'service_role');

-- Grant permissions
grant select, insert, update on public.onesignal_tokens to authenticated;
grant all on public.onesignal_tokens to service_role;