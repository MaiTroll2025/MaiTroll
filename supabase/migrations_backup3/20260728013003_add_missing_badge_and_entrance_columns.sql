ALTER TABLE public.badge_catalog ADD COLUMN IF NOT EXISTS tier_level INTEGER DEFAULT 1;
ALTER TABLE public.badge_catalog ADD COLUMN IF NOT EXISTS max_tier INTEGER DEFAULT 1;
ALTER TABLE public.badge_catalog ADD COLUMN IF NOT EXISTS tier_progress_required INTEGER DEFAULT 0;
ALTER TABLE public.badge_catalog ADD COLUMN IF NOT EXISTS perk_type TEXT;
ALTER TABLE public.badge_catalog ADD COLUMN IF NOT EXISTS perk_value JSONB;
ALTER TABLE public.entrance_effects ADD COLUMN IF NOT EXISTS voice_over_text TEXT;
ALTER TABLE public.entrance_effects ADD COLUMN IF NOT EXISTS voice_style TEXT DEFAULT 'hype';
ALTER TABLE public.entrance_effects ADD COLUMN IF NOT EXISTS min_level INTEGER DEFAULT 1;
ALTER TABLE public.entrance_effects ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;