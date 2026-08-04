-- Ensure Chat Tables Exist (Missing Migration Fix)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    body TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ
);

-- Migration: Add is_deleted column to conversation_messages
-- Description: Adds soft delete support for messages

ALTER TABLE public.conversation_messages 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Optional: If we want per-user deletion later, we would need:
-- ADD COLUMN IF NOT EXISTS deleted_by_users UUID[] DEFAULT '{}';

-- For now, consistent with "soft delete" requirement (e.g., deleted_at or is_deleted):
ALTER TABLE public.conversation_messages 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
