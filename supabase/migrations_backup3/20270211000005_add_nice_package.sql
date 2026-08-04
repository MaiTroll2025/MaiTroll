-- Add "Nice" coin package (104 coins for $0.69)
-- Matches the frontend configuration in src/lib/coinMath.js

INSERT INTO public.coin_packages (id, name, coins, price, label, description, is_active, currency)
VALUES 
  ('pkg-nice', 'Nice Pack', 104, 0.69, '104 Coins', 'Nice.', true, 'USD')
ON CONFLICT (id) DO UPDATE
SET 
  coins = EXCLUDED.coins,
  price = EXCLUDED.price,
  label = EXCLUDED.label,
  is_active = EXCLUDED.is_active;
