-- Find your role: Run this in SQL Editor while logged into the app in another tab
-- Then check the browser console for your user ID, or query by your email

-- Option A: If you know your email
SELECT id, username, email, role, is_admin, is_superadmin, is_ceo
FROM user_profiles
WHERE email = 'Mai Troll2025@gmail.com';

-- Option B: See all admin-level profiles
SELECT id, username, email, role, is_admin, is_superadmin, is_ceo
FROM user_profiles
WHERE is_admin = true 
   OR is_superadmin = true 
   OR is_ceo = true
   OR role NOT IN ('user', 'member', 'follower', 'viewer', 'bidder')
ORDER BY created_at DESC
LIMIT 20;
