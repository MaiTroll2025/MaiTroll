CREATE TABLE IF NOT EXISTS public.bank_feature_flags (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    is_enabled boolean DEFAULT false,
    description text,
    updated_at timestamptz DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.bank_feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users (server and client)
CREATE POLICY "Allow read access for authenticated users" ON public.bank_feature_flags
    FOR SELECT TO authenticated USING (true);

-- Only admins/service_role can write
CREATE POLICY "Allow write access for admins" ON public.bank_feature_flags
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
        )
    );

-- Insert default flags
INSERT INTO public.bank_feature_flags (key, value, is_enabled, description)
VALUES 
    ('gift_repayment_enabled', '{"percentage": 50}'::jsonb, false, 'If true, gifted coins trigger loan repayment')
ON CONFLICT (key) DO NOTHING;
