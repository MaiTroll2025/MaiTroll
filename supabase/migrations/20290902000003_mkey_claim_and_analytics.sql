-- =========================================================================
-- Migration: MAITROLL MKEY SYSTEM - claim, expiry sweeper, analytics
-- Date: 2026-09-02
-- =========================================================================

-- =========================================================================
-- 1. CLAIM ON JOIN  (NOTIFIED -> JOINED -> CLAIMED)
--
-- Rule 14: clicking JOIN LIVE claims nothing. The claim is a two-phase,
-- server-clock verification:
--
--   Phase 1  a real viewer/seat session is detected inside the target
--            broadcast, started after the invitation went out. The server
--            stamps mkey_invites.joined_at. Nothing is claimed yet.
--   Phase 2  on a later call, the session must STILL be live and the
--            recipient must have been inside for min_dwell_seconds measured
--            from the server-stamped joined_at. Only then does the sender's
--            held MKey convert to claimed.
--
-- The client cannot shortcut either phase: it supplies no timestamps, no
-- session proof and no claim flag.
-- =========================================================================

create or replace function public.mkey_claim_on_join(p_broadcast_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cfg public.mkey_config;
  v_invite public.mkey_invites;
  v_presence_joined_at timestamptz;
  v_presence_role text;
  v_seat_joined_at timestamptz;
  v_session_started_at timestamptz;
  v_min_dwell integer;
  v_dwell numeric;
  v_held integer;
begin
  if v_user is null then
    return jsonb_build_object('claimed', false, 'reason', 'not_authenticated');
  end if;

  if p_broadcast_id is null or length(trim(p_broadcast_id)) = 0 then
    return jsonb_build_object('claimed', false, 'reason', 'invalid_broadcast');
  end if;

  select * into v_cfg from public.mkey_config where id = true;
  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'config_missing');
  end if;

  v_min_dwell := greatest(coalesce(v_cfg.min_dwell_seconds, 5), 0);

  -- Oldest still-open invitation for this recipient + this broadcast.
  select mi.* into v_invite
  from public.mkey_invites mi
  where mi.recipient_id = v_user
    and mi.broadcast_id = p_broadcast_id
    and mi.status in ('pending', 'notified')
    and mi.expires_at > now()
  order by mi.created_at asc
  limit 1
  for update skip locked;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'no_open_invite');
  end if;

  if not public.mkey_is_broadcast_live(p_broadcast_id) then
    return jsonb_build_object('claimed', false, 'reason', 'broadcast_not_live',
                              'invite_id', v_invite.id);
  end if;

  -- Verified viewer session: an active, non-stale presence row.
  select sap.joined_at, sap.role
    into v_presence_joined_at, v_presence_role
  from public.stream_audience_presence sap
  where sap.stream_id::text = p_broadcast_id
    and sap.user_id = v_user
    and sap.is_active
    and sap.left_at is null
    and sap.last_seen_at > now() - make_interval(secs => coalesce(v_cfg.presence_stale_seconds, 300))
  order by sap.joined_at desc
  limit 1;

  -- Verified seat session (rule 15: a seated participant is a real participant).
  select ss.joined_at
    into v_seat_joined_at
  from public.stream_seat_sessions ss
  where ss.stream_id::text = p_broadcast_id
    and ss.user_id = v_user
    and ss.status = 'active'
  order by ss.joined_at desc
  limit 1;

  if v_presence_joined_at is null and v_seat_joined_at is null then
    return jsonb_build_object('claimed', false, 'reason', 'no_broadcast_session',
                              'invite_id', v_invite.id);
  end if;

  v_session_started_at := greatest(
    coalesce(v_presence_joined_at, to_timestamp(0)),
    coalesce(v_seat_joined_at, to_timestamp(0))
  );

  -- The join has to be a *result* of the invitation, not pre-existing presence.
  -- (Recipients already inside the target broadcast are excluded at send time;
  -- this closes the race window.)
  if v_session_started_at < coalesce(v_invite.notified_at, v_invite.created_at) - interval '10 seconds' then
    return jsonb_build_object('claimed', false, 'reason', 'already_present',
                              'invite_id', v_invite.id);
  end if;

  -- Phase 1: stamp the verified arrival on the server clock.
  if v_invite.joined_at is null then
    update public.mkey_invites
    set joined_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'arrival_role', coalesce(v_presence_role, 'seat')
        )
    where id = v_invite.id;

    if v_min_dwell > 0 then
      return jsonb_build_object(
        'claimed', false,
        'reason', 'verifying_session',
        'invite_id', v_invite.id,
        'retry_after_seconds', v_min_dwell
      );
    end if;

    v_invite.joined_at := now();
  end if;

  -- Phase 2: the session must have lasted long enough to be a real join.
  v_dwell := extract(epoch from (now() - v_invite.joined_at));

  if v_dwell < v_min_dwell then
    return jsonb_build_object(
      'claimed', false,
      'reason', 'verifying_session',
      'invite_id', v_invite.id,
      'retry_after_seconds', ceil(v_min_dwell - v_dwell)::integer
    );
  end if;

  -- HELD -> CLAIMED on the sender's wallet.
  select coalesce(up.held_mkeys, 0) into v_held
  from public.user_profiles up
  where up.id = v_invite.sender_id
  for update;

  update public.user_profiles
  set held_mkeys = greatest(coalesce(held_mkeys, 0) - 1, 0),
      lifetime_mkeys_claimed = coalesce(lifetime_mkeys_claimed, 0) + 1
  where id = v_invite.sender_id;

  update public.mkey_invites
  set status = 'claimed',
      joined_at = coalesce(joined_at, now()),
      claimed_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'claim_role', coalesce(v_presence_role, 'seat'),
        'dwell_seconds', round(v_dwell),
        'session_started_at', v_session_started_at
      )
  where id = v_invite.id;

  update public.mkey_boosts
  set claimed_count = coalesce(claimed_count, 0) + 1
  where id = v_invite.boost_id;

  insert into public.mkey_transactions (
    user_id, amount, transaction_type, broadcast_id, status, boost_id, invite_id, metadata
  ) values (
    v_invite.sender_id, 1, 'claimed', p_broadcast_id, 'completed',
    v_invite.boost_id, v_invite.id,
    jsonb_build_object(
      'recipient_id', v_user,
      'held_before', v_held,
      'held_after', greatest(v_held - 1, 0),
      'joined_at', v_session_started_at
    )
  );

  return jsonb_build_object(
    'claimed', true,
    'invite_id', v_invite.id,
    'boost_id', v_invite.boost_id,
    'broadcast_id', p_broadcast_id,
    'sender_id', v_invite.sender_id,
    'claimed_at', now()
  );
end;
$$;

grant execute on function public.mkey_claim_on_join(text) to authenticated, service_role;

comment on function public.mkey_claim_on_join(text) is
  'Server-verified MKey claim. Requires a real, post-invite viewer or seat session inside the target broadcast.';

-- =========================================================================
-- 2. MY OPEN INVITE (lets the UI show "claim your MKey" state)
-- =========================================================================

create or replace function public.mkey_my_open_invite(p_broadcast_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row record;
begin
  if v_user is null then
    return jsonb_build_object('has_invite', false);
  end if;

  select mi.id, mi.boost_id, mi.sender_id, mi.expires_at, mi.status,
         up.username as sender_username, up.avatar_url as sender_avatar_url
    into v_row
  from public.mkey_invites mi
  left join public.user_profiles up on up.id = mi.sender_id
  where mi.recipient_id = v_user
    and mi.broadcast_id = p_broadcast_id
    and mi.status in ('pending', 'notified', 'claimed')
  order by
    case when mi.status in ('pending', 'notified') then 0 else 1 end,
    mi.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('has_invite', false);
  end if;

  return jsonb_build_object(
    'has_invite', true,
    'invite_id', v_row.id,
    'boost_id', v_row.boost_id,
    'status', v_row.status,
    'expires_at', v_row.expires_at,
    'sender_id', v_row.sender_id,
    'sender_username', v_row.sender_username,
    'sender_avatar_url', v_row.sender_avatar_url
  );
end;
$$;

grant execute on function public.mkey_my_open_invite(text) to authenticated, service_role;

-- =========================================================================
-- 3. EXPIRY SWEEPER  (EXPIRED -> RETURNED)
--
-- Rule 10: an MKey is never permanently consumed just because a notification
-- was sent. Anything not claimed inside the claim window goes back to the
-- sender's available balance.
-- =========================================================================

create or replace function public.mkey_expire_invites(p_limit integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_returned integer := 0;
  v_boosts integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit, 500), 1), 5000);
begin
  -- Return every lapsed invitation, one MKey at a time, back to its sender.
  with lapsed as (
    select mi.id, mi.sender_id, mi.boost_id, mi.broadcast_id
    from public.mkey_invites mi
    where mi.status in ('pending', 'notified')
      and mi.expires_at <= now()
    order by mi.expires_at asc
    limit v_limit
    for update skip locked
  ),
  closed as (
    update public.mkey_invites mi
    set status = 'returned',
        returned_at = now(),
        metadata = coalesce(mi.metadata, '{}'::jsonb) || jsonb_build_object('expired_at', now())
    from lapsed l
    where mi.id = l.id
    returning mi.id, mi.sender_id, mi.boost_id, mi.broadcast_id
  ),
  ledger as (
    insert into public.mkey_transactions (
      user_id, amount, transaction_type, broadcast_id, status, boost_id, invite_id, metadata
    )
    select c.sender_id, 1, 'returned', c.broadcast_id, 'completed', c.boost_id, c.id,
           jsonb_build_object('reason', 'invite_expired')
    from closed c
    returning 1
  ),
  per_sender as (
    select sender_id, count(*)::integer as qty
    from closed
    group by sender_id
  ),
  wallets as (
    update public.user_profiles up
    set held_mkeys = greatest(coalesce(up.held_mkeys, 0) - ps.qty, 0),
        available_mkeys = coalesce(up.available_mkeys, 0) + ps.qty,
        lifetime_mkeys_returned = coalesce(up.lifetime_mkeys_returned, 0) + ps.qty
    from per_sender ps
    where up.id = ps.sender_id
    returning ps.qty
  ),
  per_boost as (
    select boost_id, count(*)::integer as qty
    from closed
    group by boost_id
  ),
  boost_rollup as (
    update public.mkey_boosts b
    set returned_count = coalesce(b.returned_count, 0) + pb.qty
    from per_boost pb
    where b.id = pb.boost_id
    returning 1
  )
  select coalesce((select sum(qty) from per_sender), 0) into v_returned;

  -- Close out campaigns that have no open invitations left.
  with finished as (
    update public.mkey_boosts b
    set status = 'completed',
        completed_at = now()
    where b.status = 'active'
      and b.expires_at <= now()
      and not exists (
        select 1 from public.mkey_invites mi
        where mi.boost_id = b.id
          and mi.status in ('pending', 'notified')
      )
    returning b.id, b.sender_id, b.amount, b.invites_created, b.claimed_count, b.returned_count
  ),
  receipts as (
    insert into public.notifications (user_id, type, title, message, metadata)
    select f.sender_id,
           'mkey_boost_complete',
           '🔑 Your MKey Send',
           format('%s MKeys sent • %s joined • %s returned',
                  f.amount, f.claimed_count, f.returned_count),
           jsonb_build_object(
             'boost_id', f.id,
             'amount', f.amount,
             'invites_created', f.invites_created,
             'claimed', f.claimed_count,
             'returned', f.returned_count
           )
    from finished f
    returning 1
  )
  select count(*)::integer into v_boosts from finished;

  return jsonb_build_object(
    'success', true,
    'mkeys_returned', v_returned,
    'boosts_completed', v_boosts
  );
end;
$$;

grant execute on function public.mkey_expire_invites(integer) to authenticated, service_role;

comment on function public.mkey_expire_invites(integer) is
  'Returns unclaimed MKeys to their senders once the claim window lapses, and closes finished campaigns.';

-- Best-effort scheduled sweep. Safe to skip when pg_cron is unavailable.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('mkey-expire-invites');
    exception when others then
      null;
    end;
    begin
      perform cron.schedule('mkey-expire-invites', '* * * * *',
                            $cron$select public.mkey_expire_invites(1000);$cron$);
    exception when others then
      raise notice 'MKey sweeper cron not scheduled: %', sqlerrm;
    end;
  else
    raise notice 'pg_cron unavailable - MKey expiry runs on demand via mkey_expire_invites().';
  end if;
end
$$;

-- =========================================================================
-- 4. BROADCASTER ANALYTICS  (rule 19)
-- =========================================================================

create or replace function public.mkey_broadcast_stats(p_broadcast_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sent integer := 0;
  v_invites integer := 0;
  v_joins integer := 0;
  v_returned integer := 0;
  v_senders integer := 0;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select coalesce(sum(b.amount), 0)::integer,
         coalesce(sum(b.invites_created), 0)::integer,
         count(distinct b.sender_id)::integer
    into v_sent, v_invites, v_senders
  from public.mkey_boosts b
  where b.broadcast_id = p_broadcast_id;

  select count(*) filter (where mi.status = 'claimed')::integer,
         count(*) filter (where mi.status in ('returned', 'expired'))::integer
    into v_joins, v_returned
  from public.mkey_invites mi
  where mi.broadcast_id = p_broadcast_id;

  return jsonb_build_object(
    'success', true,
    'broadcast_id', p_broadcast_id,
    'mkeys_sent', v_sent,
    'invites_sent', v_invites,
    'successful_joins', v_joins,
    'returned', v_returned,
    'unique_senders', v_senders,
    'conversion_rate', case when v_invites > 0
      then round((v_joins::numeric / v_invites::numeric) * 100, 1)
      else 0 end
  );
end;
$$;

grant execute on function public.mkey_broadcast_stats(text) to authenticated, service_role;

-- =========================================================================
-- 5. SENDER ANALYTICS  (rule 20)
-- =========================================================================

create or replace function public.mkey_boost_summary(p_boost_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_boost public.mkey_boosts;
  v_claimed integer := 0;
  v_returned integer := 0;
  v_open integer := 0;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select * into v_boost from public.mkey_boosts where id = p_boost_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if v_boost.sender_id <> v_user and coalesce(v_boost.broadcaster_id, '00000000-0000-0000-0000-000000000000'::uuid) <> v_user then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select count(*) filter (where status = 'claimed')::integer,
         count(*) filter (where status in ('returned', 'expired'))::integer,
         count(*) filter (where status in ('pending', 'notified'))::integer
    into v_claimed, v_returned, v_open
  from public.mkey_invites
  where boost_id = p_boost_id;

  return jsonb_build_object(
    'success', true,
    'boost_id', v_boost.id,
    'broadcast_id', v_boost.broadcast_id,
    'amount', v_boost.amount,
    'invites_created', v_boost.invites_created,
    'joined', v_claimed,
    'returned', v_returned + greatest(v_boost.amount - v_boost.invites_created, 0),
    'pending', v_open,
    'status', v_boost.status,
    'expires_at', v_boost.expires_at,
    'created_at', v_boost.created_at
  );
end;
$$;

grant execute on function public.mkey_boost_summary(uuid) to authenticated, service_role;

create or replace function public.mkey_my_recent_sends(p_limit integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_rows jsonb;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select b.id as boost_id,
           b.broadcast_id,
           b.amount,
           b.invites_created,
           b.claimed_count as joined,
           b.returned_count as returned,
           b.status,
           b.created_at,
           b.expires_at
    from public.mkey_boosts b
    where b.sender_id = v_user
    order by b.created_at desc
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
  ) t;

  return jsonb_build_object('success', true, 'sends', v_rows);
end;
$$;

grant execute on function public.mkey_my_recent_sends(integer) to authenticated, service_role;

-- =========================================================================
-- 6. GRANTING MKEYS (purchase / admin adjustment - server only)
-- =========================================================================

create or replace function public.mkey_admin_adjust(
  p_user_id uuid,
  p_amount integer,
  p_transaction_type text default 'admin_adjustment',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean := false;
  v_available integer;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select coalesce(up.is_admin, false) or coalesce(up.role, '') = 'admin'
    into v_is_admin
  from public.user_profiles up
  where up.id = v_actor;

  if not coalesce(v_is_admin, false) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  if p_transaction_type not in ('purchase', 'refund', 'admin_adjustment') then
    return jsonb_build_object('success', false, 'error', 'invalid_type');
  end if;

  if coalesce(p_amount, 0) = 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_amount');
  end if;

  select coalesce(up.available_mkeys, 0) into v_available
  from public.user_profiles up
  where up.id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'user_not_found');
  end if;

  if v_available + p_amount < 0 then
    return jsonb_build_object('success', false, 'error', 'insufficient_mkeys');
  end if;

  update public.user_profiles
  set available_mkeys = coalesce(available_mkeys, 0) + p_amount
  where id = p_user_id;

  insert into public.mkey_transactions (
    user_id, amount, transaction_type, status, metadata
  ) values (
    p_user_id, abs(p_amount), p_transaction_type, 'completed',
    jsonb_build_object('actor_id', v_actor, 'reason', p_reason, 'signed_amount', p_amount)
  );

  return jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'available', v_available + p_amount
  );
end;
$$;

grant execute on function public.mkey_admin_adjust(uuid, integer, text, text) to authenticated, service_role;
