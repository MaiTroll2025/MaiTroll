-- Remove candidate eligibility requirements for president signups.
create or replace function signup_president_candidate(
  p_election_id uuid,
  p_banner_path text,
  p_display_name text,
  p_slogan text,
  p_statement text
)
returns uuid
security definer
language plpgsql
as $$
declare
  v_id uuid;
  v_status text;
begin
  -- Check election open
  if not exists (select 1 from president_elections where id = p_election_id and status = 'open') then
    raise exception 'Election not open';
  end if;

  -- Default status: pending
  v_status := 'pending';

  insert into president_candidates (election_id, user_id, status, banner_path, display_name, slogan, statement)
  values (p_election_id, auth.uid(), v_status, p_banner_path, p_display_name, p_slogan, p_statement)
  returning id into v_id;

  return v_id;
end;
$$;
