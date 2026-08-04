-- Restore/grant admin status WITHOUT wiping the user's staff troll_role.
-- The owner got locked out of the admin Supabase Usage dashboard after being
-- set to troll_role='judge' (staff), because the old admin check only honored
-- role/troll_role of admin/superadmin. We now keep the staff role AND grant
-- admin via the role + is_admin flags (mirrors hasRole() in src/lib/supabase.ts).

-- Reusable helper: grant admin, preserve troll_role.
create or replace function public.set_user_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_profiles
  set
    role = 'admin',
    is_admin = true,
    updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'user_profiles row not found for %', p_user_id;
  end if;
end;
$$;

grant execute on function public.set_user_admin(uuid) to authenticated, service_role;

-- One-time restore for the project owner. Replace the UUID below with your
-- auth user id (Supabase dashboard -> Authentication -> Users -> your row -> id).
-- The WHERE guard makes this idempotent and safe to re-run.
--
-- To find your id quickly, run:  select id, role, troll_role, is_admin from public.user_profiles where is_admin or role in ('admin','superadmin');
do $$
declare
  v_owner uuid := null; -- <-- PUT YOUR AUTH USER UUID HERE (leave null to skip auto-run)
begin
  if v_owner is not null then
    perform public.set_user_admin(v_owner);
  end if;
end $$;
