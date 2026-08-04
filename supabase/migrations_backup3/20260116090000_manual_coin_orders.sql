-- Manual coin orders for Cash App payments

create table if not exists public.manual_coin_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  package_id uuid,
  coins integer not null,
  amount_cents integer not null,
  provider text not null default 'cashapp',
  cashapp_cashtag text not null default '$Mai Troll95',
  note_suggested text,
  external_tx_id text,
  status text not null default 'pending', -- pending, paid, fulfilled, canceled
  paid_at timestamptz,
  fulfilled_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint manual_coin_orders_status_check check (status in ('pending','paid','fulfilled','canceled'))
);

create index if not exists idx_manual_orders_user on public.manual_coin_orders(user_id);
create index if not exists idx_manual_orders_status on public.manual_coin_orders(status);

-- Ensure wallet_transactions exists for ledger inserts
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  currency text not null default 'troll_coins',
  amount integer not null,
  reason text,
  source text,
  reference_id uuid,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- RLS: allow users to view/insert their own orders
alter table public.manual_coin_orders enable row level security;

DO $$ BEGIN
  CREATE POLICY "manual_orders_select_own" ON public.manual_coin_orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "manual_orders_insert_own" ON public.manual_coin_orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Touch updated_at trigger reuse
DO $$ BEGIN
  CREATE TRIGGER trg_manual_orders_touch_updated
  BEFORE UPDATE ON public.manual_coin_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: approve manual order and credit coins via wallet ledger
DROP FUNCTION IF EXISTS public.approve_manual_order(uuid, uuid, text);
create or replace function public.approve_manual_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_external_tx_id text
) returns table (success boolean, new_balance integer, error_message text)
language plpgsql
security definer
as $$
declare
  v_order public.manual_coin_orders%rowtype;
  v_balance integer;
begin
  select * into v_order from public.manual_coin_orders where id = p_order_id for update;
  if not found then
    return query select false, null::integer, 'order not found';
    return;
  end if;
  if v_order.status <> 'pending' then
    if v_order.status = 'fulfilled' then
      select coin_balance into v_balance from public.wallets where user_id = v_order.user_id;
      return query select true, v_balance, null::text;
      return;
    end if;
    return query select false, null::integer, 'invalid status';
    return;
  end if;

  -- mark paid
  update public.manual_coin_orders set status = 'paid', paid_at = now(), external_tx_id = coalesce(p_external_tx_id, external_tx_id)
  where id = p_order_id;

  -- credit coins
  update public.wallets set coin_balance = coin_balance + v_order.coins where user_id = v_order.user_id returning coin_balance into v_balance;
  if not found then
    insert into public.wallets (user_id, coin_balance) values (v_order.user_id, v_order.coins) returning coin_balance into v_balance;
  end if;

  -- ledger row
  insert into public.wallet_transactions (user_id, type, currency, amount, reason, source, reference_id, metadata)
  values (v_order.user_id, 'manual_purchase', 'troll_coins', v_order.coins, 'Cash App purchase', 'cashapp', v_order.id,
          jsonb_build_object('admin_id', p_admin_id, 'amount_cents', v_order.amount_cents));

  -- finalize
  update public.manual_coin_orders set status = 'fulfilled', fulfilled_at = now() where id = p_order_id;

  return query select true, v_balance, null::text;
end;
$$;

revoke all on function public.approve_manual_order(uuid, uuid, text) from public;
grant execute on function public.approve_manual_order(uuid, uuid, text) to service_role;
