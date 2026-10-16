CREATE TABLE IF NOT EXISTS public.site_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 120),
  summary TEXT NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 320),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 50000),
  post_type TEXT NOT NULL CHECK (post_type IN ('update', 'blog')),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_type, slug),
  CHECK (NOT is_published OR published_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_site_updates_published_type_date
  ON public.site_updates (post_type, published_at DESC)
  WHERE is_published = TRUE;

ALTER TABLE public.site_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published site updates" ON public.site_updates;
CREATE POLICY "Public can read published site updates"
  ON public.site_updates
  FOR SELECT
  USING (is_published = TRUE);

DROP POLICY IF EXISTS "Admins can manage site updates" ON public.site_updates;
CREATE POLICY "Admins can manage site updates"
  ON public.site_updates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND (user_profiles.role = 'admin' OR user_profiles.is_admin = TRUE)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND (user_profiles.role = 'admin' OR user_profiles.is_admin = TRUE)
    )
  );

GRANT SELECT ON public.site_updates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_updates TO authenticated;

INSERT INTO public.site_updates (title, slug, summary, content, post_type, is_published, published_at)
VALUES
  (
    'MaiTroll: A New Broadcasting App for Interactive Creator Communities',
    'maitroll-new-broadcasting-app-creator-communities',
    'Learn how MaiTroll brings live broadcasting, creator profiles, viewer chat, short-form video, and community features together.',
    $article$
MaiTroll is a live broadcasting app and social media platform where creators and viewers can meet around live content. Public profiles and broadcasts help audiences discover creators and follow what they share.

Creators can access MaiTroll from supported mobile and desktop devices. The best setup depends on the device, browser, network connection, and the kind of broadcast being made; streaming performance can vary across those conditions.

Viewers can participate through live chat and explore other community features beyond a single broadcast. Short-form video and public creator profiles provide additional ways to discover content.

MaiTroll is continuing to build its creator and community experience. Visit the public updates page for new features and product announcements.
$article$,
    'blog',
    TRUE,
    NOW()
  ),
  (
    'How MaiTroll Connects Broadcasting with Social Media',
    'broadcast-app-social-media-community',
    'A look at how live broadcasts, social profiles, short-form video, chat, and virtual community features fit together on MaiTroll.',
    $article$
A broadcast app can be more than a place to watch a video. MaiTroll combines live broadcasting with creator profiles, short-form video, and community features so people can discover content and participate around it.

During a public broadcast, viewers can join the live conversation. Outside the stream, public profiles and short-form posts can help audiences find creators and explore more of the community.

MaiTroll also includes an interactive virtual city with civic-style experiences such as city laws and an elected president. These digital community systems are part of the platform and are not a physical municipality or government.

Features and eligibility can change as the platform develops. The MaiTroll updates page shares product changes and new public features.
$article$,
    'blog',
    TRUE,
    NOW()
  )
ON CONFLICT (post_type, slug) DO NOTHING;
