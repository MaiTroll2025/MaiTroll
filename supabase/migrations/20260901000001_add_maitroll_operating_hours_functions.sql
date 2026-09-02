-- ============================================================
-- MaiTroll Operating Hours System
-- ============================================================
--
-- Public hours:
--   OPEN:   10:00 AM → 2:00 AM America/Chicago
--   CLOSED: 2:00 AM → 10:00 AM America/Chicago
--
-- Closing warning:
--   1:55 AM → 2:00 AM
--
-- Staff:
--   Authorized staff have 24/7 access.
--
-- IMPORTANT:
--   Database/server time is authoritative.
--   Frontend clocks must never be trusted for enforcement.
-- ============================================================


-- ============================================================
-- 1. Check whether MaiTroll is currently open
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_maitroll_open()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  current_chicago_time timestamp;
  current_hour_minutes integer;
  opening_time integer := 10 * 60;
  closing_time integer := 2 * 60;
BEGIN
  current_chicago_time :=
    now() AT TIME ZONE 'America/Chicago';

  current_hour_minutes :=
    EXTRACT(HOUR FROM current_chicago_time)::integer * 60
    + EXTRACT(MINUTE FROM current_chicago_time)::integer;

  /*
    OPEN:
      10:00 AM → 11:59 PM
      12:00 AM → 1:59 AM

    CLOSED:
      2:00 AM → 9:59 AM
  */

  IF current_hour_minutes >= opening_time THEN
    RETURN true;
  END IF;

  IF current_hour_minutes < closing_time THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


-- ============================================================
-- 2. Check whether a user is authorized staff
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_authorized_maitroll_staff(
  user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = user_id
      AND (
        is_admin = true
        OR is_lead_officer = true
        OR is_troll_officer = true
        OR role = 'admin'
        OR role = 'staff'
      )
  );
END;
$$;


-- ============================================================
-- 3. Check whether a user can start a broadcast
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_start_broadcast_maitroll(
  user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  is_open boolean;
  is_staff boolean;
  chicago_time timestamp;
  current_hour integer;
  current_minute integer;
  current_total_minutes integer;
  closing_warning_start integer := 115;
  closing_time integer := 120;
BEGIN
  chicago_time :=
    now() AT TIME ZONE 'America/Chicago';

  current_hour :=
    EXTRACT(HOUR FROM chicago_time)::integer;

  current_minute :=
    EXTRACT(MINUTE FROM chicago_time)::integer;

  current_total_minutes :=
    current_hour * 60 + current_minute;

  is_open := public.is_maitroll_open();

  is_staff :=
    public.is_authorized_maitroll_staff(user_id);


  -- ==========================================================
  -- STAFF BYPASS
  -- ==========================================================

  IF is_staff THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'Staff bypass - 24/7 access',
      'is_staff', true,
      'is_maitroll_open', is_open,
      'operating_state', 'STAFF_BYPASS',
      'opens_at', '10:00 AM',
      'closes_at', '2:00 AM'
    );
  END IF;


  -- ==========================================================
  -- NORMAL OPEN HOURS
  -- ==========================================================

  IF is_open THEN

    IF current_total_minutes >= closing_warning_start
       AND current_total_minutes < closing_time THEN

      RETURN jsonb_build_object(
        'allowed', true,
        'reason', 'MaiTroll is open - closing soon',
        'is_staff', false,
        'is_maitroll_open', true,
        'operating_state', 'CLOSING_SOON',
        'opens_at', '10:00 AM',
        'closes_at', '2:00 AM'
      );

    END IF;

    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'MaiTroll is currently open',
      'is_staff', false,
      'is_maitroll_open', true,
      'operating_state', 'OPEN',
      'opens_at', '10:00 AM',
      'closes_at', '2:00 AM'
    );

  END IF;


  -- ==========================================================
  -- CLOSED
  -- ==========================================================

  RETURN jsonb_build_object(
    'allowed', false,
    'reason',
      'MaiTroll is currently closed. Public broadcasting is unavailable from 2:00 AM to 10:00 AM America/Chicago.',
    'is_staff', false,
    'is_maitroll_open', false,
    'operating_state', 'CLOSED',
    'opens_at', '10:00 AM',
    'closes_at', '2:00 AM'
  );
END;
$$;


-- ============================================================
-- 4. Get complete MaiTroll operating state
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_maitroll_operating_state(
  user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb;

  current_chicago_time timestamp;

  current_hour integer;
  current_minute integer;
  current_second integer;

  current_total_seconds integer;

  opening_seconds integer := 10 * 60 * 60;
  closing_seconds integer := 2 * 60 * 60;

  seconds_until_open integer;
  seconds_until_close integer;

  is_open boolean;
  is_closing_soon boolean;
  is_staff boolean;
BEGIN

  -- ==========================================================
  -- CURRENT CHICAGO TIME
  -- ==========================================================

  current_chicago_time :=
    now() AT TIME ZONE 'America/Chicago';

  current_hour :=
    EXTRACT(HOUR FROM current_chicago_time)::integer;

  current_minute :=
    EXTRACT(MINUTE FROM current_chicago_time)::integer;

  current_second :=
    FLOOR(
      EXTRACT(SECOND FROM current_chicago_time)
    )::integer;

  current_total_seconds :=
    current_hour * 60 * 60
    + current_minute * 60
    + current_second;


  -- ==========================================================
  -- PERMISSION / STATE
  -- ==========================================================

  is_open :=
    public.is_maitroll_open();

  is_staff :=
    public.is_authorized_maitroll_staff(user_id);

  is_closing_soon :=
    current_total_seconds >= (1 * 60 * 60 + 55 * 60)
    AND current_total_seconds < closing_seconds;


  -- ==========================================================
  -- SECONDS UNTIL NEXT OPENING
  -- ==========================================================

  IF current_total_seconds < opening_seconds THEN

    -- Before 10:00 AM today
    seconds_until_open :=
      opening_seconds - current_total_seconds;

  ELSE

    -- After 10:00 AM
    -- Next opening is tomorrow at 10:00 AM
    seconds_until_open :=
      (24 * 60 * 60 - current_total_seconds)
      + opening_seconds;

  END IF;


  -- ==========================================================
  -- SECONDS UNTIL NEXT CLOSING
  -- ==========================================================

  IF current_total_seconds < closing_seconds THEN

    -- Between midnight and 1:59:59 AM
    seconds_until_close :=
      closing_seconds - current_total_seconds;

  ELSE

    -- From 2:00 AM onward, next closing is tomorrow at 2:00 AM
    seconds_until_close :=
      (24 * 60 * 60 - current_total_seconds)
      + closing_seconds;

  END IF;


  -- ==========================================================
  -- BUILD RESULT
  -- ==========================================================

  result := jsonb_build_object(

    'state',
    CASE
      WHEN is_staff THEN 'STAFF_BYPASS'
      WHEN is_closing_soon THEN 'CLOSING_SOON'
      WHEN is_open THEN 'OPEN'
      ELSE 'CLOSED'
    END,

    'is_open',
    is_open OR is_staff,

    'is_closing_soon',
    is_closing_soon AND NOT is_staff,

    'is_closed',
    NOT is_open AND NOT is_staff,

    'is_staff',
    is_staff,

    'seconds_until_open',
    GREATEST(seconds_until_open, 0),

    'seconds_until_close',
    GREATEST(seconds_until_close, 0),

    'opens_at',
    '10:00 AM',

    'closes_at',
    '2:00 AM',

    'timezone',
    'America/Chicago',

    'current_time_chicago',
    to_char(
      current_chicago_time,
      'YYYY-MM-DD HH12:MI:SS AM'
    )
  );

  RETURN result;
END;
$$;


-- ============================================================
-- 5. Documentation
-- ============================================================

COMMENT ON FUNCTION public.is_maitroll_open()
IS
'Returns true when MaiTroll public operating hours are active: 10:00 AM through 2:00 AM America/Chicago.';

COMMENT ON FUNCTION public.is_authorized_maitroll_staff(uuid)
IS
'Returns true when the specified user has an authorized MaiTroll staff role with 24/7 access.';

COMMENT ON FUNCTION public.can_start_broadcast_maitroll(uuid)
IS
'Determines whether a user may start a MaiTroll broadcast. Public users are restricted to operating hours; authorized staff have 24/7 access.';

COMMENT ON FUNCTION public.get_maitroll_operating_state(uuid)
IS
'Returns the authoritative MaiTroll operating state, countdowns, timezone, and staff bypass status.';