-- New user onboarding progress tracking
CREATE TABLE IF NOT EXISTS public.user_onboarding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  current_phase text not null default 'profile',
  current_step integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_onboarding_unique_user unique (user_id)
);

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own onboarding"
  ON public.user_onboarding FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own onboarding"
  ON public.user_onboarding FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own onboarding"
  ON public.user_onboarding FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON public.user_onboarding(user_id);
