create or replace function public.singoff_validate_token_access(
  p_room_name text,
  p_user_id uuid,
  p_mode text
) returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
begin
  if p_room_name is null or p_user_id is null or p_mode is null then
    return false;
  end if;

  select s.id
  into v_session_id
  from public.mai_singoff_sessions s
  where s.room_name = p_room_name
    and s.status = 'active'
    and s.ended_at is null;

  if v_session_id is null then
    return false;
  end if;

  if p_mode = 'singoff-viewer' then
    -- Allow any authenticated viewer to watch an active session.
    -- This matches the LiveKit viewer-token expectation for active Sing Off sessions.
    return true;
  end if;

  if p_mode = 'singoff-publisher' then
    return exists (
        select 1
        from public.user_profiles profile
        where profile.id = p_user_id
          and (
            profile.is_admin
            or profile.is_ceo
            or profile.role in ('admin','superadmin','ceo')
          )
      )
      or exists (
        select 1
        from public.mai_singoff_participants p
        where p.session_id = v_session_id
          and p.user_id = p_user_id
          and p.role in ('host','challenger','judge','host_judge','ceo_judge')
          and p.position is not null
          and p.can_publish
      );
  end if;

  return false;
end;
$$;

revoke all on function public.singoff_validate_token_access(text, uuid, text) from public, anon;
grant execute on function public.singoff_validate_token_access(text, uuid, text) to authenticated;

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
    display_name,
    avatar_url,
    level,
    troll_coins,
    can_publish
  )
  select
    p_session_id,
    v_user_id,
    'ceo_judge',
    'ceo',
    coalesce(nullif(p.display_name, ''), p.username, 'Mai (CEO)'),
    p.avatar_url,
    p.level,
    p.troll_coins,
    true
  from public.user_profiles p
  where p.id = v_user_id
  on conflict (session_id, user_id) do update
    set role = 'ceo_judge',
        position = 'ceo',
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        level = excluded.level,
        troll_coins = excluded.troll_coins,
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

revoke all on function public.singoff_claim_ceo_seat(uuid) from public, anon;
grant execute on function public.singoff_claim_ceo_seat(uuid) to authenticated;
