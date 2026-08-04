-- Create RPC for joining a tournament with payment
CREATE OR REPLACE FUNCTION public.join_tournament(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tournament RECORD;
  v_entry_fee INTEGER;
  v_user_coins INTEGER;
BEGIN
  -- 1. Get Tournament Details
  SELECT * INTO v_tournament
  FROM public.tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tournament not found');
  END IF;

  IF v_tournament.status NOT IN ('open', 'upcoming') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tournament is not open for registration');
  END IF;

  IF v_tournament.max_participants IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM public.tournament_participants WHERE tournament_id = p_tournament_id) >= v_tournament.max_participants THEN
      RETURN jsonb_build_object('success', false, 'message', 'Tournament is full');
    END IF;
  END IF;

  -- 2. Check if already joined
  IF EXISTS (SELECT 1 FROM public.tournament_participants WHERE tournament_id = p_tournament_id AND user_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already joined');
  END IF;

  -- 3. Check Balance and Deduct Fee
  v_entry_fee := COALESCE(v_tournament.entry_fee, 0);
  
  IF v_entry_fee > 0 THEN
    SELECT troll_coins INTO v_user_coins
    FROM public.user_profiles
    WHERE id = v_user_id;

    IF v_user_coins < v_entry_fee THEN
      RETURN jsonb_build_object('success', false, 'message', 'Insufficient Troll Coins');
    END IF;

    -- Deduct coins
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_entry_fee,
        total_spent_coins = total_spent_coins + v_entry_fee
    WHERE id = v_user_id;

    -- Log transaction
    INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES (
      v_user_id, 
      -v_entry_fee, 
      'tournament_entry', 
      'Entry fee for ' || v_tournament.title, 
      jsonb_build_object('tournament_id', p_tournament_id)
    );
  END IF;

  -- 4. Insert Participant
  INSERT INTO public.tournament_participants (tournament_id, user_id, status, joined_at)
  VALUES (p_tournament_id, v_user_id, 'active', NOW());

  RETURN jsonb_build_object('success', true, 'message', 'Successfully joined');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- Create RPC for withdrawing from a tournament with refund
CREATE OR REPLACE FUNCTION public.withdraw_tournament(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tournament RECORD;
  v_entry_fee INTEGER;
  v_participant RECORD;
BEGIN
  -- 1. Get Tournament Details
  SELECT * INTO v_tournament
  FROM public.tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tournament not found');
  END IF;

  -- Optional: Check if tournament is still open/upcoming? 
  -- Usually you can't withdraw once it starts, but let's allow it if status is NOT 'ended' or strictly 'open'/'upcoming'.
  -- Let's stick to 'open' or 'upcoming' for refunds. If it's live, maybe no refund?
  -- User request didn't specify, but standard logic implies refunds only before lock-in.
  IF v_tournament.status NOT IN ('open', 'upcoming') THEN
     -- If tournament is live/ended, user can withdraw but maybe NO refund? 
     -- Or just block withdrawal?
     -- Let's assume withdrawal is allowed only during registration phase for safety.
     RETURN jsonb_build_object('success', false, 'message', 'Cannot withdraw after tournament has started');
  END IF;

  -- 2. Check participation
  SELECT * INTO v_participant
  FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not a participant');
  END IF;

  -- 3. Refund Fee
  v_entry_fee := COALESCE(v_tournament.entry_fee, 0);

  IF v_entry_fee > 0 THEN
    -- Refund coins
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_entry_fee,
        total_spent_coins = GREATEST(0, total_spent_coins - v_entry_fee) -- optional adjustment
    WHERE id = v_user_id;

    -- Log transaction
    INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES (
      v_user_id, 
      v_entry_fee, 
      'tournament_refund', 
      'Refund for ' || v_tournament.title, 
      jsonb_build_object('tournament_id', p_tournament_id)
    );
  END IF;

  -- 4. Remove Participant (Delete row as requested "keep them out of list")
  DELETE FROM public.tournament_participants
  WHERE id = v_participant.id;

  RETURN jsonb_build_object('success', true, 'message', 'Successfully withdrawn and refunded');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
