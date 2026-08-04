-- Update all current users to have OG badge
UPDATE public.user_profiles
SET is_og_user = true;

-- Set default for new users to true (as a fallback)
ALTER TABLE public.user_profiles
ALTER COLUMN is_og_user SET DEFAULT true;

-- Create function to auto-assign based on date (Mar 1, 2026)
CREATE OR REPLACE FUNCTION public.check_og_badge_eligibility()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if current time is before March 1, 2026 UTC
    IF NOW() < '2026-03-01 00:00:00+00' THEN
        NEW.is_og_user := true;
    ELSE
        NEW.is_og_user := false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger before insert
DROP TRIGGER IF EXISTS tr_check_og_badge ON public.user_profiles;
CREATE TRIGGER tr_check_og_badge
BEFORE INSERT ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_og_badge_eligibility();
