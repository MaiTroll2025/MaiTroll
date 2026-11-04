ALTER SEQUENCE IF EXISTS public.maielite_phone_number_seq RESTART WITH 1000;

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
  SELECT * INTO v_current
  FROM public.maielite_phone_numbers
  WHERE user_id = v_user_id
  FOR UPDATE;
  IF v_current.user_id IS NULL THEN
    RAISE EXCEPTION 'Register your MaiElite phone first';
  END IF;
  IF p_phone_number = v_current.phone_number THEN
    RETURN jsonb_build_object('phone_number', v_current.phone_number, 'charged', false);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.maielite_phone_numbers
    WHERE phone_number = p_phone_number
  ) THEN
    RAISE EXCEPTION 'That phone number is already in use';
  END IF;
  IF v_current.change_count > 0 THEN
    v_spend := public.try_pay_coins_secure(
      100,
      'maielite_phone_number_change',
      jsonb_build_object('new_phone_number', p_phone_number)
    );
    IF NOT v_spend THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient Troll Coins');
    END IF;
    v_charged := true;
  END IF;
  UPDATE public.maielite_phone_numbers
  SET phone_number = p_phone_number,
      change_count = change_count + 1
  WHERE user_id = v_user_id;
  RETURN jsonb_build_object(
    'phone_number', p_phone_number,
    'charged', v_charged
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_maielite_phone_number(text) TO authenticated;
