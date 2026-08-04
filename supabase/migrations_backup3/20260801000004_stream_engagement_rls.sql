-- RLS Policies for stream_engagement
ALTER TABLE public.stream_engagement ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read engagement for streams they can view
CREATE POLICY stream_engagement_select ON public.stream_engagement
    FOR SELECT
    TO authenticated
    USING (true);

-- Only server-side RPCs can insert engagement rows
CREATE POLICY stream_engagement_insert ON public.stream_engagement
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

-- Only server-side RPCs can update engagement rows
CREATE POLICY stream_engagement_update ON public.stream_engagement
    FOR UPDATE
    TO authenticated
    WITH CHECK (false);

-- No direct deletes
CREATE POLICY stream_engagement_delete ON public.stream_engagement
    FOR DELETE
    TO authenticated
    USING (false);

-- RLS Policies for stream_engagement_users
ALTER TABLE public.stream_engagement_users ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own engagement user rows
CREATE POLICY stream_engagement_users_select ON public.stream_engagement_users
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Only server-side RPCs can insert
CREATE POLICY stream_engagement_users_insert ON public.stream_engagement_users
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

-- Only server-side RPCs can update
CREATE POLICY stream_engagement_users_update ON public.stream_engagement_users
    FOR UPDATE
    TO authenticated
    WITH CHECK (false);

-- No direct deletes
CREATE POLICY stream_engagement_users_delete ON public.stream_engagement_users
    FOR DELETE
    TO authenticated
    USING (false);