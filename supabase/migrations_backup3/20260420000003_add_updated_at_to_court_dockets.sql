-- Add updated_at column to court_dockets table

ALTER TABLE public.court_dockets
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();