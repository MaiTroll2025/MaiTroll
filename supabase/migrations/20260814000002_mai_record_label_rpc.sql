-- ============================================================
-- MAI RECORD LABEL RPC FUNCTIONS
-- Trusted server-side operations
-- ============================================================

-- ============================================================
-- APPROVE APPLICATION
-- ============================================================

create or replace function public.approve_mai_application(
  p_application_id uuid,
  p_reviewed_by uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_application record;
  v_artist_id uuid;
  v_contract_id uuid;
  v_now timestamptz := now();
  v_probation_ends timestamptz := now() + interval '30 days';
begin
  -- Lock and verify application
  select * into v_application
  from public.record_label_applications
  where id = p_application_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Application not found');
  end if;

  if v_application.status != 'pending' then
    return jsonb_build_object('success', false, 'error', 'Application is not pending');
  end if;

  -- Create artist profile
  insert into public.record_label_artist_profiles (
    user_id,
    application_id,
    stage_name,
    bio,
    primary_genre,
    genres,
    status
  ) values (
    v_application.user_id,
    p_application_id,
    v_application.stage_name,
    v_application.artist_bio,
    v_application.primary_genre,
    v_application.additional_genres,
    'probation'
  )
  returning id into v_artist_id;

  -- Update user profile
  update public.user_profiles
  set
    is_record_label_artist = true,
    record_label_artist_since = v_now,
    updated_at = v_now
  where id = v_application.user_id;

  -- Create probation contract
  insert into public.record_label_contracts (
    artist_id,
    application_id,
    tier,
    artist_split_bps,
    label_split_bps,
    effective_at,
    probation_ends_at,
    status,
    created_by,
    mai_accepted_at
  ) values (
    v_artist_id,
    p_application_id,
    'probation',
    5000,
    5000,
    v_now,
    v_probation_ends,
    'active',
    p_reviewed_by,
    v_now
  )
  returning id into v_contract_id;

  -- Create artist balance
  insert into public.record_label_artist_balances (
    artist_id,
    available_coins,
    pending_coins,
    lifetime_artist_coins,
    lifetime_gross_coins
  ) values (
    v_artist_id,
    0,
    0,
    0,
    0
  );

  -- Mark application approved
  update public.record_label_applications
  set
    status = 'approved',
    reviewed_by = p_reviewed_by,
    reviewed_at = v_now,
    updated_at = v_now
  where id = p_application_id;

  -- Create review audit entry
  insert into public.record_label_application_reviews (
    application_id,
    reviewed_by,
    decision,
    review_notes
  ) values (
    p_application_id,
    p_reviewed_by,
    'approved',
    'Application approved via RPC'
  );

  return jsonb_build_object(
    'success', true,
    'artist_id', v_artist_id,
    'contract_id', v_contract_id,
    'probation_ends_at', v_probation_ends
  );
end;
$$;

-- ============================================================
-- DECLINE APPLICATION
-- ============================================================

create or replace function public.decline_mai_application(
  p_application_id uuid,
  p_reviewed_by uuid,
  p_decline_reason text default null,
  p_review_notes text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_application record;
begin
  select * into v_application
  from public.record_label_applications
  where id = p_application_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Application not found');
  end if;

  if v_application.status != 'pending' then
    return jsonb_build_object('success', false, 'error', 'Application is not pending');
  end if;

  update public.record_label_applications
  set
    status = 'declined',
    reviewed_by = p_reviewed_by,
    reviewed_at = now(),
    decline_reason = p_decline_reason,
    review_notes = p_review_notes,
    updated_at = now()
  where id = p_application_id;

  insert into public.record_label_application_reviews (
    application_id,
    reviewed_by,
    decision,
    review_notes,
    decline_reason
  ) values (
    p_application_id,
    p_reviewed_by,
    'declined',
    p_review_notes,
    p_decline_reason
  );

  return jsonb_build_object('success', true);
end;
$$;

-- ============================================================
-- TIP ARTIST
-- ============================================================

create or replace function public.tip_mai_artist(
  p_artist_id uuid,
  p_gross_coins bigint,
  p_payer_user_id uuid,
  p_track_id uuid default null,
  p_album_id uuid default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_artist record;
  v_contract record;
  v_payer record;
  v_artist_coins bigint;
  v_label_coins bigint;
  v_transaction_id uuid;
  v_now timestamptz := now();
begin
  if p_gross_coins <= 0 then
    return jsonb_build_object('success', false, 'error', 'Invalid tip amount');
  end if;

  -- Lock and fetch artist
  select * into v_artist
  from public.record_label_artist_profiles
  where id = p_artist_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Artist not found');
  end if;

  -- Prevent self-tipping
  if v_artist.user_id = p_payer_user_id then
    return jsonb_build_object('success', false, 'error', 'Cannot tip yourself');
  end if;

  -- Get active contract (server-side source of truth)
  select * into v_contract
  from public.record_label_contracts
  where artist_id = p_artist_id
    and status in ('pending_signature', 'active')
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'No active contract found');
  end if;

  -- Lock and verify payer balance
  select * into v_payer
  from public.user_profiles
  where id = p_payer_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Payer not found');
  end if;

  if (v_payer.troll_coins < p_gross_coins) then
    return jsonb_build_object('success', false, 'error', 'Insufficient balance');
  end if;

  -- Calculate splits using contract basis points (never trust client)
  v_artist_coins := floor(p_gross_coins * v_contract.artist_split_bps / 10000.0);
  v_label_coins := p_gross_coins - v_artist_coins;

  -- Deduct from payer
  update public.user_profiles
  set
    troll_coins = troll_coins - p_gross_coins,
    total_spent_coins = total_spent_coins + p_gross_coins,
    updated_at = v_now
  where id = p_payer_user_id;

  -- Credit artist balance
  update public.record_label_artist_balances
  set
    available_coins = available_coins + v_artist_coins,
    lifetime_artist_coins = lifetime_artist_coins + v_artist_coins,
    lifetime_gross_coins = lifetime_gross_coins + p_gross_coins,
    updated_at = v_now
  where artist_id = p_artist_id;

  -- Update track tip total if applicable
  if p_track_id is not null then
    update public.record_label_tracks
    set tip_coins = tip_coins + p_gross_coins
    where id = p_track_id;
  end if;

  -- Create immutable transaction record
  insert into public.record_label_transactions (
    artist_id,
    track_id,
    album_id,
    contract_id,
    payer_user_id,
    transaction_type,
    gross_coins,
    artist_split_bps,
    label_split_bps,
    artist_coins,
    label_coins,
    cashout_eligible,
    status,
    metadata
  ) values (
    p_artist_id,
    p_track_id,
    p_album_id,
    v_contract.id,
    p_payer_user_id,
    case when p_track_id is not null then 'track_tip' else 'artist_tip' end,
    p_gross_coins,
    v_contract.artist_split_bps,
    v_contract.label_split_bps,
    v_artist_coins,
    v_label_coins,
    true,
    'completed',
    jsonb_build_object(
      'source', 'artist_tip',
      'contract_tier', v_contract.tier,
      'contract_number', v_contract.contract_number
    )
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'artist_coins', v_artist_coins,
    'label_coins', v_label_coins,
    'contract_tier', v_contract.tier,
    'artist_split_bps', v_contract.artist_split_bps,
    'label_split_bps', v_contract.label_split_bps
  );
end;
$$;

-- ============================================================
-- INCREMENT TRACK PLAY (deduplicated)
-- ============================================================

create or replace function public.increment_mai_track_play(
  p_track_id uuid,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_play_count bigint;
begin
  update public.record_label_tracks
  set play_count = play_count + 1
  where id = p_track_id
  returning play_count into v_play_count;

  return jsonb_build_object('success', true, 'play_count', v_play_count);
end;
$$;

-- ============================================================
-- GET ARTIST DASHBOARD
-- ============================================================

create or replace function public.get_mai_artist_dashboard(
  p_user_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_artist_id uuid;
  v_result jsonb;
begin
  select id into v_artist_id
  from public.record_label_artist_profiles
  where user_id = p_user_id
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Not an artist');
  end if;

  select jsonb_build_object(
    'success', true,
    'artist_id', v_artist_id,
    'stats', (
      select jsonb_build_object(
        'total_tracks', count(*) filter (where status = 'published'),
        'total_albums', count(*) filter (where status = 'published'),
        'total_likes', coalesce(sum(like_count), 0),
        'total_plays', coalesce(sum(play_count), 0),
        'total_tips', coalesce(sum(tip_coins), 0)
      )
      from public.record_label_tracks
      where artist_id = v_artist_id
    ),
    'balance', (
      select jsonb_build_object(
        'available_coins', available_coins,
        'pending_coins', pending_coins,
        'lifetime_artist_coins', lifetime_artist_coins,
        'lifetime_gross_coins', lifetime_gross_coins
      )
      from public.record_label_artist_balances
      where artist_id = v_artist_id
    ),
    'contract', (
      select jsonb_build_object(
        'id', id,
        'contract_number', contract_number,
        'tier', tier,
        'artist_split_bps', artist_split_bps,
        'label_split_bps', label_split_bps,
        'status', status,
        'effective_at', effective_at,
        'probation_ends_at', probation_ends_at,
        'terms_version', terms_version
      )
      from public.record_label_contracts
      where artist_id = v_artist_id
        and status in ('pending_signature', 'active')
      order by created_at desc
      limit 1
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ============================================================
-- GET PENDING APPLICATION COUNT (for admin badge)
-- ============================================================

create or replace function public.get_mai_pending_application_count()
returns bigint
language sql
set search_path = ''
as $$
  select count(*)
  from public.record_label_applications
  where status = 'pending';
$$;

-- ============================================================
-- REALTIME: Enable for applications table
-- ============================================================

alter publication supabase_realtime add table public.record_label_applications;
