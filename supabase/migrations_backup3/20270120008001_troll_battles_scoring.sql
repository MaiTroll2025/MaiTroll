-- RPC: Register Battle Score
-- Called when a gift is sent during a battle. Updates the score of the recipient.
CREATE OR REPLACE FUNCTION public.register_battle_score(
    p_battle_id UUID,
    p_recipient_id UUID,
    p_score INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle RECORD;
    v_new_score INTEGER;
BEGIN
    -- Get battle
    SELECT * INTO v_battle FROM public.troll_battles WHERE id = p_battle_id;
    
    IF v_battle IS NULL OR v_battle.status != 'active' THEN
        RETURN jsonb_build_object('error', 'Battle not active');
    END IF;

    -- Update score
    IF v_battle.player1_id = p_recipient_id THEN
        UPDATE public.troll_battles 
        SET player1_score = player1_score + p_score, updated_at = NOW()
        WHERE id = p_battle_id
        RETURNING player1_score INTO v_new_score;
        
        RETURN jsonb_build_object('success', true, 'player', 1, 'new_score', v_new_score);
    ELSIF v_battle.player2_id = p_recipient_id THEN
        UPDATE public.troll_battles 
        SET player2_score = player2_score + p_score, updated_at = NOW()
        WHERE id = p_battle_id
        RETURNING player2_score INTO v_new_score;
        
        RETURN jsonb_build_object('success', true, 'player', 2, 'new_score', v_new_score);
    ELSE
        -- Recipient is not in the battle (maybe a viewer sent to another viewer?)
        RETURN jsonb_build_object('success', false, 'message', 'Recipient not in battle');
    END IF;
END;
$$;

-- RPC: Get Active Battle
-- Helper to find if a broadcaster is currently in a battle
CREATE OR REPLACE FUNCTION public.get_active_battle(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle JSONB;
BEGIN
    SELECT to_jsonb(t) INTO v_battle
    FROM public.troll_battles t
    WHERE (player1_id = p_user_id OR player2_id = p_user_id)
      AND status = 'active'
    LIMIT 1;

    IF v_battle IS NOT NULL THEN
        RETURN jsonb_build_object('active', true, 'battle', v_battle);
    ELSE
        RETURN jsonb_build_object('active', false);
    END IF;
END;
$$;
