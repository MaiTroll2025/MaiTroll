-- Add terms_accepted to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;

-- Create troll_wars_tasks if it doesn't exist
CREATE TABLE IF NOT EXISTS public.troll_wars_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    tier TEXT DEFAULT 'easy',
    category TEXT DEFAULT 'general',
    progress_type TEXT DEFAULT 'count',
    target_value INTEGER DEFAULT 1,
    is_repeatable BOOLEAN DEFAULT false,
    reset_cycle TEXT DEFAULT 'weekly',
    is_active BOOLEAN DEFAULT true,
    reward_schema JSONB DEFAULT '{}',
    completion_conditions JSONB DEFAULT '{}',
    dependencies TEXT[] DEFAULT '{}',
    failure_conditions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.troll_wars_tasks ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'troll_wars_tasks' AND policyname = 'Anyone can view active tasks') THEN
        CREATE POLICY "Anyone can view active tasks" ON public.troll_wars_tasks FOR SELECT USING (is_active = true);
    END IF;
END $$;

-- Clean up Gamerz tasks
DELETE FROM public.troll_wars_tasks 
WHERE category = 'gamerz' OR category = 'gaming';

-- Add Pod Tasks
INSERT INTO public.troll_wars_tasks 
(task_id, name, description, tier, category, progress_type, target_value, is_repeatable, reset_cycle, is_active)
VALUES 
('host_pod_1', 'Voice of the City', 'Host a podcast for at least 10 minutes', 'medium', 'social', 'time', 10, true, 'weekly', true),
('listen_pod_1', 'Good Listener', 'Listen to podcasts for 30 minutes', 'easy', 'social', 'time', 30, true, 'weekly', true)
ON CONFLICT (task_id) DO NOTHING;

-- Fix/Ensure permissions for terms_accepted
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO anon;
