import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const original = readFileSync(join(process.cwd(), 'frontend_schema.sql'), 'utf8');

// List of missing tables
const missingTables = [
  'profile_tab_visibility',
  'installment_milestone_events',
  'trollmers_monthly_tournaments',
  'system_backup_requests',
  'vehicle_auction_bids',
  'featured_broadcasts',
  'broadcast_rankings',
  'weekly_top_broadcasters',
  'dealership_inventory',
  'dealership_vehicle_pool',
  'agora_stream_sessions',
  'troll_drop_claims',
  'stream_raffle_tickets',
  'stream_raffle_winners',
  'court_summons_log',
  'profile_frame_tiers',
  'diamond_avatar_tiers',
  'diamond_special_styles',
  'voice_announcement_styles',
  'audio_queue',
  'fan_memory',
  'broadcast_command_modules',
  'user_badge_progress',
  'marketplace_payout_holds'
];

let sql = '-- Missing Tables\n';
sql += '-- These tables were in frontend_schema.sql but not in the 6-part split\n\n';

for (const tableName of missingTables) {
  // Find the table definition in the original schema
  const regex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${tableName}\\s*\\([\\s\\S]*?\\);`, 'i');
  const match = original.match(regex);
  
  if (match) {
    sql += `-- Table: ${tableName}\n`;
    sql += match[0] + '\n\n';
  } else {
    console.warn(`Could not find table: ${tableName}`);
  }
}

writeFileSync(join(OUTPUT_DIR, '20260727180000_missing_tables.sql'), sql);
console.log('Created: 20260727180000_missing_tables.sql');
