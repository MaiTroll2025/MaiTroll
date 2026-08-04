
-- Fix streams table: Add last_ping if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'last_ping') THEN 
        ALTER TABLE public.streams ADD COLUMN last_ping TIMESTAMPTZ DEFAULT NOW(); 
    END IF; 
END $$;

-- Fix court_cases table: Add severity if missing
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_cases' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'severity') THEN 
            ALTER TABLE public.court_cases ADD COLUMN severity TEXT DEFAULT 'Low'; 
        END IF; 
    END IF;
END $$;

-- Create banned_users table if not exists
CREATE TABLE IF NOT EXISTS public.banned_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    banned_at TIMESTAMPTZ DEFAULT NOW(),
    banned_until TIMESTAMPTZ,
    reason TEXT,
    banned_by UUID,
    details TEXT
);

-- Add Foreign Keys if they don't exist (to avoid errors if table already existed but without FKs)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'banned_users_user_id_fkey') THEN 
        ALTER TABLE public.banned_users ADD CONSTRAINT banned_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id); 
    END IF; 
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'banned_users_banned_by_fkey') THEN 
        ALTER TABLE public.banned_users ADD CONSTRAINT banned_users_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.user_profiles(id); 
    END IF; 
END $$;

-- Enable RLS
ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage banned_users" ON public.banned_users;
DROP POLICY IF EXISTS "Users can view own bans" ON public.banned_users;

-- Recreate Policies
CREATE POLICY "Admins can manage banned_users" ON public.banned_users
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view own bans" ON public.banned_users
    FOR SELECT
    USING (auth.uid() = user_id);

-- Ensure get_banned_users RPC exists or works with this table
-- (Assuming the RPC logic matches this table structure or we need to create it)
CREATE OR REPLACE FUNCTION public.get_banned_users()
RETURNS TABLE (
    id UUID,
    username TEXT,
    email TEXT,
    is_banned BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.username,
        au.email::TEXT,
        TRUE as is_banned
    FROM public.banned_users bu
    JOIN public.user_profiles up ON bu.user_id = up.id
    LEFT JOIN auth.users au ON up.id = au.id
    WHERE bu.banned_until IS NULL OR bu.banned_until > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
