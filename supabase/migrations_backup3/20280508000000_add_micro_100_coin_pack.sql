-- Add $1 / 100 coins micro pack
-- Matches frontend configuration: src/lib/coinMath.js and src/config/coinConfig.ts

INSERT INTO public.coin_packages (id, name, coins, price, label, description, is_active, currency)
VALUES 
  ('pkg-100', 'Micro Pack', 100, 1.00, '100 Coins', 'Basic coin pack', true, 'USD')
ON CONFLICT (id) DO UPDATE
SET 
  coins = EXCLUDED.coins,
  price = EXCLUDED.price,
  label = EXCLUDED.label,
  is_active = EXCLUDED.is_active;
