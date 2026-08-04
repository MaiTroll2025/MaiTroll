-- ============================================================================
-- MAI PAY PLUS — PURCHASABLE ITEM SEED
-- Date: 2026-07-17
-- Purpose: Register MAI Pay Plus as a purchasable item so upgrade purchases
--          are tracked in purchase_ledger / coin_transactions consistently.
--          (The actual flag is set by paypalStoreFulfillment on capture.)
-- ============================================================================

INSERT INTO public.purchasable_items (
  item_key,
  display_name,
  category,
  usd_price,
  coin_price,
  is_coin_pack,
  is_active,
  metadata
)
SELECT
  'mai_pay_plus',
  'MAI Pay Plus',
  'subscription',
  9.99,
  0,
  false,
  true,
  '{"product_type": "mai_pay_plus", "coins": 0, "benefit": "20 rolling cashouts/24h, double coin requirements per tier"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.purchasable_items WHERE item_key = 'mai_pay_plus'
);

-- Ensure the user_profiles flag exists (idempotent).
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS mai_pay_plus BOOLEAN NOT NULL DEFAULT FALSE;
 