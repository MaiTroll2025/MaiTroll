-- Migration: Add troll_bank_spend_coins RPC and update sync trigger
-- Description: Adds a centralized spending function that ensures ledger consistency and balance checks.

-- 1. Create the spending RPC
create or replace function troll_bank_spend_coins(
  p_user_id uuid,
  p_amount int,
  p_bucket text default 'paid', -- usually 'paid' for spending, but could be 'promo' if we track that
  p_source text default 'purchase',
  p_ref_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_balance int;
  v_new_balance int;
  v_ledger_id uuid;
begin
  -- Validate amount
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;

  -- Lock user profile and check balance
  select troll_coins into v_current_balance
  from user_profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'User not found');
  end if;

  if v_current_balance < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient funds', 'current_balance', v_current_balance);
  end if;

  -- Deduct coins
  v_new_balance := v_current_balance - p_amount;
  
  update user_profiles
  set troll_coins = v_new_balance
  where id = p_user_id;

  -- Insert into ledger (negative delta)
  insert into coin_ledger (
    user_id,
    delta,
    bucket,
    source,
    ref_id,
    metadata,
    direction
  ) values (
    p_user_id,
    -p_amount,
    p_bucket,
    p_source,
    p_ref_id,
    p_metadata,
    'out'
  ) returning id into v_ledger_id;

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id
  );
end;
$$;

-- 2. Grant permissions
grant execute on function troll_bank_spend_coins(uuid, int, text, text, text, jsonb) to service_role;
grant execute on function troll_bank_spend_coins(uuid, int, text, text, text, jsonb) to postgres;
-- Allow authenticated users to call it? No, usually spending is done via specific edge functions or wrapped RPCs.
-- But legacy deductCoins calls it from client.
-- If we want to replace deduct_user_troll_coins called from client (if RLS allows), we might need to grant it.
-- However, strict security suggests spending should be server-side or carefully controlled.
-- For now, let's keep it restricted to service_role/postgres and update edge functions/RPC wrappers.
-- Wait, coinTransactions.ts calls `deduct_user_troll_coins` via `sb.rpc`. If `sb` is client-side, it needs permission.
-- The current `deduct_user_troll_coins` is likely public/authenticated.
-- To minimize breakage, we should probably allow authenticated, but rely on RLS if possible?
-- RPCs run with security definer usually bypass RLS on the tables they touch, but we can check `auth.uid()`.
-- Let's add an auth check if called by user.

create or replace function troll_bank_spend_coins_secure(
  p_user_id uuid,
  p_amount int,
  p_bucket text default 'paid',
  p_source text default 'purchase',
  p_ref_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
as $$
begin
  -- Check if caller is the user or service role
  if auth.uid() != p_user_id and auth.role() != 'service_role' then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  return troll_bank_spend_coins(p_user_id, p_amount, p_bucket, p_source, p_ref_id, p_metadata);
end;
$$;

grant execute on function troll_bank_spend_coins_secure(uuid, int, text, text, text, jsonb) to authenticated;
grant execute on function troll_bank_spend_coins_secure(uuid, int, text, text, text, jsonb) to service_role;

