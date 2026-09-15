-- Link moderation_reports to MAi School institutions
-- Phase 2: Allows school incidents to reference a moderation report
-- and lets the moderation engine know which institution a report came from.

DO $$
BEGIN
    IF to_regclass('public.moderation_reports') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'moderation_reports'
              AND column_name = 'institution_id'
        ) THEN
            ALTER TABLE public.moderation_reports
                ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE indexname = 'idx_moderation_reports_institution'
        ) THEN
            CREATE INDEX idx_moderation_reports_institution
                ON public.moderation_reports(institution_id);
        END IF;
    END IF;
END;
$$;
