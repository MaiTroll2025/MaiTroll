-- Approved judges are eligible to choose an open seat themselves, but are not
-- publishers or active judges until they claim one.

create or replace function public.singoff_is_approved_judge(
  p_session_id uuid,
  p_user_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (p_user_id = auth.uid() or public.singoff_is_staff(auth.uid()))
    and exists (
      select 1
      from public.mai_singoff_judges j
      where j.user_id = p_user_id
        and j.is_active
        and (j.session_id is null or j.session_id = p_session_id)
    ),
    false
  );
$$;

create or replace function public.singoff_get_session_state(
  p_session_id uuid,
  p_user_id uuid
) returns json
language sql
stable
as $$
  select json_build_object(
    'session', to_json(s),
    'participants', (
      select json_agg(to_json(p))
      from public.mai_singoff_participants p
      where p.session_id = s.id
    ),
    'queue', (
      select json_agg(to_json(q) order by q.sort_order)
      from public.mai_singoff_queue q
      where q.session_id = s.id
        and q.status in ('waiting','called','countdown','on_stage')
    ),
    'rounds', (
      select json_agg(to_json(r) order by r.round_number)
      from public.mai_singoff_rounds r
      where r.session_id = s.id
    ),
    'decisions', (
      select json_agg(to_json(d))
      from public.mai_singoff_decisions d
      where d.session_id = s.id
    ),
    'host_id', s.host_id,
    'is_staff', public.singoff_is_staff(auth.uid()),
    'is_admin', coalesce((
      select p.is_admin
        or p.is_ceo
        or p.role in ('admin','superadmin','ceo')
      from public.user_profiles p
      where p.id = auth.uid()
    ), false),
    'is_host', s.host_id = auth.uid(),
    'is_ceo', coalesce((
      select p.is_ceo
      from public.user_profiles p
      where p.id = auth.uid()
    ), false),
    'is_judge', public.singoff_is_active_judge(s.id, auth.uid()),
    'is_judge_eligible', public.singoff_is_approved_judge(s.id, auth.uid())
  )
  from public.mai_singoff_sessions s
  where s.id = p_session_id;
$$;

create or replace function public.singoff_claim_ceo_seat(
  p_session_id uuid
) returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_is_admin boolean;
begin
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'authentication required');
  end if;

  select s.status
  into v_status
  from public.mai_singoff_sessions s
  where s.id = p_session_id
  for update;

  if not found or v_status not in ('setup','active') then
    return json_build_object('success', false, 'error', 'show is not accepting seat claims');
  end if;

  select coalesce(
    p.is_admin
      or p.is_ceo
      or p.role in ('admin','superadmin','ceo'),
    false
  )
  into v_is_admin
  from public.user_profiles p
  where p.id = v_user_id;

  if not coalesce(v_is_admin, false) then
    return json_build_object('success', false, 'error', 'admin or CEO authorization required');
  end if;

  if exists (
    select 1
    from public.mai_singoff_participants p
    where p.session_id = p_session_id
      and p.position = 'ceo'
      and p.user_id <> v_user_id
  ) then
    return json_build_object('success', false, 'error', 'CEO seat is occupied');
  end if;

  insert into public.mai_singoff_participants (
    session_id,
    user_id,
    role,
    position,
    can_publish
  )
  values (
    p_session_id,
    v_user_id,
    'ceo_judge',
    'ceo',
    true
  )
  on conflict (session_id, user_id) do update
    set role = 'ceo_judge',
        position = 'ceo',
        can_publish = true,
        updated_at = now();

  return json_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', 'ceo_judge',
    'position', 'ceo'
  );
exception
  when unique_violation then
    return json_build_object('success', false, 'error', 'CEO seat was just claimed by someone else');
end;
$$;

create or replace function public.singoff_claim_judge_seat(
  p_session_id uuid,
  p_position text
) returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_role text;
  v_current_position text;
begin
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'authentication required');
  end if;

  if p_position not in ('judge_1','judge_2','judge_3','judge_4') then
    return json_build_object('success', false, 'error', 'invalid judge seat');
  end if;

  select s.status
  into v_status
  from public.mai_singoff_sessions s
  where s.id = p_session_id
  for update;

  if not found or v_status not in ('setup','active') then
    return json_build_object('success', false, 'error', 'show is not accepting seat claims');
  end if;

  if not exists (
    select 1
    from public.mai_singoff_judges j
    where j.user_id = v_user_id
      and j.is_active
      and (j.session_id is null or j.session_id = p_session_id)
  ) then
    return json_build_object('success', false, 'error', 'an active judge approval is required');
  end if;

  select p.role, p.position
  into v_role, v_current_position
  from public.mai_singoff_participants p
  where p.session_id = p_session_id
    and p.user_id = v_user_id;

  if v_role is not null
     and v_role not in ('audience','judge') then
    return json_build_object('success', false, 'error', 'leave your current role before claiming a judge seat');
  end if;

  if v_current_position is not null
     and v_current_position not in ('judge_1','judge_2','judge_3','judge_4') then
    return json_build_object('success', false, 'error', 'leave your current seat before claiming a judge seat');
  end if;

  if exists (
    select 1
    from public.mai_singoff_participants p
    where p.session_id = p_session_id
      and p.position = p_position
      and p.user_id <> v_user_id
  ) then
    return json_build_object('success', false, 'error', 'that judge seat is occupied');
  end if;

  insert into public.mai_singoff_participants (
    session_id,
    user_id,
    role,
    position,
    can_publish
  )
  values (
    p_session_id,
    v_user_id,
    'judge',
    p_position,
    true
  )
  on conflict (session_id, user_id) do update
    set role = 'judge',
        position = excluded.position,
        can_publish = true,
        updated_at = now();

  return json_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', 'judge',
    'position', p_position
  );
exception
  when unique_violation then
    return json_build_object('success', false, 'error', 'that seat was just claimed by someone else');
end;
$$;

revoke all on function public.singoff_is_approved_judge(uuid, uuid) from public, anon;
revoke all on function public.singoff_claim_judge_seat(uuid, text) from public, anon;
revoke all on function public.singoff_claim_ceo_seat(uuid) from public, anon;
grant execute on function public.singoff_is_approved_judge(uuid, uuid) to authenticated;
grant execute on function public.singoff_claim_judge_seat(uuid, text) to authenticated;
grant execute on function public.singoff_claim_ceo_seat(uuid) to authenticated;
grant execute on function public.singoff_get_session_state(uuid, uuid) to authenticated;
