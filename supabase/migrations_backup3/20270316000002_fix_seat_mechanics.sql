-- RPC: Join Seat Atomic
CREATE OR REPLACE FUNCTION public.join_seat_atomic(p_stream_id UUID, p_seat_index INTEGER, p_price INTEGER)
RETURNS TABLE (success BOOLEAN, message TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_is_locked BOOLEAN;
    v_seat_price INTEGER;
    v_exists BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if stream exists and get settings
    SELECT are_seats_locked, seat_price INTO v_is_locked, v_seat_price
    FROM public.streams WHERE id = p_stream_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Stream not found'::TEXT;
        RETURN;
    END IF;
    
    IF v_is_locked THEN
        RETURN QUERY SELECT false, 'Seats are currently locked'::TEXT;
        RETURN;
    END IF;

    -- Check if seat is occupied
    SELECT EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND seat_index = p_seat_index 
        AND status = 'active'
    ) INTO v_exists;
    
    IF v_exists THEN
        RETURN QUERY SELECT false, 'Seat is already occupied'::TEXT;
        RETURN;
    END IF;

    -- Check if user is already in a seat
    SELECT EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND user_id = v_user_id 
        AND status = 'active'
    ) INTO v_exists;
    
    IF v_exists THEN
        RETURN QUERY SELECT false, 'You are already in a seat'::TEXT;
        RETURN;
    END IF;

    -- Handle Payment if needed
    IF v_seat_price > 0 THEN
        IF (SELECT troll_coins FROM public.user_profiles WHERE id = v_user_id) < v_seat_price THEN
            RETURN QUERY SELECT false, 'Insufficient coins'::TEXT;
            RETURN;
        END IF;
        
        -- Deduct coins
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - v_seat_price 
        WHERE id = v_user_id;
        
        -- Pay Host (optional, maybe partial?) - For now just burn/transfer logic can be added here
        -- Update stream owner balance?
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_seat_price
        WHERE id = (SELECT user_id FROM public.streams WHERE id = p_stream_id);
    END IF;

    -- Insert Session
    INSERT INTO public.stream_seat_sessions (stream_id, user_id, seat_index, status, price_paid)
    VALUES (p_stream_id, v_user_id, p_seat_index, 'active', v_seat_price);

    RETURN QUERY SELECT true, 'Joined seat successfully'::TEXT;
END;
$$;
