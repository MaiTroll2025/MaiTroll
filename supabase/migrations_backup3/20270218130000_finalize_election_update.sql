-- Update finalize_president_election to award badges and grants
create or replace function finalize_president_election(p_election_id uuid, p_winner_id uuid)
returns void
security definer
language plpgsql
as $$
declare
  v_role_id uuid;
  v_term_end timestamptz;
begin
  -- Check permission (Admin/Secretary)
  if not exists (select 1 from user_profiles where id = auth.uid() and (is_admin = true or role = 'secretary')) then
     raise exception 'Not authorized';
  end if;

  -- Get President Role ID
  select id into v_role_id from system_roles where name = 'president';
  if v_role_id is null then
    raise exception 'System role "president" not found';
  end if;

  -- Term is 14 days
  v_term_end := now() + interval '14 days';

  -- Expire current president
  update user_role_grants
  set expires_at = now()
  where role_id = v_role_id and (expires_at is null or expires_at > now());
  
  -- Remove 'president' badge from old presidents
  update user_profiles
  set badge = null, username_style = null
  where badge = 'president';

  -- Grant new president role
  insert into user_role_grants (user_id, role_id, expires_at)
  values (p_winner_id, v_role_id, v_term_end);

  -- Award Badge and Gold Style
  update user_profiles
  set badge = 'president', username_style = 'gold'
  where id = p_winner_id;

  -- Close election
  update president_elections 
  set status = 'finalized', 
      winner_candidate_id = (select id from president_candidates where election_id = p_election_id and user_id = p_winner_id),
      updated_at = now()
  where id = p_election_id;
  
  -- Log
  insert into president_audit_logs (action_type, description, actor_id)
  values ('election_finalized', 'Election finalized. Winner: ' || p_winner_id, auth.uid());

end;
$$;

-- Emergency Removal of President
create or replace function remove_president(p_reason text)
returns void
security definer
language plpgsql
as $$
declare
  v_pres_role_id uuid;
begin
  -- Check permission (Admin only)
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin = true) then
     raise exception 'Not authorized';
  end if;

  select id into v_pres_role_id from system_roles where name = 'president';

  -- Expire Role
  update user_role_grants
  set expires_at = now()
  where role_id = v_pres_role_id and (expires_at is null or expires_at > now());

  -- Remove Badge
  update user_profiles
  set badge = null, username_style = null
  where badge = 'president';
  
  -- Log
  insert into president_audit_logs (action_type, description, actor_id)
  values ('impeachment', 'President removed by Admin. Reason: ' || p_reason, auth.uid());
end;
$$;
