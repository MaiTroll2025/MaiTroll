-- Comprehensive Admin Notifications Triggers
-- This migration adds triggers to cover "everything that happens" as requested.
-- Priorities:
-- Critical/High (Red): Kick, Ban, Report, Fine (Punishment)
-- Normal: Cash Purchase, Item Purchase, Payout Request

-- Ensure notify_admins function exists (from previous migration)
-- If not, we recreate it here just in case (idempotent-ish)
CREATE OR REPLACE FUNCTION public.notify_admins(
    p_type text,
    p_title text,
    p_message text,
    p_metadata jsonb DEFAULT '{}'::jsonb,
    p_priority text DEFAULT 'normal'
) RETURNS void AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, metadata, priority)
    SELECT id, p_type, p_title, p_message, p_metadata, p_priority
    FROM public.user_profiles
    WHERE role = 'admin' OR is_admin = true;
END; $$ LANGUAGE plpgsql;

-- 1. User Profile Changes (Kick/Ban) - High/Critical
CREATE OR REPLACE FUNCTION notify_user_profile_changes() RETURNS TRIGGER AS $$
BEGIN
    -- Check for Ban
    IF NEW.is_banned = true AND (OLD.is_banned = false OR OLD.is_banned IS NULL) THEN
        PERFORM public.notify_admins(
            'moderation',
            'User Banned',
            'User ' || NEW.username || ' has been BANNED.',
            jsonb_build_object('user_id', NEW.id, 'username', NEW.username),
            'critical'
        );
    END IF;

    -- Check for Kick
    IF NEW.is_kicked = true AND (OLD.is_kicked = false OR OLD.is_kicked IS NULL) THEN
        PERFORM public.notify_admins(
            'moderation',
            'User Kicked',
            'User ' || NEW.username || ' has been KICKED.',
            jsonb_build_object('user_id', NEW.id, 'username', NEW.username),
            'high'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_profile_changes ON public.user_profiles;
CREATE TRIGGER on_user_profile_changes
    AFTER UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION notify_user_profile_changes();

-- 2. Stream Reports - High
CREATE OR REPLACE FUNCTION notify_stream_report() RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.notify_admins(
        'moderation',
        'New Stream Report',
        'A stream has been reported. Reason: ' || NEW.reason,
        jsonb_build_object('report_id', NEW.id, 'stream_id', NEW.stream_id),
        'high'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_stream_report ON public.stream_reports;
CREATE TRIGGER on_stream_report
    AFTER INSERT ON public.stream_reports
    FOR EACH ROW
    EXECUTE FUNCTION notify_stream_report();

-- 3. Abuse Reports - High
-- Check if table exists dynamically to avoid errors if not applied yet, but we assume it exists based on search
CREATE OR REPLACE FUNCTION notify_abuse_report() RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.notify_admins(
        'moderation',
        'New Abuse Report',
        'Abuse report submitted. Reason: ' || NEW.reason || ' (Severity: ' || NEW.severity || ')',
        jsonb_build_object('report_id', NEW.id, 'offender_id', NEW.offender_user_id),
        'high'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_abuse_report ON public.abuse_reports;
CREATE TRIGGER on_abuse_report
    AFTER INSERT ON public.abuse_reports
    FOR EACH ROW
    EXECUTE FUNCTION notify_abuse_report();

-- 4. Punishment Transactions - High
CREATE OR REPLACE FUNCTION notify_punishment() RETURNS TRIGGER AS $$
DECLARE
    v_username text;
BEGIN
    SELECT username INTO v_username FROM public.user_profiles WHERE id = NEW.user_id;
    
    PERFORM public.notify_admins(
        'moderation',
        'User Punished (Fine)',
        'User ' || COALESCE(v_username, 'Unknown') || ' was fined ' || NEW.coins_deducted || ' coins. Reason: ' || NEW.reason,
        jsonb_build_object('transaction_id', NEW.id, 'user_id', NEW.user_id),
        'high'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_punishment ON public.punishment_transactions;
CREATE TRIGGER on_punishment
    AFTER INSERT ON public.punishment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION notify_punishment();

-- 5. Paypal Transactions (Real Money) - Normal
CREATE OR REPLACE FUNCTION notify_paypal_transaction() RETURNS TRIGGER AS $$
DECLARE
    v_username text;
BEGIN
    -- Only notify on completed
    IF NEW.status IN ('completed', 'credited') THEN
        SELECT username INTO v_username FROM public.user_profiles WHERE id = NEW.user_id;
        
        PERFORM public.notify_admins(
            'purchase',
            'New Cash Purchase',
            'User ' || COALESCE(v_username, 'Unknown') || ' purchased ' || NEW.coins || ' coins for $' || NEW.amount,
            jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount),
            'normal'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_paypal_transaction ON public.paypal_transactions;
CREATE TRIGGER on_paypal_transaction
    AFTER INSERT OR UPDATE ON public.paypal_transactions
    FOR EACH ROW
    EXECUTE FUNCTION notify_paypal_transaction();

-- 6. Payout Requests - Normal
CREATE OR REPLACE FUNCTION notify_payout_request() RETURNS TRIGGER AS $$
DECLARE
    v_username text;
BEGIN
    SELECT username INTO v_username FROM public.user_profiles WHERE id = NEW.user_id;

    PERFORM public.notify_admins(
        'finance',
        'New Payout Request',
        'User ' || COALESCE(v_username, 'Unknown') || ' requested payout of $' || NEW.cash_amount,
        jsonb_build_object('request_id', NEW.id, 'amount', NEW.cash_amount),
        'normal'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_payout_request ON public.payout_requests;
CREATE TRIGGER on_payout_request
    AFTER INSERT ON public.payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_payout_request();

-- 7. Item Purchases (User Purchases) - Normal
CREATE OR REPLACE FUNCTION notify_item_purchase() RETURNS TRIGGER AS $$
DECLARE
    v_username text;
BEGIN
    SELECT username INTO v_username FROM public.user_profiles WHERE id = NEW.user_id;

    PERFORM public.notify_admins(
        'purchase',
        'New Item Purchase',
        'User ' || COALESCE(v_username, 'Unknown') || ' bought ' || NEW.item_name || ' (' || NEW.item_type || ')',
        jsonb_build_object('purchase_id', NEW.id, 'item_name', NEW.item_name),
        'normal'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_item_purchase ON public.user_purchases;
CREATE TRIGGER on_item_purchase
    AFTER INSERT ON public.user_purchases
    FOR EACH ROW
    EXECUTE FUNCTION notify_item_purchase();
