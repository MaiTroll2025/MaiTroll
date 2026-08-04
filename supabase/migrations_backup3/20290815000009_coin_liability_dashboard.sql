-- ============================================================
-- Coin Liability Dashboard — Migration
-- Adds indexes, views, and RPC support for the Secretary
-- Coin Liability and User Balance Dashboard.
-- ============================================================

-- ============================================================
-- 1. Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_coin_ledger_user_id ON public.coin_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_ledger_created_at ON public.coin_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_coin_ledger_bucket ON public.coin_ledger(bucket);
CREATE INDEX IF NOT EXISTS idx_coin_ledger_source ON public.coin_ledger(source);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);

CREATE INDEX IF NOT EXISTS idx_gift_transactions_sender_id ON public.gift_transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_recipient_id ON public.gift_transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_created_at ON public.gift_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON public.payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created_at ON public.payout_requests(created_at);

-- ============================================================
-- 2. Materialized view for coin liability summary
-- ============================================================

CREATE OR REPLACE VIEW public.coin_liability_summary AS
WITH cashable_breakdown AS (
    SELECT
        cl.user_id,
        COALESCE(SUM(CASE WHEN cl.bucket = 'paid' AND cl.source != 'refund' AND cl.source != 'reversal' AND cl.source != 'fraud' AND cl.source != 'self_gift' AND cl.is_active = true THEN cl.delta ELSE 0 END), 0) AS cashable_earned,
        COALESCE(SUM(CASE WHEN cl.bucket = 'paid' AND cl.source = 'coin_purchase' AND cl.is_active = true THEN cl.delta ELSE 0 END), 0) AS purchased_spending,
        COALESCE(SUM(CASE WHEN cl.bucket = 'promo' AND cl.source NOT IN ('mayor_promo') AND cl.is_active = true THEN cl.delta ELSE 0 END), 0) AS promotional_coins,
        COALESCE(SUM(CASE WHEN cl.bucket = 'promo' AND cl.source = 'mayor_promo' AND cl.is_active = true THEN cl.delta ELSE 0 END), 0) AS mayor_promo_coins,
        COALESCE(SUM(CASE WHEN cl.bucket = 'test' AND cl.is_active = true THEN cl.delta ELSE 0 END), 0) AS test_coins,
        COALESCE(SUM(CASE WHEN cl.is_active = false AND cl.delta > 0 THEN cl.delta ELSE 0 END), 0) AS pending_coins,
        COALESCE(SUM(CASE WHEN cl.source IN ('refund', 'reversal', 'fraud') AND cl.is_active = false THEN cl.delta ELSE 0 END), 0) AS reversed_coins,
        COALESCE(SUM(CASE WHEN cl.source = 'cashed_out' AND cl.is_active = false THEN cl.delta ELSE 0 END), 0) AS already_cashed_out
    FROM public.coin_ledger cl
    GROUP BY cl.user_id
),
gift_summary AS (
    SELECT
        gt.receiver_id AS user_id,
        COUNT(*) AS total_gifts_received,
        SUM(gt.coins_spent * gt.quantity) AS total_gift_coins
    FROM public.gift_transactions gt
    GROUP BY gt.receiver_id
),
purchase_summary AS (
    SELECT
        t.user_id,
        COUNT(*) AS total_purchases,
        SUM(CASE WHEN t.type = 'coin_purchase' THEN t.amount ELSE 0 END) AS total_purchased_coins
    FROM public.transactions t
    WHERE t.type = 'coin_purchase'
    GROUP BY t.user_id
),
send_summary AS (
    SELECT
        t.user_id,
        COUNT(*) AS total_sent,
        SUM(CASE WHEN t.type = 'send' THEN t.amount ELSE 0 END) AS total_sent_coins
    FROM public.transactions t
    WHERE t.type = 'send'
    GROUP BY t.user_id
),
payout_summary AS (
    SELECT
        pr.user_id,
        COUNT(*) AS total_payouts,
        SUM(CASE WHEN pr.status = 'paid' THEN pr.coin_amount ELSE 0 END) AS total_paid_coins,
        SUM(CASE WHEN pr.status = 'pending' THEN pr.coin_amount ELSE 0 END) AS pending_payout_coins,
        SUM(CASE WHEN pr.status = 'approved' THEN pr.coin_amount ELSE 0 END) AS approved_unpaid_coins
    FROM public.payout_requests pr
    GROUP BY pr.user_id
)
SELECT
    up.id AS user_id,
    up.username,
    up.user_tag,
    up.role,
    up.is_active,
    COALESCE(cb.cashable_earned, 0) AS cashable_earned_coins,
    COALESCE(cb.purchased_spending, 0) AS purchased_spending_coins,
    COALESCE(cb.promotional_coins, 0) AS promotional_coins,
    COALESCE(cb.mayor_promo_coins, 0) AS mayor_promo_coins,
    COALESCE(cb.test_coins, 0) AS test_coins,
    COALESCE(cb.pending_coins, 0) AS pending_coins,
    COALESCE(cb.reversed_coins, 0) AS reversed_coins,
    COALESCE(cb.already_cashed_out, 0) AS already_cashed_out_coins,
    COALESCE(cb.cashable_earned, 0) - COALESCE(cb.already_cashed_out, 0) - COALESCE(cb.pending_coins, 0) AS cashable_coin_balance,
    COALESCE(cb.promotional_coins, 0) + COALESCE(cb.mayor_promo_coins, 0) + COALESCE(cb.test_coins, 0) AS non_cashable_coin_balance,
    COALESCE(gs.total_gifts_received, 0) AS total_gifts_received,
    COALESCE(ps.total_purchased_coins, 0) AS total_purchased_coins,
    COALESCE(ss.total_sent_coins, 0) AS total_coins_sent,
    COALESCE(payout.total_paid_coins, 0) AS total_paid_out,
    COALESCE(payout.pending_payout_coins, 0) AS pending_payout_coins,
    COALESCE(payout.approved_unpaid_coins, 0) AS approved_unpaid_payout_coins,
    up.created_at,
    up.updated_at
FROM public.user_profiles up
LEFT JOIN cashable_breakdown cb ON cb.user_id = up.id
LEFT JOIN gift_summary gs ON gs.user_id = up.id
LEFT JOIN purchase_summary ps ON ps.user_id = up.id
LEFT JOIN send_summary ss ON ss.user_id = up.id
LEFT JOIN payout_summary payout ON payout.user_id = up.id
WHERE up.role NOT IN ('troller');

CREATE INDEX IF NOT EXISTS idx_coin_liability_summary_user_id ON public.coin_liability_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_liability_summary_cashable ON public.coin_liability_summary(cashable_coin_balance);

-- ============================================================
-- 3. Coin liability alerts table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coin_liability_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'cashout_threshold_reached',
        'cashout_tier_reached',
        'high_balance',
        'multiple_large_gifts',
        'payout_requested',
        'pending_payout_too_long',
        'approved_payout_unpaid',
        'balance_mismatch',
        'non_cashable_source',
        'refund_affects_gifted',
        'potential_self_gifting',
        'coordinated_manipulation'
    )),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed', 'escalated')),
    handled_by UUID REFERENCES public.user_profiles(id),
    handled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_liability_alerts_user_id ON public.coin_liability_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_liability_alerts_status ON public.coin_liability_alerts(status);
CREATE INDEX IF NOT EXISTS idx_coin_liability_alerts_type ON public.coin_liability_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_coin_liability_alerts_created_at ON public.coin_liability_alerts(created_at);

-- ============================================================
-- 4. RLS for coin_liability_alerts
-- ============================================================

ALTER TABLE public.coin_liability_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS coin_liability_alerts_select_authorized
    ON public.coin_liability_alerts
    FOR SELECT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
            AND (
                up.role IN ('admin', 'owner', 'ceo', 'secretary', 'executive_secretary', 'troll_city_secretary', 'troll_city_treasurer')
                OR up.is_admin = true
                OR up.is_superadmin = true
                OR up.is_staff = true
            )
        )
    );

CREATE POLICY IF NOT EXISTS coin_liability_alerts_update_authorized
    ON public.coin_liability_alerts
    FOR UPDATE
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
            AND (
                up.role IN ('admin', 'owner', 'ceo', 'secretary', 'executive_secretary', 'troll_city_secretary', 'troll_city_treasurer')
                OR up.is_admin = true
                OR up.is_superadmin = true
                OR up.is_staff = true
            )
        )
    );

-- ============================================================
-- 5. Grant execute on new RPC functions
-- ============================================================

GRANT SELECT ON public.coin_liability_summary TO authenticated;
GRANT SELECT ON public.coin_liability_alerts TO authenticated;