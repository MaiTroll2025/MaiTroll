-- Pride Broadcast Theme (2026 Legacy Edition) - Legacy Reward Distribution
-- Timestamp: 20260608000000

-- 1. Add broadcast_theme_slug column to streams if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'broadcast_theme_slug') THEN
        ALTER TABLE public.streams ADD COLUMN broadcast_theme_slug TEXT DEFAULT NULL;
    END IF;
END $$;

-- 2. Add missing columns to marketplace_items if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketplace_items' AND column_name = 'item_key') THEN
        ALTER TABLE public.marketplace_items ADD COLUMN item_key TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketplace_items' AND column_name = 'metadata') THEN
        ALTER TABLE public.marketplace_items ADD COLUMN metadata JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketplace_items' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.marketplace_items ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- 3. Create function to grant Pride Legacy theme to all existing users
CREATE OR REPLACE FUNCTION public.grant_pride_legacy_theme_2026()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item_id UUID;
    v_user RECORD;
BEGIN
    -- Check if the inventory item already exists
    SELECT id INTO v_item_id
    FROM public.marketplace_items
    WHERE item_key = 'pride_broadcast_theme_2026_legacy'
    LIMIT 1;

    -- Create the marketplace item if it doesn't exist
    IF v_item_id IS NULL THEN
        INSERT INTO public.marketplace_items (
            item_key,
            title,
            description,
            category,
            price_coins,
            status,
            metadata
        ) VALUES (
            'pride_broadcast_theme_2026_legacy',
            'Pride Broadcast Theme (2026 Legacy Edition)',
            'Celebrate Pride Month with a vibrant limited-edition broadcast experience.',
            'broadcast_themes',
            0,
            'active',
            '{"theme_id": "pride_legacy_2026", "is_legacy_reward": true, "year": 2026, "event": "pride_month"}'::jsonb
        )
        RETURNING id INTO v_item_id;
    END IF;

    -- Grant to all existing users who don't already have it
    FOR v_user IN SELECT id FROM public.user_profiles WHERE id IS NOT NULL
    LOOP
        INSERT INTO public.user_inventory (user_id, item_id, quantity, metadata, acquired_at)
        VALUES (
            v_user.id,
            v_item_id,
            1,
            '{"source": "legacy_reward", "event": "pride_month_2026", "auto_granted": true}'::jsonb,
            NOW()
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- 4. Execute the grant function
SELECT public.grant_pride_legacy_theme_2026();

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.grant_pride_legacy_theme_2026() TO authenticated;
