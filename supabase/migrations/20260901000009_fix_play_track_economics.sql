-- ============================================================================
-- Migration: Fix play_mai_track cost and split, remove bad trigger
-- Date: 2026-08-18
-- Purpose: Change play cost from 2 to 1 troll coin, split 0.5 artist /
--          0.5 admin. Remove trg_sync_trollstown_coins trigger since
--          trollstown no longer exists and it references NEW.user_id
--          which doesn't exist on user_profiles.
-- ============================================================================

-- Drop the bad trigger and its function
DROP TRIGGER IF EXISTS trg_sync_trollstown_coins ON public.user_profiles;
DROP FUNCTION IF EXISTS public.sync_trollstown_coins_from_profiles();

-- Replace play_mai_track with correct economics
create or replace function public.play_mai_track(
  p_track_id uuid,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
set search_path = ''
security definer
as $$
declare
  v_track record;
  v_artist record;
  v_contract record;
  v_listener record;
  v_admin_id uuid;
  v_play_count bigint;
  v_listen_cost integer := 1;
  v_artist_amount numeric(4,2) := 0.5;
  v_admin_amount numeric(4,2) := 0.5;
  v_transaction_id uuid;
  v_now timestamptz := now();
  v_auth_uid uuid;
begin
  select auth.uid() into v_auth_uid;

  if p_user_id is not null and p_user_id != v_auth_uid then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  select * into v_track from public.record_label_tracks where id = p_track_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Track not found');
  end if;

  select * into v_artist from public.record_label_artist_profiles where id = v_track.artist_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Artist not found');
  end if;

  select * into v_contract
  from public.record_label_contracts
  where artist_id = v_track.artist_id
    and status in ('pending_signature', 'active')
  order by created_at desc
  limit 1;
  if not found then
    return jsonb_build_object('success', false, 'error', 'No active contract found');
  end if;

  if v_auth_uid is not null then
    select * into v_listener from public.user_profiles where id = v_auth_uid for update;
    if not found then
      return jsonb_build_object('success', false, 'error', 'User not found');
    end if;

    if v_listener.troll_coins < v_listen_cost then
      return jsonb_build_object('success', false, 'error', 'Insufficient troll coins. Cost: ' || v_listen_cost);
    end if;

    update public.user_profiles
    set troll_coins = troll_coins - v_listen_cost,
        total_spent_coins = total_spent_coins + v_listen_cost,
        updated_at = v_now
    where id = v_auth_uid;
  end if;

  update public.record_label_artist_balances
  set available_coins = available_coins + v_artist_amount,
      lifetime_artist_coins = lifetime_artist_coins + v_artist_amount,
      lifetime_gross_coins = lifetime_gross_coins + v_listen_cost,
      updated_at = v_now
  where artist_id = v_track.artist_id;

  select id into v_admin_id
  from public.user_profiles
  where role in ('admin', 'ceo', 'superadmin')
  limit 1;

  if v_admin_id is not null then
    update public.user_profiles
    set troll_coins = troll_coins + v_admin_amount,
        updated_at = v_now
    where id = v_admin_id;
  end if;

  update public.record_label_tracks
  set play_count = play_count + 1,
      updated_at = v_now
  where id = p_track_id
  returning play_count into v_play_count;

  insert into public.record_label_transactions (
    artist_id, track_id, contract_id, payer_user_id,
    transaction_type, gross_coins, artist_split_bps, label_split_bps,
    artist_coins, label_coins, cashout_eligible, status, metadata
  ) values (
    v_track.artist_id, p_track_id, v_contract.id, v_auth_uid,
    'track_revenue', v_listen_cost, 5000, 5000,
    v_artist_amount, v_admin_amount, true, 'completed',
    jsonb_build_object(
      'source', 'track_play',
      'contract_tier', v_contract.tier,
      'contract_number', v_contract.contract_number
    )
  ) returning id into v_transaction_id;

  return jsonb_build_object(
    'success', true,
    'play_count', v_play_count,
    'listener_paid', v_listen_cost,
    'artist_earned', v_artist_amount,
    'admin_earned', v_admin_amount
  );
end;
$$;

grant execute on function public.play_mai_track(uuid, uuid) to authenticated;

NOTIFY pgrst, 'reload schema';
