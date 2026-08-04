-- Add is_muted to participants
ALTER TABLE public.pod_room_participants 
ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;

-- Create Pod Chat Messages
CREATE TABLE IF NOT EXISTS public.pod_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.pod_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for Chat
ALTER TABLE public.pod_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read pod messages" ON public.pod_chat_messages;
CREATE POLICY "Anyone can read pod messages" ON public.pod_chat_messages
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Participants can send messages" ON public.pod_chat_messages;
CREATE POLICY "Participants can send messages" ON public.pod_chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = user_id 
        AND 
        EXISTS (
            SELECT 1 FROM public.pod_room_participants 
            WHERE room_id = pod_chat_messages.room_id 
            AND user_id = auth.uid()
        )
    );

-- Add moderation columns if needed (e.g. kicked users list)
-- For now, we delete the participant row when kicked. 
-- But to prevent re-join, we might need a ban list.
CREATE TABLE IF NOT EXISTS public.pod_bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.pod_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    banned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(room_id, user_id)
);

ALTER TABLE public.pod_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view bans" ON public.pod_bans
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pod_rooms 
            WHERE id = pod_bans.room_id 
            AND host_id = auth.uid()
        )
    );

CREATE POLICY "Hosts can ban users" ON public.pod_bans
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.pod_rooms 
            WHERE id = pod_bans.room_id 
            AND host_id = auth.uid()
        )
    );

CREATE POLICY "Hosts can unban users" ON public.pod_bans
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.pod_rooms 
            WHERE id = pod_bans.room_id 
            AND host_id = auth.uid()
        )
    );
