CREATE OR REPLACE FUNCTION public.fulfill_marketplace_order(
  p_order_id uuid,
  p_tracking_number text,
  p_carrier text,
  p_shipped_date timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order marketplace_purchases%ROWTYPE;
  v_tracking_url text;
  v_shipment_id uuid;
  v_seller_id uuid := auth.uid();
BEGIN
  IF v_seller_id IS NULL THEN
    RETURN 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM public.marketplace_purchases
  WHERE id = p_order_id
    AND seller_id = v_seller_id;

  IF v_order IS NULL THEN
    RETURN 'Order not found';
  END IF;

  IF v_order.status NOT IN ('paid', 'processing', 'shipped', 'delivered', 'completed') THEN
    RETURN 'Order cannot be fulfilled in current status';
  END IF;

  v_tracking_url := CASE
    WHEN p_carrier = 'usps' THEN 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' || p_tracking_number
    WHEN p_carrier = 'fedex' THEN 'https://www.fedex.com/fedextrack/?trknbr=' || p_tracking_number
    WHEN p_carrier = 'ups' THEN 'https://www.ups.com/track?tracknum=' || p_tracking_number
    WHEN p_carrier = 'dhl' THEN 'https://www.dhl.com/en/express/tracking.html?AWB=' || p_tracking_number
    ELSE NULL
  END;

  INSERT INTO public.order_shipments (order_id, carrier, tracking_number, tracking_url, tracking_status, shipped_date)
  VALUES (p_order_id, p_carrier, p_tracking_number, v_tracking_url, 'label_created', p_shipped_date)
  ON CONFLICT (order_id) DO UPDATE SET
    carrier = p_carrier,
    tracking_number = p_tracking_number,
    tracking_url = v_tracking_url,
    shipped_date = p_shipped_date,
    tracking_status = 'label_created',
    updated_at = now()
  RETURNING id INTO v_shipment_id;

  IF v_order.status NOT IN ('shipped', 'delivered', 'completed') THEN
    UPDATE public.marketplace_purchases
    SET status = 'shipped',
        fulfillment_status = 'fulfilled',
        tracking_number = p_tracking_number,
        shipping_carrier = p_carrier,
        tracking_url = v_tracking_url,
        shipped_at = now(),
        shipped_date = p_shipped_date,
        updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read, created_at)
    VALUES (
      v_order.buyer_id,
      'marketplace_order_shipped',
      'Order Shipped',
      'Your marketplace order has been shipped.',
      jsonb_build_object('order_id', p_order_id, 'tracking_number', p_tracking_number, 'carrier', p_carrier, 'route', '/my-orders'),
      false,
      now()
    );
  ELSE
    UPDATE public.marketplace_purchases
    SET tracking_number = p_tracking_number,
        shipping_carrier = p_carrier,
        tracking_url = v_tracking_url,
        shipped_date = p_shipped_date,
        updated_at = now()
    WHERE id = p_order_id;
  END IF;

  RETURN 'Order fulfilled successfully';
END;
$$;

GRANT EXECUTE ON FUNCTION public.fulfill_marketplace_order(uuid, text, text, timestamptz) TO authenticated, service_role;
