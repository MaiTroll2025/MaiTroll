-- Enable RLS on conversation_messages
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts if they exist but were named differently or I missed them
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.conversation_messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.conversation_messages;

-- Policy for SELECT
CREATE POLICY "Users can view messages in their conversations"
ON public.conversation_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_members.conversation_id = conversation_messages.conversation_id
    AND conversation_members.user_id = auth.uid()
  )
);

-- Policy for INSERT
CREATE POLICY "Users can send messages to their conversations"
ON public.conversation_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_members.conversation_id = conversation_messages.conversation_id
    AND conversation_members.user_id = auth.uid()
  )
  AND
  auth.uid() = sender_id
);
