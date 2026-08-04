-- Add payment tracking columns to broadcast_officers table
ALTER TABLE public.broadcast_officers
  ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_paid INTEGER DEFAULT 0;
