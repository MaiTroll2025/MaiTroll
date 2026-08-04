-- Launch workflow fixes: rent due enforcement, rent reminders, marketplace
-- fulfillment hardening, and notification route support.

CREATE OR REPLACE FUNCTION public.next_monthly_rent_due_date(
  p_due_day integer,
  p_last_paid_at timestamptz,
  p_start_date timestamptz DEFAULT now()
)
RETURNS date
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_anchor date := COALESCE(p_last_paid_at::date, p_start_date::date, CURRENT_DATE);
  v_year integer;
  v_month integer;
  v_day integer;
  v_due date;
BEGIN
  v_year := EXTRACT(YEAR FROM v_anchor)::integer;
  v_month := EXTRACT(MONTH FROM v_anchor)::integer;
  v_day := LEAST(GREATEST(COALESCE(p_due_day, 1), 1), EXTRACT(DAY FROM (date_trunc('month', make_date(v_year, v_month, 1)) + interval '1 month - 1 day'))::integer);
  v_due := make_date(v_year, v_month, v_day);

  IF p_last_paid_at IS NOT NULL OR v_due < CURRENT_DATE THEN
    v_due := (date_trunc('month', v_due)::date + interval '1 month')::date;
    v_day := LEAST(GREATEST(COALESCE(p_due_day, 1), 1), EXTRACT(DAY FROM (date_trunc('month', v_due) + interval '1 month - 1 day'))::integer);
    v_due := make_date(EXTRACT(YEAR FROM v_due)::integer, EXTRACT(MONTH FROM v_due)::integer, v_day);
  END IF;

  RETURN v_due;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_rent(p_lease_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lease record;
  v_property record;
  v_user_id uuid := auth.uid();
  v_rent numeric;
  v_electric numeric;
  v_water numeric;
  v_total_cost numeric;
  v_balance numeric;
  v_due_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_lease
  FROM public.leases
  WHERE id = p_lease_id
    AND tenant_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lease not found for this tenant.');
  END IF;

  IF v_lease.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lease is not active.');
  END IF;

  v_due_date := public.next_monthly_rent_due_date(v_lease.rent_due_day, v_lease.last_rent_paid_at, v_lease.start_date);
  IF CURRENT_DATE < v_due_date THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rent is not due until ' || to_char(v_due_date, 'YYYY-MM-DD') || '.',
      'next_due_date', v_due_date
    );
  END IF;

  SELECT * INTO v_property FROM public.properties WHERE id = v_lease.property_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property not found.');
  END IF;

  v_rent := COALESCE(v_property.rent_amount, 0);
  v_electric := COALESCE(v_property.electric_cost, CEIL(COALESCE(v_property.utility_cost, 0) / 2.0));
  v_water := COALESCE(v_property.water_cost, FLOOR(COALESCE(v_property.utility_cost, 0) / 2.0));
  v_total_cost := v_rent + v_electric + v_water;

  SELECT COALESCE(troll_coins, 0) INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
  IF COALESCE(v_balance, 0) < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Need ' || v_total_cost || ' coins.');
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) - v_total_cost,
      updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.leases
  SET last_rent_paid_at = now(),
      updated_at = now()
  WHERE id = p_lease_id;

  INSERT INTO public.invoices (lease_id, type, amount, status, created_at)
  VALUES (p_lease_id, 'rent', v_rent, 'paid', now()),
         (p_lease_id, 'electric', v_electric, 'paid', now()),
         (p_lease_id, 'water', v_water, 'paid', now());

  INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
  VALUES (v_user_id, 'rent', -v_total_cost, 'Rent payment for lease ' || p_lease_id, now());

  IF v_property.owner_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_rent,
        updated_at = now()
    WHERE id = v_property.owner_id;

    INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
    VALUES (v_property.owner_id, 'rent_income', v_rent, 'Rent income from lease ' || p_lease_id, now());

    INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read, created_at)
    VALUES (
      v_property.owner_id,
      'rent_paid',
      'Rent Paid',
      'A tenant paid rent.',
      jsonb_build_object('lease_id', p_lease_id, 'tenant_id', v_user_id, 'route', '/living?tab=tenants'),
      false,
      now()
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'total_paid', v_total_cost);
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_house_rent(p_rental_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rental record;
  v_user_id uuid := auth.uid();
  v_balance numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_rental
  FROM public.house_rentals
  WHERE id = p_rental_id
    AND tenant_user_id = v_user_id
    AND status IN ('active', 'late');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rental not found for this tenant.');
  END IF;

  IF v_rental.next_due_at IS NOT NULL AND now() < v_rental.next_due_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rent is not due until ' || to_char(v_rental.next_due_at, 'YYYY-MM-DD') || '.',
      'next_due_at', v_rental.next_due_at
    );
  END IF;

  SELECT COALESCE(troll_coins, 0) INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
  IF v_balance < COALESCE(v_rental.rent_amount, 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Need ' || COALESCE(v_rental.rent_amount, 0) || ' coins.');
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) - COALESCE(v_rental.rent_amount, 0),
      updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + COALESCE(v_rental.rent_amount, 0),
      updated_at = now()
  WHERE id = v_rental.landlord_user_id;

  UPDATE public.house_rentals
  SET last_paid_at = now(),
      next_due_at = now() + interval '7 days',
      status = 'active'
  WHERE id = p_rental_id;

  INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
  VALUES (v_user_id, 'rent', -COALESCE(v_rental.rent_amount, 0), 'House rent payment ' || p_rental_id, now()),
         (v_rental.landlord_user_id, 'rent_income', COALESCE(v_rental.rent_amount, 0), 'House rent income ' || p_rental_id, now());

  INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read, created_at)
  VALUES (
    v_rental.landlord_user_id,
    'rent_paid',
    'Rent Paid',
    'A tenant paid house rent.',
    jsonb_build_object('rental_id', p_rental_id, 'tenant_id', v_user_id, 'route', '/living?tab=tenants'),
    false,
    now()
  );

  RETURN jsonb_build_object('success', true, 'total_paid', COALESCE(v_rental.rent_amount, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_rent_due_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_row record;
  v_due_date date;
BEGIN
  FOR v_row IN
    SELECT l.id AS lease_id, l.tenant_id, l.rent_due_day, l.last_rent_paid_at, l.start_date,
           p.owner_id AS landlord_id, p.name AS property_name
    FROM public.leases l
    JOIN public.properties p ON p.id = l.property_id
    WHERE l.status = 'active'
  LOOP
    v_due_date := public.next_monthly_rent_due_date(v_row.rent_due_day, v_row.last_rent_paid_at, v_row.start_date);
    IF v_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7 THEN
      INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read, created_at)
      VALUES (
        v_row.tenant_id,
        'rent_due',
        'Rent Due Soon',
        'Your rent for ' || COALESCE(v_row.property_name, 'your home') || ' is due on ' || to_char(v_due_date, 'YYYY-MM-DD') || '.',
        jsonb_build_object('lease_id', v_row.lease_id, 'due_date', v_due_date, 'route', '/living?tab=my_lease'),
        false,
        now()
      );

      IF v_row.landlord_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read, created_at)
        VALUES (
          v_row.landlord_id,
          'rent_due_landlord',
          'Tenant Rent Due Soon',
          'A tenant rent payment is due on ' || to_char(v_due_date, 'YYYY-MM-DD') || '.',
          jsonb_build_object('lease_id', v_row.lease_id, 'due_date', v_due_date, 'route', '/living?tab=tenants'),
          false,
          now()
        );
      END IF;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'queued', v_count);
END;
$$;

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

  -- Only update order status if not already shipped (avoid overwriting shipped_at)
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
    -- Just update tracking info for already-shipped orders
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

CREATE INDEX IF NOT EXISTS idx_leases_tenant_status_due
  ON public.leases(tenant_id, status, rent_due_day, last_rent_paid_at);

CREATE INDEX IF NOT EXISTS idx_house_rentals_tenant_due
  ON public.house_rentals(tenant_user_id, status, next_due_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
  ON public.notifications(user_id, is_read, created_at DESC)
  WHERE COALESCE(is_dismissed, false) = false;

CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_buyer_created
  ON public.marketplace_purchases(buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_seller_created
  ON public.marketplace_purchases(seller_id, created_at DESC);

GRANT EXECUTE ON FUNCTION public.next_monthly_rent_due_date(integer, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_rent(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_house_rent(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.queue_rent_due_notifications() TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_marketplace_order(uuid, text, text, timestamptz) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
