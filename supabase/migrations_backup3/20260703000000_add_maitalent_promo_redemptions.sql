-- Add promo card issuance and redemption tables for external MaiTalent.fun integration

CREATE TABLE IF NOT EXISTS public.promo_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    token_amount numeric(12,2) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    expires_at timestamp with time zone,
    issued_at timestamp with time zone NOT NULL DEFAULT now(),
    source text,
    metadata jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT promo_cards_pkey PRIMARY KEY (id),
    CONSTRAINT promo_cards_code_key UNIQUE (code),
    CONSTRAINT promo_cards_token_amount_nonnegative CHECK (token_amount >= 0)
);

ALTER TABLE ONLY public.promo_cards FORCE ROW LEVEL SECURITY;
ALTER TABLE public.promo_cards OWNER TO postgres;
COMMENT ON TABLE public.promo_cards IS 'Mai Troll promo cards issued for external redemption such as MaiTalent.fun';
GRANT ALL ON TABLE public.promo_cards TO service_role;
CREATE INDEX IF NOT EXISTS idx_promo_cards_code ON public.promo_cards (code);

CREATE TABLE IF NOT EXISTS public.promo_card_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promo_card_id uuid NOT NULL,
    requestor_platform text,
    requestor_account_id text,
    requestor_metadata jsonb,
    redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT promo_card_redemptions_pkey PRIMARY KEY (id),
    CONSTRAINT promo_card_redemptions_promo_card_id_key UNIQUE (promo_card_id)
);

ALTER TABLE ONLY public.promo_card_redemptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.promo_card_redemptions OWNER TO postgres;
COMMENT ON TABLE public.promo_card_redemptions IS 'Tracks redemption events for external promo cards';
GRANT ALL ON TABLE public.promo_card_redemptions TO service_role;

ALTER TABLE ONLY public.promo_card_redemptions
    ADD CONSTRAINT promo_card_redemptions_promo_card_id_fkey FOREIGN KEY (promo_card_id)
    REFERENCES public.promo_cards (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_promo_card_redemptions_promo_card_id ON public.promo_card_redemptions (promo_card_id);

CREATE OR REPLACE FUNCTION public.redeem_promo_card(
    p_code text,
    p_requestor_platform text DEFAULT NULL,
    p_requestor_account_id text DEFAULT NULL,
    p_requestor_metadata jsonb DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO public, extensions
AS $$
DECLARE
    v_card RECORD;
    v_existing_redemption RECORD;
    v_daily_redemptions integer;
BEGIN
    -- Daily cap check
    SELECT COUNT(*) INTO v_daily_redemptions
    FROM promo_card_redemptions
    WHERE requestor_account_id = p_requestor_account_id
        AND redeemed_at >= NOW() - INTERVAL '24 hours';
    
    IF v_daily_redemptions >= 3 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Promo redemption would exceed daily cap',
            'code', 'DAILY_CAP_EXCEEDED'
        );
    END IF;
    
    SELECT * INTO v_card
    FROM promo_cards
    WHERE code = p_code
    LIMIT 1
    FOR UPDATE;

    IF v_card IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid promo code',
            'code', 'INVALID_CODE'
        );
    END IF;

    IF v_card.expires_at IS NOT NULL AND v_card.expires_at <= NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Promo code expired',
            'code', 'EXPIRED_CODE'
        );
    END IF;

    IF NOT v_card.is_active THEN
        SELECT * INTO v_existing_redemption
        FROM promo_card_redemptions
        WHERE promo_card_id = v_card.id
        LIMIT 1;

        IF v_existing_redemption IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Promo code already redeemed',
                'code', 'ALREADY_REDEEMED'
            );
        END IF;

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Promo code revoked',
            'code', 'REVOKED_CODE'
        );
    END IF;

    SELECT * INTO v_existing_redemption
    FROM promo_card_redemptions
    WHERE promo_card_id = v_card.id
    LIMIT 1;

    IF v_existing_redemption IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Promo code already redeemed',
            'code', 'ALREADY_REDEEMED'
        );
    END IF;

    INSERT INTO promo_card_redemptions (
        promo_card_id,
        requestor_platform,
        requestor_account_id,
        requestor_metadata,
        redeemed_at
    ) VALUES (
        v_card.id,
        p_requestor_platform,
        p_requestor_account_id,
        p_requestor_metadata,
        NOW()
    );

    UPDATE promo_cards
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE id = v_card.id;

    RETURN jsonb_build_object(
        'success', true,
        'promoId', v_card.id,
        'code', v_card.code,
        'tokenAmount', v_card.token_amount,
        'status', 'redeemed',
        'redeemedAt', NOW()
    );
END;
$$;

ALTER FUNCTION public.redeem_promo_card(text, text, text, jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.redeem_promo_card(text, text, text, jsonb) TO service_role;
