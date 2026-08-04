-- Mobile Error Logs Table
CREATE TABLE IF NOT EXISTS public.mobile_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    page_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.mobile_error_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert logs (their own errors)
CREATE POLICY "Users can insert mobile error logs" ON public.mobile_error_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow admins to view all logs
CREATE POLICY "Admins can view mobile error logs" ON public.mobile_error_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
        )
    );

-- Allow admins to delete logs (cleanup)
CREATE POLICY "Admins can delete mobile error logs" ON public.mobile_error_logs
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
        )
    );
