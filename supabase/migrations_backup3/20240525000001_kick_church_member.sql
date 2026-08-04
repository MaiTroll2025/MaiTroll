create or replace function kick_church_member(target_user_id uuid, reason text)
returns void
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  
  -- 1. Create Court Case
  insert into troll_court_cases (
    defendant_id,
    plaintiff_id,
    accusation,
    status,
    created_at
  ) values (
    target_user_id,
    current_user_id,
    'Kicked from Troll Church: ' || reason,
    'pending',
    now()
  );

  -- 2. Issue Warrant (Restricts site access)
  update user_profiles
  set has_active_warrant = true
  where id = target_user_id;
end;
$$;
