-- Mai Troll Level + Achievement Engine
-- Adds unified level reward engine, level reward metadata, inventory, achievement events,
-- and XP processing RPCs for automatic level reward granting.

-- 1. Ensure canonical profile balance fields exist
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_level_min' AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_level_min CHECK (level >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_xp_nonnegative' AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_xp_nonnegative CHECK (xp >= 0);
  END IF;
END $$;

-- 2. Level rewards metadata table
CREATE TABLE IF NOT EXISTS public.level_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_required integer NOT NULL CHECK (level_required >= 1),
  reward_type text NOT NULL CHECK (reward_type IN (
    'trollmonds',
    'hype_coins',
    'badge',
    'profile_border',
    'profile_glow',
    'profile_frame',
    'profile_title',
    'chat_color',
    'chat_effect',
    'chat_bubble',
    'daily_wheel_spin',
    'daily_mission_bonus',
    'seat_priority',
    'paid_chat_unlock',
    'city_status'
  )),
  reward_key text NOT NULL,
  reward_amount integer NOT NULL DEFAULT 0 CHECK (reward_amount >= 0),
  title text NOT NULL,
  description text,
  inventory_item_type text,
  inventory_item_key text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level_required, reward_type, reward_key)
);

CREATE INDEX IF NOT EXISTS idx_level_rewards_level_required ON public.level_rewards(level_required);

-- 3. User reward claims table
CREATE TABLE IF NOT EXISTS public.user_level_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  level_reward_id uuid NOT NULL REFERENCES public.level_rewards(id) ON DELETE CASCADE,
  level_required integer NOT NULL,
  reward_type text NOT NULL,
  reward_key text NOT NULL,
  reward_amount integer NOT NULL DEFAULT 0,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, level_reward_id)
);

CREATE INDEX IF NOT EXISTS idx_user_level_reward_claims_user_id ON public.user_level_reward_claims(user_id);

-- 4. Inventory items for badges, cosmetics, and unlocks
CREATE TABLE IF NOT EXISTS public.user_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_key text NOT NULL,
  title text NOT NULL,
  description text,
  source_type text NOT NULL DEFAULT 'level_reward',
  source_level integer,
  source_reward_id uuid,
  is_equipped boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_key)
);

CREATE INDEX IF NOT EXISTS idx_user_inventory_items_user_id ON public.user_inventory_items(user_id);

-- 5. Achievement history for level reward grants
CREATE TABLE IF NOT EXISTS public.user_achievement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  achievement_type text NOT NULL,
  achievement_key text NOT NULL,
  title text NOT NULL,
  description text,
  level_reached integer,
  reward_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_achievement_events_user_id ON public.user_achievement_events(user_id);

-- 6. Level engine run log
CREATE TABLE IF NOT EXISTS public.level_engine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  previous_level integer NOT NULL DEFAULT 0,
  new_level integer NOT NULL DEFAULT 0,
  rewards_granted integer NOT NULL DEFAULT 0,
  run_reason text NOT NULL DEFAULT 'xp_update',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_level_engine_runs_user_id ON public.level_engine_runs(user_id);

-- 7. Grant level rewards RPC
CREATE OR REPLACE FUNCTION public.grant_level_rewards_for_user(
  p_user_id uuid,
  p_run_reason text DEFAULT 'level_up'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_level integer;
  v_reward record;
  v_rewards_granted integer := 0;
  v_reward_summary jsonb := '[]'::jsonb;
BEGIN
  SELECT level
  INTO v_current_level
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_level IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  FOR v_reward IN
    SELECT *
    FROM public.level_rewards lr
    WHERE lr.is_active = true
      AND lr.level_required <= v_current_level
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_level_reward_claims ulrc
        WHERE ulrc.user_id = p_user_id
          AND ulrc.level_reward_id = lr.id
      )
    ORDER BY lr.level_required ASC, lr.created_at ASC
  LOOP
    INSERT INTO public.user_level_reward_claims (
      user_id,
      level_reward_id,
      level_required,
      reward_type,
      reward_key,
      reward_amount
    )
    VALUES (
      p_user_id,
      v_reward.id,
      v_reward.level_required,
      v_reward.reward_type,
      v_reward.reward_key,
      v_reward.reward_amount
    )
    ON CONFLICT (user_id, level_reward_id) DO NOTHING;

    IF FOUND THEN
      v_rewards_granted := v_rewards_granted + 1;

      IF v_reward.reward_type = 'trollmonds' THEN
        UPDATE public.user_profiles
        SET trollmonds_balance = COALESCE(trollmonds_balance, 0) + v_reward.reward_amount
        WHERE id = p_user_id;

      ELSIF v_reward.reward_type = 'hype_coins' THEN
        IF v_reward.reward_amount <> 50 THEN
          RAISE EXCEPTION 'Invalid Hype Coin level reward amount. All level Hype Coin rewards must be 50.';
        END IF;

        UPDATE public.user_profiles
        SET hype_coins = COALESCE(hype_coins, 0) + 50
        WHERE id = p_user_id;

      ELSE
        INSERT INTO public.user_inventory_items (
          user_id,
          item_type,
          item_key,
          title,
          description,
          source_type,
          source_level,
          source_reward_id
        )
        VALUES (
          p_user_id,
          COALESCE(v_reward.inventory_item_type, v_reward.reward_type),
          COALESCE(v_reward.inventory_item_key, v_reward.reward_key),
          v_reward.title,
          v_reward.description,
          'level_reward',
          v_reward.level_required,
          v_reward.id
        )
        ON CONFLICT (user_id, item_type, item_key) DO NOTHING;
      END IF;

      v_reward_summary := v_reward_summary || jsonb_build_array(
        jsonb_build_object(
          'level', v_reward.level_required,
          'reward_type', v_reward.reward_type,
          'reward_key', v_reward.reward_key,
          'reward_amount', v_reward.reward_amount,
          'title', v_reward.title
        )
      );
    END IF;
  END LOOP;

  IF v_rewards_granted > 0 THEN
    INSERT INTO public.user_achievement_events (
      user_id,
      achievement_type,
      achievement_key,
      title,
      description,
      level_reached,
      reward_summary
    ) VALUES (
      p_user_id,
      'level_rewards',
      'level_rewards_' || v_current_level::text,
      'You received level rewards!',
      'Your Mai Troll level rewards were added to your account.',
      v_current_level,
      v_reward_summary
    );

    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      metadata,
      created_at
    ) VALUES (
      p_user_id,
      'level_reward',
      'You received level rewards!',
      'Your new Mai Troll level rewards were added to your account.',
      jsonb_build_object(
        'level', v_current_level,
        'rewards', v_reward_summary
      ),
      now()
    );
  END IF;

  INSERT INTO public.level_engine_runs (
    user_id,
    previous_level,
    new_level,
    rewards_granted,
    run_reason
  ) VALUES (
    p_user_id,
    v_current_level,
    v_current_level,
    v_rewards_granted,
    p_run_reason
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'level', v_current_level,
    'rewards_granted', v_rewards_granted,
    'rewards', v_reward_summary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_level_rewards_for_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_level_rewards_for_user(uuid, text) TO service_role;

-- 8. XP processing RPC
CREATE OR REPLACE FUNCTION public.add_user_xp_and_process_level(
  p_user_id uuid,
  p_xp_amount integer,
  p_reason text DEFAULT 'activity'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_xp integer;
  v_new_xp integer;
  v_old_level integer;
  v_new_level integer;
  v_rewards_result jsonb;
BEGIN
  SELECT xp, level
  INTO v_old_xp, v_old_level
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_old_xp IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  v_new_xp := greatest(0, coalesce(v_old_xp, 0) + greatest(0, p_xp_amount));
  v_new_level := least(2000, greatest(1, floor(sqrt(v_new_xp::numeric / 100.0))::integer + 1));

  UPDATE public.user_profiles
  SET xp = v_new_xp,
      level = greatest(coalesce(level, 1), v_new_level)
  WHERE id = p_user_id;

  IF v_new_level > coalesce(v_old_level, 1) THEN
    v_rewards_result := public.grant_level_rewards_for_user(p_user_id, p_reason);
  ELSE
    v_rewards_result := jsonb_build_object(
      'success', true,
      'rewards_granted', 0,
      'rewards', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'old_xp', v_old_xp,
    'new_xp', v_new_xp,
    'old_level', v_old_level,
    'new_level', v_new_level,
    'rewards_result', v_rewards_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_user_xp_and_process_level(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_xp_and_process_level(uuid, integer, text) TO service_role;

-- 9. Seed level rewards
INSERT INTO public.level_rewards (
  level_required, reward_type, reward_key, reward_amount, title, description, inventory_item_type, inventory_item_key
) VALUES
  (1, 'badge', 'new_citizen_badge', 0, 'New Citizen Badge', 'Awarded at Level 1', 'badge', 'new_citizen_badge'),
  (1, 'hype_coins', 'level_1_hype_coins', 50, 'Level 1 Hype Coins', '50 Hype Coins for reaching Level 1', NULL, NULL),
  (5, 'trollmonds', 'level_5_trollmonds', 50, '50 Trollmonds', 'Level 5 Trollmonds reward', NULL, NULL),
  (5, 'hype_coins', 'level_5_hype_coins', 50, 'Level 5 Hype Coins', '50 Hype Coins for reaching Level 5', NULL, NULL),
  (10, 'profile_border', 'profile_border_unlock', 0, 'Profile Border Unlock', 'Unlock a profile border at Level 10', 'profile_border', 'profile_border_unlock'),
  (10, 'hype_coins', 'level_10_hype_coins', 50, 'Level 10 Hype Coins', '50 Hype Coins for reaching Level 10', NULL, NULL),
  (15, 'trollmonds', 'level_15_trollmonds', 75, '75 Trollmonds', 'Level 15 Trollmonds reward', NULL, NULL),
  (15, 'hype_coins', 'level_15_hype_coins', 50, 'Level 15 Hype Coins', '50 Hype Coins for reaching Level 15', NULL, NULL),
  (20, 'chat_color', 'chat_color_unlock', 0, 'Chat Color Unlock', 'Unlock chat color customization', 'chat_color', 'chat_color_unlock'),
  (20, 'hype_coins', 'level_20_hype_coins', 50, 'Level 20 Hype Coins', '50 Hype Coins for reaching Level 20', NULL, NULL),
  (25, 'daily_mission_bonus', 'daily_mission_bonus_unlock', 0, 'Daily Mission Bonus Unlock', 'Unlock daily mission bonus features', 'daily_mission_bonus', 'daily_mission_bonus_unlock'),
  (25, 'hype_coins', 'level_25_hype_coins', 50, 'Level 25 Hype Coins', '50 Hype Coins for reaching Level 25', NULL, NULL),
  (30, 'trollmonds', 'level_30_trollmonds', 100, '100 Trollmonds', 'Level 30 Trollmonds reward', NULL, NULL),
  (30, 'hype_coins', 'level_30_hype_coins', 50, 'Level 30 Hype Coins', '50 Hype Coins for reaching Level 30', NULL, NULL),
  (40, 'profile_glow', 'basic_profile_glow', 0, 'Basic Profile Glow', 'Unlock a basic profile glow', 'profile_glow', 'basic_profile_glow'),
  (40, 'hype_coins', 'level_40_hype_coins', 50, 'Level 40 Hype Coins', '50 Hype Coins for reaching Level 40', NULL, NULL),
  (50, 'seat_priority', 'seat_priority_1', 1, 'Seat Request Priority Level 1', 'Unlock Seat Request Priority Level 1', 'seat_priority', 'seat_priority_1'),
  (50, 'hype_coins', 'level_50_hype_coins', 50, 'Level 50 Hype Coins', '50 Hype Coins for reaching Level 50', NULL, NULL),
  (60, 'trollmonds', 'level_60_trollmonds', 150, '150 Trollmonds', 'Level 60 Trollmonds reward', NULL, NULL),
  (60, 'hype_coins', 'level_60_hype_coins', 50, 'Level 60 Hype Coins', '50 Hype Coins for reaching Level 60', NULL, NULL),
  (75, 'badge', 'street_citizen_badge', 0, 'Street Citizen Badge', 'Awarded at Level 75', 'badge', 'street_citizen_badge'),
  (75, 'hype_coins', 'level_75_hype_coins', 50, 'Level 75 Hype Coins', '50 Hype Coins for reaching Level 75', NULL, NULL),
  (100, 'trollmonds', 'level_100_trollmonds', 250, '250 Trollmonds', 'Level 100 Trollmonds reward', NULL, NULL),
  (100, 'badge', 'level_100_badge', 0, 'Level 100 Badge', 'Awarded at Level 100', 'badge', 'level_100_badge'),
  (100, 'hype_coins', 'level_100_hype_coins', 50, 'Level 100 Hype Coins', '50 Hype Coins for reaching Level 100', NULL, NULL),
  (125, 'daily_wheel_spin', 'extra_daily_wheel_spin', 0, 'Extra Daily Wheel Spin', 'Unlock an additional daily wheel spin', 'daily_wheel_spin', 'extra_daily_wheel_spin'),
  (125, 'hype_coins', 'level_125_hype_coins', 50, 'Level 125 Hype Coins', '50 Hype Coins for reaching Level 125', NULL, NULL),
  (150, 'trollmonds', 'level_150_trollmonds', 300, '300 Trollmonds', 'Level 150 Trollmonds reward', NULL, NULL),
  (150, 'hype_coins', 'level_150_hype_coins', 50, 'Level 150 Hype Coins', '50 Hype Coins for reaching Level 150', NULL, NULL),
  (175, 'profile_title', 'profile_title_unlock', 0, 'Profile Title Unlock', 'Unlock a new profile title', 'profile_title', 'profile_title_unlock'),
  (175, 'hype_coins', 'level_175_hype_coins', 50, 'Level 175 Hype Coins', '50 Hype Coins for reaching Level 175', NULL, NULL),
  (200, 'badge', 'neighborhood_badge', 0, 'Neighborhood Badge', 'Awarded at Level 200', 'badge', 'neighborhood_badge'),
  (200, 'hype_coins', 'level_200_hype_coins', 50, 'Level 200 Hype Coins', '50 Hype Coins for reaching Level 200', NULL, NULL),
  (225, 'trollmonds', 'level_225_trollmonds', 400, '400 Trollmonds', 'Level 225 Trollmonds reward', NULL, NULL),
  (225, 'hype_coins', 'level_225_hype_coins', 50, 'Level 225 Hype Coins', '50 Hype Coins for reaching Level 225', NULL, NULL),
  (250, 'badge', 'broadcast_viewer_badge', 0, 'Broadcast Viewer Badge', 'Awarded at Level 250', 'badge', 'broadcast_viewer_badge'),
  (250, 'hype_coins', 'level_250_hype_coins', 50, 'Level 250 Hype Coins', '50 Hype Coins for reaching Level 250', NULL, NULL),
  (275, 'profile_frame', 'animated_profile_frame', 0, 'Animated Profile Frame', 'Unlock an animated profile frame', 'profile_frame', 'animated_profile_frame'),
  (275, 'hype_coins', 'level_275_hype_coins', 50, 'Level 275 Hype Coins', '50 Hype Coins for reaching Level 275', NULL, NULL),
  (300, 'trollmonds', 'level_300_trollmonds', 500, '500 Trollmonds', 'Level 300 Trollmonds reward', NULL, NULL),
  (300, 'hype_coins', 'level_300_hype_coins', 50, 'Level 300 Hype Coins', '50 Hype Coins for reaching Level 300', NULL, NULL),
  (350, 'seat_priority', 'seat_priority_2', 2, 'Seat Request Priority Level 2', 'Unlock Seat Request Priority Level 2', 'seat_priority', 'seat_priority_2'),
  (350, 'hype_coins', 'level_350_hype_coins', 50, 'Level 350 Hype Coins', '50 Hype Coins for reaching Level 350', NULL, NULL),
  (399, 'badge', 'almost_paid_chat_badge', 0, 'Almost Paid Chat Badge', 'Awarded at Level 399', 'badge', 'almost_paid_chat_badge'),
  (399, 'hype_coins', 'level_399_hype_coins', 50, 'Level 399 Hype Coins', '50 Hype Coins for reaching Level 399', NULL, NULL),
  (420, 'paid_chat_unlock', 'paid_chats_unlock', 0, 'Paid Chats Unlock', 'Unlock paid chat access', 'paid_chat_unlock', 'paid_chats_unlock'),
  (420, 'hype_coins', 'level_420_hype_coins', 50, 'Level 420 Hype Coins', '50 Hype Coins for reaching Level 420', NULL, NULL),
  (450, 'trollmonds', 'level_450_trollmonds', 750, '750 Trollmonds', 'Level 450 Trollmonds reward', NULL, NULL),
  (450, 'hype_coins', 'level_450_hype_coins', 50, 'Level 450 Hype Coins', '50 Hype Coins for reaching Level 450', NULL, NULL),
  (500, 'badge', 'verified_city_member_badge', 0, 'Verified City Member Badge', 'Awarded at Level 500', 'badge', 'verified_city_member_badge'),
  (500, 'hype_coins', 'level_500_hype_coins', 50, 'Level 500 Hype Coins', '50 Hype Coins for reaching Level 500', NULL, NULL),
  (550, 'profile_glow', 'advanced_profile_glow', 0, 'Advanced Profile Glow', 'Unlock an advanced profile glow', 'profile_glow', 'advanced_profile_glow'),
  (550, 'hype_coins', 'level_550_hype_coins', 50, 'Level 550 Hype Coins', '50 Hype Coins for reaching Level 550', NULL, NULL),
  (600, 'trollmonds', 'level_600_trollmonds', 1000, '1,000 Trollmonds', 'Level 600 Trollmonds reward', NULL, NULL),
  (600, 'hype_coins', 'level_600_hype_coins', 50, 'Level 600 Hype Coins', '50 Hype Coins for reaching Level 600', NULL, NULL),
  (650, 'badge', 'battle_fan_badge', 0, 'Battle Fan Badge', 'Awarded at Level 650', 'badge', 'battle_fan_badge'),
  (650, 'hype_coins', 'level_650_hype_coins', 50, 'Level 650 Hype Coins', '50 Hype Coins for reaching Level 650', NULL, NULL),
  (700, 'seat_priority', 'seat_priority_3', 3, 'Seat Request Priority Level 3', 'Unlock Seat Request Priority Level 3', 'seat_priority', 'seat_priority_3'),
  (700, 'hype_coins', 'level_700_hype_coins', 50, 'Level 700 Hype Coins', '50 Hype Coins for reaching Level 700', NULL, NULL),
  (750, 'chat_bubble', 'premium_chat_bubble', 0, 'Premium Chat Bubble', 'Unlock a premium chat bubble', 'chat_bubble', 'premium_chat_bubble'),
  (750, 'hype_coins', 'level_750_hype_coins', 50, 'Level 750 Hype Coins', '50 Hype Coins for reaching Level 750', NULL, NULL),
  (800, 'trollmonds', 'level_800_trollmonds', 1500, '1,500 Trollmonds', 'Level 800 Trollmonds reward', NULL, NULL),
  (800, 'hype_coins', 'level_800_hype_coins', 50, 'Level 800 Hype Coins', '50 Hype Coins for reaching Level 800', NULL, NULL),
  (850, 'badge', 'broadcast_supporter_badge', 0, 'Broadcast Supporter Badge', 'Awarded at Level 850', 'badge', 'broadcast_supporter_badge'),
  (850, 'hype_coins', 'level_850_hype_coins', 50, 'Level 850 Hype Coins', '50 Hype Coins for reaching Level 850', NULL, NULL),
  (900, 'profile_frame', 'special_profile_animation', 0, 'Special Profile Animation', 'Unlock a special profile animation', 'profile_frame', 'special_profile_animation'),
  (900, 'hype_coins', 'level_900_hype_coins', 50, 'Level 900 Hype Coins', '50 Hype Coins for reaching Level 900', NULL, NULL),
  (999, 'badge', 'elite_citizen_badge', 0, 'Elite Citizen Badge', 'Awarded at Level 999', 'badge', 'elite_citizen_badge'),
  (999, 'hype_coins', 'level_999_hype_coins', 50, 'Level 999 Hype Coins', '50 Hype Coins for reaching Level 999', NULL, NULL),
  (1000, 'badge', 'elite_troll_city_badge', 0, 'Elite Mai Troll Badge', 'Awarded at Level 1000', 'badge', 'elite_troll_city_badge'),
  (1000, 'trollmonds', 'level_1000_trollmonds', 2000, '2,000 Trollmonds', 'Level 1000 Trollmonds reward', NULL, NULL),
  (1000, 'hype_coins', 'level_1000_hype_coins', 50, 'Level 1000 Hype Coins', '50 Hype Coins for reaching Level 1000', NULL, NULL),
  (1100, 'profile_frame', 'rare_profile_frame', 0, 'Rare Profile Frame', 'Unlock a rare profile frame', 'profile_frame', 'rare_profile_frame'),
  (1100, 'hype_coins', 'level_1100_hype_coins', 50, 'Level 1100 Hype Coins', '50 Hype Coins for reaching Level 1100', NULL, NULL),
  (1200, 'trollmonds', 'level_1200_trollmonds', 2500, '2,500 Trollmonds', 'Level 1200 Trollmonds reward', NULL, NULL),
  (1200, 'hype_coins', 'level_1200_hype_coins', 50, 'Level 1200 Hype Coins', '50 Hype Coins for reaching Level 1200', NULL, NULL),
  (1300, 'chat_effect', 'vip_chat_effect', 0, 'VIP Chat Effect', 'Unlock a VIP chat effect', 'chat_effect', 'vip_chat_effect'),
  (1300, 'hype_coins', 'level_1300_hype_coins', 50, 'Level 1300 Hype Coins', '50 Hype Coins for reaching Level 1300', NULL, NULL),
  (1400, 'seat_priority', 'seat_priority_4', 4, 'Seat Request Priority Level 4', 'Unlock Seat Request Priority Level 4', 'seat_priority', 'seat_priority_4'),
  (1400, 'hype_coins', 'level_1400_hype_coins', 50, 'Level 1400 Hype Coins', '50 Hype Coins for reaching Level 1400', NULL, NULL),
  (1499, 'badge', 'city_legend_badge', 0, 'City Legend Badge', 'Awarded at Level 1499', 'badge', 'city_legend_badge'),
  (1499, 'hype_coins', 'level_1499_hype_coins', 50, 'Level 1499 Hype Coins', '50 Hype Coins for reaching Level 1499', NULL, NULL),
  (1500, 'badge', 'legendary_citizen_badge', 0, 'Legendary Citizen Badge', 'Awarded at Level 1500', 'badge', 'legendary_citizen_badge'),
  (1500, 'trollmonds', 'level_1500_trollmonds', 5000, '5,000 Trollmonds', 'Level 1500 Trollmonds reward', NULL, NULL),
  (1500, 'hype_coins', 'level_1500_hype_coins', 50, 'Level 1500 Hype Coins', '50 Hype Coins for reaching Level 1500', NULL, NULL),
  (1600, 'profile_frame', 'rare_animated_avatar_frame', 0, 'Rare Animated Avatar Frame', 'Unlock a rare animated avatar frame', 'profile_frame', 'rare_animated_avatar_frame'),
  (1600, 'hype_coins', 'level_1600_hype_coins', 50, 'Level 1600 Hype Coins', '50 Hype Coins for reaching Level 1600', NULL, NULL),
  (1700, 'trollmonds', 'level_1700_trollmonds', 5000, '5,000 Trollmonds', 'Level 1700 Trollmonds reward', NULL, NULL),
  (1700, 'hype_coins', 'level_1700_hype_coins', 50, 'Level 1700 Hype Coins', '50 Hype Coins for reaching Level 1700', NULL, NULL),
  (1800, 'badge', 'city_icon_badge', 0, 'City Icon Badge', 'Awarded at Level 1800', 'badge', 'city_icon_badge'),
  (1800, 'hype_coins', 'level_1800_hype_coins', 50, 'Level 1800 Hype Coins', '50 Hype Coins for reaching Level 1800', NULL, NULL),
  (1900, 'profile_glow', 'ultra_profile_glow', 0, 'Ultra Profile Glow', 'Unlock an ultra profile glow', 'profile_glow', 'ultra_profile_glow'),
  (1900, 'hype_coins', 'level_1900_hype_coins', 50, 'Level 1900 Hype Coins', '50 Hype Coins for reaching Level 1900', NULL, NULL),
  (1999, 'badge', 'almost_mayor_level_badge', 0, 'Almost Mayor-Level Badge', 'Awarded at Level 1999', 'badge', 'almost_mayor_level_badge'),
  (1999, 'hype_coins', 'level_1999_hype_coins', 50, 'Level 1999 Hype Coins', '50 Hype Coins for reaching Level 1999', NULL, NULL),
  (2000, 'badge', 'troll_city_legend_max_badge', 0, 'Mai Troll Legend Max Badge', 'Awarded at Level 2000', 'badge', 'troll_city_legend_max_badge'),
  (2000, 'trollmonds', 'level_2000_trollmonds', 10000, '10,000 Trollmonds', 'Level 2000 Trollmonds reward', NULL, NULL),
  (2000, 'hype_coins', 'level_2000_hype_coins', 50, 'Level 2000 Hype Coins', '50 Hype Coins for reaching Level 2000', NULL, NULL),
  (2000, 'profile_frame', 'permanent_golden_profile_frame', 0, 'Permanent Golden Profile Frame', 'Unlock a permanent golden profile frame', 'profile_frame', 'permanent_golden_profile_frame'),
  (2000, 'city_status', 'max_level_city_status', 0, 'Max Level City Status', 'Awarded at Level 2000', 'city_status', 'max_level_city_status')
ON CONFLICT (level_required, reward_type, reward_key) DO NOTHING;

-- 10. Documentation comments
COMMENT ON TABLE public.level_rewards IS 'Catalog of level rewards and unlocks for Mai Troll level progression.';
COMMENT ON TABLE public.user_level_reward_claims IS 'Tracks claimed level rewards to prevent duplicate grants.';
COMMENT ON TABLE public.user_inventory_items IS 'Stores user-owned badges, cosmetics, unlocks, and level reward inventory items.';
COMMENT ON TABLE public.user_achievement_events IS 'Keeps historical achievement events for user level reward grants.';
COMMENT ON TABLE public.level_engine_runs IS 'Logs every run of the level reward engine.';
