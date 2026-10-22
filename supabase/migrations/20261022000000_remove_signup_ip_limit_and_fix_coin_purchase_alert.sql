CREATE OR REPLACE FUNCTION public.check_duplicate_account_on_ip(
    p_ip_address TEXT,
    p_email TEXT DEFAULT NULL,
    p_role TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'is_duplicate', false,
        'message', 'Multiple accounts per IP are allowed'
    );
$$;

GRANT EXECUTE ON FUNCTION public.check_duplicate_account_on_ip(TEXT, TEXT, TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trigger_notify_admin_coin_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_username TEXT;
  v_order_id TEXT;
  v_coins BIGINT;
BEGIN
  SELECT COALESCE(NULLIF(username, ''), 'User') INTO v_buyer_username
  FROM public.user_profiles WHERE id = NEW.user_id;

  v_order_id := COALESCE(
    NEW.metadata->>'order_id',
    NEW.metadata->>'paypal_order_id',
    NEW.metadata->>'payment_id',
    NEW.external_id
  );

  v_coins := COALESCE(
    CASE
      WHEN NEW.metadata->>'coins_awarded' ~ '^-?[0-9]+$'
        THEN NULLIF((NEW.metadata->>'coins_awarded')::BIGINT, 0)
    END,
    CASE
      WHEN NEW.metadata->>'coin_amount' ~ '^-?[0-9]+$'
        THEN NULLIF((NEW.metadata->>'coin_amount')::BIGINT, 0)
    END,
    CASE
      WHEN NEW.metadata->>'coins_purchased' ~ '^-?[0-9]+$'
        THEN NULLIF((NEW.metadata->>'coins_purchased')::BIGINT, 0)
    END,
    CASE
      WHEN NEW.metadata->>'coins' ~ '^-?[0-9]+$'
        THEN NULLIF((NEW.metadata->>'coins')::BIGINT, 0)
    END,
    NULLIF(NEW.amount, 0),
    0
  );

  PERFORM public.notify_staff(
    'coin_purchase_admin_alert',
    'Coin Purchase Alert',
    COALESCE(v_buyer_username, 'User') || ' purchased ' || ABS(v_coins) ||
      ' coins. Order: ' || COALESCE(v_order_id, 'N/A'),
    jsonb_build_object(
      'user_id', NEW.user_id,
      'username', v_buyer_username,
      'amount', ABS(v_coins),
      'coins', ABS(v_coins),
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
