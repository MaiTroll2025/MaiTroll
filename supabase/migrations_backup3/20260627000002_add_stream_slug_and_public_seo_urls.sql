-- ============================================================================
-- PUBLIC SEO-FRIENDLY URLS FOR PROFILES AND STREAMS (SAFE)
-- Adds slug support, ensures username lookups are fast, and prepares
-- for public shareable URLs like /kain and /kain/live/smokeathon
--
-- PRODUCTION-SAFE: Never deletes streams. Renames duplicates instead.
-- Idempotent: Safe to run multiple times.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Ensure streams.slug column exists
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'streams'
          AND column_name = 'slug'
    ) THEN
        ALTER TABLE streams ADD COLUMN slug TEXT;
        RAISE NOTICE 'Added slug column to streams';
    ELSE
        RAISE NOTICE 'streams.slug already exists - skipping';
    END IF;
END $$;

-- ============================================================================
-- 2. Backfill any NULL/empty slugs from stream titles (or UUID fallback)
--    Only touches rows where slug is NULL or empty string.
-- ============================================================================
UPDATE streams
SET slug = lower(regexp_replace(
    regexp_replace(
        COALESCE(NULLIF(title, ''), id::text),
        '[^a-zA-Z0-9]+', '-', 'g'
    ),
    '(^-|-$)', '', 'g'
))
WHERE slug IS NULL OR trim(slug) = '';

-- ============================================================================
-- 3. RENAME duplicate slugs per owner (NEVER delete)
--    For each (user_id, slug) group with >1 row, keep the oldest and
--    rename the rest to slug-2, slug-3, etc.
-- ============================================================================
DO $$
DECLARE
    dup_record RECORD;
    new_slug TEXT;
    counter INTEGER;
    r RECORD;
BEGIN
    -- Cursor through all (user_id, slug) combos that have duplicates
    FOR dup_record IN
        SELECT user_id, slug, COUNT(*) AS cnt
        FROM streams
        WHERE slug IS NOT NULL AND trim(slug) != ''
        GROUP BY user_id, slug
        HAVING COUNT(*) > 1
    LOOP
        counter := 0;
        -- Loop through all but the oldest (keep oldest unchanged)
        FOR r IN
            SELECT id
            FROM streams
            WHERE user_id = dup_record.user_id
              AND slug = dup_record.slug
            ORDER BY created_at ASC
        LOOP
            counter := counter + 1;
            IF counter = 1 THEN
                -- Keep the first (oldest) as-is
                CONTINUE;
            END IF;

            -- Generate new unique slug: slug-2, slug-3, etc.
            new_slug := dup_record.slug || '-' || counter::text;

            -- Ensure the new slug doesn't also conflict (rare edge case)
            WHILE EXISTS (
                SELECT 1 FROM streams
                WHERE user_id = dup_record.user_id
                  AND slug = new_slug
                  AND id != r.id
            ) LOOP
                counter := counter + 1;
                new_slug := dup_record.slug || '-' || counter::text;
            END LOOP;

            UPDATE streams SET slug = new_slug WHERE id = r.id;
            RAISE NOTICE 'Renamed duplicate slug for user %: % -> %', dup_record.user_id, dup_record.slug, new_slug;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- 4. Add UNIQUE constraint on (user_id, slug) for public URL uniqueness
--    Using ALTER TABLE ... ADD CONSTRAINT so it's idempotent-safe.
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'streams_user_slug_unique'
          AND conrelid = 'streams'::regclass
    ) THEN
        ALTER TABLE streams
        ADD CONSTRAINT streams_user_slug_unique
        UNIQUE (user_id, slug);
        RAISE NOTICE 'Added UNIQUE(user_id, slug) on streams';
    ELSE
        RAISE NOTICE 'streams_user_slug_unique already exists - skipping';
    END IF;
END $$;

-- ============================================================================
-- 5. Add index on user_profiles.username for fast public profile lookups
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'user_profiles_username_lower_idx'
    ) THEN
        CREATE INDEX user_profiles_username_lower_idx
        ON user_profiles (lower(username));
        RAISE NOTICE 'Added index on lower(user_profiles.username)';
    ELSE
        RAISE NOTICE 'user_profiles_username_lower_idx already exists - skipping';
    END IF;
END $$;

-- ============================================================================
-- 6. Add index on streams (user_id, slug) for combined lookups
--    (The unique constraint already creates an implicit index, but we add
--     an explicit one for clarity and to ensure it exists.)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'streams_user_id_slug_idx'
    ) THEN
        CREATE INDEX streams_user_id_slug_idx
        ON streams (user_id, slug);
        RAISE NOTICE 'Added index on streams (user_id, slug)';
    ELSE
        RAISE NOTICE 'streams_user_id_slug_idx already exists - skipping';
    END IF;
END $$;

-- ============================================================================
-- 7. Add is_public column to streams for noindex control
--    Default true = public streams are indexed.
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'streams'
          AND column_name = 'is_public'
    ) THEN
        ALTER TABLE streams ADD COLUMN is_public BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added is_public column to streams (default true)';
    ELSE
        RAISE NOTICE 'streams.is_public already exists - skipping';
    END IF;
END $$;

-- ============================================================================
-- 8. Add is_indexed column to user_profiles for noindex control
--    Default true = profiles are indexed.
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_profiles'
          AND column_name = 'is_indexed'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN is_indexed BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added is_indexed column to user_profiles (default true)';
    ELSE
        RAISE NOTICE 'user_profiles.is_indexed already exists - skipping';
    END IF;
END $$;

-- ============================================================================
-- 9. Add is_profile_public column to control profile visibility
--    Default true = profiles are publicly visible.
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_profiles'
          AND column_name = 'is_profile_public'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN is_profile_public BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added is_profile_public column to user_profiles (default true)';
    ELSE
        RAISE NOTICE 'user_profiles.is_profile_public already exists - skipping';
    END IF;
END $$;

-- ============================================================================
-- 10. Auto-generate slug from title (only on INSERT or when slug is empty)
--     Does NOT overwrite existing slugs when title changes.
--     Handles duplicates by appending -2, -3, etc.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_stream_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    candidate_slug TEXT;
    counter INTEGER := 2;
BEGIN
    -- Only set slug if it's NULL or empty (never overwrite existing)
    IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
        -- Generate base slug from title (or UUID fallback)
        base_slug := lower(regexp_replace(
            regexp_replace(
                COALESCE(NULLIF(NEW.title, ''), NEW.id::text),
                '[^a-zA-Z0-9]+', '-', 'g'
            ),
            '(^-|-$)', '', 'g'
        ));

        -- If base_slug is empty after sanitization, use UUID
        IF base_slug = '' OR base_slug IS NULL THEN
            base_slug := NEW.id::text;
        END IF;

        candidate_slug := base_slug;

        -- Check for duplicates and append counter if needed
        WHILE EXISTS (
            SELECT 1 FROM streams
            WHERE user_id = NEW.user_id
              AND slug = candidate_slug
              AND id IS DISTINCT FROM NEW.id
        ) LOOP
            candidate_slug := base_slug || '-' || counter::text;
            counter := counter + 1;
        END LOOP;

        NEW.slug := candidate_slug;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create (idempotent)
DROP TRIGGER IF EXISTS trg_generate_stream_slug ON streams;
CREATE TRIGGER trg_generate_stream_slug
    BEFORE INSERT ON streams
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_stream_slug();

DO $$
BEGIN
    RAISE NOTICE 'Migration complete: public SEO-friendly URLs are ready (production-safe)';
END $$;

COMMIT;
