-- Add rtmp_url column to streams table for LiveKit gaming streams
ALTER TABLE streams ADD COLUMN IF NOT EXISTS rtmp_url TEXT;
