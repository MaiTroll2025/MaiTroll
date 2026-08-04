-- Ensure officer shift slots cannot be duplicated for the same officer and time window
-- Addresses ON CONFLICT errors (42P10) when upserting shift slots

DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'officer_shift_slots'
  ) INTO v_exists;

  IF v_exists THEN
    ALTER TABLE public.officer_shift_slots
    ADD CONSTRAINT officer_shift_slots_unique_slot
    UNIQUE (officer_id, shift_date, shift_start_time, shift_end_time);
  END IF;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
