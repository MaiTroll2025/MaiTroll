-- ============================================================================
-- Migration: MaiTroll Auction Me + Highlighted Chat + Seat Focus
-- Date: 2026-08-25
-- Purpose: Isolated broadcast game system (Auction Me), coin-store perk
--          (Highlighted Chat), and viewer-local audio preference (Seat Focus).
--          These do NOT touch existing auction tables, roles, or coin logic.
-- ============================================================================

-- ============================================================================
-- PART 1: AUCTION ME
-- ============================================================================

-- 1. Auction Me sessions
CREATE TABLE IF NOT EXISTS public.maitroll_auction_me_sessions (
    auction_me_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_me_stream_id UUID NOT NULL,
    auction_me_broadcaster_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auction_me_title_type TEXT NOT NULL CHECK (auction_me_title_type IN ('husband', 'wife')),
    auction_me_starting_bid BIGINT NOT NULL CHECK (auction_me_starting_bid >= 0),
    auction_me_current_bid BIGINT NOT NULL DEFAULT 0,
    auction_me_current_bidder_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    auction_me_current_bidder_name TEXT,
    auction_me_status TEXT NOT NULL DEFAULT 'active' CHECK (auction_me_status IN ('active', 'ended', 'cancelled')),
    auction_me_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auction_me_ends_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 seconds',
    auction_me_ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.maitroll_auction_me_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Broadcaster can view own auction me sessions"
    ON public.maitroll_auction_me_sessions FOR SELECT
    USING (auth.uid() = auction_me_broadcaster_id);

CREATE POLICY "Public can view active auction me sessions for stream"
    ON public.maitroll_auction_me_sessions FOR SELECT
    USING (auction_me_status = 'active');

CREATE POLICY "Broadcaster can insert auction me sessions"
    ON public.maitroll_auction_me_sessions FOR INSERT
    WITH CHECK (auth.uid() = auction_me_broadcaster_id);

CREATE POLICY "Broadcaster can update own auction me sessions"
    ON public.maitroll_auction_me_sessions FOR UPDATE
    USING (auth.uid() = auction_me_broadcaster_id);

CREATE INDEX IF NOT EXISTS idx_maitroll_auction_me_sessions_stream
    ON public.maitroll_auction_me_sessions(auction_me_stream_id);

CREATE INDEX IF NOT EXISTS idx_maitroll_auction_me_sessions_broadcaster
    ON public.maitroll_auction_me_sessions(auction_me_broadcaster_id);

CREATE INDEX IF NOT EXISTS idx_maitroll_auction_me_sessions_status
    ON public.maitroll_auction_me_sessions(auction_me_status);

-- 2. Auction Me bids
CREATE TABLE IF NOT EXISTS public.maitroll_auction_me_bids (
    auction_me_bid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_me_session_id UUID NOT NULL REFERENCES public.maitroll_auction_me_sessions(auction_me_session_id) ON DELETE CASCADE,
    auction_me_bidder_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auction_me_bid_amount BIGINT NOT NULL CHECK (auction_me_bid_amount > 0),
    auction_me_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.maitroll_auction_me_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view auction me bids"
    ON public.maitroll_auction_me_bids FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can insert auction me bids"
    ON public.maitroll_auction_me_bids FOR INSERT
    WITH CHECK (auth.uid() = auction_me_bidder_id);

CREATE INDEX IF NOT EXISTS idx_maitroll_auction_me_bids_session
    ON public.maitroll_auction_me_bids(auction_me_session_id);

CREATE INDEX IF NOT EXISTS idx_maitroll_auction_me_bids_bidder
    ON public.maitroll_auction_me_bids(auction_me_bidder_id);

-- 3. Auction Me winners
CREATE TABLE IF NOT EXISTS public.maitroll_auction_me_winners (
    auction_me_winner_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_me_session_id UUID NOT NULL REFERENCES public.maitroll_auction_me_sessions(auction_me_session_id) ON DELETE CASCADE,
    auction_me_winner_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auction_me_winner_name TEXT NOT NULL,
    auction_me_final_bid BIGINT NOT NULL,
    auction_me_title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.maitroll_auction_me_winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view auction me winners"
    ON public.maitroll_auction_me_winners FOR SELECT
    USING (true);

CREATE POLICY "System can insert auction me winners"
    ON public.maitroll_auction_me_winners FOR INSERT
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_maitroll_auction_me_winners_session
    ON public.maitroll_auction_me_winners(auction_me_session_id);

CREATE INDEX IF NOT EXISTS idx_maitroll_auction_me_winners_user
    ON public.maitroll_auction_me_winners(auction_me_winner_user_id);

-- 4. Auction Me RPCs

-- Start an Auction Me session
CREATE OR REPLACE FUNCTION public.start_auction_me(
    p_stream_id UUID,
    p_broadcaster_id UUID,
    p_title_type TEXT,
    p_starting_bid BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session_id UUID;
    v_now TIMESTAMPTZ := NOW();
    v_broadcaster_name TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    IF auth.uid() != p_broadcaster_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the broadcaster can start Auction Me');
    END IF;

    IF p_title_type NOT IN ('husband', 'wife') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid title type');
    END IF;

    IF p_starting_bid < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Starting bid cannot be negative');
    END IF;

    SELECT username INTO v_broadcaster_name
    FROM public.user_profiles
    WHERE id = p_broadcaster_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Broadcaster not found');
    END IF;

    INSERT INTO public.maitroll_auction_me_sessions (
        auction_me_stream_id,
        auction_me_broadcaster_id,
        auction_me_title_type,
        auction_me_starting_bid,
        auction_me_current_bid,
        auction_me_status,
        auction_me_started_at,
        auction_me_ends_at
    ) VALUES (
        p_stream_id,
        p_broadcaster_id,
        p_title_type,
        p_starting_bid,
        p_starting_bid,
        'active',
        v_now,
        v_now + INTERVAL '30 seconds'
    ) RETURNING auction_me_session_id INTO v_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'title_type', p_title_type,
        'starting_bid', p_starting_bid,
        'current_bid', p_starting_bid,
        'ends_at', (v_now + INTERVAL '30 seconds')::TEXT
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_auction_me(UUID, UUID, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_auction_me(UUID, UUID, TEXT, BIGINT) TO service_role;

-- Place an Auction Me bid (atomic)
CREATE OR REPLACE FUNCTION public.place_auction_me_bid(
    p_session_id UUID,
    p_bid_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_bidder_id UUID := auth.uid();
    v_bidder_name TEXT;
    v_balance BIGINT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF v_bidder_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    IF p_bid_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bid must be greater than zero');
    END IF;

    SELECT * INTO v_session
    FROM public.maitroll_auction_me_sessions
    WHERE auction_me_session_id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction session not found');
    END IF;

    IF v_session.auction_me_status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction is not active');
    END IF;

    IF v_session.auction_me_ends_at <= v_now THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction has ended');
    END IF;

    IF p_bid_amount <= COALESCE(v_session.auction_me_current_bid, 0) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bid must be higher than current bid', 'current_bid', v_session.auction_me_current_bid);
    END IF;

    IF v_bidder_id = v_session.auction_me_broadcaster_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Broadcaster cannot bid on their own auction');
    END IF;

    SELECT troll_coins INTO v_balance
    FROM public.user_profiles
    WHERE id = v_bidder_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
    END IF;

    IF COALESCE(v_balance, 0) < p_bid_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient Troll Coins', 'required', p_bid_amount, 'available', COALESCE(v_balance, 0));
    END IF;

    SELECT username INTO v_bidder_name
    FROM public.user_profiles
    WHERE id = v_bidder_id;

    -- Refund previous highest bidder if different
    IF v_session.auction_me_current_bidder_id IS NOT NULL
       AND v_session.auction_me_current_bidder_id != v_bidder_id THEN
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + COALESCE(v_session.auction_me_current_bid, 0)
        WHERE id = v_session.auction_me_current_bidder_id;

        INSERT INTO public.coin_transactions (
            user_id, amount, type, description, metadata, created_at
        ) VALUES (
            v_session.auction_me_current_bidder_id,
            v_session.auction_me_current_bid,
            'auction_me_refund',
            'Auction Me bid refunded',
            jsonb_build_object('session_id', p_session_id, 'refunded_bid', v_session.auction_me_current_bid),
            v_now
        );
    END IF;

    -- Deduct new bid amount
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_bid_amount
    WHERE id = v_bidder_id;

    INSERT INTO public.coin_transactions (
        user_id, amount, type, description, metadata, created_at
    ) VALUES (
        v_bidder_id,
        -p_bid_amount,
        'auction_me_bid',
        'Auction Me bid placed',
        jsonb_build_object('session_id', p_session_id, 'bid_amount', p_bid_amount),
        v_now
    );

    -- Record bid
    INSERT INTO public.maitroll_auction_me_bids (
        auction_me_session_id,
        auction_me_bidder_id,
        auction_me_bid_amount
    ) VALUES (
        p_session_id,
        v_bidder_id,
        p_bid_amount
    );

    -- Update session
    UPDATE public.maitroll_auction_me_sessions
    SET
        auction_me_current_bid = p_bid_amount,
        auction_me_current_bidder_id = v_bidder_id,
        auction_me_current_bidder_name = v_bidder_name,
        auction_me_ends_at = v_now + INTERVAL '30 seconds',
        updated_at = v_now
    WHERE auction_me_session_id = p_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'current_bid', p_bid_amount,
        'current_bidder_id', v_bidder_id,
        'current_bidder_name', v_bidder_name,
        'ends_at', (v_now + INTERVAL '30 seconds')::TEXT
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_auction_me_bid(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_auction_me_bid(UUID, BIGINT) TO service_role;

-- End an Auction Me session and crown winner
CREATE OR REPLACE FUNCTION public.end_auction_me(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_winner_id UUID;
    v_winner_name TEXT;
    v_final_bid BIGINT;
    v_title TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT * INTO v_session
    FROM public.maitroll_auction_me_sessions
    WHERE auction_me_session_id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction session not found');
    END IF;

    IF auth.uid() != v_session.auction_me_broadcaster_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the broadcaster can end the auction');
    END IF;

    IF v_session.auction_me_status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction is not active');
    END IF;

    UPDATE public.maitroll_auction_me_sessions
    SET
        auction_me_status = 'ended',
        auction_me_ended_at = v_now,
        updated_at = v_now
    WHERE auction_me_session_id = p_session_id;

    IF v_session.auction_me_current_bidder_id IS NOT NULL THEN
        v_winner_id := v_session.auction_me_current_bidder_id;
        v_winner_name := COALESCE(v_session.auction_me_current_bidder_name, 'Unknown');
        v_final_bid := v_session.auction_me_current_bid;
        v_title := v_session.auction_me_title_type;

        INSERT INTO public.maitroll_auction_me_winners (
            auction_me_session_id,
            auction_me_winner_user_id,
            auction_me_winner_name,
            auction_me_final_bid,
            auction_me_title
        ) VALUES (
            p_session_id,
            v_winner_id,
            v_winner_name,
            v_final_bid,
            v_title
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'winner_id', v_winner_id,
        'winner_name', v_winner_name,
        'final_bid', v_final_bid,
        'title', v_title
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_auction_me(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_auction_me(UUID) TO service_role;

-- Get Auction Me state for a stream
CREATE OR REPLACE FUNCTION public.get_auction_me_state(
    p_stream_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_broadcaster_name TEXT;
    v_top_bids JSONB;
BEGIN
    SELECT s.*, p.username as broadcaster_name
    INTO v_session
    FROM public.maitroll_auction_me_sessions s
    JOIN public.user_profiles p ON p.id = s.auction_me_broadcaster_id
    WHERE s.auction_me_stream_id = p_stream_id
      AND s.auction_me_status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', true, 'active', false);
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'bidder_id', b.auction_me_bidder_id,
            'bidder_name', up.username,
            'amount', b.auction_me_bid_amount,
            'created_at', b.auction_me_created_at
        )
    ) INTO v_top_bids
    FROM public.maitroll_auction_me_bids b
    JOIN public.user_profiles up ON up.id = b.auction_me_bidder_id
    WHERE b.auction_me_session_id = v_session.auction_me_session_id
    ORDER BY b.auction_me_bid_amount DESC
    LIMIT 10;

    RETURN jsonb_build_object(
        'success', true,
        'active', true,
        'session_id', v_session.auction_me_session_id,
        'broadcaster_id', v_session.auction_me_broadcaster_id,
        'broadcaster_name', v_session.broadcaster_name,
        'title_type', v_session.auction_me_title_type,
        'starting_bid', v_session.auction_me_starting_bid,
        'current_bid', v_session.auction_me_current_bid,
        'current_bidder_id', v_session.auction_me_current_bidder_id,
        'current_bidder_name', v_session.auction_me_current_bidder_name,
        'ends_at', v_session.auction_me_ends_at,
        'top_bids', COALESCE(v_top_bids, '[]'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auction_me_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auction_me_state(UUID) TO service_role;

-- Cancel Auction Me
CREATE OR REPLACE FUNCTION public.cancel_auction_me(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT * INTO v_session
    FROM public.maitroll_auction_me_sessions
    WHERE auction_me_session_id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction session not found');
    END IF;

    IF auth.uid() != v_session.auction_me_broadcaster_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the broadcaster can cancel the auction');
    END IF;

    IF v_session.auction_me_status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction is not active');
    END IF;

    -- Refund current highest bidder
    IF v_session.auction_me_current_bidder_id IS NOT NULL THEN
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + COALESCE(v_session.auction_me_current_bid, 0)
        WHERE id = v_session.auction_me_current_bidder_id;

        INSERT INTO public.coin_transactions (
            user_id, amount, type, description, metadata, created_at
        ) VALUES (
            v_session.auction_me_current_bidder_id,
            v_session.auction_me_current_bid,
            'auction_me_refund',
            'Auction Me cancelled - bid refunded',
            jsonb_build_object('session_id', p_session_id, 'refunded_bid', v_session.auction_me_current_bid),
            v_now
        );
    END IF;

    UPDATE public.maitroll_auction_me_sessions
    SET
        auction_me_status = 'cancelled',
        auction_me_ended_at = v_now,
        updated_at = v_now
    WHERE auction_me_session_id = p_session_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_auction_me(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_auction_me(UUID) TO service_role;

-- ============================================================================
-- PART 2: HIGHLIGHTED CHAT
-- ============================================================================

-- Add highlighted chat columns to stream_messages
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stream_messages' AND column_name = 'is_highlighted'
    ) THEN
        ALTER TABLE public.stream_messages ADD COLUMN is_highlighted BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stream_messages' AND column_name = 'highlight_color'
    ) THEN
        ALTER TABLE public.stream_messages ADD COLUMN highlight_color TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stream_messages_highlighted
    ON public.stream_messages(is_highlighted) WHERE is_highlighted = true;

-- ============================================================================
-- PART 3: SEAT FOCUS (no DB changes needed - client-side only)
-- ============================================================================

-- Realtime publication for Auction Me tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.maitroll_auction_me_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maitroll_auction_me_bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maitroll_auction_me_winners;
