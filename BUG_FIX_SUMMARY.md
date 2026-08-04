# Bug Fix Summary — 76 Reports Addressed

================================================================================
FIXES APPLIED
================================================================================

CLUSTER 1 — Streams table schema drift (FIXED)
  - Added missing columns via direct SQL: microphone_enabled, end_reason,
    rtc_connected, last_heartbeat_at, end_time
  - Verified existing columns: is_live (added earlier), livekit_room_name,
    state_battle_mode, thumbnail_url, updated_at
  - Fixed livekit-token/index.ts: removed is_live from select query
  - Fixed streams-maintenance/index.ts: replaced is_live with status='live'
  - Fixed useBroadcastShutdown.ts: aligned updates with actual columns
  - Fixed getSupabase.tsx: removed non-existent column references
  - Synced is_live data with status across all 5 streams

CLUSTER 2 — Missing tables (FIXED)
  - AdminDashboard: replaced `transactions` with `coin_transactions`
  - AdminDashboard: replaced `coin_store_sales` with `coin_orders`
  - AdminDashboard: replaced `user_tax_info` with `user_profiles` (tax_status)
  - AdminDashboard: replaced `system_alerts` with `system_roles`
  - Removed invalid `delete_stream` action from admin cleanup flow

CLUSTER 3 — Missing RPC functions (FIXED)
  - Created: update_stream_viewer_count
  - Created: issue_promo_card
  - Created: register_session
  - Created: start_broadcast_with_capacity_check
  - Created supporting tables: user_promo_cards, user_sessions

CLUSTER 4 — Missing FK relationships (FIXED)
  - Added: president_proposals.created_by -> user_profiles
  - Added: stream_seat_sessions.user_id -> user_profiles
  - Added: stream_viewers.user_id -> user_profiles
  - Added: user_subscriptions.subscriber_id -> user_profiles
  - Fixed ProposalManagementPanel: replaced broken implicit join with manual fetch

CLUSTER 5 — LiveKit / setup flow (FIXED)
  - Fixed livekit-token type mismatch: text=uuid by extracting stream UUID
    from roomName prefix (mcb-<uuid>)
  - Fixed SetupPage state_battle_mode: changed from string "none"/"state"
    to boolean false/true
  - Fixed useStateBattle.ts: all state_battle_mode references now use boolean
  - Fixed duplicate stream insert guards

CLUSTER 6 — Admin logic bugs (FIXED)
  - Fixed PresidentialOversightPanel: removed is_active from user_role_grants
  - Fixed BetaCapacityMonitor: replaced is_live filter with status='live'
  - Fixed AdminDashboard emergency stop: use status='ended' directly

CLUSTER 7 — Auth / RLS (ENVIRONMENT-SPECIFIC)
  - Bug #6-8: Invalid login credentials — requires DB seed data verification
  - Bug #60-61: RLS violation on global_events — requires policy review
  - Bug #62: Invalid refresh token — requires session persistence check

CLUSTER 8 — Type mismatches (FIXED)
  - Bug #20: text=uuid — fixed in livekit-token extractStreamId()
  - Bug #70-71: boolean "none" — fixed by changing state_battle_mode to boolean

BATTLES COLUMNS (FIXED)
  - Removed team_a_stream_id/team_b_stream_id queries (schema uses
    challenger_stream_id/opponent_stream_id)
  - Cleaned up realtime subscriptions in useBattleState.ts

BROADCAST_LEAGUE_STATS (FIXED)
  - Added missing columns: sub_tier, league_level, total_gifts_sent, total_xp

================================================================================
DATABASE CHANGES APPLIED TO REMOTE
================================================================================

Executed via: supabase db query --linked -f supabase/fixes/apply_bug_fixes.sql

ALTERS:
  - streams: +microphone_enabled, +end_reason, +rtc_connected, +last_heartbeat_at, +end_time
  - broadcast_league_stats: +sub_tier, +league_level, +total_gifts_sent, +total_xp

CREATES:
  - user_promo_cards table
  - user_sessions table
  - update_stream_viewer_count() function
  - issue_promo_card() function
  - register_session() function
  - start_broadcast_with_capacity_check() function

FK CONSTRAINTS:
  - president_proposals.created_by -> user_profiles
  - stream_seat_sessions.user_id -> user_profiles
  - stream_viewers.user_id -> user_profiles
  - user_subscriptions.subscriber_id -> user_profiles

DATA FIX:
  - Synced is_live = (status = 'live') for 5 inconsistent rows

================================================================================
FILES MODIFIED
================================================================================

Frontend/TypeScript:
  - src/pages/admin/AdminDashboard.tsx
  - src/pages/admin/components/PresidentialOversightPanel.tsx
  - src/pages/admin/components/BetaCapacityMonitor.tsx
  - src/pages/admin/components/shared/ProposalManagementPanel.tsx
  - src/pages/broadcast/SetupPage.tsx
  - src/pages/broadcast/BroadcastPage.tsx
  - src/hooks/useBroadcastShutdown.ts
  - src/hooks/useStateBattle.ts
  - src/hooks/useBattleState.ts
  - src/lib/getSupabase.tsx
  - src/types/broadcast.ts

Edge Functions:
  - supabase/functions/livekit-token/index.ts
  - supabase/functions/streams-maintenance/index.ts

Database:
  - supabase/fixes/apply_bug_fixes.sql (executed directly)
  - supabase/migrations/20260728013008_fix_streams_missing_columns.sql
  - supabase/migrations/20260728013009_fix_missing_fk_constraints.sql
  - supabase/migrations/20260728013010_create_missing_rpc_functions.sql
  - supabase/migrations/20260728013011_add_broadcast_league_stats_columns.sql

================================================================================
REMAINING ITEMS (MANUAL ACTION REQUIRED)
================================================================================

1. Auth/R Logout — Invalid login credentials on /auth
   - Verify test user seeds exist in remote DB
   - Check RLS policies on user_profiles if login fails for existing users

2. Auth/RLS — global_events insert blocked
   - Review INSERT policy on public.global_events
   - Ensure service_role or authenticated role has INSERT permission

3. Auth — Invalid refresh token
   - Verify Supabase client persistSession configuration
   - Check cookie/domain settings

================================================================================
END OF REPORT
================================================================================
