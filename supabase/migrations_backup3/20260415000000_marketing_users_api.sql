-- Marketing Read-Only User API Functions
-- Fix role constraint to allow marketing_readonly and grant to admin

-- Drop existing constraint if exists
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS chk_valid_role;

-- Add new constraint allowing marketing_readonly
ALTER TABLE user_profiles ADD CONSTRAINT chk_valid_role CHECK (
    role IN (
        'user', 'admin', 'lead_officer', 'officer', 'seller', 'judge', 
        'journalist', 'news_caster', 'chief_news_caster', 'moderator',
        'creator', 'troll_officer', 'lead_troll_officer', 'secretary',
        'marketing_readonly'
    )
);

-- Grant insert on auth.users to service_role for creating marketing accounts
GRANT INSERT ON auth.users TO service_role;
GRANT UPDATE ON auth.users TO service_role;