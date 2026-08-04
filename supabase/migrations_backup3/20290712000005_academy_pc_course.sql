-- B2: Add a "PC Course for Mai Troll Academy" to the Academy catalog.
-- Adds a dedicated "PC" category and a published course so it appears in
-- /academy/courses immediately. Uses an existing academy teacher as the
-- teacher of record; if none exists yet, a placeholder teacher is created.

-- 1) PC category
INSERT INTO public.academy_categories (id, name, slug, description, icon, color, sort_order, is_active)
VALUES (
  '00000000-0000-0000-0000-00000000pc01',
  'PC',
  'pc',
  'Personal computer literacy, skills, and safety for Mai Troll citizens.',
  '🖥️',
  '#06b6d4',
  7,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- 2) Ensure at least one teacher exists to own the course
INSERT INTO public.academy_teachers (id, full_name, email, status, bio)
SELECT '00000000-0000-0000-0000-00000000teach01', 'Mai Troll Academy', 'academy@Mai Troll.app', 'approved', 'Default Academy instructor'
WHERE NOT EXISTS (SELECT 1 FROM public.academy_teachers LIMIT 1)
ON CONFLICT (id) DO NOTHING;

-- 3) The PC course (published, free, open enrollment)
INSERT INTO public.academy_courses (
  teacher_id,
  category_id,
  name,
  slug,
  description,
  short_description,
  difficulty_level,
  max_students,
  enrollment_fee,
  currency_type,
  enrollment_type,
  status,
  meeting_days,
  timezone
)
SELECT
  (SELECT id FROM public.academy_teachers ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM public.academy_categories WHERE slug = 'pc'),
  'PC Course for Mai Troll Academy',
  'pc-course-for-troll-city-academy',
  'Learn the essentials of using a personal computer on Mai Troll: navigation, safety, accounts, and the tools every citizen needs to participate in the city.',
  'Personal computer literacy and skills for Mai Troll citizens.',
  'beginner',
  50,
  0,
  'free',
  'open',
  'published',
  '{}',
  'America/New_York'
WHERE NOT EXISTS (
  SELECT 1 FROM public.academy_courses WHERE slug = 'pc-course-for-troll-city-academy'
);
