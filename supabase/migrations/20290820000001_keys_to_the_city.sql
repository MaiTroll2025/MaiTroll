-- =========================================================================
-- Migration: Keys to the City — MaiTroll Key Economy System
-- Date: 2026-08-20
-- =========================================================================

-- =========================================================================
-- 1. KEY DEFINITIONS (Blueprints for each key type)
-- =========================================================================

create table if not exists public.key_definitions (
  id uuid primary key default gen_random_uuid(),
  key_letter text not null check (key_letter in ('M','A','I','T','R','*')),
  rarity text not null check (rarity in ('COMMON','UNCOMMON','RARE','VERY_RARE','LEGENDARY')),
  min_value numeric not null,
  max_value numeric not null,
  supply_limit integer not null,
  is_legendary boolean not null default false,
  is_key_to_city boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint key_definitions_letter_rarity_unique unique (key_letter, rarity, is_key_to_city)
);

create index if not exists idx_key_definitions_letter on public.key_definitions(key_letter);
create index if not exists idx_key_definitions_rarity on public.key_definitions(rarity);

alter table public.key_definitions enable row level security;

create policy "key_definitions_read_all"
  on public.key_definitions for select
  using (auth.role() = 'authenticated');

-- =========================================================================
-- 2. KEY INSTANCES (Individual keys)
-- =========================================================================

create table if not exists public.key_instances (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.key_definitions(id) on delete restrict,
  key_letter text not null check (key_letter in ('M','A','I','T','R','*')),
  rarity text not null check (rarity in ('COMMON','UNCOMMON','RARE','VERY_RARE','LEGENDARY')),
  value numeric not null,
  owner_id uuid references public.user_profiles(id) on delete set null,
  previous_owner_id uuid references public.user_profiles(id) on delete set null,
  received_at timestamptz not null default now(),
  cashout_available_at timestamptz not null,
  status text not null default 'active' check (status in ('active','cashed_out','transferred','listed','in_trade')),
  source text not null default 'system',
  is_transferable boolean not null default true,
  is_key_to_city boolean not null default false,
  cashed_out_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_key_instances_owner on public.key_instances(owner_id);
create index if not exists idx_key_instances_status on public.key_instances(status);
create index if not exists idx_key_instances_letter on public.key_instances(key_letter);
create index if not exists idx_key_instances_cashout on public.key_instances(cashout_available_at);
create unique index if not exists idx_key_instances_id on public.key_instances(id);

alter table public.key_instances enable row level security;

-- Owner can see their own keys with full details
create policy "key_instances_owner_read"
  on public.key_instances for select
  using (auth.uid() = owner_id);

-- Public can see keys (but RPC will strip private values)
create policy "key_instances_public_read"
  on public.key_instances for select
  using (auth.role() = 'authenticated');

-- No direct inserts/updates/deletes allowed from frontend
create policy "key_instances_no_insert"
  on public.key_instances for insert
  with check (false);

create policy "key_instances_no_update"
  on public.key_instances for update
  using (false);

create policy "key_instances_no_delete"
  on public.key_instances for delete
  using (false);

-- =========================================================================
-- 3. KEY TRANSACTIONS (Immutable audit history)
-- =========================================================================

create table if not exists public.key_transactions (
  id uuid primary key default gen_random_uuid(),
  key_instance_id uuid not null references public.key_instances(id) on delete cascade,
  actor_id uuid not null references public.user_profiles(id) on delete set null,
  from_user_id uuid references public.user_profiles(id) on delete set null,
  to_user_id uuid references public.user_profiles(id) on delete set null,
  action text not null check (action in ('created','received','transferred','traded','sold','cashed_out','listed','purchased','set_completed','set_cashed_out')),
  value numeric not null,
  previous_value numeric,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_key_transactions_key on public.key_transactions(key_instance_id);
create index if not exists idx_key_transactions_actor on public.key_transactions(actor_id);
create index if not exists idx_key_transactions_action on public.key_transactions(action);
create index if not exists idx_key_transactions_created on public.key_transactions(created_at);

alter table public.key_transactions enable row level security;

create policy "key_transactions_owner_read"
  on public.key_transactions for select
  using (
    auth.uid() = actor_id
    or auth.uid() = from_user_id
    or auth.uid() = to_user_id
    or exists (select 1 from public.key_instances ki where ki.id = key_instance_id and ki.owner_id = auth.uid())
  );

create policy "key_transactions_no_insert"
  on public.key_transactions for insert
  with check (false);

create policy "key_transactions_no_update"
  on public.key_transactions for update
  using (false);

create policy "key_transactions_no_delete"
  on public.key_transactions for delete
  using (false);

-- =========================================================================
-- 4. KEY TRADE REQUESTS
-- =========================================================================

create table if not exists public.key_trade_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.user_profiles(id) on delete cascade,
  to_user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired','cancelled')),
  message text,
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint key_trade_no_self check (from_user_id <> to_user_id)
);

create index if not exists idx_key_trade_requests_from on public.key_trade_requests(from_user_id);
create index if not exists idx_key_trade_requests_to on public.key_trade_requests(to_user_id);
create index if not exists idx_key_trade_requests_status on public.key_trade_requests(status);

alter table public.key_trade_requests enable row level security;

create policy "key_trade_requests_participants_read"
  on public.key_trade_requests for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "key_trade_requests_from_insert"
  on public.key_trade_requests for insert
  with check (auth.uid() = from_user_id);

create policy "key_trade_requests_participants_update"
  on public.key_trade_requests for update
  using (auth.uid() = from_user_id or auth.uid() = to_user_id)
  with check (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- =========================================================================
-- 5. KEY TRADE ITEMS
-- =========================================================================

create table if not exists public.key_trade_items (
  id uuid primary key default gen_random_uuid(),
  trade_request_id uuid not null references public.key_trade_requests(id) on delete cascade,
  key_instance_id uuid not null references public.key_instances(id) on delete restrict,
  offered_by_user_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint key_trade_items_unique_key unique (trade_request_id, key_instance_id)
);

create index if not exists idx_key_trade_items_trade on public.key_trade_items(trade_request_id);
create index if not exists idx_key_trade_items_key on public.key_trade_items(key_instance_id);

alter table public.key_trade_items enable row level security;

create policy "key_trade_items_participants_read"
  on public.key_trade_items for select
  using (
    exists (
      select 1 from public.key_trade_requests tr
      where tr.id = trade_request_id
      and (tr.from_user_id = auth.uid() or tr.to_user_id = auth.uid())
    )
  );

create policy "key_trade_items_participants_insert"
  on public.key_trade_items for insert
  with check (
    auth.uid() = offered_by_user_id
    and exists (
      select 1 from public.key_trade_requests tr
      where tr.id = trade_request_id
      and tr.from_user_id = auth.uid()
      and tr.status = 'pending'
    )
  );

-- =========================================================================
-- 6. KEY MARKETPLACE LISTINGS
-- =========================================================================

create table if not exists public.key_marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  key_instance_id uuid not null references public.key_instances(id) on delete cascade,
  seller_id uuid not null references public.user_profiles(id) on delete cascade,
  price numeric not null,
  status text not null default 'active' check (status in ('active','sold','cancelled','expired')),
  created_at timestamptz not null default now(),
  sold_at timestamptz null,
  purchased_by uuid references public.user_profiles(id) on delete set null,
  constraint key_marketplace_unique_key unique (key_instance_id)
);

create index if not exists idx_key_marketplace_seller on public.key_marketplace_listings(seller_id);
create index if not exists idx_key_marketplace_status on public.key_marketplace_listings(status);
create index if not exists idx_key_marketplace_key on public.key_marketplace_listings(key_instance_id);

alter table public.key_marketplace_listings enable row level security;

create policy "key_marketplace_public_read"
  on public.key_marketplace_listings for select
  using (auth.role() = 'authenticated' and status = 'active');

create policy "key_marketplace_seller_insert"
  on public.key_marketplace_listings for insert
  with check (auth.uid() = seller_id);

create policy "key_marketplace_seller_update"
  on public.key_marketplace_listings for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

create policy "key_marketplace_seller_delete"
  on public.key_marketplace_listings for delete
  using (auth.uid() = seller_id);

-- =========================================================================
-- 7. KEY SET COMPLETIONS
-- =========================================================================

create table if not exists public.key_set_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  key_instance_ids jsonb not null default '[]'::jsonb,
  total_value numeric not null,
  bonus_amount numeric not null,
  final_amount numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_key_set_completions_user on public.key_set_completions(user_id);
create index if not exists idx_key_set_completions_created on public.key_set_completions(created_at);

alter table public.key_set_completions enable row level security;

create policy "key_set_completions_owner_read"
  on public.key_set_completions for select
  using (auth.uid() = user_id);

create policy "key_set_completions_no_insert"
  on public.key_set_completions for insert
  with check (false);

create policy "key_set_completions_no_update"
  on public.key_set_completions for update
  using (false);

create policy "key_set_completions_no_delete"
  on public.key_set_completions for delete
  using (false);

-- =========================================================================
-- 8. KEY SUPPLY (Supply tracking per rarity)
-- =========================================================================

create table if not exists public.key_supply (
  id uuid primary key default gen_random_uuid(),
  total_supply integer not null default 2000000,
  keys_issued integer not null default 0,
  keys_remaining integer not null default 2000000,
  rarity text not null check (rarity in ('COMMON','UNCOMMON','RARE','VERY_RARE','LEGENDARY','TOTAL')),
  legendary_issued integer not null default 0,
  legendary_limit integer not null default 100,
  key_to_city_issued integer not null default 0,
  key_to_city_limit integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_key_supply_rarity on public.key_supply(rarity);

alter table public.key_supply enable row level security;

create policy "key_supply_read_all"
  on public.key_supply for select
  using (auth.role() = 'authenticated');

create policy "key_supply_no_insert"
  on public.key_supply for insert
  with check (false);

create policy "key_supply_no_update"
  on public.key_supply for update
  using (false);

create policy "key_supply_no_delete"
  on public.key_supply for delete
  using (false);

-- =========================================================================
-- 9. SEED KEY DEFINITIONS
-- =========================================================================

insert into public.key_definitions (key_letter, rarity, min_value, max_value, supply_limit, is_legendary, is_key_to_city)
values
  ('M', 'COMMON', 5, 25, 500000, false, false),
  ('M', 'UNCOMMON', 26, 75, 300000, false, false),
  ('M', 'RARE', 76, 200, 100000, false, false),
  ('M', 'VERY_RARE', 201, 500, 20000, false, false),
  ('M', 'LEGENDARY', 501, 2000, 5000, true, false),
  ('A', 'COMMON', 5, 25, 500000, false, false),
  ('A', 'UNCOMMON', 26, 75, 300000, false, false),
  ('A', 'RARE', 76, 200, 100000, false, false),
  ('A', 'VERY_RARE', 201, 500, 20000, false, false),
  ('A', 'LEGENDARY', 501, 2000, 5000, true, false),
  ('I', 'COMMON', 5, 25, 500000, false, false),
  ('I', 'UNCOMMON', 26, 75, 300000, false, false),
  ('I', 'RARE', 76, 200, 100000, false, false),
  ('I', 'VERY_RARE', 201, 500, 20000, false, false),
  ('I', 'LEGENDARY', 501, 2000, 5000, true, false),
  ('T', 'COMMON', 5, 25, 500000, false, false),
  ('T', 'UNCOMMON', 26, 75, 300000, false, false),
  ('T', 'RARE', 76, 200, 100000, false, false),
  ('T', 'VERY_RARE', 201, 500, 20000, false, false),
  ('T', 'LEGENDARY', 501, 2000, 5000, true, false),
  ('R', 'COMMON', 5, 25, 500000, false, false),
  ('R', 'UNCOMMON', 26, 75, 300000, false, false),
  ('R', 'RARE', 76, 200, 100000, false, false),
  ('R', 'VERY_RARE', 201, 500, 20000, false, false),
  ('R', 'LEGENDARY', 501, 2000, 5000, true, false),
  ('*', 'LEGENDARY', 20000, 20000, 5, true, true)
on conflict (key_letter, rarity, is_key_to_city) do nothing;

-- Seed supply tracking
insert into public.key_supply (rarity, total_supply, keys_issued, keys_remaining, legendary_limit, key_to_city_limit)
values
  ('TOTAL', 2000000, 0, 2000000, 100, 5),
  ('COMMON', 500000, 0, 500000, 0, 0),
  ('UNCOMMON', 300000, 0, 300000, 0, 0),
  ('RARE', 100000, 0, 100000, 0, 0),
  ('VERY_RARE', 20000, 0, 20000, 0, 0),
  ('LEGENDARY', 5000, 0, 5000, 100, 5)
on conflict (rarity) do nothing;

-- =========================================================================
-- 10. HELPER FUNCTIONS
-- =========================================================================

create or replace function public.is_key_owner(p_key_id uuid, p_user_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.key_instances
    where id = p_key_id and owner_id = p_user_id
  );
$$;

create or replace function public.get_user_key_count(p_user_id uuid)
returns integer language sql stable as $$
  select count(*) from public.key_instances where owner_id = p_user_id and status = 'active';
$$;

create or replace function public.user_has_key_letter(p_user_id uuid, p_letter text)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.key_instances
    where owner_id = p_user_id and key_letter = p_letter and status = 'active'
  );
$$;

create or replace function public.user_account_age_days(p_user_id uuid)
returns integer language sql stable as $$
  select coalesce(extract(day from (now() - up.created_at))::integer, 0)
  from public.user_profiles up where up.id = p_user_id;
$$;

-- =========================================================================
-- 11. SECURE RPC FUNCTIONS
-- =========================================================================

-- Award a random key to a user (backend-authoritative)
create or replace function public.award_key_to_user(p_user_id uuid)
returns json language plpgsql as $$
declare
  v_definition public.key_definitions%rowtype;
  v_key_instance_id uuid;
  v_value numeric;
  v_supply_row public.key_supply%rowtype;
  v_account_age integer;
  v_rarity text;
  v_roll double precision;
  v_legendary_roll double precision;
  v_key_to_city_roll double precision;
  v_key_to_city_def public.key_definitions%rowtype;
begin
  -- Check account age (7 days)
  select public.user_account_age_days(p_user_id) into v_account_age;
  if v_account_age < 7 then
    return json_build_object('success', false, 'error', 'ACCOUNT_TOO_NEW', 'message', 'You must have a MaiTroll account for at least 7 days before you can receive or trade keys.');
  end if;

  -- Lock the TOTAL supply row
  select * into v_supply_row from public.key_supply where rarity = 'TOTAL' for update;
  if v_supply_row.keys_issued >= v_supply_row.total_supply then
    return json_build_object('success', false, 'error', 'SUPPLY_EXHAUSTED', 'message', 'No more keys available at this time.');
  end if;

  -- Random rarity roll (weighted)
  v_roll := random();

  if v_roll < 0.000001 then
    v_rarity := 'LEGENDARY';
  elsif v_roll < 0.005 then
    v_rarity := 'VERY_RARE';
  elsif v_roll < 0.03 then
    v_rarity := 'RARE';
  elsif v_roll < 0.20 then
    v_rarity := 'UNCOMMON';
  else
    v_rarity := 'COMMON';
  end if;

  -- KEY TO THE CITY ultra-rare roll (0.01% chance within legendary)
  if v_rarity = 'LEGENDARY' then
    v_key_to_city_roll := random();
    if v_key_to_city_roll < 0.01 then
      select * into v_key_to_city_def from public.key_definitions where is_key_to_city = true and key_letter = '*' for update;
      if v_key_to_city_def is not null then
        select * into v_supply_row from public.key_supply where rarity = 'LEGENDARY' for update;
        if v_supply_row.key_to_city_issued < v_supply_row.key_to_city_limit then
          v_definition := v_key_to_city_def;
          v_value := v_definition.min_value;
          v_rarity := 'LEGENDARY';
        else
          -- Fallback to regular legendary
          select * into v_definition from public.key_definitions where rarity = 'LEGENDARY' and is_key_to_city = false order by random() limit 1 for update;
          v_value := floor(random() * (v_definition.max_value - v_definition.min_value + 1)) + v_definition.min_value;
        end if;
      else
        select * into v_definition from public.key_definitions where rarity = 'LEGENDARY' and is_key_to_city = false order by random() limit 1 for update;
        v_value := floor(random() * (v_definition.max_value - v_definition.min_value + 1)) + v_definition.min_value;
      end if;
    else
      select * into v_definition from public.key_definitions where rarity = 'LEGENDARY' and is_key_to_city = false order by random() limit 1 for update;
      if not found then
        -- Fallback to lower rarity
        select * into v_definition from public.key_definitions where rarity = 'VERY_RARE' order by random() limit 1 for update;
        v_value := floor(random() * (v_definition.max_value - v_definition.min_value + 1)) + v_definition.min_value;
        v_rarity := 'VERY_RARE';
      else
        v_value := floor(random() * (v_definition.max_value - v_definition.min_value + 1)) + v_definition.min_value;
      end if;
    end if;
  else
    select * into v_definition from public.key_definitions where rarity = v_rarity order by random() limit 1 for update;
    if not found then
      -- Fallback to common
      select * into v_definition from public.key_definitions where rarity = 'COMMON' order by random() limit 1 for update;
      v_rarity := 'COMMON';
    end if;
    v_value := floor(random() * (v_definition.max_value - v_definition.min_value + 1)) + v_definition.min_value;
  end if;

  if v_definition is null then
    return json_build_object('success', false, 'error', 'NO_DEFINITION_AVAILABLE');
  end if;

  -- Create the key instance
  insert into public.key_instances (
    definition_id, key_letter, rarity, value, owner_id,
    cashout_available_at, status, source, is_transferable, is_key_to_city
  ) values (
    v_definition.id, v_definition.key_letter, v_rarity, v_value, p_user_id,
    now() + interval '14 days', 'active', 'system', true, v_definition.is_key_to_city
  ) returning id into v_key_instance_id;

  -- Log transaction
  insert into public.key_transactions (key_instance_id, actor_id, from_user_id, to_user_id, action, value)
  values (v_key_instance_id, p_user_id, null, p_user_id, 'received', v_value);

  -- Update supply
  update public.key_supply
  set keys_issued = keys_issued + 1, keys_remaining = keys_remaining - 1, updated_at = now()
  where rarity in (v_rarity, 'TOTAL');

  if v_definition.is_key_to_city then
    update public.key_supply
    set key_to_city_issued = key_to_city_issued + 1
    where rarity = 'LEGENDARY';
  end if;

  if v_rarity = 'LEGENDARY' then
    update public.key_supply
    set legendary_issued = legendary_issued + 1
    where rarity = 'LEGENDARY';
  end if;

  return json_build_object(
    'success', true,
    'key_instance_id', v_key_instance_id,
    'key_letter', v_definition.key_letter,
    'rarity', v_rarity,
    'value', v_value,
    'is_key_to_city', v_definition.is_key_to_city,
    'cashout_available_at', (now() + interval '14 days')::text
  );
end;
$$;

-- Transfer key between users
create or replace function public.transfer_key(
  p_key_instance_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid
) returns json language plpgsql as $$
declare
  v_key public.key_instances%rowtype;
  v_to_account_age integer;
begin
  -- Lock the key row
  select * into v_key from public.key_instances where id = p_key_instance_id for update;

  if not found then
    return json_build_object('success', false, 'error', 'KEY_NOT_FOUND');
  end if;

  if v_key.owner_id != p_from_user_id then
    return json_build_object('success', false, 'error', 'NOT_OWNER');
  end if;

  if v_key.status != 'active' then
    return json_build_object('success', false, 'error', 'KEY_NOT_ACTIVE');
  end if;

  if not v_key.is_transferable then
    return json_build_object('success', false, 'error', 'KEY_NOT_TRANSFERABLE');
  end if;

  -- Check recipient account age
  select public.user_account_age_days(p_to_user_id) into v_to_account_age;
  if v_to_account_age < 7 then
    return json_build_object('success', false, 'error', 'ACCOUNT_TOO_NEW', 'message', 'Recipient must have a MaiTroll account for at least 7 days.');
  end if;

  -- Check cashout lock
  if v_key.cashout_available_at > now() then
    return json_build_object('success', false, 'error', 'CASHOUT_LOCKED');
  end if;

  -- Transfer
  update public.key_instances
  set owner_id = p_to_user_id,
      previous_owner_id = p_from_user_id,
      status = 'active',
      updated_at = now()
  where id = p_key_instance_id;

  insert into public.key_transactions (key_instance_id, actor_id, from_user_id, to_user_id, action, value)
  values (p_key_instance_id, p_from_user_id, p_from_user_id, p_to_user_id, 'transferred', v_key.value);

  return json_build_object('success', true, 'key_instance_id', p_key_instance_id);
end;
$$;

-- Cashout a single key
create or replace function public.cashout_key(p_key_instance_id uuid, p_user_id uuid)
returns json language plpgsql as $$
declare
  v_key public.key_instances%rowtype;
  v_tx_id uuid;
begin
  select * into v_key from public.key_instances where id = p_key_instance_id for update;

  if not found then
    return json_build_object('success', false, 'error', 'KEY_NOT_FOUND');
  end if;

  if v_key.owner_id != p_user_id then
    return json_build_object('success', false, 'error', 'NOT_OWNER');
  end if;

  if v_key.status != 'active' then
    return json_build_object('success', false, 'error', 'KEY_NOT_ACTIVE');
  end if;

  if v_key.cashout_available_at > now() then
    return json_build_object('success', false, 'error', 'CASHOUT_LOCKED', 'available_at', v_key.cashout_available_at);
  end if;

  -- Mark as cashed out
  update public.key_instances
  set status = 'cashed_out',
      cashed_out_at = now(),
      updated_at = now()
  where id = p_key_instance_id;

  insert into public.key_transactions (key_instance_id, actor_id, from_user_id, to_user_id, action, value)
  values (p_key_instance_id, p_user_id, p_user_id, null, 'cashed_out', v_key.value);

  return json_build_object('success', true, 'value', v_key.value, 'key_instance_id', p_key_instance_id);
end;
$$;

-- Cashout complete MAITROLL set with 5% bonus
create or replace function public.cashout_maitroll_set(p_user_id uuid)
returns json language plpgsql as $$
declare
  v_keys record;
  v_total numeric := 0;
  v_bonus numeric;
  v_final numeric;
  v_key_ids uuid[] := '{}';
  v_has_m boolean;
  v_has_a boolean;
  v_has_i boolean;
  v_has_t boolean;
  v_has_r boolean;
begin
  -- Check that user owns all five letters
  select public.user_has_key_letter(p_user_id, 'M') into v_has_m;
  select public.user_has_key_letter(p_user_id, 'A') into v_has_a;
  select public.user_has_key_letter(p_user_id, 'I') into v_has_i;
  select public.user_has_key_letter(p_user_id, 'T') into v_has_t;
  select public.user_has_key_letter(p_user_id, 'R') into v_has_r;

  if not (v_has_m and v_has_a and v_has_i and v_has_t and v_has_r) then
    return json_build_object('success', false, 'error', 'INCOMPLETE_SET');
  end if;

  -- Sum values of all owned keys (only active ones)
  for v_keys in
    select id, value, cashout_available_at, status from public.key_instances
    where owner_id = p_user_id and status = 'active'
    and key_letter in ('M','A','I','T','R')
    for update
  loop
    if v_keys.cashout_available_at > now() then
      return json_build_object('success', false, 'error', 'CASHOUT_LOCKED', 'key_id', v_keys.id, 'available_at', v_keys.cashout_available_at);
    end if;
    v_total := v_total + v_keys.value;
    v_key_ids := array_append(v_key_ids, v_keys.id);
  end loop;

  if array_length(v_key_ids, 1) < 5 then
    return json_build_object('success', false, 'error', 'INCOMPLETE_SET');
  end if;

  -- Calculate 5% bonus using numeric math
  v_bonus := (v_total * 5) / 100;
  v_final := v_total + v_bonus;

  -- Cash out each key
  for v_keys in
    select id from public.key_instances
    where owner_id = p_user_id and status = 'active'
    and key_letter in ('M','A','I','T','R')
  loop
    update public.key_instances
    set status = 'cashed_out', cashed_out_at = now(), updated_at = now()
    where id = v_keys.id;

    insert into public.key_transactions (key_instance_id, actor_id, from_user_id, to_user_id, action, value)
    select v_keys.id, p_user_id, p_user_id, null, 'set_cashed_out', value from public.key_instances where id = v_keys.id;
  end loop;

  -- Record completion
  insert into public.key_set_completions (user_id, key_instance_ids, total_value, bonus_amount, final_amount)
  values (p_user_id, to_jsonb(v_key_ids), v_total, v_bonus, v_final);

  return json_build_object(
    'success', true,
    'total_value', v_total,
    'bonus_amount', v_bonus,
    'final_amount', v_final,
    'key_ids', v_key_ids
  );
end;
$$;

-- Create trade request
create or replace function public.create_trade_request(
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_offered_key_ids uuid[],
  p_requested_key_ids uuid[],
  p_message text default null
) returns json language plpgsql as $$
declare
  v_trade_id uuid;
  v_key_id uuid;
  v_account_age integer;
begin
  if p_from_user_id = p_to_user_id then
    return json_build_object('success', false, 'error', 'CANNOT_TRADE_SELF');
  end if;

  select public.user_account_age_days(p_from_user_id) into v_account_age;
  if v_account_age < 7 then
    return json_build_object('success', false, 'error', 'ACCOUNT_TOO_NEW');
  end if;

  insert into public.key_trade_requests (from_user_id, to_user_id, message)
  values (p_from_user_id, p_to_user_id, p_message)
  returning id into v_trade_id;

  foreach v_key_id in array p_offered_key_ids loop
    insert into public.key_trade_items (trade_request_id, key_instance_id, offered_by_user_id)
    values (v_trade_id, v_key_id, p_from_user_id);
  end loop;

  foreach v_key_id in array p_requested_key_ids loop
    insert into public.key_trade_items (trade_request_id, key_instance_id, offered_by_user_id)
    values (v_trade_id, v_key_id, p_to_user_id);
  end loop;

  return json_build_object('success', true, 'trade_request_id', v_trade_id);
end;
$$;

-- Accept trade request
create or replace function public.accept_trade_request(p_trade_request_id uuid, p_user_id uuid)
returns json language plpgsql as $$
declare
  v_trade public.key_trade_requests%rowtype;
  v_item record;
  v_key public.key_instances%rowtype;
  v_from_account_age integer;
  v_to_account_age integer;
begin
  select * into v_trade from public.key_trade_requests where id = p_trade_request_id for update;

  if not found then
    return json_build_object('success', false, 'error', 'TRADE_NOT_FOUND');
  end if;

  if v_trade.status != 'pending' then
    return json_build_object('success', false, 'error', 'TRADE_NOT_PENDING');
  end if;

  if v_trade.to_user_id != p_user_id then
    return json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  end if;

  -- Verify all keys are still owned by the correct users and are active
  for v_item in
    select * from public.key_trade_items where trade_request_id = p_trade_request_id
  loop
    select * into v_key from public.key_instances where id = v_item.key_instance_id for update;
    if not found then
      return json_build_object('success', false, 'error', 'KEY_NOT_FOUND', 'key_id', v_item.key_instance_id);
    end if;
    if v_key.owner_id != v_item.offered_by_user_id then
      return json_build_object('success', false, 'error', 'KEY_OWNERSHIP_MISMATCH', 'key_id', v_item.key_instance_id);
    end if;
    if v_key.status != 'active' then
      return json_build_object('success', false, 'error', 'KEY_NOT_ACTIVE', 'key_id', v_item.key_instance_id);
    end if;
    if v_key.cashout_available_at > now() then
      return json_build_object('success', false, 'error', 'CASHOUT_LOCKED', 'key_id', v_item.key_instance_id, 'available_at', v_key.cashout_available_at);
    end if;
  end loop;

  -- Execute the transfer
  for v_item in
    select * from public.key_trade_items where trade_request_id = p_trade_request_id
  loop
    update public.key_instances
    set owner_id = case when offered_by_user_id = v_trade.from_user_id then v_trade.to_user_id else v_trade.from_user_id end,
        updated_at = now()
    where id = v_item.key_instance_id;

    insert into public.key_transactions (key_instance_id, actor_id, from_user_id, to_user_id, action, value)
    select v_item.key_instance_id, p_user_id,
           case when offered_by_user_id = v_trade.from_user_id then v_trade.from_user_id else v_trade.to_user_id end,
           case when offered_by_user_id = v_trade.from_user_id then v_trade.to_user_id else v_trade.from_user_id end,
           'traded', value
    from public.key_instances where id = v_item.key_instance_id;
  end loop;

  update public.key_trade_requests
  set status = 'accepted', responded_at = now(), updated_at = now()
  where id = p_trade_request_id;

  return json_build_object('success', true, 'trade_request_id', p_trade_request_id);
end;
$$;

-- Decline trade request
create or replace function public.decline_trade_request(p_trade_request_id uuid, p_user_id uuid)
returns json language plpgsql as $$
declare
  v_trade public.key_trade_requests%rowtype;
begin
  select * into v_trade from public.key_trade_requests where id = p_trade_request_id for update;

  if not found then
    return json_build_object('success', false, 'error', 'TRADE_NOT_FOUND');
  end if;

  if v_trade.to_user_id != p_user_id and v_trade.from_user_id != p_user_id then
    return json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  end if;

  if v_trade.status != 'pending' then
    return json_build_object('success', false, 'error', 'TRADE_NOT_PENDING');
  end if;

  update public.key_trade_requests
  set status = 'declined', responded_at = now(), updated_at = now()
  where id = p_trade_request_id;

  return json_build_object('success', true);
end;
$$;

-- List key for sale
create or replace function public.list_key_for_sale(p_key_instance_id uuid, p_user_id uuid, p_price numeric)
returns json language plpgsql as $$
declare
  v_key public.key_instances%rowtype;
begin
  select * into v_key from public.key_instances where id = p_key_instance_id for update;

  if not found then
    return json_build_object('success', false, 'error', 'KEY_NOT_FOUND');
  end if;

  if v_key.owner_id != p_user_id then
    return json_build_object('success', false, 'error', 'NOT_OWNER');
  end if;

  if v_key.status != 'active' then
    return json_build_object('success', false, 'error', 'KEY_NOT_ACTIVE');
  end if;

  if v_key.cashout_available_at > now() then
    return json_build_object('success', false, 'error', 'CASHOUT_LOCKED');
  end if;

  -- Check if already listed
  if exists (select 1 from public.key_marketplace_listings where key_instance_id = p_key_instance_id and status = 'active') then
    return json_build_object('success', false, 'error', 'ALREADY_LISTED');
  end if;

  insert into public.key_marketplace_listings (key_instance_id, seller_id, price)
  values (p_key_instance_id, p_user_id, p_price);

  update public.key_instances set status = 'listed', updated_at = now() where id = p_key_instance_id;

  insert into public.key_transactions (key_instance_id, actor_id, from_user_id, to_user_id, action, value)
  values (p_key_instance_id, p_user_id, p_user_id, null, 'listed', v_key.value);

  return json_build_object('success', true);
end;
$$;

-- Purchase key from marketplace
create or replace function public.purchase_key(p_listing_id uuid, p_buyer_id uuid)
returns json language plpgsql as $$
declare
  v_listing public.key_marketplace_listings%rowtype;
  v_key public.key_instances%rowtype;
  v_buyer_balance numeric;
  v_buyer_account_age integer;
begin
  select * into v_listing from public.key_marketplace_listings where id = p_listing_id for update;

  if not found then
    return json_build_object('success', false, 'error', 'LISTING_NOT_FOUND');
  end if;

  if v_listing.status != 'active' then
    return json_build_object('success', false, 'error', 'LISTING_NOT_ACTIVE');
  end if;

  if v_listing.seller_id = p_buyer_id then
    return json_build_object('success', false, 'error', 'CANNOT_BUY_OWN');
  end if;

  select public.user_account_age_days(p_buyer_id) into v_buyer_account_age;
  if v_buyer_account_age < 7 then
    return json_build_object('success', false, 'error', 'ACCOUNT_TOO_NEW');
  end if;

  select * into v_key from public.key_instances where id = v_listing.key_instance_id for update;

  if v_key.status != 'listed' then
    return json_build_object('success', false, 'error', 'KEY_NOT_LISTED');
  end if;

  if v_key.cashout_available_at > now() then
    return json_build_object('success', false, 'error', 'CASHOUT_LOCKED');
  end if;

  -- Execute purchase
  update public.key_instances
  set owner_id = p_buyer_id, status = 'active', updated_at = now()
  where id = v_listing.key_instance_id;

  update public.key_marketplace_listings
  set status = 'sold', purchased_by = p_buyer_id, sold_at = now()
  where id = p_listing_id;

  insert into public.key_transactions (key_instance_id, actor_id, from_user_id, to_user_id, action, value)
  values (v_listing.key_instance_id, p_buyer_id, v_listing.seller_id, p_buyer_id, 'purchased', v_key.value);

  return json_build_object('success', true, 'key_instance_id', v_listing.key_instance_id, 'price', v_listing.price);
end;
$$;

-- Get user's keys (private view with values)
create or replace function public.get_user_keys_private(p_user_id uuid)
returns json language sql stable as $$
  select coalesce(json_agg(json_build_object(
    'id', id,
    'key_letter', key_letter,
    'rarity', rarity,
    'value', value,
    'status', status,
    'received_at', received_at,
    'cashout_available_at', cashout_available_at,
    'is_key_to_city', is_key_to_city,
    'is_transferable', is_transferable,
    'source', source
  ) order by created_at desc), '[]'::json)
  from public.key_instances
  where owner_id = p_user_id;
$$;

-- Get public keys view (no values)
create or replace function public.get_user_keys_public(p_user_id uuid)
returns json language sql stable as $$
  select coalesce(json_agg(json_build_object(
    'id', id,
    'key_letter', key_letter,
    'rarity', rarity,
    'status', status,
    'received_at', received_at,
    'is_key_to_city', is_key_to_city
  ) order by created_at desc), '[]'::json)
  from public.key_instances
  where owner_id = p_user_id;
$$;

-- Get key supply statistics
create or replace function public.get_key_supply_stats()
returns json language sql stable as $$
  select coalesce(json_agg(json_build_object(
    'rarity', rarity,
    'total_supply', total_supply,
    'keys_issued', keys_issued,
    'keys_remaining', keys_remaining,
    'legendary_issued', legendary_issued,
    'legendary_limit', legendary_limit,
    'key_to_city_issued', key_to_city_issued,
    'key_to_city_limit', key_to_city_limit
  ) order by rarity), '[]'::json)
  from public.key_supply;
$$;

-- Get key with verified value (for trade participants)
create or replace function public.get_key_verified_value(p_key_instance_id uuid, p_user_id uuid)
returns json language sql stable as $$
  select json_build_object(
    'id', id,
    'key_letter', key_letter,
    'rarity', rarity,
    'value', value,
    'status', status,
    'cashout_available_at', cashout_available_at,
    'is_key_to_city', is_key_to_city
  )
  from public.key_instances
  where id = p_key_instance_id
    and (owner_id = p_user_id
         or exists (select 1 from public.key_trade_items where key_instance_id = p_key_instance_id and offered_by_user_id = p_user_id)
         or exists (select 1 from public.key_marketplace_listings where key_instance_id = p_key_instance_id and seller_id = p_user_id));
$$;

-- Cancel marketplace listing
create or replace function public.cancel_key_listing(p_listing_id uuid, p_user_id uuid)
returns json language plpgsql as $$
declare
  v_listing public.key_marketplace_listings%rowtype;
begin
  select * into v_listing from public.key_marketplace_listings where id = p_listing_id for update;

  if not found then
    return json_build_object('success', false, 'error', 'LISTING_NOT_FOUND');
  end if;

  if v_listing.seller_id != p_user_id then
    return json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  end if;

  if v_listing.status != 'active' then
    return json_build_object('success', false, 'error', 'LISTING_NOT_ACTIVE');
  end if;

  update public.key_marketplace_listings set status = 'cancelled' where id = p_listing_id;
  update public.key_instances set status = 'active', updated_at = now() where id = v_listing.key_instance_id;

  insert into public.key_transactions (key_instance_id, actor_id, from_user_id, to_user_id, action, value)
  values (v_listing.key_instance_id, p_user_id, p_user_id, null, 'listed_cancelled', (select value from public.key_instances where id = v_listing.key_instance_id));

  return json_build_object('success', true);
end;
$$;

-- Cancel trade request
create or replace function public.cancel_trade_request(p_trade_request_id uuid, p_user_id uuid)
returns json language plpgsql as $$
declare
  v_trade public.key_trade_requests%rowtype;
begin
  select * into v_trade from public.key_trade_requests where id = p_trade_request_id for update;

  if not found then
    return json_build_object('success', false, 'error', 'TRADE_NOT_FOUND');
  end if;

  if v_trade.from_user_id != p_user_id then
    return json_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  end if;

  if v_trade.status != 'pending' then
    return json_build_object('success', false, 'error', 'TRADE_NOT_PENDING');
  end if;

  update public.key_trade_requests set status = 'cancelled' where id = p_trade_request_id;

  return json_build_object('success', true);
end;
$$;

-- Admin: seed a key directly (for testing/special events)
create or replace function public.admin_seed_key(p_user_id uuid, p_letter text, p_rarity text, p_value numeric)
returns json language plpgsql as $$
declare
  v_admin_id uuid;
  v_key_id uuid;
  v_definition public.key_definitions%rowtype;
begin
  select auth.uid() into v_admin_id;

  if not exists (
    select 1 from public.user_profiles
    where id = v_admin_id and (is_admin = true or role in ('admin','superadmin','ceo'))
  ) then
    return json_build_object('success', false, 'error', 'NOT_ADMIN');
  end if;

  select * into v_definition from public.key_definitions where key_letter = p_letter and rarity = p_rarity limit 1;

  if not found then
    return json_build_object('success', false, 'error', 'DEFINITION_NOT_FOUND');
  end if;

  insert into public.key_instances (
    definition_id, key_letter, rarity, value, owner_id,
    cashout_available_at, status, source, is_transferable, is_key_to_city
  ) values (
    v_definition.id, p_letter, p_rarity, p_value, p_user_id,
    now() + interval '14 days', 'active', 'admin', true, false
  ) returning id into v_key_id;

  insert into public.key_transactions (key_instance_id, actor_id, from_user_id, to_user_id, action, value)
  values (v_key_id, v_admin_id, null, p_user_id, 'received', p_value);

  return json_build_object('success', true, 'key_instance_id', v_key_id);
end;
$$;
