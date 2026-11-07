-- =========================================================================
-- Migration: Key Daily Limit — One key per calendar day per user
-- Date: 2026-11-07
-- =========================================================================

-- Add daily limit check to award_key_to_user: one broadcast key per calendar day
create or replace function public.award_key_to_user(p_user_id uuid)
returns json language plpgsql as $$
declare
  v_definition public.key_definitions%rowtype;
  v_key_instance_id uuid;
  v_value numeric;
  v_supply_row public.key_supply%rowtype;
  v_account_age integer;
  v_daily_count integer;
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

  -- Check daily limit: one key per calendar day per user from broadcast awards
  select count(*) into v_daily_count
  from public.key_transactions kt
  where kt.to_user_id = p_user_id
    and kt.action = 'received'
    and kt.from_user_id is null
    and kt.created_at >= date_trunc('day', now())
    and kt.created_at < date_trunc('day', now()) + interval '1 day';

  if v_daily_count > 0 then
    return json_build_object('success', false, 'error', 'DAILY_LIMIT_REACHED', 'message', 'You already received a key today. Try again next time.');
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
