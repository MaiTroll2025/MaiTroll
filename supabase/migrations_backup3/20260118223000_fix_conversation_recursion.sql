-- Fix infinite recursion in conversation RLS policies

-- 1. Create a helper function to get user's conversations securely (bypassing RLS)
-- This breaks the recursion loop by using SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_auth_user_conversation_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT conversation_id 
    FROM conversation_members 
    WHERE user_id = auth.uid();
$$;

-- 2. Drop existing policies to clear the recursion
-- We use a DO block to drop all policies on these tables to be sure we catch the recursive ones
DO $$
DECLARE
  pol record;
BEGIN
  -- Drop policies on conversation_members
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'conversation_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON conversation_members', pol.policyname);
  END LOOP;
  
  -- Drop policies on conversations
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'conversations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON conversations', pol.policyname);
  END LOOP;
END $$;

-- 3. Re-enable RLS (just in case)
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- 4. Create new, non-recursive policies for conversation_members

-- SELECT: Use the secure function
CREATE POLICY "view_conversation_members"
ON conversation_members
FOR SELECT
USING (
    user_id = auth.uid()
    OR
    conversation_id IN (SELECT public.get_auth_user_conversation_ids())
);

-- INSERT: Allow adding self or if you are the creator
-- Note: Checking created_by on conversations is safe IF conversations policy doesn't recurse back.
CREATE POLICY "insert_conversation_members"
ON conversation_members
FOR INSERT
WITH CHECK (
    user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE id = conversation_members.conversation_id 
        AND created_by = auth.uid()
    )
);

-- DELETE: Allow if self or creator
CREATE POLICY "delete_conversation_members"
ON conversation_members
FOR DELETE
USING (
    user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE id = conversation_members.conversation_id 
        AND created_by = auth.uid()
    )
);

-- 5. Create new policies for conversations

-- SELECT: Use the secure function
CREATE POLICY "view_conversations"
ON conversations
FOR SELECT
USING (
    created_by = auth.uid()
    OR
    id IN (SELECT public.get_auth_user_conversation_ids())
);

-- INSERT: Allow creating conversations
CREATE POLICY "insert_conversations"
ON conversations
FOR INSERT
WITH CHECK (
    created_by = auth.uid()
);

-- UPDATE: Allow updating if creator
CREATE POLICY "update_conversations"
ON conversations
FOR UPDATE
USING (
    created_by = auth.uid()
);

-- DELETE: Allow deleting if creator
CREATE POLICY "delete_conversations"
ON conversations
FOR DELETE
USING (
    created_by = auth.uid()
);
