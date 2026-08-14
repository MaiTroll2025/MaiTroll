-- Ensure house_raids table exists with correct structure
CREATE TABLE IF NOT EXISTS public.house_raids (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  raided_by_user_id uuid not null references public.user_profiles(id) on delete cascade,
  damage_level text not null default 'minor',
  raided_at timestamptz not null default now(),
  repaired_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_house_raids_house_id ON public.house_raids(house_id);
CREATE INDEX IF NOT EXISTS idx_house_raids_raided_at ON public.house_raids(raided_at);

ALTER TABLE public.house_raids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view raids on their house" ON public.house_raids;
CREATE POLICY "Users can view raids on their house"
  ON public.house_raids FOR SELECT
  USING (
    auth.uid() = raided_by_user_id
    OR EXISTS (
      SELECT 1 FROM public.houses h
      WHERE h.id = house_id AND h.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert raids" ON public.house_raids;
CREATE POLICY "Users can insert raids"
  ON public.house_raids FOR INSERT
  WITH CHECK (auth.uid() = raided_by_user_id);
