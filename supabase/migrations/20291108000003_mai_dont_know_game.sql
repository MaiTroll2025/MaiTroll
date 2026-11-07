-- Mai Dont Know Game — own tables + RPCs (mirrors mai_troll_run pattern)
-- Uses the app's auth.users / user_profiles; no separate auth system.

create table if not exists public.mai_dk_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  visibility text not null default 'public' check (visibility in ('public','private','quick','solo')),
  status text not null default 'waiting' check (status in ('waiting','in_progress','finished','abandoned')),
  host_id uuid not null references auth.users(id),
  max_players int not null default 6 check (max_players between 1 and 12),
  current_round int not null default 0,
  total_rounds int not null default 10,
  join_code text not null,
  autostart_at timestamptz,
  match_started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mai_dk_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mai_dk_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  username text not null,
  display_name text,
  avatar_url text,
  is_ready boolean not null default false,
  score int not null default 0,
  connected boolean not null default true,
  has_left boolean not null default false,
  answered boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.mai_dk_game_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mai_dk_rooms(id) on delete cascade,
  round_number int not null,
  category text not null,
  prompt text not null,
  options jsonb not null,
  correct_index int not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  revealed_at timestamptz,
  status text not null default 'open' check (status in ('open','revealed'))
);

create table if not exists public.mai_dk_round_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.mai_dk_game_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  choice int not null,
  is_correct boolean not null,
  points int not null default 0,
  answered_at timestamptz not null default now()
);

create table if not exists public.mai_dk_match_results (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mai_dk_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  total_points int not null default 0,
  matches_played int not null default 1,
  best_score int not null default 0,
  finished_at timestamptz not null default now()
);

create index if not exists mai_dk_rooms_status_idx on public.mai_dk_rooms(status, created_at desc);
create index if not exists mai_dk_room_players_room_idx on public.mai_dk_room_players(room_id);
create index if not exists mai_dk_game_rounds_room_idx on public.mai_dk_game_rounds(room_id, round_number);
create index if not exists mai_dk_round_answers_round_idx on public.mai_dk_round_answers(round_id);
create index if not exists mai_dk_match_results_user_idx on public.mai_dk_match_results(user_id);

alter table public.mai_dk_rooms enable row level security;
alter table public.mai_dk_room_players enable row level security;
alter table public.mai_dk_game_rounds enable row level security;
alter table public.mai_dk_round_answers enable row level security;
alter table public.mai_dk_match_results enable row level security;

revoke all on public.mai_dk_rooms, public.mai_dk_room_players, public.mai_dk_game_rounds, public.mai_dk_round_answers, public.mai_dk_match_results from anon, authenticated;

grant select on public.mai_dk_rooms, public.mai_dk_room_players, public.mai_dk_game_rounds, public.mai_dk_round_answers, public.mai_dk_match_results to authenticated;

create policy "Rooms are viewable by authenticated" on public.mai_dk_rooms for select to authenticated using (true);
create policy "Room players viewable by authenticated" on public.mai_dk_room_players for select to authenticated using (true);
create policy "Game rounds viewable by authenticated" on public.mai_dk_game_rounds for select to authenticated using (true);
create policy "Round answers viewable by authenticated" on public.mai_dk_round_answers for select to authenticated using (true);
create policy "Match results viewable by authenticated" on public.mai_dk_match_results for select to authenticated using (true);

-- ---- RPCs ----

create or replace function public.mai_dk_create_room(p_name text, p_visibility text, p_max_players int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
  code text;
begin
  if uid is null then raise exception 'Sign in required.'; end if;
  if p_max_players < 1 or p_max_players > 12 then raise exception 'Invalid size.'; end if;
  if p_visibility not in ('public','private','quick','solo') then raise exception 'Invalid visibility.'; end if;
  if char_length(p_name) < 1 or char_length(p_name) > 40 then raise exception 'Invalid name.'; end if;
  code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
  insert into public.mai_dk_rooms (name, visibility, status, host_id, max_players, join_code)
  values (p_name, p_visibility, 'waiting', uid, p_max_players, code)
  returning id into rid;
  insert into public.mai_dk_room_players (room_id, user_id, username, display_name, avatar_url, is_ready)
  select rid, uid, p.display_name, p.display_name, p.avatar_url, true
  from public.user_profiles p where p.id = uid;
  return rid;
end $$;

create or replace function public.mai_dk_quick_match()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  if uid is null then raise exception 'Sign in required.'; end if;
  select id into rid from public.mai_dk_rooms
  where visibility = 'quick' and status = 'waiting'
  order by created_at asc
  limit 1
  for update skip locked;
  if rid is null then
    rid := public.mai_dk_create_room('Quick Match', 'quick', 6);
  end if;
  return rid;
end $$;

create or replace function public.mai_dk_create_solo_match()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  if uid is null then raise exception 'Sign in required.'; end if;
  rid := public.mai_dk_create_room('Solo Practice', 'solo', 1);
  return rid;
end $$;

create or replace function public.mai_dk_join_room_by_id(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.mai_dk_rooms%rowtype;
begin
  if uid is null then raise exception 'Sign in required.'; end if;
  select * into r from public.mai_dk_rooms where id = p_room_id for update;
  if not found then raise exception 'That lobby no longer exists.'; end if;
  if r.status <> 'waiting' then raise exception 'This match has already started.'; end if;
  insert into public.mai_dk_room_players (room_id, user_id, username, display_name, avatar_url, is_ready)
  select p_room_id, uid, p.display_name, p.display_name, p.avatar_url, false
  from public.user_profiles p where p.id = uid
  on conflict (room_id, user_id) do nothing;
  return p_room_id;
end $$;

create or replace function public.mai_dk_join_room_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  if uid is null then raise exception 'Sign in required.'; end if;
  select id into rid from public.mai_dk_rooms where join_code = upper(p_code) and status = 'waiting' for update skip locked;
  if not found then raise exception 'No lobby matches that code.'; end if;
  perform public.mai_dk_join_room_by_id(rid);
  return rid;
end $$;

create or replace function public.mai_dk_leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in required.'; end if;
  delete from public.mai_dk_room_players where room_id = p_room_id and user_id = uid;
end $$;

create or replace function public.mai_dk_set_ready(p_room_id uuid, p_ready boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in required.'; end if;
  update public.mai_dk_room_players
  set is_ready = p_ready
  where room_id = p_room_id and user_id = uid;
end $$;

create or replace function public.mai_dk_start_match(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.mai_dk_rooms%rowtype;
begin
  if uid is null then raise exception 'Sign in required.'; end if;
  select * into r from public.mai_dk_rooms where id = p_room_id for update;
  if not found then raise exception 'That lobby no longer exists.'; end if;
  if r.host_id <> uid then raise exception 'Only the host can start the match.'; end if;
  if r.status <> 'waiting' then raise exception 'This match has already started.'; end if;
  update public.mai_dk_rooms
  set status = 'in_progress', match_started_at = now()
  where id = p_room_id;
end $$;

create or replace function public.mai_dk_tick_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := clock_timestamp();
  room_row public.mai_dk_rooms%rowtype;
  result jsonb;
begin
  select * into room_row from public.mai_dk_rooms where id = p_room_id;
  if not found then raise exception 'That lobby no longer exists.'; end if;

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
        'left', rp.has_left,
        'answered', rp.answered
      ) order by rp.joined_at)
      from public.mai_dk_room_players rp where rp.room_id = p_room_id
    ), '[]'),
    'round', null
  ) into result;
  return result;
end $$;

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
  if uid is null then raise exception 'Sign in required.'; end if;
  select * into r from public.mai_dk_game_rounds where id = p_round_id for update;
  if not found then raise exception 'Round not found.'; end if;
  if r.status <> 'open' then raise exception 'round_closed'; end if;
  if clock_timestamp() > r.deadline_at then raise exception 'round_closed'; end if;

  select count(*) into existing from public.mai_dk_round_answers
  where round_id = p_round_id and user_id = uid;
  if existing > 0 then raise exception 'You have already answered.'; end if;

  if p_choice = r.correct_index then
    pts := 10;
  end if;

  insert into public.mai_dk_round_answers (round_id, user_id, choice, is_correct, points)
  values (p_round_id, uid, p_choice, p_choice = r.correct_index, pts);

  update public.mai_dk_room_players rp
  set answered = true, score = rp.score + pts
  from public.mai_dk_game_rounds gr
  where rp.room_id = gr.room_id and gr.id = p_round_id and rp.user_id = uid;

  return jsonb_build_object(
    'accepted', true,
    'is_correct', p_choice = r.correct_index,
    'points', pts,
    'coins_spent', 1,
    'coins_earned', case when p_choice = r.correct_index then 10 else 0 end
  );
end $$;

create or replace function public.mai_dk_list_public_rooms()
returns table (
  room_id uuid,
  room_name text,
  max_players int,
  player_count int,
  host_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
select
  r.id,
  r.name,
  r.max_players,
  (select count(*) from public.mai_dk_room_players rp where rp.room_id = r.id and not rp.has_left),
  coalesce(p.display_name, p.username, 'Troll'),
  r.created_at
from public.mai_dk_rooms r
join public.user_profiles p on p.id = r.host_id
where r.visibility = 'public' and r.status = 'waiting'
order by r.created_at desc;
$$;

create or replace function public.mai_dk_get_troll_coin_balance()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  bal int;
begin
  if uid is null then raise exception 'Sign in required.'; end if;
  select coalesce(troll_coins, 0) into bal from public.user_profiles where id = uid;
  return coalesce(bal, 0);
end $$;

create or replace function public.mai_dk_get_leaderboard(p_period text, p_limit int default 25)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_points int,
  matches_played int,
  best_score int
)
language sql
stable
security definer
set search_path = public
as $$
select
  m.user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  sum(m.total_points) as total_points,
  count(*) as matches_played,
  max(m.best_score) as best_score
from public.mai_dk_match_results m
join public.user_profiles p on p.id = m.user_id
group by m.user_id, p.username, p.display_name, p.avatar_url
order by total_points desc, best_score desc
limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

revoke execute on function public.mai_dk_create_room(text,text,int),
  public.mai_dk_quick_match(),
  public.mai_dk_create_solo_match(),
  public.mai_dk_join_room_by_id(uuid),
  public.mai_dk_join_room_by_code(text),
  public.mai_dk_leave_room(uuid),
  public.mai_dk_set_ready(uuid,boolean),
  public.mai_dk_start_match(uuid),
  public.mai_dk_tick_room(uuid),
  public.mai_dk_submit_answer(uuid,int),
  public.mai_dk_list_public_rooms(),
  public.mai_dk_get_troll_coin_balance(),
  public.mai_dk_get_leaderboard(text,int)
from public;

grant execute on function public.mai_dk_create_room(text,text,int),
  public.mai_dk_quick_match(),
  public.mai_dk_create_solo_match(),
  public.mai_dk_join_room_by_id(uuid),
  public.mai_dk_join_room_by_code(text),
  public.mai_dk_leave_room(uuid),
  public.mai_dk_set_ready(uuid,boolean),
  public.mai_dk_start_match(uuid),
  public.mai_dk_tick_room(uuid),
  public.mai_dk_submit_answer(uuid,int),
  public.mai_dk_list_public_rooms(),
  public.mai_dk_get_troll_coin_balance(),
  public.mai_dk_get_leaderboard(text,int)
to authenticated;
