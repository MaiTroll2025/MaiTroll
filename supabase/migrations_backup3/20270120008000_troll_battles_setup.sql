-- Troll Battles Schema & Functions

-- 1. Battle Queue: Users waiting for a match
CREATE TABLE IF NOT EXISTS public.battle_queue (
    user_id UUID REFERENCES public.user_profiles(id) PRIMARY KEY,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    min_level INTEGER DEFAULT 0
);

ALTER TABLE public.battle_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert" ON public.battle_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can delete own" ON public.battle_queue FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public read queue" ON public.battle_queue FOR SELECT USING (true);

-- 2. Troll Battles: The match record
CREATE TABLE IF NOT EXISTS public.troll_battles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player1_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    player2_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    player1_score INTEGER DEFAULT 0,
    player2_score INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'active', 'completed', 'cancelled')) DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    winner_id UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.troll_battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read battles" ON public.troll_battles FOR SELECT USING (true);
CREATE POLICY "System update battles" ON public.troll_battles FOR ALL USING (true);

-- 3. Battle Skips: Track daily skips
CREATE TABLE IF NOT EXISTS public.battle_skips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    skip_date DATE DEFAULT CURRENT_DATE,
    skips_used INTEGER DEFAULT 0,
    last_skip_time TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, skip_date)
);

ALTER TABLE public.battle_skips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own skips" ON public.battle_skips FOR SELECT USING (auth.uid() = user_id);

-- 4. Weekly Stats
CREATE TABLE IF NOT EXISTS public.troll_battle_weekly_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    week_start_date DATE NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    UNIQUE(user_id, week_start_date)
);

ALTER TABLE public.troll_battle_weekly_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read stats" ON public.troll_battle_weekly_stats FOR SELECT USING (true);

-- RPC: Find Opponent
-- Attempts to find a match in the queue. If found, creates a battle and returns it.
-- If not found, adds self to queue.
DROP FUNCTION IF EXISTS public.find_opponent(uuid, text, text, integer);

CREATE OR REPLACE FUNCTION public.find_opponent(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_opponent_id UUID;
    v_battle_id UUID;
    v_existing_battle JSONB;
BEGIN
    -- Check if already in a pending battle
    SELECT to_jsonb(t) INTO v_existing_battle
    FROM public.troll_battles t
    WHERE (player1_id = p_user_id OR player2_id = p_user_id)
      AND status = 'pending'
    LIMIT 1;

    IF v_existing_battle IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'matched', 'battle', v_existing_battle);
    END IF;

    -- Try to find someone else in the queue
    SELECT user_id INTO v_opponent_id
    FROM public.battle_queue
    WHERE user_id != p_user_id
    ORDER BY joined_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_opponent_id IS NOT NULL THEN
        -- Match found! Create battle
        INSERT INTO public.troll_battles (player1_id, player2_id, status)
        VALUES (p_user_id, v_opponent_id, 'pending')
        RETURNING id INTO v_battle_id;

        -- Remove both from queue
        DELETE FROM public.battle_queue WHERE user_id IN (p_user_id, v_opponent_id);

        RETURN jsonb_build_object('status', 'matched', 'battle_id', v_battle_id, 'opponent_id', v_opponent_id);
    ELSE
        -- No match, add to queue
        INSERT INTO public.battle_queue (user_id)
        VALUES (p_user_id)
        ON CONFLICT (user_id) DO NOTHING;
        
        RETURN jsonb_build_object('status', 'queued');
    END IF;
END;
$$;

-- RPC: Skip Opponent
CREATE OR REPLACE FUNCTION public.skip_opponent(p_user_id UUID, p_battle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle RECORD;
    v_skips RECORD;
    v_cost INTEGER := 5;
    v_free_limit INTEGER := 5;
    v_opponent_id UUID;
BEGIN
    -- Get battle
    SELECT * INTO v_battle FROM public.troll_battles WHERE id = p_battle_id;
    IF v_battle IS NULL OR v_battle.status != 'pending' THEN
        RETURN jsonb_build_object('error', 'Invalid battle');
    END IF;

    -- Determine opponent
    IF v_battle.player1_id = p_user_id THEN
        v_opponent_id := v_battle.player2_id;
    ELSIF v_battle.player2_id = p_user_id THEN
        v_opponent_id := v_battle.player1_id;
    ELSE
        RETURN jsonb_build_object('error', 'Not a participant');
    END IF;

    -- Check skips
    SELECT * INTO v_skips FROM public.battle_skips 
    WHERE user_id = p_user_id AND skip_date = CURRENT_DATE;

    IF v_skips IS NULL THEN
        INSERT INTO public.battle_skips (user_id, skips_used) VALUES (p_user_id, 0)
        RETURNING * INTO v_skips;
    END IF;

    IF v_skips.skips_used >= v_free_limit THEN
        -- Charge coins
        -- (Assuming check_balance and charge_coins exist, otherwise simplified update)
        -- For now, just increment skips
        NULL; 
        -- In real impl, check balance and deduct
    END IF;

    UPDATE public.battle_skips 
    SET skips_used = skips_used + 1, last_skip_time = NOW()
    WHERE id = v_skips.id;

    -- Cancel battle
    UPDATE public.troll_battles SET status = 'cancelled' WHERE id = p_battle_id;

    -- Return opponent to queue (optional, or just release them)
    INSERT INTO public.battle_queue (user_id) VALUES (v_opponent_id) ON CONFLICT DO NOTHING;

    -- Re-queue current user to find new opponent
    PERFORM public.find_opponent(p_user_id);

    RETURN jsonb_build_object('success', true, 'skips_used', v_skips.skips_used + 1);
END;
$$;

-- RPC: Start Battle
CREATE OR REPLACE FUNCTION public.start_battle(p_battle_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.troll_battles
    SET status = 'active', start_time = NOW(), end_time = NOW() + INTERVAL '3 minutes'
    WHERE id = p_battle_id AND status = 'pending';
END;
$$;
