BEGIN;

-- Widen broadcast_mod_actions.action_type CHECK to include troll_coin_penalty
DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'broadcast_mod_actions_action_type_check'
      AND conrelid = 'public.broadcast_mod_actions'::regclass
  ) THEN
    ALTER TABLE public.broadcast_mod_actions
      DROP CONSTRAINT broadcast_mod_actions_action_type_check;
  END IF;
END $guard$;

ALTER TABLE public.broadcast_mod_actions
  ADD CONSTRAINT broadcast_mod_actions_action_type_check
  CHECK (action_type IN (
    'disable_chat','enable_chat','kick','arrest',
    'disable_broadcast','enable_broadcast',
    'disable_hytrogame','enable_hytrogame',
    'disable_seat_joining','enable_seat_joining',
    'report','mute','unmute','warn','warning','platform_review','fine',
    'suspend_license','grant_license','remove_officer','set_to_user','end_stream',
    'troll_coin_penalty'
  ));

CREATE OR REPLACE FUNCTION public.apply_troll_coin_penalty(
  p_broadcast_id uuid,
  p_coin_amount integer,
  p_moderator_id uuid,
  p_target_user_id uuid,
  p_violation_category text,
  p_violation_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_is_admin boolean;
  v_actor_role text;
  v_actor_display text;
  v_target_display text;
  v_target_role text;
  v_new_balance integer;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'message', 'You must be signed in.');
  END IF;

  IF v_actor_id != p_moderator_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED', 'message', 'Moderator ID mismatch.');
  END IF;

  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED', 'message', 'You do not have permission to use Mod Actions.');
  END IF;

  IF p_coin_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_AMOUNT', 'message', 'Coin amount must not be zero.');
  END IF;

  SELECT is_admin, role, COALESCE(NULLIF(username, ''), NULLIF(full_name, ''), 'Unknown')
    INTO v_actor_is_admin, v_actor_role, v_actor_display
    FROM public.user_profiles
   WHERE id = v_actor_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'ACTOR_NOT_FOUND', 'message', 'Moderator profile not found.');
  END IF;

  IF p_coin_amount < 0 AND NOT (v_actor_is_admin = true OR LOWER(v_actor_role) IN ('admin', 'ceo', 'superadmin', 'owner')) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED', 'message', 'Only admins can add coins.');
  END IF;

  SELECT troll_coins, COALESCE(NULLIF(username, ''), NULLIF(full_name, ''), 'Unknown'), COALESCE(role, 'unknown')
    INTO v_new_balance, v_target_display, v_target_role
    FROM public.user_profiles
   WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TARGET_NOT_FOUND', 'message', 'Target user not found.');
  END IF;

  v_new_balance := COALESCE(v_new_balance, 0) - p_coin_amount;

  IF v_new_balance < 0 THEN
    v_new_balance := 0;
  END IF;

  UPDATE public.user_profiles
     SET troll_coins = v_new_balance,
         updated_at = now()
   WHERE id = p_target_user_id;

  PERFORM public.modo_audit(
    'troll_coin_penalty',
    'Troll Coin Penalty',
    v_actor_id,
    p_target_user_id,
    v_target_display,
    v_target_role,
    v_target_role,
    p_broadcast_id,
    NULL,
    p_violation_reason,
    NULL,
    NULL,
    NULL,
    NULL,
    true,
    NULL,
    jsonb_build_object(
      'coin_amount', p_coin_amount,
      'new_balance', v_new_balance,
      'violation_category', p_violation_category
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', 'ACTION_COMPLETED',
    'message', 'Troll Coin penalty applied successfully.',
    'data', jsonb_build_object(
      'new_troll_coins', v_new_balance,
      'target_username', v_target_display,
      'moderator_username', v_actor_display,
      'coin_amount', p_coin_amount
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_troll_coin_penalty(uuid, integer, uuid, uuid, text, text) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
