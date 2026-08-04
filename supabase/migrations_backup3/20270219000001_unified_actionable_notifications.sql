-- Unified Actionable Notifications
-- Ensures all key notifications have 'action_url' in metadata for deep-linking.

-- 1. Payout Requests (Admin)
CREATE OR REPLACE FUNCTION notify_payout_request() RETURNS TRIGGER AS $$
DECLARE
    v_username text;
BEGIN
    SELECT username INTO v_username FROM public.user_profiles WHERE id = NEW.user_id;

    PERFORM public.notify_admins(
        'finance',
        'New Payout Request',
        'User ' || COALESCE(v_username, 'Unknown') || ' requested payout of $' || NEW.cash_amount,
        jsonb_build_object(
            'request_id', NEW.id,
            'amount', NEW.cash_amount,
            'action_url', '/admin/finance?tab=payouts&id=' || NEW.id
        ),
        'normal'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Stream Reports (Admin)
CREATE OR REPLACE FUNCTION notify_stream_report() RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.notify_admins(
        'moderation',
        'New Stream Report',
        'A stream has been reported. Reason: ' || NEW.reason,
        jsonb_build_object(
            'report_id', NEW.id,
            'stream_id', NEW.stream_id,
            'action_url', '/admin/moderation?tab=reports&id=' || NEW.id
        ),
        'high'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Support Tickets (Admin)
-- Check if table exists first to avoid errors
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_tickets') THEN
        CREATE OR REPLACE FUNCTION public.trigger_notify_admin_ticket()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $inner$
        DECLARE
            v_username TEXT;
        BEGIN
            SELECT username INTO v_username FROM public.user_profiles WHERE id = NEW.user_id;
            
            PERFORM public.notify_admins(
                'support_ticket',
                'New Support Ticket',
                COALESCE(v_username, 'User') || ' submitted a ticket: ' || NEW.type,
                jsonb_build_object(
                    'ticket_id', NEW.id,
                    'user_id', NEW.user_id,
                    'action_url', '/admin/support?id=' || NEW.id
                ),
                'normal'
            );
            RETURN NEW;
        END;
        $inner$;
    END IF;
END $$;

-- 4. Follower Notification (User)
-- "if a user is broadcasting and they follow someone, that follower gets a notification and when clicked goes to that broadcast"
CREATE OR REPLACE FUNCTION notify_new_follower_actionable() RETURNS TRIGGER AS $$
DECLARE
    v_follower_username TEXT;
    v_is_live BOOLEAN;
    v_stream_id UUID;
    v_action_url TEXT;
    v_message TEXT;
BEGIN
    SELECT username INTO v_follower_username FROM public.user_profiles WHERE id = NEW.follower_id;
    
    -- Check if follower is live
    SELECT TRUE, id INTO v_is_live, v_stream_id 
    FROM public.streams 
    WHERE user_id = NEW.follower_id AND status = 'live' 
    LIMIT 1;

    IF v_is_live THEN
        v_action_url := '/stream/' || v_follower_username;
        v_message := v_follower_username || ' followed you and is LIVE now!';
    ELSE
        v_action_url := '/profile/' || v_follower_username;
        v_message := v_follower_username || ' followed you.';
    END IF;

    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        metadata,
        priority
    ) VALUES (
        NEW.following_id, -- The person being followed
        'new_follower',
        'New Follower',
        v_message,
        jsonb_build_object(
            'follower_id', NEW.follower_id,
            'is_live', v_is_live,
            'stream_id', v_stream_id,
            'action_url', v_action_url
        ),
        'normal'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to user_follows table
DROP TRIGGER IF EXISTS on_new_follower_actionable ON public.user_follows;
CREATE TRIGGER on_new_follower_actionable
    AFTER INSERT ON public.user_follows
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_follower_actionable();
