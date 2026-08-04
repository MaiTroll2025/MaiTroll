-- Migration: Add triggers for Push Notifications (Messages & Payouts)
-- This ensures that events create 'notifications' records, which can trigger Webhooks.

-- 1. Trigger for Private Messages (conversation_messages)
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recipient_id UUID;
    v_sender_username TEXT;
BEGIN
    -- Find the recipient (the other member of the conversation)
    SELECT user_id INTO v_recipient_id
    FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
    LIMIT 1;

    IF v_recipient_id IS NOT NULL THEN
        -- Get sender username
        SELECT username INTO v_sender_username
        FROM public.user_profiles
        WHERE id = NEW.sender_id;

        -- Insert notification
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            metadata,
            created_at,
            is_read
        ) VALUES (
            v_recipient_id,
            'message.new',
            'New Message',
            COALESCE(v_sender_username, 'Someone') || ' sent you a message',
            jsonb_build_object(
                'conversation_id', NEW.conversation_id,
                'sender_id', NEW.sender_id,
                'url', '/messages/' || NEW.conversation_id
            ),
            NOW(),
            FALSE
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_new_message_notification ON public.conversation_messages;
CREATE TRIGGER trigger_new_message_notification
    AFTER INSERT ON public.conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_message_notification();


-- 2. Enhanced Trigger for Payout Requests (Notifies Admins AND Secretaries)
-- Replaces notify_payout_request from unified_actionable_notifications.sql

CREATE OR REPLACE FUNCTION public.notify_payout_request() RETURNS TRIGGER AS $$
DECLARE
    v_username text;
    v_secretary_id UUID;
    v_amount numeric;
BEGIN
    SELECT username INTO v_username FROM public.user_profiles WHERE id = NEW.user_id;
    
    -- Handle potential column name differences (usd_value vs cash_amount)
    -- We'll assume usd_value exists based on recent schema checks, but fallback to 0 if null
    v_amount := COALESCE(NEW.usd_value, 0);

    -- 1. Notify Admins (Finance) - existing logic
    PERFORM public.notify_admins(
        'finance',
        'New Payout Request',
        'User ' || COALESCE(v_username, 'Unknown') || ' requested payout of $' || v_amount, 
        jsonb_build_object(
            'request_id', NEW.id,
            'amount', v_amount,
            'action_url', '/admin/finance?tab=payouts&id=' || NEW.id
        ),
        'normal'
    );

    -- 2. Notify Secretaries
    FOR v_secretary_id IN 
        SELECT id FROM public.user_profiles WHERE role = 'secretary'
    LOOP
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            metadata,
            created_at,
            is_read
        ) VALUES (
            v_secretary_id,
            'payout.request',
            'New Payout Request',
            'User ' || COALESCE(v_username, 'Unknown') || ' requested a payout.',
            jsonb_build_object(
                'request_id', NEW.id,
                'user_id', NEW.user_id,
                'url', '/secretary' 
            ),
            NOW(),
            FALSE
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists (in case it was dropped or not created)
DROP TRIGGER IF EXISTS notify_payout_request_trigger ON public.cashout_requests;
CREATE TRIGGER notify_payout_request_trigger
    AFTER INSERT ON public.cashout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_payout_request();
