-- Create views for Economy Dashboard based on paypal_transactions
-- This replaces the usage of empty tables admin_coin_revenue and admin_top_buyers

-- View for Monthly Revenue
CREATE OR REPLACE VIEW view_admin_coin_revenue WITH (security_invoker = true) AS
SELECT
    date_trunc('month', created_at) as month,
    SUM(amount) as total_usd,
    SUM(coins) as total_coins,
    COUNT(*) as purchase_count
FROM
    paypal_transactions
WHERE
    status IN ('completed', 'credited')
GROUP BY
    1
ORDER BY
    1 DESC;

-- View for Top Buyers
CREATE OR REPLACE VIEW view_admin_top_buyers WITH (security_invoker = true) AS
SELECT
    pt.user_id,
    up.username,
    SUM(pt.amount) as total_spent_usd,
    SUM(pt.coins) as total_coins_bought,
    COUNT(*) as transaction_count
FROM
    paypal_transactions pt
JOIN
    user_profiles up ON pt.user_id = up.id
WHERE
    pt.status IN ('completed', 'credited')
GROUP BY
    pt.user_id, up.username
ORDER BY
    total_spent_usd DESC;

-- Grant permissions
GRANT SELECT ON view_admin_coin_revenue TO authenticated;
GRANT SELECT ON view_admin_top_buyers TO authenticated;
GRANT SELECT ON view_admin_coin_revenue TO service_role;
GRANT SELECT ON view_admin_top_buyers TO service_role;
