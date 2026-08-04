-- Fix for Mai Troll Wall post deletion and reply function
-- Run this in your Supabase SQL Editor

-- ============================================================================
-- 1. Create the missing reply function if it doesn't exist
-- ============================================================================
CREATE OR REPLACE FUNCTION create_wall_post_reply(
  p_original_post_id UUID,
  p_user_id UUID,
  p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_reply_id UUID;
BEGIN
  INSERT INTO troll_wall_posts (user_id, post_type, content, reply_to_post_id)
  VALUES (p_user_id, 'text', p_content, p_original_post_id)
  RETURNING id INTO v_reply_id;
  RETURN v_reply_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_wall_post_reply(UUID, UUID, TEXT) TO authenticated;

-- ============================================================================
-- 2. Add RLS policies for troll_wall_posts DELETE operations
-- ============================================================================

-- Enable RLS on troll_wall_posts if not already enabled
ALTER TABLE troll_wall_posts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all wall posts
CREATE POLICY "Anyone can view wall posts" ON troll_wall_posts FOR SELECT USING (true);

-- Policy: Users can insert their own wall posts
CREATE POLICY "Users can create wall posts" ON troll_wall_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own wall posts
CREATE POLICY "Users can delete their own wall posts" ON troll_wall_posts FOR DELETE USING (auth.uid() = user_id);

-- Policy: Admins can delete any wall post
CREATE POLICY "Admins can delete any wall post" ON troll_wall_posts FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  )
);

-- Policy: Troll officers can delete any wall post
CREATE POLICY "Officers can delete any wall post" ON troll_wall_posts FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND is_troll_officer = true
  )
);

-- Policy: Lead officers can delete any wall post
CREATE POLICY "Lead officers can delete any wall post" ON troll_wall_posts FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND is_lead_officer = true
  )
);

-- ============================================================================
-- 3. Verify the function was created
-- ============================================================================
SELECT proname, argnames, proargtypes
FROM pg_proc
WHERE proname = 'create_wall_post_reply';

-- ============================================================================
-- 4. Test the function exists (should return 1 row)
-- ============================================================================
SELECT COUNT(*) as function_exists
FROM pg_proc
WHERE proname = 'create_wall_post_reply';
