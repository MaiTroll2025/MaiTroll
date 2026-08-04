-- Migrate conversation_messages data to tcps_messages and drop the old table
-- This migration recreates tcps_messages with correct structure and migrates data

-- Drop existing tcps_messages table if it exists (assuming it's empty or incorrect)
DROP TABLE IF EXISTS public.tcps_messages;

-- Recreate tcps_messages table with correct structure
CREATE TABLE public.tcps_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sender_profile JSONB,
  read_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_tcps_messages_sender_id ON public.tcps_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_tcps_messages_conversation_id ON public.tcps_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tcps_messages_created_at ON public.tcps_messages(created_at);

-- Enable RLS
ALTER TABLE public.tcps_messages ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can read tcps messages" ON public.tcps_messages
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own tcps messages" ON public.tcps_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Insert data from conversation_messages into tcps_messages
INSERT INTO public.tcps_messages (id, conversation_id, sender_id, content, created_at, sender_profile, read_at, is_deleted)
SELECT id, conversation_id, sender_id, content, created_at, sender_profile, read_at, COALESCE(is_deleted, FALSE)
FROM public.conversation_messages;

-- Drop the old conversation_messages table
DROP TABLE IF EXISTS public.conversation_messages;