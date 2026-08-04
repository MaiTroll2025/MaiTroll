-- Migration: Fix Perk RLS, Themes, and Stream Stats
-- Timestamp: 20270305000008

-- 1. FIX USER PERKS RLS (Allow everyone to see active perks)
-- This fixes the "buttons not turning on" and "effects not visible" issues
ALTER TABLE public.user_perks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own perks" ON public.user_perks;
DROP POLICY IF EXISTS "Public view active perks" ON public.user_perks;

-- Allow everyone to view all perks (active or inactive doesn't matter for security, 
-- but frontend filters for active. Privacy is not a huge concern for perks.)
CREATE POLICY "Public view user perks" ON public.user_perks
FOR SELECT USING (true);

-- Ensure Insert/Update is still protected (User can only manage their own)
-- Using auth.uid() for session-based check
DROP POLICY IF EXISTS "Users can insert their own perks" ON public.user_perks;
CREATE POLICY "Users can insert their own perks" ON public.user_perks
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own perks" ON public.user_perks;
CREATE POLICY "Users can update their own perks" ON public.user_perks
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);


-- 2. FIX THEME LOADING (User Inventory & Marketplace)
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own inventory
DROP POLICY IF EXISTS "Users can view own inventory" ON public.user_inventory;
CREATE POLICY "Users can view own inventory" ON public.user_inventory
FOR SELECT USING ((select auth.uid()) = user_id);

-- Allow everyone to see marketplace items (needed for joining with inventory)
DROP POLICY IF EXISTS "Public view marketplace items" ON public.marketplace_items;
CREATE POLICY "Public view marketplace items" ON public.marketplace_items
FOR SELECT USING (true);


-- 3. UPDATE STREAMS TABLE (Missing Columns for BroadcastControls)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'total_likes') THEN
        ALTER TABLE public.streams ADD COLUMN total_likes INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'has_rgb_effect') THEN
        ALTER TABLE public.streams ADD COLUMN has_rgb_effect BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'rgb_purchased') THEN
        ALTER TABLE public.streams ADD COLUMN rgb_purchased BOOLEAN DEFAULT false;
    END IF;
END $$;


-- 4. RPC: Increment Stream Likes
DROP FUNCTION IF EXISTS increment_stream_likes(UUID);

CREATE OR REPLACE FUNCTION increment_stream_likes(stream_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.streams
  SET total_likes = COALESCE(total_likes, 0) + 1
  WHERE id = stream_id;
END;
$$;


-- 5. RPC: Purchase/Toggle RGB Broadcast
DROP FUNCTION IF EXISTS purchase_rgb_broadcast(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION purchase_rgb_broadcast(p_stream_id UUID, p_enable BOOLEAN)
RETURNS TABLE (success BOOLEAN, message TEXT, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream record;
  v_user_id uuid;
  v_balance int;
  v_cost int := 10;
BEGIN
  -- Get stream info
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  
  IF v_stream IS NULL THEN
    RETURN QUERY SELECT false, NULL, 'Stream not found';
    RETURN;
  END IF;

  v_user_id := auth.uid();
  
  -- Check ownership (or admin)
  IF v_stream.user_id != v_user_id AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_user_id AND (role = 'admin' OR is_admin = true)) THEN
    RETURN QUERY SELECT false, NULL, 'Not authorized';
    RETURN;
  END IF;

  -- If enabling
  IF p_enable THEN
    -- Check if already purchased
    IF v_stream.rgb_purchased THEN
      -- Just enable
      UPDATE public.streams SET has_rgb_effect = true WHERE id = p_stream_id;
      RETURN QUERY SELECT true, 'Enabled', NULL;
    ELSE
      -- Need to purchase
      -- Check balance
      SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
      
      IF v_balance < v_cost THEN
        RETURN QUERY SELECT false, NULL, 'Insufficient coins (Cost: 10)';
        RETURN;
      END IF;
      
      -- Deduct coins
      UPDATE public.user_profiles 
      SET troll_coins = troll_coins - v_cost 
      WHERE id = v_user_id;
      
      -- Update stream
      UPDATE public.streams 
      SET has_rgb_effect = true, rgb_purchased = true 
      WHERE id = p_stream_id;
      
      RETURN QUERY SELECT true, 'Purchased and Enabled', NULL;
    END IF;
  ELSE
    -- Disabling
    UPDATE public.streams SET has_rgb_effect = false WHERE id = p_stream_id;
    RETURN QUERY SELECT true, 'Disabled', NULL;
  END IF;
END;
$$;
