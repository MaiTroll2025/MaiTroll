-- Add is_hand_raised to pod_room_participants
ALTER TABLE public.pod_room_participants 
ADD COLUMN IF NOT EXISTS is_hand_raised BOOLEAN DEFAULT false;

-- Add index for faster filtering of requests
CREATE INDEX IF NOT EXISTS idx_pod_participants_hand_raised 
ON public.pod_room_participants(room_id) 
WHERE is_hand_raised = true;
