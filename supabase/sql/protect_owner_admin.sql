-- Protect the Owner Admin account (Mai Troll2025@gmail.com) from being modified by other admins

CREATE OR REPLACE FUNCTION public.protect_owner_admin_changes()
RETURNS TRIGGER AS $$
DECLARE
  owner_email TEXT := 'Mai Troll2025@gmail.com';
  target_is_owner BOOLEAN;
  actor_is_owner BOOLEAN;
BEGIN
  -- Determine if the target user is the owner
  -- We check OLD email to identify the owner record
  target_is_owner := (OLD.email IS NOT NULL AND LOWER(OLD.email) = owner_email);

  IF target_is_owner THEN
    -- Check if the executing user is the owner
    -- We assume auth.uid() returns the ID of the user performing the update
    actor_is_owner := (auth.uid() = OLD.id);
    
    -- If the actor is NOT the owner
    IF NOT actor_is_owner THEN
      -- Prevent changing role away from admin
      IF NEW.role != 'admin' THEN
        RAISE EXCEPTION 'CRITICAL: You cannot remove Admin privileges from the Owner account.';
      END IF;
      
      -- Prevent changing is_admin to false
      IF NEW.is_admin = false THEN
        RAISE EXCEPTION 'CRITICAL: You cannot remove Admin privileges from the Owner account.';
      END IF;
      
      -- Prevent changing the email of the owner
      IF NEW.email IS NULL OR LOWER(NEW.email) != owner_email THEN
         RAISE EXCEPTION 'CRITICAL: You cannot change the Owner email address.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_owner_admin ON user_profiles;

CREATE TRIGGER tr_protect_owner_admin
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_owner_admin_changes();
