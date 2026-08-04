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

-- Policy might already exist if I am unlucky with partial apply, so check or just use IF NOT EXISTS workaround via DO block or just let it fail if it exists?
-- Better to use safe SQL.
do $$
begin
  if not exists (
    select from pg_policies where tablename = 'troll_wall_gifts' and policyname = 'Users can view all wall gifts'
  ) then
    create policy "Users can view all wall gifts" on public.troll_wall_gifts
        for select using (true);
  end if;
end
$$;

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
