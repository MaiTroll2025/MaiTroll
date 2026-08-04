-- Create table for tracking dismissed support goal reminders
-- Date: 2026-05-26 00:00:01

CREATE TABLE IF NOT EXISTS public.support_goal_reminder_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    broadcaster_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stream_id UUID NULL REFERENCES streams(id) ON DELETE SET NULL,
    cashout_tier INTEGER NOT NULL,
    dismissed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.support_goal_reminder_dismissals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own dismissals"
    ON public.support_goal_reminder_dismissals
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = viewer_user_id);

CREATE POLICY "Users can view their own dismissals"
    ON public.support_goal_reminder_dismissals
    FOR SELECT
    TO authenticated
    USING (auth.uid() = viewer_user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_goal_reminder_dismissals_viewer_broadcaster
    ON public.support_goal_reminder_dismissals (viewer_user_id, broadcaster_user_id);

CREATE INDEX IF NOT EXISTS idx_support_goal_reminder_dismissals_viewer_stream
    ON public.support_goal_reminder_dismissals (viewer_user_id, stream_id);

-- Grant permissions
GRANT ALL ON TABLE public.support_goal_reminder_dismissals TO service_role;
GRANT SELECT, INSERT ON TABLE public.support_goal_reminder_dismissals TO authenticated;