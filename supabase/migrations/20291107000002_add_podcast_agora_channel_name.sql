ALTER TABLE public.podcasts
  ADD COLUMN IF NOT EXISTS agora_channel_name text;

UPDATE public.podcasts
SET agora_channel_name = metadata->>'agora_channel_name'
WHERE agora_channel_name IS NULL
  AND jsonb_typeof(metadata) = 'object'
  AND NULLIF(metadata->>'agora_channel_name', '') IS NOT NULL;
