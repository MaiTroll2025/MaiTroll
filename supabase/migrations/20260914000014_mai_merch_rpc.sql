-- Migration: MaiTroll Merch Store RPC
-- Adds create_merch_order function for secure order creation

BEGIN;

CREATE OR REPLACE FUNCTION public.create_merch_order(
    p_product_ids UUID[],
    p_shipping_address JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_total NUMERIC(10,2) := 0;
    v_order_id UUID;
    v_stock INTEGER;
    v_item_price NUMERIC(10,2);
    v_active_count INTEGER;
    v_result JSONB;
    v_product_id UUID;
BEGIN
    -- Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Validate input
    IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL OR array_length(p_product_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No products selected');
    END IF;

    -- Check all products exist and are active
    SELECT COUNT(*) INTO v_active_count
    FROM public.mai_merch_products
    WHERE id = ANY(p_product_ids) AND is_active = true;

    IF v_active_count != array_length(p_product_ids, 1) THEN
        RETURN jsonb_build_object('success', false, 'error', 'One or more products not available');
    END IF;

    -- Check stock availability and calculate total
    v_total := 0;
    FOREACH v_product_id IN ARRAY p_product_ids
    LOOP
        SELECT stock_quantity, price_usd INTO v_stock, v_item_price
        FROM public.mai_merch_products
        WHERE id = v_product_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Product not found');
        END IF;

        IF v_stock < 1 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Product out of stock');
        END IF;

        v_total := v_total + v_item_price;
    END LOOP;

    -- Create order
    INSERT INTO public.mai_merch_orders (user_id, total_amount, shipping_address)
    VALUES (v_user_id, v_total, p_shipping_address)
    RETURNING id INTO v_order_id;

    -- Insert order items and deduct stock
    FOREACH v_product_id IN ARRAY p_product_ids
    LOOP
        SELECT price_usd INTO v_item_price
        FROM public.mai_merch_products
        WHERE id = v_product_id;

        INSERT INTO public.mai_merch_order_items (order_id, product_id, quantity, unit_price)
        VALUES (v_order_id, v_product_id, 1, v_item_price);

        UPDATE public.mai_merch_products
        SET stock_quantity = stock_quantity - 1
        WHERE id = v_product_id;
    END LOOP;

    -- Build result
    SELECT jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'total_amount', v_total,
        'status', 'pending'
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_merch_order(UUID[], JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_merch_order(UUID[], JSONB) IS 'Create a MaiTroll merchandise order with stock deduction. Isolated from MAI Business merchandise.';

COMMIT;
