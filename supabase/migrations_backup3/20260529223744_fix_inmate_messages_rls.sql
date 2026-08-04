-- Fix inmate_messages RLS policies + jail status constraint
-- 1. Add missing RLS policies on inmate_messages (were never applied)
-- 2. Relax jail_status_check constraint that blocks bond releases

-- ═══════════════════════════════════════════════════════════════════════════
-- INMATE_MESSAGES RLS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.inmate_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inmates and participants can view messages" ON public.inmate_messages;
CREATE POLICY "Inmates and participants can view messages"
  ON public.inmate_messages FOR SELECT
  USING (
    inmate_id = auth.uid()
    OR sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true OR is_troll_officer = true OR is_lead_officer = true)
    )
  );

DROP POLICY IF EXISTS "Inmates and staff can create messages" ON public.inmate_messages;
CREATE POLICY "Inmates and staff can create messages"
  ON public.inmate_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    OR inmate_id = auth.uid()
    OR recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true OR is_troll_officer = true OR is_lead_officer = true)
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- JAIL STATUS CONSTRAINT
-- The jail_status_check constraint was added outside migrations and may
-- reject valid status transitions (e.g. bond release setting status).
-- Drop it and replace with a permissive one.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.jail DROP CONSTRAINT IF EXISTS jail_status_check;

ALTER TABLE IF EXISTS public.jail
  ADD CONSTRAINT jail_status_check
  CHECK (status IN ('jailed', 'released', 'released_pending_trial', 'released_bond', 'released_sentence', 'transferred', 'escaped'));
