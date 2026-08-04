-- Add payout method columns to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS preferred_payout_method TEXT CHECK (preferred_payout_method IN ('cash_app', 'paypal', 'venmo')),
ADD COLUMN IF NOT EXISTS cashapp_handle TEXT,
ADD COLUMN IF NOT EXISTS venmo_handle TEXT,
ADD COLUMN IF NOT EXISTS paypal_email TEXT;

-- Add hype_coins column to user_profiles for 30-day expiry tracking
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS hype_coins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hype_coins_earned_at TIMESTAMPTZ;

-- House raid logs table for tracking damage
CREATE TABLE IF NOT EXISTS house_raid_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID REFERENCES houses(id) ON DELETE CASCADE,
  raider_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID,
  old_condition INTEGER NOT NULL,
  new_condition INTEGER NOT NULL,
  damage_amount INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_house_raid_logs_house ON house_raid_logs(house_id);
CREATE INDEX IF NOT EXISTS idx_house_raid_logs_raider ON house_raid_logs(raider_id);
CREATE INDEX IF NOT EXISTS idx_house_raid_logs_target ON house_raid_logs(target_user_id);

-- House repair logs table
CREATE TABLE IF NOT EXISTS house_repair_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID REFERENCES houses(id) ON DELETE CASCADE,
  repaired_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  coins_spent INTEGER NOT NULL,
  condition_before INTEGER NOT NULL,
  condition_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_house_repair_logs_house ON house_repair_logs(house_id);

-- Enable RLS
ALTER TABLE house_raid_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_repair_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own raid logs" ON house_raid_logs FOR SELECT USING (raider_id = auth.uid() OR target_user_id = auth.uid());
CREATE POLICY "Users can view own repair logs" ON house_repair_logs FOR SELECT USING (repaired_by = auth.uid());