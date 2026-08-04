-- Add user-provided Cash App tag to manual orders for verification
alter table if exists public.manual_coin_orders
  add column if not exists payer_cashtag text;

create index if not exists idx_manual_orders_payer_tag on public.manual_coin_orders(payer_cashtag);

-- Keep ledger metadata in sync with new column
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
          jsonb_build_object('admin_id', p_admin_id, 'amount_cents', v_order.amount_cents, 'payer_cashtag', v_order.payer_cashtag));

  -- finalize
  update public.manual_coin_orders set status = 'fulfilled', fulfilled_at = now() where id = p_order_id;

  return query select true, v_balance, null::text;
end;
$$;

revoke all on function public.approve_manual_order(uuid, uuid, text) from public;
grant execute on function public.approve_manual_order(uuid, uuid, text) to service_role;
