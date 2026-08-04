import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Pages and their tables
const pageTables = {
  'auth': ['signup_queue', 'user_event_dismissals', 'admin_password_resets', 'critical_alerts', 'jail_ip_violations', 'jail_security_violations', 'daily_login_posts', 'active_sessions', 'concurrent_login_details', 'user_profiles', 'jail'],
  'home': ['page_visibility', 'sidebar_updates', 'user_sidebar_views', 'support_screen_sessions', 'city_events', 'global_events', 'broadcast_rankings', 'featured_broadcasts', 'admin_broadcasts', 'city_ads', 'user_advertisements', 'streams', 'user_follows'],
  'profile': ['user_profile_badges', 'user_profile_roles', 'profile_frames', 'profile_tab_visibility', 'user_active_items', 'user_avatar_customization', 'user_broadcast_theme_purchases', 'user_broadcast_theme_state', 'user_entrance_audio', 'user_entrance_effects', 'user_profile_frames', 'user_perks', 'user_badges', 'user_stats', 'user_levels', 'user_subscriptions', 'user_presence', 'user_presence_routes', 'user_reports', 'moderation_actions'],
  'streams': ['streams', 'stream_seats', 'stream_seat_sessions', 'stream_viewers', 'stream_messages', 'stream_gifts', 'stream_likes', 'stream_moderators', 'stream_bans', 'stream_mutes', 'stream_smoke_events', 'stream_song_requests', 'stream_raffles', 'stream_raffle_tickets', 'stream_raffle_winners', 'stream_goals', 'stream_milestones', 'stream_polls', 'stream_energy_meter', 'stream_fan_tiers', 'stream_awards', 'broadcast_active_effects', 'broadcast_ability_logs', 'broadcast_pinned_products', 'broadcast_mod_actions', 'broadcast_restrictions', 'broadcast_replays', 'stream_settings', 'stream_capacity_queue', 'stream_analytics_daily', 'stream_audience_presence', 'stream_battles', 'stream_incidents', 'stream_monitoring_status_view', 'stream_ended_logs', 'stream_recordings', 'stream_participants', 'stream_ranking', 'stream_reports', 'broadcast_audio_settings', 'broadcast_league_stats', 'broadcast_troll_usages', 'broadcast_tokens', 'broadcast_challenges', 'broadcast_missions', 'broadcast_background_themes', 'broadcast_insurances', 'stream_audio_monitoring', 'live_viewers', 'active_sessions', 'ghost_stream_sessions'],
  'notifications': ['notifications', 'user_follows', 'user_followers', 'user_reports', 'moderation_actions', 'moderation_reports', 'user_blocks', 'user_bans', 'user_mutes', 'chat_blocks', 'support_tickets', 'support_goal_reminder_dismissals', 'support_screen_sessions', 'app_bug_reports', 'beta_feedback', 'beta_feedback_replies', 'beta_feedback_audit_log', 'beta_feedback_internal_notes', 'bug_alerts', 'system_alerts', 'emergency_alerts', 'scheduled_announcements', 'user_broadcast_restrictions'],
  'coins': ['coin_ledger', 'coin_orders', 'manual_coin_orders', 'coin_audit_log', 'stripe_customers', 'saved_cards', 'payment_methods', 'payout_batches', 'payout_runs', 'payouts', 'paypal_transactions', 'cashout_tiers', 'cashout_requests', 'user_credit', 'credit_events', 'fast_pay_applications', 'purchase_ledger', 'payment_logs', 'admin_for_week_queue', 'broadcast_officers', 'pay_stream_broadofficers'],
  'court': ['court_cases', 'court_sessions', 'court_session_state', 'court_dockets', 'court_participants', 'court_summons', 'court_summons_log', 'troll_court_cases', 'troll_court_sessions', 'troll_court_participants', 'troll_court_summons', 'troll_court_evidence', 'court_rulings_archive', 'court_events', 'court_ai_messages', 'court_ai_feedback', 'court_ai_rate_limits', 'attorney_applications', 'prosecutor_applications'],
  'jail': ['jail', 'jail_appeals', 'jail_ip_violations', 'jail_notifications', 'jail_security_violations', 'jail_transactions', 'bond_requests', 'inmate_messages'],
  'universe': ['universe_events', 'universe_registrations', 'universe_calendar_entries', 'universe_queue', 'universe_rounds', 'universe_round_teams', 'universe_round_scores', 'universe_abilities', 'universe_event_results', 'universe_team_seats', 'universe_showdown_battles', 'universe_showdown_signups', 'universe_showdown_invites', 'universe_showdown_dates', 'battle_queue', 'battle_skips', 'battle_challenges', 'battle_scores', 'battle_sessions', 'troll_battles', 'battle_participants', 'state_battles', 'state_members', 'states'],
  'academy': ['academy_categories', 'academy_teachers', 'academy_teacher_applications', 'academy_courses', 'academy_classrooms', 'academy_enrollments', 'academy_waitlists', 'academy_sessions', 'academy_attendance', 'academy_assignments', 'academy_submissions', 'academy_quizzes', 'academy_quiz_questions', 'academy_quiz_attempts', 'academy_grades', 'academy_certificates', 'academy_materials', 'academy_announcements', 'academy_notes', 'academy_coin_rewards', 'academy_student_ids', 'academy_admissions_applications', 'academy_admissions_log', 'academy_graduate_badges', 'academy_learning_pathways', 'academy_pathway_enrollments', 'academy_loan_payments', 'academy_discussions', 'academy_teacher_ratings', 'academy_teacher_credentials', 'academy_teacher_payouts', 'academy_accreditation_orgs', 'academy_accreditation_requests', 'mai_class_enrollments', 'mai_classes', 'mai_talent_auditions', 'mai_talent_judges', 'mai_talent_votes', 'organization_students', 'organizations', 'organization_admins'],
  'church': ['church_live_sessions', 'church_prayers', 'church_prayer_replies', 'church_prayer_likes', 'church_sermon_notes', 'church_passages', 'troll_church_daily_words'],
  'agencies': ['agencies', 'agency_members', 'agency_applications', 'agency_contracts', 'agency_earnings', 'agency_goals', 'agency_goal_progress', 'agency_invites', 'agency_activity_logs', 'agency_point_transactions', 'agency_rewards', 'agency_settings', 'agency_weekly_stats', 'agency_payout_requests', 'agency_admin_reports', 'agency_audit_log'],
  'treasury': ['troll_city_treasury', 'treasury_transactions', 'treasury_role_allocations', 'treasury_payout_runs', 'treasury_payout_items', 'payout_batches', 'payout_runs', 'payouts', 'platform_profit', 'platform_revenue', 'admin_pool', 'admin_pool_ledger', 'admin_pool_transactions', 'admin_settings', 'admin_app_settings', 'app_settings', 'site_content'],
  'tromail': ['tromail_accounts', 'tromail_messages', 'tromail_recipients', 'tromail_role_accounts', 'tromail_calendar_events', 'tromail_calendar_event_recipients', 'tromail_contracts', 'tromail_contract_templates'],
  'utromail': ['utromail_accounts', 'utromail_threads', 'utromail_thread_members', 'utromail_messages', 'utromail_read_status', 'utromail_attachments', 'utromail_blocks', 'utromail_requests', 'utromail_reports', 'utromail_notifications', 'tcps_messages'],
  'auction': ['auction_shows', 'auction_lots', 'auction_bids', 'auction_wins', 'auction_watchlist', 'auction_predictions', 'auction_prediction_settings', 'auction_orders', 'auction_reports', 'auction_scan_events', 'auction_device_sessions', 'auction_devices', 'auction_presence', 'auctioneer_applications', 'auctioneer_profiles'],
  'family': ['family_members', 'family_goals', 'family_tasks', 'family_chat_messages', 'family_calls', 'family_call_members', 'family_wars', 'family_war_scores', 'family_earnings_pool', 'family_member_earnings', 'family_payout_records', 'family_stats', 'family_seasons', 'family_vault', 'family_boosts', 'family_streaks', 'family_level_unlocks', 'family_achievements', 'family_achievements_new', 'family_activity_log', 'family_gift_logs', 'family_notifications', 'family_participation_tracking', 'family_rate_limits', 'family_reward_ledger', 'family_goal_progress', 'family_goal_templates', 'family_goal_generation_runs', 'family_songs', 'family_leader_tax_config', 'family_call_minutes', 'family_members_extended', 'weekly_family_goals_new', 'troll_family_league_seasons', 'troll_family_league_standings', 'troll_wars_tasks', 'troll_wars_ai_battle_logs', 'troll_wars_task_progress'],
  'vehicles': ['vehicles_catalog', 'user_vehicles', 'vehicle_loans', 'user_vehicle_upgrades', 'car_upgrades', 'dealership_inventory', 'dealership_vehicle_pool', 'vehicle_listings', 'vehicle_vandalism', 'user_driver_licenses', 'user_licenses', 'homeowners_insurances', 'car_insurances', 'user_insurance_policies', 'user_insurances', 'insurance_logs', 'insurance_options', 'insurance_plans'],
  'marketplace': ['marketplace_items', 'marketplace_reviews', 'marketplace_purchases', 'marketplace_payout_release_requests', 'active_marketplace_disputes', 'shop_orders', 'shop_transactions', 'Mai Troll_orders', 'Mai Troll_products', 'Mai Troll_shops', 'seller_history', 'seller_reliability', 'sellers_with_fraud_holds', 'payment_holds', 'outbound_clicks', 'review-images', 'post-images', 'post-media', 'appeal_actions', 'appeal_weekly_limits', 'transaction_appeals'],
  'employees': ['employee_records', 'employee_tasks', 'employee_reports', 'employee_announcements', 'employee_announcement_acks', 'employee_change_requests', 'employee_change_request_votes', 'employee_chat_channels', 'employee_chat_messages', 'employee_disciplinary_actions', 'employee_document_templates', 'employee_payroll_runs', 'employee_paystubs', 'employee_perk_pay', 'employee_audit_log', 'employee_payroll_profiles', 'hr_onboarding_items', 'officer_shift_slots', 'officer_shifts', 'officer_payroll_logs', 'officer_performance', 'officer_corruption_flags', 'officer_time_off_requests', 'officer_actions', 'officer_earnings', 'officer_stream_logs', 'officer_quiz_results_view', 'officer_quiz_submissions', 'officer_rankings', 'officer_strikes', 'officer_applications', 'officer_live_assignments', 'officer_members', 'officer_payouts', 'officer_work_sessions', 'officer_vote_cycles', 'officer_votes', 'night_watch_shifts', 'night_watch_recordings', 'weekly_officer_reports', 'staff_action_audit_log', 'staff_meetings', 'staff_meeting_participants', 'weekly_reports', 'weekly_surveys'],
  'xtrollz': ['xtrollz_applications', 'xtrollz_streams', 'xtrollz_moderation_actions', 'xtrollz_application_documents', 'xtrollz_favorites', 'xtrollz_rules_acceptance', 'xtrollz_stream_messages', 'xtrollz-documents'],
  'shareathon': ['shareathon_events', 'shareathon_eligible_broadcasters', 'shareathon_submissions', 'shareathon_verification_log'],
  'podcast': ['podcasts', 'podcast_episodes', 'podcast_rtc_logs', 'call_minutes', 'call_rooms', 'call_history'],
  'notary': ['documents', 'document_types', 'document_signatures', 'document_approvals', 'document_stamps', 'document_audit_logs', 'office_documents', 'office_document_versions', 'office_folders', 'office_spreadsheets', 'office_spreadsheet_cells', 'office_shared_files', 'office_templates', 'meeting_documents'],
  'government': ['government_laws', 'government_history', 'government_positions', 'government_elections', 'president_proposals', 'president_audit_logs', 'president_candidates', 'president_elections', 'president_votes', 'president_appointments', 'president_treasury_balance', 'law_votes', 'protests', 'protest_participants', 'emergency_powers_log', 'city_reputation', 'bribe_logs', 'deed_transfers', 'deeds', 'executive_intake', 'executive_reports', 'secretary_assignments', 'secretary_tasks', 'zip_crime_dashboard'],
  'games': ['wheel_inventory', 'troll_wheel_wins', 'games', 'game_players', 'internet_game_matches', 'matchmaking_queue', 'pitch_contests', 'pitches', 'pride_challenges', 'pride_user_progress', 'giveaways', 'daily_free_spins', 'daily_rewards', 'tip_packages', 'tips', 'music_tracks', 'music_tips', 'songs', 'song_likes', 'smokeathon_events', 'smokeathon_music_requests', 'smokeathon_participants', 'troll_event_claims', 'troll_events', 'troll_dna_events', 'troll_dna_profiles', 'troll_dna_traits', 'troll_ai_avatars', 'hall_of_fame', 'royal_family_leaderboard', 'founder_rewards', 'founder_rewards_grants', 'war_results', 'label_members', 'record_labels', 'albums', 'covers'],
  'security': ['security_events', 'security_incident_reports', 'security_rate_limits', 'security_user_risk_scores', 'user_safety_warnings', 'user_ip_tracking', 'user_reputation', 'moderation_logs', 'moderation_evidence', 'web_push_subscriptions', 'ai_moderation_cache'],
  'call': ['call_minutes', 'call_rooms', 'call_history'],
};

// Read all SQL files
const sqlFiles = [];
function findSqlFiles(dir, baseDir) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (!entry.includes('node_modules') && !entry.includes('worktree') && !entry.includes('backup') && !entry.includes('conflicted') && !entry.includes('__tests__')) {
          findSqlFiles(fullPath, baseDir);
        }
      } else if (entry.endsWith('.sql')) {
        const relativePath = fullPath.replace(baseDir + '\\', '').replace(baseDir + '/', '');
        sqlFiles.push({ path: fullPath, name: relativePath });
      }
    }
  } catch (e) {
    // skip
  }
}

findSqlFiles(process.cwd(), process.cwd());

const relevantFiles = sqlFiles.filter(f => {
  const parts = f.name.split(/[\\/]/);
  return parts[0] === 'src' || parts[0] === 'db' || parts[0] === 'database' || parts[0] === 'migrations' || 
         f.name.includes('complete_jail') || f.name.includes('UNIVERSAL_RLS') || f.name.includes('force_apply') || 
         f.name.includes('MISSING_OBJECTS') || f.name.includes('agency_schema') || f.name.includes('create_media_city_schema') || 
         f.name.includes('neighborhood_schema');
});

console.log(`Found ${relevantFiles.length} SQL files`);

// Read all SQL content
const allSql = [];
for (const file of relevantFiles) {
  try {
    const content = readFileSync(file.path, 'utf8');
    allSql.push({ name: file.name, content });
  } catch (e) {
    // skip
  }
}

// For each page, find SQL blocks that reference that page's tables
// Only include non-table-creation SQL (functions, triggers, policies, seed data, grants)
const pageSqlBlocks = {};

for (const [page, tables] of Object.entries(pageTables)) {
  pageSqlBlocks[page] = [];
  
  for (const file of allSql) {
    const content = file.content;
    
    // Find all comment blocks and their following SQL
    const commentRegex = /--\s*([^\n]*)\n([\s\S]*?)(?=\n--|\Z)/g;
    let commentMatch;
    
    while ((commentMatch = commentRegex.exec(content)) !== null) {
      const comment = commentMatch[1];
      const sqlBlock = commentMatch[2].trim();
      
      if (!sqlBlock || sqlBlock.length < 10) continue;
      
      // Skip CREATE TABLE blocks (already in initial schema)
      if (sqlBlock.match(/^CREATE\s+TABLE/i)) continue;
      
      // Check if block references any of this page's tables
      const lowerSql = sqlBlock.toLowerCase();
      const hasTableRef = tables.some(t => 
        lowerSql.includes(`public.${t.toLowerCase()}`) || 
        lowerSql.includes(`"${t.toLowerCase()}"`) || 
        lowerSql.includes(`'${t.toLowerCase()}'`)
      );
      
      if (hasTableRef) {
        pageSqlBlocks[page].push({
          sql: `-- ${comment}\n${sqlBlock}`,
          source: file.name
        });
      }
    }
  }
  
  // Deduplicate
  const seen = new Set();
  pageSqlBlocks[page] = pageSqlBlocks[page].filter(block => {
    const key = block.sql.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Create per-page migration files
const timestamp = '20260727180000';
let migrationCount = 0;

for (const [page, blocks] of Object.entries(pageSqlBlocks)) {
  if (blocks.length === 0) continue;
  
  const pageKey = page.toLowerCase();
  
  let sql = `-- Page: ${page}\n`;
  sql += `-- Migration: ${timestamp}_page_${pageKey}\n`;
  sql += `-- Tables: ${pageTables[page].slice(0, 15).join(', ')}${pageTables[page].length > 15 ? '...' : ''}\n`;
  sql += `-- SQL blocks: ${blocks.length}\n\n`;
  
  for (const block of blocks) {
    sql += `-- From: ${block.source}\n`;
    sql += block.sql + '\n\n';
  }
  
  const fileName = `${timestamp}_page_${pageKey}.sql`;
  const filePath = join(OUTPUT_DIR, fileName);
  writeFileSync(filePath, sql);
  console.log(`Created: ${fileName} (${blocks.length} blocks)`);
  migrationCount++;
}

console.log(`\nTotal per-page migrations created: ${migrationCount}`);
