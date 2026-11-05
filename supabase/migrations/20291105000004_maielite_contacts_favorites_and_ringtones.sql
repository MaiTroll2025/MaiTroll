ALTER TABLE public.maielite_phone_contacts
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.maielite_phone_settings (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  text_ringtone text,
  audio_ringtone text,
  video_ringtone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maielite_phone_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their MaiElite phone settings"
  ON public.maielite_phone_settings;
CREATE POLICY "Users can manage their MaiElite phone settings"
  ON public.maielite_phone_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_maielite_phone_directory()
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  phone_number text,
  is_admin boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    CASE
      WHEN coalesce(p.is_admin, false)
        OR p.role IN ('admin', 'superadmin', 'owner', 'ceo')
        OR p.troll_role IN ('admin', 'superadmin', 'ceo')
      THEN CASE
        WHEN EXISTS (
          SELECT 1 FROM public.user_profiles me
          WHERE me.id = auth.uid()
            AND (
              coalesce(me.is_admin, false)
              OR coalesce(me.role IN ('admin', 'superadmin', 'owner', 'ceo'), false)
              OR coalesce(me.troll_role IN ('admin', 'superadmin', 'ceo'), false)
            )
        ) OR EXISTS (
          SELECT 1
          FROM public.maielite_phone_contacts granted_contact
          JOIN public.user_profiles granting_admin ON granting_admin.id = granted_contact.owner_id
          WHERE granted_contact.contact_id = auth.uid()
            AND (
              coalesce(granting_admin.is_admin, false)
              OR coalesce(granting_admin.role IN ('admin', 'superadmin', 'owner', 'ceo'), false)
              OR coalesce(granting_admin.troll_role IN ('admin', 'superadmin', 'ceo'), false)
            )
        )
        THEN n.phone_number
        ELSE NULL
      END
      ELSE n.phone_number
    END,
    (
      coalesce(p.is_admin, false)
      OR coalesce(p.role IN ('admin', 'superadmin', 'owner', 'ceo'), false)
      OR coalesce(p.troll_role IN ('admin', 'superadmin', 'ceo'), false)
    )
  FROM public.user_profiles p
  LEFT JOIN public.maielite_phone_numbers n ON n.user_id = p.id
  WHERE p.id <> auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles me
        WHERE me.id = auth.uid()
          AND (
            coalesce(me.is_admin, false)
            OR coalesce(me.role IN ('admin', 'superadmin', 'owner', 'ceo'), false)
            OR coalesce(me.troll_role IN ('admin', 'superadmin', 'ceo'), false)
          )
      )
      OR EXISTS (
          SELECT 1
          FROM public.maielite_phone_contacts granted_contact
          JOIN public.user_profiles granting_admin ON granting_admin.id = granted_contact.owner_id
          WHERE granted_contact.contact_id = auth.uid()
            AND (
              coalesce(granting_admin.is_admin, false)
              OR coalesce(granting_admin.role IN ('admin', 'superadmin', 'owner', 'ceo'), false)
              OR coalesce(granting_admin.troll_role IN ('admin', 'superadmin', 'ceo'), false)
            )
      )
      OR NOT (
        coalesce(p.is_admin, false)
        OR coalesce(p.role IN ('admin', 'superadmin', 'owner', 'ceo'), false)
        OR coalesce(p.troll_role IN ('admin', 'superadmin', 'ceo'), false)
      )
    )
  ORDER BY lower(coalesce(p.display_name, p.username));
$$;

GRANT EXECUTE ON FUNCTION public.get_maielite_phone_directory() TO authenticated;
