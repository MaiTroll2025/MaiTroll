alter table public.mai_run_results
  add column if not exists troll_coins_earned integer not null default 0,
  add column if not exists checkpoint_uses integer not null default 0,
  add column if not exists last_progress_at timestamptz not null default now();

create table if not exists public.mai_run_inventory (
  player_id uuid primary key references auth.users(id) on delete cascade,
  checkpoints integer not null default 20 check (checkpoints >= 0),
  equipped_gun text,
  updated_at timestamptz not null default now()
);

create table if not exists public.mai_run_gun_ownership (
  player_id uuid not null references auth.users(id) on delete cascade,
  gun_key text not null check (gun_key in ('maipiks_popper', 'troll_court_judge', 'troll_city_blaster', 'maitroll_cannon')),
  purchased_at timestamptz not null default now(),
  primary key (player_id, gun_key)
);

alter table public.mai_run_inventory enable row level security;
alter table public.mai_run_gun_ownership enable row level security;

revoke all on public.mai_run_inventory, public.mai_run_gun_ownership from anon, authenticated;
grant select on public.mai_run_inventory, public.mai_run_gun_ownership to authenticated;

create policy "Read own MaiTroll Run inventory"
  on public.mai_run_inventory for select to authenticated
  using (player_id = (select auth.uid()));

create policy "Read own MaiTroll Run guns"
  on public.mai_run_gun_ownership for select to authenticated
  using (player_id = (select auth.uid()));

create or replace function public.mai_run_get_inventory()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inventory public.mai_run_inventory%rowtype;
  balance numeric;
  guns text[];
begin
  if uid is null then raise exception 'Sign in required'; end if;

  insert into public.mai_run_inventory(player_id)
  values (uid)
  on conflict (player_id) do nothing;

  select * into inventory
  from public.mai_run_inventory
  where player_id = uid;

  select troll_coins into balance
  from public.user_profiles
  where id = uid;

  if not found then raise exception 'MaiTroll profile unavailable'; end if;

  select coalesce(array_agg(gun_key order by purchased_at), array[]::text[])
  into guns
  from public.mai_run_gun_ownership
  where player_id = uid;

  return jsonb_build_object(
    'checkpoints', inventory.checkpoints,
    'equipped_gun', inventory.equipped_gun,
    'owned_guns', guns,
    'troll_coins', balance
  );
end;
$$;

create or replace function public.mai_run_buy_checkpoint()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  remaining numeric;
  new_count integer;
begin
  if uid is null then raise exception 'Sign in required'; end if;

  insert into public.mai_run_inventory(player_id)
  values (uid)
  on conflict (player_id) do nothing;

  perform 1 from public.mai_run_inventory where player_id = uid for update;
  update public.user_profiles
  set troll_coins = troll_coins - 5
  where id = uid and troll_coins >= 5
  returning troll_coins into remaining;
  if not found then raise exception 'Not enough Troll Coins (5 required)'; end if;

  update public.mai_run_inventory
  set checkpoints = checkpoints + 1, updated_at = now()
  where player_id = uid
  returning checkpoints into new_count;

  return jsonb_build_object('checkpoints', new_count, 'troll_coins', remaining);
end;
$$;

create or replace function public.mai_run_buy_gun(p_gun_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cost integer;
  remaining numeric;
  balance numeric;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  cost := case p_gun_key
    when 'maipiks_popper' then 500
    when 'troll_court_judge' then 2500
    when 'troll_city_blaster' then 9000
    when 'maitroll_cannon' then 20000
    else null
  end;
  if cost is null then raise exception 'Unknown weapon'; end if;

  insert into public.mai_run_inventory(player_id)
  values (uid)
  on conflict (player_id) do nothing;
  perform 1 from public.mai_run_inventory where player_id = uid for update;

  if exists (
    select 1 from public.mai_run_gun_ownership
    where player_id = uid and gun_key = p_gun_key
  ) then raise exception 'You already own this weapon'; end if;

  update public.user_profiles
  set troll_coins = troll_coins - cost
  where id = uid and troll_coins >= cost
  returning troll_coins into remaining;
  if not found then raise exception 'Not enough Troll Coins'; end if;

  insert into public.mai_run_gun_ownership(player_id, gun_key)
  values (uid, p_gun_key);
  select troll_coins into balance from public.user_profiles where id = uid;
  return jsonb_build_object('troll_coins', balance, 'gun_key', p_gun_key);
end;
$$;

create or replace function public.mai_run_equip_gun(p_gun_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  equipped text;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  insert into public.mai_run_inventory(player_id)
  values (uid)
  on conflict (player_id) do nothing;

  if coalesce(p_gun_key, '') <> '' then
    if not exists (
      select 1 from public.mai_run_gun_ownership
      where player_id = uid and gun_key = p_gun_key
    ) then raise exception 'Weapon is not owned'; end if;
    equipped := p_gun_key;
  else
    equipped := null;
  end if;

  update public.mai_run_inventory
  set equipped_gun = equipped, updated_at = now()
  where player_id = uid;
  return equipped;
end;
$$;

create or replace function public.mai_run_complete_level(p_run uuid, p_level integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  run public.mai_run_results%rowtype;
  balance numeric;
  base_speed integer;
  minimum_seconds integer;
begin
  if uid is null then raise exception 'Sign in required'; end if;

  select * into run
  from public.mai_run_results
  where id = p_run and player_id = uid and status = 'active'
  for update;
  if not found then raise exception 'Run is no longer active'; end if;
  if p_level is null or p_level < 0 or p_level >= 8 or p_level <> run.levels_cleared then
    raise exception 'Invalid or duplicate level completion';
  end if;
  base_speed := case run.difficulty
    when 'easy' then 340
    when 'normal' then 390
    when 'brutal' then 440
    when 'nightmare' then 490
    else 0
  end;
  minimum_seconds := ceil(
    (6400 + p_level * 650)::numeric
      / (base_speed + p_level * 22)
      * 0.8
  )::integer;
  if now() < run.last_progress_at + make_interval(secs => minimum_seconds) then
    raise exception 'Level completion was too fast';
  end if;

  update public.user_profiles
  set troll_coins = troll_coins + 100
  where id = uid
  returning troll_coins into balance;
  if not found then raise exception 'MaiTroll profile unavailable'; end if;

  update public.mai_run_results
  set levels_cleared = levels_cleared + 1,
      troll_coins_earned = troll_coins_earned + 100,
      last_progress_at = now()
  where id = p_run;

  return jsonb_build_object('troll_coins', balance, 'reward', 100);
end;
$$;

create or replace function public.mai_run_use_checkpoint(p_run uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  run public.mai_run_results%rowtype;
  remaining integer;
begin
  if uid is null then raise exception 'Sign in required'; end if;

  select * into run
  from public.mai_run_results
  where id = p_run and player_id = uid and status = 'active'
  for update;
  if not found then raise exception 'Run is no longer active'; end if;
  if run.levels_cleared < 1 then raise exception 'Clear a level before using a checkpoint'; end if;
  if run.levels_cleared >= 8 then raise exception 'This run is already complete'; end if;

  insert into public.mai_run_inventory(player_id)
  values (uid)
  on conflict (player_id) do nothing;

  update public.mai_run_inventory
  set checkpoints = checkpoints - 1, updated_at = now()
  where player_id = uid and checkpoints > 0
  returning checkpoints into remaining;
  if not found then raise exception 'No checkpoints remain'; end if;

  update public.mai_run_results
  set checkpoint_uses = checkpoint_uses + 1
  where id = p_run;

  return remaining;
end;
$$;

create or replace function public.mai_run_fire_weapon(p_run uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  run_status text;
  weapon text;
  remaining numeric;
begin
  if uid is null then raise exception 'Sign in required'; end if;

  select status into run_status
  from public.mai_run_results
  where id = p_run and player_id = uid
  for update;
  if not found or run_status <> 'active' then raise exception 'Run is no longer active'; end if;

  select equipped_gun into weapon
  from public.mai_run_inventory
  where player_id = uid;
  if weapon is null or not exists (
    select 1 from public.mai_run_gun_ownership
    where player_id = uid and gun_key = weapon
  ) then raise exception 'Equip a weapon before firing'; end if;

  update public.user_profiles
  set troll_coins = troll_coins - 1
  where id = uid and troll_coins >= 1
  returning troll_coins into remaining;
  if not found then raise exception 'Not enough Troll Coins for ammunition'; end if;

  return jsonb_build_object('gun_key', weapon, 'troll_coins', remaining);
end;
$$;

create or replace function public.mai_run_finish(
  p_run uuid,
  p_score int,
  p_levels int,
  p_letters int,
  p_collected int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  update public.mai_run_results
  set status = 'finished',
      score = least(greatest(coalesce(p_score, 0), 0), 10000000),
      letters_collected = least(greatest(coalesce(p_letters, 0), 0), 8),
      coins_collected = least(greatest(coalesce(p_collected, 0), 0), 5000),
      finished_at = now()
  where id = p_run and player_id = auth.uid() and status = 'active';
  if not found then raise exception 'Run already finished or unavailable'; end if;
end;
$$;

revoke execute on function public.mai_run_get_inventory(),
  public.mai_run_buy_checkpoint(),
  public.mai_run_buy_gun(text),
  public.mai_run_equip_gun(text),
  public.mai_run_complete_level(uuid, integer),
  public.mai_run_use_checkpoint(uuid),
  public.mai_run_fire_weapon(uuid)
from public;

grant execute on function public.mai_run_get_inventory(),
  public.mai_run_buy_checkpoint(),
  public.mai_run_buy_gun(text),
  public.mai_run_equip_gun(text),
  public.mai_run_complete_level(uuid, integer),
  public.mai_run_use_checkpoint(uuid),
  public.mai_run_fire_weapon(uuid)
to authenticated;
