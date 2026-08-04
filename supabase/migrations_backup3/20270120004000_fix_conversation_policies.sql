-- Fix conversation policies
-- Add missing INSERT policy for conversation_members

DO $$
BEGIN
    -- Check if policy exists to avoid error
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'conversation_members' 
        AND policyname = 'Users can add members to their own conversations'
    ) THEN
        CREATE POLICY "Users can add members to their own conversations" ON "public"."conversation_members"
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM "public"."conversations" c
                WHERE c.id = conversation_members.conversation_id
                AND c.created_by = auth.uid()
            )
        );
    END IF;
END $$;
