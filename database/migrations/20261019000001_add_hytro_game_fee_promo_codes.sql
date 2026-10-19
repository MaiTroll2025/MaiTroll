-- Add HytroGaming agency startup fee promo codes
-- CEOGAME26: 100% off agency startup fee (full waiver)
-- NOAHGAME26: 50% off agency startup fee (half fee)

INSERT INTO public.tromocodes (
  code,
  normalized_code,
  description,
  promotion_type,
  promotion_value,
  applies_to,
  max_uses,
  starts_at,
  expires_at,
  is_active,
  created_by
) VALUES
  (
    'CEOGAME26',
    'CEOGAME26',
    'HytroGaming agency startup fee - 100% off (full fee waiver)',
    'percentage_discount',
    100,
    'all_eligible',
    NULL,
    now(),
    NULL,
    true,
    NULL
  ),
  (
    'NOAHGAME26',
    'NOAHGAME26',
    'HytroGaming agency startup fee - 50% off (half fee)',
    'percentage_discount',
    50,
    'all_eligible',
    NULL,
    now(),
    NULL,
    true,
    NULL
  );
