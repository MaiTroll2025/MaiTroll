-- Migration: More Notifications (Phase 3)
-- Description: Adds triggers for Troll Battles, Applications, Manual Orders, and Gifts.

-- 0. Ensure Tables Exist (Dependency Check)
CREATE TABLE IF NOT EXISTS public.trollg_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level_at_purchase integer not null,
  fee_amount numeric(18,3) not null default 10000,
  paid_at timestamptz not null default now(),
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

-- Ensure RLS is enabled for trollg_applications if created
ALTER TABLE public.trollg_applications ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trollg_applications' AND policyname = 'Users can view own TrollG application') THEN
    CREATE POLICY "Users can view own TrollG application" ON public.trollg_applications FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.troll_post_gifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL, -- references troll_posts(id) but we skip FK to avoid dependency loop if table missing
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    gift_type TEXT NOT NULL, 
    amount NUMERIC NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- We won't enforce post_id FK here strictly to avoid breaking if troll_posts is missing, 
-- but normally it should exist.

-- 1. Troll Battles (Completed)
CREATE OR REPLACE FUNCTION notify_troll_battle_complete() RETURNS TRIGGER AS $$
DECLARE
    v_winner_name TEXT;
    v_player1_name TEXT;
    v_player2_name TEXT;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        SELECT username INTO v_winner_name FROM public.user_profiles WHERE id = NEW.winner_id;
        SELECT username INTO v_player1_name FROM public.user_profiles WHERE id = NEW.player1_id;
        SELECT username INTO v_player2_name FROM public.user_profiles WHERE id = NEW.player2_id;
        
        PERFORM public.notify_admins(
            'battle_result',
            'Troll Battle Completed',
            'Battle between ' || COALESCE(v_player1_name, 'Unknown') || ' and ' || COALESCE(v_player2_name, 'Unknown') || ' has ended. Winner: ' || COALESCE(v_winner_name, 'None'),
            jsonb_build_object('battle_id', NEW.id, 'winner_id', NEW.winner_id),
            'normal'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_battle_complete ON public.troll_battles;
CREATE TRIGGER on_battle_complete
    AFTER UPDATE ON public.troll_battles
    FOR EACH ROW
    EXECUTE FUNCTION notify_troll_battle_complete();

-- 2. TrollG Applications (Submitted)
CREATE OR REPLACE FUNCTION notify_trollg_application() RETURNS TRIGGER AS $$
DECLARE
    v_username TEXT;
BEGIN
    SELECT username INTO v_username FROM public.user_profiles WHERE id = NEW.user_id;
    
    PERFORM public.notify_admins(
        'application_submitted',
        'New TrollG Application',
        'User ' || COALESCE(v_username, 'Unknown') || ' has submitted a TrollG application.',
        jsonb_build_object('application_id', NEW.id, 'user_id', NEW.user_id),
        'normal'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_trollg_application ON public.trollg_applications;
CREATE TRIGGER on_trollg_application
    AFTER INSERT ON public.trollg_applications
    FOR EACH ROW
    EXECUTE FUNCTION notify_trollg_application();

-- 3. Manual Coin Orders (Pending)
CREATE OR REPLACE FUNCTION notify_manual_coin_order() RETURNS TRIGGER AS $$
DECLARE
    v_username TEXT;
BEGIN
    IF NEW.status = 'pending' THEN
        SELECT username INTO v_username FROM public.user_profiles WHERE id = NEW.user_id;
        
        PERFORM public.notify_admins(
            'system', -- using 'system' or 'item_purchased' generic type
            'New Manual Coin Order',
            'User ' || COALESCE(v_username, 'Unknown') || ' has requested a manual coin order (Amount: ' || NEW.coin_amount || ').',
            jsonb_build_object('order_id', NEW.id, 'user_id', NEW.user_id),
            'high'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_manual_coin_order ON public.manual_coin_orders;
CREATE TRIGGER on_manual_coin_order
    AFTER INSERT ON public.manual_coin_orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_manual_coin_order();

-- 4. Troll Post Gifts
CREATE OR REPLACE FUNCTION notify_troll_post_gift() RETURNS TRIGGER AS $$
DECLARE
    v_sender_name TEXT;
BEGIN
    SELECT username INTO v_sender_name FROM public.user_profiles WHERE id = NEW.sender_id;
    
    -- Only notify for significant gifts if needed, but user asked for "everything"
    -- We will log it as normal priority
    PERFORM public.notify_admins(
        'gift_received',
        'Post Gift Sent',
        'User ' || COALESCE(v_sender_name, 'Unknown') || ' sent a gift (' || NEW.gift_type || ') on a post.',
        jsonb_build_object('gift_id', NEW.id, 'post_id', NEW.post_id, 'sender_id', NEW.sender_id),
        'low'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_troll_post_gift ON public.troll_post_gifts;
CREATE TRIGGER on_troll_post_gift
    AFTER INSERT ON public.troll_post_gifts
    FOR EACH ROW
    EXECUTE FUNCTION notify_troll_post_gift();
