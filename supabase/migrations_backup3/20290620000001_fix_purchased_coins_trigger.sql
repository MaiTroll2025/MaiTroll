-- Fix purchased_coins column to track actual coin purchases (not gifts)
-- The previous trigger incorrectly tracked gift_received instead of purchases

-- 1. Fix the trigger function to track actual purchases
CREATE OR REPLACE FUNCTION public.update_purchased_coins()
RETURNS TRIGGER AS $$
BEGIN
  -- Track only coin STORE purchases (paypal_purchase, store_purchase, purchase, coin_purchase)
  -- These are actual paid transactions, not gifts/rewards/bonuses
  IF NEW.type IN ('purchase', 'store_purchase', 'paypal_purchase', 'coin_purchase', 'cashapp_purchase', 'stripe_purchase', 'square_purchase')
     AND NEW.amount > 0 THEN
    UPDATE public.user_profiles
    SET purchased_coins = purchased_coins + NEW.amount
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recreate the trigger with corrected logic
DROP TRIGGER IF EXISTS trigger_update_purchased_coins ON public.coin_transactions;
CREATE TRIGGER trigger_update_purchased_coins
AFTER INSERT ON public.coin_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_purchased_coins();

-- 3. Also create trigger for paypal_transactions to sync purchased_coins
CREATE OR REPLACE FUNCTION public.update_purchased_coins_from_paypal()
RETURNS TRIGGER AS $$
BEGIN
  -- Track PayPal coin purchases
  IF NEW.status IN ('completed', 'credited')
     AND NEW.coins IS NOT NULL
     AND NEW.coins > 0 THEN
    UPDATE public.user_profiles
    SET purchased_coins = purchased_coins + NEW.coins
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_purchased_coins_from_paypal ON public.paypal_transactions;
CREATE TRIGGER trigger_update_purchased_coins_from_paypal
AFTER INSERT ON public.paypal_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_purchased_coins_from_paypal();

-- 4. Backfill purchased_coins correctly from actual purchases
-- Reset all to 0 first
UPDATE public.user_profiles SET purchased_coins = 0;

-- Backfill from coin_transactions (actual purchases)
UPDATE public.user_profiles up
SET purchased_coins = (
  SELECT COALESCE(SUM(amount), 0)
  FROM public.coin_transactions ct
  WHERE ct.user_id = up.id
    AND ct.type IN ('purchase', 'store_purchase', 'paypal_purchase', 'coin_purchase', 'cashapp_purchase', 'stripe_purchase', 'square_purchase')
    AND ct.amount > 0
);

-- Add PayPal transactions that aren't already counted
UPDATE public.user_profiles up
SET purchased_coins = purchased_coins + COALESCE((
  SELECT SUM(pt.coins)
  FROM public.paypal_transactions pt
  WHERE pt.user_id = up.id
    AND pt.status IN ('completed', 'credited')
    AND pt.coins IS NOT NULL
    AND pt.coins > 0
), 0)
WHERE EXISTS (
  SELECT 1 FROM public.paypal_transactions pt
  WHERE pt.user_id = up.id
    AND pt.status IN ('completed', 'credited')
    AND pt.coins IS NOT NULL
    AND pt.coins > 0
);