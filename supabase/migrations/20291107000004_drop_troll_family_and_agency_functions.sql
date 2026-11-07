-- Drop troll family functions (feature removed from codebase)
DROP FUNCTION IF EXISTS public.get_family_weekly_reward_total(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.award_family_coins(uuid, text, uuid, integer, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.generate_family_goals(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.complete_family_goal(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_family_heartbeat(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_troll_family(text, text, text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_family_participation(uuid, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.create_family_tasks(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.increment_family_stats(uuid, bigint, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.join_family(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.kick_family_member(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.promote_family_member(uuid, uuid, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.leave_family(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.record_troll_family_activity(uuid, text, numeric, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.user_is_family_member(uuid) CASCADE;

-- Drop agency functions (feature removed from codebase)
DROP FUNCTION IF EXISTS public.apply_for_agency_from_family(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.apply_for_agency_with_fee(text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.apply_for_gaming_agency_loan(numeric) CASCADE;
DROP FUNCTION IF EXISTS public.approve_agency_application_atomic(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.manage_agency_member(uuid, uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.reject_family_agency_conversion(uuid, uuid, text) CASCADE;
