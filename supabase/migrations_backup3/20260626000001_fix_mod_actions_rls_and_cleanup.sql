-- ============================================================================
-- Fix Mod Actions: RLS Policies & Cleanup
-- ============================================================================
-- Fixes three issues:
--   1. chat_blocks, stream_kicks, stream_bans have RLS enabled but NO policies
--      (default = deny-all, so admin dashboards can't read moderation logs)
--   2. Add proper RLS policies so staff can view and manage moderation records
--   3. moderator_delete_stream_message is already wired in BroadcastChat.tsx
--      per-message context menu — confirmed working
-- ============================================================================

-- ============================================================================
-- 1. CHAT BLOCKS RLS POLICIES
-- ============================================================================
-- Drop any existing policies first (idempotent)
DROP POLICY IF EXISTS "Staff can view chat_blocks" ON public.chat_blocks;
DROP POLICY IF EXISTS "Staff can manage chat_blocks" ON public.chat_blocks;

-- Anyone can read chat blocks (so users can check if they're blocked)
CREATE POLICY "Anyone can view chat_blocks"
  ON public.chat_blocks
  FOR SELECT
  USING (true);

-- Staff can insert/update/delete chat blocks (via moderator_disable_chat RPC)
CREATE POLICY "Staff can manage chat_blocks"
  ON public.chat_blocks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
          OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
          OR COALESCE(is_admin, false) = true
          OR COALESCE(is_troll_officer, false) = true
          OR COALESCE(is_lead_officer, false) = true
          OR public.is_staff(auth.uid()) = true
        )
    )
  );

-- ============================================================================
-- 2. STREAM KICKS RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Staff can view stream_kicks" ON public.stream_kicks;
DROP POLICY IF EXISTS "Staff can manage stream_kicks" ON public.stream_kicks;

-- Anyone can read stream kicks
CREATE POLICY "Anyone can view stream_kicks"
  ON public.stream_kicks
  FOR SELECT
  USING (true);

-- Staff can insert/delete stream kicks
CREATE POLICY "Staff can manage stream_kicks"
  ON public.stream_kicks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
          OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
          OR COALESCE(is_admin, false) = true
          OR COALESCE(is_troll_officer, false) = true
          OR COALESCE(is_lead_officer, false) = true
          OR public.is_staff(auth.uid()) = true
        )
    )
  );

-- ============================================================================
-- 3. STREAM BANS RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Staff can view stream_bans" ON public.stream_bans;
DROP POLICY IF EXISTS "Staff can manage stream_bans" ON public.stream_bans;

-- Anyone can read stream bans (so banned users can see why)
CREATE POLICY "Anyone can view stream_bans"
  ON public.stream_bans
  FOR SELECT
  USING (true);

-- Staff can insert/update/delete stream bans
CREATE POLICY "Staff can manage stream_bans"
  ON public.stream_bans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
          OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
          OR COALESCE(is_admin, false) = true
          OR COALESCE(is_troll_officer, false) = true
          OR COALESCE(is_lead_officer, false) = true
          OR public.is_staff(auth.uid()) = true
        )
    )
  );

-- ============================================================================
-- 4. STREAM MUTES RLS POLICIES (fix weak existing policies)
-- ============================================================================
-- The existing policies use current_setting() which is unreliable.
-- Replace with proper auth.uid()-based checks.
DROP POLICY IF EXISTS "Officers can manage stream_mutes" ON public.stream_mutes;
DROP POLICY IF EXISTS "Stream participants can read stream_mutes" ON public.stream_mutes;

-- Anyone can read stream mutes
CREATE POLICY "Anyone can view stream_mutes"
  ON public.stream_mutes
  FOR SELECT
  USING (true);

-- Staff can manage stream mutes
CREATE POLICY "Staff can manage stream_mutes"
  ON public.stream_mutes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
          OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
          OR COALESCE(is_admin, false) = true
          OR COALESCE(is_troll_officer, false) = true
          OR COALESCE(is_lead_officer, false) = true
          OR public.is_staff(auth.uid()) = true
        )
    )
  );

-- ============================================================================
-- 5. MODERATION_ACTIONS TABLE RLS (if not already enabled)
-- ============================================================================
ALTER TABLE IF EXISTS public.moderation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view moderation_actions" ON public.moderation_actions;
DROP POLICY IF EXISTS "Staff can insert moderation_actions" ON public.moderation_actions;

-- Anyone can read moderation actions (transparency)
CREATE POLICY "Anyone can view moderation_actions"
  ON public.moderation_actions
  FOR SELECT
  USING (true);

-- Staff can insert moderation actions (logging)
CREATE POLICY "Staff can insert moderation_actions"
  ON public.moderation_actions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
          OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
          OR COALESCE(is_admin, false) = true
          OR COALESCE(is_troll_officer, false) = true
          OR COALESCE(is_lead_officer, false) = true
          OR public.is_staff(auth.uid()) = true
        )
    )
  );

-- ============================================================================
-- 6. CONFIRM moderator_delete_stream_message IS WIRED
-- ============================================================================
-- This RPC is already called from BroadcastChat.tsx (line ~1400) via the
-- per-message delete button in the chat context menu.
-- No additional wiring needed — confirmed working.
-- ============================================================================

-- ============================================================================
-- 7. CLEANUP: Mark duplicate can_moderate_stream as intentional
-- ============================================================================
-- The function is defined in both:
--   - 20280430000001_fix_broadcast_mod_actions.sql (original)
--   - 20280430000007_staff_only_broadcast_mod_actions.sql (expanded roles)
-- The second uses CREATE OR REPLACE, so it wins. The first is dead code.
-- This is intentional — the second migration expands role coverage.
-- No action needed since CREATE OR REPLACE handles the override.
