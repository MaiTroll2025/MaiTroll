BEGIN;

-- Enable RLS on MaiTroll_shops if not already enabled
ALTER TABLE IF EXISTS public."MaiTroll_shops" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can insert own shops" ON public."MaiTroll_shops";
DROP POLICY IF EXISTS "Users can view own shops" ON public."MaiTroll_shops";
DROP POLICY IF EXISTS "Users can update own shops" ON public."MaiTroll_shops";
DROP POLICY IF EXISTS "Public can view active shops" ON public."MaiTroll_shops";
DROP POLICY IF EXISTS "Admins can manage all shops" ON public."MaiTroll_shops";

-- Policy: Users can insert their own shops
CREATE POLICY "Users can insert own shops"
  ON public."MaiTroll_shops" FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can view their own shops
CREATE POLICY "Users can view own shops"
  ON public."MaiTroll_shops" FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Policy: Users can update their own shops
CREATE POLICY "Users can update own shops"
  ON public."MaiTroll_shops" FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Public can view active shops (for marketplace browsing)
CREATE POLICY "Public can view active shops"
  ON public."MaiTroll_shops" FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Policy: Admins can manage all shops
CREATE POLICY "Admins can manage all shops"
  ON public."MaiTroll_shops" FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (is_admin = true OR role = 'admin' OR role = 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (is_admin = true OR role = 'admin' OR role = 'superadmin')
    )
  );

-- Permissions
GRANT SELECT ON public."MaiTroll_shops" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public."MaiTroll_shops" TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
