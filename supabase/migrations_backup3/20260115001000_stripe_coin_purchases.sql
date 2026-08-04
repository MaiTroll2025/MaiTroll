-- Stripe coin package setup

create extension if not exists "pgcrypto";

-- Ensure wallets table exists for coin balances
create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coin_balance integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Add Stripe fields to coin_packages if table is present
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'coin_packages'
  ) INTO v_exists;

  IF v_exists THEN
    ALTER TABLE public.coin_packages
      ADD COLUMN IF NOT EXISTS stripe_price_id text,
      ADD COLUMN IF NOT EXISTS amount_cents integer;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_packages' AND column_name = 'price_usd') THEN
      EXECUTE 'UPDATE public.coin_packages SET amount_cents = round((price_usd * 100))::int WHERE amount_cents IS NULL AND price_usd IS NOT NULL';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_packages' AND column_name = 'price') THEN
      EXECUTE 'UPDATE public.coin_packages SET amount_cents = round((price * 100))::int WHERE amount_cents IS NULL AND price IS NOT NULL';
    END IF;
  END IF;
END $$;

-- Coin orders for Stripe purchases (gracefully handle missing coin_packages table)
DO $$
DECLARE
  v_packages boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'coin_packages'
  ) INTO v_packages;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'coin_orders'
  ) THEN
    CREATE TABLE public.coin_orders (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      package_id uuid,
      coins integer not null,
      amount_cents integer not null,
      status text not null default 'created',
      stripe_checkout_session_id text not null,
      stripe_payment_intent_id text,
      paid_at timestamp with time zone,
      fulfilled_at timestamp with time zone,
      created_at timestamp with time zone not null default now(),
      updated_at timestamp with time zone not null default now(),
      constraint coin_orders_status_check check (status in ('created', 'paid', 'fulfilled', 'canceled', 'failed'))
    );
  END IF;

  IF v_packages THEN
    BEGIN
      ALTER TABLE public.coin_orders
        ADD CONSTRAINT coin_orders_package_fk
        FOREIGN KEY (package_id) REFERENCES public.coin_packages(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

create unique index if not exists coin_orders_stripe_session_id_key
  on public.coin_orders(stripe_checkout_session_id);

create index if not exists coin_orders_user_id_idx
  on public.coin_orders(user_id);

-- Simple updated_at trigger
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_coin_orders_touch_updated
before update on public.coin_orders
for each row execute function public.fn_touch_updated_at();

create trigger trg_wallets_touch_updated
before update on public.wallets
for each row execute function public.fn_touch_updated_at();

-- Stripe customers table
create table if not exists public.stripe_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists stripe_customers_customer_id_key
  on public.stripe_customers(stripe_customer_id);

-- Extend user_payment_methods for Stripe if table exists
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_payment_methods'
  ) INTO v_exists;

  IF v_exists THEN
    ALTER TABLE public.user_payment_methods
      ADD COLUMN IF NOT EXISTS stripe_customer_id text,
      ADD COLUMN IF NOT EXISTS stripe_payment_method_id text;
  END IF;
END $$;

-- RPC to credit coins (idempotent)
create or replace function public.credit_coins(
  p_user_id uuid,
  p_coins integer,
  p_order_id uuid
) returns table (success boolean, new_balance integer, error_message text)
language plpgsql
security definer
as $$
declare
  v_order public.coin_orders%rowtype;
  v_balance integer;
begin
  select * into v_order
  from public.coin_orders
  where id = p_order_id
  for update;

  if not found then
    return query select false, null::integer, 'order not found';
    return;
  end if;

  if v_order.user_id <> p_user_id then
    return query select false, null::integer, 'user mismatch';
    return;
  end if;

  if v_order.status <> 'paid' then
    if v_order.status = 'fulfilled' then
      select coin_balance into v_balance from public.wallets where user_id = p_user_id;
      return query select true, v_balance, null::text;
      return;
    end if;
    return query select false, null::integer, 'order not paid';
    return;
  end if;

  update public.wallets
  set coin_balance = coin_balance + p_coins
  where user_id = p_user_id
  returning coin_balance into v_balance;

  if not found then
    insert into public.wallets (user_id, coin_balance)
    values (p_user_id, p_coins)
    returning coin_balance into v_balance;
  end if;

  update public.coin_orders
  set status = 'fulfilled',
      fulfilled_at = now()
  where id = p_order_id;

  return query select true, v_balance, null::text;
end;
$$;

revoke all on function public.credit_coins(uuid, integer, uuid) from public;
grant execute on function public.credit_coins(uuid, integer, uuid) to service_role;
