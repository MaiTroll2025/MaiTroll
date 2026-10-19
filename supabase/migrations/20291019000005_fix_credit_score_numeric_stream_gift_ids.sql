-- stream_gifts.id can be numeric in databases created from an older schema.
-- Keep the original row ID for idempotency, and only use it as a UUID source
-- when it actually has the UUID format.
CREATE OR REPLACE FUNCTION public.credit_score_on_stream_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row JSONB := to_jsonb(NEW);
  v_gift_key TEXT;
  v_gift_id UUID;
  v_sender_id UUID;
  v_receiver_id UUID;
  v_gift_value BIGINT;
  v_sender_points INTEGER;
  v_activity_seconds BIGINT;
  v_activity_factor NUMERIC;
  v_received_used INTEGER;
  v_receiver_points INTEGER;
  v_month_start TIMESTAMPTZ := date_trunc('month', NOW());
BEGIN
  v_gift_key := NULLIF(v_row->>'id', '');
  IF v_gift_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_gift_id := v_gift_key::UUID;
  END IF;

  v_sender_id := NULLIF(v_row->>'sender_id', '')::UUID;
  v_receiver_id := COALESCE(
    NULLIF(v_row->>'receiver_id', '')::UUID,
    NULLIF(v_row->>'recipient_id', '')::UUID
  );
  v_gift_value := COALESCE(
    NULLIF(v_row->>'amount', '')::BIGINT,
    NULLIF(v_row->>'coins_spent', '')::BIGINT,
    NULLIF(v_row->>'coin_amount', '')::BIGINT,
    0
  );

  IF v_gift_key IS NULL OR v_sender_id IS NULL OR v_receiver_id IS NULL
     OR v_sender_id = v_receiver_id OR v_gift_value <= 0 THEN
    RETURN NEW;
  END IF;

  v_sender_points := FLOOR(v_gift_value / 1000.0)::INTEGER;
  IF v_sender_points > 0 THEN
    PERFORM public.apply_credit_score_event(
      v_sender_id,
      'gift_sent',
      v_sender_points,
      'credit_gift_sent:' || v_gift_key,
      TG_TABLE_NAME,
      v_gift_id,
      jsonb_build_object('gift_value', v_gift_value, 'coins_per_point', 1000)
    );
  END IF;

  SELECT COALESCE(hosted_seconds, 0) + COALESCE(viewed_seconds, 0)
  INTO v_activity_seconds
  FROM public.credit_activity_monthly_totals
  WHERE user_id = v_receiver_id AND month_start = v_month_start::DATE;

  v_activity_factor := LEAST(1, COALESCE(v_activity_seconds, 0)::NUMERIC / 36000);
  v_receiver_points := FLOOR(v_sender_points * 0.10 * v_activity_factor)::INTEGER;

  IF v_receiver_points > 0 THEN
    SELECT COALESCE(SUM(delta), 0)::INTEGER
    INTO v_received_used
    FROM public.credit_events
    WHERE user_id = v_receiver_id
      AND event_type = 'gift_received_activity_bonus'
      AND delta > 0
      AND created_at >= v_month_start;

    v_receiver_points := LEAST(v_receiver_points, GREATEST(0, 5 - v_received_used));
    IF v_receiver_points > 0 THEN
      PERFORM public.apply_credit_score_event(
        v_receiver_id,
        'gift_received_activity_bonus',
        v_receiver_points,
        'credit_gift_received:' || v_gift_key,
        TG_TABLE_NAME,
        v_gift_id,
        jsonb_build_object(
          'gift_value', v_gift_value,
          'sender_credit_points', v_sender_points,
          'activity_factor', v_activity_factor,
          'monthly_received_gift_cap', 5
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
