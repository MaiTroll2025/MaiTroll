# Supabase Usage Extraction from Frontend Code

> Generated: 2026-05-31. Covers all frontend code in `src/` directory.
> 141 hooks, 20 Zustand stores, 10 context providers analyzed.
> ~714 .rpc() calls, ~80 realtime channels, 15+ storage buckets.

---

## PART A: FRONTEND DATABASE TABLE USAGE (`.from()`)

### Core/High-Traffic Tables

| Table | Files Using It | Operations | Active On Load | Routes/Components |
|-------|---------------|------------|----------------|-------------------|
| `user_profiles` | 80+ files | select, insert, update, upsert, delete | Yes (almost every page) | All pages |
| `streams` | 20+ files | select, insert, update, delete | Yes | Broadcast, Viewer, Explore, Neighborhood, Admin |
| `notifications` | 10+ files | select, insert, update, delete | Yes | TCPS, Jail, Family, Admin |
| `user_follows` | 5+ files | select, insert, delete | Yes | Profile, Broadcast |
| `user_stats` | 5+ files | select | Yes | Profile, XP Store |

### Messaging

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `conversations` | 3 files | select, insert, delete | Yes | TCPS, Inmates |
| `conversation_members` | 3 files | select, insert, delete | Yes | TCPS, Inmates |
| `conversation_messages` | 3 files | select, insert, delete | Yes | TCPS, Inmates |
| `officer_chat_messages` | 2 files | select, insert, delete | Yes | TCPS, Inbox |

### Economy / Wallet

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `coin_transactions` | 5 files | select | Yes (admin) | Profile, Admin |
| `paypal_transactions` | 2 files | select | Yes (admin) | Admin |
| `payout_requests` | 8 files | select, update | Yes (admin, cashout) | Admin, Cashout |
| `economy_summary` | 2 files | select (view) | Yes (admin) | Admin |
| `earnings_payouts` | 2 files | select | Yes (admin) | Admin |

### Broadcast / Live

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `stream_messages` | 2 files | select, insert | Yes | Broadcast, Viewer |
| `stream_gifts` | 2 files | select | Yes | Broadcast, Chat |
| `stream_mutes` | 2 files | select, insert | Yes | Broadcast |
| `stream_moderators` | 3 files | select | Yes | Broadcast, Viewer, Chat |
| `stream_settings` | 1 file | select | Yes | Chat |
| `stream_viewers` | 1 file | select | Yes | Broadcast |
| `battles` | 2 files | select, insert, update | Yes | BattleView |
| `rtc_sessions` | 3 files | select, insert | Yes | Broadcast, TCNN |

### Live Streaming Features

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `stream_missions` | 2 files | select | Yes | Live features |
| `stream_goals` | 2 files | select | Yes | Live features |
| `stream_polls` | 1 file | select, insert, update | Yes | Broadcast |
| `poll_votes` | 1 file | select, insert | Yes | Broadcast |
| `stream_milestones` | 2 files | select | Yes | Live features |
| `stream_energy_meter/meters` | 2 files | select | Yes | Live features |
| `stream_fan_tiers` | 3 files | select | Yes | Live features |
| `stream_awards` | 2 files | select | Yes | Live features |

### Marketplace / Shop

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `marketplace_items` | 3 files | select, update | Yes | Profile, Marketplace, Seller |
| `marketplace_purchases` | 2 files | select, insert | Yes | Seller, Auction |
| `vehicle_listings` | 3 files | select | Yes | Profile, Marketplace, Sell |
| `service_listings` | 1 file | select | Yes | Marketplace |
| `shop_items` | 2 files | select, insert | Yes | Marketplace, Sell |
| `shop_transactions` | 1 file | select | Yes | Sell |
| `business_profiles` | 3 files | select, insert | Yes | Marketplace, Sell |
| `Mai Troll_shops` | 2 files | select, insert | Yes | Marketplace, Sell |

### Auctions

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `auction_shows` | 5 files | select, insert, update, delete | Yes | Auction pages |
| `auction_lots` | 8 files | select, insert, update | Yes | Auction pages |
| `auction_bids` | 2 files | select | Yes | Auctions |
| `auction_wins` | 2 files | select | Yes | Auctions |
| `auctioneer_profiles` | 5 files | select | Yes | Auction pages |
| `auction_reports` | 1 file | select | Yes | Auction reports |
| `auction_presence` | 1 file | select, upsert | Yes | Live auction |

### Neighborhood / City

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `neighborhoods` | 3 files | select | Yes | Map, Onboarding |
| `neighborhood_members` | 1 file | select, insert | Yes | Neighborhood |
| `houses` | 4 files | select, insert | Yes | Map, Onboarding |
| `house_raids` | 2 files | select, insert | Yes | Neighborhood |
| `homeowners_insurances` | 3 files | select | Yes | Neighborhood |
| `user_licenses` | 3 files | select, insert | Yes | Map, Onboarding |
| `vehicles` | 1 file | select, insert, update, delete | Yes | Vehicle system |
| `vehicle_loans` | 1 file | select, insert | Yes | Vehicle system |
| `user_vehicles` | 2 files | select | Yes | Profile, Secretary |
| `properties` | 2 files | select, insert, delete | Yes | Profile, Landlord |
| `troll_wall_posts` | 2 files | select, delete | Yes | TrollWall |

### Jail / Court / Government

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `jail` | 7 files | select, update, insert | Yes | Jail, Broadcast, Gov |
| `court_cases` | 2 files (reference) | - | - | Via RPCs |
| `government_laws` | 1 file | select | Yes | Government |
| `law_votes` | 1 file | select | Yes | Government |
| `bribe_logs` | 1 file | select | Yes | Government |
| `protests` | 1 file | select | Yes | Government |
| `protest_participants` | 1 file | select | Yes | Government |
| `president_elections` | 1 file | select, insert | Yes | President |
| `government_history` | 1 file | select | Yes | Government |

### Family

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `troll_families` | 2 files | select | Yes | Family Browse |
| `family_members` | 5 files | select | Yes | Family pages |
| `troll_family_members` | 2 files | select | Yes | Family profile |

### Church

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `church_prayers` | 1 file | select, insert, delete | Yes | Prayer Feed |
| `church_prayer_likes` | 1 file | select, insert, delete | Yes | Prayer Feed |
| `church_prayer_replies` | 1 file | select, insert | Yes | Prayer Feed |
| `church_sermon_notes` | 1 file | select, insert | Yes | Pastor |
| `church_live_sessions` | 2 files | select, update | Yes | Church |
| `admin_broadcasts` | 2 files | select, insert | Yes | Church, Announce |
| `troll_church_daily_words` | 1 file | select | Yes | Church |

### User Profile Detail

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `user_perks` | 1 file | select | Yes | Profile |
| `user_entrance_effects` | 1 file | select | Yes | Profile |
| `user_insurances` | 1 file | select | Yes | Profile |
| `insurance_plans` | 1 file | select | Yes | Profile |
| `insurance_options` | 1 file | select | Yes | Profile |
| `user_inventory` | 2 files | select | Yes | Profile, Admin |
| `user_blocks` | 1 file | select | Yes | Profile |
| `user_credit` | 1 file | select | Yes | Broadcast |
| `user_reputation` | 1 file | select | Yes | Government |

### Admin / Support

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `support_tickets` | 2 files | select | Yes | Admin |
| `admin_password_resets` | 1 file | select | Yes | CS Panel |
| `customer_service_audit_logs` | 2 files | select, insert | Yes | CS Dashboard |
| `support_screen_sessions` | 1 file | select, update | Yes | Support |
| `system_alerts` | 1 file | select | Yes | Admin |
| `system_errors` | 1 file | insert | On error | All |
| `security_events` | 1 file | select | Yes | Security |
| `security_user_risk_scores` | 1 file | select | Yes | Security |
| `security_rate_limits` | 1 file | select | Yes | Security |
| `security_incident_reports` | 1 file | select | Yes | Security |
| `audit_logs` | 3 files | select | Yes | Admin, CEO |
| `user_reports` | 4 files | select | Yes | Admin, CEO |

### TCNN

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `pod_rooms` | 2 files | select | Yes | Explore, Home |
| `podcast_rtc_logs` | 1 file | insert | On call | Podcast |

### Misc

| Table | Files | Operations | Active On Load | Routes |
|-------|-------|------------|----------------|--------|
| `user_relationships` | 2 files | select | Yes | TCPS |
| `user_mutes` | 1 file | insert | Action | Government |
| `user_jails` | 1 file | insert | Action | Government |
| `user_bans` | 1 file | insert | Action | Government |
| `gift_items` | 2 files | select | Yes | Broadcast |
| `gift_transactions` | 2 files | select | Yes | Top Broadcasters |
| `gift_ledger` | 1 file | select | Yes | Broadcast |
| `broadcast_rankings` | 1 file | select | Yes | Home |
| `broadcast_league_stats` | 1 file | select | Yes | City |
| `purchasable_items` | 2 files | select | Yes | Gift Tray, Admin |
| `troll_posts` | 1 file | count | Yes | Profile |
| `organizations` | 2 files | select, insert | Yes | Profile, Org |
| `organization_members` | 1 file | select | Yes | Org |
| `organization_admins` | 2 files | select | Yes | Profile, Sidebar |
| `officer_members` | 1 file | select | Yes | Sidebar |
| `active_sessions` | 1 file | update | Yes | Auth store |
| `global_events` | 1 file | insert | Yes | Broadcast Setup |
| `web_push_subscriptions` | 1 file | upsert | Yes | PWA |
| `app_settings` (store) | 1 file | select, insert, update, subscribe | Yes | AppSettings |
| `user_presence_routes` | 2 files | select, upsert | Yes | CS, Presence |
| `user_presence` | 1 file | select | Yes | RTC Monitor |
| `moderation_reports` | 1 file | insert | Action | Broadcast |
| `call_rooms` | 1 file | insert | Action | TCPS |
| `call_minutes` | 2 files | select, insert | Yes | Profile, TCPS |

---

## PART B: RPC USAGE (`.rpc()`)

### Stream / Broadcast RPCs

| RPC | Files | Components |
|-----|-------|------------|
| `join_seat_atomic` | useStreamSeats.ts | Seat management |
| `leave_seat_atomic` | useStreamSeats.ts | Seat management |
| `approve_seat_request` | useStreamSeats.ts | Seat management |
| `deny_seat_request` | useStreamSeats.ts | Seat management |
| `mark_stream_seat_live` | useStreamSeats.ts | Seat management |
| `update_stream_viewer_count` | useStreamStats.ts | Stream stats |
| `send_gift_in_stream` | useGiftSystem.ts | Gift system |
| `add_stream_like` | hooks/useStreamLike.ts | Likes |
| `arrest_user` | ModActionsPopup.tsx | Jail |
| `ban_user_from_stream` | UserActionModal.tsx | Ban |
| `ban_user` | RTCAdminMonitor.tsx | Ban |
| `kick_user_paid` | UserActionModal.tsx | Paid kick |
| `moderator_mute_user` | ModActionsPopup.tsx | Mute |
| `moderator_unmute_user` | ModActionsPopup.tsx | Unmute |
| `moderator_disable_chat` | ModActionsPopup.tsx | Chat disable |
| `moderator_kick_user` | ModActionsPopup.tsx | Kick |
| `moderator_delete_stream_message` | - | Chat mod |
| `is_user_chat_blocked` | - | Chat block check |
| `assign_broadofficer` | UserActionModal.tsx | Officer promote |
| `applyTrollSpell` | UserActionModal.tsx | Troll spell |
| `award_battle_crowns` | - | Battle rewards |
| `captain_click_battle` | - | Battle |
| `increment_battle_score` | - | Battle scoring |

### Economy RPCs

| RPC | Files | Components |
|-----|-------|------------|
| `admin_grant_coins` | RTCAdminMonitor.tsx | Grant coins |
| `deduct_coins` | useCoins.ts | Deduct coins |
| `troll_bank_credit_coins` | - | Bank credit |
| `troll_bank_spend_coins_secure` | - | Bank spend |
| `troll_bank_finalize_cashout` | - | Cashout finalize |
| `purchase_rgb_broadcast` | useCoins.ts | RGB purchase |
| `shop_buy_perk` | - | Perk purchase |
| `toggle_user_perk` | - | Perk toggle |
| `request_friday_cashout` | - | Cashout request |
| `request_visa_redemption` | - | Visa redemption |
| `spin_troll_wheel` | - | Wheel spin |
| `buy_vehicle` | - | Vehicle purchase |
| `buy_insurance` | - | Insurance purchase |
| `check_rate_limit` | - | Rate limiting |

### Government RPCs

| RPC | Files | Components |
|-----|-------|------------|
| `voteOnLaw` | useGovernmentSystem.ts | Vote |
| `createLaw` | useGovernmentSystem.ts | Create law |
| `jail_user` | - | Jail user |
| `log_government_action` | - | Log action |
| `get_vote_weight` | - | Vote weight |
| `check_emergency_cooldown` | - | Emergency power |
| `expose_bribe` | - | Bribe exposure |
| `summon_user_to_court` | - | Court summon |

### Property / Landlord RPCs

| RPC | Files | Components |
|-----|-------|------------|
| `purchase_landlord_license` | - | Landlord license |
| `buy_property_with_loan` | - | Property purchase |
| `sign_lease` | - | Lease signing |
| `pay_bank_loan` | - | Loan payment |
| `pay_rent` | - | Rent payment |
| `evict_tenant` | - | Tenant eviction |
| `update_house_condition` | - | House update |
| `repair_house` | - | House repair |
| `repossessProperty` | - | Repossess |
| `repossessVehicle` | - | Vehicle repossess |

### Marketplace RPCs

| RPC | Files | Components |
|-----|-------|------------|
| `fulfill_marketplace_order` | - | Order fulfillment |
| `create_marketplace_listing` | - | Listing creation |
| `purchase_listing_premium` | - | Premium listing |
| `send_marketplace_message` | - | Marketplace DM |

### Auth / Session RPCs

| RPC | Files | Components |
|-----|-------|------------|
| `register_session` | useAuthStore.ts | Session mgmt |
| `is_ip_banned` | - | IP ban check |
| `check_daily_login` | - | Daily login |
| `search_users` | useAdmin.ts | User search |
| `get_system_settings` | supabase.ts | System settings |
| `start_launch_trial` | supabase.ts | Launch trial |
| `end_trial_early` | supabase.ts | End trial |
| `notify_all_users` | supabase.ts | Mass notify |
| `relock_payouts` | supabase.ts | Lock payouts |
| `auto_unlock_payouts` | supabase.ts | Unlock payouts |
| `start_inmate_call` | - | Inmate call |
| `heartbeat_presence` | - | Presence heartbeat |
| `detect_ghost_inactivity` | - | Ghost mode |

### User Management RPCs

| RPC | Files | Components |
|-----|-------|------------|
| `admin_update_user_role` | - | Role change |
| `set_user_role` | - | Role assignment |
| `review_creator_application` | - | App review |
| `delete_own_account` | - | Account deletion |
| `update_profile_costs` | - | Profile costs |
| `get_user_conversations_optimized` | - | Conversation list |
| `mark_conversation_read` | supabase.ts | Read marking |
| `mark_message_read` | supabase.ts | Msg read |
| `find_shared_conversation` | - | Shared conv |
| `create_family_tasks` | - | Family tasks |
| `addToPublicPool` | - | Coin pool |
| `grant_xp` | - | XP grant |
| `troll_bank_credit_coins` | - | Bank credit |
| `check_influencer_eligibility` | - | Eligibility |

---

## PART C: EDGE FUNCTION INVOCATIONS FROM FRONTEND

| Edge Function | Files Invoking | Trigger | Auth |
|--------------|---------------|---------|------|
| `livekit-token` | BroadcastPage, ViewerPage, BattleView, TCNN pages, useLiveKitRoom | Page load (join room) | Admin |
| `agora-token` | LiveAuctionRoom, AuctioneerDashboard, usePodcastAgora, useAgoraRoom | Page load | Admin |
| `agora-walkie-talkie` | useStaffWalkieTalkie | Page load | Admin |
| `admin-actions` | 20+ files (admin, officer, secretary panels) | User action | Admin |
| `streams-maintenance` | AdminDashboard | User action | Admin |
| `process-payout-batch` | PayoutBatches | User action | Admin |
| `create-paypal-order` | PayPalPaymentModal, StoreDebug | User action | Admin |
| `verify-paypal-payment` | PayPalPaymentModal | User action | Admin |
| `paypal-payout` | Admin PayoutQueue | User action | Admin |
| `sendEmail` | Admin PayoutQueue | User action | Admin |
| `officer-actions` | LeadOfficerDashboard | User action | Admin |
| `toggle-ghost-mode` | OfficerDashboard | User action | Admin |
| `password-manager` | ProfileSettings, passwordManager service | User action | Admin |
| `admin` | AdminSupportTickets | User action | Admin |
| `manual-coin-order` | Admin panels | User action | Admin |
| `customer-service-admin` | PasswordResetPanel | User action | Admin |
| `capture-content` | XAdsStudio | Admin action | Admin |
| `generate-ad` | XAdsStudio | Admin action | Admin |
| `publish-social` | XAdsStudio | Admin action | Admin |
| `user-agreements` | TermsAgreement | User action | Admin |
| `send-announcement` | Announcements | Admin action | Admin |
| `send-bulk-notifications` | MeetingsDashboard, TeamMeetingRoom, SendNotifications | Admin action | Admin |
| `report-bug` | useBugAlertStore | User action | Admin |
| `admin-reset` | AdminResetPanel | Admin action | Admin |
| `push-notifications` | PWA/Notification service | System trigger | Admin |
| `global-ticker-notify` | - | System trigger | Admin |
| `square-webhook` | Stripe flows | Webhook | Webhook |
| `verify-square-payment` | Stripe flows | User action | Admin |
| `save-card` | Payment settings | User action | Admin |
| `send-message` | - | User action | Admin |
| `send-like` | - | User action | Admin |
| `create-square-checkout` | - | User action | Admin |
| `square-save-card` | - | User action | Admin |
| `charge-stored-card` | - | User action | Admin |
| `live` | - | System trigger | Admin |

**Note**: All admin edge functions listed above use `SUPABASE_SERVICE_ROLE_KEY` internally. User-visible functions like `livekit-token`, `agora-token`, `create-paypal-order`, `report-bug`, `user-agreements` are callable by authenticated users.

---

## PART D: REALTIME CHANNELS

See AUDIT_REALTIME_USAGE.md for the complete list of ~80 realtime channels.

---

## PART E: STORAGE BUCKETS

See AUDIT_STORAGE_USAGE.md for the complete list of 15+ storage buckets.
