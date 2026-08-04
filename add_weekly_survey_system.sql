-- Weekly Survey System for Mai Troll
-- Tables: weekly_surveys, survey_responses
-- Created: 2026-06-18

-- Survey definitions (admin-created)
CREATE TABLE IF NOT EXISTS weekly_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Weekly Mai Troll Survey',
  description TEXT,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  questions JSONB NOT NULL DEFAULT '[
    {"id": "changes", "label": "What needs to be changed?", "type": "textarea", "required": false},
    {"id": "issues", "label": "Any issues you are experiencing?", "type": "textarea", "required": false},
    {"id": "tips", "label": "What would you like to see next?", "type": "textarea", "required": false}
  ]'::jsonb,
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User responses to surveys
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES weekly_surveys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(survey_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_surveys_active ON weekly_surveys(is_active, week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_surveys_week ON weekly_surveys(week_start_date, week_end_date);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user ON survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_submitted ON survey_responses(submitted_at);

-- RLS: Surveys are readable by all authenticated users, writable by admins only
ALTER TABLE weekly_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active surveys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_surveys' AND policyname = 'Anyone can read active surveys') THEN
    CREATE POLICY "Anyone can read active surveys" ON weekly_surveys FOR SELECT USING (is_active = true);
  END IF;
END
$$;

-- Only admins can create/update/delete surveys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_surveys' AND policyname = 'Admins can manage surveys') THEN
    CREATE POLICY "Admins can manage surveys" ON weekly_surveys FOR ALL USING (
      created_by = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END
$$;

-- Users can read their own responses
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'survey_responses' AND policyname = 'Users can read own responses') THEN
    CREATE POLICY "Users can read own responses" ON survey_responses FOR SELECT USING (user_id = auth.uid());
  END IF;
END
$$;

-- Users can insert their own response
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'survey_responses' AND policyname = 'Users can insert own response') THEN
    CREATE POLICY "Users can insert own response" ON survey_responses FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

-- Admins can read all responses
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'survey_responses' AND policyname = 'Admins can read all responses') THEN
    CREATE POLICY "Admins can read all responses" ON survey_responses FOR SELECT USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END
$$;

-- Meeting document sharing
CREATE TABLE IF NOT EXISTS meeting_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES staff_meetings(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES organization_documents(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id),
  visible_to_roles TEXT[] NOT NULL DEFAULT '{}',
  shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_docs_meeting ON meeting_documents(meeting_id);

ALTER TABLE meeting_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_documents' AND policyname = 'Authenticated can read meeting docs') THEN
    CREATE POLICY "Authenticated can read meeting docs" ON meeting_documents FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_documents' AND policyname = 'Staff can share meeting docs') THEN
    CREATE POLICY "Staff can share meeting docs" ON meeting_documents FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END
$$;
