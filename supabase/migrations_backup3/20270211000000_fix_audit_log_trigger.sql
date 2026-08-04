-- Fix audit_logs usage in log_paypal_email_change trigger
-- Previously it tried to use non-existent columns entity_type, entity_id, metadata

CREATE OR REPLACE FUNCTION log_paypal_email_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.payout_paypal_email IS DISTINCT FROM NEW.payout_paypal_email THEN
        INSERT INTO audit_logs (user_id, action, target_id, details)
        VALUES (
            auth.uid(), -- user changing their own, or admin changing it
            'update_paypal_email',
            NEW.id,
            jsonb_build_object(
                'old_email', OLD.payout_paypal_email, 
                'new_email', NEW.payout_paypal_email,
                'entity_type', 'user_profile'
            )
        );
        NEW.payout_paypal_email_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
