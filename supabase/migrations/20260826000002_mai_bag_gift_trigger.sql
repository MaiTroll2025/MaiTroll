-- ============================================
-- MAI BAG: auto-contribute gift value after stream_gifts insert
-- ============================================
CREATE OR REPLACE FUNCTION public.trigger_contribute_to_mai_bag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gift_value bigint;
  v_result jsonb;
BEGIN
  -- Only process gifts (not trollmond-only transfers or other transaction types)
  IF NEW.transaction_type NOT IN ('gift', 'gift_with_trollmonds') THEN
    RETURN NEW;
  END IF;

  IF NEW.stream_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Extract gift value from metadata if available
  BEGIN
    v_gift_value := COALESCE((NEW.metadata->>'gift_value')::bigint, NEW.amount, 0);
  EXCEPTION WHEN OTHERS THEN
    v_gift_value := COALESCE(NEW.amount, 0);
  END;

  IF v_gift_value IS NULL OR v_gift_value <= 0 THEN
    RETURN NEW;
  END IF;

  -- Contribute to mai bag (non-blocking; failures are swallowed so gift still succeeds)
  BEGIN
    v_result := public.contribute_to_mai_bag(NEW.stream_id, NEW.id, v_gift_value);
    -- Optional: log in dev
    -- RAISE NOTICE '[mai_bag] contributed % coins, result: %', v_gift_value, v_result;
  EXCEPTION WHEN OTHERS THEN
    -- Do not fail the gift transaction if mai bag processing fails
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contribute_to_mai_bag ON public.stream_gifts;
CREATE TRIGGER trg_contribute_to_mai_bag
  AFTER INSERT ON public.stream_gifts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_contribute_to_mai_bag();
