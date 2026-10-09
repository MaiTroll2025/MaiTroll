const fs = require('fs');
const path = require('path');

const migrationsDir = path.join('supabase', 'migrations');
const outputFilePath = 'migration_extract_clean.json';

const requestedFiles = [
  '20230101000000_baseline.sql',
  '20240101_xp_system.sql',
  '20240130000001_add_banner_notifications.sql',
  '20240321000000_fix_extension_and_materialized_view.sql',
  '20240321000001_fix_rls_policies.sql',
  '20240321000002_fix_all_search_paths.sql',
  '20240410120000_add_facebook_platform.sql',
  '20240410130000_fix_signup_coins.sql',
  '20240415000001_create_support_tickets.sql',
  '20240523000000_mobile_error_logs.sql',
  '20240525000001_kick_church_member.sql',
  '20250201100000_broadcast_overhaul.sql',
  '20250201120000_fix_universe_event_schema.sql',
  '20250202100000_broadcast_overhaul.sql',
  '20250202110000_paid_features.sql',
  '20250202120000_moderation.sql',
  '20250202120001_unify_gift_rpc.sql',
  '20250202130000_battles.sql',
  '20250202140000_battle_scoring.sql',
  '20250204_soft_delete_messages.sql',
  '20250211000000_pay_bank_loan.sql',
  '20250424000000_rls_performance_optimization.sql',
  '20250424000000_remove_ssn_column.sql',
  '20250425000000_saved_streams.sql',
  '20250425000001_troll_court_evidence.sql',
  '20250425000002_fix_is_online_rls.sql',
  '20260115000000_stripe_coin_purchases.sql',
  '20260115000500_add_unique_officer_shift_slots.sql',
  '20260115001000_stripe_coin_purchases.sql',
  '20260116090000_manual_coin_orders.sql',
  '20260116093010_add_password_reset_pin.sql',
  '20260117000000_manual_clock_in.sql',
  '20260117093000_support_tickets_admin_delete.sql',
  '20260117094000_manual_orders_admin_policy.sql',
  '20260117100000_car_property_insurance.sql',
  '20260118093000_trollg.sql',
  '20260118120000_fix_manual_orders_rls.sql',
  '20260118203000_add_payer_cashtag_manual_orders.sql',
  '20260118212000_manual_order_wallet_and_wall_fixes.sql',
  '20260118213000_add_is_streamer_user_profiles.sql',
  '20260118220000_fix_password_pin_rpc.sql',
  '20260118223000_fix_conversation_recursion.sql',
  '20260118230000_user_cars_properties.sql',
  '20260118235000_fix_user_cars_car_id_type.sql',
  '20260119000005_update_cashout_tiers.sql',
  '20260119010000_consolidate_assets.sql',
  '20260119100000_officer_time_off.sql',
  '20260120000000_troll_bank_init.sql',
  '20260120000001_bank_feature_flags.sql',
  '20260120000002_troll_bank_spend.sql',
  '20260120000100_update_legacy_rpc.sql',
  '20260120000200_update_legacy_rpcs.sql',
  '20260120000250_fix_troll_wall_gifts.sql',
  '20260120000300_refactor_more_legacy_rpcs.sql',
  '20260120000400_refactor_remaining_legacy_functions.sql',
  '20260120000500_update_bank_credit_feature_flags.sql',
  '20260120000600_missing_gift_rpcs.sql',
  '20260120000700_replace_gift_lucky.sql',
  '20260120001000_legacy_wrappers.sql',
  '20260120001500_update_bank_tiers.sql',
  '20260120001600_troll_pass_and_repayment.sql',
  '20260120001700_fix_loan_application.sql',
  '20260120001800_adjust_bank_tiers.sql',
  '20260120001900_add_gift_history_rpc.sql',
  '20260120002000_fix_ledger_direction.sql',
  '20260120003000_fix_broadcast_theme.sql',
  '20260121000001_fix_broadcaster_trigger.sql',
  '20260121000002_secretary_approvals.sql',
  '20260121001000_add_property_names_and_usernames.sql',
  '20260121002000_automate_family_tasks.sql',
  '20260121003000_fix_insurance_plan_id_type.sql',
  '20260121120000_insurance_per_car_pricing.sql',
  '20260122000000_fix_secretary_assignments_rls.sql',
  '20260122000001_fix_random_battle_pending_stuck.sql',
  '20260125220000_fix_purchase_broadcast_theme_rpc.sql',
  '20260128154000_create_loan_credit_tables.sql',
  '20260202130000_allow_system_errors_insert.sql',
  '20260203000000_chat_performance_fix.sql',
  '20260203000001_schedule_gift_batch.sql',
  '20260203000002_gift_observability.sql',
  '20260203000003_leaderboard_view.sql',
  '20260203000004_fix_gift_schema.sql',
  '20260203201547_add_is_battle_column.sql',
  '20260203202500_apply_tmv_rebuild.sql',
  '20260203210000_unified_loans_and_licenses.sql',
  '20260203215000_universal_rls_system.sql',
  '20260203220000_fix_president_proposals.sql',
  '20260203233000_add_government_sector.sql',
  '20260204000000_active_asset_economy.sql',
  '20260204000000_mobile_error_logging.sql',
  '20260204000001_asset_logic.sql',
  '20260204000002_purchase_functions.sql',
  '20260204000003_rentals_auctions_logic.sql',
  '20260204000004_purchase_logic.sql',
  '20260204000005_rental_market_policy.sql',
  '20260204000006_house_upgrades.sql',
  '20260204000007_hotel_tax.sql',
  '20260210120000_database_cleanup.sql',
  '20260210204920_fix_purchase_function_signature.sql',
  '20260210204921_fix_property_types_permissions.sql',
  '20260211000000_chatgpt_fixes.sql',
  '20260211000001_chatgpt_rpcs.sql',
  '20260211000002_fix_send_gift_lookup.sql',
  '20260211000003_create_set_stream_box_count.sql',
  '20260211020000_add_onesignal_tokens.sql',
  '20260211100000_battle_refactor_single_room.sql',
  '20260211101000_end_battle_guarded.sql',
  '20260211102000_add_stream_messages_type.sql',
  '20260211103000_fix_guest_snapshot_top3.sql',
  '20260211104000_drop_old_end_battle.sql',
  '20260211105000_fix_stream_messages_rls.sql',
  '20260212000000_auto_distribute_winnings.sql',
  '20260212000000_platform_event_limits.sql',
  '20260212000001_moderation_expiry_logic.sql',
  '20260212000002_fix_moderation_constraints.sql',
  '20260213000000_idempotent_persistence.sql',
  '20260213000001_ensure_guest_access.sql',
  '20260213000002_seasonal_goal_system.sql',
  '20260213000003_staff_goal_bypass.sql',
  '20260213000004_dynamic_goal_metrics.sql',
  '20260213000005_dynamic_goal_metrics_seed.sql',
  '20260215000000_fix_stream_messages_rls.sql',
  '20260220000000_comprehensive_gifts_system.sql',
  '20260220000001_live_commerce_system.sql',
  '20260221000000_appeals_system.sql',
  '20260223000000_remove_daily_pod_limit.sql',
  '20260223000001_remove_broadcast_limits.sql',
  '20260224161000_broadcaster_moderation_locks.sql',
  '20260225000000_create_mai_talent_queue.sql',
  '20260225000001_create_mai_talent_shows.sql',
  '20260225000002_create_mai_talent_judge_votes.sql',
  '20260225000003_add_is_judge_to_profiles.sql',
  '20260225000004_admin_read_all_users_policy.sql',
  '20260225000005_create_get_my_role_function.sql',
  '20260225000006_fix_admin_read_policy.sql',
  '20260225000007_create_mai_talent_v2_tables.sql',
  '20260225000008_add_show_id_to_votes.sql',
  '20260225000008_create_fill_stage_slot_function.sql',
  '20260225000009_create_leave_stage_function.sql',
  '20260225000009_update_mai_talent_judge_votes.sql',
  '20260225000010_add_end_pod_rpc.sql',
  '20260225000010_create_global_events.sql',
  '20260225000011_add_judge_seats.sql',
  '20260226000001_create_global_gift_system.sql',
  '20260227000000_enable_tcps_realtime.sql',
  '20260227000000_remove_daily_pod_limit_complete.sql',
  '20260227000001_create_giveaway_system.sql',
  '20260227100000_allow_all_users_broadcast.sql',
  '20260301180000_refresh_user_levels_from_gifts.sql',
  '20260301181000_create_refresh_user_levels_rpc.sql',
  '20260304000000_audio_safety_and_location_system.sql',
  '20260317000000_family_communication_hub.sql',
  '20260317000000_family_system_bootstrap.sql',
  '20260317000000_update_trollmin_entry_cost.sql',
  '20260321000000_update_cashout_tiers_final.sql',
  '20260322000000_create_rtc_sessions_table.sql',
  '20260322000000_fix_rls_policies.sql',
  '20260322000000_integrated_battle_system.sql',
  '20260322000000_marketplace_orders.sql',
  '20260322000001_fix_all_rls_policies.sql',
  '20260322000002_comprehensive_rls_fix.sql',
  '20260323000000_credit_marketplace_seller.sql',
  '20260325000000_fix_paid_seat_host_payout.sql',
  '20260331000000_empire_partner_referral_system.sql',
  '20260331000001_next_gen_live_streaming_system.sql',
  '20260404000000_marketplace_order_enhancements.sql',
  '20260405000000_marketplace_rls_policies.sql',
  '20260408000000_family_ban_member.sql',
  '20260409000000_fix_cashout_only_purchased_coins.sql',
  '20260409000001_cashout_escrow_system.sql',
  '20260409000002_cashout_notifications_cron.sql',
  '20260409160000_battle_sync_columns.sql',
  '20260409180000_battle_handshake.sql',
  '20260409190000_battle_matching_columns.sql',
  '20260409200000_atomic_battle_matching.sql',
  '20260409210000_authoritative_battle_system.sql',
  '20260409220000_strict_battle_handshake.sql',
  '20260410000000_troll_us_game_system.sql',
  '20260410000000_x_ads_system.sql',
  '20260410000001_battle_score_rpc.sql',
  '20260410140000_create_admin_notifications.sql',
  '20260411000000_stream_moderation_and_court_tables.sql',
  '20260411000000_troll_us_game.sql',
  '20260411000000_trollopoly_system.sql',
  '20260414000000_fix_neighbors_events.sql',
  '20260414000000_marketing_readonly_rls.sql',
  '20260414000001_fix_marketing_rls.sql',
  '20260415000000_comprehensive_court_fix.sql',
  '20260415000000_court_participants.sql',
  '20260415000000_emergency_fix.sql',
  '20260415000000_marketing_users_api.sql',
  '20260415000001_court_participants_rpc.sql',
  '20260416000000_fix_court_type_mismatches.sql',
  '20260417000000_add_is_active_to_web_push_subscriptions.sql',
  '20260417000001_drop_onesignal_tokens.sql',
  '20260420000000_add_mic_muted_to_stream_participants.sql',
  '20260420000001_add_global_chat_disabled.sql',
  '20260420000002_mod_actions_rpcs.sql',
  '20260420000003_add_updated_at_to_court_dockets.sql',
  '20260420000004_fix_jail_arrest_columns.sql',
  '20260420000005_auto_generate_court_dockets.sql',
  '20260420000006_fix_court_dockets_cases_count.sql',
  '20260420000007_fix_jail_and_court_columns.sql',
  '20260420000008_force_fix_columns.sql',
  '20260421235959_add_missing_court_columns.sql',
  '20260422000000_add_admin_analytics.sql',
  '20260425000000_fix_houses_owner_id_constraint.sql',
  '20260425000001_fix_car_purchase_vehicle_id.sql',
  '20260425000001_fix_houses_owner_id_direct.sql',
  '20260428000000_payout_window_control.sql',
  '20260429000000_create_app_bug_reports.sql',
  '20260506000000_add_subscription_system.sql',
  '20260508000001_fix_payout_requests_user_profiles_fkey.sql',
  '20260512051200_fix_cashout_tiers.sql',
  '20260513000003_enhanced_cashout_system.sql',
  '20260514000100_remove_president_requirements.sql',
  '20260515000001_cron_process_offline_notifications.sql',
  '20260515000002_clean_notification_schema.sql',
  '20260516000000_stream_seat_requests_queue.sql',
  '20260517000000_drop_mux_integration.sql',
  '20260518000000_trollseat_request_approval_pipeline.sql',
  '20260519000000_trollseat_broadcaster_approval.sql',
  '20260519000001_create_stream_stage_passes.sql',
  '20260519105111_expand_user_roles_check_constraint.sql',
  '20260519105400_add_reason_to_role_change_log.sql',
  '20260520000000_payout_methods_and_raid_logs.sql',
  '20260520113700_badge_tier_progress_and_showcase.sql',
  '20260520121011_user_specific_badges_and_troll.sql',
  '20260523000000_random_battle_activation_fix.sql',
  '20260526000001_create_support_goal_reminder_dismissals.sql',
  '20260526000001_troll_family_leagues_system.sql',
  '20260527000000_update_subscription_system.sql',
  '20260527202922_security_command_center.sql',
  '20260529_approve_empire_partner_tromail.sql',
  '20260529_coin_balance_cashout_system.sql',
  '20260529223744_fix_inmate_messages_rls.sql',
  '20260530_notify_on_post_mentions.sql',
  '20260530000000_add_vin_verification_to_vehicle_listings.sql',
  '20260530000000_church_live_and_mod.sql',
  '20260530000001_add_vehicle_listing_inspection_and_business_profile.sql',
  '20260604001000_add_is_streamer_user_profiles.sql',
  '20260604002000_add_payout_method_payout_requests.sql',
  '20260604003000_add_reviewed_by_payout_requests.sql',
  '20260604004000_drop_user_tax_info_auth_fk.sql',
  '20260604005000_disable_payout_lock.sql',
  '20260604006000_relax_payout_triggers.sql',
  '20260604007000_drop_payout_requests_auth_fk.sql',
  '20260604008000_drop_payout_requests_extra_fk.sql',
  '20260604009000_relax_admin_pool_fk.sql',
  '20260605000000_fix_everything_audit.sql',
  '20260606000000_admin_pool.sql',
  '20260606001000_relax_admin_pool_fk.sql',
  '20260606002000_conversation_members_user_fk.sql',
  '20260606002001_relax_streams_broadcaster.sql',
  '20260606003000_relax_action_logs_fk.sql',
  '20260607000000_admin_pool_v2.sql',
  '20260607000001_telemetry_events.sql',
  '20260608000000_live_broadcast_updates.sql',
  '20260608000001_shift_calendar_policy.sql',
  '20260609000000_fix_default_coins.sql',
  '20260609000001_officer_of_week_voting.sql',
  '20260609001000_extend_coin_transaction_types_troll_town.sql',
  '20260609002000_notify_payouts_open_once_per_day.sql',
  '20260609002001_fix_payout_notification_window.sql',
  '20260609004000_fix_payout_schedule_mst.sql',
  '20260609005000_update_coin_rate.sql',
];

function parseSQLFile(filename) {
  const filepath = path.join(migrationsDir, filename);
  let raw;
  try { raw = fs.readFileSync(filepath, 'utf-8'); } catch (_e) { return { error: `File not found: ${filepath}` }; }

  // For baseline: strip block comments
  let content = raw.replace(/\/\*[\s\S]*?\*\//g, ' /*cmt*/ ');

  // Split into lines (preserving line numbers for reference)
  const lines = content.split('\n');

  const tables = [];
  const columns = [];
  const views = [];
  const matViews = [];
  const functions = [];
  const triggers = [];
  const policies = [];
  const indexes = [];
  const enums = [];
  const compositeTypes = [];
  const storageBuckets = [];
  const publications = [];
  const extensions = [];
  const sequences = [];
  const _types = [];

  for (let i = 0; i < lines.length; i++) {
    let l = lines[i].trim();
    if (!l || l === '/*cmt*/') continue;

    let m;

    // CREATE TABLE / CREATE UNLOGGED TABLE
    m = l.match(/^CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?public"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/i);
    if (m) { tables.push(m[1]); continue; }

    // CREATE VIEW
    m = l.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_.]*)/i);
    if (m) { views.push(m[1]); continue; }

    // CREATE MATERIALIZED VIEW
    m = l.match(/^CREATE\s+MATERIALIZED\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_.]*)/i);
    if (m) { matViews.push(m[1]); continue; }

    // CREATE FUNCTION
    m = l.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z_][a-zA-Z0-9_.]*)/i);
    if (m) { functions.push(m[1]); continue; }

    // CREATE PROCEDURE
    m = l.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([a-zA-Z_][a-zA-Z0-9_.]*)/i);
    if (m) { functions.push(m[1] + ' [PROCEDURE]'); continue; }

    // CREATE TRIGGER
    m = l.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { triggers.push(m[1]); continue; }

    // CREATE POLICY
    m = l.match(/^CREATE\s+POLICY\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/i);
    if (m) { policies.push(m[1]); continue; }

    // CREATE INDEX / CREATE UNIQUE INDEX
    m = l.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { indexes.push(m[1]); continue; }

    // CREATE TYPE ... AS ENUM
    m = l.match(/^CREATE\s+TYPE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s+ENUM/i);
    if (m) { enums.push(m[1]); continue; }

    // CREATE TYPE ... AS (composite type)
    m = l.match(/^CREATE\s+TYPE\s+([a-zA-Z_][a-zA-Z0-9_.]+)\s+AS\s+\(/i);
    if (m) { compositeTypes.push(m[1]); continue; }

    // CREATE EXTENSION
    m = l.match(/^CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { extensions.push(m[1]); continue; }

    // CREATE SEQUENCE
    m = l.match(/^CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { sequences.push(m[1]); continue; }

    // ALTER TABLE ADD COLUMN
    m = l.match(/^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_.]+)\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { columns.push(`${m[1]}.${m[2]}`); continue; }
  }

  // Storage buckets: insert into storage.buckets
  const bucketRegex = /INSERT\s+INTO\s+storage\.buckets[\s\S]{0,500}?\(\s*'([^']+)'/gi;
  let bm;
  while ((bm = bucketRegex.exec(content)) !== null) {
    if (!storageBuckets.includes(bm[1])) storageBuckets.push(bm[1]);
  }

  // Publications
  const pubRegex = /(?:CREATE\s+PUBLICATION|ALTER\s+PUBLICATION)\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let pm;
  while ((pm = pubRegex.exec(content)) !== null) {
    if (!publications.includes(pm[1])) publications.push(pm[1]);
  }
  if (content.includes('supabase_realtime') && !publications.includes('supabase_realtime')) {
    publications.push('supabase_realtime');
  }

  // Drop statements for tracking
  const drops = [];
  const dropRegex = /DROP\s+(?:TABLE|VIEW|FUNCTION|TRIGGER|INDEX|SEQUENCE|TYPE|POLICY|MATERIALIZED\s+VIEW)\s+(?:IF\s+EXISTS\s+)?(?!ONLY)([a-zA-Z_][a-zA-Z0-9_,\s]*)/gi;
  let dm;
  while ((dm = dropRegex.exec(content)) !== null) {
    const cleaned = dm[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const n of cleaned) {
      if (/^[a-zA-Z_]/.test(n) && n.length < 80) drops.push(n);
    }
  }

  return { filename, tables, views, matViews, functions, triggers, policies, indexes, enums, compositeTypes, storageBuckets, publications, extensions, sequences, columns };
}

// Process all files
const allResults = {};
const globalTables = new Set();
const globalFunctions = new Set();
const globalTriggers = new Set();
const globalPolicies = new Set();
const globalIndexes = new Set();
const globalViews = new Set();

for (const f of requestedFiles) {
  const r = parseSQLFile(f);
  allResults[f] = r;
  if (!r.error) {
    r.tables.forEach(t => globalTables.add(t));
    r.functions.forEach(fn => globalFunctions.add(fn));
    r.triggers.forEach(t => globalTriggers.add(t));
    r.policies.forEach(p => globalPolicies.add(p));
    r.indexes.forEach(idx => globalIndexes.add(idx));
    r.views.forEach(v => globalViews.add(v));
    r.matViews.forEach(v => globalViews.add(v));
  }
}

const summary = {
  totalFiles: requestedFiles.length,
  filesProcessed: Object.values(allResults).filter(r => !r.error).length,
  filesNotFound: Object.values(allResults).filter(r => r.error).map(r => r.error),
  totalUniqueTables: globalTables.size,
  totalUniqueFunctions: globalFunctions.size,
  totalUniqueTriggers: globalTriggers.size,
  totalUniquePolicies: globalPolicies.size,
  totalUniqueIndexes: globalIndexes.size,
  totalUniqueViews: globalViews.size,
};

allResults._summary = summary;

fs.writeFileSync(outputFilePath, JSON.stringify(allResults, null, 2));

console.log(`Done. ${summary.filesProcessed} files processed, ${summary.filesNotFound.length} not found.`);
console.log(`Unique tables: ${summary.totalUniqueTables}`);
console.log(`Unique functions: ${summary.totalUniqueFunctions}`);
console.log(`Unique triggers: ${summary.totalUniqueTriggers}`);
console.log(`Unique policies: ${summary.totalUniquePolicies}`);
console.log(`Unique indexes: ${summary.totalUniqueIndexes}`);
console.log(`Unique views (incl materialized): ${summary.totalUniqueViews}`);

// Print per-file summary
for (const f of requestedFiles) {
  const r = allResults[f];
  if (r.error) { console.log(`\n${f}: FILE NOT FOUND`); continue; }
  const count = r.tables.length + r.views.length + r.matViews.length + r.functions.length + r.triggers.length + r.policies.length + r.indexes.length + r.enums.length + r.extensions.length + r.columns.length;
  if (count === 0) {
    console.log(`${f}: (no DDL - data migration only)`);
    continue;
  }
  console.log(`${f}: ${r.tables.length}T/${r.views.length + r.matViews.length}V/${r.functions.length}F/${r.triggers.length}G/${r.policies.length}P/${r.indexes.length}I/${r.enums.length}E/${r.extensions.length}Ext/${r.columns.length}C`);
}
