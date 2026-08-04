-- Migration: Dual-Path Streaming & Legal System
-- Description: Implements atomic seat reservation, paid seats, kick grace period, and court lawsuits.

-- Ensure btree_gist extension exists for EXCLUDE constraints
-- CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Create stream_seat_sessions table (The "Ledger" for seats)
CREATE TABLE IF NOT EXISTS public.stream_seat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    seat_index INTEGER NOT NULL,
    price_paid INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT now(),
    left_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('active', 'left', 'kicked', 'disconnected')),
    kick_reason TEXT
);

-- Ensure only one active session per seat per stream
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_seat 
ON public.stream_seat_sessions (stream_id, seat_index) 
WHERE status = 'active';

-- Ensure columns exist in stream_seat_sessions if it was created before
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_seat_sessions' AND column_name = 'kick_reason') THEN
        ALTER TABLE public.stream_seat_sessions ADD COLUMN kick_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_seat_sessions' AND column_name = 'price_paid') THEN
        ALTER TABLE public.stream_seat_sessions ADD COLUMN price_paid INTEGER DEFAULT 0;
    END IF;
END $$;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_stream_status ON stream_seat_sessions(stream_id, status);
CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_user ON stream_seat_sessions(user_id);

-- 2. Create court_cases table
CREATE TABLE IF NOT EXISTS public.court_cases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plaintiff_id UUID NOT NULL REFERENCES public.user_profiles(id),
    defendant_id UUID NOT NULL REFERENCES public.user_profiles(id),
    session_id UUID REFERENCES public.stream_seat_sessions(id),
    claim_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    evidence_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    verdict_reason TEXT
);

-- Ensure columns exist if table already existed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'session_id') THEN
        ALTER TABLE public.court_cases ADD COLUMN session_id UUID REFERENCES public.stream_seat_sessions(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'claim_amount') THEN
        ALTER TABLE public.court_cases ADD COLUMN claim_amount INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'evidence_snapshot') THEN
        ALTER TABLE public.court_cases ADD COLUMN evidence_snapshot JSONB;
    END IF;
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'plaintiff_id') THEN
        ALTER TABLE public.court_cases ADD COLUMN plaintiff_id UUID REFERENCES public.user_profiles(id);
    END IF;
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'defendant_id') THEN
        ALTER TABLE public.court_cases ADD COLUMN defendant_id UUID REFERENCES public.user_profiles(id);
    END IF;

    -- Make docket_id nullable if it exists (for compatibility with lawsuit filing)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'docket_id') THEN
        ALTER TABLE public.court_cases ALTER COLUMN docket_id DROP NOT NULL;
    END IF;

    -- Ensure case_type has a default
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'case_type') THEN
        ALTER TABLE public.court_cases ALTER COLUMN case_type SET DEFAULT 'civil';
    END IF;

    -- Make reason nullable if it exists (since we use evidence_snapshot for details)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'reason') THEN
        ALTER TABLE public.court_cases ALTER COLUMN reason DROP NOT NULL;
    END IF;

    -- Make incident_date nullable or default now()
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'incident_date') THEN
        ALTER TABLE public.court_cases ALTER COLUMN incident_date SET DEFAULT now();
    END IF;

    -- Make stream_id nullable if it exists (we use session_id now)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'stream_id') THEN
        ALTER TABLE public.court_cases ALTER COLUMN stream_id DROP NOT NULL;
    END IF;

    -- Make accusation nullable if it exists (we use kick_reason/evidence_snapshot)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'accusation') THEN
        ALTER TABLE public.court_cases ALTER COLUMN accusation DROP NOT NULL;
    END IF;

    -- Make prosecutor_id nullable if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'prosecutor_id') THEN
        ALTER TABLE public.court_cases ALTER COLUMN prosecutor_id DROP NOT NULL;
    END IF;

    -- Make judge_id nullable if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'judge_id') THEN
        ALTER TABLE public.court_cases ALTER COLUMN judge_id DROP NOT NULL;
    END IF;
END $$;
