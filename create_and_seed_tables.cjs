const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  'https://gejtbllazzighxwxudyu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjkxMTcsImV4cCI6MjA3OTYwNTExN30.S5Vc1xpZoZ0aemtNFJGcPhL_zvgPA0qgZq8e8KigUx8'
);

// Complete migration SQL to create tables and seed data
const migrationSQL = `
-- 1. Create entrance_effects table
CREATE TABLE IF NOT EXISTS entrance_effects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  coin_cost INTEGER NOT NULL,
  rarity TEXT NOT NULL,
  description TEXT,
  animation_type TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create perks table
CREATE TABLE IF NOT EXISTS perks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost INTEGER NOT NULL,
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  icon TEXT,
  perk_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create insurance_options table
CREATE TABLE IF NOT EXISTS insurance_options (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost INTEGER NOT NULL,
  description TEXT NOT NULL,
  duration_hours INTEGER NOT NULL,
  protection_type TEXT NOT NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS on tables
ALTER TABLE entrance_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_options ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS policies for public read access
CREATE POLICY IF NOT EXISTS "Anyone can view active entrance effects"
  ON entrance_effects FOR SELECT
  USING (is_active = true);

CREATE POLICY IF NOT EXISTS "Anyone can view active perks"
  ON perks FOR SELECT
  USING (is_active = true);

CREATE POLICY IF NOT EXISTS "Anyone can view active insurance options"
  ON insurance_options FOR SELECT
  USING (is_active = true);

-- 6. Insert entrance effects data
INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type) VALUES
  ('effect_flame_burst', '🔥 Flame Burst', '🔥', 500, 'Rare', 'Enter with a burst of flames', 'flame'),
  ('effect_money_shower', '💸 Money Shower', '💸', 1500, 'Epic', 'Rain money when you arrive', 'money_shower'),
  ('effect_electric_flash', '⚡ Electric Flash', '⚡', 2800, 'Epic', 'Electric lightning entrance', 'electric'),
  ('effect_royal_throne', '👑 Royal Throne', '👑', 5200, 'Legendary', 'Descend on a royal throne', 'throne'),
  ('effect_rainbow_descent', '🌈 Rainbow Descent', '🌈', 8500, 'Legendary', 'Arrive on a rainbow', 'rainbow'),
  ('effect_troll_rollup', '🚗 Troll Roll-Up', '🚗', 12000, 'Mythic', 'Drive in with style', 'car'),
  ('effect_vip_siren', '🚨 VIP Siren Rush', '🚨', 25000, 'Mythic', 'VIP siren announcement', 'siren'),
  ('effect_firework', '🎆 Firework Explosion', '🎆', 50000, 'Mythic', 'Explode onto the scene', 'firework'),
  ('effect_troll_king', '🧌 Troll King Arrival', '🧌', 100000, 'Exclusive', 'Ultimate king entrance', 'king')
ON CONFLICT (id) DO NOTHING;

-- 7. Insert perks data
INSERT INTO perks (id, name, cost, description, duration_minutes, perk_type) VALUES
  ('perk_disappear_chat', 'Disappearing Chats (30m)', 500, 'Your chats auto-hide after 10s for 30 minutes', 30, 'visibility'),
  ('perk_ghost_mode', 'Ghost Mode (30m)', 1200, 'View streams in stealth without status indicators', 30, 'visibility'),
  ('perk_message_admin', 'Message Admin (Officer Only)', 250, 'Unlock DM to Admin', 10080, 'chat'),
  ('perk_global_highlight', 'Glowing Username (1h)', 8000, 'Your username glows neon in all chats & gift animations', 60, 'cosmetic'),
  ('perk_rgb_username', 'RGB Username (24h)', 420, 'Rainbow glow visible to everyone', 1440, 'cosmetic'),
  ('perk_slowmo_chat', 'Slow-Motion Chat Control (5hrs)', 15000, 'Activate chat slow-mode in any live stream', 300, 'chat'),
  ('perk_troll_alarm', 'Troll Alarm Arrival (100hrs)', 2000, 'Sound + flash announces your arrival', 6000, 'cosmetic'),
  ('perk_ban_shield', 'Ban Shield (2hrs)', 1700, 'Immunity from kick, mute, or ban for 2 hours', 120, 'protection'),
  ('perk_double_xp', 'Double XP Mode (1h)', 1300, 'Earn 2x XP for the next hour', 60, 'boost'),
  ('perk_flex_banner', 'Golden Flex Banner (100h)', 3500, 'Golden crown banner on all your messages', 6000, 'cosmetic'),
  ('perk_troll_spell', 'Troll Spell (1h)', 2800, 'Randomly change another user\'s username style & emoji for 100 hour', 60, 'cosmetic'),
  ('citizen_badge', 'Citizen Badge', 0, 'Show off your status', 52560000, 'cosmetic'),
  ('profile_border_basic', 'Basic Profile Border', 0, 'Decorate your avatar', 52560000, 'cosmetic'),
  ('coin_boost_2', '+2% Coin Boost', 0, 'Earn more coins passively', 52560000, 'boost'),
  ('spotlight_ticket', 'Spotlight Ticket', 0, '15 min spotlight', 52560000, 'visibility'),
  ('daily_reward_10', '+10% Daily Reward', 0, 'Login bonus increased', 52560000, 'boost'),
  ('emojis_pack_1', 'Emoji Pack #1', 0, 'New chat emojis', 52560000, 'cosmetic'),
  ('xp_boost_5', '+5% XP Boost', 0, 'Level up faster', 52560000, 'boost'),
  ('boost_token', 'Boost Token', 0, 'Boost a stream', 52560000, 'boost'),
  ('create_family', 'Create Family', 0, 'Start your own Troll Family', 52560000, 'visibility'),
  ('rising_citizen_badge', 'Rising Citizen Badge', 0, 'You are going places', 52560000, 'cosmetic'),
  ('gift_xp_2', '+2% Gift XP', 0, 'More XP from gifting', 52560000, 'boost'),
  ('vip_chat_color', 'VIP Chat Color', 0, 'Stand out in chat', 52560000, 'cosmetic'),
  ('mini_profile_glow', 'Mini Profile Glow', 0, 'Shiny profile card', 52560000, 'cosmetic'),
  ('streamer_intro', 'Streamer Intro Sound', 0, 'Play sound when starting stream', 52560000, 'visibility'),
  ('voice_replies', 'Voice Replies', 0, 'Reply with voice messages', 52560000, 'chat'),
  ('influencer_badge', 'Influencer Badge', 0, 'A true local celebrity', 52560000, 'cosmetic'),
  ('legend_chat_badge', 'Legend Chat Badge', 0, 'Respect the legend', 52560000, 'cosmetic'),
  ('shimmer_name', 'Shimmer Name Effect', 0, 'Your name sparkles', 52560000, 'cosmetic'),
  ('legend_badge', 'Legend Badge', 0, 'Top tier status', 52560000, 'cosmetic'),
  ('custom_emote', 'Custom Emote Slot', 0, 'Upload your own emote', 52560000, 'cosmetic'),
  ('cyber_city_theme', 'Theme: Cyber City', 0, 'Exclusive app theme', 52560000, 'cosmetic'),
  ('voice_room', 'Voice Room Access', 0, 'Create voice-only rooms', 52560000, 'chat'),
  ('founders_wall', 'Founders Wall', 0, 'Name listed on wall', 52560000, 'cosmetic')
ON CONFLICT (id) DO NOTHING;

-- 8. Insert insurance options data
INSERT INTO insurance_options (id, name, cost, description, duration_hours, protection_type) VALUES
  ('insurance_kick_24h', 'Kick Insurance (24h)', 1200, 'Protect from kick penalties for 24 hours', 24, 'kick'),
  ('insurance_full_24h', 'Full Protection (24h)', 2500, 'Complete protection for 24 hours', 24, 'full'),
  ('insurance_full_week', 'Full Protection (1 Week)', 15000, 'Full Protection (1 Week)', 168, 'full')
ON CONFLICT (id) DO NOTHING;
`;

async function runMigration() {
  try {
    console.log('Running migration to create tables and seed data...');
    
    // Execute the migration SQL
    const result = await supabase.rpc('execute_sql', { sql: migrationSQL });
    
    if (result.error) {
      console.error('Migration failed:', result.error);
      return;
    }
    
    console.log('✓ Migration completed successfully!');
    
    // Verify the data
    const effects = await supabase.from('entrance_effects').select('*');
    const perks = await supabase.from('perks').select('*');
    const insurance = await supabase.from('insurance_options').select('*');
    
    console.log('\\nFinal verification:');
    console.log('Entrance Effects:', effects.data?.length || 0, 'records');
    console.log('Perks:', perks.data?.length || 0, 'records');
    console.log('Insurance Options:', insurance.data?.length || 0, 'records');
    
    if (effects.data && effects.data.length > 0) {
      console.log('\\nSample effects:', effects.data.map(e => e.name));
    }
    
    if (perks.data && perks.data.length > 0) {
      console.log('Sample perks:', perks.data.map(p => p.name));
    }
    
    if (insurance.data && insurance.data.length > 0) {
      console.log('Sample insurance:', insurance.data.map(i => i.name));
    }
    
    console.log('\\n🎉 All tables created and data seeded successfully!');
    console.log('The Coin Store should now display entrance effects, perks, and insurance options.');
    
  } catch (error) {
    console.error('Error running migration:', error);
  }
}

runMigration();
