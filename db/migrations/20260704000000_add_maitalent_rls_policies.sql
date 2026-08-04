-- Combined migration: promo redemption tables for Maitalent.fun integration
-- Created: 2026-07-04
-- UPDATED: 2026-07-05 to implement MaiTalent promo card reward system safeguards and security fixes

-- ============================================================================
-- Require pgcrypto extension first for UUID generation
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Helper Functions for RLS (must be defined before use)
-- ============================================================================

-- Get current user's ID (Supabase provides auth.uid())
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid AS $$
BEGIN
  RETURN auth.uid();
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Get current user's placement context
CREATE OR REPLACE FUNCTION current_placement()
RETURNS text AS $$
BEGIN
  RETURN current_setting('app.current_placement', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Update current placement context
CREATE OR REPLACE FUNCTION set_current_placement(placement text)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_placement', placement, false);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Global Update Timestamp Trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Promo Cards Table - WITH USER-SPECIFIC REDEMPTION VALIDATION
-- ============================================================================

-- Drop existing tables if they exist to rebuild with correct schema
DROP TABLE IF EXISTS promo_card_redemptions CASCADE;
DROP TABLE IF EXISTS promo_cards CASCADE;
DROP TABLE IF EXISTS broadcast_reward_sessions CASCADE;
DROP TABLE IF EXISTS viewer_watch_sessions CASCADE;
DROP TABLE IF EXISTS share_reward_links CASCADE;

-- Create promo_cards table with required safeguards and user-specific validation
CREATE TABLE IF NOT EXISTS promo_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    token_amount numeric(12,2) NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_type text NOT NULL CHECK (source_type IN ('broadcast_start', 'broadcast_watch', 'share_link')),
    issued_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    redeemed_at timestamp with time zone NULL,
    redeemed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'redeemed', 'expired')),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT promo_cards_pkey PRIMARY KEY (id),
    CONSTRAINT promo_cards_code_key UNIQUE (code),
    CONSTRAINT promo_cards_token_amount_nonnegative CHECK (token_amount >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promo_cards_code ON promo_cards (code);
CREATE INDEX IF NOT EXISTS idx_promo_cards_user_source ON promo_cards (user_id, source_type);
CREATE INDEX IF NOT EXISTS idx_promo_cards_expires ON promo_cards (expires_at);
CREATE INDEX IF NOT EXISTS idx_promo_cards_status ON promo_cards (status);

-- Updated_at trigger for promo_cards
DROP TRIGGER IF EXISTS update_promo_cards_updated_at ON promo_cards;
CREATE TRIGGER update_promo_cards_updated_at
BEFORE UPDATE ON promo_cards
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Broadcast Reward Sessions Table
-- ============================================================================

DROP TABLE IF EXISTS broadcast_reward_sessions;

CREATE TABLE IF NOT EXISTS broadcast_reward_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    broadcaster_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at timestamp with time zone NOT NULL DEFAULT now(),
    ended_at timestamp with time zone NULL,
    duration_seconds integer NULL,
    reward_granted boolean NOT NULL DEFAULT false,
    promo_card_id uuid NULL REFERENCES promo_cards(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT broadcast_reward_sessions_pkey PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcast_reward_sessions_broadcaster ON broadcast_reward_sessions (broadcaster_user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_reward_sessions_promo_card ON broadcast_reward_sessions (promo_card_id);
DROP TRIGGER IF EXISTS update_broadcast_reward_sessions_updated_at ON broadcast_reward_sessions;
CREATE TRIGGER update_broadcast_reward_sessions_updated_at
BEFORE UPDATE ON broadcast_reward_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Viewer Watch Sessions Table
-- ============================================================================

DROP TABLE IF EXISTS viewer_watch_sessions;

CREATE TABLE IF NOT EXISTS viewer_watch_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    viewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    broadcaster_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    broadcast_id uuid NOT NULL,
    joined_at timestamp with time zone NOT NULL DEFAULT now(),
    left_at timestamp with time zone NULL,
    watch_duration_seconds integer NULL,
    reward_qualified boolean NOT NULL DEFAULT false,
    promo_card_id uuid NULL REFERENCES promo_cards(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT viewer_watch_sessions_pkey PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_viewer_watch_sessions_viewer ON viewer_watch_sessions (viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_viewer_watch_sessions_broadcaster ON viewer_watch_sessions (broadcaster_user_id);
CREATE INDEX IF NOT EXISTS idx_viewer_watch_sessions_broadcast ON viewer_watch_sessions (broadcast_id);
CREATE INDEX IF NOT EXISTS idx_viewer_watch_sessions_promo_card ON viewer_watch_sessions (promo_card_id);
DROP TRIGGER IF EXISTS update_viewer_watch_sessions_updated_at ON viewer_watch_sessions;
CREATE TRIGGER update_viewer_watch_sessions_updated_at
BEFORE UPDATE ON viewer_watch_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Share Reward Links Table (adds updated_at column)
-- ============================================================================

DROP TABLE IF EXISTS share_reward_links;

CREATE TABLE IF NOT EXISTS share_reward_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_url text NOT NULL CHECK (shared_url ~* '^https?://(www\.)?(maiMai Troll\.com|maitalent\.fun)'),
    platform_source text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    validated_at timestamp with time zone NULL,
    reward_qualified boolean NOT NULL DEFAULT false,
    promo_card_id uuid NULL REFERENCES promo_cards(id) ON DELETE SET NULL,
    CONSTRAINT share_reward_links_pkey PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_share_reward_links_user ON share_reward_links (user_id);
CREATE INDEX IF NOT EXISTS idx_share_reward_links_promo_card ON share_reward_links (promo_card_id);
DROP TRIGGER IF EXISTS update_share_reward_links_updated_at ON share_reward_links;
CREATE TRIGGER update_share_reward_links_updated_at
BEFORE UPDATE ON share_reward_links
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Promo Card Redemptions Table (adds updated_at column)
-- ============================================================================

DROP TABLE IF EXISTS promo_card_redemptions;

CREATE TABLE IF NOT EXISTS promo_card_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promo_card_id uuid NOT NULL REFERENCES promo_cards(id) ON DELETE CASCADE,
    requestor_platform text,
    requestor_account_id text,
    requestor_metadata jsonb,
    redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT promo_card_redemptions_pkey PRIMARY KEY (id),
    CONSTRAINT promo_card_redemptions_promo_card_id_key UNIQUE (promo_card_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promo_card_redemptions_promo_card ON promo_card_redemptions (promo_card_id);
CREATE INDEX IF NOT EXISTS idx_promo_card_redemptions_redeemed_at ON promo_card_redemptions (redeemed_at);
DROP TRIGGER IF EXISTS update_promo_card_redemptions_updated_at ON promo_card_redemptions;
CREATE TRIGGER update_promo_card_redemptions_updated_at
BEFORE UPDATE ON promo_card_redemptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- User-Specific Redemption Function (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION redeem_promo_card(
    p_code text,
    p_requestor_platform text DEFAULT NULL,
    p_requestor_account_id text DEFAULT NULL,
    p_requestor_metadata jsonb DEFAULT NULL
) RETURNS TABLE (
    success boolean,
    code text,
    token_amount numeric,
    promo_id uuid,
    status text,
    redeemed_at timestamp with time zone,
    error text,
    error_code text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_card promo_cards%ROWTYPE;
    v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RETURN QUERY SELECT false, NULL, NULL, NULL, NULL, NULL, 'Unauthorized', 'UNAUTHORIZED';
    END IF;

    SELECT * INTO v_card
    FROM promo_cards
    WHERE code = p_code
      AND user_id = v_user
      AND status = 'available'
      AND redeemed_at IS NULL
      AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
        IF EXISTS (SELECT 1 FROM promo_cards WHERE code = p_code AND user_id = v_user) THEN
            IF EXISTS (SELECT 1 FROM promo_cards WHERE code = p_code AND user_id = v_user AND redeemed_at IS NOT NULL) THEN
                RETURN QUERY SELECT false, p_code, NULL, NULL, NULL, NULL, 'Promo code already redeemed', 'ALREADY_REDEEMED';
            ELSIF EXISTS (SELECT 1 FROM promo_cards WHERE code = p_code AND user_id = v_user AND expires_at <= NOW()) THEN
                RETURN QUERY SELECT false, p_code, NULL, NULL, NULL, NULL, 'Promo code expired', 'EXPIRED_CODE';
            ELSE
                RETURN QUERY SELECT false, p_code, NULL, NULL, NULL, NULL, 'Promo code not available for redemption', 'NOT_AVAILABLE';
            END IF;
        ELSE
            RETURN QUERY SELECT false, p_code, NULL, NULL, NULL, NULL, 'Invalid promo code for this user', 'INVALID_CODE';
        END IF;
    END IF;

    UPDATE promo_cards
    SET status = 'redeemed', redeemed_at = NOW(), redeemed_by = v_user, updated_at = NOW()
    WHERE id = v_card.id;

    INSERT INTO promo_card_redemptions (
        promo_card_id, requestor_platform, requestor_account_id, requestor_metadata
    ) VALUES (
        v_card.id, p_requestor_platform, p_requestor_account_id, p_requestor_metadata
    );

    RETURN QUERY SELECT true, v_card.code, v_card.token_amount, v_card.id, v_card.status, NOW(), NULL, NULL;
END;
$$;

-- ============================================================================
-- Issue Promo Card Function (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION issue_promo_card(
    p_user_id uuid,
    p_source_type text,
    p_token_amount numeric DEFAULT 20,
    p_expires_in interval DEFAULT '24 hours',
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (
    promo_card_id uuid,
    code text,
    token_amount numeric,
    issued_at timestamp with time zone,
    expires_at timestamp with time zone,
    status text,
    next_available_at timestamp with time zone,
    message text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_can_issue boolean;
    v_next timestamp with time zone;
    v_reason text;
    v_code text;
    v_result can_issue_promo_card%ROWTYPE;
BEGIN
    SELECT * INTO v_result
    FROM can_issue_promo_card(p_user_id, p_source_type);

    v_can_issue := v_result.can_issue;
    v_next := v_result.next_available_at;
    v_reason := v_result.reason;

    IF NOT v_can_issue THEN
        RETURN QUERY SELECT NULL, NULL, NULL, NULL, NULL, NULL, v_next, v_reason;
    END IF;

    LOOP
        v_code := format('TC-%s-%s', substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 3), floor(random()*1000)+1000);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM promo_cards WHERE code = v_code);
    END LOOP;

    INSERT INTO promo_cards (code, token_amount, user_id, source_type, issued_at, expires_at, status, metadata)
    VALUES (v_code, p_token_amount, p_user_id, p_source_type, NOW(), NOW() + p_expires_in, 'available', p_metadata)
    RETURNING id, code, token_amount, issued_at, expires_at, status
    INTO promo_card_id, code, token_amount, issued_at, expires_at, status;

    RETURN QUERY SELECT promo_card_id, code, token_amount, issued_at, expires_at, status, NULL, 'Promo card issued';
END;
$$;

-- ============================================================================
-- Helper Functions for Cooldown Checks
-- ============================================================================
CREATE OR REPLACE FUNCTION can_issue_promo_card(
    p_user_id uuid,
    p_source_type text
) RETURNS TABLE (
    can_issue boolean,
    next_available_at timestamp with time zone,
    reason text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_last timestamp with time zone;
BEGIN
    IF p_source_type NOT IN ('broadcast_start','broadcast_watch','share_link') THEN
        RETURN QUERY SELECT false, NULL, 'Invalid source type'::text;
    END IF;

    SELECT issued_at INTO v_last
    FROM promo_cards
    WHERE user_id = p_user_id AND source_type = p_source_type AND status = 'available' AND expires_at > NOW()
    ORDER BY issued_at DESC LIMIT 1;

    IF v_last IS NOT NULL AND v_last >= NOW() - INTERVAL '4 hours' THEN
        RETURN QUERY SELECT false, v_last + INTERVAL '4 hours', 'Cooldown active'::text;
    END IF;

    RETURN QUERY SELECT true, NULL, 'Can issue'::text;
END;
$$;

-- ============================================================================
-- Expire Old Promo Cards (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION expire_old_promo_cards()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE promo_cards
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'available' AND expires_at <= NOW();
END;
$$;

-- ============================================================================
-- RLS Policies (auth.uid() for user identification)
-- ============================================================================
CREATE POLICY "promo_cards_user_own" ON promo_cards
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "promo_cards_service_all" ON promo_cards FOR ALL TO service_role USING (true);

CREATE POLICY "promo_card_redemptions_user_own" ON promo_card_redemptions
FOR SELECT USING (
    EXISTS (SELECT 1 FROM promo_cards WHERE id = promo_card_redemptions.promo_card_id AND user_id = auth.uid())
);
CREATE POLICY "promo_card_redemptions_service_all" ON promo_card_redemptions FOR ALL TO service_role USING (true);

-- ============================================================================
-- Grants
-- ============================================================================
GRANT ALL ON TABLE promo_cards TO service_role;
GRANT ALL ON TABLE promo_card_redemptions TO service_role;
GRANT ALL ON TABLE broadcast_reward_sessions TO service_role;
GRANT ALL ON TABLE viewer_watch_sessions TO service_role;
GRANT ALL ON TABLE share_reward_links TO service_role;

GRANT SELECT ON TABLE promo_cards TO authenticated;
GRANT SELECT ON TABLE promo_card_redemptions TO authenticated;
GRANT SELECT, INSERT ON TABLE broadcast_reward_sessions TO authenticated;
GRANT SELECT, INSERT ON TABLE viewer_watch_sessions TO authenticated;
GRANT SELECT, INSERT ON TABLE share_reward_links TO authenticated;

GRANT EXECUTE ON FUNCTION can_issue_promo_card(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION issue_promo_card(uuid, text, numeric, interval, jsonb) TO authenticated;
