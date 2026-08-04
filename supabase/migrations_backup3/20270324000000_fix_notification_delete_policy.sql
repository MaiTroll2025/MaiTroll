-- Fix: Allow users to delete their own notifications
-- Previously, users could only view or update (mark as read) notifications, but not delete them.

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);
