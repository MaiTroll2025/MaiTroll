-- Fix duplicate notifications
-- Drop the redundant message notification trigger that was creating duplicates
-- The correct trigger is handle_new_message_notification from 20270323000001

DROP TRIGGER IF EXISTS trigger_new_message_notification ON public.conversation_messages;
-- Recreate the correct one (will be recreated by original migration if needed)
-- But we need to ensure only one exists

-- Also check for duplicate payout notifications
-- There are two definitions: one in 20270323000001 (notify_payout_request) and one in 20270326000000 (handle_new_payout_notification)
-- They might be on different tables: cashout_requests vs payout_requests? Let's check:
-- The first uses cashout_requests; the second uses payout_requests.
-- That may be okay if both tables exist. But to avoid confusion, we keep both if they are on different tables.

-- However, to be safe, we will not drop anything else until verified.