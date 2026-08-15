-- Enforce server-side subscription tiers and 80/20 revenue split
-- - Seed subscription_tiers if empty
-- - Replace create_subscription RPC with server-side enforcement
-- - 80% to broadcaster, 20% to fixed admin UUID
-- - Log 20% fee to admin_pool_ledger
-- - Send notification to fixed admin UUID

-- ============================================
-- 1. Seed subscription_tiers if empty
-- ============================================
INSERT INTO public.subscription_tiers (name, price_coins, benefits, color_hex, icon_name, is_active, sort_order)
VALUES
  ('Fan', 100, ARRAY['Subscriber-only chat', 'Special subscriber badge'], '#6B7280', 'Heart', true, 1),
  ('VIP', 500, ARRAY['All Fan benefits', 'Custom emotes', 'Golden VIP badge', 'Auto-highlighted chat in all streams'], '#3B82F6', 'Crown', true, 2),
  ('Elite', 2000, ARRAY['All VIP benefits', 'Priority chat', 'Elite badge', 'Monthly gift'], '#8B5CF6', 'Gem', true, 3),
  ('Mythic', 10000, ARRAY['All Elite benefits', 'Monthly 1:1 shoutout', 'Mythic badge', 'Direct DM access'], '#F59E0B', 'Star', true, 4)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. Replace create_subscription with 80/20 split logic
-- ============================================
DO $$
BEGIN
  BEGIN EXECUTE 'DROP FUNCTION IF EXISTS public.create_subscription(UUID, UUID, BOOLEAN)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN EXECUTE 'DROP FUNCTION IF EXISTS public.create_subscription(UUID, UUID, UUID, BOOLEAN)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN EXECUTE 'DROP FUNCTION IF EXISTS public.create_subscription(UUID, UUID)'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN EXECUTE 'DROP FUNCTION IF EXISTS public.create_subscription(UUID, UUID, UUID)'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE OR REPLACE FUNCTION public.create_subscription(
    p_broadcaster_id UUID,
    p_tier_id UUID,
    p_auto_renew BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
    v_subscriber user_profiles%ROWTYPE;
    v_broadcaster user_profiles%ROWTYPE;
    v_tier subscription_tiers%ROWTYPE;
    v_existing user_subscriptions%ROWTYPE;
    v_new_subscription user_subscriptions%ROWTYPE;
    v_pay_success BOOLEAN;
    v_creator_amount INTEGER;
    v_admin_amount INTEGER;
    v_admin_user_id UUID;
    v_pool_id UUID;
BEGIN
    SELECT * INTO v_subscriber FROM public.user_profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Subscriber not authenticated');
    END IF;

    IF COALESCE(v_subscriber.level, 1) < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Level 1 required to subscribe');
    END IF;

    SELECT * INTO v_broadcaster FROM public.user_profiles WHERE id = p_broadcaster_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Broadcaster not found');
    END IF;

    IF v_subscriber.id = v_broadcaster.id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot subscribe to yourself');
    END IF;

    SELECT * INTO v_tier FROM public.subscription_tiers
    WHERE id = p_tier_id AND is_active = true;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid subscription tier');
    END IF;

    v_creator_amount := (v_tier.price_coins * 80 / 100);
    v_admin_amount := (v_tier.price_coins * 20 / 100);

    v_admin_user_id := '3da9479f-2fb1-49d3-8b6a-a2bf25873d31'::UUID;

    SELECT * INTO v_existing
    FROM public.user_subscriptions
    WHERE subscriber_id = v_subscriber.id
      AND broadcaster_id = p_broadcaster_id
      AND is_active = true;

    IF FOUND THEN
        IF v_existing.tier_id = p_tier_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Already subscribed at this tier');
        END IF;

        UPDATE public.user_subscriptions
        SET
            tier_id = p_tier_id,
            total_paid_coins = total_paid_coins + v_tier.price_coins,
            updated_at = NOW()
        WHERE id = v_existing.id
        RETURNING * INTO v_new_subscription;

        v_pay_success := public.try_pay_coins(v_subscriber.id, v_tier.price_coins, 'subscription_upgrade', jsonb_build_object(
            'broadcaster_id', p_broadcaster_id,
            'tier_id', p_tier_id,
            'type', 'tier_upgrade'
        ));

        IF NOT v_pay_success THEN
            UPDATE public.user_subscriptions
            SET
                tier_id = v_existing.tier_id,
                total_paid_coins = total_paid_coins - v_tier.price_coins,
                updated_at = NOW()
            WHERE id = v_existing.id;

            RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins for upgrade');
        END IF;

        IF v_creator_amount > 0 THEN
            UPDATE public.user_profiles
            SET
                total_subscriber_revenue_coins = total_subscriber_revenue_coins + v_tier.price_coins,
                troll_coins = troll_coins + v_creator_amount,
                subscriber_badge_color_hex = v_tier.color_hex
            WHERE id = p_broadcaster_id;
        END IF;

        IF v_admin_amount > 0 THEN
            UPDATE public.user_profiles
            SET troll_coins = troll_coins + v_admin_amount
            WHERE id = v_admin_user_id;

            SELECT id INTO v_pool_id FROM public.admin_pool LIMIT 1;
            IF v_pool_id IS NOT NULL THEN
                UPDATE public.admin_pool
                SET trollcoins_balance = COALESCE(trollcoins_balance, 0) + v_admin_amount,
                    updated_at = NOW()
                WHERE id = v_pool_id;
            ELSE
                INSERT INTO public.admin_pool (user_id, trollcoins_balance)
                VALUES (v_admin_user_id, v_admin_amount);
            END IF;

            INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, source_type, streamer_id, created_at)
            VALUES (v_admin_amount, 'Subscription upgrade fee', v_subscriber.id, 'subscription', p_broadcaster_id, NOW());

            INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read, created_at)
            VALUES (
                v_admin_user_id,
                'system_announcement',
                'Subscription Fee Received',
                '20% fee from subscription upgrade by @' || v_subscriber.username || ' to @' || v_broadcaster.username || ': ' || v_admin_amount || ' coins',
                jsonb_build_object('subscriber_id', v_subscriber.id, 'broadcaster_id', p_broadcaster_id, 'amount', v_admin_amount, 'tier_id', p_tier_id, 'subscription_id', v_existing.id),
                false,
                NOW()
            );
        END IF;

        INSERT INTO public.subscription_revenue_log (
            broadcaster_id, subscription_id, amount_coins,
            transaction_type, status, notes
        ) VALUES (
            p_broadcaster_id, v_existing.id, v_tier.price_coins,
            'upgrade', 'completed', '80% to creator, 20% to admin pool'
        );
    ELSE
        v_pay_success := public.try_pay_coins(v_subscriber.id, v_tier.price_coins, 'subscription', jsonb_build_object(
            'broadcaster_id', p_broadcaster_id,
            'tier_id', p_tier_id,
            'type', 'new_subscription'
        ));

        IF NOT v_pay_success THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Insufficient coins. Required: ' || v_tier.price_coins || '. You have: ' || v_subscriber.troll_coins
            );
        END IF;

        INSERT INTO public.user_subscriptions (
            subscriber_id, broadcaster_id, tier_id,
            started_at, expires_at, is_active,
            auto_renew, total_paid_coins
        ) VALUES (
            v_subscriber.id, p_broadcaster_id, p_tier_id,
            NOW(),
            CASE WHEN p_auto_renew THEN (NOW() + INTERVAL '30 days') ELSE NULL END,
            true,
            p_auto_renew,
            v_tier.price_coins
        ) RETURNING * INTO v_new_subscription;

        BEGIN
            INSERT INTO public.user_follows (follower_id, following_id)
            VALUES (v_subscriber.id, p_broadcaster_id)
            ON CONFLICT (follower_id, following_id) DO NOTHING;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Follow creation failed: %', SQLERRM;
        END;

        IF v_creator_amount > 0 THEN
            UPDATE public.user_profiles
            SET
                total_subscriber_revenue_coins = total_subscriber_revenue_coins + v_tier.price_coins,
                troll_coins = troll_coins + v_creator_amount,
                subscriber_badge_color_hex = v_tier.color_hex
            WHERE id = p_broadcaster_id;
        END IF;

        IF v_admin_amount > 0 THEN
            UPDATE public.user_profiles
            SET troll_coins = troll_coins + v_admin_amount
            WHERE id = v_admin_user_id;

            SELECT id INTO v_pool_id FROM public.admin_pool LIMIT 1;
            IF v_pool_id IS NOT NULL THEN
                UPDATE public.admin_pool
                SET trollcoins_balance = COALESCE(trollcoins_balance, 0) + v_admin_amount,
                    updated_at = NOW()
                WHERE id = v_pool_id;
            ELSE
                INSERT INTO public.admin_pool (user_id, trollcoins_balance)
                VALUES (v_admin_user_id, v_admin_amount);
            END IF;

            INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, source_type, streamer_id, created_at)
            VALUES (v_admin_amount, 'New subscription fee', v_subscriber.id, 'subscription', p_broadcaster_id, NOW());

            INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read, created_at)
            VALUES (
                v_admin_user_id,
                'system_announcement',
                'Subscription Fee Received',
                '20% fee from subscription by @' || v_subscriber.username || ' to @' || v_broadcaster.username || ': ' || v_admin_amount || ' coins',
                jsonb_build_object('subscriber_id', v_subscriber.id, 'broadcaster_id', p_broadcaster_id, 'amount', v_admin_amount, 'tier_id', p_tier_id, 'subscription_id', v_new_subscription.id),
                false,
                NOW()
            );
        END IF;

        UPDATE public.user_profiles
        SET
            total_subscriber_revenue_coins = total_subscriber_revenue_coins + v_tier.price_coins,
            monthly_subscriber_count = monthly_subscriber_count + 1,
            subscriber_badge_color_hex = v_tier.color_hex
        WHERE id = p_broadcaster_id;

        INSERT INTO public.subscription_revenue_log (
            broadcaster_id, subscription_id, amount_coins,
            transaction_type, status
        ) VALUES (
            p_broadcaster_id, v_new_subscription.id, v_tier.price_coins,
            'monthly_fee', 'completed'
        );

        PERFORM pg_notify(
            'subscription_created',
            jsonb_build_object(
                'broadcaster_id', p_broadcaster_id,
                'subscriber_id', v_subscriber.id,
                'subscriber_username', v_subscriber.username,
                'tier_id', p_tier_id,
                'tier_name', v_tier.name,
                'amount', v_tier.price_coins
            )::text
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'subscription', row_to_json(v_new_subscription),
        'tier', row_to_json(v_tier)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_subscription(UUID, UUID, BOOLEAN) TO authenticated;
