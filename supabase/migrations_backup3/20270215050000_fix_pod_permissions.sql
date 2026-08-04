-- Fix Pod Permissions and ensure columns exist

-- 1. Ensure columns exist (safe to run if already exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pod_room_participants' AND column_name = 'is_muted') THEN
        ALTER TABLE public.pod_room_participants ADD COLUMN is_muted BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pod_room_participants' AND column_name = 'is_hand_raised') THEN
        ALTER TABLE public.pod_room_participants ADD COLUMN is_hand_raised BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Reset Policies for pod_room_participants
ALTER TABLE public.pod_room_participants ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to be safe
DROP POLICY IF EXISTS "Anyone can view participants" ON public.pod_room_participants;
DROP POLICY IF EXISTS "Users can join/leave" ON public.pod_room_participants;
DROP POLICY IF EXISTS "Users can remove themselves" ON public.pod_room_participants;
DROP POLICY IF EXISTS "Hosts can manage participants" ON public.pod_room_participants;
DROP POLICY IF EXISTS "Users can update own hand raise" ON public.pod_room_participants;

-- Re-create Policies

-- SELECT: Everyone can see who is in a room
CREATE POLICY "Anyone can view participants" ON public.pod_room_participants
    FOR SELECT USING (true);

-- INSERT: Users can join a room (create their own row)
CREATE POLICY "Users can join" ON public.pod_room_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can leave, Hosts can kick
CREATE POLICY "Users can leave or Host can kick" ON public.pod_room_participants
    FOR DELETE USING (
        auth.uid() = user_id -- User leaves
        OR 
        EXISTS ( -- Host kicks
            SELECT 1 FROM public.pod_rooms 
            WHERE id = pod_room_participants.room_id 
            AND host_id = auth.uid()
        )
    );

-- UPDATE: 
-- 1. Users can update their own `is_hand_raised`
-- 2. Hosts can update everything (role, mute, hand_raised)
CREATE POLICY "Users update self or Host updates all" ON public.pod_room_participants
    FOR UPDATE USING (
        auth.uid() = user_id -- User updating self (column checks handled by app logic or trigger if needed, but for now trusting app + RLS basic)
        OR
        EXISTS ( -- Host updating others
            SELECT 1 FROM public.pod_rooms 
            WHERE id = pod_room_participants.room_id 
            AND host_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.pod_rooms 
            WHERE id = pod_room_participants.room_id 
            AND host_id = auth.uid()
        )
    );
