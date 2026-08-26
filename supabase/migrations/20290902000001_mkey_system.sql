-- =========================================================================
-- Migration: MAITROLL MKEY SYSTEM
-- Date: 2026-09-02
--
-- MKeys are a gift-tray item that buys *invitations*, not vanity.
--   1 MKey = 1 invitation delivered to 1 currently-active MaiTroll user
--   User joins the target broadcast  -> MKey CLAIMED
--   User does not join before expiry -> MKey RETURNED to the sender
--
-- Lifecycle:
--   AVAILABLE -> HELD -> NOTIFIED -> (JOINED -> CLAIMED | EXPIRED -> RETURNED)
--
-- Accounting invariant: total = available_mkeys + held_mkeys
-- Every balance mutation happens inside a SECURITY DEFINER function that
-- locks the wallet row. The client can never set a balance, mark a claim,
-- or issue a return.
-- =========================================================================

-- =========================================================================
-- 1. WALLET COLUMNS (available / held accounting on user_profiles)
-- =========================================================================

alter table public.user_profiles
  add column if not exists available_mkeys integer not null default 0,
  add column if not exists held_mkeys integer not null default 0,
  add column if not exists lifetime_mkeys_sent integer not null default 0,
  add column if not exists lifetime_mkeys_claimed integer not null default 0,
  add column if not exists lifetime_mkeys_returned integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_profiles'::regclass
      and conname = 'user_profiles_available_mkeys_non_negative'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_available_mkeys_non_negative
      check (available_mkeys >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_profiles'::regclass
      and conname = 'user_profiles_held_mkeys_non_negative'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_held_mkeys_non_negative
      check (held_mkeys >= 0) not valid;
  end if;
end
$$;

comment on column public.user_profiles.available_mkeys is 'MKeys the user can spend right now. Server-authoritative.';
comment on column public.user_profiles.held_mkeys is 'MKeys locked inside open MKey invitations. Returned on expiry, consumed on claim.';

-- =========================================================================
-- 2. SERVER-SIDE CONFIG (single row, admin tunable)
-- =========================================================================

create table if not exists public.mkey_config (
  id boolean primary key default true,
  invite_expiry_seconds integer not null default 300,
  recipient_cooldown_seconds integer not null default 1800,
  presence_stale_seconds integer not null default 300,
  min_dwell_seconds integer not null default 5,
  max_amount_per_send integer not null default 500,
  send_cooldown_seconds integer not null default 10,
  updated_at timestamptz not null default now(),
  constraint mkey_config_singleton check (id)
);

insert into public.mkey_config (id) values (true) on conflict (id) do nothing;

alter table public.mkey_config enable row level security;

drop policy if exists "mkey_config_read_all" on public.mkey_config;
create policy "mkey_config_read_all"
  on public.mkey_config for select
  using (auth.role() = 'authenticated');

drop policy if exists "mkey_config_no_insert" on public.mkey_config;
create policy "mkey_config_no_insert"
  on public.mkey_config for insert
  with check (false);

drop policy if exists "mkey_config_no_update" on public.mkey_config;
create policy "mkey_config_no_update"
  on public.mkey_config for update
  using (false);

drop policy if exists "mkey_config_no_delete" on public.mkey_config;
create policy "mkey_config_no_delete"
  on public.mkey_config for delete
  using (false);

comment on table public.mkey_config is 'Server-side MKey tuning. Claim window, cooldowns and caps live here, never on the client.';

-- =========================================================================
-- 3. MKEY BOOSTS (one row per "SEND MKEYS" press = one campaign)
-- =========================================================================

create table if not exists public.mkey_boosts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.user_profiles(id) on delete cascade,
  broadcast_id text not null,
  broadcaster_id uuid references public.user_profiles(id) on delete set null,
  amount integer not null check (amount > 0),
  invites_created integer not null default 0,
  claimed_count integer not null default 0,
  returned_count integer not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_mkey_boosts_sender on public.mkey_boosts(sender_id, created_at desc);
create index if not exists idx_mkey_boosts_broadcast on public.mkey_boosts(broadcast_id);
create index if not exists idx_mkey_boosts_open on public.mkey_boosts(expires_at) where status = 'active';

alter table public.mkey_boosts enable row level security;

drop policy if exists "mkey_boosts_participant_read" on public.mkey_boosts;
create policy "mkey_boosts_participant_read"
  on public.mkey_boosts for select
  using (auth.uid() = sender_id or auth.uid() = broadcaster_id);

drop policy if exists "mkey_boosts_no_insert" on public.mkey_boosts;
create policy "mkey_boosts_no_insert"
  on public.mkey_boosts for insert
  with check (false);

drop policy if exists "mkey_boosts_no_update" on public.mkey_boosts;
create policy "mkey_boosts_no_update"
  on public.mkey_boosts for update
  using (false);

drop policy if exists "mkey_boosts_no_delete" on public.mkey_boosts;
create policy "mkey_boosts_no_delete"
  on public.mkey_boosts for delete
  using (false);

comment on table public.mkey_boosts is 'One MKey send operation. amount = MKeys held; invites_created = eligible users actually found.';

-- =========================================================================
-- 4. MKEY INVITES (one row per individual MKey -> individual invitation)
-- =========================================================================

create table if not exists public.mkey_invites (
  id uuid primary key default gen_random_uuid(),
  boost_id uuid not null references public.mkey_boosts(id) on delete cascade,
  sender_id uuid not null references public.user_profiles(id) on delete cascade,
  recipient_id uuid not null references public.user_profiles(id) on delete cascade,
  broadcast_id text not null,
  amount integer not null default 1 check (amount = 1),
  status text not null default 'pending'
    check (status in ('pending', 'notified', 'claimed', 'expired', 'returned', 'cancelled')),
  notification_id uuid,
  source_broadcast_id text,
  source_role text,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  joined_at timestamptz,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  returned_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  -- Rule 16: the same user can never be selected twice for one send operation.
  constraint mkey_invites_boost_recipient_unique unique (boost_id, recipient_id)
);

create index if not exists idx_mkey_invites_recipient_open
  on public.mkey_invites(recipient_id, broadcast_id)
  where status in ('pending', 'notified');

create index if not exists idx_mkey_invites_sweeper
  on public.mkey_invites(expires_at)
  where status in ('pending', 'notified');

create index if not exists idx_mkey_invites_boost on public.mkey_invites(boost_id);
create index if not exists idx_mkey_invites_sender on public.mkey_invites(sender_id, created_at desc);
create index if not exists idx_mkey_invites_broadcast on public.mkey_invites(broadcast_id, status);
create index if not exists idx_mkey_invites_recipient_cooldown
  on public.mkey_invites(recipient_id, created_at desc);

-- One open invitation per recipient per broadcast: no stacking spam.
create unique index if not exists idx_mkey_invites_one_open_per_broadcast
  on public.mkey_invites(recipient_id, broadcast_id)
  where status in ('pending', 'notified');

alter table public.mkey_invites enable row level security;

drop policy if exists "mkey_invites_participant_read" on public.mkey_invites;
create policy "mkey_invites_participant_read"
  on public.mkey_invites for select
  using (auth.uid() = recipient_id or auth.uid() = sender_id);

drop policy if exists "mkey_invites_no_insert" on public.mkey_invites;
create policy "mkey_invites_no_insert"
  on public.mkey_invites for insert
  with check (false);

drop policy if exists "mkey_invites_no_update" on public.mkey_invites;
create policy "mkey_invites_no_update"
  on public.mkey_invites for update
  using (false);

drop policy if exists "mkey_invites_no_delete" on public.mkey_invites;
create policy "mkey_invites_no_delete"
  on public.mkey_invites for delete
  using (false);

comment on table public.mkey_invites is 'One row per MKey. status carries the AVAILABLE->HELD->NOTIFIED->CLAIMED/RETURNED lifecycle.';

-- =========================================================================
-- 5. MKEY TRANSACTIONS (immutable ledger)
-- =========================================================================

create table if not exists public.mkey_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  amount integer not null,
  transaction_type text not null
    check (transaction_type in ('purchase', 'held', 'claimed', 'returned', 'refund', 'admin_adjustment')),
  broadcast_id text,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed', 'reversed')),
  boost_id uuid references public.mkey_boosts(id) on delete set null,
  invite_id uuid references public.mkey_invites(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_mkey_transactions_user on public.mkey_transactions(user_id, created_at desc);
create index if not exists idx_mkey_transactions_type on public.mkey_transactions(transaction_type);
create index if not exists idx_mkey_transactions_boost on public.mkey_transactions(boost_id);
create index if not exists idx_mkey_transactions_broadcast on public.mkey_transactions(broadcast_id);

alter table public.mkey_transactions enable row level security;

drop policy if exists "mkey_transactions_owner_read" on public.mkey_transactions;
create policy "mkey_transactions_owner_read"
  on public.mkey_transactions for select
  using (auth.uid() = user_id);

drop policy if exists "mkey_transactions_no_insert" on public.mkey_transactions;
create policy "mkey_transactions_no_insert"
  on public.mkey_transactions for insert
  with check (false);

drop policy if exists "mkey_transactions_no_update" on public.mkey_transactions;
create policy "mkey_transactions_no_update"
  on public.mkey_transactions for update
  using (false);

drop policy if exists "mkey_transactions_no_delete" on public.mkey_transactions;
create policy "mkey_transactions_no_delete"
  on public.mkey_transactions for delete
  using (false);

comment on table public.mkey_transactions is 'Append-only MKey ledger. amount is always a positive magnitude; transaction_type carries direction.';
