-- Create trigger to initialize credit score for new users

CREATE OR REPLACE FUNCTION public.create_user_credit_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
  VALUES (
    NEW.id,
    400, -- Default starting score
    'Building', -- Default tier
    0, -- No trend yet
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_credit ON auth.users;

-- Create trigger for new user signups
CREATE TRIGGER on_auth_user_created_credit
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_user_credit_on_signup();

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.create_user_credit_on_signup() TO service_role;
