-- =============================================================================
-- SEED FAMILY GOALS
-- =============================================================================
-- Inserts initial weekly goals into the family_goals table (which the
-- get_family_home_data RPC actually reads) for every existing family.
-- The create_family_achievement_system.sql creates weekly_family_goals_new
-- but the RPC queries family_goals — so we seed family_goals directly.
-- =============================================================================

BEGIN;

-- Insert weekly goals for all existing families that don't already have active goals
INSERT INTO public.family_goals (
    family_id, title, description, category, difficulty,
    target_value, current_value, status,
    reward_coins, bonus_coins, reward_xp,
    goal_type, expires_at
)
SELECT
    f.id,
    goal.title,
    goal.description,
    goal.category,
    goal.difficulty,
    goal.target_value,
    0,
    'active',
    goal.reward_coins,
    goal.bonus_coins,
    goal.reward_xp,
    goal.goal_type,
    NOW() + INTERVAL '7 days'
FROM public.troll_families f
CROSS JOIN LATERAL (
    VALUES
        ('Chat Champions', 'Send 50 messages in family chat', 'weekly', 'easy', 50, 100, 50, 100, 'activity', 'messages'),
        ('Gift Givers', 'Send 5 gifts to family members', 'weekly', 'medium', 5, 200, 100, 150, 'support', 'gifts'),
        ('Battle Warriors', 'Win 3 family battles', 'weekly', 'hard', 3, 300, 150, 200, 'competition', 'battles'),
        ('Call Connectors', 'Join 2 family voice calls', 'weekly', 'easy', 2, 100, 50, 100, 'activity', 'calls'),
        ('Coin Collectors', 'Earn 500 coins for the family', 'weekly', 'medium', 500, 200, 100, 150, 'economy', 'coins')
) AS goal(title, description, category, difficulty, target_value, reward_coins, bonus_coins, reward_xp, goal_type, goal_key)
WHERE NOT EXISTS (
    SELECT 1 FROM public.family_goals fg
    WHERE fg.family_id = f.id AND fg.status = 'active'
);

-- Also insert into weekly_family_goals_new for the achievement system
INSERT INTO public.weekly_family_goals_new (
    family_id, goal_key, title, description, category, difficulty,
    progress, target, xp_reward, coin_reward,
    week_number, year, expires_at
)
SELECT
    f.id,
    goal.goal_key,
    goal.title,
    goal.description,
    goal.category,
    goal.difficulty,
    0,
    goal.target_value,
    goal.xp_reward,
    goal.coin_reward,
    EXTRACT(WEEK FROM NOW())::INTEGER,
    EXTRACT(YEAR FROM NOW())::INTEGER,
    NOW() + INTERVAL '7 days'
FROM public.troll_families f
CROSS JOIN LATERAL (
    VALUES
        ('messages', 'Chat Champions', 'Send 50 messages in family chat', 'messages', 'easy', 50, 100, 50),
        ('gifts', 'Gift Givers', 'Send 5 gifts to family members', 'gifts', 'medium', 5, 200, 100),
        ('battles', 'Battle Warriors', 'Win 3 family battles', 'battles', 'hard', 3, 300, 150),
        ('calls', 'Call Connectors', 'Join 2 family voice calls', 'calls', 'easy', 2, 100, 50),
        ('coins', 'Coin Collectors', 'Earn 500 coins for the family', 'coins', 'medium', 500, 200, 100)
) AS goal(goal_key, title, description, category, difficulty, target_value, xp_reward, coin_reward)
WHERE NOT EXISTS (
    SELECT 1 FROM public.weekly_family_goals_new wfg
    WHERE wfg.family_id = f.id
    AND wfg.week_number = EXTRACT(WEEK FROM NOW())::INTEGER
    AND wfg.year = EXTRACT(YEAR FROM NOW())::INTEGER
);

-- Seed family_stats_enhanced for families that don't have a row yet
INSERT INTO public.family_stats_enhanced (family_id, level, xp, current_tier)
SELECT f.id, 1, 0, 1
FROM public.troll_families f
WHERE NOT EXISTS (
    SELECT 1 FROM public.family_stats_enhanced fse WHERE fse.family_id = f.id
);

-- Seed initial family achievements for each family based on achievement_definitions
INSERT INTO public.family_achievements_new (family_id, achievement_key, progress, target, completed)
SELECT
    f.id,
    ad.achievement_key,
    0,
    ad.base_requirement,
    false
FROM public.troll_families f
CROSS JOIN public.achievement_definitions ad
WHERE ad.is_active = true
ON CONFLICT (family_id, achievement_key) DO NOTHING;

COMMIT;
