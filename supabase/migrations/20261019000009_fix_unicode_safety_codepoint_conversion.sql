BEGIN;

CREATE OR REPLACE FUNCTION public.validate_unicode_safety(p_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_char INTEGER;
  v_combining INTEGER := 0;
  v_base INTEGER := 0;
  v_has_bidi_control BOOLEAN := false;
  v_has_zero_width BOOLEAN := false;
  v_has_invisible_separator BOOLEAN := false;
  v_has_control_char BOOLEAN := false;
  v_max_combining_per_base INTEGER := 0;
  v_current_combining INTEGER := 0;
  v_reason TEXT := NULL;
BEGIN
  IF p_text IS NULL THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  FOR v_char IN
    SELECT ascii(codepoint)
    FROM regexp_split_to_table(p_text, '') AS x(codepoint)
  LOOP
    IF v_char BETWEEN 0 AND 31 AND v_char NOT IN (9, 10, 13) THEN
      v_has_control_char := true;
    END IF;

    IF v_char IN (8206, 8207, 8234, 8235, 8236, 8237, 8238, 8298, 8299, 8300, 8301, 8302, 8303) THEN
      v_has_bidi_control := true;
    END IF;

    IF v_char IN (8203, 8204, 8205, 65279, 8288) THEN
      v_has_zero_width := true;
    END IF;

    IF v_char IN (57344, 65529, 65530, 65531, 65532, 65533) THEN
      v_has_invisible_separator := true;
    END IF;

    IF (v_char BETWEEN 768 AND 879)
       OR (v_char BETWEEN 6832 AND 6911)
       OR (v_char BETWEEN 7616 AND 7679)
       OR (v_char BETWEEN 8400 AND 8447)
       OR (v_char BETWEEN 65056 AND 65071) THEN
      v_combining := v_combining + 1;
      v_current_combining := v_current_combining + 1;
    ELSE
      IF v_current_combining > v_max_combining_per_base THEN
        v_max_combining_per_base := v_current_combining;
      END IF;
      v_current_combining := 0;
      IF v_char > 31 THEN
        v_base := v_base + 1;
      END IF;
    END IF;
  END LOOP;

  IF v_current_combining > v_max_combining_per_base THEN
    v_max_combining_per_base := v_current_combining;
  END IF;

  IF v_has_control_char THEN
    v_reason := 'Control characters detected';
  ELSIF v_has_bidi_control THEN
    v_reason := 'Bidirectional control characters detected';
  ELSIF v_has_zero_width THEN
    v_reason := 'Zero-width characters detected';
  ELSIF v_has_invisible_separator THEN
    v_reason := 'Invisible separator characters detected';
  ELSIF v_max_combining_per_base > 2 THEN
    v_reason := 'Excessive combining marks detected';
  END IF;

  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', v_reason,
      'combining_marks', v_combining,
      'base_chars', v_base,
      'max_combining_per_base', v_max_combining_per_base
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
