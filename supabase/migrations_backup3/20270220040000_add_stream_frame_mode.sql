-- Add frame_mode column to streams table for real-time sync
ALTER TABLE public.streams
ADD COLUMN IF NOT EXISTS frame_mode TEXT DEFAULT 'none';

-- Comment: This column controls the RGB frame effect visible to all viewers
