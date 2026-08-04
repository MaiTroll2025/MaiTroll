-- Reset all existing users' credit scores to 400
UPDATE public.user_credit
SET score = 400,
    tier = 'Building',
    trend_7d = 0,
    updated_at = NOW()
WHERE true;

-- Backfill any users who might be missing a credit score record
-- Only insert for users that exist in auth.users to avoid foreign key violations
INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
SELECT p.id, 400, 'Building', 0, NOW()
FROM public.user_profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.id NOT IN (SELECT user_id FROM public.user_credit);
