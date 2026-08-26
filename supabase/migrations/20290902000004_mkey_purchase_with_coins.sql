-- =========================================================================
-- Migration: MAITROLL MKEY PURCHASE WITH COINS
-- Date: 2026-09-02
--
-- Lets any user (broadcaster OR viewer) buy MKeys by spending troll_coins.
--   1 MKey = mkey_coin_price_per_key troll_coins (default 10)
--
-- Accounting:
--   - coins are deducted from user_profiles.troll_coins (locked row)
--   - a coin_transactions ledger row is written (mirrors other coin spends)
--   - available_mkeys is credited
--   - an mkey_transactions ledger row (type 'purchase') is written
--
-- Fully server-authoritative, SECURITY DEFINER, like the rest of the MKey
-- system. The client never sets a balance or credits itself.
-- =========================================================================

-- Price config (single-row mkey_config table already exists).
alter table public.mkey_config
  add column if not exists mkey_coin_price_per_key integer not null default 10;

comment on column public.mkey_config.mkey_coin_price_per_key is
  'Troll coins charged per MKey when buying MKeys with coins.';

-- =========================================================================
-- RPC: mkey_purchase_with_coins
-- =========================================================================

create or replace function public.mkey_purchase_with_coins(p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price integer;
  v_coin_cost integer;
  v_balance integer;
  v_available integer;
  v_result jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  if p_amount is null or p_amount < 1 then
    return jsonb_build_object('success', false, 'error', 'invalid_amount');
  end if;

  -- Read the server-tunable price.
  select mkey_coin_price_per_key
  into v_price
  from public.mkey_config
  limit 1;

  v_price := coalesce(v_price, 10);
  v_coin_cost := p_amount * v_price;

  -- Lock the wallet row so the coin deduction + mkey credit are atomic.
  select troll_coins, available_mkeys
  into v_balance, v_available
  from public.user_profiles
  where id = v_user_id
  for update;

  if v_balance is null then
    return jsonb_build_object('success', false, 'error', 'user_not_found');
  end if;

  if v_balance < v_coin_cost then
    return jsonb_build_object(
      'success', false,
      'error', 'insufficient_coins',
      'coin_cost', v_coin_cost,
      'balance', v_balance
    );
  end if;

  -- Deduct coins.
  update public.user_profiles
  set troll_coins = troll_coins - v_coin_cost
  where id = v_user_id;

  -- Ledger the coin spend.
  insert into public.coin_transactions (user_id, amount, type, description, metadata)
  values (
    v_user_id,
    -v_coin_cost,
    'purchase',
    'MKey purchase',
    jsonb_build_object('mkeys', p_amount, 'price_per_key', v_price)
  );

  -- Credit MKeys.
  update public.user_profiles
  set available_mkeys = available_mkeys + p_amount
  where id = v_user_id;

  -- Ledger the MKey purchase.
  insert into public.mkey_transactions (
    user_id, amount, transaction_type, status, metadata
  )
  values (
    v_user_id,
    p_amount,
    'purchase',
    'completed',
    jsonb_build_object('coin_cost', v_coin_cost, 'price_per_key', v_price)
  );

  select available_mkeys
  into v_available
  from public.user_profiles
  where id = v_user_id;

  v_result := jsonb_build_object(
    'success', true,
    'mkeys_purchased', p_amount,
    'coin_cost', v_coin_cost,
    'available', v_available,
    'balance', v_balance - v_coin_cost
  );

  return v_result;
end;
$$;

comment on function public.mkey_purchase_with_coins(integer) is
  'Buy MKeys by spending troll_coins. Atomic coin deduction + MKey credit.';
