-- =============================================================================
-- AUTO-EXPIRE STALE RANDOM BATTLES
-- =============================================================================
-- Random battles can be left in 'active' status if both broadcasters navigate
-- away or close their tabs before the timer expires. This function force-ends
-- battles whose ends_at has passed, clearing the stream battle state.

CREATE OR REPLACE FUNCTION public.expire_stale_random_battles()
RETURNS void AS $$
DECLARE
  v_battle record;
BEGIN
  FOR v_battle IN
    SELECT b.id, b.challenger_stream_id, b.opponent_stream_id, b.ends_at
    FROM public.battles b
    WHERE b.status = 'active'
      AND b.battle_mode = 'random_queue'
      AND b.ends_at IS NOT NULL
      AND b.ends_at < NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.battles
    SET status = 'ended',
        ended_at = NOW(),
        winner_stream_id = CASE
          WHEN COALESCE(score_challenger, 0) > COALESCE(score_opponent, 0) THEN challenger_stream_id
          WHEN COALESCE(score_opponent, 0) > COALESCE(score_challenger, 0) THEN opponent_stream_id
          ELSE NULL
        END
    WHERE id = v_battle.id;

    UPDATE public.streams
    SET is_battle = false,
        battle_id = null,
        battle_mode = 'manual',
        battle_status = 'waiting',
        battle_end_time = NOW(),
        battle_end_reason = 'timer_expired',
        random_battle_queue_enabled = false,
        random_battle_queued_at = null,
        random_battle_cooldown_until = NOW() + INTERVAL '5 minutes'
    WHERE battle_id = v_battle.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.expire_stale_random_battles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_random_battles() TO service_role;
