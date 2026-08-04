
-- Fix Court Permissions
ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;

-- 1. Allow Users to File Cases (Insert)
DROP POLICY IF EXISTS "Users can file cases" ON public.court_cases;
CREATE POLICY "Users can file cases" ON public.court_cases
    FOR INSERT WITH CHECK (auth.uid() = plaintiff_id);

-- 2. Allow Plaintiff, Defendant, Judge to View Cases
DROP POLICY IF EXISTS "Participants can view cases" ON public.court_cases;
CREATE POLICY "Participants can view cases" ON public.court_cases
    FOR SELECT USING (
        auth.uid() = plaintiff_id 
        OR auth.uid() = defendant_id 
        OR auth.uid() = judge_id 
        -- OR auth.uid() = assigned_judge_id -- Check if this column exists in court_cases
        OR status = 'live' -- Everyone can see live cases
    );

-- 3. Allow Plaintiff/Judge to Update Cases
DROP POLICY IF EXISTS "Participants can update cases" ON public.court_cases;
CREATE POLICY "Participants can update cases" ON public.court_cases
    FOR UPDATE USING (
        auth.uid() = plaintiff_id 
        OR auth.uid() = judge_id 
        -- OR auth.uid() = assigned_judge_id
        OR EXISTS ( -- Allow Admins/Officers
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND (role IN ('admin', 'troll_officer', 'lead_troll_officer') OR is_admin = true)
        )
    );

-- Fix Pod Permissions (Force Re-Apply)
ALTER TABLE public.pod_room_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can leave or Host can kick" ON public.pod_room_participants;
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
