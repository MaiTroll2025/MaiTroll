CREATE OR REPLACE FUNCTION "public"."check_influencer_eligibility"("p_user_id" "uuid") 
RETURNS json
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public', 'extensions'
AS $$
DECLARE
  v_followers_count INTEGER;
  v_coins_received INTEGER;
  v_is_verified BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object(
      'eligible', false,
      'followers', 0,
      'coins_received', 0,
      'needs_verified', true,
      'needs_followers', true,
      'needs_coins', true
    );
  END IF;

  SELECT 
    COALESCE(is_verified, false),
    (SELECT COUNT(*) FROM user_follows WHERE following_id = p_user_id) as followers,
    (SELECT COALESCE(SUM(coins), 0) FROM coin_transactions WHERE user_id = p_user_id AND type = 'gift_received')
  INTO v_is_verified, v_followers_count, v_coins_received
  FROM user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND OR v_is_verified IS NULL THEN
    RETURN json_build_object(
      'eligible', false,
      'followers', COALESCE(v_followers_count, 0),
      'coins_received', COALESCE(v_coins_received, 0),
      'needs_verified', true,
      'needs_followers', true,
      'needs_coins', true
    );
  END IF;

  IF v_is_verified = TRUE AND v_followers_count >= 200 AND v_coins_received >= 5000 THEN
    RETURN json_build_object(
      'eligible', true,
      'followers', v_followers_count,
      'coins_received', v_coins_received
    );
  END IF;

  RETURN json_build_object(
    'eligible', false,
    'followers', v_followers_count,
    'coins_received', v_coins_received,
    'needs_verified', NOT v_is_verified,
    'needs_followers', v_followers_count < 200,
    'needs_coins', v_coins_received < 5000
  );
END;
$$;

ALTER FUNCTION "public"."check_influencer_eligibility"("p_user_id" "uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."check_influencer_eligibility"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_influencer_eligibility"("p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."check_influencer_eligibility"("p_user_id" "uuid") TO "authenticated";
