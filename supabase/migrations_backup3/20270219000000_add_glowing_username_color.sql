-- Add glowing_username_color to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS glowing_username_color TEXT DEFAULT NULL;

-- Log the migration
INSERT INTO coin_transactions (user_id, amount, type, description)
SELECT id, 0, 'admin_adjustment', 'Added glowing_username_color column'
FROM user_profiles 
WHERE role = 'admin' OR is_admin = true
LIMIT 1
ON CONFLICT DO NOTHING;
