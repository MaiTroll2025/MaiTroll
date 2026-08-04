-- Create backend RPC for featured promotion purchases
create or replace function public.buy_featured_promotion(
  p_feature_type text,
  p_target_id uuid,
  p_duration_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price integer;
  v_interval interval;
  v_active_until timestamptz;
  v_current_balance bigint;
  v_new_balance bigint;
  v_system_user_id uuid;
  v_post_user_id uuid;
  v_auction_table_exists boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  p_feature_type := lower(trim(p_feature_type));
  p_duration_key := lower(trim(p_duration_key));

  if p_duration_key in ('24h', '24_hours', '24 hours') then
    v_price := 500;
    v_interval := interval '24 hours';
  elsif p_duration_key in ('48h', '48_hours', '48 hours') then
    v_price := 1000;
    v_interval := interval '48 hours';
  elsif p_duration_key in ('1w', '1_week', 'week', '7d', '7 days', '168h') then
    v_price := 2000;
    v_interval := interval '7 days';
  else
    raise exception 'Invalid duration package: %', p_duration_key;
  end if;

  v_active_until := now() + v_interval;

  select coalesce(troll_coins, 0)
  into v_current_balance
  from public.user_profiles
  where id = v_user_id
  for update;

  if v_current_balance is null then
    raise exception 'Profile not found';
  end if;

  if v_current_balance < v_price then
    raise exception 'Not enough Troll Coins. Required %, available %', v_price, v_current_balance;
  end if;

  v_new_balance := v_current_balance - v_price;

  update public.user_profiles
  set
    troll_coins = v_new_balance,
    paid_coin_balance = greatest(coalesce(paid_coin_balance, 0) - v_price, 0)
  where id = v_user_id;

  insert into public.coin_transactions (
    user_id,
    type,
    amount,
    coin_delta,
    description,
    metadata,
    source_type,
    source_id,
    balance_after,
    status,
    coin_type,
    reason,
    idempotency_key
  )
  values (
    v_user_id,
    'featured_promotion_purchase',
    -v_price,
    -v_price,
    format('Featured promotion purchase: %s for %s', p_feature_type, p_duration_key),
    jsonb_build_object(
      'feature_type', p_feature_type,
      'target_id', p_target_id,
      'duration_key', p_duration_key,
      'price_coins', v_price,
      'active_until', v_active_until
    ),
    p_feature_type,
    p_target_id::text,
    v_new_balance,
    'completed',
    'paid',
    'featured_promotion_purchase',
    format('featured_promotion:%s:%s:%s:%s', v_user_id, p_feature_type, p_target_id, extract(epoch from now())::text)
  );

  if p_feature_type = 'broadcast' then
    update public.streams
    set
      is_featured = true,
      boosted_until = v_active_until,
      featured_at = now(),
      featured_by = v_user_id
    where id = p_target_id
      and user_id = v_user_id;

    if not found then
      raise exception 'Featured broadcast not found or not owned by user';
    end if;

    select id into v_system_user_id
    from public.user_profiles
    where lower(username) = 'system'
    limit 1;

    v_post_user_id := coalesce(v_system_user_id, v_user_id);

    insert into public.troll_wall_posts (
      user_id,
      post_type,
      content,
      metadata,
      is_pinned,
      is_system_generated,
      system_actor,
      actor_user_id,
      stream_id,
      activity_type,
      expires_at
    )
    values (
      v_post_user_id,
      'system_featured_broadcast',
      format('🔥 Featured Broadcast is now live in Mai Troll! A broadcaster just boosted their stream until %s', to_char(v_active_until, 'Mon DD, YYYY HH12:MI AM')),
      jsonb_build_object(
        'system_generated', true,
        'source', 'Mai Troll System',
        'feature_type', 'broadcast',
        'stream_id', p_target_id,
        'active_until', v_active_until
      ),
      false,
      true,
      'Mai Troll System',
      v_user_id,
      p_target_id,
      'featured_broadcast',
      v_active_until
    );

  elsif p_feature_type = 'podcast' then
    update public.podcasts
    set
      is_featured = true,
      featured_until = v_active_until
    where id = p_target_id
      and user_id = v_user_id;

    if not found then
      raise exception 'Podcast not found or not owned by user';
    end if;

  elsif p_feature_type in ('post', 'wall', 'troll_wall') then
    update public.troll_wall_posts
    set
      is_pinned = true,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'is_featured', true,
        'featured_until', v_active_until,
        'featured_by', v_user_id,
        'feature_type', 'post'
      )
    where id = p_target_id
      and user_id = v_user_id;

    if not found then
      raise exception 'Troll Wall post not found or not owned by user';
    end if;

  elsif p_feature_type = 'auction' then
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'auction_shows'
    ) into v_auction_table_exists;

    if not v_auction_table_exists then
      raise exception 'Live auction feature needs the auction_shows table wired before purchase can activate';
    end if;

    update public.auction_shows
    set
      is_featured = true,
      featured_until = v_active_until
    where id = p_target_id
      and auctioneer_id = v_user_id;

    if not found then
      raise exception 'Auction not found or not owned by user';
    end if;

  else
    raise exception 'Invalid feature type: %', p_feature_type;
  end if;

  return jsonb_build_object(
    'success', true,
    'feature_type', p_feature_type,
    'target_id', p_target_id,
    'price_coins', v_price,
    'active_until', v_active_until,
    'new_balance', v_new_balance
  );
end;
$$;

grant execute on function public.buy_featured_promotion(text, uuid, text) to authenticated;
