-- Ensure support_tickets table exists with all required columns
-- This migration creates the table if it doesn't exist

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username text,
    email text,
    category text NOT NULL DEFAULT 'general',
    subject text NOT NULL,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'open',
    priority text DEFAULT 'normal',
    created_at timestamptz NOT NULL DEFAULT now(),
    admin_response text,
    admin_id uuid REFERENCES auth.users(id),
    response_at timestamptz,
    resolved_at timestamptz,
    closed_at timestamptz
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users read own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users create tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Staff manage tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can update all tickets" ON public.support_tickets;

-- Create RLS policies
CREATE POLICY "Users read own tickets" ON public.support_tickets
    FOR SELECT USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (is_admin = true OR role = 'admin' OR is_troll_officer = true OR role = 'troll_officer' OR is_lead_officer = true OR role = 'lead_troll_officer' OR role = 'secretary')
    ));

CREATE POLICY "Users create tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff manage tickets" ON public.support_tickets
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (is_admin = true OR role = 'admin' OR is_troll_officer = true OR role = 'troll_officer' OR is_lead_officer = true OR role = 'lead_troll_officer' OR role = 'secretary')
    ));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE 'Support tickets table setup complete';
END $$;
