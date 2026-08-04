-- Add source column to broadcast_replays to distinguish replay types
-- Values: 'broadcast' | 'podcast' | 'hytro_gaming'
ALTER TABLE public.broadcast_replays
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'broadcast';

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_broadcast_replays_source ON public.broadcast_replays(source);
