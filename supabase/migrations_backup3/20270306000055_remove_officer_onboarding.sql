-- Remove Officer Onboarding Tables and Views

-- Drop views first
DROP VIEW IF EXISTS officer_quiz_results_view;

-- Drop tables
DROP TABLE IF EXISTS officer_quiz_submissions CASCADE;
DROP TABLE IF EXISTS quiz_answers CASCADE;
DROP TABLE IF EXISTS officer_quiz_questions CASCADE;
DROP TABLE IF EXISTS onboarding_progress CASCADE;
DROP TABLE IF EXISTS onboarding_events CASCADE;

-- Drop functions if any (optional, but good for cleanup)
DROP FUNCTION IF EXISTS check_onboarding_status CASCADE;
