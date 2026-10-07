# Codebase Features & Hooks Reference

This file documents all features and custom hooks organized by functional area in the TrollCity codebase.

---

## 1. Authentication & User Management

Hooks for managing user authentication, profiles, presence, and session state.

### `/src/hooks/useAuth.ts`
- `useAuth()` — Provides user, profile, session, loading state, admin flag, login/logout helpers

### `/src/hooks/useUserPresence.ts`
- `useUserPresence()` — Tracks user presence and online status across the app
- `useMyOnlineStatus()` — Returns current user's online status
- `useUserOnlineStatus(userId)` — Returns online status for a specific user

### `/src/hooks/useUserRestrictions.ts`
- `useUserRestrictions(userId)` — Fetches and manages user-level restrictions (shadowban, timeout, etc.)

### `/src/hooks/useUserPresenceRoute.ts`
- `useUserPresenceRoute()` — Manages user presence tracking on route changes

### `/src/hooks/useUserLeagues.ts`
- `useUserLeagues()` — Fetches league data for the current user

### `/src/hooks/useUserFrame.ts`
- `useUserFrame(userId)` — Retrieves the active profile frame for a user

### `/src/hooks/useIdleSession.ts`
- `useIdleSession()` — Tracks user idle state and triggers idle-related logic

### `/src/hooks/useUserRestrictions.ts`
- `useUserRestrictions(userId)` — Fetches user restrictions (kick protection, timeouts, etc.)

### `/src/hooks/useUploadOrganizationDocument.ts`
- `useUploadOrganizationDocument()` — Uploads organization verification documents

### `/src/hooks/useGetUserDocuments.ts`
- `useGetUserDocuments(userId, filters)` — Retrieves user/organization documents

### `/src/hooks/useGetUserTromailAccount.ts`
- `useGetUserTromailAccount(userId)` — Fetches Tromail account info for a user

### `/src/hooks/useGetTromailRoleDirectory.ts`
- `useGetTromailRoleDirectory()` — Fetches the Tromail role directory

### `/src/hooks/useGetContractById.ts`
- `useGetContractById(contractId)` — Retrieves a single contract by ID

### `/src/hooks/useGetContracts.ts`
- `useGetContractsByRecipient(recipientUserId)` — Fetches contracts received by user
- `useGetContractsBySender(senderUserId)` — Fetches contracts sent by user

### `/src/hooks/useGetContractTemplates.ts`
- `useGetContractTemplates()` — Retrieves all contract templates
- `useGetContractTemplateById(templateId)` — Retrieves a single contract template

### `/src/hooks/useSignContract.ts`
- `useSignContract()` — Signs a contract (React Query mutation)

### `/src/hooks/useRejectContract.ts`
- `useRejectContract()` — Rejects a contract (React Query mutation)

### `/src/lib/hooks/useCoins.ts`
- `useCoins()` — Manages user coin balance and transactions

### `/src/lib/hooks/useCreditScore.ts`
- `useCreditScore(targetUserId)` — Fetches credit score for a user

### `/src/lib/hooks/useAllCreditScores.ts`
- `useAllCreditScores(currentUserId)` — Fetches all credit scores for admin/moderation

### `/src/lib/hooks/useBank.ts`
- `useBank()` — Banking system hook for deposits, withdrawals, transactions

### `/src/lib/hooks/useHypeCoins.ts`
- `useHypeCoins()` — Manages hype coin balance and spending

### `/src/lib/hooks/useInsurance.ts`
- `useInsurancePlans()` — Fetches available insurance plans
- `useActiveInsurance()` — Fetches user's active insurance policies
- `useInsurancePurchase()` — Purchases insurance (mutation)
- `useCanAffordInsurance(planId)` — Checks if user can afford a plan
- `useProtectionStatus(protectionType)` — Gets kick/full protection status

### `/src/lib/hooks/useNeighborhood.ts`
- `useNeighborhood()` — Fetches neighborhood/house data for current user
- `useHouseRaids(houseId)` — Manages house raid actions and history

### `/src/lib/hooks/useTrollz.ts`
- `useTrollz()` — Manages Trollz token economy

### `/src/lib/hooks/useRepossession.ts`
- `useRepossession()` — Handles vehicle repossession logic

### `/src/lib/hooks/useHouseRaidActions.ts`
- `useHouseRaidActions()` — Manages house raid participation and payouts

### `/src/lib/hooks/useVehicleAssets.ts`
- `useVehicleAssets()` — Manages owned vehicle assets
- `useVehicleAdmin()` — Admin vehicle management utilities

### `/src/lib/hooks/useVehicleSystem.ts`
- `useVehicleSystem()` — Vehicle ownership, spawning, and management
- `useDriverTest()` — Driver's license test logic

### `/src/lib/hooks/useGasSystem.ts`
- `useGasSystem()` — Vehicle fuel/gas management

### `/src/lib/hooks/useDailyLoginPost.ts`
- `useDailyLoginPost()` — Manages daily login reward posts

### `/src/lib/hooks/useEventGifts.ts`
- `useEventGifts()` — Fetches gifts available during events

### `/src/lib/hooks/useEventBonuses.ts`
- `useEventBonuses()` — Fetches event bonus multipliers

### `/src/lib/hooks/useEventHighlights.ts`
- `useEventHighlights()` — Fetches event highlight reels

### `/src/lib/hooks/useSmokeEvent.ts`
- `useSmokeEvent(streamId)` — Manages smoke event participation

### `/src/lib/hooks/useSmokeathon.ts`
- (DELETED - unused)

### `/src/lib/hooks/useVandalism.ts`
- `useVandalism(vehicleId)` — Tracks vehicle vandalism incidents

### `/src/lib/hooks/useStockMarket.ts`
- `useStockMarket()` — Stock market trading logic and prices

### `/src/lib/hooks/useXPSync.ts`
- `useXPSync(userId)` — Syncs XP progress from the server

### `/src/lib/hooks/useXPTracking.ts`
- `useXPTracking(options)` — Tracks and manages XP progression

### `/src/hooks/useXPTracking.ts`
- `useXPTracking()` — Local XP tracking for user activities

### `/src/hooks/useLevelUnlocks`
- Part of `useFamilyAchievementSystem.ts` — Returns unlocked features per level

### `/src/lib/hooks/useGiftEvents.ts`
- `useGiftEvents(streamId)` — Tracks gift-related events during streams

---

## 2. Authentication & Session Management

### `/src/hooks/useAutoUpdate.ts`
- `useAutoUpdate()` — Checks for app updates and manages update flow

### `/src/hooks/useBackgroundSessionRefresh.ts`
- `useBackgroundSessionRefresh()` — Periodically refreshes the user session

### `/src/hooks/useBackgroundProfileRefresh.ts`
- `useBackgroundProfileRefresh()` — Refreshes user profile data in the background

### `/src/hooks/useBarcodeScanner.ts`
- `useBarcodeScanner(options)` — Scans QR/barcodes for various use cases

### `/src/hooks/useZxingScanner.ts`
- `useZxingScanner(opts)` — ZXing-based barcode/QR scanner integration

### `/src/hooks/useDebouncedProfileUpdate.ts`
- `useDebouncedProfileUpdate(userId)` — Debounced profile update API calls

### `/src/hooks/usePageVisibility.ts`
- `usePageVisibility()` — Tracks page visibility state
- `useUcRedirect()` — Handles UC redirect on page visibility change

### `/src/hooks/usePageVisibility.tsx`
- `usePageVisibility()` — Tracks page visibility (TSX variant with UcCheckResult)
- `useUcRedirect()` — UC redirect handler

### `/src/lib/hooks/usePageVisibility.ts`
- `usePageVisibility()` — Library-level page visibility tracking

### `/src/lib/hooks/usePreventRefresh.ts`
- `usePreventTabRefresh()` — Prevents accidental tab refresh
- `useStatePersistence<T>(key, defaultValue)` — Persists state across page refreshes
- `useScrollPersistence(key)` — Saves/restores scroll position
- `useRefreshPrevention()` — Generic refresh prevention logic

### `/src/hooks/usePersistentGifts.ts`
- `usePersistentGifts()` — Manages gifts that persist across sessions

### `/src/hooks/useParticipantAttributes.ts`
- `useParticipantAttributes(participantIds, streamId)` — Fetches attributes for stream participants

### `/src/hooks/usePullToRefresh.ts`
- `usePullToRefresh(onRefresh, enabled)` — Pull-to-refresh gesture handler

### `/src/hooks/useDoubleTap.ts`
- `useDoubleTap(callback)` — Double-tap gesture detection

### `/src/hooks/useSafeNavigate.tsx`
- `useSafeNavigate()` — Safe navigation with route validation

### `/src/hooks/useStorageUsage.ts`
- `useStorageUsage(userId)` — Tracks user storage usage
- `useReplayBalance(userId)` — Tracks replay storage balance

### `/src/hooks/useUserRestrictions.ts`
- `useUserRestrictions(userId)` — Fetches user restrictions and protections

---

## 3. Broadcasting & Live Streaming

Hooks for managing live broadcast sessions, viewer interactions, and streaming infrastructure.

### `/src/hooks/useLiveBroadcast.ts`
- `useLiveBroadcast({ streamId, userId, ...options })` — Core LiveKit session for broadcasters

### `/src/hooks/useBroadcastRealtime.ts`
- `useBroadcastRealtime({ streamId, userId, ...handlers })` — Real-time broadcast events (chat, gifts, likes, participants)
- Also exports: `hydrateRealtimeGift(rawGift)` — Hydrates gift data with item metadata

### `/src/hooks/useBroadcastStreaming.ts`
- `useBroadcastStreaming(streamId)` — Manages broadcast streaming state

### `/src/hooks/useLiveViewer.ts`
- `useLiveViewer({ streamId, onConnected })` — Viewer-side LiveKit connection management

### `/src/hooks/useLiveTimer.ts`
- `useLiveTimer(startTime, isLive)` — Timer for live stream duration

### `/src/hooks/useBroadcastFrame.ts`
- `useBroadcastFrame(userId)` — Retrieves active broadcast frame/theme

### `/src/hooks/useBroadcastLifecycle.ts`
- `useBroadcastLifecycle(streamId, callbacks)` — Manages broadcast lifecycle events (start, end, etc.)

### `/src/hooks/useBroadcastLockdown.ts`
- `useBroadcastLockdown()` — Checks if broadcasts are locked down system-wide

### `/src/hooks/useFeatureLockdown.ts`
- `useHytroGamingLockdown()` — Lockdown for Hytro Gaming
- `usePodcastLockdown()` — Lockdown for podcasts

### `/src/hooks/useBroadcastAbilities.ts`
- `useBroadcastAbilities(streamId, userId)` — Fetches broadcaster abilities/permissions

### `/src/hooks/useBroadcastShutdown.ts`
- `useBroadcastShutdown(options)` — Manages graceful broadcast shutdown

### `/src/hooks/useBroadcastStartCheck.ts`
- `useBroadcastStartCheck()` — Pre-flight checks before starting a broadcast

### `/src/hooks/useBroadcastTutorial.ts`
- `useBroadcastTutorial()` — Broadcast setup tutorial state

### `/src/hooks/useBroadcastViewerCap.ts`
- `useBroadcastViewerCap()` — Manages viewer capacity limits

### `/src/hooks/useBroadcastTextPopup.ts`
- `useBroadcastTextPopup({ streamId, ... })` — Manages text popups during broadcast

### `/src/hooks/useBroadcastPinnedProducts.ts`
- `useBroadcastPinnedProducts({ streamId, ... })` — Manages pinned commerce products during broadcast

### `/src/hooks/useBroadcasterWishlist.ts`
- `useBroadcasterWishlist(broadcasterId)` — Fetches broadcaster's wishlist
- `useCreateWishlist()` — Creates a new wishlist
- `useAddWishlistItem()` — Adds item to wishlist
- `useBackWishlistItem()` — Backs a wishlist item
- `useWishlistProgress(wishlistId)` — Tracks wishlist funding progress

### `/src/hooks/useBroadcasterSeatQueue.ts`
- `useBroadcasterSeatQueue(streamId)` — Manages seat queue for broadcaster

### `/src/hooks/useLiveKitRoom.ts`
- `useLiveKitRoom({ roomName, ... })` — LiveKit room connection management

### `/src/hooks/useSeatLiveKit.ts`
- (DELETED - unused)

### `/src/hooks/useSeatRoster.ts`
- (DELETED - unused)

### `/src/hooks/useSeatRequests.ts`
- `useSeatRequests(streamId)` — Manages seat request queue

### `/src/hooks/useSeatFocus.ts`
- `useSeatFocus(...)` — Tracks focused seat for viewer spotlight

### `/src/hooks/useScreenShare.ts`
- `useScreenShare()` — Screen sharing management

### `/src/hooks/useAgoraRoom.ts`
- `useAgoraRoom({ appId, channel, ... })` — Agora RTC room management

### `/src/hooks/useAgoraScreenShare.ts`
- `useAgoraScreenShare()` — Agora screen sharing

### `/src/hooks/useAgoraGamingViewer.ts`
- `useAgoraGamingViewer()` — Gaming stream viewer management

### `/src/hooks/useLiveCommerceOrders.ts`
- `useLiveCommerceOrders({ userId, isSeller })` — Live commerce order management
- `useOrderDetails(orderId)` — Fetches order details
- `useSellerProducts(sellerId)` — Fetches products for a seller

### `/src/hooks/useLiveStreamingSubscription.ts`
- `useLiveStreamingSubscription(streamId)` — Live streaming subscription management

### `/src/hooks/useLiveSettings.ts`
- `useLiveSettings(key)` — Live stream settings retrieval

### `/src/hooks/useViewerTracking.ts`
- `useViewerTracking(streamId, isHost, customUser)` — Comprehensive viewer tracking
- `useLiveViewerCount(streamId)` — Returns live viewer count

### `/src/hooks/useStreamRealtime.ts`
- `useStreamRealtime(streamId, handlers, battleId)` — Generic stream realtime subscriptions

### `/src/hooks/useStreamStats.ts`
- `useStreamStats(streamerId)` — Stream statistics (viewers, engagement, etc.)

### `/src/hooks/useStreamAudiencePresence.ts`
- `useStreamAudiencePresence(...)` — Audience presence detection

### `/src/hooks/useStreamCapacity.ts`
- `useStreamCapacity(streamId, userId)` — Stream viewer capacity management

### `/src/hooks/useStreamChat.ts`
- `useStreamChat({ streamId, hostId, isHost })` — Chat message management

### `/src/hooks/useStreamLikes.ts`
- `useStreamLikes(streamId, initialTotalLikes)` — Like count management

### `/src/hooks/useStreamSeats.ts`
- `useStreamSeats(...)` — Seat management for streams

### `/src/hooks/useStreamTopGifters.ts`
- `useStreamTopGifters({ streamId, ... })` — Top gifters display

### `/src/hooks/useStreamCollaboration.ts`
- `useStreamCollaboration(options)` — Stream collaboration (co-streams, guests)

### `/src/hooks/useStreamEndListener.ts`
- `useStreamEndListener({ streamId, ... })` — Listens for stream end events
- `useForceStreamEndRedirect(streamId)` — Forces redirect when stream ends

### `/src/hooks/useObsScenes.ts`
- `useObsScenes(options)` — OBS scene management

### `/src/hooks/useObsHeartbeat.ts`
- `useObsHeartbeat({ streamId, ... })` — OBS heartbeat monitoring

### `/src/hooks/useRTCAdminMonitor.ts`
- (DELETED - unused)

### `/src/hooks/useGamingHeartbeat.ts` (TSX)
- `useGamingHeartbeat({ streamId, ... })` — Gaming stream heartbeat

### `/src/hooks/useGamingHeartbeat.ts` (TS)
- Same hook (duplicate with different extension)

### `/src/hooks/useGamingStreamRecorder.ts`
- `useGamingStreamRecorder()` — Gaming stream recording management

### `/src/hooks/useGamingStreams.ts`
- `useGamingStreams(limit)` — Fetches active gaming streams

### `/src/hooks/useGamingBattle.ts`
- `useGamingBattle({ streamId, userId })` — Gaming battle management

### `/src/hooks/usePodiumAgora.ts`
- (See src/hooks/ for agora room variations)

### `/src/hooks/usePodcastAgora.ts`
- `usePodcastAgora({ ... })` — Agora connection for podcasts

### `/src/hooks/usePodcastRecorder.ts`
- (DELETED - unused)

### `/src/lib/hooks/useStreamMomentum.ts`
- `useStreamMomentum(streamId)` — Stream momentum/virality tracking

### `/src/lib/hooks/usePageVisibility.ts`
- See above

---

## 4. Battles & Competitions

Hooks for battle (PvP) gameplay, tournaments, and competitive features.

### `/src/hooks/useTrollBattle.ts`
- `useTrollBattle({ streamId, userId, isHost })` — Core battle state and logic

### `/src/hooks/useBattleState.ts`
- `useBattleState({ streamId, localUserId, isHost, hostId })` — Battle state management

### `/src/hooks/useBattleRealtime.ts`
- `useBattleRealtime(...)` — Real-time battle event subscriptions

### `/src/hooks/useBattleRoom.ts`
- `useBattleRoom({ ... })` — Battle room management (join/leave, participants)

### `/src/hooks/useBattleQueue.ts`
- `useBattleQueue(onBattleEnd)` — Battle queue matching system

### `/src/hooks/useBattleTimer.ts`
- `useBattleTimer(...)` — Battle countdown timer

### `/src/hooks/useBattleViewController.ts`
- `useBattleViewController({ ... })` — Battle view controller (camera, angles)

### `/src/hooks/useBattleViewMode.ts`
- `useBattleViewMode()` — Toggle between battle view modes

### `/src/hooks/useBattleEvents.ts`
- `useBattleEvents(battleId)` — Battle event logging and display

### `/src/hooks/useBattleSubscriber.ts`
- `useBattleSubscriber(stream)` — Battle subscriber management

### `/src/hooks/useBattleManagement.ts`
- `useBattleManagement({ battleId, streamId, isHost })` — Battle admin/management

### `/src/hooks/useFiveVFiveBattle.ts`
- `useFiveVFiveBattle({ streamId, isHost, category })` — 5v5 battle mode

### `/src/hooks/useGamingBattle.ts`
- See above

### `/src/hooks/useBoostBid.ts`
- `useBoostBid(...)` — Bid boosting for battles/auctions

### `/src/hooks/usePredictionBid.ts`
- `usePredictionBid(...)` — Prediction bidding system

### `/src/hooks/useBoxCount.ts`
- `useBoxCount({ streamId, initialBoxCount, isHost })` — Box count tracking

### `/src/hooks/useTrollMatch.ts`
- `useTMMatches(dating, limit)` — Troll Match dating/battle matchmaking
- `useTMViewedMe(limit)` — Who viewed my profile
- `useTMRecordView()` — Record a profile view
- `useTMUpdateProfile()` — Update Troll Match profile
- `useTMSendMessage()` — Send message to match
- `useTMMessagePricing(userId)` — Message pricing
- `useTMNeedsOnboarding()` — Check onboarding status
- `useTMProfile()` — Get Troll Match profile
- `useTMFamilyInvites()` — Family invites for Troll Match
- `useTMAllUsers(limit)` — Admin: all TM users

### `/src/hooks/useTrollopoly.ts`
- (DELETED - unused)

### `/src/hooks/useTrollTime.ts`
- `useTrollTime(battleId)` — Battle timer with special effects

### `/src/hooks/useTrollUsGame.ts`
- `useTrollUsGame({ streamId })` — "Troll Us" minigame

### `/src/hooks/useRandomBattleQueueController.ts`
- `useRandomBattleQueueController({ ... })` — Random battle queue controller

### `/src/hooks/useLeagueMissions.ts`
- `useLeagueMissions(leagueEventId)` — League mission tracking

### `/src/hooks/useLeaguePoints.ts`
- `useLeaguePoints()` — League point balance

### `/src/hooks/useLeagueProgress.ts`
- `useLeagueProgress(streamId)` — League progression tracking

### `/src/hooks/useLeagues.ts`
- `useLeagues()` — League system overview

### `/src/hooks/useLeagueSnapshot.ts`
- `useLeagueSnapshot({ ... })` — League snapshot data

### `/src/hooks/useFamilyLeagues.ts`
- `useFamilyGoals(familyId)` — Family league goals
- `useFamilyGoalProgress(familyId)` — Family goal progress
- `useLeagueSeason()` — Current league season
- `useLeagueStandings()` — League standings
- `useMyFamilyLeagueStanding()` — Current user's family league standing

### `/src/hooks/useActiveBroadcasts.ts`
- `useActiveBroadcasts()` — Lists currently active broadcasts

---

## 5. Gifts & Economy System

Hooks for gift sending/animation, monetization, supporter economy, and virtual economy.

### `/src/hooks/useGiftSystem.ts`
- `useGiftSystem(recipientId, streamId, ...)` — Core gift sending and processing system

### `/src/hooks/useGiftAnimationPipeline.ts`
- `useGiftAnimationPipeline()` — Manages gift animation queue and rendering

### `/src/hooks/useGifterRecognition.ts`
- `useGifterLeaderboard(type, limit)` — Top gifters leaderboard
- `useFanCrownStatus(userId)` — Crown status for top fans
- `useFanCrownHistory()` — Fan crown history

### `/src/hooks/useFeaturedGift.ts`
- `useFeaturedGift()` — Fetches featured/promoted gifts

### `/src/hooks/useQuickBroadcastGifts.ts`
- `useQuickBroadcastGifts({ ... })` — Quick gift buttons for broadcasters

### `/src/hooks/useTargetedGiftQueue.ts`
- `useTargetedGiftQueue()` — Targeted gift queue management

### `/src/hooks/useCreatorSubscription.ts`
- `useCreatorSubscription(broadcasterId, userId)` — Subscription management for creators
- `useSubscriberUsernames(broadcasterId)` — List of subscriber usernames
- `useSubscriberBadges(broadcasterId)` — Subscriber badge data
- `useUserSubscriptionTier(userId)` — User's subscription tier

### `/src/hooks/useProfileViewPayment.ts`
- `useProfileViewPayment({ ... })` — Pay-to-view profile system

### `/src/hooks/useTipBanner.ts`
- `useTipBanner(streamId)` — Tip banner display during streams

### `/src/lib/hooks/useCoins.ts`
- See above

### `/src/lib/hooks/useBank.ts`
- See above

### `/src/lib/hooks/useHypeCoins.ts`
- See above

### `/src/lib/hooks/useGiftSystem.ts`
- `useGiftSystem()` — Library-level gift system interface

### `/src/lib/hooks/useGiftEvents.ts`
- `useGiftEvents(streamId)` — Gift event tracking

### `/src/lib/hooks/useStockMarket.ts`
- See above

### `/src/lib/hooks/useDailyLoginPost.ts`
- See above

### `/src/lib/hooks/useEventGifts.ts`
- See above

### `/src/lib/hooks/useEventBonuses.ts`
- See above

### `/src/lib/hooks/useEventHighlights.ts`
- See above

### `/src/hooks/useCashoutBanner.ts`
- `useCashoutBanner({ ... })` — Cashout promotion banner

### `/src/hooks/usePurchasableItems.ts`
- `usePurchasableItems(category)` — Fetch purchasable items catalog

### `/src/hooks/usePurchases.ts`
- `usePurchases()` — User purchase history management
- `useTrollMartInventory()` — Troll Mart inventory tracking

### `/src/hooks/useWeeklyCashback.ts`
- `useWeeklyCashback()` — Weekly cashback management
- `useCashbackPeriods()` — Cashback period history
- `useProcessFridayRewards()` — Process Friday reward payouts

### `/src/hooks/usePerks.ts`
- `usePerkStatus(perkKey)` — Perk availability status
- `useActivePerks()` — All active perks for user
- `usePerkPurchase()` — Purchase a perk
- `useCanAffordPerk(perkKey)` — Check if user can afford a perk

### `/src/lib/hooks/useTrollz.ts`
- See above

### `/src/lib/hooks/useSmokeathon.ts`
- See above

### `/src/lib/hooks/useSmokeEvent.ts`
- See above

### `/src/components/feed-the-troll/useFeedTheTroll.ts`
- `useFeedTheTroll(...)` — Feed the Troll minigame state

### `/src/hooks/useStagePasses.ts`
- `useStagePasses(streamId)` — Stage pass management

### `/src/hooks/useMKeyJoinClaim.ts`
- `useMKeyJoinClaim({ ... })` — MKey join claim for battle events

### `/src/hooks/useMKeyWallet.ts`
- `useMKeyWallet({ enabled })` — MKey wallet management

---

## 6. Organization Management

Hooks for agency and organization management.

### `/src/hooks/useOrganizations.ts`
- `useOrganizations(selectedOrgId)` — Fetches user's organizations

### `/src/hooks/useOrganizationFiles.ts`
- `useOrganizationFiles(orgId)` — Organization file management

### `/src/hooks/useOrganizationMessages.ts`
- `useOrganizationMessages(orgId)` — Organization messaging

### `/src/hooks/useUploadOrganizationDocument.ts`
- See above

### `/src/hooks/useGetUserDocuments.ts`
- See above

### `/src/hooks/useGetTromailRoleDirectory.ts`
- See above

### `/src/hooks/useAgency.ts`
- `useAgencyApplication()` — Agency application management
- `useAgencyMember()` — Agency member data
- `useAgencyTransactions(limit)` — Agency transaction history
- `useAgencyWeeklyStats(limit)` — Weekly agency statistics
- `useAgencyRewards()` — Agency rewards
- `useAgencyLeaderboard()` — Agency leaderboard
- `useAgencyRealtime()` — Real-time agency updates

---

## 7. Admin & Moderation

Hooks for administration dashboard, moderation tools, and real-time monitoring.

### `/src/hooks/useAdmin.ts`
- `useAdmin()` — Admin flag and role management

### `/src/hooks/useAdminAgency.ts`
- `useAdminAgencyApplications()` — Admin agency applications
- `useAdminAgencyMembers()` — Admin agency member list
- `useAdminAgencyTransactions(userId, limit)` — Admin agency transaction review
- `useAdminAgencyLeaderboard()` — Admin agency leaderboard
- `useAdminAgencyAuditLog(limit)` — Admin agency audit logs
- `useAdminAgencyRewards()` — Admin agency rewards configuration

### `/src/hooks/useAdminDashboardMetrics.ts`
- `useAdminDashboardMetrics()` — Admin dashboard metrics

### `/src/hooks/useAdminFinanceRealtime.ts`
- `useAdminFinanceRealtime()` — Real-time financial data for admin

### `/src/hooks/useAdminVoiceNotifications.ts`
- `useAdminVoiceNotifications()` — Admin voice notification system

### `/src/hooks/useModLogs.ts`
- `useModLogs(filters, pageSize)` — Moderation log retrieval

### `/src/hooks/useSecurityEvents.ts`
- `useSecurityEvents()` — Security event monitoring

### `/src/hooks/useStaffAudit.ts`
- `useStaffAudit(filters)` — Staff audit trail

### `/src/hooks/useJudgeRole.ts`
- `useJudgeRole()` — Judge role management (court system)

### `/src/hooks/useCustomerServiceUsers.ts`
- `useCustomerServiceUsers()` — Customer service user management

### `/src/hooks/useStaffWalkieTalkie.ts`
- `useStaffWalkieTalkie({ ... })` — Staff walkie-talkie communication

### `/src/hooks/useOfficerBroadcastTracking.ts`
- `useOfficerBroadcastTracking({ ... })` — Officer broadcast monitoring

### `/src/hooks/useOfficerStreamTracking.ts`
- `useOfficerStreamTracking(streamId)` — Officer stream tracking

### `/src/pages/admin/hooks/useSupabaseQuery.ts`
- `useSupabaseQuery<T>(...)` — Generic Supabase query hook for admin

### `/src/pages/admin/hooks/useRealtimeUsers.ts`
- `useRealtimeUsers()` — Admin: real-time user monitoring

### `/src/pages/admin/hooks/useRealtimeStreams.ts`
- `useRealtimeStreams()` — Admin: real-time stream monitoring

### `/src/pages/admin/hooks/useRealtimeMetrics.ts`
- `useRealtimeMetrics()` — Admin: real-time metrics

### `/src/hooks/usePresidentialTownHall` (features)
- See `/src/pages/president/` and `/src/components/president/`

### `/src/hooks/useGovernmentSystem.ts`
- `useGovernmentSystem()` — Government system state

### `/src/hooks/usePresidentSystem.ts`
- `usePresidentSystem()` — President role system management

---

## 8. TCN (Troll City News)

Hooks for the built-in news/tipping platform.

### `/src/hooks/useTCNNAdmin.ts`
- `useTCNNAdmin()` — TCN admin dashboard

### `/src/hooks/useTCNNArticles.ts`
- `useTCNNArticles(options)` — Fetch TCN articles

### `/src/hooks/useTCNNRoles.ts`
- `useTCNNRoles(userId)` — TCN contributor roles

### `/src/hooks/useTCNNTipping.ts`
- `useTCNNTipping()` — TCN tipping system

### `/src/hooks/useEPaper.ts`
- `useEPaperStories(limit, offset, status)` — E-paper stories
- `useEPaperStory(slug)` — Single story fetch
- `useIncrementEPaperViews()` — Track story views
- `useTipEPaperStory()` — Tip article author
- `useUniverseEvents(limit)` — Universe event feed
- `useCreateEPaperStory()` — Create news story

### `/src/hooks/useTrendingPosts.ts`
- `useTrendingPosts(limit)` — Trending posts across the platform

### `/src/hooks/useGlobalActivity.ts`
- `useGlobalActivity()` — Global activity feed

### `/src/hooks/useUpcomingEvents.ts`
- `useUpcomingEvents(limit)` — Upcoming events listing

---

## 9. PWA, Mobile & Client Features

Hooks for PWA functionality, mobile layout, and device-specific behavior.

### `/src/contexts/PWAContext.tsx`
- `usePWA()` — PWA context (install, cache, network status)
- `useInstallState()` — PWA install readiness
- `useNetworkStatus()` — Network connectivity status
- `useSWStatus()` — Service worker status
- `usePushNotifications()` — Push notification management
- `usePWACache()` — PWA cache management
- `useConnectionHealth()` — Connection health monitoring

### `/src/pwa/useInstallPrompt.ts`
- `useInstallPrompt()` — PWA install prompt handling

### `/src/lib/hooks/useIsPwa.ts`
- `useIsPwa()` — Checks if running as PWA

### `/src/hooks/useIsMobile.ts`
- `useIsMobile()` — Mobile device detection

### `/src/hooks/useMobileBreakpoint.ts`
- `useMobileBreakpoint()` — Tracks mobile breakpoint state

### `/src/hooks/useMobileLayout.ts`
- `useMobileLayout()` — Mobile layout state management
- `useSafeAreaHeight()` — Safe area insets

### `/src/hooks/usePhoneViewerDebug.ts`
- `usePhoneViewerDebug(prefix)` — Phone viewer debug logging

### `/src/phone/useIsPhone.ts`
- `useIsPhone()` — Phone-specific device detection

### `/src/phone/usePhoneRoleAccess.ts`
- `usePhoneRoleAccess()` — Phone-specific role/permission access

### `/src/hooks/useHomeSwipeNavigation.ts`
- `useHomeSwipeNavigation()` — Home screen swipe navigation

### `/src/hooks/usePullToRefresh.ts`
- See above

### `/src/hooks/useDoubleTap.ts`
- See above

### `/src/hooks/useAutoUpdate.ts`
- See above

### `/src/hooks/useBatterySaver.ts`
- `useBatterySaver()` — Battery saver mode detection

---

## 10. Founder Program & Creator Economy

Hooks for founder/creator program, subscriber badges, and premium features.

### `/src/hooks/useFounderProgram.ts`
- `useFounderIdentity(userId)` — Founder identity verification
- `useIsActiveFounder(userId)` — Active founder status check
- `useShowFounderBadge(userId)` — Should founder badge display
- `useFounderSelfStatus()` — Current user's founder status
- `useFounderChat(enabled)` — Founder-only chat

### `/src/hooks/useCreatorSubscription.ts`
- See above (Creator Subscription section)

### `/src/hooks/useCashoutBanner.ts`
- See above

### `/src/hooks/useWeeklyCashback.ts`
- See above

### `/src/hooks/useGifterRecognition.ts`
- See above

### `/src/hooks/useBroadcasterWishlist.ts`
- See above

---

## 11. Social, Family & Community

Hooks for family/gang systems, social posts, and community features.

### `/src/hooks/useFamilyAchievementSystem.ts`
- `useFamilyStats(familyId)` — Family statistics
- `useAchievementTiers()` — Achievement tier definitions
- `useFamilyAchievements(familyId)` — Family achievements
- `useWeeklyGoals(familyId)` — Weekly family goals
- `useLevelUnlocks(currentLevel)` — Level-based unlocks
- `useHiddenAchievements()` — Hidden achievements
- `useFamilyLeaderboard(limit)` — Family leaderboard
- `useAwardFamilyXP()` — Award XP to family
- `useGenerateWeeklyGoals()` — Generate weekly goals
- `useCheckRateLimit()` — Rate limiting check
- `useFamilyRealtime(familyId, enabled)` — Real-time family updates
- `useFamilyEarningsPool(familyId)` — Family earnings pool
- `useMemberEarnings(familyId, userId)` — Individual member earnings
- `usePayoutHistory(familyId, limit)` — Payout history
- `useAddFamilyEarnings()` — Add earnings to family
- `useDistributeWeeklyEarnings()` — Distribute weekly earnings
- `useGetMemberPayout()` — Get member payout amount
- `useSetupLeaderTax()` — Setup leader tax configuration

### `/src/hooks/useTrollFamilyActivity.ts`
- `useTrollFamilyActivity()` — Family activity feed

### `/src/hooks/useWallPosts.ts`
- `useWallPosts(limit)` — Wall post management

### `/src/hooks/useWallNotifications.ts`
- `useWallNotifications(isWallActive)` — Wall notification management

### `/src/hooks/useTopFamilies.ts`
- `useTopFamilies(limit)` — Top families ranking

### `/src/hooks/useHighlightedChat.ts`
- `useHighlightedChat(streamId)` — Chat highlight management

### `/src/hooks/useHomeSwipeNavigation.ts`
- See above

### `/src/hooks/useIncomingMessagePopup.ts`
- `useIncomingMessagePopup()` — Incoming message popup display

### `/src/hooks/useUtromailMessagePopup.ts`
- `useUtromailMessagePopup()` — Utromail message popup

### `/src/hooks/useChatBlockStatus.ts`
- `useChatBlockStatus(userId, streamId)` — Chat block/timeout status

### `/src/hooks/userIds.tsx`
- Not a hook — component file for displaying user IDs with SEO layout (imports from SEOLayout)

### `/src/hooks/useMediaStream.js`
- `useMediaStream()` — Media stream (audio/video) capture management

### `/src/lib/hooks/usePerformance.ts`
- `useStableCallback(callback)` — Memoized stable callback
- `useMemoized(value)` — Memoized value with deep comparison
- `useDebouncedCallback(callback, delay)` — Debounced callback wrapper
- `useThrottledCallback(callback, delay)` — Throttled callback wrapper
- `usePerformanceMonitor(componentName)` — Component performance monitoring
- `useBatchedState(initialState)` — Batched state updates

### `/src/lib/engagement/useStreamEngagement.ts`
- `useStreamEngagement({ streamId, ... })` — Stream engagement tracking

### `/src/lib/engagement/useEngagementBatch.ts`
- `useEngagementBatch({ ... })` — Batched engagement event processing

---

## 12. Jail, Ghost Mode & Prison System

Hooks for jail time, ghost mode, and prison-related gameplay.

### `/src/hooks/useJailMode.ts`
- `useJailMode(userId)` — Jail mode detection

### `/src/hooks/useJailTime.ts`
- `useJailTime({ ... })` — Jail time countdown and management

### `/src/hooks/useGhostMode.ts`
- `useGhostMode({ streamId, userId, isCEO, roomRef })` — Ghost mode (invisible viewing)

---

## 13. Mai Business & Mai Sing Off

Hooks for the Mai business and singing competition features.

### `/src/features/mai-sing-off/hooks/useSingOffRealtime.ts`
- `useSingOffRealtime(sessionId, userId)` — Realtime mai-sing-off event updates

### `/src/features/mai-sing-off/hooks/useSingOffLiveKit.ts`
- `useSingOffLiveKit({ ... })` — LiveKit integration for sing-off

### `/src/features/mai-sing-off/hooks/useSingOffActions.ts`
- `useSingOffActions()` — Mai Sing Off action dispatchers

### `/src/features/mai-sing-off/store/useSingOffStore.ts`
- `useSingOffStore` — Zustand store for mai sing-off state

### `/src/hooks/useShareAThonRestriction.ts`
- `useShareAThonRestriction(userId)` — Share-a-thon event restrictions

---

## 14. Stores (Zustand)

Zustand-based state management stores across the application.

### `/src/stores/`
- `useXPStore` — XP progression store (`useXPStore.ts`)
- `useSubscriptionStore` — Subscription state store (`useSubscriptionStore.ts`)
- `useSidebarStore` — Sidebar navigation store (`useSidebarStore.ts`)
- `useProfileFrameStore` — Profile frame management store (`useProfileFrameStore.ts`)
- `useKeyDiscoveryStore` — Key discovery game store (`useKeyDiscoveryStore.ts`)
- `useBugAlertStore` — Bug alert system store (`useBugAlertStore.ts`)
- `useAdminRealtimeStore` — Admin real-time data store (`useAdminRealtimeStore.ts`)
- `useTrollopolyStore` — Trollopoly game store (`trollopolyStore.ts`)
- `useTickerStore` — Ticker display store (`tickerStore.ts`)
- `usePodcastStore` — Podcast state store (`podcastStore.ts`)
- `useLiveStreamingStore` — Live streaming state store (`liveStreamingStore.ts`)
- `useARGiftStore` — AR gift system store (`arGiftStore.ts`)

### `/src/lib/stores/`
- `useGiftStore` — Gift system store (`useGiftStore.ts`)
- `useGiftById(giftId)` — Selector: get single gift
- `useGiftsByRarity(rarity)` — Selector: gifts by rarity

### `/src/lib/`
- `useAuthStore` — Authentication store (`store.ts`)
- `useSetting(key)` — App settings store (`appSettingsStore.ts`)
- `useSettingsLoading()` — Settings loading state
- `useSettingsError()` — Settings error state
- `useAnimationStore` — Animation manager store (`animationManager.ts`)
- `useAnimationSettings()` — Animation settings
- `useChatStore` — Chat bubble state store (`chatStore.ts`)
- `useEligibilityStore` — Eligibility checks store (`eligibilityStore.ts`)
- `useLiveContextStore` — Live context store (`liveContextStore.ts`)
- `useLevelStore` — Level progression store (`levelStore.ts`)
- `useGiftEngine` — Gift engine store (`giftEngine.ts`)
- `usePreflightStore` — Preflight checks store (`preflightStore.ts`)
- `usePresenceStore` — Presence tracking store (`presenceStore.ts`)
- `usePurchaseGateStore` — Purchase gate store (`purchaseGate.ts`)
- `useStreamStore` — Stream data store (`streamStore.ts`)
- `useMaiTrollOperatingStore` — Mai Troll operating hours store (`maitrollOperatingStore.ts`)
- `useMaiTrollOperatingHours()` — Operating hours hook

### `/src/lib/seo/`
- `useRouteTitle()` — Dynamic route title management
- `usePageTitle(title)` — Set page title
- `useRobotsMeta()` — Manage robots meta tags

### `/src/lib/engagement/`
- `useStreamEngagement({ ... })` — Stream engagement tracking
- `useEngagementBatch({ ... })` — Batched engagement events

### `/src/lib/weeklyTasks.ts`
- `useWeeklyTasks()` — Weekly challenge/task management

### `/src/troll/`
- `useTrollEngine(onBackgroundTrigger)` — Troll event engine
- `useTrollContext()` — Troll overlay context

### `/src/context/`
- `useGhostDropIn()` — Ghost drop-in context
- `TrollProvider.tsx` — `useTrollContext`

### `/src/lib/coinRotation.ts`
- `useCoinRotation()` — Coin rotation animation

### `/src/lib/themeContext.tsx`
- `useTheme()` — Theme management

### `/src/lib/cartContext.tsx`
- `useCart()` — Shopping cart management

### `/src/lib/getAgoraAppId.tsx`
- `useAgoraScreenShare()` — Agora screen share (duplicate of hooks version)

---

## 15. Contexts (React Context Providers with Hooks)

### `/src/contexts/AuthContext.tsx`
- Re-exports `useAuth` from `@/hooks/useAuth`

### `/src/contexts/BroadcastEffectsContext.tsx`
- `useBroadcastEffects()` — Broadcast visual effects

### `/src/contexts/ConsentContext.tsx`
- `useConsent()` — User consent management
- `useConsentValue<K>(key)` — Get specific consent value

### `/src/contexts/EasterEggHuntContext.tsx`
- `useEasterEggHunt()` — Easter egg hunt state

### `/src/contexts/GamingStreamContext.tsx`
- `useGamingStreamId()` — Current gaming stream ID
- `useSetGamingStreamId()` — Setter for gaming stream ID

### `/src/contexts/GlobalAppContext.tsx`
- `useGlobalApp()` — Global app state

### `/src/contexts/GlobalEventContext.tsx`
- `useGlobalEvent()` — Global event data
- `useEventAdmin()` — Event admin controls

### `/src/contexts/KeyboardContext.tsx`
- `useKeyboard()` — Keyboard shortcut management

### `/src/contexts/LiveContentContext.tsx`
- `useLiveContent()` — Live content state

### `/src/contexts/PageChannelContext.tsx`
- `usePageChannel()` — Page-to-channel communication
- `usePageChannelSubscription(...)` — Channel subscription

### `/src/contexts/PageVisibilityContext.tsx`
- `usePageVisibilityContext()` — Page visibility context
- `useVisibilityAware(callbacks)` — Visibility-aware callbacks

### `/src/contexts/ProfileFrameContext.tsx`
- `useProfileFrameContext()` — Profile frame context

### `/src/contexts/PWAContext.tsx`
- See PWA section above

### `/src/contexts/ShareAThonContext.tsx`
- `useShareAThon()` — Share-a-thon event state

### `/src/contexts/StreamRouteContext.tsx`
- `useResolvedStreamId(fallback)` — Resolve stream ID from route
- `useResolvedStream(fallback)` — Resolve full stream object from route

### `/src/contexts/SwipeNavigationContext.tsx`
- `useSwipeNavigation()` — Swipe navigation state
- `useSwipeNavigationProvider` — Alias for useSwipeNavigation

### `/src/contexts/ThemeAudioContext.tsx`
- `useThemeAudio()` — Theme audio management

### `/src/context/GhostDropInContext.tsx`
- `useGhostDropIn()` — Ghost drop-in state

---

## 16. UI & Theme Hooks

### `/src/hooks/useTheme.ts`
- `useTheme()` — Theme switching

### `/src/hooks/useThemeAudio.ts`
- `useThemeAudio` — Theme audio store (Zustand)

### `/src/hooks/useUserFrame.ts`
- See above

### `/src/hooks/useBroadcastFrame.ts`
- See above

### `/src/hooks/useMobileBreakpoint.ts`
- See above

### `/src/hooks/useMobileLayout.ts`
- See above

### `/src/hooks/usePerformanceBenchmark.ts`
- `usePerformanceBenchmark(config)` — Performance benchmarking

### `/src/hooks/useRealtimeStability.ts`
- `useRealtimeStability(options)` — Realtime connection stability
- `useLivestreamStability(streamId)` — Stream stability metrics

### `/src/hooks/usePageVisibility.tsx`
- See above

### `/src/hooks/useSEO.tsx`
- `useSEO(...)` — SEO metadata management

---

## 17. Component-Level Hooks

Hooks exported directly from component files.

### `/src/components/AddressManager.tsx`
- `useSavedAddresses(userId)` — Saved addresses management
- `useCreateAddress()` — Create address mutation
- `useUpdateAddress()` — Update address mutation
- `useDeleteAddress()` — Delete address mutation

### `/src/components/broadcast/battle/ActiveBattlesPanel.tsx`
- `useActiveBattles(currentBattleId)` — Active battles panel state

### `/src/components/feed-the-troll/useFeedTheTroll.ts`
- `useFeedTheTroll(...)` — Feed the Troll minigame

### `/src/components/entrance/useGrandEntrance.ts`
- `useGrandEntrance()` — Grand entrance animation state

### `/src/components/game/GameNavigation.tsx`
- `useGameNavigate()` — Game navigation logic

### `/src/components/GlobalEventThemeLayer.tsx`
- `useEventTheme()` — Global event theme

### `/src/components/broadcast/JailBarOverlay.tsx`
- `useJailTimeState(...)` — Jail bar overlay state

### `/src/components/marketing/ReadOnlyGuard.tsx`
- `useCanWrite()` — Check if user can write
- `useIsMarketingReadonly()` — Check if marketing is read-only

### `/src/components/promo/PromoSlot.tsx`
- `useCityAds(placement)` — City ad placement

### `/src/components/StaffWalkieTalkieProvider.tsx`
- `useStaffWalkieTalkieContext()` — Staff walkie-talkie context

### `/src/components/TabSwitchHandler.tsx`
- `useTabVisibility()` — Tab visibility tracking

### `/src/components/uploadVerificationFile.tsx`
- `useAuth()` — Auth hook (component-local version)

---

## 18. Feature Modules (Directories)

### `/src/features/employees/`
Employee management system with:
- `EmployeesPage.tsx` — Main employee page
- `permissions.ts` — Permission system
- `tabs/` — 13 tab components (Announcements, Chat, DepartmentTools, Documents, etc.)
- `components/documents/` — 16 document form components (FormI9, FormW4, NDA, etc.)
- `components/InterviewScreen.tsx`, `OnlineEmployees.tsx`, `PermissionGate.tsx`

### `/src/features/mai-business/`
Mai business application system with:
- `pages/` — 15 page components (Dashboard, Funding, Plan, Documents, etc.)
- `components/` — Business components directory
- `lib/maiBusinessApi.ts` — Business API client

### `/src/features/mai-sing-off/`
Mai Sing Off competition system with:
- `pages/` — ChampionshipView, MaiSingOffPage, Lobby views
- `components/` — 20+ sing-off components (JudgeControls, MicStand, StageLayout, etc.)
- `hooks/` — useSingOffRealtime, useSingOffLiveKit, useSingOffActions
- `store/useSingOffStore.ts` — Zustand store
- `services/singoffService.ts` — Backend service
- `types.ts` — Type definitions

---

## 19. lib/hooks/ (Library Hooks Summary)

Located at `/src/lib/hooks/`:

| File | Hook(s) | Category |
|---|---|---|
| useAllCreditScores.ts | useAllCreditScores | Admin/Moderation |
| useAvatar.ts | useAvatar | UI |
| useBank.ts | useBank | Economy |
| useCityStatusOrb.ts | useCityStatusOrb | UI |
| useCoins.ts | useCoins | Economy |
| useCreditScore.ts | useCreditScore | Economy |
| useDailyLoginPost.ts | useDailyLoginPost | Game Mechanics |
| useEventBonuses.ts | useEventBonuses | Events |
| useEventGifts.ts | useEventGifts | Events |
| useEventHighlights.ts | useEventHighlights | Events |
| useGasSystem.ts | useGasSystem | Vehicles |
| useGiftEvents.ts | useGiftEvents | Gifts |
| useGiftSystem.ts | useGiftSystem | Gifts |
| useHouseRaidActions.ts | useHouseRaidActions | Houses |
| useHypeCoins.ts | useHypeCoins | Economy |
| useInsurance.ts | useInsurance | Economy |
| useIsPwa.ts | useIsPwa | PWA |
| useLazyAPI.ts | useLazyAPI, useVisibilityMemo, useBatchedState | Utilities |
| useNeighborhood.ts | useNeighborhood, useHouseRaids | Neighborhood |
| usePageVisibility.ts | usePageVisibility | Utilities |
| usePreventRefresh.ts | usePreventTabRefresh, useStatePersistence, useScrollPersistence, useRefreshPrevention | Utilities |
| useRepossession.ts | useRepossession | Vehicles |
| useSmokeathon.ts | useSmokeathon | Events |
| useSmokeEvent.ts | useSmokeEvent | Events |
| useStockMarket.ts | useStockMarket | Economy |
| useStreamMomentum.ts | useStreamMomentum | Streaming |
| useTrollz.ts | useTrollz | Economy |
| useVandalism.ts | useVandalism | Vehicles |
| useVehicleAssets.ts | useVehicleAssets, useVehicleAdmin | Vehicles |
| useVehicleSystem.ts | useVehicleSystem, useDriverTest | Vehicles |
| useVisibilityOptimized.ts | useLazyOperation, useVisibilityAwareInterval, useVisibilityOptimized | Utilities |
| useXPSync.ts | useXPSync | Progression |
| useXPTracking.ts | useXPTracking | Progression |

### Additional src/hooks/ (JavaScript/Variant Files)

| File | Hook(s) | Notes |
|---|---|---|
| useBroadcastRealtime.js | Re-exports from useBroadcastRealtime.ts | JS alias |
| useBroadcastRecorder.zip | useBroadcastRecorder (source backup) — see .ts | Zipped source |
| useMediaStream.js | useMediaStream | JS-only hook |
| useBroadcastRealtime.ts | useBroadcastRealtime | Also exports hydrateRealtimeGift |
| userIds.tsx | (component, not a hook) | SEO page component |
| useGamingHeartbeat.tsx | useGamingHeartbeat | TSX variant |
| useGamingHeartbeat.ts | useGamingHeartbeat | TS variant (duplicate) |
| usePageVisibility.tsx | usePageVisibility, useUcRedirect | TSX variant |
| usePageVisibility.ts | usePageVisibility, useUcRedirect | TS variant |
| useSEO.tsx | useSEO | SEO metadata hook |
| useSafeNavigate.tsx | useSafeNavigate | Safe navigation |
| userIds.tsx | (component) | Creator listing page |

---

## Hook Counts Summary

| Location | Hook Files | Individual Hooks | Store Files |
|---|---|---|---|
| `/src/hooks/` | ~140 files | ~200 hooks | 0 |
| `/src/lib/hooks/` | 35 files | ~45 hooks | 0 |
| `/src/features/mai-sing-off/hooks/` | 3 files | 3 hooks | 1 store |
| `/src/pages/admin/hooks/` | 4 files | 4 hooks | 0 |
| `/src/contexts/` (context hooks) | 18 files | ~25 context hooks | 0 |
| `/src/context/` | 1 file | 1 hook | 0 |
| `/src/stores/` | 0 | 0 | 12 stores |
| `/src/lib/stores/` | 0 | 0 | 1 store |
| `/src/lib/` (misc hooks) | ~10 files | ~25 hooks | ~10 stores |
| `/src/components/` (component-level hooks) | ~5 files | ~15 hooks | 0 |
| `/src/troll/` | 2 files | 2 hooks | 0 |
| `/src/pwa/` | 1 file | 1 hook | 0 |
| `/src/phone/` | 2 files | 2 hooks | 0 |
| **Total** | **~230 files** | **~320+ individual hooks** | **~25 stores** |

---

## Naming Conventions

- All hooks follow the `use` prefix convention (React Hooks rules)
- Multi-hook files group related hooks by feature domain (e.g., `useFamilyAchievementSystem.ts` exports 18 hooks)
- Store files named `use*Store` use Zustand `create()` pattern
- `.tsx` files contain hooks that use JSX or return JSX-based content
- `.ts` files contain pure logic hooks
- Context files re-export hooks for external consumption (e.g., `AuthContext.tsx` re-exports `useAuth`)
- Feature-scoped hooks live in `features/*/hooks/` subdirectories
- Utility hooks live in `lib/hooks/` with shared infrastructure concerns
