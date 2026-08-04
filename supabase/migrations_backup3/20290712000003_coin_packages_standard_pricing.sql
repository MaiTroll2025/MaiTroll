-- B7: Standardize coin package pricing in the database.
-- The platform exchange rate is fixed at 100 Troll Coins = $1.00 USD for all
-- store purchases. This migration removes any drifted/double values and makes
-- the canonical standard explicit so future fulfillment resolves to the rate
-- used by the client (COINS_PER_USD = 100). All discounts and bonus-coin
-- promotions are removed at the source of truth.
--
-- Note: coin_packages.id is a uuid. We identify canonical rows by paypal_sku
-- (deterministic, derived from the package id string) so the migration is
-- idempotent on re-run without requiring the uuid-ossp extension.

insert into public.coin_packages (id, name, coins, price_usd, paypal_sku, is_active)
values
  (gen_random_uuid(), 'Micro Pack',     100,   1.00,  'TC-pkg-100',   true),
  (gen_random_uuid(), 'Starter Pack',   300,   3.00,  'TC-pkg-300',   true),
  (gen_random_uuid(), 'Small Boost',    500,   5.00,  'TC-pkg-500',   true),
  (gen_random_uuid(), 'Casual Pack',    1000,  10.00, 'TC-pkg-1000',  true),
  (gen_random_uuid(), 'Bronze Pack',    2500,  25.00, 'TC-pkg-2500',  true),
  (gen_random_uuid(), 'Silver Pack',    5000,  50.00, 'TC-pkg-5000',  true),
  (gen_random_uuid(), 'Gold Pack',      10000, 100.00,'TC-pkg-10000', true),
  (gen_random_uuid(), 'Platinum Pack',  15000, 150.00,'TC-pkg-15000', true),
  (gen_random_uuid(), 'Diamond Pack',   25000, 250.00,'TC-pkg-25000', true),
  (gen_random_uuid(), 'Legendary Pack', 50000, 500.00,'TC-pkg-50000', true),
  (gen_random_uuid(), 'Titan Pack',     100000,1000.00,'TC-pkg-100000',true),
  (gen_random_uuid(), 'Immortal Pack',  250000,2500.00,'TC-pkg-250000',true)
on conflict (paypal_sku) do update
  set name = excluded.name,
      coins = excluded.coins,
      price_usd = excluded.price_usd,
      is_active = true,
      updated_at = now();

-- Guard clause: any package that does not follow the 100 coins = $1 rate is
-- corrected to the standard so fulfillment can never credit bonus coins.
update public.coin_packages
set coins = round(price_usd * 100)::integer,
    updated_at = now()
where coins <> round(price_usd * 100)::integer;
