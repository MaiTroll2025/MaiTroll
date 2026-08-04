# Supabase Edge Functions - Table & RPC Audit

**Project:** Mai Troll  
**Date:** 2026-06-10  
**Scope:** All edge functions under `supabase/functions/` (100+ directories)

---

## A) ALL TABLE NAMES REFERENCED IN EDGE FUNCTIONS

### _shared (Shared Utilities)
- `badge_catalog`
- `user_badges`
- `purchasable_items`
- `coin_packages`

### add-card
- *(no direct table references found)*

### admin
- `user_profiles`
- `app_settings`
- `support_tickets`
- `coin_transactions`
- `earnings_payouts`
- `payout_requests`

### admin-actions (+ index_full.ts)
- `user_profiles`
- `payout_requests`
- `cashout_requests`
- `executive_intake`
- `manual_coin_orders`
- `coin_packages`
- `coin_transactions`
- `applications`
- `interview_sessions`
- `stream_reports`
- `messages`
- `streams`
- `support_tickets`

### admin-reset
- `user_profiles`
- `streams`
- `streams_participants`

### adminScheduler
- `scheduled_announcements`
- `admin_broadcasts`

### admin-stats
- `profiles`
- `applications`
- `payout_requests`
- `admin_flags`
- `coin_transactions`
- `earnings_payouts`
- `sav_promotions`
- `punishment_fines`

### admin-stock-manager
- `user_profiles`
- `stocks`
- `stock_price_history`
- `user_portfolio`

### agency-weekly-evaluation
- `agency_settings`
- `notifications`

### agora-stream
- `agora_stream_sessions`
- `streams`

### agora-media-gateway
- *(no direct table references found)*

### agora-token
- *(no direct table references found)*

### agora-walkie-token
- *(no direct table references found)*

### ai-detect-ghost-inactivity
- `user_profiles`

### ai-verify-user
- `user_profiles`
- `abuse_reports`
- `verification_requests`

### apply-punishment
- `user_profiles`

### auth
- `app_settings`
- `user_profiles`
- `organizations`
- `organization_students`
- `organization_members`
- `organization_audit_logs`
- `organization_admins`
- `referrals`

### auto-clock-out
- `officer_work_sessions`

### award-badge
- *(uses shared badges.ts → `badge_catalog`, `user_badges`)*

### bank-apply
- `bank_audit_log`

### bank-credit
- `user_profiles`
- `bank_audit_log`

### battles
- *(no direct table references — uses RPC only)*

### broadcast-seats
- `user_profiles`
- `broadcast_seats`
- `broadcast_seat_bans`

### calc_post_earnings
- `troll_posts`

### capture-content
- `ad-assets` (storage bucket, not DB table)
- `source_content_refs`

### charge-stored-card
- *(no direct table references found)*

### close-officer-vote-cycle
- `officer_vote_cycles`
- `officer_votes`
- `officer_assignments`
- `vote_events` (commented out)

### complete-ghost-mission
- `officer_mission_logs`
- `user_profiles`

### create-paypal-order
- *(no direct table references found)*

### create-square-checkout
- `user_profiles` (via REST API)

### create-square-customer
- *(no direct table references found)*

### credit-daily-maintenance
- `credit_events`
- `user_credit`

### credit-loan-handler
- *(no direct table references — calls credit-record-event RPC)*

### credit-record-event
- `credit_events`
- `user_credit`

### credit-small-purchase-milestone
- `small_installment_purchases`
- `installment_milestone_events`

### cron-tasks
- *(no direct table references — uses RPC only)*

### customer-service-admin
- `user_profiles`
- `admin_password_resets`
- `customer_service_audit_logs`

### debug-push
- `web_push_subscriptions`

### delete-account
- `user_profiles`
- `notifications`
- `account_deletion_reasons`
- `coin_ledger`
- `stream_viewers`
- `stream_likes`
- `stream_chat`
- `stream_gifts`
- `stream_seats`
- `streams`
- `troll_family_members`
- `troll_families`
- `neighbors`
- `friend_requests`
- `user_reports`
- `moderation_cases`
- `stream_reports`
- `auth.users`

### delete-user-account
- `user_profiles`
- `streams`
- `admin_notifications`
- `user_coins`
- `user_follows`
- `user_blocks`
- `user_perks`
- `user_insurances`
- `user_call_sounds`
- `user_entrance_audio`
- `user_achievements`
- `stream_seat_sessions`
- `gift_transactions`
- `payout_requests`
- `notifications`
- `applications`
- `officer_assignments`
- `troll_wheel_wins`
- `pod_participants`
- `pod_room_participants`
- `house_participants`
- `vehicle_participants`

### dismiss-notification
- `notifications`

### end-home-feature-cycle
- `home_feature_cycles`

### evaluate-badges-for-event
- *(uses shared badges.ts → `badge_catalog`, `user_badges`)*

### evaluate-missions
- `stream_missions`
- `user_badges`

### expire-officer-roles
- `officer_assignments`

### fulfill-paypal-purchase
- `coin_packages`
- `purchasable_items`

### gemini-verify-user
- *(no direct table references found)*

### generate-ad
- *(no direct table references found)*

### generate-obs-credentials
- `streams`

### generate-pdf
- *(no direct table references found)*

### get-training-scenario
- *(no direct table references found — uses local fallback data)*

### ghost-mode
- `user_profiles`
- `streams`
- `ghost_stream_sessions`

### global-ticker-notify
- *(no direct table references — uses RPC only)*

### go-live-mark-live
- *(no direct table references found)*

### go-live-refund-hd-boost
- *(no direct table references — uses RPC only)*

### live
- `user_profiles`
- `streams`
- `user_follows`

### livekit-gaming
- *(no direct table references found)*

### livekit-token
- *(no direct table references found)*

### livekit-webhooks
- *(no direct table references found)*

### loan-payment
- `loans`
- `loan_payments`
- `credit_scores`

### log-moderation-event
- `moderation_events`

### magicbell-jwt
- *(no direct table references found)*

### mai-talent-timer-watcher
- *(no direct table references — uses RPC only)*

### mai-talent-v2-orchestrator
- *(no direct table references — uses RPC only)*

### manual-coin-order
- *(no direct table references — uses RPC only)*

### moderation
- `user_profiles`
- `moderation_reports`
- `moderation_actions`
- `streams`
- `notifications`

### officer-actions
- `user_profiles`
- `officer_timesheets`
- `officer_warrants`

### officer-auto-clockout
- `officer_live_assignments`
- `officer_work_sessions`
- `user_profiles`

### officer-get-assignment
- `officer_live_assignments`
- `streams`

### officer-join-stream
- `user_profiles`
- `officer_live_assignments`
- `officer_work_sessions`

### officer-leave-stream
- `officer_live_assignments`
- `officer_work_sessions`
- `user_profiles`

### officer-report-abuse
- `user_profiles`
- `abuse_reports`

### officer-touch-activity
- `officer_live_assignments`

### password-manager
- *(no direct table references — uses RPC only)*

### payments
- *(no direct table references found)*

### payments-status
- *(no direct table references found)*

### paypal-complete-order
- *(no direct table references — uses RPC only)*

### paypal-create-order
- *(no direct table references — uses RPC only)*

### paypal-health
- *(no TypeScript file found)*

### paypal-payout
- *(no direct table references — uses RPC only)*

### paypal-verify-transaction
- *(no direct table references found)*

### paypal-webhook
- `user_profiles`
- `transactions`

### ping
- *(no direct table references found)*

### platform-fees
- *(no direct table references found — stub function)*

### process-audio-queue
- `audio_queue`

### process-audio-safety
- *(no direct table references — uses RPC only)*

### process-offline-notifications
- `offline_notifications`
- `web_push_subscriptions`

### process-payout-batch
- `user_profiles`
- `payout_batches`
- `payout_requests`

### process-referral-bonuses
- *(no direct table references — uses RPC only)*

### publish-social
- `social_publish_queue`
- `connected_social_accounts`

### push-notifications
- `web_push_subscriptions`

### report-bug
- `profiles`
- `bug_alerts`

### save-card
- *(no direct table references found)*

### select-winner
- `mai_talent_votes`

### send-announcement
- *(no direct table references — uses RPC only)*

### send-bulk-notifications
- *(no direct table references — uses RPC only)*

### sendEmail
- *(no direct table references found)*

### send-like
- *(no direct table references — uses RPC only)*

### send-message
- *(no direct table references found)*

### shadow-ban-user
- `user_profiles`
- `shadow_bans`
- `moderation_events`

### social-oauth-callback
- `connected_social_accounts`

### social-oauth-init
- *(no direct table references found)*

### square-save-card
- *(no direct table references found)*

### square-webhook
- *(no direct table references — calls verify-square-payment)*

### start-officer-vote-cycle
- `officer_vote_cycles`
- `user_profiles`
- `vote_events`

### stock-gamification
- `stocks`
- `stock_market_settings`
- `user_portfolio`

### stock-price-engine
- `stocks`
- `stock_price_history`
- `streams`
- `battles`

### store-user-geolocation
- *(no direct table references — uses RPC only)*

### stream-health-monitor
- `streams`

### streams-maintenance
- `streams`
- `user_profiles`
- `battles`

### submit-training-response
- *(no direct table references — uses RPC only)*

### toggle-ghost-mode
- `user_profiles`
- `officer_live_assignments`

### track-guest
- `guest_tracking`
- `guest_stream_sessions`

### troll-battle
- `troll_battles`
- `streams`

### trollcourt-ai
- `user_profiles`
- `court_ai_feedback`

### troll-events
- `streams`
- `troll_events`
- `troll_event_claims`
- `user_profiles`

### troll-us-game
- `games`
- `game_players`
- `game_votes`
- `streams`

### universal-battle
- `streams`
- `stream_seats`

### update-notification-preferences
- `user_profiles`

### upload-to-cloudflare-stream
- `streams`

### user-agreements
- *(no direct table references — uses RPC only)*

### verify-paypal-payment
- `coin_transactions`
- `purchase_ledger`
- `purchasable_items`

### verify-square-payment
- *(no direct table references found)*

### verify-user-complete
- *(no direct table references found)*

### vote-for-officer
- *(no direct table references found)*

### shared/log-bug-report
- *(no direct table references — uses RPC only)*

---

## B) ALL RPC FUNCTION NAMES REFERENCED IN EDGE FUNCTIONS

### admin
- `spawn_troll_event`
- `claim_troll_event`

### admin-actions (+ index_full.ts)
- `log_admin_action`
- `process_cashout_refund`
- `approve_manual_order`
- `admin_update_any_profile_field`
- `troll_bank_credit_coins`
- `troll_bank_spend_coins_secure`
- `ban_user`
- `admin_soft_delete_user`
- `notify_user_rpc`
- `set_user_role`
- `is_lead_officer_position_filled`
- `send_tromail_message`
- `deny_application`
- `resolve_support_ticket`
- `delete_support_ticket`

### agency-weekly-evaluation
- `run_weekly_agency_evaluation`

### ai-detect-ghost-inactivity
- `detect_ghost_inactivity`

### apply-punishment
- `deduct_user_coins`

### auth
- `is_org_admin_member`
- `is_tc_staff`
- `handle_referral_signup`

### auto-clock-out
- `troll_bank_credit_coins`

### bank-apply
- `troll_bank_apply_for_loan`

### bank-credit
- `troll_bank_credit_coins`

### battles
- `captain_click_battle`
- `award_battle_crowns`

### broadcast-seats
- `claim_broadcast_seat`
- `release_broadcast_seat`

### calc_post_earnings
- `get_post_engagement`
- `credit_free_coins`

### credit-record-event
- `get_loan_stats`

### cron-tasks
- `decay_broadcast_levels`
- `process_admin_queue`
- `check_loan_defaults`
- `enforce_lmpm_durations`
- `auto_release_inmates`
- `clear_background_jail`

### end-home-feature-cycle
- `end_home_feature_cycle`

### evaluate-missions
- `award_xp`

### fulfill-paypal-purchase
- `troll_bank_credit_coins`

### global-ticker-notify
- `bulk_create_notifications`

### go-live-refund-hd-boost
- `troll_bank_credit_coins`

### live
- `award_birthday_coins_if_eligible`

### mai-talent-timer-watcher
- `leave_stage_and_fill_next`

### mai-talent-v2-orchestrator
- `fill_stage_slot`
- `leave_stage_and_fill_next`

### manual-coin-order
- `check_rate_limit`
- `apply_troll_pass_bundle`
- `troll_bank_credit_coins`

### moderation
- `admin_update_ban_status`

### officer-actions
- `find_opponent`

### password-manager
- `set_password_reset_pin`

### paypal-complete-order
- `check_rate_limit`

### paypal-create-order
- `check_rate_limit`

### paypal-payout
- `troll_bank_finalize_cashout`

### process-audio-safety
- `create_safety_alert`

### process-referral-bonuses
- `get_user_monthly_coins_earned`
- `troll_bank_credit_coins`

### send-announcement
- `bulk_create_notifications`

### send-bulk-notifications
- `bulk_create_notifications`

### send-like
- `add_stream_like`

### shared/log-bug-report
- `log_app_bug_report`

### store-user-geolocation
- `store_user_geolocation`
- `log_admin_audit`

### submit-training-response
- `promote_trainee` (inferred from context)

### troll-events
- `troll_bank_credit_coins`

### universal-battle
- `increment_battle_score`

### user-agreements
- `record_agreement_acceptance`
- `has_accepted_agreement`

### _shared/paypalStoreFulfillment.ts
- `troll_bank_credit_coins`

---

## DEDUPLICATED MASTER LISTS

### Master Table List (Sorted, Unique)

```
abuse_reports
account_deletion_reasons
admin_broadcasts
admin_flags
admin_notifications
admin_password_resets
agency_settings
agora_stream_sessions
app_settings
applications
audio_queue
bank_audit_log
battles
broadcast_seat_bans
broadcast_seats
bug_alerts
cashout_requests
coin_ledger
coin_packages
coin_transactions
connected_social_accounts
court_ai_feedback
credit_events
credit_scores
customer_service_audit_logs
earnings_payouts
executive_intake
friend_requests
games
game_players
game_votes
ghost_stream_sessions
guest_stream_sessions
guest_tracking
home_feature_cycles
installment_milestone_events
interview_sessions
loans
loan_payments
mai_talent_votes
manual_coin_orders
messages
moderation_actions
moderation_cases
moderation_events
moderation_reports
neighbors
notifications
officer_assignments
officer_live_assignments
officer_mission_logs
officer_timesheets
officer_vote_cycles
officer_votes
officer_warrants
offline_notifications
organization_admins
organization_audit_logs
organization_members
organization_students
organizations
pod_participants
pod_room_participants
house_participants
vehicle_participants
payout_batches
payout_requests
platform_fees (stub)
profiles
purchasable_items
referrals
sav_promotions
scheduled_announcements
shadow_bans
small_installment_purchases
social_publish_queue
source_content_refs
stocks
stock_market_settings
stock_price_history
stream_chat
stream_gifts
stream_likes
stream_missions
stream_reports
stream_seat_sessions
stream_seats
stream_viewers
streams
streams_participants
support_tickets
transactions
troll_battles
troll_event_claims
troll_events
troll_family_members
troll_families
troll_posts
troll_wheel_wins
user_achievements
user_badges
user_blocks
user_call_sounds
user_coins
user_credit
user_entrance_audio
user_follows
user_insurances
user_perks
user_portfolio
user_profiles
user_reports
verification_requests
vote_events
web_push_subscriptions
```

### Master RPC Function List (Sorted, Unique)

```
add_stream_like
admin_soft_delete_user
admin_update_any_profile_field
admin_update_ban_status
apply_troll_pass_bundle
approve_manual_order
auto_release_inmates
award_battle_crowns
award_birthday_coins_if_eligible
award_xp
ban_user
bulk_create_notifications
captain_click_battle
check_loan_defaults
check_rate_limit
claim_broadcast_seat
claim_troll_event
clear_background_jail
create_safety_alert
credit_free_coins
decay_broadcast_levels
deduct_user_coins
delete_support_ticket
deny_application
detect_ghost_inactivity
end_home_feature_cycle
enforce_lmpm_durations
fill_stage_slot
find_opponent
get_loan_stats
get_post_engagement
get_user_monthly_coins_earned
handle_referral_signup
has_accepted_agreement
increment_battle_score
is_lead_officer_position_filled
is_org_admin_member
is_tc_staff
leave_stage_and_fill_next
log_admin_action
log_admin_audit
log_app_bug_report
notify_user_rpc
process_admin_queue
process_cashout_refund
promote_trainee
record_agreement_acceptance
release_broadcast_seat
resolve_support_ticket
run_weekly_agency_evaluation
send_tromail_message
set_password_reset_pin
set_user_role
spawn_troll_event
store_user_geolocation
troll_bank_apply_for_loan
troll_bank_credit_coins
troll_bank_finalize_cashout
troll_bank_spend_coins_secure
```

---

**Total Unique Tables Referenced:** ~130  
**Total Unique RPC Functions Referenced:** ~65  
**Total Edge Function Directories Scanned:** 100+
