BEGIN;

CREATE TABLE IF NOT EXISTS public.android_update_push_tracking (
  version_code BIGINT PRIMARY KEY CHECK (version_code > 0),
  version_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'sent', 'failed')),
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  last_error TEXT
);

ALTER TABLE public.android_update_push_tracking ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.android_update_push_tracking FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.android_update_push_tracking TO service_role;

INSERT INTO public.android_update_push_tracking (
  version_code,
  version_name,
  status,
  sent_at
)
VALUES (33, '1.2.13', 'sent', NOW())
ON CONFLICT (version_code) DO NOTHING;

COMMIT;
