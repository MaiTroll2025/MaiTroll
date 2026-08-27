-- =========================================================================
-- Migration: Fix coin purchase admin-alert trigger
-- Date: 2026-09-03
--
-- The trigger `trg_notify_admin_coin_purchase` fired on inserts into
-- `public.coin_transactions` (type 'purchase' / 'coin_purchase') and tried to
-- read `NEW.order_id`. `coin_transactions` has no `order_id` column, so the
-- trigger raised "record "new" has no field "order_id"" and aborted the whole
-- insert — which broke MKey purchases (mkey_purchase_with_coins writes a
-- coin_transactions row of type 'purchase').
--
-- Order context (when present) lives in the `metadata` jsonb, so we read it
-- from there instead. This keeps the trigger harmless for rows that have no
-- order_id (e.g. MKey spends).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.trigger_notify_admin_coin_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_username TEXT;
  v_order_id TEXT;
BEGIN
  SELECT COALESCE(NULLIF(username, ''), 'User') INTO v_buyer_username
  FROM public.user_profiles WHERE id = NEW.user_id;

  v_order_id := NEW.metadata->>'order_id';

  PERFORM public.notify_staff(
    'coin_purchase_admin_alert',
    'Coin Purchase Alert',
    COALESCE(v_buyer_username, 'User') || ' purchased coins. Amount: ' || NEW.amount ||
    '. Order: ' || COALESCE(v_order_id, 'N/A'),
    jsonb_build_object(
      'user_id', NEW.user_id,
      'username', v_buyer_username,
      'amount', NEW.amount,
      'order_id', v_order_id,
      'route', '/admin/payments'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_coin_purchase ON public.coin_transactions;
CREATE TRIGGER trg_notify_admin_coin_purchase
  AFTER INSERT ON public.coin_transactions
  FOR EACH ROW
  WHEN (NEW.type = 'coin_purchase' OR NEW.type = 'purchase')
  EXECUTE FUNCTION public.trigger_notify_admin_coin_purchase();
