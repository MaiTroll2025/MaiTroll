-- =============================================================================
-- BATTLE AUDIT LOG
-- =============================================================================
-- Traceability table for all battle events. Records every battle completion,
-- penalty, farming detection, and too-short battle for audit purposes.
-- =============================================================================

BEGIN;

-- =============================================================================
-- TABLE: battle_audit_log
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.battle_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id uuid,
    event_type text NOT NULL CHECK (event_type IN (
        'battle_completed',
        'forfeit_penalty',
        'disconnect_penalty',
        'afk_penalty',
        'farming_detected',
        'battle_too_short',
        'toxic_mod_action'
    )),
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_battle_audit_battle_id ON public.battle_audit_log(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_audit_event_type ON public.battle_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_battle_audit_created_at ON public.battle_audit_log(created_at);

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.battle_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read battle audit log"
    ON public.battle_audit_log FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Service role can insert battle audit log"
    ON public.battle_audit_log FOR INSERT
    TO service_role WITH CHECK (true);

-- Also grant insert to authenticated (RPC runs as SECURITY DEFINER but just in case)
GRANT INSERT ON public.battle_audit_log TO authenticated;
-- Note: no sequence grant needed — id uses gen_random_uuid(), not a serial

COMMIT;
