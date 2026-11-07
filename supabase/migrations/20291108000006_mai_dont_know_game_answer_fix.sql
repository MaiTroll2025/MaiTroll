-- Preserve a player's locked answer when the room is refreshed.
-- The previous tick function always returned my_choice as null, causing the
-- client to forget a successful answer and submit it again.

create or replace function public.mai_dk_tick_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_ts timestamptz := clock_timestamp();
  room_row public.mai_dk_rooms%rowtype;
  round_row public.mai_dk_game_rounds%rowtype;
  result jsonb;
  round_json jsonb;
begin
  if uid is null then
    raise exception 'Sign in required.';
  end if;

  select * into room_row
  from public.mai_dk_rooms
  where id = p_room_id;

  if not found then
    raise exception 'That lobby no longer exists.';
  end if;

  select * into round_row
  from public.mai_dk_game_rounds
  where room_id = p_room_id and status = 'open'
  order by round_number desc
  limit 1;

  if found then
    round_json := jsonb_build_object(
      'id', round_row.id,
      'round_number', round_row.round_number,
      'category', round_row.category,
      'prompt', round_row.prompt,
      'options', round_row.options,
      'status', round_row.status,
      'started_at', round_row.started_at,
      'deadline_at', round_row.deadline_at,
      'revealed_at', round_row.revealed_at,
      'correct_index', round_row.correct_index,
      'my_choice', (
        select a.choice
        from public.mai_dk_round_answers a
        where a.round_id = round_row.id and a.user_id = uid
        limit 1
      ),
      'answered_count', coalesce((
        select count(*)
        from public.mai_dk_round_answers
        where round_id = round_row.id
      ), 0),
      'results', null
    );
  end if;

  select jsonb_build_object(
    'server_now', now_ts,
    'room', jsonb_build_object(
      'id', room_row.id,
      'name', room_row.name,
      'visibility', room_row.visibility,
      'status', room_row.status,
      'host_id', room_row.host_id,
      'max_players', room_row.max_players,
      'current_round', room_row.current_round,
      'total_rounds', room_row.total_rounds,
      'autostart_at', room_row.autostart_at,
      'match_started_at', room_row.match_started_at,
      'join_code', room_row.join_code
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', rp.user_id,
        'username', rp.username,
        'display_name', rp.display_name,
        'avatar_url', rp.avatar_url,
        'is_ready', rp.is_ready,
        'score', rp.score,
        'connected', rp.connected,
        'has_left', rp.has_left,
        'answered', rp.answered
      ) order by rp.joined_at)
      from public.mai_dk_room_players rp
      where rp.room_id = p_room_id
    ), '[]'),
    'round', round_json
  ) into result;

  return result;
end;
$$;

create or replace function public.mai_dk_submit_answer(p_round_id uuid, p_choice int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.mai_dk_game_rounds%rowtype;
  existing int;
  pts int := 0;
begin
  if uid is null then
    raise exception 'Sign in required.';
  end if;

  select * into r
  from public.mai_dk_game_rounds
  where id = p_round_id
  for update;

  if not found then
    raise exception 'Round not found.';
  end if;

  if not exists (
    select 1
    from public.mai_dk_room_players
    where room_id = r.room_id and user_id = uid and not has_left
  ) then
    raise exception 'not_a_member';
  end if;

  if r.status <> 'open' or clock_timestamp() > r.deadline_at then
    raise exception 'round_closed';
  end if;

  if p_choice is null or p_choice < 0 or p_choice >= jsonb_array_length(r.options) then
    raise exception 'invalid_choice';
  end if;

  select count(*) into existing
  from public.mai_dk_round_answers
  where round_id = p_round_id and user_id = uid;

  if existing > 0 then
    raise exception 'already_answered';
  end if;

  if p_choice = r.correct_index then
    pts := 10;
  end if;

  insert into public.mai_dk_round_answers (round_id, user_id, choice, is_correct, points)
  values (p_round_id, uid, p_choice, p_choice = r.correct_index, pts);

  update public.mai_dk_room_players rp
  set answered = true, score = rp.score + pts
  where rp.room_id = r.room_id and rp.user_id = uid;

  return jsonb_build_object(
    'accepted', true,
    'is_correct', p_choice = r.correct_index,
    'points', pts,
    'coins_spent', 1,
    'coins_earned', case when p_choice = r.correct_index then 10 else 0 end
  );
end;
$$;
