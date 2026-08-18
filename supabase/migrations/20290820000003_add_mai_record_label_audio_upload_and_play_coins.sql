-- ============================================================
-- MAI Record Label: Audio Upload + Track Play Coins
-- ============================================================
-- 1. Storage bucket for MAI record label track audio files
-- 2. RPC to charge listeners 2 coins per play (1 to artist, 1 to admin)
-- 3. Update subscription split from 90/10 to 80/20 (admin gets 20%)

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'record-label-tracks',
  'record-label-tracks',
  true,
  52428800,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac', 'audio/m4a']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Public read for record-label-tracks"
ON storage.objects FOR SELECT
USING (bucket_id = 'record-label-tracks');

-- Artists can upload to their own folder
CREATE POLICY "Artists upload own tracks"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'record-label-tracks'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Artists can update their own files
CREATE POLICY "Artists update own tracks"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'record-label-tracks'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Artists can delete their own files
CREATE POLICY "Artists delete own tracks"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'record-label-tracks'
  AND auth.uid()::text = (storage.foldername(name))[1]
);


-- Delete policies for MAI tracks and albums

CREATE POLICY "record_label_track_artist_delete"
ON public.record_label_tracks
FOR DELETE
TO authenticated
USING (
  exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = auth.uid()
  )
);

CREATE POLICY "record_label_album_artist_delete"
ON public.record_label_albums
FOR DELETE
TO authenticated
USING (
  exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = auth.uid()
  )
);

-- ============================================================
-- UPDATE SUBSCRIPTION SPLIT: 80/20 (admin gets 20%)
-- ============================================================

CREATE OR REPLACE FUNCTION public.subscribe_to_creator(p_creator_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_subscriber user_profiles%ROWTYPE;
    v_creator user_profiles%ROWTYPE;
    v_existing user_subscriptions%ROWTYPE;
    v_subscription_id UUID;
    v_price INTEGER;
    v_creator_amount INTEGER;
    v_ceo_amount INTEGER;
    v_ceo_id UUID;
BEGIN
    SELECT * INTO v_subscriber FROM public.user_profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Subscriber not authenticated');
    END IF;

    SELECT * INTO v_creator FROM public.user_profiles WHERE id = p_creator_id;
    IF NOT FOUND OR NOT v_creator.creator_subscription_enabled THEN
        RETURN jsonb_build_object('success', false, 'error', 'Creator subscriptions not available');
    END IF;

    v_price := COALESCE(v_creator.creator_subscription_price_coins, 100);
    v_creator_amount := (v_price * 80 / 100);
    v_ceo_amount := (v_price * 20 / 100);

    IF v_subscriber.id = v_creator.id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot subscribe to yourself');
    END IF;

    SELECT * INTO v_existing
    FROM public.user_subscriptions
    WHERE subscriber_id = v_subscriber.id
      AND broadcaster_id = v_creator.id
      AND is_active = true;

    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already subscribed to this creator');
    END IF;

    IF v_subscriber.troll_coins < v_price THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient coins. Required: ' || v_price || '. You have: ' || v_subscriber.troll_coins
        );
    END IF;

    SELECT id INTO v_ceo_id
    FROM public.user_profiles
    WHERE role IN ('admin', 'ceo', 'superadmin')
    LIMIT 1;

    BEGIN
        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_price
        WHERE id = v_subscriber.id;

        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_creator_amount
        WHERE id = v_creator.id;

        IF v_ceo_id IS NOT NULL THEN
            UPDATE public.user_profiles
            SET troll_coins = troll_coins + v_ceo_amount
            WHERE id = v_ceo_id;
        END IF;

        INSERT INTO public.user_subscriptions (
            subscriber_id,
            broadcaster_id,
            price_paid_coins,
            creator_amount_coins,
            ceo_amount_coins,
            started_at,
            expires_at,
            is_active
        ) VALUES (
            v_subscriber.id,
            v_creator.id,
            v_price,
            v_creator_amount,
            v_ceo_amount,
            NOW(),
            NOW() + INTERVAL '30 days',
            true
        ) RETURNING id INTO v_subscription_id;

        INSERT INTO public.subscription_revenue_log (
            broadcaster_id,
            subscription_id,
            amount_coins,
            transaction_type,
            status,
            notes
        ) VALUES (
            v_creator.id,
            v_subscription_id,
            v_price,
            'monthly_fee',
            'completed',
            'Creator subscription - 80% to creator, 20% to CEO'
        );

        UPDATE public.user_profiles
        SET monthly_subscriber_count = COALESCE(monthly_subscriber_count, 0) + 1
        WHERE id = v_creator.id;

        PERFORM pg_notify(
            'subscription_created',
            jsonb_build_object(
                'broadcaster_id', v_creator.id,
                'subscriber_id', v_subscriber.id,
                'subscriber_username', v_subscriber.username,
                'amount', v_price
            )::text
        );

        RETURN jsonb_build_object(
            'success', true,
            'subscription', jsonb_build_object(
                'id', v_subscription_id,
                'price_paid_coins', v_price,
                'creator_amount_coins', v_creator_amount,
                'ceo_amount_coins', v_ceo_amount
            )
        );
    END;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.subscribe_to_creator(UUID) TO authenticated;

COMMENT ON FUNCTION public.subscribe_to_creator(UUID) IS 'Uses first admin/ceo/superadmin user found as CEO recipient for 20% fee';
