-- Disable payout lock for local/dev so seed can insert payout_requests
UPDATE public.system_settings SET payout_lock_enabled = false, payout_unlock_at = now(), updated_at = now();

INSERT INTO public.system_settings (payout_lock_enabled, payout_unlock_at, updated_at)
SELECT false, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);
