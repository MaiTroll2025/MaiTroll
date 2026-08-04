-- Add columns for Troll Wall system-generated posts if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='troll_wall_posts' AND column_name='is_system_generated') THEN
        ALTER TABLE public.troll_wall_posts ADD COLUMN is_system_generated boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='troll_wall_posts' AND column_name='system_actor') THEN
        ALTER TABLE public.troll_wall_posts ADD COLUMN system_actor text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='troll_wall_posts' AND column_name='actor_user_id') THEN
        ALTER TABLE public.troll_wall_posts ADD COLUMN actor_user_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='troll_wall_posts' AND column_name='stream_id') THEN
        ALTER TABLE public.troll_wall_posts ADD COLUMN stream_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='troll_wall_posts' AND column_name='activity_type') THEN
        ALTER TABLE public.troll_wall_posts ADD COLUMN activity_type text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='troll_wall_posts' AND column_name='expires_at') THEN
        ALTER TABLE public.troll_wall_posts ADD COLUMN expires_at timestamptz;
    END IF;
END $$;

-- Create unique partial index to prevent duplicate system-generated posts for the same stream
CREATE UNIQUE INDEX IF NOT EXISTS idx_troll_wall_posts_unique_system_stream
ON public.troll_wall_posts (stream_id)
WHERE is_system_generated = true AND stream_id IS NOT NULL;

-- Create function to delete expired system-generated Troll Wall posts
CREATE OR REPLACE FUNCTION public.delete_expired_troll_wall_system_posts()
RETURNS void
LANGUAGE sql
AS $$
    DELETE FROM public.troll_wall_posts
    WHERE is_system_generated = true
      AND expires_at < now();
$$;

-- Schedule daily cleanup if pg_cron extension is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule_job('delete_expired_troll_wall_system_posts');
        PERFORM cron.schedule(
            'delete_expired_troll_wall_system_posts',
            '0 0 * * *',  -- Runs daily at midnight
            $$DELETE FROM public.troll_wall_posts WHERE is_system_generated = true AND expires_at < now();$$
        );
    END IF;
END $$;