-- Migration: Add Driver License Badge and Update Test Logic
-- Date: 2027-02-04

-- 1. Add Driver License Badge to Catalog
INSERT INTO public.badge_catalog (slug, name, description, category, rarity, sort_order, icon_url, is_active)
VALUES (
    'driver-license',
    'Licensed Driver',
    'Passed the Mai Troll Driving Test',
    'community',
    'common',
    4050,
    NULL,
    true
)
ON CONFLICT (slug) DO UPDATE
SET name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    rarity = excluded.rarity,
    sort_order = excluded.sort_order,
    is_active = true;

-- 2. Update submit_driver_test to award badge
CREATE OR REPLACE FUNCTION public.submit_driver_test(answers JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_score INTEGER := 0;
    v_passed BOOLEAN := false;
    v_correct_answers JSONB := '[
        {"q": 1, "a": "A"}, 
        {"q": 2, "a": "B"}, 
        {"q": 3, "a": "B"}, 
        {"q": 4, "a": "C"}, 
        {"q": 5, "a": "B"}, 
        {"q": 6, "a": "B"}, 
        {"q": 7, "a": "C"}, 
        {"q": 8, "a": "A"}, 
        {"q": 9, "a": "B"}, 
        {"q": 10, "a": "B"}
    ]';
    v_answer RECORD;
    v_user_answer TEXT;
    v_total_questions INTEGER := 10;
    v_badge_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Validate Answers
    FOR v_answer IN SELECT * FROM jsonb_array_elements(v_correct_answers)
    LOOP
        v_user_answer := answers->>(v_answer.value->>'q');
        IF v_user_answer = (v_answer.value->>'a') THEN
            v_score := v_score + 1;
        END IF;
    END LOOP;

    -- Pass condition: 90% (9/10)
    IF v_score >= 9 THEN
        v_passed := true;
        
        -- Update Profile
        UPDATE public.user_profiles
        SET drivers_license_status = 'active',
            drivers_license_expiry = now() + interval '30 days'
        WHERE id = v_user_id;
        
        -- Grant Badge
        SELECT id INTO v_badge_id FROM public.badge_catalog WHERE slug = 'driver-license';
        
        IF v_badge_id IS NOT NULL THEN
            INSERT INTO public.user_badges (user_id, badge_id)
            VALUES (v_user_id, v_badge_id)
            ON CONFLICT (user_id, badge_id) DO NOTHING;
        END IF;
        
        -- Bonus: Coins towards free vehicle
        PERFORM public.troll_bank_credit_coins(
             v_user_id,
             1000, -- Amount to earn
             'reward',
             'drivers_test_passed',
             NULL, -- p_ref_id
             '{}'::jsonb
        );
    END IF;

    RETURN jsonb_build_object(
        'passed', v_passed, 
        'score', v_score, 
        'percent', (v_score::float / v_total_questions::float) * 100
    );
END;
$$;

-- 3. Backfill existing licensed drivers
DO $$
DECLARE
    v_badge_id UUID;
BEGIN
    SELECT id INTO v_badge_id FROM public.badge_catalog WHERE slug = 'driver-license';
    
    IF v_badge_id IS NOT NULL THEN
        INSERT INTO public.user_badges (user_id, badge_id)
        SELECT id, v_badge_id
        FROM public.user_profiles
        WHERE drivers_license_status = 'active'
        ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
END $$;
