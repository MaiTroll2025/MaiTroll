-- Add hls_url column to streams table
ALTER TABLE streams ADD COLUMN IF NOT EXISTS hls_url text;

-- Add comment explaining usage
COMMENT ON COLUMN streams.hls_url IS 'The full HLS playlist URL for the stream (e.g., /streams/UUID/master.m3u8). Required to bypass SPA rewrites.';
