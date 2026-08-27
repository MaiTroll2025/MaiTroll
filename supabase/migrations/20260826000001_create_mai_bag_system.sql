-- ============================================
-- MAI BAG SYSTEM
-- ============================================

-- mai_bags: one active bag per broadcast
CREATE TABLE IF NOT EXISTS public.mai_bags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  broadcaster_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  bag_level integer NOT NULL DEFAULT 1,
  multiplier bigint NOT NULL DEFAULT 1,
  current_value bigint NOT NULL DEFAULT 0,
  capacity bigint NOT NULL DEFAULT 10000,
  status text NOT NULL DEFAULT 'active',
  completed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(broadcast_id)
);

CREATE INDEX IF NOT EXISTS idx_mai_bags_broadcast_id ON public.mai_bags(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_mai_bags_broadcaster_id ON public.mai_bags(broadcaster_id);

-- mai_bag_events: idempotency + audit trail for bag completions
CREATE TABLE IF NOT EXISTS public.mai_bag_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mai_bag_id uuid NOT NULL REFERENCES public.mai_bags(id) ON DELETE CASCADE,
  broadcast_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  stream_gift_id bigint,
  triggered_by uuid REFERENCES public.user_profiles(id),
  value_added bigint NOT NULL DEFAULT 0,
  reward_coins bigint NOT NULL DEFAULT 0,
  broadcaster_bonus_coins bigint NOT NULL DEFAULT 0,
  old_multiplier bigint NOT NULL,
  new_multiplier bigint NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mai_bag_events_broadcast_id ON public.mai_bag_events(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_mai_bag_events_mai_bag_id ON public.mai_bag_events(mai_bag_id);

-- capacity curve: each level multiplies base capacity
CREATE TABLE IF NOT EXISTS public.mai_bag_tiers (
  level integer PRIMARY KEY,
  name text NOT NULL,
  visual_type text NOT NULL,
  multiplier bigint NOT NULL,
  capacity_multiplier numeric NOT NULL DEFAULT 1,
  glow_class text,
  particle_intensity integer NOT NULL DEFAULT 1
);

INSERT INTO public.mai_bag_tiers (level, name, visual_type, multiplier, capacity_multiplier, glow_class, particle_intensity)
VALUES
  (1,  'Clear',      'clear',      1,      1,    'ring-cyan-200/40 shadow-[0_0_18px_rgba(34,211,238,0.25)]', 1),
  (2,  'Red',        'red',        2,      1.5,  'ring-red-400/50 shadow-[0_0_22px_rgba(248,113,113,0.35)]', 2),
  (3,  'Orange',     'orange',     4,      2,    'ring-orange-400/50 shadow-[0_0_24px_rgba(251,146,60,0.35)]', 2),
  (4,  'Yellow',     'yellow',     8,      2.5,  'ring-yellow-400/50 shadow-[0_0_26px_rgba(250,204,21,0.35)]', 3),
  (5,  'Green',      'green',      16,     3,    'ring-emerald-400/50 shadow-[0_0_28px_rgba(52,211,153,0.35)]', 3),
  (6,  'Blue',       'blue',       32,     4,    'ring-sky-400/50 shadow-[0_0_30px_rgba(56,189,248,0.40)]', 4),
  (7,  'Purple',     'purple',     64,     5,    'ring-purple-400/60 shadow-[0_0_34px_rgba(192,132,252,0.45)]', 5),
  (8,  'Rainbow',    'rainbow',    128,    6,    'ring-fuchsia-400/60 shadow-[0_0_38px_rgba(244,114,182,0.50)]', 6),
  (9,  'Silver',     'silver',     256,    8,    'ring-slate-300/60 shadow-[0_0_42px_rgba(203,213,225,0.50)]', 7),
  (10, 'Gold',       'gold',       512,    10,   'ring-amber-300/70 shadow-[0_0_46px_rgba(251,191,36,0.55)]', 8),
  (11, 'Maroon',     'maroon',     1024,   12,   'ring-rose-900/70 shadow-[0_0_50px_rgba(225,29,72,0.60)]', 9),
  (12, 'Diamond',    'diamond',    2048,   15,   'ring-cyan-200/70 shadow-[0_0_56px_rgba(34,211,238,0.65)]', 10)
ON CONFLICT (level) DO NOTHING;

-- ============================================
-- RPC: initialize or get active mai bag for a broadcast
-- ============================================
CREATE OR REPLACE FUNCTION public.get_or_create_mai_bag(p_broadcast_id uuid, p_broadcaster_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bag public.mai_bags%ROWTYPE;
BEGIN
  SELECT * INTO v_bag
  FROM public.mai_bags
  WHERE broadcast_id = p_broadcast_id
    AND status = 'active'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'bag', row_to_json(v_bag)
    );
  END IF;

  INSERT INTO public.mai_bags (broadcast_id, broadcaster_id, bag_level, multiplier, current_value, capacity, status)
  VALUES (p_broadcast_id, p_broadcaster_id, 1, 1, 0, 10000, 'active')
  RETURNING * INTO v_bag;

  RETURN jsonb_build_object(
    'success', true,
    'bag', row_to_json(v_bag)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_mai_bag(uuid, uuid) TO authenticated, anon, service_role;

-- ============================================
-- RPC: contribute gift value to the active mai bag
-- Handles overflow into next bag atomically
-- Returns updated bag state and any completion events
-- ============================================
CREATE OR REPLACE FUNCTION public.contribute_to_mai_bag(
  p_broadcast_id uuid,
  p_stream_gift_id bigint,
  p_gift_value bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bag public.mai_bags%ROWTYPE;
  v_event_id uuid;
  v_total_contributed bigint := p_gift_value;
  v_reward_coins bigint := 0;
  v_broadcaster_bonus bigint := 0;
  v_old_multiplier bigint;
  v_new_multiplier bigint;
  v_next_capacity bigint;
  v_tier public.mai_bag_tiers%ROWTYPE;
  v_base_reward bigint := 10000;
  v_completions integer := 0;
  v_events jsonb := '[]'::jsonb;
  v_one_pct bigint;
BEGIN
  -- Get active bag
  SELECT * INTO v_bag
  FROM public.mai_bags
  WHERE broadcast_id = p_broadcast_id
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active Mai Bag found');
  END IF;

  v_old_multiplier := v_bag.multiplier;

  -- Process completions in a loop (handles overflow)
  WHILE v_total_contributed > 0 LOOP
    -- If bag is already complete from a previous race, start next bag
    IF v_bag.current_value >= v_bag.capacity THEN
      UPDATE public.mai_bags
      SET status = 'completed',
          completed_at = now(),
          completed_count = completed_count + 1
      WHERE id = v_bag.id;

      -- Create next bag
      SELECT * INTO v_tier FROM public.mai_bag_tiers WHERE level = v_bag.bag_level + 1;
      IF NOT FOUND THEN
        -- Legendary fallback: keep last known tier but increase capacity
        SELECT * INTO v_tier FROM public.mai_bag_tiers ORDER BY level DESC LIMIT 1;
      END IF;

      INSERT INTO public.mai_bags (
        broadcast_id, broadcaster_id, bag_level, multiplier, current_value, capacity, status
      ) VALUES (
        v_bag.broadcast_id,
        v_bag.broadcaster_id,
        COALESCE(v_tier.level, v_bag.bag_level + 1),
        COALESCE(v_tier.multiplier, v_bag.multiplier * 2),
        COALESCE(v_bag.current_value - v_bag.capacity, 0),
        COALESCE(v_bag.capacity * COALESCE(v_tier.capacity_multiplier, 1.5), v_bag.capacity * 2),
        'active'
      )
      RETURNING * INTO v_bag;

      CONTINUE;
    END IF;

    -- Calculate room left in current bag
    v_next_capacity := v_bag.capacity - v_bag.current_value;

    IF v_total_contributed >= v_next_capacity THEN
      -- This contribution fills the bag (and possibly overflows)
      UPDATE public.mai_bags
      SET current_value = capacity,
          updated_at = now()
      WHERE id = v_bag.id;

      -- Record completion event
      v_reward_coins := v_base_reward * v_bag.multiplier;
      v_one_pct := GREATEST(1, floor(v_reward_coins * 0.01));
      v_broadcaster_bonus := v_one_pct;

      INSERT INTO public.mai_bag_events (
        mai_bag_id, broadcast_id, event_type, stream_gift_id,
        value_added, reward_coins, broadcaster_bonus_coins,
        old_multiplier, new_multiplier, metadata
      ) VALUES (
        v_bag.id,
        v_bag.broadcast_id,
        'completed',
        p_stream_gift_id,
        v_next_capacity,
        v_reward_coins,
        v_broadcaster_bonus,
        v_old_multiplier,
        v_bag.multiplier * 2,
        jsonb_build_object('completed_at', now())
      )
      RETURNING id INTO v_event_id;

      v_events := v_events || jsonb_build_object(
        'event_id', v_event_id,
        'bag_id', v_bag.id,
        'old_multiplier', v_old_multiplier,
        'new_multiplier', v_bag.multiplier * 2,
        'reward_coins', v_reward_coins,
        'broadcaster_bonus', v_broadcaster_bonus
      );

      -- Reduce remaining contribution
      v_total_contributed := v_total_contributed - v_next_capacity;
      v_completions := v_completions + 1;
      v_old_multiplier := v_bag.multiplier * 2;

    ELSE
      -- Contribution fits within current bag
      UPDATE public.mai_bags
      SET current_value = current_value + v_total_contributed,
          updated_at = now()
      WHERE id = v_bag.id;

      v_total_contributed := 0;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'bag_id', v_bag.id,
    'current_value', v_bag.current_value,
    'capacity', v_bag.capacity,
    'multiplier', v_bag.multiplier,
    'bag_level', v_bag.bag_level,
    'completions', v_completions,
    'events', v_events
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_mai_bag(uuid, bigint, bigint) TO authenticated, anon, service_role;

-- ============================================
-- RPC: complete a mai bag and distribute rewards
-- Used when bag is triggered programmatically
-- ============================================
CREATE OR REPLACE FUNCTION public.complete_mai_bag(p_broadcast_id uuid, p_mai_bag_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bag public.mai_bags%ROWTYPE;
  v_event public.mai_bag_events%ROWTYPE;
  v_reward_coins bigint := 10000;
  v_broadcaster_bonus bigint;
  v_new_multiplier bigint;
  v_tier public.mai_bag_tiers%ROWTYPE;
BEGIN
  SELECT * INTO v_bag
  FROM public.mai_bags
  WHERE id = p_mai_bag_id
    AND broadcast_id = p_broadcast_id
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bag not found or already completed');
  END IF;

  IF v_bag.current_value < v_bag.capacity THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bag not yet full');
  END IF;

  v_reward_coins := 10000 * v_bag.multiplier;
  v_broadcaster_bonus := GREATEST(1, floor(v_reward_coins * 0.01));
  v_new_multiplier := v_bag.multiplier * 2;

  INSERT INTO public.mai_bag_events (
    mai_bag_id, broadcast_id, event_type, value_added,
    reward_coins, broadcaster_bonus_coins,
    old_multiplier, new_multiplier, metadata
  ) VALUES (
    v_bag.id,
    v_bag.broadcast_id,
    'completed',
    v_bag.current_value,
    v_reward_coins,
    v_broadcaster_bonus,
    v_bag.multiplier,
    v_new_multiplier,
    jsonb_build_object('completed_at', now())
  )
  RETURNING * INTO v_event;

  UPDATE public.mai_bags
  SET status = 'completed',
      completed_at = now(),
      completed_count = completed_count + 1,
      updated_at = now()
  WHERE id = v_bag.id;

  SELECT * INTO v_tier FROM public.mai_bag_tiers WHERE level = v_bag.bag_level + 1;
  IF NOT FOUND THEN
    SELECT * INTO v_tier FROM public.mai_bag_tiers ORDER BY level DESC LIMIT 1;
  END IF;

  INSERT INTO public.mai_bags (
    broadcast_id, broadcaster_id, bag_level, multiplier, current_value, capacity, status
  ) VALUES (
    v_bag.broadcast_id,
    v_bag.broadcaster_id,
    COALESCE(v_tier.level, v_bag.bag_level + 1),
    COALESCE(v_tier.multiplier, v_new_multiplier),
    0,
    COALESCE(v_bag.capacity * COALESCE(v_tier.capacity_multiplier, 1.5), v_bag.capacity * 2),
    'active'
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event.id,
    'old_multiplier', v_bag.multiplier,
    'new_multiplier', v_new_multiplier,
    'reward_coins', v_reward_coins,
    'broadcaster_bonus', v_broadcaster_bonus,
    'new_bag_level', COALESCE(v_tier.level, v_bag.bag_level + 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_mai_bag(uuid, uuid) TO authenticated, anon, service_role;

-- ============================================
-- RPC: get current mai bag state for broadcast
-- ============================================
CREATE OR REPLACE FUNCTION public.get_mai_bag_state(p_broadcast_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bag public.mai_bags%ROWTYPE;
  v_tier public.mai_bag_tiers%ROWTYPE;
  v_fill_percent numeric;
BEGIN
  SELECT * INTO v_bag
  FROM public.mai_bags
  WHERE broadcast_id = p_broadcast_id
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'has_bag', false);
  END IF;

  SELECT * INTO v_tier FROM public.mai_bag_tiers WHERE level = v_bag.bag_level;
  IF NOT FOUND THEN
    SELECT * INTO v_tier FROM public.mai_bag_tiers ORDER BY level DESC LIMIT 1;
  END IF;

  v_fill_percent := LEAST(100, (v_bag.current_value::numeric / NULLIF(v_bag.capacity, 0)) * 100);

  RETURN jsonb_build_object(
    'success', true,
    'has_bag', true,
    'bag_id', v_bag.id,
    'bag_level', v_bag.bag_level,
    'multiplier', v_bag.multiplier,
    'current_value', v_bag.current_value,
    'capacity', v_bag.capacity,
    'fill_percent', round(v_fill_percent, 2),
    'tier_name', v_tier.name,
    'visual_type', v_tier.visual_type,
    'completed_count', v_bag.completed_count,
    'updated_at', v_bag.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mai_bag_state(uuid) TO authenticated, anon, service_role;

-- ============================================
-- RPC: broadcaster mai bag summary for profile/broadcast header
-- ============================================
CREATE OR REPLACE FUNCTION public.get_broadcaster_mai_bag_summary(p_broadcaster_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bag public.mai_bags%ROWTYPE;
  v_tier public.mai_bag_tiers%ROWTYPE;
  v_fill_percent numeric;
  v_total_completions bigint;
BEGIN
  SELECT * INTO v_bag
  FROM public.mai_bags
  WHERE broadcaster_id = p_broadcaster_id
    AND status = 'active'
  ORDER BY updated_at DESC
  LIMIT 1;

  SELECT COUNT(*) INTO v_total_completions
  FROM public.mai_bags
  WHERE broadcaster_id = p_broadcaster_id
    AND status = 'completed';

  IF NOT FOUND OR v_bag.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_bag', false,
      'total_completions', v_total_completions
    );
  END IF;

  SELECT * INTO v_tier FROM public.mai_bag_tiers WHERE level = v_bag.bag_level;
  IF NOT FOUND THEN
    SELECT * INTO v_tier FROM public.mai_bag_tiers ORDER BY level DESC LIMIT 1;
  END IF;

  v_fill_percent := LEAST(100, (v_bag.current_value::numeric / NULLIF(v_bag.capacity, 0)) * 100);

  RETURN jsonb_build_object(
    'success', true,
    'has_bag', true,
    'bag_level', v_bag.bag_level,
    'multiplier', v_bag.multiplier,
    'tier_name', v_tier.name,
    'visual_type', v_tier.visual_type,
    'fill_percent', round(v_fill_percent, 2),
    'completed_count', v_bag.completed_count,
    'total_completions', v_total_completions,
    'updated_at', v_bag.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_broadcaster_mai_bag_summary(uuid) TO authenticated, anon, service_role;

-- ============================================
-- TRIGGER: auto-create mai bag when a stream starts
-- ============================================
CREATE OR REPLACE FUNCTION public.trigger_create_mai_bag_on_stream_start()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('starting', 'live') AND (OLD.status IS NULL OR OLD.status NOT IN ('starting', 'live')) THEN
    PERFORM public.get_or_create_mai_bag(NEW.id, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_mai_bag_on_stream_start ON public.streams;
CREATE TRIGGER trg_create_mai_bag_on_stream_start
  BEFORE UPDATE ON public.streams
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_mai_bag_on_stream_start();

-- ============================================
-- REALTIME: enable mai_bags and mai_bag_events for broadcast
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.mai_bags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mai_bag_events;
