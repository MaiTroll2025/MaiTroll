-- Create missing tables that are referenced in code but not created

-- Create stream_settings table
CREATE TABLE IF NOT EXISTS public.stream_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  paid_chat_enabled BOOLEAN DEFAULT false,
  paid_chat_type TEXT DEFAULT 'per_user',
  paid_chat_price INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stream_id)
);

-- Create tcps_messages table (assuming structure based on usage)
CREATE TABLE IF NOT EXISTS public.tcps_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sender_profile JSONB -- For denormalized data
);


-- Add indexes
CREATE INDEX IF NOT EXISTS idx_stream_settings_stream_id ON public.stream_settings(stream_id);
CREATE INDEX IF NOT EXISTS idx_tcps_messages_sender_id ON public.tcps_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_tcps_messages_conversation_id ON public.tcps_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tcps_messages_created_at ON public.tcps_messages(created_at);

-- Enable RLS
ALTER TABLE public.stream_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcps_messages ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Broadcasters can manage own stream settings" ON public.stream_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.streams
      WHERE id = stream_id AND broadcaster_id = auth.uid()
    )
  );

CREATE POLICY "Users can read tcps messages" ON public.tcps_messages
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own tcps messages" ON public.tcps_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);