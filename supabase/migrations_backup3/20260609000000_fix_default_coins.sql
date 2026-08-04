-- Set default troll_coins to 100 for new users
ALTER TABLE public.user_profiles 
ALTER COLUMN troll_coins SET DEFAULT 100;

-- Optional: Update existing users with 0 coins to have 100? 
-- The requirement says "Every NEW user gets 100 Troll Coins on signup". 
-- It doesn't explicitly say to update existing users, but it's often good practice if we are correcting a "wrong" default.
-- However, I will strictly follow "Every NEW user" and just change the default for future inserts.

-- Ensure the column comment reflects this
COMMENT ON COLUMN public.user_profiles.troll_coins IS 'User coin balance. Default 100 for new users.';
