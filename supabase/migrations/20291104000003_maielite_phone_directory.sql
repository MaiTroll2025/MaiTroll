-- MaiElite phone identity, contacts, and first-use minutes.
CREATE SEQUENCE IF NOT EXISTS public.maielite_phone_number_seq
  START WITH 1000
  INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS public.call_minutes (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  audio_minutes integer NOT NULL DEFAULT 0 CHECK (audio_minutes >= 0),
  video_minutes integer NOT NULL DEFAULT 0 CHECK (video_minutes >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.call_minutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own call minutes" ON public.call_minutes;
CREATE POLICY "Users can read own call minutes"
  ON public.call_minutes FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.maielite_phone_numbers (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  phone_number text NOT NULL UNIQUE,
  change_count integer NOT NULL DEFAULT 0 CHECK (change_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.maielite_phone_numbers ADD COLUMN IF NOT EXISTS change_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.maielite_phone_contacts (
  owner_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, contact_id),
  CONSTRAINT maielite_phone_contacts_not_self CHECK (owner_id <> contact_id)
);

CREATE TABLE IF NOT EXISTS public.maielite_phone_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  call_type text NOT NULL CHECK (call_type IN ('audio', 'video')),
  status text NOT NULL CHECK (status IN ('missed', 'declined', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maielite_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maielite_phone_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maielite_phone_call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own phone number" ON public.maielite_phone_numbers;
CREATE POLICY "Users can read their own phone number"
  ON public.maielite_phone_numbers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their phone contacts" ON public.maielite_phone_contacts;
CREATE POLICY "Users can manage their phone contacts"
  ON public.maielite_phone_contacts FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Admins can read all phone contacts" ON public.maielite_phone_contacts;
CREATE POLICY "Admins can read all phone contacts"
  ON public.maielite_phone_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (
          coalesce(p.is_admin, false)
          OR p.role IN ('admin', 'superadmin', 'owner', 'ceo')
          OR p.troll_role IN ('admin', 'superadmin', 'ceo')
        )
    )
  );

DROP POLICY IF EXISTS "Users can read received call logs" ON public.maielite_phone_call_logs;
CREATE POLICY "Users can read received call logs"
  ON public.maielite_phone_call_logs FOR SELECT
  USING (auth.uid() = recipient_id);

CREATE OR REPLACE FUNCTION public.record_maielite_call(
  p_caller_id uuid,
  p_call_type text,
  p_status text DEFAULT 'missed'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = p_caller_id THEN
    RAISE EXCEPTION 'Invalid caller';
  END IF;
  IF p_call_type NOT IN ('audio', 'video') OR p_status NOT IN ('missed', 'declined', 'completed') THEN
    RAISE EXCEPTION 'Invalid call data';
  END IF;
  INSERT INTO public.maielite_phone_call_logs (recipient_id, caller_id, call_type, status)
  VALUES (auth.uid(), p_caller_id, p_call_type, p_status);
  INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read, created_at)
  VALUES (
    p_caller_id,
    'missed_call',
    'Call unavailable',
    'The recipient is unavailable while broadcasting or watching a stream. Your call was recorded as missed.',
    jsonb_build_object('call_type', p_call_type, 'status', p_status),
    false,
    now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_maielite_call(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_maielite_phone()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_number text;
  v_is_staff boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT phone_number INTO v_number
  FROM public.maielite_phone_numbers
  WHERE user_id = v_user_id;

  IF v_number IS NULL THEN
    LOOP
      v_number := (1000 + ((nextval('public.maielite_phone_number_seq') - 1000) % 9000))::text;
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.maielite_phone_numbers
        WHERE phone_number = v_number
      );
    END LOOP;
    INSERT INTO public.maielite_phone_numbers (user_id, phone_number)
    VALUES (v_user_id, v_number);

    SELECT (
      coalesce(is_admin, false)
      OR role IN ('admin', 'superadmin', 'owner', 'ceo')
      OR troll_role IN ('admin', 'superadmin', 'ceo')
    ) INTO v_is_staff
    FROM public.user_profiles
    WHERE id = v_user_id;

    IF NOT coalesce(v_is_staff, false) THEN
      INSERT INTO public.call_minutes (user_id, audio_minutes, video_minutes, updated_at)
      VALUES (v_user_id, 10, 0, now())
      ON CONFLICT (user_id) DO UPDATE
      SET audio_minutes = public.call_minutes.audio_minutes + 10,
          updated_at = now();
    END IF;
  END IF;

  RETURN jsonb_build_object('phone_number', v_number);
END;
$$;

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
      THEN NULL
      ELSE n.phone_number
    END,
    (
      coalesce(p.is_admin, false)
      OR p.role IN ('admin', 'superadmin', 'owner', 'ceo')
      OR p.troll_role IN ('admin', 'superadmin', 'ceo')
    )
  FROM public.user_profiles p
  JOIN public.maielite_phone_numbers n ON n.user_id = p.id
  WHERE p.id <> auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.user_profiles me
        WHERE me.id = auth.uid()
          AND (
            coalesce(me.is_admin, false)
            OR me.role IN ('admin', 'superadmin', 'owner', 'ceo')
            OR me.troll_role IN ('admin', 'superadmin', 'ceo')
          )
      )
      OR NOT (
        coalesce(p.is_admin, false)
        OR p.role IN ('admin', 'superadmin', 'owner', 'ceo')
        OR p.troll_role IN ('admin', 'superadmin', 'ceo')
      )
    )
  ORDER BY lower(coalesce(p.display_name, p.username));
$$;

GRANT EXECUTE ON FUNCTION public.register_maielite_phone() TO authenticated;

CREATE OR REPLACE FUNCTION public.change_maielite_phone_number(p_phone_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current public.maielite_phone_numbers%ROWTYPE;
  v_spend boolean;
  v_charged boolean := false;
BEGIN
  IF v_user_id IS NULL OR p_phone_number !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Phone number must contain exactly 4 digits';
  END IF;
  SELECT * INTO v_current FROM public.maielite_phone_numbers WHERE user_id = v_user_id FOR UPDATE;
  IF v_current.user_id IS NULL THEN
    RAISE EXCEPTION 'Register your MaiElite phone first';
  END IF;
  IF p_phone_number = v_current.phone_number THEN
    RETURN jsonb_build_object('phone_number', v_current.phone_number, 'charged', false);
  END IF;
  IF EXISTS (SELECT 1 FROM public.maielite_phone_numbers WHERE phone_number = p_phone_number) THEN
    RAISE EXCEPTION 'That phone number is already in use';
  END IF;
  IF v_current.change_count > 0 THEN
    v_spend := public.try_pay_coins_secure(
      100, 'maielite_phone_number_change',
      jsonb_build_object('new_phone_number', p_phone_number)
    );
    IF NOT v_spend THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient Troll Coins');
    END IF;
    v_charged := true;
  END IF;
  UPDATE public.maielite_phone_numbers
  SET phone_number = p_phone_number, change_count = change_count + 1
  WHERE user_id = v_user_id;
  RETURN jsonb_build_object('phone_number', p_phone_number, 'charged', v_charged);
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_maielite_phone_number(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_maielite_phone_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_call_balances(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audio integer := 0;
  v_video integer := 0;
BEGIN
  IF auth.uid() <> p_user_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT audio_minutes, video_minutes
  INTO v_audio, v_video
  FROM public.call_minutes
  WHERE user_id = p_user_id;
  RETURN jsonb_build_object('audio_minutes', coalesce(v_audio, 0), 'video_minutes', coalesce(v_video, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_call_minutes(
  p_user_id uuid,
  p_minutes integer,
  p_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audio integer := 0;
  v_video integer := 0;
  v_staff boolean;
  v_updated integer;
BEGIN
  IF auth.uid() <> p_user_id OR p_minutes <= 0 OR p_type NOT IN ('audio', 'video') THEN
    RAISE EXCEPTION 'Invalid call balance request';
  END IF;
  SELECT (
    coalesce(is_admin, false)
    OR role IN ('admin', 'superadmin', 'owner', 'ceo')
    OR troll_role IN ('admin', 'superadmin', 'ceo')
  ) INTO v_staff
  FROM public.user_profiles WHERE id = p_user_id;
  IF coalesce(v_staff, false) THEN
    RETURN jsonb_build_object('audio_minutes', 2147483647, 'video_minutes', 2147483647);
  END IF;
  INSERT INTO public.call_minutes (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.call_minutes
  SET audio_minutes = CASE WHEN p_type = 'audio' THEN audio_minutes - p_minutes ELSE audio_minutes END,
      video_minutes = CASE WHEN p_type = 'video' THEN video_minutes - p_minutes ELSE video_minutes END,
      updated_at = now()
  WHERE user_id = p_user_id
    AND ((p_type = 'audio' AND audio_minutes >= p_minutes)
      OR (p_type = 'video' AND video_minutes >= p_minutes));
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Insufficient call minutes';
  END IF;
  SELECT audio_minutes, video_minutes INTO v_audio, v_video
  FROM public.call_minutes WHERE user_id = p_user_id;
  RETURN jsonb_build_object('audio_minutes', v_audio, 'video_minutes', v_video);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_call_balances(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_call_minutes(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.shop_buy_call_minutes(
  p_user_id uuid,
  p_package_id text,
  p_minutes integer,
  p_cost integer,
  p_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spend boolean;
BEGIN
  IF auth.uid() <> p_user_id
    OR p_minutes <> 30
    OR p_cost <> 10
    OR p_type NOT IN ('audio', 'video') THEN
    RAISE EXCEPTION 'Invalid call package';
  END IF;
  v_spend := public.try_pay_coins_secure(
    p_cost, 'call_minutes', p_metadata
  );
  IF NOT v_spend THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient Troll Coins');
  END IF;
  INSERT INTO public.call_minutes (user_id, audio_minutes, video_minutes, updated_at)
  VALUES (p_user_id, CASE WHEN p_type = 'audio' THEN p_minutes ELSE 0 END,
          CASE WHEN p_type = 'video' THEN p_minutes ELSE 0 END, now())
  ON CONFLICT (user_id) DO UPDATE
  SET audio_minutes = public.call_minutes.audio_minutes + EXCLUDED.audio_minutes,
      video_minutes = public.call_minutes.video_minutes + EXCLUDED.video_minutes,
      updated_at = now();
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.shop_buy_call_minutes(uuid, text, integer, integer, text, jsonb) TO authenticated;
