-- Migration: Add payout request notification trigger for assistants
-- This triggers when a new payout_request is inserted and notifies
-- users with roles 'ceo_assistant' and 'noah_assistant'

-- First, create a function to send notifications to assistants
CREATE OR REPLACE FUNCTION public.notify_assistants_on_payout_request()
RETURNS TRIGGER AS $$
DECLARE
    v_assistant RECORD;
    v_notification_title TEXT;
    v_notification_message TEXT;
    v_username TEXT;
BEGIN
    -- Only trigger on INSERT (new payout request)
    IF TG_OP <> 'INSERT' THEN
        RETURN NEW;
    END IF;

    -- Get the username of the requester
    SELECT username INTO v_username FROM public.user_profiles WHERE id = NEW.user_id;

    -- Find all active CEO Assistants and Noah Assistants
    FOR v_assistant IN
        SELECT id FROM public.user_profiles
        WHERE role IN ('ceo_assistant', 'noah_assistant')
          AND is_banned = false
    LOOP
        v_notification_title := 'New Payout Request Submitted';
        v_notification_message := format(
            'User %s has submitted a payout request for $%s (%s coins). Review at /admin/payouts-by-assistant',
            COALESCE(v_username, NEW.user_id::text),
            NEW.cash_amount,
            NEW.coin_amount
        );

        -- Insert notification for each assistant
        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            read,
            created_at,
            metadata
        ) VALUES (
            v_assistant.id,
            v_notification_title,
            v_notification_message,
            'payout_request',
            false,
            NOW(),
            jsonb_build_object(
                'payout_request_id', NEW.id,
                'user_id', NEW.user_id,
                'cash_amount', NEW.cash_amount,
                'coin_amount', NEW.coin_amount,
                'provider_type', NEW.provider_type,
                'provider_username', NEW.provider_username
            )
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_notify_assistants_on_payout_request ON public.payout_requests;

-- Create trigger on payout_requests table
CREATE TRIGGER trigger_notify_assistants_on_payout_request
    AFTER INSERT ON public.payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_assistants_on_payout_request();