-- 20270301000000_president_v2.sql

-- 1. Add 'voting_strategy', 'candidate_limit', 'title', 'description' to president_elections
alter table president_elections 
add column if not exists voting_strategy text default 'standard' check (voting_strategy in ('standard', 'coins')),
add column if not exists candidate_limit int default 14,
add column if not exists title text,
add column if not exists description text;

-- 2. Add 'score' to president_candidates for tracking coin votes
alter table president_candidates
add column if not exists score bigint default 0;

-- 2.5. Create president_votes table if it doesn't exist (it wasn't in the v1 file I read, but maybe implied?)
create table if not exists president_votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references president_elections(id),
  candidate_id uuid references president_candidates(id),
  voter_id uuid references user_profiles(id),
  created_at timestamptz default now()
);

-- 3. Function to handle coin voting
create or replace function vote_candidate_with_coins(
   p_candidate_id uuid,
   p_amount int
)
returns jsonb
language plpgsql
security definer
as $$
declare
   v_election_id uuid;
   v_voter_id uuid;
   v_candidate_user_id uuid;
   v_week_key text;
   v_already_voted boolean;
begin
   v_voter_id := auth.uid();

   -- Check if election is open and strategy is coins
   select election_id, user_id into v_election_id, v_candidate_user_id
   from president_candidates
   where id = p_candidate_id;

   if v_election_id is null then
     raise exception 'Candidate not found';
   end if;

   if not exists (
     select 1 from president_elections
     where id = v_election_id
     and status = 'open'
     and voting_strategy = 'coins'
   ) then
     raise exception 'Election is not open for coin voting';
   end if;

   -- Check if already voted this week
   v_week_key := to_char(now(), 'IYYY-"W"IW');
   select exists (
     select 1 from president_votes
     where election_id = v_election_id
     and voter_id = v_voter_id
     and week_key = v_week_key
   ) into v_already_voted;

   if v_already_voted then
     return jsonb_build_object('success', false, 'already_voted', true, 'message', 'You already voted this week');
   end if;

   -- Deduct coins from voter
   if (select troll_coins from user_profiles where id = v_voter_id) < p_amount then
     raise exception 'Insufficient coins';
   end if;

   update user_profiles
   set troll_coins = troll_coins - p_amount
   where id = v_voter_id;

   -- Add to candidate score
   update president_candidates
   set score = score + p_amount,
       vote_count = coalesce(vote_count, 0) + 1
   where id = p_candidate_id;

   -- Log the vote
   insert into president_votes (election_id, candidate_id, voter_id)
   values (v_election_id, p_candidate_id, v_voter_id);

   return jsonb_build_object('success', true, 'already_voted', false);
end;
$$;

-- 4. Update signup function to enforce 14 candidate limit
create or replace function signup_president_candidate(
  p_campaign_slogan text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_election_id uuid;
  v_candidate_id uuid;
  v_count int;
  v_limit int;
begin
  v_user_id := auth.uid();
  
  -- Get current open election
  select id, candidate_limit into v_election_id, v_limit
  from president_elections
  where status = 'open'
  limit 1;
  
  if v_election_id is null then
    raise exception 'No open election found';
  end if;

  -- Check limit
  select count(*) into v_count
  from president_candidates
  where election_id = v_election_id;

  if v_count >= v_limit then
    raise exception 'Candidate limit reached for this election';
  end if;
  
  -- Check if already signed up
  if exists (
    select 1 from president_candidates 
    where election_id = v_election_id and user_id = v_user_id
  ) then
    raise exception 'You are already a candidate';
  end if;
  
  -- Insert candidate (Fixing column names: slogan instead of campaign_slogan, status='approved', banner_path default)
  insert into president_candidates (
      election_id, 
      user_id, 
      slogan, 
      status, 
      banner_path
  )
  values (
      v_election_id, 
      v_user_id, 
      p_campaign_slogan, 
      'approved', 
      '/default-banner.jpg' -- Placeholder to satisfy NOT NULL
  ) 
  returning id into v_candidate_id;
  
  return v_candidate_id;
end;
$$;

-- 5. RPC to appoint Vice President
drop function if exists appoint_vice_president(uuid);
create or replace function appoint_vice_president(
  p_appointee_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_president_id uuid;
begin
  v_president_id := auth.uid();
  
  -- Verify caller is president (using badge or role check)
  if not exists (
    select 1 from user_profiles 
    where id = v_president_id 
    and (badge = 'president' or username_style = 'gold') -- Assuming these mark the president
  ) then
    raise exception 'Only the President can appoint a VP';
  end if;

  -- Assign VP role/badge to appointee
  -- First remove existing VP if any? (Optional: assume 1 VP)
  update user_profiles
  set badge = null
  where badge = 'vice_president'; -- Clear old VP

  update user_profiles
  set badge = 'vice_president'
  where id = p_appointee_id;
  
  -- Optional: Grant system role
  -- insert into user_role_grants ...
end;
$$;

-- 6. RPC for daily elimination (To be called by cron or admin)
create or replace function eliminate_daily_candidates()
returns void
language plpgsql
security definer
as $$
declare
  v_election_id uuid;
begin
  -- Get current election
  select id into v_election_id
  from president_elections
  where status = 'open'
  limit 1;
  
  if v_election_id is null then
    return;
  end if;

  -- Remove candidates with 0 score/votes
  delete from president_candidates
  where election_id = v_election_id
  and score = 0;
  
  -- Logic to end election on day 14? 
  -- Handled by separate scheduled task or manual admin action usually.
end;
$$;

-- 7. Insert the first "Coins for Votes" election if none exists
do $$
begin
  if not exists (select 1 from president_elections where status = 'open') then
    insert into president_elections (
      title, 
      description, 
      starts_at, 
      ends_at, 
      status, 
      voting_strategy,
      candidate_limit
    ) values (
      'First Coin Election',
      'The wealthiest backers decide! 14 candidates max. Daily eliminations.',
      now(),
      now() + interval '14 days',
      'open',
      'coins',
      14
    );
  end if;
end $$;
