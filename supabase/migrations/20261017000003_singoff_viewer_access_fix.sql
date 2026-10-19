-- Fix Sing Off viewer access to allow any viewer to watch active sessions
-- similar to how broadcast streams work

create or replace function public.singoff_validate_token_access(
  p_room_name text,
  p_user_id uuid,
  p_mode text
) returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as 
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
    -- Allow any authenticated viewer to watch an active session
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
;

revoke all on function public.singoff_validate_token_access(text, uuid, text) from public, anon;
grant execute on function public.singoff_validate_token_access(text, uuid, text) to authenticated;
