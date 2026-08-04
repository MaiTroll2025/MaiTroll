-- Migration to rename entrance effect IDs from 'eX' prefixes to descriptive slugs
-- Strategy: Insert new rows -> Update references -> Delete old rows

DO $$
BEGIN
    -- Helper function-like block via repetition for safety

    -- e1 -> effect_troll_classic
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e1') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_troll_classic', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e1'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_troll_classic' WHERE effect_id = 'e1';
        UPDATE user_profiles SET active_entrance_effect = 'effect_troll_classic' WHERE active_entrance_effect = 'e1';
        DELETE FROM entrance_effects WHERE id = 'e1';
    END IF;

    -- e2 -> effect_royal_sparkle_crown
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e2') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_royal_sparkle_crown', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e2'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_royal_sparkle_crown' WHERE effect_id = 'e2';
        UPDATE user_profiles SET active_entrance_effect = 'effect_royal_sparkle_crown' WHERE active_entrance_effect = 'e2';
        DELETE FROM entrance_effects WHERE id = 'e2';
    END IF;

    -- e3 -> effect_neon_meteor_shower
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e3') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_neon_meteor_shower', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e3'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_neon_meteor_shower' WHERE effect_id = 'e3';
        UPDATE user_profiles SET active_entrance_effect = 'effect_neon_meteor_shower' WHERE active_entrance_effect = 'e3';
        DELETE FROM entrance_effects WHERE id = 'e3';
    END IF;

    -- e4 -> effect_lightning_strike_arrival
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e4') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_lightning_strike_arrival', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e4'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_lightning_strike_arrival' WHERE effect_id = 'e4';
        UPDATE user_profiles SET active_entrance_effect = 'effect_lightning_strike_arrival' WHERE active_entrance_effect = 'e4';
        DELETE FROM entrance_effects WHERE id = 'e4';
    END IF;

    -- e5 -> effect_chaos_portal_arrival
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e5') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_chaos_portal_arrival', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e5'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_chaos_portal_arrival' WHERE effect_id = 'e5';
        UPDATE user_profiles SET active_entrance_effect = 'effect_chaos_portal_arrival' WHERE active_entrance_effect = 'e5';
        DELETE FROM entrance_effects WHERE id = 'e5';
    END IF;

    -- e6 -> effect_galactic_warp_beam
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e6') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_galactic_warp_beam', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e6'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_galactic_warp_beam' WHERE effect_id = 'e6';
        UPDATE user_profiles SET active_entrance_effect = 'effect_galactic_warp_beam' WHERE active_entrance_effect = 'e6';
        DELETE FROM entrance_effects WHERE id = 'e6';
    END IF;

    -- e7 -> effect_troll_city_vip_flames
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e7') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_troll_city_vip_flames', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e7'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_troll_city_vip_flames' WHERE effect_id = 'e7';
        UPDATE user_profiles SET active_entrance_effect = 'effect_troll_city_vip_flames' WHERE active_entrance_effect = 'e7';
        DELETE FROM entrance_effects WHERE id = 'e7';
    END IF;

    -- e8 -> effect_flaming_gold_crown_drop
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e8') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_flaming_gold_crown_drop', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e8'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_flaming_gold_crown_drop' WHERE effect_id = 'e8';
        UPDATE user_profiles SET active_entrance_effect = 'effect_flaming_gold_crown_drop' WHERE active_entrance_effect = 'e8';
        DELETE FROM entrance_effects WHERE id = 'e8';
    END IF;

    -- e9 -> effect_aurora_storm_entrance
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e9') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_aurora_storm_entrance', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e9'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_aurora_storm_entrance' WHERE effect_id = 'e9';
        UPDATE user_profiles SET active_entrance_effect = 'effect_aurora_storm_entrance' WHERE active_entrance_effect = 'e9';
        DELETE FROM entrance_effects WHERE id = 'e9';
    END IF;

    -- e10 -> effect_black_hole_vortex
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e10') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_black_hole_vortex', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e10'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_black_hole_vortex' WHERE effect_id = 'e10';
        UPDATE user_profiles SET active_entrance_effect = 'effect_black_hole_vortex' WHERE active_entrance_effect = 'e10';
        DELETE FROM entrance_effects WHERE id = 'e10';
    END IF;

    -- e11 -> effect_money_shower_madness
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e11') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_money_shower_madness', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e11'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_money_shower_madness' WHERE effect_id = 'e11';
        UPDATE user_profiles SET active_entrance_effect = 'effect_money_shower_madness' WHERE active_entrance_effect = 'e11';
        DELETE FROM entrance_effects WHERE id = 'e11';
    END IF;

    -- e12 -> effect_floating_royal_throne
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e12') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_floating_royal_throne', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e12'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_floating_royal_throne' WHERE effect_id = 'e12';
        UPDATE user_profiles SET active_entrance_effect = 'effect_floating_royal_throne' WHERE active_entrance_effect = 'e12';
        DELETE FROM entrance_effects WHERE id = 'e12';
    END IF;

    -- e13 -> effect_platinum_fire_tornado
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e13') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_platinum_fire_tornado', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e13'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_platinum_fire_tornado' WHERE effect_id = 'e13';
        UPDATE user_profiles SET active_entrance_effect = 'effect_platinum_fire_tornado' WHERE active_entrance_effect = 'e13';
        DELETE FROM entrance_effects WHERE id = 'e13';
    END IF;

    -- e14 -> effect_cosmic_crown_meteor_fall
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e14') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_cosmic_crown_meteor_fall', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e14'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_cosmic_crown_meteor_fall' WHERE effect_id = 'e14';
        UPDATE user_profiles SET active_entrance_effect = 'effect_cosmic_crown_meteor_fall' WHERE active_entrance_effect = 'e14';
        DELETE FROM entrance_effects WHERE id = 'e14';
    END IF;

    -- e15 -> effect_royal_diamond_explosion
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e15') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_royal_diamond_explosion', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e15'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_royal_diamond_explosion' WHERE effect_id = 'e15';
        UPDATE user_profiles SET active_entrance_effect = 'effect_royal_diamond_explosion' WHERE active_entrance_effect = 'e15';
        DELETE FROM entrance_effects WHERE id = 'e15';
    END IF;

    -- e16 -> effect_neon_chaos_warp
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e16') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_neon_chaos_warp', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e16'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_neon_chaos_warp' WHERE effect_id = 'e16';
        UPDATE user_profiles SET active_entrance_effect = 'effect_neon_chaos_warp' WHERE active_entrance_effect = 'e16';
        DELETE FROM entrance_effects WHERE id = 'e16';
    END IF;

    -- e17 -> effect_supreme_emerald_storm
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e17') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_supreme_emerald_storm', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e17'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_supreme_emerald_storm' WHERE effect_id = 'e17';
        UPDATE user_profiles SET active_entrance_effect = 'effect_supreme_emerald_storm' WHERE active_entrance_effect = 'e17';
        DELETE FROM entrance_effects WHERE id = 'e17';
    END IF;

    -- e18 -> effect_millionaire_troller_arrival
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e18') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_millionaire_troller_arrival', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e18'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_millionaire_troller_arrival' WHERE effect_id = 'e18';
        UPDATE user_profiles SET active_entrance_effect = 'effect_millionaire_troller_arrival' WHERE active_entrance_effect = 'e18';
        DELETE FROM entrance_effects WHERE id = 'e18';
    END IF;

    -- e19 -> effect_troll_god_ascension
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e19') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_troll_god_ascension', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e19'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_troll_god_ascension' WHERE effect_id = 'e19';
        UPDATE user_profiles SET active_entrance_effect = 'effect_troll_god_ascension' WHERE active_entrance_effect = 'e19';
        DELETE FROM entrance_effects WHERE id = 'e19';
    END IF;

    -- e20 -> effect_troll_city_world_domination
    IF EXISTS (SELECT 1 FROM entrance_effects WHERE id = 'e20') THEN
        INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active)
        SELECT 'effect_troll_city_world_domination', name, icon, coin_cost, rarity, description, animation_type, image_url, sound_effect, duration_seconds, is_active
        FROM entrance_effects WHERE id = 'e20'
        ON CONFLICT (id) DO NOTHING;

        UPDATE user_entrance_effects SET effect_id = 'effect_troll_city_world_domination' WHERE effect_id = 'e20';
        UPDATE user_profiles SET active_entrance_effect = 'effect_troll_city_world_domination' WHERE active_entrance_effect = 'e20';
        DELETE FROM entrance_effects WHERE id = 'e20';
    END IF;

END $$;
