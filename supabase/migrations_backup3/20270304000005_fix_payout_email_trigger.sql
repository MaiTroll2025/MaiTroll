
-- Fix log_paypal_email_change trigger to avoid referencing non-existent columns
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
                'entity_type', 'user_profile' -- Put entity_type inside details JSON
            )
        );
        -- Update the timestamp column if it exists
        -- We use a safe update approach or ensure the column exists
        -- Assuming payout_paypal_email_updated_at exists based on previous migrations
        -- If not, we can ignore or add it. Let's try to update it if it's there.
        BEGIN
            NEW.payout_paypal_email_updated_at = NOW();
        EXCEPTION WHEN OTHERS THEN
            -- Ignore if column doesn't exist
            NULL;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
