-- ============================================================================
-- Backfill XP for all gifts that were sent before the XP fix was deployed
-- ============================================================================
-- Awards XP based on the same rules as the live send_gift_in_stream:
--   - Sender gets 1.1x the gift amount
--   - Receiver gets 1.0x the gift amount
-- Uses grant_xp so user_stats and level progression stay consistent.
-- Wrapped in exception handlers so one bad row doesn't stop the whole backfill.
-- ============================================================================

DO $$
DECLARE
  gift_record RECORD;
  sender_xp BIGINT;
  receiver_xp BIGINT;
  backfill_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  FOR gift_record IN
    SELECT
      id,
      sender_id,
      receiver_id,
      COALESCE(amount, coins_spent, 0) AS gift_value
    FROM public.stream_gifts
    WHERE sender_id IS NOT NULL
      AND receiver_id IS NOT NULL
      AND COALESCE(amount, coins_spent, 0) > 0
  LOOP
    sender_xp := FLOOR(gift_record.gift_value * 1.1);
    receiver_xp := FLOOR(gift_record.gift_value * 1.0);

    BEGIN
      PERFORM public.grant_xp(
        gift_record.sender_id,
        sender_xp,
        'gift_sent',
        'backfill_gift_sent_' || gift_record.id::text,
        jsonb_build_object(
          'receiver_id', gift_record.receiver_id,
          'backfill', true,
          'gift_id', gift_record.id::text
        )
      );
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE WARNING 'Failed to award sender XP for gift %: %', gift_record.id, SQLERRM;
    END;

    BEGIN
      PERFORM public.grant_xp(
        gift_record.receiver_id,
        receiver_xp,
        'gift_received',
        'backfill_gift_received_' || gift_record.id::text,
        jsonb_build_object(
          'sender_id', gift_record.sender_id,
          'backfill', true,
          'gift_id', gift_record.id::text
        )
      );
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE WARNING 'Failed to award receiver XP for gift %: %', gift_record.id, SQLERRM;
    END;

    backfill_count := backfill_count + 1;
  END LOOP;

  RAISE NOTICE 'Gift XP backfill complete: % gifts processed, % errors', backfill_count, error_count;
END;
$$ LANGUAGE plpgsql;
