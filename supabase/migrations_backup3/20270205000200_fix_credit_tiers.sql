-- Fix Credit Score Tier Logic to match UI Scale
-- Scale:
-- 800+: Elite
-- 700-799: Trusted
-- 600-699: Reliable
-- 450-599: Building
-- 300-449: Shaky
-- < 300: Untrusted

CREATE OR REPLACE FUNCTION public.get_credit_tier(p_score INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF p_score < 300 THEN RETURN 'Untrusted';
  ELSIF p_score < 450 THEN RETURN 'Shaky';
  ELSIF p_score < 600 THEN RETURN 'Building';
  ELSIF p_score < 700 THEN RETURN 'Reliable';
  ELSIF p_score < 800 THEN RETURN 'Trusted';
  ELSE RETURN 'Elite';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Recalculate tiers for all users
UPDATE public.user_credit
SET tier = public.get_credit_tier(score);
