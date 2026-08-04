-- Add mic_muted column to stream_participants for muting guest microphones

ALTER TABLE public.stream_participants 
ADD COLUMN IF NOT EXISTS mic_muted boolean DEFAULT false;

-- Also add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stream_participants_mic_muted 
ON public.stream_participants(stream_id, mic_muted) 
WHERE mic_muted = true;