-- XP System Migration

-- 1. Create user_stats table
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    xp_total BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    xp_to_next_level BIGINT DEFAULT 100,
    xp_progress FLOAT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create xp_ledger table
CREATE TABLE IF NOT EXISTS public.xp_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL, -- Unique per source
    xp_amount BIGINT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source, source_id)
);

-- 3. Enable RLS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- user_stats: Users can view their own stats. System updates them.
DO $$ BEGIN
    CREATE POLICY "Users can view own stats" ON public.user_stats
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- xp_ledger: Users can view their own ledger.
DO $$ BEGIN
    CREATE POLICY "Users can view own ledger" ON public.xp_ledger
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Helper function to compute level (aligned with baseline signature)
DROP FUNCTION IF EXISTS calculate_level(bigint);

CREATE OR REPLACE FUNCTION calculate_level(xp BIGINT)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF xp >= 400000 THEN RETURN 30;
  ELSIF xp >= 250000 THEN RETURN 25;
  ELSIF xp >= 150000 THEN RETURN 20;
  ELSIF xp >= 70000 THEN RETURN 15;
  ELSIF xp >= 30000 THEN RETURN 10;
  ELSIF xp >= 23000 THEN RETURN 9;
  ELSIF xp >= 17000 THEN RETURN 8;
  ELSIF xp >= 12000 THEN RETURN 7;
  ELSIF xp >= 8000 THEN RETURN 6;
  ELSIF xp >= 5000 THEN RETURN 5;
  ELSIF xp >= 3000 THEN RETURN 4;
  ELSIF xp >= 1500 THEN RETURN 3;
  ELSIF xp >= 500 THEN RETURN 2;
  ELSE RETURN 1;
  END IF;
END;
$$;

-- 6. grant_xp RPC
CREATE OR REPLACE FUNCTION grant_xp(
    p_user_id UUID,
    p_amount BIGINT,
    p_source TEXT,
    p_source_id TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    new_total BIGINT;
    new_level INT;
    new_next BIGINT;
    new_prog FLOAT;
    current_stats RECORD;
BEGIN
    -- Check deduplication
    IF EXISTS (SELECT 1 FROM public.xp_ledger WHERE source = p_source AND source_id = p_source_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Duplicate source_id');
    END IF;

    -- Insert into ledger
    INSERT INTO public.xp_ledger (user_id, source, source_id, xp_amount, metadata)
    VALUES (p_user_id, p_source, p_source_id, p_amount, p_metadata);

    -- Get current stats or init
    INSERT INTO public.user_stats (user_id, xp_total)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Update stats atomically
    UPDATE public.user_stats
    SET xp_total = xp_total + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING xp_total INTO new_total;

    -- Recalculate level
    SELECT lvl, xp_next, progress INTO new_level, new_next, new_prog
    FROM calculate_level(new_total);

    UPDATE public.user_stats
    SET level = new_level,
        xp_to_next_level = new_next,
        xp_progress = new_prog
    WHERE user_id = p_user_id;

    -- Return result
    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'xp_total', new_total,
        'level', new_level,
        'xp_added', p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
