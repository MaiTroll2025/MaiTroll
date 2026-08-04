-- Ensure troll_wall_gifts table exists
create table if not exists public.troll_wall_gifts (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.troll_wall_posts(id) on delete cascade,
    sender_id uuid not null references auth.users(id) on delete cascade,
    gift_type text not null,
    quantity integer not null default 1,
    coin_cost integer not null default 0,
    created_at timestamptz not null default now()
);

alter table public.troll_wall_gifts enable row level security;

create policy "Users can view all wall gifts" on public.troll_wall_gifts
    for select using (true);

-- Clean up any existing approve_manual_order variants to avoid return type conflicts
do $$
declare
  r record;
begin
  for r in
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'approve_manual_order'
  loop
    execute format('drop function if exists %s;', r.signature);
  end loop;
end;
$$;
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
  v_recipient_profile record;
  v_tx_id uuid;
  v_purchase_type text;
  v_troll_pass_expires_at timestamptz;
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

  v_purchase_type := coalesce(v_order.metadata->>'purchase_type', '');

  update public.manual_coin_orders
    set status = 'paid', paid_at = now(), external_tx_id = coalesce(p_external_tx_id, external_tx_id)
    where id = p_order_id;

  update public.wallets set coin_balance = coin_balance + v_order.coins where user_id = v_order.user_id returning coin_balance into v_balance;
  if not found then
    insert into public.wallets (user_id, coin_balance) values (v_order.user_id, v_order.coins) returning coin_balance into v_balance;
  end if;

  if v_purchase_type = 'troll_pass' then
    v_troll_pass_expires_at := public.apply_troll_pass_bundle(v_order.user_id);
    update public.user_profiles
      set paid_coins = coalesce(paid_coins, 0) + v_order.coins,
          total_earned_coins = coalesce(total_earned_coins, 0) + v_order.coins
      where id = v_order.user_id;
  else
    update public.user_profiles
      set troll_coins = coalesce(troll_coins, 0) + v_order.coins,
          paid_coins = coalesce(paid_coins, 0) + v_order.coins,
          total_earned_coins = coalesce(total_earned_coins, 0) + v_order.coins
      where id = v_order.user_id;
  end if;

  insert into public.wallet_transactions (user_id, type, currency, amount, reason, source, reference_id, metadata)
  values (v_order.user_id, 'manual_purchase', 'troll_coins', v_order.coins, 'Cash App purchase', 'cashapp', v_order.id,
          jsonb_build_object('admin_id', p_admin_id, 'amount_cents', v_order.amount_cents, 'payer_cashtag', v_order.payer_cashtag));

  insert into public.coin_transactions (user_id, amount, type, description, metadata)
  values (
    v_order.user_id,
    v_order.coins,
    'store_purchase',
    'Manual Cash App purchase',
    jsonb_build_object('source', 'cashapp_manual', 'order_id', v_order.id, 'amount_cents', v_order.amount_cents, 'payer_cashtag', v_order.payer_cashtag)
  )
  returning id into v_tx_id;

  update public.manual_coin_orders set status = 'fulfilled', fulfilled_at = now() where id = p_order_id;

  return query select true, v_balance, null::text;
end;
$$;

revoke all on function public.approve_manual_order(uuid, uuid, text) from public;
grant execute on function public.approve_manual_order(uuid, uuid, text) to service_role;


-- Troll Wall gift fix: use troll_coins and log transactions
create or replace function public.send_wall_post_gift(
  p_post_id uuid,
  p_gift_type text,
  p_quantity integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_gift_cost integer;
  v_sender_coins integer;
  v_post_owner_id uuid;
  v_receiver_reward integer;
  v_tx_sender uuid;
  v_tx_receiver uuid;
  v_default_cost integer := 10;
  v_safe_quantity integer;
begin
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;

  v_safe_quantity := greatest(1, p_quantity);

  select coin_cost into v_gift_cost from gifts where lower(name) = lower(p_gift_type) limit 1;
  if v_gift_cost is null then
    v_gift_cost := v_default_cost;
  end if;
  v_gift_cost := v_gift_cost * v_safe_quantity;

  select troll_coins into v_sender_coins from user_profiles where id = v_sender_id;
  if coalesce(v_sender_coins, 0) < v_gift_cost then
    return jsonb_build_object('success', false, 'error', 'Insufficient coins', 'required', v_gift_cost, 'available', coalesce(v_sender_coins,0));
  end if;

  select user_id into v_post_owner_id from troll_wall_posts where id = p_post_id;
  if v_post_owner_id is null then
    return jsonb_build_object('success', false, 'error', 'Post not found');
  end if;

  -- deduct sender balance
  update user_profiles set troll_coins = coalesce(troll_coins,0) - v_gift_cost where id = v_sender_id;

  -- credit receiver 80%
  v_receiver_reward := floor(v_gift_cost * 0.8);
  update user_profiles set troll_coins = coalesce(troll_coins,0) + v_receiver_reward where id = v_post_owner_id;

  insert into troll_wall_gifts (post_id, sender_id, gift_type, quantity, coin_cost)
  values (p_post_id, v_sender_id, p_gift_type, v_safe_quantity, v_gift_cost);

  -- coin transaction logs
  insert into coin_transactions (user_id, amount, type, description, metadata)
    values (v_sender_id, -v_gift_cost, 'gift_sent_wall', 'Gift sent on wall post', jsonb_build_object('post_id', p_post_id, 'gift_type', p_gift_type, 'quantity', v_safe_quantity, 'receiver_id', v_post_owner_id))
    returning id into v_tx_sender;
  insert into coin_transactions (user_id, amount, type, description, metadata)
    values (v_post_owner_id, v_receiver_reward, 'gift_received_wall', 'Gift received on wall post', jsonb_build_object('post_id', p_post_id, 'gift_type', p_gift_type, 'quantity', v_safe_quantity, 'sender_id', v_sender_id))
    returning id into v_tx_receiver;

  return jsonb_build_object(
    'success', true,
    'gift_type', p_gift_type,
    'quantity', v_safe_quantity,
    'total_cost', v_gift_cost,
    'sender_coins', coalesce(v_sender_coins,0) - v_gift_cost,
    'receiver_reward', v_receiver_reward,
    'tx_sender', v_tx_sender,
    'tx_receiver', v_tx_receiver
  );
end;
$$;

grant execute on function public.send_wall_post_gift(uuid, text, integer) to authenticated, service_role;


-- Troll Wall pin toggle (owner or staff)
create or replace function public.toggle_wall_post_pin(
  p_post_id uuid,
  p_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_pinned boolean;
  v_owner uuid;
  v_role text;
  v_is_admin boolean;
  v_is_secretary boolean;
  v_troll_role text;
  v_is_lead_officer boolean;
  v_can_pin boolean;
begin
  select is_pinned, user_id into v_is_pinned, v_owner from troll_wall_posts where id = p_post_id;
  if not found then
    raise exception 'Post not found';
  end if;

  select 
    role, 
    is_admin, 
    (troll_role = 'secretary') as is_secretary,
    troll_role,
    coalesce(is_lead_officer, false)
  into 
    v_role, 
    v_is_admin, 
    v_is_secretary,
    v_troll_role,
    v_is_lead_officer
  from user_profiles where id = p_user_id;

  v_can_pin := 
    p_user_id = v_owner
    or coalesce(v_is_admin, false)
    or coalesce(v_role, '') in ('admin','secretary','lead_troll_officer')
    or coalesce(v_troll_role, '') in ('secretary','lead_troll_officer','troll_officer')
    or v_is_lead_officer;

  if not v_can_pin then
    raise exception 'Forbidden';
  end if;

  update troll_wall_posts set is_pinned = not coalesce(v_is_pinned, false) where id = p_post_id returning is_pinned into v_is_pinned;
  return v_is_pinned;
end;
$$;

grant execute on function public.toggle_wall_post_pin(uuid, uuid) to authenticated, service_role;
