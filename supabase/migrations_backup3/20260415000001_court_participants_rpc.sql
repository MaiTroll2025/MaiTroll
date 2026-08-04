-- Court Participants RPC Functions

-- Join court session as participant
CREATE OR REPLACE FUNCTION public.join_court_session(
    p_court_session_id UUID,
    p_role TEXT DEFAULT 'observer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_existing_participant court_participants%ROWTYPE;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Check if already in session
    SELECT * INTO v_existing_participant
    FROM court_participants
    WHERE court_session_id = p_court_session_id AND user_id = v_user_id;

    IF FOUND THEN
        -- Update existing participant role
        UPDATE court_participants
        SET role = p_role, updated_at = NOW()
        WHERE id = v_existing_participant.id
        RETURNING * INTO v_existing_participant;
        
        RETURN jsonb_build_object(
            'success', true,
            'participant', jsonb_build_object(
                'id', v_existing_participant.id,
                'role', v_existing_participant.role,
                'box_number', v_existing_participant.box_number,
                'queue_position', v_existing_participant.queue_position
            )
        );
    END IF;

    -- Join with role - judges/prosecutors get boxes automatically
    INSERT INTO court_participants (court_session_id, user_id, role, box_number)
    VALUES (
        p_court_session_id, 
        v_user_id, 
        p_role,
        CASE 
            WHEN p_role IN ('judge', 'prosecutor') THEN 1
            WHEN p_role = 'defendant' THEN 2
            WHEN p_role = 'attorney' THEN 3
            ELSE NULL
        END
    )
    RETURNING * INTO v_existing_participant;

    RETURN jsonb_build_object(
        'success', true,
        'participant', jsonb_build_object(
            'id', v_existing_participant.id,
            'role', v_existing_participant.role,
            'box_number', v_existing_participant.box_number,
            'queue_position', v_existing_participant.queue_position
        )
    );
END;
$$;

-- Raise hand to join queue
CREATE OR REPLACE FUNCTION public.court_raise_hand(
    p_court_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_max_queue INTEGER;
    v_new_position INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Get max queue position
    SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_new_position
    FROM court_participants
    WHERE court_session_id = p_court_session_id AND queue_position IS NOT NULL;

    UPDATE court_participants
    SET is_hand_raised = true,
        queue_position = v_new_position,
        updated_at = NOW()
    WHERE court_session_id = p_court_session_id AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true, 'queue_position', v_new_position);
END;
$$;

-- Lower hand / leave queue
CREATE OR REPLACE FUNCTION public.court_lower_hand(
    p_court_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    UPDATE court_participants
    SET is_hand_raised = false,
        queue_position = NULL,
        updated_at = NOW()
    WHERE court_session_id = p_court_session_id AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Judge calls next person from queue to box
CREATE OR REPLACE FUNCTION public.court_call_next(
    p_court_session_id UUID,
    p_box_number INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_next_participant court_participants%ROWTYPE;
    v_current_judge court_participants%ROWTYPE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Verify caller is judge
    SELECT * INTO v_current_judge
    FROM court_participants
    WHERE court_session_id = p_court_session_id AND user_id = v_user_id AND role = 'judge';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only judge can call next');
    END IF;

    -- Get next person in queue
    SELECT * INTO v_next_participant
    FROM court_participants
    WHERE court_session_id = p_court_session_id AND queue_position IS NOT NULL
    ORDER BY queue_position
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Queue is empty');
    END IF;

    -- Assign to box
    UPDATE court_participants
    SET box_number = p_box_number,
        queue_position = NULL,
        is_hand_raised = false,
        updated_at = NOW()
    WHERE id = v_next_participant.id;

    -- Reorder queue
    UPDATE court_participants
    SET queue_position = queue_position - 1
    WHERE court_session_id = p_court_session_id AND queue_position > v_next_participant.queue_position;

    RETURN jsonb_build_object(
        'success', true,
        'called_user_id', v_next_participant.user_id,
        'box_number', p_box_number
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.join_court_session(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_raise_hand(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_lower_hand(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.court_call_next(UUID, INTEGER) TO authenticated;