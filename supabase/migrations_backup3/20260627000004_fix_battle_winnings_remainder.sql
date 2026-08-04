-- ============================================================================
-- FIX: Battle winnings remainder loss
-- Previously, floor(pot / participants) dropped remainder coins.
-- Now: remainder is sent to admin_pool (platform revenue).
-- Also wraps distribution in a single atomic transaction with FOR UPDATE locks.
-- ============================================================================

BEGIN;

-- Drop old trigger that auto-calls distribute on INSERT
DROP TRIGGER IF EXISTS trg_auto_distribute_battle_winnings ON public.battles;

-- Recreate the function with remainder handling + atomic distribution
CREATE OR REPLACE FUNCTION public.distribute_battle_winnings(
    p_battle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_battle RECORD;
    v_total_pot numeric;
    v_winner_stream_id uuid;
    v_winner_host_id uuid;
    v_participants uuid[];
    v_share_per_person numeric;
    v_total_distributed numeric;
    v_remainder numeric;
    v_admin_cut numeric;
    v_final_pot numeric;
    v_pool_id UUID;
BEGIN
    -- Lock the battle row to prevent double-distribution
    SELECT * INTO v_battle FROM battles WHERE id = p_battle_id FOR UPDATE;

    -- Guard: already paid
    IF v_battle.payout_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Winnings already distributed');
    END IF;

    IF v_battle.status = 'ended' AND v_battle.winner_stream_id IS NOT NULL THEN
        -- Determine Winner Side
        IF v_battle.score_challenger > v_battle.score_opponent THEN
            v_winner_stream_id := v_battle.challenger_stream_id;
        ELSE
            v_winner_stream_id := v_battle.opponent_stream_id;
        END IF;

        v_total_pot := COALESCE(v_battle.pot_challenger, 0) + COALESCE(v_battle.pot_opponent, 0);

        IF v_total_pot <= 0 THEN
            RETURN jsonb_build_object('success', false, 'message', 'No pot to distribute');
        END IF;

        -- Identify Participants (Host + Guests on winning stream)
        SELECT user_id INTO v_winner_host_id FROM streams WHERE id = v_winner_stream_id;

        SELECT array_agg(user_id) INTO v_participants
        FROM stream_guests
        WHERE stream_id = v_winner_stream_id AND status = 'accepted';

        -- Combine host + guests
        IF v_participants IS NULL THEN
            v_participants := ARRAY[v_winner_host_id];
        ELSE
            v_participants := array_append(v_participants, v_winner_host_id);
        END IF;

        -- Apply Admin Cut (10%) to the POT
        v_admin_cut := floor(v_total_pot * 0.10);
        v_final_pot := v_total_pot - v_admin_cut;

        -- Split evenly among winners
        v_share_per_person := floor(v_final_pot / array_length(v_participants, 1));
        v_total_distributed := v_share_per_person * array_length(v_participants, 1);
        v_remainder := v_final_pot - v_total_distributed;

        -- Distribute to winners (atomic within this transaction)
        IF v_share_per_person > 0 THEN
            UPDATE user_profiles
            SET troll_coins = COALESCE(troll_coins, 0) + v_share_per_person
            WHERE id = ANY(v_participants);

            -- Log ledger for each winner
            INSERT INTO coin_ledger (user_id, amount, transaction_type, reason, metadata)
            SELECT
                u_id,
                v_share_per_person,
                'income',
                'battle_win',
                jsonb_build_object('battle_id', p_battle_id, 'role', 'winner')
            FROM unnest(v_participants) AS u_id;
        END IF;

        -- Send remainder + admin cut to admin_pool (platform revenue)
        SELECT id INTO v_pool_id FROM public.admin_pool LIMIT 1;
        IF v_pool_id IS NOT NULL AND (v_remainder + v_admin_cut) > 0 THEN
            UPDATE public.admin_pool
            SET trollcoins_balance = COALESCE(trollcoins_balance, 0) + v_remainder + v_admin_cut
            WHERE id = v_pool_id;

            INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
            VALUES (
                v_remainder + v_admin_cut,
                'battle_winnings_admin_cut_and_remainder',
                p_battle_id::uuid,
                NOW()
            );
        END IF;

        -- Mark battle as paid (prevents double distribution)
        UPDATE battles SET payout_at = NOW() WHERE id = p_battle_id;

        RETURN jsonb_build_object(
            'success', true,
            'distributed', v_total_distributed,
            'admin_cut', v_admin_cut,
            'remainder', v_remainder,
            'total_pot', v_total_pot,
            'recipients', array_length(v_participants, 1),
            'share_per_person', v_share_per_person
        );
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'Battle not ended or no winner');
END;
$function$;

-- Recreate the trigger for auto-distribution on battle end
CREATE OR REPLACE FUNCTION public.trigger_distribute_battle_winnings()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
        PERFORM public.distribute_battle_winnings(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_distribute_battle_winnings
    AFTER UPDATE OF status ON public.battles
    FOR EACH ROW
    WHEN (NEW.status = 'ended')
    EXECUTE FUNCTION public.trigger_distribute_battle_winnings();

COMMIT;
