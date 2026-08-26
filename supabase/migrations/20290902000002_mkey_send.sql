-- =========================================================================
-- Migration: MAITROLL MKEY SYSTEM - server-side logic
-- Date: 2026-09-02
--
-- Every MKey mutation lives here. All functions are SECURITY DEFINER, derive
-- the actor from auth.uid(), and lock the wallet row before touching balances.
-- The client never supplies a balance, a claim flag, or a refund.
-- =========================================================================

-- =========================================================================
-- 1. LIVENESS HELPER
-- Mirrors the frontend rule: status in (live, starting) OR is_live, not ended.
-- =========================================================================

create or replace function public.mkey_is_broadcast_live(p_broadcast_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.streams s
    where s.id::text = p_broadcast_id
      and s.ended_at is null
      and (coalesce(s.status, '') in ('live', 'starting') or coalesce(s.is_live, false))
  );
$$;

grant execute on function public.mkey_is_broadcast_live(text) to authenticated, service_role;

-- =========================================================================
-- 2. WALLET READ
-- total = available + held. Client reads, never writes.
-- =========================================================================

create or replace function public.mkey_wallet()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row record;
  v_cfg public.mkey_config;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select coalesce(up.available_mkeys, 0) as available,
         coalesce(up.held_mkeys, 0) as held,
         coalesce(up.lifetime_mkeys_sent, 0) as lifetime_sent,
         coalesce(up.lifetime_mkeys_claimed, 0) as lifetime_claimed,
         coalesce(up.lifetime_mkeys_returned, 0) as lifetime_returned
    into v_row
  from public.user_profiles up
  where up.id = v_user;

  if not found then
    return jsonb_build_object('success', false, 'error', 'profile_not_found');
  end if;

  select * into v_cfg from public.mkey_config where id = true;

  return jsonb_build_object(
    'success', true,
    'available', v_row.available,
    'held', v_row.held,
    'total', v_row.available + v_row.held,
    'lifetime_sent', v_row.lifetime_sent,
    'lifetime_claimed', v_row.lifetime_claimed,
    'lifetime_returned', v_row.lifetime_returned,
    'invite_expiry_seconds', coalesce(v_cfg.invite_expiry_seconds, 300),
    'max_amount_per_send', coalesce(v_cfg.max_amount_per_send, 500)
  );
end;
$$;

grant execute on function public.mkey_wallet() to authenticated, service_role;

-- =========================================================================
-- 3. ELIGIBLE RECIPIENT POOL (read-only preview)
--
-- Rule 5/6:  only users currently INSIDE another live broadcast, as a viewer
--            or as a seat participant. Never a blind query over all users.
-- Rule 7:    anyone already watching or seated in the target broadcast is
--            excluded outright.
-- Rule 16:   recipients on cooldown are excluded.
-- =========================================================================

create or replace function public.mkey_eligible_recipient_count(p_broadcast_id text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cfg public.mkey_config;
  v_count integer := 0;
begin
  if v_user is null then
    return 0;
  end if;

  select * into v_cfg from public.mkey_config where id = true;

  select count(*) into v_count
  from (
    select distinct sap.user_id
    from public.stream_audience_presence sap
    join public.streams src on src.id::text = sap.stream_id::text
    join public.user_profiles up on up.id = sap.user_id
    where sap.is_active
      and sap.left_at is null
      and sap.role in ('audience', 'seat')
      and sap.stream_id::text <> p_broadcast_id
      and sap.last_seen_at > now() - make_interval(secs => coalesce(v_cfg.presence_stale_seconds, 300))
      and src.ended_at is null
      and (coalesce(src.status, '') in ('live', 'starting') or coalesce(src.is_live, false))
      and sap.user_id <> v_user
      and coalesce(up.is_ghost_mode, false) = false
      and not exists (
        select 1
        from public.stream_audience_presence tgt
        where tgt.stream_id::text = p_broadcast_id
          and tgt.user_id = sap.user_id
          and tgt.is_active
          and tgt.left_at is null
      )
      and not exists (
        select 1
        from public.stream_seats seat
        where seat.stream_id::text = p_broadcast_id
          and seat.user_id = sap.user_id
          and coalesce(seat.is_active, false)
      )
      and not exists (
        select 1
        from public.streams host
        where host.id::text = p_broadcast_id
          and host.user_id = sap.user_id
      )
      and not exists (
        select 1
        from public.mkey_invites mi
        where mi.recipient_id = sap.user_id
          and mi.created_at > now() - make_interval(secs => coalesce(v_cfg.recipient_cooldown_seconds, 1800))
      )
  ) pool;

  return v_count;
end;
$$;

grant execute on function public.mkey_eligible_recipient_count(text) to authenticated, service_role;

-- =========================================================================
-- 4. SEND MKEYS  (AVAILABLE -> HELD -> NOTIFIED)
--
-- Atomic: locks the sender wallet, moves available -> held, creates the boost,
-- picks eligible recipients, writes one invite per MKey, emits one
-- notification per invite, and immediately returns any MKey it could not
-- place because the eligible pool was smaller than the amount sent.
-- =========================================================================

create or replace function public.mkey_send(
  p_broadcast_id text,
  p_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_cfg public.mkey_config;
  v_amount integer;
  v_available integer;
  v_held integer;
  v_sender_username text;
  v_sender_avatar text;
  v_broadcaster uuid;
  v_stream_title text;
  v_boost_id uuid;
  v_expires_at timestamptz;
  v_created integer := 0;
  v_unfilled integer := 0;
  v_last_send timestamptz;
  v_message text;
begin
  if v_sender is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated',
                              'message', 'Sign in to send MKeys.');
  end if;

  if p_broadcast_id is null or length(trim(p_broadcast_id)) = 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_broadcast',
                              'message', 'No broadcast selected.');
  end if;

  select * into v_cfg from public.mkey_config where id = true;
  if not found then
    return jsonb_build_object('success', false, 'error', 'config_missing',
                              'message', 'MKeys are temporarily unavailable.');
  end if;

  v_amount := floor(coalesce(p_amount, 0))::integer;
  if v_amount < 1 then
    return jsonb_build_object('success', false, 'error', 'invalid_amount',
                              'message', 'Send at least 1 MKey.');
  end if;
  if v_amount > v_cfg.max_amount_per_send then
    return jsonb_build_object('success', false, 'error', 'amount_too_large',
                              'message', format('You can send at most %s MKeys at once.', v_cfg.max_amount_per_send));
  end if;

  -- Target broadcast must be genuinely live.
  select s.user_id, s.title
    into v_broadcaster, v_stream_title
  from public.streams s
  where s.id::text = p_broadcast_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'broadcast_not_found',
                              'message', 'That broadcast no longer exists.');
  end if;

  if not public.mkey_is_broadcast_live(p_broadcast_id) then
    return jsonb_build_object('success', false, 'error', 'broadcast_not_live',
                              'message', 'This broadcast is not live right now.');
  end if;

  -- Anti-spam: one send per sender per cooldown window.
  select max(b.created_at) into v_last_send
  from public.mkey_boosts b
  where b.sender_id = v_sender;

  if v_last_send is not null
     and v_last_send > now() - make_interval(secs => coalesce(v_cfg.send_cooldown_seconds, 10)) then
    return jsonb_build_object('success', false, 'error', 'send_cooldown',
                              'message', 'Slow down a moment before sending more MKeys.');
  end if;

  -- Lock the wallet. Balance is decided here, never by the client.
  select coalesce(up.available_mkeys, 0), coalesce(up.held_mkeys, 0),
         up.username, up.avatar_url
    into v_available, v_held, v_sender_username, v_sender_avatar
  from public.user_profiles up
  where up.id = v_sender
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'profile_not_found',
                              'message', 'Profile not found.');
  end if;

  if v_available < v_amount then
    return jsonb_build_object('success', false, 'error', 'insufficient_mkeys',
                              'message', format('You only have %s MKeys available.', v_available),
                              'available', v_available);
  end if;

  v_expires_at := now() + make_interval(secs => v_cfg.invite_expiry_seconds);

  -- AVAILABLE -> HELD
  update public.user_profiles
  set available_mkeys = coalesce(available_mkeys, 0) - v_amount,
      held_mkeys = coalesce(held_mkeys, 0) + v_amount,
      lifetime_mkeys_sent = coalesce(lifetime_mkeys_sent, 0) + v_amount
  where id = v_sender;

  insert into public.mkey_boosts (
    sender_id, broadcast_id, broadcaster_id, amount, status, expires_at, metadata
  ) values (
    v_sender, p_broadcast_id, v_broadcaster, v_amount, 'active', v_expires_at,
    jsonb_build_object('stream_title', v_stream_title)
  )
  returning id into v_boost_id;

  insert into public.mkey_transactions (
    user_id, amount, transaction_type, broadcast_id, status, boost_id, metadata
  ) values (
    v_sender, v_amount, 'held', p_broadcast_id, 'completed', v_boost_id,
    jsonb_build_object(
      'available_before', v_available,
      'available_after', v_available - v_amount,
      'held_before', v_held,
      'held_after', v_held + v_amount
    )
  );

  -- Pick the recipient pool: currently active viewers + seat participants in
  -- OTHER live broadcasts, never anyone already inside the target broadcast.
  with pool as (
    select distinct on (sap.user_id)
           sap.user_id,
           sap.stream_id::text as source_broadcast_id,
           sap.role as source_role
    from public.stream_audience_presence sap
    join public.streams src on src.id::text = sap.stream_id::text
    join public.user_profiles up on up.id = sap.user_id
    where sap.is_active
      and sap.left_at is null
      and sap.role in ('audience', 'seat')
      and sap.stream_id::text <> p_broadcast_id
      and sap.last_seen_at > now() - make_interval(secs => v_cfg.presence_stale_seconds)
      and src.ended_at is null
      and (coalesce(src.status, '') in ('live', 'starting') or coalesce(src.is_live, false))
      and sap.user_id <> v_sender
      and coalesce(up.is_ghost_mode, false) = false
      -- Rule 7: already watching the target broadcast
      and not exists (
        select 1
        from public.stream_audience_presence tgt
        where tgt.stream_id::text = p_broadcast_id
          and tgt.user_id = sap.user_id
          and tgt.is_active
          and tgt.left_at is null
      )
      -- Rule 7: already seated in the target broadcast
      and not exists (
        select 1
        from public.stream_seats seat
        where seat.stream_id::text = p_broadcast_id
          and seat.user_id = sap.user_id
          and coalesce(seat.is_active, false)
      )
      -- never invite the host of the target broadcast into their own room
      and not exists (
        select 1
        from public.streams host
        where host.id::text = p_broadcast_id
          and host.user_id = sap.user_id
      )
      -- Rule 16: cooldown between repeated MKey invitations
      and not exists (
        select 1
        from public.mkey_invites mi
        where mi.recipient_id = sap.user_id
          and mi.created_at > now() - make_interval(secs => v_cfg.recipient_cooldown_seconds)
      )
    order by sap.user_id, sap.last_seen_at desc
  ),
  chosen as (
    select user_id, source_broadcast_id, source_role
    from pool
    order by random()
    limit v_amount
  )
  insert into public.mkey_invites (
    boost_id, sender_id, recipient_id, broadcast_id, status,
    notified_at, expires_at, source_broadcast_id, source_role
  )
  select v_boost_id, v_sender, c.user_id, p_broadcast_id, 'notified',
         now(), v_expires_at, c.source_broadcast_id, c.source_role
  from chosen c
  on conflict do nothing;

  select count(*)::integer into v_created
  from public.mkey_invites
  where boost_id = v_boost_id;

  -- Deliver one notification per invite and link it back to the invite row.
  v_message := format('@%s wants you to check out this live broadcast. Join the broadcast to claim your MKey.',
                      coalesce(v_sender_username, 'A MaiTroll user'));

  with new_notifs as (
    insert into public.notifications (user_id, type, title, message, metadata)
    select mi.recipient_id,
           'mkey_invite',
           '🔑 MKey Invite',
           v_message,
           jsonb_build_object(
             'invite_id', mi.id,
             'boost_id', v_boost_id,
             'stream_id', p_broadcast_id,
             'broadcast_id', p_broadcast_id,
             'stream_title', v_stream_title,
             'broadcaster_id', v_broadcaster,
             'sender_id', v_sender,
             'sender_username', v_sender_username,
             'sender_avatar_url', v_sender_avatar,
             'expires_at', mi.expires_at,
             -- /watch/:id resolves to the ViewerPage on web and to
             -- PhoneViewerPage on phone, so one deep link serves both.
             'action_url', format('/watch/%s?mkey=%s', p_broadcast_id, mi.id)
           )
    from public.mkey_invites mi
    where mi.boost_id = v_boost_id
    returning id as notification_id, (metadata->>'invite_id')::uuid as invite_id
  )
  update public.mkey_invites mi
  set notification_id = n.notification_id
  from new_notifs n
  where mi.id = n.invite_id;

  -- Any MKey we could not place has to go straight back. It was never used.
  v_unfilled := v_amount - v_created;

  if v_unfilled > 0 then
    update public.user_profiles
    set available_mkeys = coalesce(available_mkeys, 0) + v_unfilled,
        held_mkeys = greatest(coalesce(held_mkeys, 0) - v_unfilled, 0),
        lifetime_mkeys_returned = coalesce(lifetime_mkeys_returned, 0) + v_unfilled
    where id = v_sender;

    insert into public.mkey_transactions (
      user_id, amount, transaction_type, broadcast_id, status, boost_id, metadata
    ) values (
      v_sender, v_unfilled, 'returned', p_broadcast_id, 'completed', v_boost_id,
      jsonb_build_object('reason', 'no_eligible_recipients')
    );
  end if;

  update public.mkey_boosts
  set invites_created = v_created,
      returned_count = v_unfilled,
      status = case when v_created = 0 then 'completed' else 'active' end,
      completed_at = case when v_created = 0 then now() else null end
  where id = v_boost_id;

  return jsonb_build_object(
    'success', true,
    'boost_id', v_boost_id,
    'broadcast_id', p_broadcast_id,
    'amount', v_amount,
    'invites_created', v_created,
    'returned_immediately', v_unfilled,
    'expires_at', v_expires_at,
    'expires_in_seconds', v_cfg.invite_expiry_seconds,
    'available', v_available - v_amount + v_unfilled,
    'held', v_held + v_created,
    'message', case
      when v_created = 0 then 'No active users were available to invite. Your MKeys were returned.'
      else format('%s MKey invitation%s sent.', v_created, case when v_created = 1 then '' else 's' end)
    end
  );
end;
$$;

grant execute on function public.mkey_send(text, integer) to authenticated, service_role;

comment on function public.mkey_send(text, integer) is
  'Holds MKeys, finds active users inside other live broadcasts, and sends one invitation per MKey. Unplaceable MKeys are returned immediately.';
