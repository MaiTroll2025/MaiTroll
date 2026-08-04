-- Migration: Fix Court Details and Incidents FKs (with data cleanup)
-- Description: Updates FKs for court tables to ON DELETE SET NULL, cleaning up orphans first.

DO $$
BEGIN

    ----------------------------------------------------------------
    -- 3. court_sessions
    ----------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_sessions') THEN
        
        -- judge_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_sessions' AND column_name = 'judge_id') THEN
            -- Cleanup orphans
            UPDATE court_sessions SET judge_id = NULL WHERE judge_id IS NOT NULL AND judge_id NOT IN (SELECT id FROM public.user_profiles);
            
            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'court_sessions_judge_id_fkey') THEN
                ALTER TABLE court_sessions DROP CONSTRAINT court_sessions_judge_id_fkey;
            END IF;
            ALTER TABLE court_sessions ADD CONSTRAINT court_sessions_judge_id_fkey 
            FOREIGN KEY (judge_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;

         -- defendant_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_sessions' AND column_name = 'defendant_id') THEN
            -- Cleanup orphans
            UPDATE court_sessions SET defendant_id = NULL WHERE defendant_id IS NOT NULL AND defendant_id NOT IN (SELECT id FROM public.user_profiles);

            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'court_sessions_defendant_id_fkey') THEN
                ALTER TABLE court_sessions DROP CONSTRAINT court_sessions_defendant_id_fkey;
            END IF;
            ALTER TABLE court_sessions ADD CONSTRAINT court_sessions_defendant_id_fkey 
            FOREIGN KEY (defendant_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;

        -- created_by
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_sessions' AND column_name = 'created_by') THEN
            -- Cleanup orphans
            UPDATE court_sessions SET created_by = NULL WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM public.user_profiles);

            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'court_sessions_created_by_fkey') THEN
                ALTER TABLE court_sessions DROP CONSTRAINT court_sessions_created_by_fkey;
            END IF;
            ALTER TABLE court_sessions ADD CONSTRAINT court_sessions_created_by_fkey 
            FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;

    END IF;

    ----------------------------------------------------------------
    -- 4. court_sentences
    ----------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_sentences') THEN
        -- defendant_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_sentences' AND column_name = 'defendant_id') THEN
            -- Cleanup orphans
            UPDATE court_sentences SET defendant_id = NULL WHERE defendant_id IS NOT NULL AND defendant_id NOT IN (SELECT id FROM public.user_profiles);

            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'court_sentences_defendant_id_fkey') THEN
                ALTER TABLE court_sentences DROP CONSTRAINT court_sentences_defendant_id_fkey;
            END IF;
            ALTER TABLE court_sentences ADD CONSTRAINT court_sentences_defendant_id_fkey 
            FOREIGN KEY (defendant_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;

        -- judge_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_sentences' AND column_name = 'judge_id') THEN
            -- Cleanup orphans
            UPDATE court_sentences SET judge_id = NULL WHERE judge_id IS NOT NULL AND judge_id NOT IN (SELECT id FROM public.user_profiles);

            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'court_sentences_judge_id_fkey') THEN
                ALTER TABLE court_sentences DROP CONSTRAINT court_sentences_judge_id_fkey;
            END IF;
            ALTER TABLE court_sentences ADD CONSTRAINT court_sentences_judge_id_fkey 
            FOREIGN KEY (judge_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;
    END IF;

    ----------------------------------------------------------------
    -- 5. court_verdicts
    ----------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_verdicts') THEN
        -- issued_by
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_verdicts' AND column_name = 'issued_by') THEN
             -- Cleanup orphans
            UPDATE court_verdicts SET issued_by = NULL WHERE issued_by IS NOT NULL AND issued_by NOT IN (SELECT id FROM public.user_profiles);

            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'court_verdicts_issued_by_fkey') THEN
                ALTER TABLE court_verdicts DROP CONSTRAINT court_verdicts_issued_by_fkey;
            END IF;
            ALTER TABLE court_verdicts ADD CONSTRAINT court_verdicts_issued_by_fkey 
            FOREIGN KEY (issued_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;
    END IF;

    ----------------------------------------------------------------
    -- 6. court_payments
    ----------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_payments') THEN
        -- defendant_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_payments' AND column_name = 'defendant_id') THEN
             -- Cleanup orphans
            UPDATE court_payments SET defendant_id = NULL WHERE defendant_id IS NOT NULL AND defendant_id NOT IN (SELECT id FROM public.user_profiles);

            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'court_payments_defendant_id_fkey') THEN
                ALTER TABLE court_payments DROP CONSTRAINT court_payments_defendant_id_fkey;
            END IF;
            ALTER TABLE court_payments ADD CONSTRAINT court_payments_defendant_id_fkey 
            FOREIGN KEY (defendant_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;

        -- processed_by
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_payments' AND column_name = 'processed_by') THEN
             -- Cleanup orphans
            UPDATE court_payments SET processed_by = NULL WHERE processed_by IS NOT NULL AND processed_by NOT IN (SELECT id FROM public.user_profiles);

            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'court_payments_processed_by_fkey') THEN
                ALTER TABLE court_payments DROP CONSTRAINT court_payments_processed_by_fkey;
            END IF;
            ALTER TABLE court_payments ADD CONSTRAINT court_payments_processed_by_fkey 
            FOREIGN KEY (processed_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;
    END IF;
    
    -- INCIDENTS SKIPPED FOR NOW - Will handle if requested, but court was the blocker.

END $$;
