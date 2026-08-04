
-- Update pod_room_participants to allow 'officer' role
ALTER TABLE public.pod_room_participants 
DROP CONSTRAINT IF EXISTS pod_room_participants_role_check;

ALTER TABLE public.pod_room_participants
ADD CONSTRAINT pod_room_participants_role_check 
CHECK (role IN ('host', 'speaker', 'listener', 'officer'));

-- Create pod_bans table if it doesn't exist (it seemed to be used in code but might not exist properly)
CREATE TABLE IF NOT EXISTS public.pod_bans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.pod_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    banned_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ, -- For 24h bans
    reason TEXT,
    UNIQUE(room_id, user_id)
);

-- Create pod_chat_bans table for disabling chat
CREATE TABLE IF NOT EXISTS public.pod_chat_bans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.pod_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    banned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(room_id, user_id)
);

-- Enable RLS
ALTER TABLE public.pod_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_chat_bans ENABLE ROW LEVEL SECURITY;

-- Policies for pod_bans
CREATE POLICY "Hosts and Officers can insert bans" ON public.pod_bans
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.pod_room_participants
            WHERE room_id = pod_bans.room_id 
            AND user_id = auth.uid() 
            AND role IN ('host', 'officer')
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.pod_rooms
            WHERE id = pod_bans.room_id
            AND host_id = auth.uid()
        )
    );

CREATE POLICY "Everyone can view bans" ON public.pod_bans
    FOR SELECT USING (true);

CREATE POLICY "Hosts and Officers can delete bans" ON public.pod_bans
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.pod_room_participants
            WHERE room_id = pod_bans.room_id 
            AND user_id = auth.uid() 
            AND role IN ('host', 'officer')
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.pod_rooms
            WHERE id = pod_bans.room_id
            AND host_id = auth.uid()
        )
    );

-- Policies for pod_chat_bans
CREATE POLICY "Hosts and Officers can insert chat bans" ON public.pod_chat_bans
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.pod_room_participants
            WHERE room_id = pod_chat_bans.room_id 
            AND user_id = auth.uid() 
            AND role IN ('host', 'officer')
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.pod_rooms
            WHERE id = pod_chat_bans.room_id
            AND host_id = auth.uid()
        )
    );

CREATE POLICY "Everyone can view chat bans" ON public.pod_chat_bans
    FOR SELECT USING (true);

CREATE POLICY "Hosts and Officers can delete chat bans" ON public.pod_chat_bans
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.pod_room_participants
            WHERE room_id = pod_chat_bans.room_id 
            AND user_id = auth.uid() 
            AND role IN ('host', 'officer')
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.pod_rooms
            WHERE id = pod_chat_bans.room_id
            AND host_id = auth.uid()
        )
    );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pod_bans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pod_chat_bans;
