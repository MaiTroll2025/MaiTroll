# Button / Action Usage Audit

> Generated: 2026-05-31. Covers all ~298 routes in App.tsx and adminRoutes.tsx.
> Risk classes: READ_ONLY | SAFE_WRITE_DEV_ONLY | MONEY_RISK | MODERATION_RISK | DELETE_RISK | ADMIN_RISK | AUTH_RISK | BROADCAST_RISK

---

## AUTH / ONBOARDING

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| Auth | pages/Auth.tsx | Sign In | handleEmailAuth | Yes | AUTH_RISK | user_profiles | register_session | - | Creates session |
| Auth | pages/Auth.tsx | Sign Up | handleEmailAuth | Yes | AUTH_RISK | user_profiles, signup_queue | - | auth (signup) | Inserts into signup_queue |
| Auth | pages/Auth.tsx | Join Queue | handleJoinQueue | Yes | SAFE_WRITE_DEV_ONLY | signup_queue | - | - | Queue entry |
| Auth | pages/Auth.tsx | Send help request | handleAlertAdminSubmit | Yes | SAFE_WRITE_DEV_ONLY | critical_alerts | - | - | Alert ticket |
| ProfileSetup | pages/ProfileSetup.tsx | Create Profile | handleComplete | Yes | SAFE_WRITE_DEV_ONLY | user_profiles | - | - | Upserts profile |
| ProfileSettings | pages/ProfileSettings.tsx | Save Changes | handleSaveProfile | Yes | SAFE_WRITE_DEV_ONLY | user_profiles | - | - | Update profile |
| ProfileSettings | pages/ProfileSettings.tsx | Save PIN | setResetPin | Yes | AUTH_RISK | - | - | passwordManager | Sets reset PIN |
| Profile | pages/Profile.tsx | Follow/Unfollow | handleFollow | Yes | SAFE_WRITE_DEV_ONLY | user_follows | - | - | Insert/delete |
| Profile | pages/Profile.tsx | Save Profile Costs | handleUpdateCosts | Yes | SAFE_WRITE_DEV_ONLY | - | update_profile_costs | - | - |
| Profile | pages/Profile.tsx | Equip/Unequip Effect | handleSetEntranceEffect | Yes | SAFE_WRITE_DEV_ONLY | user_profiles | - | - | - |
| Profile | pages/Profile.tsx | Repurchase Perk | handleRepurchasePerk | No | MONEY_RISK | - | shop_buy_perk | - | Deducts coins |
| Profile | pages/Profile.tsx | Logout | handleLogout | Yes | AUTH_RISK | - | - | - | Auth only |
| DeleteAccount | pages/DeleteAccount.tsx | Permanently Delete My Account | handleDelete | No | DELETE_RISK | - | - | delete-account | Irreversible |

---

## BROADCAST / STREAM

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| BroadcastPage | pages/broadcast/BroadcastPage.tsx | Start Stream | handleStartStream | Yes | BROADCAST_RISK | streams | - | live | Inserts stream |
| BroadcastPage | pages/broadcast/BroadcastPage.tsx | End Stream | handleEndStream | Yes | BROADCAST_RISK | streams | - | - | Updates stream |
| BroadcastPage | pages/broadcast/BroadcastPage.tsx | Pin Product | pinProduct | Yes | SAFE_WRITE_DEV_ONLY | streams | - | - | Toggle product pin |
| BroadcastPage | pages/broadcast/BroadcastPage.tsx | Seat Actions | handleOpenUserAction | Depends | MODERATION_RISK | stream_mutes, user_profiles | ban_user, mute_user | - | Kicks, mutes |
| BroadcastPage | pages/broadcast/BroadcastPage.tsx | Apply Seat Config | handleApplySeatConfiguration | Yes | SAFE_WRITE_DEV_ONLY | streams | - | - | Seat pricing |
| BroadcastControls | components/broadcast/BroadcastControls.tsx | End | handleEndStream | Yes | BROADCAST_RISK | streams | - | - | - |
| BroadcastControls | components/broadcast/BroadcastControls.tsx | Feature Toggle | toggleFeature | Yes | ADMIN_RISK | streams | - | - | Featured stream |
| BroadcastControls | components/broadcast/BroadcastControls.tsx | Save Paid Chat | savePaidChatSettings | Yes | MONEY_RISK | stream_settings | - | - | - |
| BroadcastControls | components/broadcast/BroadcastControls.tsx | Seat Price +/- | updateStreamConfig | Yes | MONEY_RISK | streams | - | - | Updates coins |
| BroadcastControls | components/broadcast/BroadcastControls.tsx | Box Count +/- | updateBoxCount | Yes | SAFE_WRITE_DEV_ONLY | streams | - | - | - |
| BroadcastControls | components/broadcast/BroadcastControls.tsx | RGB ON/OFF | toggleStreamRgb | Yes | SAFE_WRITE_DEV_ONLY | - | purchase_rgb_broadcast | - | Uses coins |
| UserActionModal | components/broadcast/UserActionModal.tsx | Kick (100c) | handleKick | No | MODERATION_RISK | - | kick_user_paid | - | Deducts coins |
| UserActionModal | components/broadcast/UserActionModal.tsx | Ban | handleBan | No | MODERATION_RISK | - | ban_user_from_stream | - | - |
| UserActionModal | components/broadcast/UserActionModal.tsx | Mute | handleMute | No | MODERATION_RISK | - | mute_user | - | - |
| UserActionModal | components/broadcast/UserActionModal.tsx | Promote to Officer | handlePromote | No | ADMIN_RISK | stream_messages | assign_broadofficer | - | - |
| UserActionModal | components/broadcast/UserActionModal.tsx | Follow/Unfollow | handleFollow | Yes | SAFE_WRITE_DEV_ONLY | user_follows | - | - | - |
| UserActionModal | components/broadcast/UserActionModal.tsx | Report | submitReport | Yes | SAFE_WRITE_DEV_ONLY | moderation_reports | - | - | - |
| UserActionModal | components/broadcast/UserActionModal.tsx | Cast Troll Spell | handleTrollSpell | Yes | SAFE_WRITE_DEV_ONLY | - | applyTrollSpell | - | Game effect |
| ViewerPage | pages/broadcast/ViewerPage.tsx | Send Gift | onGift | No | MONEY_RISK | - | send_gift_in_stream | - | Deducts coins |
| ViewerPage | pages/broadcast/ViewerPage.tsx | Like | handleLike | Yes | SAFE_WRITE_DEV_ONLY | - | add_stream_like | - | - |
| ViewerPage | pages/broadcast/ViewerPage.tsx | Join Seat | handleJoinSeatByIndex | Yes | SAFE_WRITE_DEV_ONLY | stream_seats | join_seat_atomic | - | - |
| ViewerPage | pages/broadcast/ViewerPage.tsx | Leave Seat | handleLeaveSeat | Yes | SAFE_WRITE_DEV_ONLY | stream_seats | leave_seat_atomic | - | - |
| StreamSwipeCard | components/broadcast/StreamSwipeCard.tsx | Like | handleLike | Yes | SAFE_WRITE_DEV_ONLY | - | add_stream_like | - | - |
| StreamSwipeCard | components/broadcast/StreamSwipeCard.tsx | Gift | handleGift | No | MONEY_RISK | - | send_gift_in_stream | - | - |
| StreamSwipeCard | components/broadcast/StreamSwipeCard.tsx | Join Seat | handleJoinSeat | Yes | SAFE_WRITE_DEV_ONLY | stream_seats | join_seat_atomic | - | - |
| SetupPage | pages/broadcast/SetupPage.tsx | Go Live | handleGoLive | Yes | BROADCAST_RISK | streams, global_events | - | live | Creates stream |

---

## MOD ACTIONS (In-Stream)

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| ModActionsPopup | components/broadcast/ModActionsPopup.tsx | Mute | handleMute | No | MODERATION_RISK | user_profiles, moderation_actions | moderator_mute_user | - | - |
| ModActionsPopup | components/broadcast/ModActionsPopup.tsx | Unmute | handleUnmute | No | MODERATION_RISK | user_profiles, moderation_actions | moderator_unmute_user | - | - |
| ModActionsPopup | components/broadcast/ModActionsPopup.tsx | Arrest | handleArrest | No | MODERATION_RISK | jail, court_dockets, court_cases, moderation_actions | - | - | Creates jail record |
| ModActionsPopup | components/broadcast/ModActionsPopup.tsx | Disable Chat | handleDisableChat | No | MODERATION_RISK | user_profiles, moderation_actions | moderator_disable_chat | - | - |
| ModActionsPopup | components/broadcast/ModActionsPopup.tsx | Kick | handleKick | No | MODERATION_RISK | user_profiles, moderation_actions | moderator_kick_user | - | - |
| ModActionsPopup | components/broadcast/ModActionsPopup.tsx | Suspend License | handleSuspendLicense | No | MODERATION_RISK | user_driver_licenses, user_profiles, notifications, moderation_actions | - | - | - |
| ModActionsPopup | components/broadcast/ModActionsPopup.tsx | End Stream | handleEndStream | No | BROADCAST_RISK | streams, broadcast_restrictions, moderation_actions | - | - | - |
| ModActionsPopup | components/broadcast/ModActionsPopup.tsx | Remove Officer | handleRemoveOfficer | No | ADMIN_RISK | user_profiles, moderation_actions | remove_broadofficer, set_user_role | - | - |

---

## JAIL / COURT

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| JailPage | pages/JailPage.tsx | Pay Bail | handlePayBail | No | MONEY_RISK | user_profiles, jail, jail_transactions, notifications | - | - | Deducts coins |
| JailPage | pages/JailPage.tsx | Request Attorney | handleRequestAttorney | Yes | SAFE_WRITE_DEV_ONLY | attorney_cases | - | - | - |
| TrollCourt | pages/TrollCourt.tsx | Open Court | handleSummonOrStart | No | MODERATION_RISK | court_cases, court_sessions | startCourtSession, create_court_case | - | - |
| TrollCourt | pages/TrollCourt.tsx | Adjourn Court | handleEndCourtSession | No | MODERATION_RISK | - | end_court_session | - | - |
| TrollCourt | pages/TrollCourt.tsx | Delete Case | handleDeleteCase | No | DELETE_RISK | - | hard_delete_court_case | - | Irreversible |
| TrollCourt | pages/TrollCourt.tsx | Continue Date | handleExtendCase | Yes | ADMIN_RISK | court_cases, court_dockets | - | - | - |
| Government | pages/Government.tsx | Vote on Law | handleVoteOnLaw | Yes | SAFE_WRITE_DEV_ONLY | law_votes | voteOnLaw | - | - |
| Government | pages/Government.tsx | Create Law | handleCreateLaw | Yes | ADMIN_RISK | government_laws | createLaw | - | - |
| Government | pages/Government.tsx | Submit Bribe | submitBribe | No | MONEY_RISK | bribe_logs | - | - | Costs coins |
| Government | pages/Government.tsx | Create Protest | createProtest | Yes | SAFE_WRITE_DEV_ONLY | protests, protest_participants | - | - | - |
| Government | pages/Government.tsx | Use Emergency Power | useEmergencyPower | No | ADMIN_RISK | emergency_powers_log | - | - | President only |
| President | pages/President.tsx | Signup Candidate | handleSignup | Yes | SAFE_WRITE_DEV_ONLY | president_elections | signupCandidate | - | - |

---

## WALLET / COINS / PAYOUTS

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| Wallet | pages/Wallet.tsx | Buy Coins | navigate to /store | No | MONEY_RISK | - | - | - | Opens store |
| Wallet | pages/Wallet.tsx | Request Payout | navigate to /cashout-request | No | MONEY_RISK | - | - | - | Cashout flow |
| CoinStore | pages/CoinStore.jsx | Buy Package | handlePurchase | No | MONEY_RISK | - | - | create-paypal-order, create-square-checkout | Real money |
| CoinStoreModal | components/broadcast/CoinStoreModal.tsx | PayPal | handlePackageSelect | No | MONEY_RISK | - | - | PayPal | Real money |
| CoinStoreModal | components/broadcast/CoinStoreModal.tsx | Credit Card | handleCardCheckout | No | MONEY_RISK | - | - | charge-stored-card | Real money |
| CashoutRequest | pages/CashoutRequestPage.tsx | Submit Request | handleRequestCashout | No | MONEY_RISK | payout_requests | request_friday_cashout | - | Creates payout |
| PayoutRequest | pages/PayoutRequest.tsx | Submit | handleSubmit | No | MONEY_RISK | payout_requests | - | paypal-payout, process-payout-batch | Treasury |
| TreasuryDashboard | pages/TreasuryDashboard.tsx | Create Draft Run | handleCreateRun | No | ADMIN_RISK | - | create_weekly_treasury_payout_run | - | - |
| TreasuryDashboard | pages/TreasuryDashboard.tsx | Approve Run | handleApproveRun | No | MONEY_RISK | - | approve_treasury_payout_run | - | Real money |
| TreasuryDashboard | pages/TreasuryDashboard.tsx | Process Run | handleProcessRun | No | MONEY_RISK | - | process_treasury_payout_run | - | Real money |
| TreasuryDashboard | pages/TreasuryDashboard.tsx | Manual Credit | handleManualCredit | No | MONEY_RISK | - | credit_treasury_revenue | - | - |

---

## MARKETPLACE / SHOP

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| Marketplace | pages/Marketplace.tsx | Buy Item | handleBuy | No | MONEY_RISK | marketplace_purchases | fulfill_marketplace_order | - | Costs coins |
| SellOnMai Troll | pages/SellOnMai Troll.tsx | Create Listing | handleCreateListing | Yes | SAFE_WRITE_DEV_ONLY | marketplace_items, vehicle_listings, service_listings, business_profiles, Mai Troll_shops, shop_items | create_marketplace_listing | - | - |
| SellOnMai Troll | pages/SellOnMai Troll.tsx | Create Shop | handleCreateShop | Yes | SAFE_WRITE_DEV_ONLY | Mai Troll_shops | - | - | - |
| SellOnMai Troll | pages/SellOnMai Troll.tsx | Add Shop Item | handleAddItem | Yes | SAFE_WRITE_DEV_ONLY | shop_items | - | - | - |
| GiftStorePage | pages/GiftStorePage.jsx | Gift Item | handleGift | No | MONEY_RISK | - | send_gift_in_stream | - | Costs coins |
| GiftInventoryPage | pages/GiftInventoryPage.jsx | Send Gift | handleSendGift | No | MONEY_RISK | - | send_gift_in_stream | - | Costs coins |

---

## FAMILY

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| FamilyBrowse | pages/FamilyBrowse.tsx | Create Family | handleCreateFamily | Yes | SAFE_WRITE_DEV_ONLY | troll_families, family_members | - | - | - |
| FamilyLounge | pages/FamilyLounge.tsx | Generate Weekly Tasks | generateTasks | Yes | SAFE_WRITE_DEV_ONLY | family_tasks | create_family_tasks | - | - |
| FamilyProfilePage | pages/FamilyProfilePage.tsx | Join Family | handleJoinFamily | Yes | SAFE_WRITE_DEV_ONLY | family_members | - | - | - |
| FamilyWarsPage | pages/FamilyWarsPage.tsx | Declare War | handleDeclareWar | Yes | SAFE_WRITE_DEV_ONLY | family_wars | - | - | - |
| FamilyChatPage | pages/FamilyChatPage.tsx | Send Message | handleSendMessage | Yes | SAFE_WRITE_DEV_ONLY | conversation_messages | - | - | - |

---

## AUCTIONS

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| AuctionStudio | pages/auction/AuctionStudio.tsx | Create Show | handleCreateShow | Yes | SAFE_WRITE_DEV_ONLY | auction_shows | - | - | - |
| AuctionStudio | pages/auction/AuctionStudio.tsx | Add Lot | handleAddLot | Yes | SAFE_WRITE_DEV_ONLY | auction_lots | - | - | - |
| LiveAuctionRoom | pages/auction/LiveAuctionRoom.tsx | Place Bid | handleBid | No | MONEY_RISK | auction_bids | - | - | Costs coins |
| LiveAuctionRoom | pages/auction/LiveAuctionRoom.tsx | Start Auction | handleStartAuction | Yes | BROADCAST_RISK | auction_shows, auction_lots | - | agora-token | - |
| AuctionSettings | pages/auction/AuctionSettings.tsx | Save Settings | handleSave | Yes | SAFE_WRITE_DEV_ONLY | auctioneer_profiles | - | - | - |

---

## CHURCH

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| PrayerFeed | components/church/PrayerFeed.tsx | Pray | handlePray | Yes | SAFE_WRITE_DEV_ONLY | church_prayers | - | - | - |
| PrayerFeed | components/church/PrayerFeed.tsx | Like Prayer | handleLikePrayer | Yes | SAFE_WRITE_DEV_ONLY | church_prayer_likes | - | - | - |
| PrayerFeed | components/church/PrayerFeed.tsx | Reply | handleReplyPrayer | Yes | SAFE_WRITE_DEV_ONLY | church_prayer_replies | - | - | - |
| PastorDashboard | pages/church/PastorDashboard.tsx | Start Service | handleStartService | Yes | BROADCAST_RISK | church_live_sessions | - | live | - |
| PastorDashboard | pages/church/PastorDashboard.tsx | Add Sermon Note | handleAddNote | Yes | SAFE_WRITE_DEV_ONLY | church_sermon_notes | - | - | - |
| PastorDashboard | pages/church/PastorDashboard.tsx | Send Broadcast | handleBroadcast | Yes | ADMIN_RISK | admin_broadcasts | - | - | - |

---

## NEIGHBORHOOD / CITY

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| NeighborhoodOnboarding | pages/NeighborhoodOnboarding.tsx | Create Street | handleCreateStreet | Yes | SAFE_WRITE_DEV_ONLY | neighborhoods | - | - | - |
| NeighborhoodOnboarding | pages/NeighborhoodOnboarding.tsx | Purchase Car | handlePurchaseCar | No | MONEY_RISK | user_profiles, vehicles | buy_vehicle | - | Costs coins |
| NeighborhoodOnboarding | pages/NeighborhoodOnboarding.tsx | Grant License | handleGrantDriverLicense | Yes | SAFE_WRITE_DEV_ONLY | user_licenses | - | - | - |
| NeighborhoodOnboarding | pages/NeighborhoodOnboarding.tsx | Purchase Insurance | handlePurchaseInsurance | Yes | MONEY_RISK | user_profiles | buy_insurance | - | Costs coins |
| NeighborhoodOnboarding | pages/NeighborhoodOnboarding.tsx | Save Plate | handleSavePlate | Yes | SAFE_WRITE_DEV_ONLY | - | - | - | - |
| HouseActionPanel | components/city/HouseActionPanel.tsx | Raid House | raidHouse | No | MONEY_RISK | house_raids, user_profiles | - | - | Costs coins |
| HouseActionPanel | components/city/HouseActionPanel.tsx | Repair House | repairHouse | No | MONEY_RISK | houses | repair_house | - | Costs coins |
| CityStatusOrb | components/city/CityStatusOrb.tsx | Follow | onFollow | Yes | SAFE_WRITE_DEV_ONLY | user_follows | - | - | - |
| CityStatusOrb | components/city/CityStatusOrb.tsx | Gift | onGift | No | MONEY_RISK | - | send_gift_in_stream | - | Costs coins |
| CityStatusOrb | components/city/CityStatusOrb.tsx | Message | onMessage | Yes | SAFE_WRITE_DEV_ONLY | conversations | - | - | - |
| CarDealership | pages/CarDealership.tsx | Buy Vehicle | handleBuyVehicle | No | MONEY_RISK | vehicles, user_vehicles | buy_vehicle | - | Costs coins |
| DriverTest | pages/DriverTest.tsx | Grant License | handleGrantLicense | Yes | SAFE_WRITE_DEV_ONLY | user_licenses | - | - | - |
| TrollBank | pages/TrollBank.tsx | Deposit | handleDeposit | Yes | SAFE_WRITE_DEV_ONLY | - | bank_deposit | - | - |
| TrollBank | pages/TrollBank.tsx | Withdraw | handleWithdraw | Yes | SAFE_WRITE_DEV_ONLY | - | bank_withdraw | - | - |

---

## MESSAGING / TCPS / TROMAIL

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| ChatWindow | pages/tcps/components/ChatWindow.tsx | Send Message | handleSendMessage | Yes | SAFE_WRITE_DEV_ONLY | conversation_messages, call_rooms | - | - | - |
| ChatWindow | pages/tcps/components/ChatWindow.tsx | Start Call | handleStartCall | Yes | SAFE_WRITE_DEV_ONLY | call_rooms, call_minutes | start_inmate_call | - | - |
| InboxSidebar | pages/tcps/components/InboxSidebar.tsx | New Message | handleNewMessage | Yes | SAFE_WRITE_DEV_ONLY | conversations | - | - | - |
| InboxSidebar | pages/tcps/components/InboxSidebar.tsx | Search | handleSearch | Yes | READ_ONLY | user_profiles | search_users | - | - |
| CreateGroupChatModal | pages/tcps/components/CreateGroupChatModal.tsx | Create Group | handleCreateGroup | Yes | SAFE_WRITE_DEV_ONLY | conversations, conversation_members, notifications | - | - | - |
| GroupChatInfoModal | pages/tcps/components/GroupChatInfoModal.tsx | Add Member | handleAddMember | Yes | SAFE_WRITE_DEV_ONLY | conversation_members | addGroupMember | - | - |
| GroupChatInfoModal | pages/tcps/components/GroupChatInfoModal.tsx | Remove Member | handleRemoveMember | Yes | SAFE_WRITE_DEV_ONLY | conversation_members | removeGroupMember | - | - |
| TromailPage | pages/tromail/TromailPage.tsx | Compose | handleCompose | Yes | SAFE_WRITE_DEV_ONLY | - | - | - | - |
| TromailCompose | pages/tromail/TromailCompose.tsx | Send | handleSendMail | Yes | SAFE_WRITE_DEV_ONLY | - | send_tromail_message | admin-actions | Via admin-actions |

---

## GAMES

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| TrollGamesPage | pages/TrollGamesPage.tsx | Enter Queue | handleQueue | Yes | SAFE_WRITE_DEV_ONLY | - | - | - | Matchmaking |
| TrollopolyQueue | components/games/TrollopolyQueue.tsx | Join Queue | handleQueue | Yes | SAFE_WRITE_DEV_ONLY | - | - | - | - |
| TrollopolyGame | components/games/TrollopolyGame.tsx | Roll Dice | handleRollDice | Yes | SAFE_WRITE_DEV_ONLY | - | - | - | Realtime event |
| TrollWheel | pages/TrollWheel.tsx | Spin | handleSpin | No | MONEY_RISK | - | spin_troll_wheel | - | Costs coins |
| GiveawaysPage | pages/GiveawaysPage.tsx | Enter Giveaway | handleEnterGiveaway | Yes | SAFE_WRITE_DEV_ONLY | - | - | - | - |

---

## ADMIN DASHBOARD

| Area | File | Button Label | Handler | Safe To Test | Action Type | Tables | RPCs | Edge Functions | Notes |
|------|------|--------------|---------|--------------|-------------|--------|------|----------------|-------|
| AdminDashboard | pages/admin/AdminDashboard.tsx | Refresh | onRefresh | Yes | READ_ONLY | - | - | - | - |
| AdminDashboard | pages/admin/AdminDashboard.tsx | Logout | handleLogout | Yes | AUTH_RISK | - | - | - | - |
| AdminDashboard | pages/admin/AdminDashboard.tsx | Reset App | handleResetApp | No | ADMIN_RISK | user_profiles, streams | - | admin-reset, streams-maintenance | Dangerous |
| CustomerServiceDashboard | pages/admin/CustomerServiceDashboard.tsx | Refresh | refetch | Yes | READ_ONLY | - | - | - | - |
| CustomerServiceDashboard | pages/admin/CustomerServiceDashboard.tsx | Save Note | handleSaveNote | Yes | SAFE_WRITE_DEV_ONLY | customer_service_audit_logs | - | - | - |
| RTCAdminMonitor | components/admin/RTCAdminMonitor.tsx | Warn | executeAction(warn) | No | MODERATION_RISK | notifications, moderation_actions | - | - | - |
| RTCAdminMonitor | components/admin/RTCAdminMonitor.tsx | Mute | executeAction(mute) | No | MODERATION_RISK | moderation_actions | mute_user | - | - |
| RTCAdminMonitor | components/admin/RTCAdminMonitor.tsx | Kick | executeAction(kick) | No | MODERATION_RISK | moderation_actions | ban_user | - | - |
| RTCAdminMonitor | components/admin/RTCAdminMonitor.tsx | Ban | executeAction(ban) | No | MODERATION_RISK | moderation_actions | ban_user | - | - |
| RTCAdminMonitor | components/admin/RTCAdminMonitor.tsx | Arrest | executeAction(arrest) | No | MODERATION_RISK | jail, court_dockets, court_cases, moderation_actions | - | - | - |
| RTCAdminMonitor | components/admin/RTCAdminMonitor.tsx | Grant Coins | executeAction(grant) | No | MONEY_RISK | - | admin_grant_coins | - | Treasury risk |
| RTCAdminMonitor | components/admin/RTCAdminMonitor.tsx | End Stream | endStream | No | BROADCAST_RISK | streams | - | - | - |
| UserDetailsModal | components/admin/UserDetailsModal.tsx | Prompt User | handlePromptUser | Yes | SAFE_WRITE_DEV_ONLY | - | - | admin-actions | - |
| UserDetailsModal | components/admin/UserDetailsModal.tsx | Suspend License | handleLicenseAction | No | MODERATION_RISK | - | - | admin-actions | - |
| PasswordResetPanel | components/admin/customer-service/PasswordResetPanel.tsx | Send Reset Link | handlePasswordReset(send) | No | AUTH_RISK | admin_password_resets | - | customer-service-admin | - |
| PasswordResetPanel | components/admin/customer-service/PasswordResetPanel.tsx | Force Reset | handlePasswordReset(force) | No | AUTH_RISK | admin_password_resets | - | customer-service-admin | - |
| SupportScreenSharePanel | components/admin/customer-service/SupportScreenSharePanel.tsx | Request Screen Share | handleRequest | Yes | ADMIN_RISK | - | requestScreenShare | - | - |
| SupportScreenSharePanel | components/admin/customer-service/SupportScreenSharePanel.tsx | End Screen Share | handleEnd | Yes | ADMIN_RISK | - | endScreenShare | - | - |
| CreatorApplicationsPanel | components/admin/CreatorApplicationsPanel.tsx | Approve | handleReview(approved) | No | ADMIN_RISK | applications | review_creator_application | - | Changes user role |
| CreatorApplicationsPanel | components/admin/CreatorApplicationsPanel.tsx | Deny | handleReview(denied) | No | ADMIN_RISK | applications | review_creator_application | - | - |
| RepossessionPanel | components/admin/RepossessionPanel.tsx | Repossess Property | handleRepossessProperty | No | DELETE_RISK | - | repossessProperty | - | Irreversible |
| RepossessionPanel | components/admin/RepossessionPanel.tsx | Repossess Vehicle | handleRepossessVehicle | No | DELETE_RISK | - | repossessVehicle | - | Irreversible |
| AssignRecruitPanel | components/admin/AssignRecruitPanel.tsx | Assign Recruit | handleAssignRecruit | No | ADMIN_RISK | user_profiles | - | - | - |
| BugCenterPanel | components/admin/BugCenterPanel.tsx | Delete All | deleteAllBugs | No | DELETE_RISK | app_bug_reports | - | - | Irreversible |
| DailyRewardsAdminPanel | components/admin/DailyRewardsAdminPanel.tsx | Add to Pool | handleAddToPool | No | MONEY_RISK | - | addToPublicPool | - | Economy risk |
| PayoutBatches | pages/admin/PayoutBatches.tsx | Process Batch | handleProcessBatch | No | MONEY_RISK | payout_batches, payout_requests | - | process-payout-batch | Real money |
| GrantCoins | pages/admin/GrantCoins.tsx | Grant Coins | handleGrant | No | MONEY_RISK | - | troll_bank_credit_coins | - | - |
| RoleManagement | pages/admin/RoleManagement.tsx | Assign Role | handleAssignRole | No | ADMIN_RISK | user_profiles | set_user_role, admin-actions | admin-actions | - |

---

## BUTTON RISK SUMMARY

| Risk Type | Count | Description |
|-----------|-------|-------------|
| READ_ONLY | ~25 | Data fetching, navigation, viewing |
| SAFE_WRITE_DEV_ONLY | ~45 | Profile updates, follows, settings, game actions |
| MONEY_RISK | ~25 | Coin purchases, cashouts, bids, grants, treasury, gifts |
| MODERATION_RISK | ~25 | Kicks, bans, mutes, arrests, summons |
| DELETE_RISK | ~8 | Bug deletion, account deletion, case deletion, repossession |
| ADMIN_RISK | ~35 | Application review, role assignment, lockdown, license mgmt |
| AUTH_RISK | ~8 | Login, signup, logout, password reset |
| BROADCAST_RISK | ~6 | Stream start/stop, lockdown, service start |

---

## NOTES

1. **MONEY_RISK buttons should NOT be clicked in dev** without verifying the database is local/staging. Real PayPal/Square flows process real money.
2. **MODERATION_RISK buttons** (jail, ban, kick, mute) modify user state and should not be tested manually.
3. **DELETE_RISK buttons** (repossession, account deletion, case deletion) are irreversible.
4. **ADMIN_RISK buttons** modify roles, permissions, and system settings.
5. All admin edge functions use `SUPABASE_SERVICE_ROLE_KEY` -- proper role checks should be verified in production.
6. **114 edge functions exist**; 42 are called from the frontend. 72 are cron/webhook/internal only.
