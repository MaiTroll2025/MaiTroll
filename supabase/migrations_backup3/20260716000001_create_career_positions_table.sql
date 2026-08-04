BEGIN;

-- career_positions was created outside version control. This migration
-- normalizes the table and adds RLS so the Jobs/Careers system is fully
-- versioned going forward.

CREATE TABLE IF NOT EXISTS public.career_positions (
  id text PRIMARY KEY,
  title text NOT NULL,
  department text NOT NULL,
  description text,
  max_applications integer NOT NULL DEFAULT 10,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "career_positions_read_all" ON public.career_positions;
CREATE POLICY "career_positions_read_all"
  ON public.career_positions FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "career_positions_write_admin" ON public.career_positions;
CREATE POLICY "career_positions_write_admin"
  ON public.career_positions FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (role IN ('admin','secretary','lead_troll_officer') OR is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (role IN ('admin','secretary','lead_troll_officer') OR is_admin = true)
    )
  );

CREATE INDEX IF NOT EXISTS idx_career_positions_open
  ON public.career_positions(is_open);

INSERT INTO public.career_positions (id, title, department, description, max_applications, is_open)
VALUES
  ('auctioneer', 'Auctioneer', 'Live Auctions', 'Host live auction shows where users bid with Troll Coins and build a trusted auctioneer reputation.', 10, true),
  ('prosecutor', 'Prosecutor', 'Troll Court', 'Represents Mai Troll in court cases, reviews evidence, presents charges, and supports city justice.', 10, true),
  ('attorney', 'Attorney', 'Troll Court', 'Defense attorney representing defendants in Troll Court cases, appeals, hearings, and disputes.', 10, true),
  ('tcnn_news_caster', 'TCNN News Caster', 'TCNN', 'On-air TCNN personality delivering breaking news, live reports, and official city broadcasts.', 10, true),
  ('secretary', 'Secretary', 'City Operations', 'Official city support role for admin operations, reports, meetings, and city coordination.', 10, true),
  ('tcnn_chief_news_caster', 'TCNN Chief News Caster', 'TCNN Leadership', 'Lead the TCNN team, manage journalists and news casters, and maintain editorial standards.', 10, true),
  ('troll_officer', 'Troll Officer', 'Utromail', 'Official city enforcer responsible for reports, moderation, investigations, arrests, and safety response.', 10, true),
  ('journalist', 'Journalist', 'TCNN', 'Write articles, conduct investigations, and keep the city informed through Mai Troll News Network.', 10, true),
  ('lead_troll_officer', 'Lead Troll Officer', 'Utromail Leadership', 'Senior enforcement role overseeing Troll Officers, cases, escalation, and city safety consistency.', 10, true),
  ('troller', 'Troller', 'Broadcasting', 'Entertainer role focused on playful chaos, satire, comedy, and broadcast engagement within city rules.', 10, true),
  ('agency_hr_manager', 'Agency HR Manager', 'Agency HR', 'Manage, approve, review, and settle issues for Mai Troll agencies.', 10, true),
  ('agency_hr', 'Agency HR', 'Agency HR', 'Support agency applications, reports, fee reviews, and HR operations.', 10, true),
  ('agency_leader', 'Agency Leader', 'Agencies', 'Lead a Mai Troll agency, recruit members, and grow creator talent.', 10, true),
  ('ceo_assistant', 'CEO Assistant', 'Executive Office', 'Assist the CEO with reports, coordination, admin follow-up, and platform operations.', 10, true),
  ('noah_assistant', 'Noah Assistant', 'Executive Office', 'Assist Noah Admin with reports, support tasks, and city operation follow-up.', 10, true),
  ('pastor', 'Pastor', 'Troll Church', 'Lead spiritual services, provide guidance and pastoral care to the community, and officiate church events.', 10, true)
ON CONFLICT (id) DO NOTHING;

COMMIT;
