-- Fix critical_alerts schema to match frontend usage

ALTER TABLE public.critical_alerts
  ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

DROP INDEX IF EXISTS idx_critical_alerts_user_id;
CREATE INDEX IF NOT EXISTS idx_critical_alerts_user_id ON public.critical_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_critical_alerts_resolved ON public.critical_alerts(resolved);
