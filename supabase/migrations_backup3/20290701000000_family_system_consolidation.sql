-- =============================================================================
-- FAMILY SYSTEM CONSOLIDATION MIGRATION
-- =============================================================================
-- PURPOSE: Consolidate duplicate family tables into canonical tables.
-- CANONICAL TABLES:
--   - family_members     (canonical membership — replaces troll_family_members, troll_family_memberships)
--   - family_wars        (canonical wars — replaces troll_family_wars)
--   - family_goals       (canonical goals — replaces family_tasks)
--   - troll_families     (canonical family table — kept as-is)
--
-- DEPRECATED TABLES (kept for data, but code should stop using them):
--   - troll_family_members
--   - troll_family_memberships
--   - troll_family_wars
--   - family_tasks
--
-- PHASE 1: Compatibility views so old code does not break immediately.
-- PHASE 2: Battle event tracking RPC.
-- PHASE 3: Agency goals + achievements.
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Ensure family_members has all columns needed from troll_family_members
-- =============================================================================
DO $$
BEGIN
    -- approval_status already added by leagues migration, but ensure it exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'family_members' AND column_name = 'approval_status'
    ) THEN
        ALTER TABLE public.family_members
        ADD COLUMN approval_status text DEFAULT 'approved'
        CHECK (approval_status IN ('pending', 'approved', 'denied'));
    END IF;

    -- Ensure joined_at exists (troll_family_members has it)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'family_members' AND column_name = 'joined_at'
    ) THEN
        ALTER TABLE public.family_members
        ADD COLUMN joined_at timestamptz DEFAULT NOW();
    END IF;

    -- Ensure updated_at exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'family_members' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.family_members
        ADD COLUMN updated_at timestamptz DEFAULT NOW();
    END IF;
END $$;

-- =============================================================================
-- STEP 2: Ensure family_wars has all columns needed from troll_family_wars
-- =============================================================================
DO $$
BEGIN
    -- family_wars already has: id, attacking_family_id, defending_family_id, war_type,
    --   status, start_time, end_time, created_at, family_a_id, family_b_id
    -- troll_family_wars has: id, challenger_family_id, defender_family_id, status,
    --   challenger_score, defender_score, start_time, end_time, created_at
    --
    -- We need to add challenger/defender columns to family_wars for compatibility

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'family_wars' AND column_name = 'challenger_family_id'
    ) THEN
        ALTER TABLE public.family_wars
        ADD COLUMN challenger_family_id uuid;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'family_wars' AND column_name = 'defender_family_id'
    ) THEN
        ALTER TABLE public.family_wars
        ADD COLUMN defender_family_id uuid;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'family_wars' AND column_name = 'challenger_score'
    ) THEN
        ALTER TABLE public.family_wars
        ADD COLUMN challenger_score integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'family_wars' AND column_name = 'defender_score'
    ) THEN
        ALTER TABLE public.family_wars
        ADD COLUMN defender_score integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'family_wars' AND column_name = 'winner_family_id'
    ) THEN
        ALTER TABLE public.family_wars
        ADD COLUMN winner_family_id uuid;
    END IF;
END $$;

-- =============================================================================
-- STEP 3: Backfill family_wars.challenger/defender from family_a/family_b
-- =============================================================================
UPDATE public.family_wars
SET challenger_family_id = COALESCE(challenger_family_id, family_a_id, attacking_family_id),
    defender_family_id = COALESCE(defender_family_id, family_b_id, defending_family_id)
WHERE challenger_family_id IS NULL OR defender_family_id IS NULL;

-- =============================================================================
-- STEP 4: COMPATIBILITY VIEW — troll_family_members -> family_members
-- The old troll_family_members is a real table, so we must rename it first,
-- then create a view in its place so old code that queries it still works.
-- =============================================================================

-- Rename old table if it exists as a table (safe idempotent rename)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'troll_family_members' AND table_type = 'BASE TABLE'
    ) THEN
        -- Only rename if the deprecated copy doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = '_deprecated_troll_family_members'
        ) THEN
            ALTER TABLE public.troll_family_members
            RENAME TO _deprecated_troll_family_members;
        ELSE
            -- Deprecated copy already exists; drop the live table
            DROP TABLE IF EXISTS public.troll_family_members;
        END IF;
    END IF;
END $$;

CREATE OR REPLACE VIEW public.troll_family_members AS
SELECT
    fm.id,
    fm.family_id,
    fm.user_id,
    fm.role,
    fm.is_royal_troll,
    fm.rank_name,
    fm.joined_by,
    fm.created_at
FROM public.family_members fm;

ALTER VIEW public.troll_family_members SET (security_invoker = true);

-- =============================================================================
-- STEP 5: COMPATIBILITY VIEW — troll_family_memberships -> family_members
-- =============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'troll_family_memberships' AND table_type = 'BASE TABLE'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = '_deprecated_troll_family_memberships'
        ) THEN
            ALTER TABLE public.troll_family_memberships
            RENAME TO _deprecated_troll_family_memberships;
        ELSE
            DROP TABLE IF EXISTS public.troll_family_memberships;
        END IF;
    END IF;
END $$;

CREATE OR REPLACE VIEW public.troll_family_memberships AS
SELECT
    fm.id,
    fm.family_id,
    fm.user_id,
    fm.role,
    fm.joined_at
FROM public.family_members fm;

ALTER VIEW public.troll_family_memberships SET (security_invoker = true);

-- =============================================================================
-- STEP 6: COMPATIBILITY VIEW — troll_family_wars -> family_wars
-- Maps old column names (challenger_family_id, defender_family_id, etc.)
-- to the canonical family_wars table.
-- =============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'troll_family_wars' AND table_type = 'BASE TABLE'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = '_deprecated_troll_family_wars'
        ) THEN
            ALTER TABLE public.troll_family_wars
            RENAME TO _deprecated_troll_family_wars;
        ELSE
            DROP TABLE IF EXISTS public.troll_family_wars;
        END IF;
    END IF;
END $$;

CREATE OR REPLACE VIEW public.troll_family_wars AS
SELECT
    fw.id,
    fw.challenger_family_id,
    fw.defender_family_id,
    fw.status,
    fw.challenger_score,
    fw.defender_score,
    fw.start_time,
    fw.end_time,
    fw.created_at,
    fw.war_type,
    fw.winner_family_id,
    fw.family_a_id,
    fw.family_b_id
FROM public.family_wars fw;

ALTER VIEW public.troll_family_wars SET (security_invoker = true);

-- =============================================================================
-- STEP 7: Migrate data from troll_family_members -> family_members
-- (Only insert if not already present to avoid duplicates)
-- =============================================================================
INSERT INTO public.family_members (id, family_id, user_id, role, is_royal_troll, rank_name, joined_by, created_at, approval_status)
SELECT
    COALESCE(tfm.id, gen_random_uuid()),
    tfm.family_id,
    tfm.user_id,
    tfm.role,
    tfm.is_royal_troll,
    tfm.rank_name,
    tfm.joined_by,
    COALESCE(tfm.created_at, NOW()),
    'approved'
FROM public.troll_family_members tfm
WHERE NOT EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.user_id = tfm.user_id AND fm.family_id = tfm.family_id
);

-- =============================================================================
-- STEP 8: Migrate data from troll_family_wars -> family_wars
-- =============================================================================
INSERT INTO public.family_wars (
    challenger_family_id, defender_family_id, status,
    challenger_score, defender_score, start_time, end_time, created_at
)
SELECT
    tfw.challenger_family_id,
    tfw.defender_family_id,
    tfw.status,
    tfw.challenger_score,
    tfw.defender_score,
    tfw.start_time,
    tfw.end_time,
    COALESCE(tfw.created_at, NOW())
FROM public.troll_family_wars tfw
WHERE NOT EXISTS (
    SELECT 1 FROM public.family_wars fw
    WHERE fw.challenger_family_id = tfw.challenger_family_id
    AND fw.defender_family_id = tfw.defender_family_id
    AND fw.created_at = COALESCE(tfw.created_at, NOW())
);

-- =============================================================================
-- STEP 9: Ensure family_goals has goal_type values for battle tracking
-- =============================================================================
DO $$
BEGIN
    -- Ensure goal_type constraint includes 'battle' if it doesn't already
    -- The existing constraint is a CHECK on category, not goal_type
    -- goal_type is free text, so no constraint change needed
END $$;

-- =============================================================================
-- STEP 10: Add indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_approval ON public.family_members(approval_status);
CREATE INDEX IF NOT EXISTS idx_family_wars_challenger ON public.family_wars(challenger_family_id);
CREATE INDEX IF NOT EXISTS idx_family_wars_defender ON public.family_wars(defender_family_id);
CREATE INDEX IF NOT EXISTS idx_family_wars_status ON public.family_wars(status);

COMMIT;
