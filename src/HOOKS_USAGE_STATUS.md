# Hook Usage Status Report

**Last Verified:** 2026-10-06

## ✅ DELETED FILES (Confirmed Unused)
The following hook files have been deleted from the codebase:
- `src/hooks/usePodcastRecorder.ts` — usePodcastRecorder
- `src/hooks/useSeatLiveKit.ts` — useSeatLiveKit
- `src/hooks/useSeatRoster.ts` — useSeatRoster
- `src/lib/hooks/useSmokeathon.ts` — useSmokeathon
- `src/hooks/useTrollopoly.ts` — useTrollopoly
- `src/lib/requestScheduler.ts` — useRequestScheduler
- `src/hooks/useRTCAdminMonitor.ts` — useRTCAdminMonitor

## 📋 VERIFIED NOTES
All hooks with notes have been verified:
- `useProcessFridayRewards` — UNUSED, not wired to anything
- `useProfileViewPayment` — UNUSED, not part of subscriptions
- `usePushNotifications` — UNUSED, not used anywhere
- `useRequestScheduler` — UNUSED, dead code → DELETED
- `useRTCAdminMonitor` — UNUSED, component is separate → DELETED
- `useSeatLiveKit` — UNUSED, BroadcastPage/ViewerPage don't use it → DELETED
- `useSeatRoster` — UNUSED, BroadcastPage/ViewerPage don't use it → DELETED
- `useShowFounderBadge` — UNUSED, but file is used by other hooks (keep file)
- `useSlaViolations` — UNUSED, note said "KEEP SHOULD BE WIRED" but currently not wired

---

**Legend:**
- 🟢 **Green** = Used (wired into the codebase, including partial usage)
- 🔴 **Red** = Unused (only defined, not referenced elsewhere)
- ✅ **Deleted** = File removed from codebase

---

## 🔴 UNUSED HOOKS (Not Wired Into Codebase)

These hooks are defined but not referenced from any other file. They appear only in their definition file.

| Hook Name | Definition File |
|-----------|----------------|
| useActiveBroadcasts | src/hooks/useActiveBroadcasts.ts |
| useActiveInsurance | src/hooks/useInsurance.ts |
| useActivePerks | src/hooks/usePerks.ts |
| useAddFamilyEarnings | src/hooks/useFamilyAchievementSystem.ts |
| useAdminRealtimeStore | src/stores/useAdminRealtimeStore.ts |
| useAgencyRealtime | src/hooks/useAgency.ts |
| useARGiftDurationManager | src/hooks/useARGiftDuration.ts |
| useARGiftSettings | src/hooks/useARGiftDuration.ts |
| useAwardFamilyXP | src/hooks/useFamilyAchievementSystem.ts |
| useBackgroundProfileRefresh | src/hooks/useBackgroundProfileRefresh.ts |
| useBattleEvents | src/hooks/useBattleEvents.ts |
| useBattleQueue | src/hooks/useBattleQueue.ts |
| useBattleSubscriber | src/hooks/useBattleSubscriber.ts |
| useBattleTimer | src/hooks/useBattleTimer.ts |
| useBroadcasterSeatQueue | src/hooks/useBroadcasterSeatQueue.ts |
| useBroadcasterSlaSummary | src/hooks/useSlaStatus.ts |
| useBroadcastRecorder | src/hooks/useBroadcastRecorder.ts |
| useBroadcastStartCheck | src/hooks/useBroadcastStartCheck.ts |
| useBroadcastStreaming | src/hooks/useBroadcastStreaming.ts |
| useBugAlert | src/hooks/useBugAlert.ts |
| useCanAffordInsurance | src/hooks/useInsurance.ts |
| useCanAffordPerk | src/hooks/usePerks.ts |
| useCanWrite | src/components/marketing/ReadOnlyGuard.tsx |
| useCashbackPeriods | src/hooks/useWeeklyCashback.ts |
| useCheckRateLimit | src/hooks/useFamilyAchievementSystem.ts |
| useCityAds | src/components/promo/PromoSlot.tsx |
| useCityAnnouncements | src/hooks/useCityAnnouncements.ts |
| useCoinRotation | src/lib/coinRotation.ts |
| useConnectionHealth | src/contexts/PWAContext.tsx |
| useConsentValue | src/contexts/ConsentContext.tsx |
| useCreateAddress | src/components/AddressManager.tsx |
| useCreateEPaperStory | src/hooks/useEPaper.ts |
| useDebouncedCallback | src/lib/performance.ts |
| useDeleteAddress | src/components/AddressManager.tsx |
| useDistributeWeeklyEarnings | src/hooks/useFamilyAchievementSystem.ts |
| useDoubleTap | src/hooks/useDoubleTap.ts |
| useEngagementBatch | src/lib/engagement/useEngagementBatch.ts |
| useEquippedVehicle | src/hooks/useEquippedVehicle.ts |
| useEventStore | src/lib/events/eventRegistry.ts |
| useFamilyEarningsPool | src/hooks/useFamilyAchievementSystem.ts |
| useFamilyGoalProgress | src/hooks/useFamilyLeagues.ts |
| useFamilyGoals | src/hooks/useFamilyLeagues.ts |
| useFamilyRealtime | src/hooks/useFamilyAchievementSystem.ts |
| useFanCrownHistory | src/hooks/useGifterRecognition.ts |
| useForceStreamEndRedirect | src/hooks/useStreamEndListener.ts |
| useGameNavigate | src/components/game/GameNavigation.tsx |
| useGamingStreamRecorder | src/hooks/useGamingStreamRecorder.ts |
| useGamingStreams | src/hooks/useGamingStreams.ts |
| useGasSystem | src/lib/hooks/useGasSystem.ts |
| useGenerateWeeklyGoals | src/hooks/useFamilyAchievementSystem.ts |
| useGetContractsByRecipient | src/hooks/useGetContracts.ts |
| useGetContractTemplateById | src/hooks/useGetContractTemplates.ts |
| useGetMemberPayout | src/hooks/useFamilyAchievementSystem.ts |
| useGiftEngine | src/lib/giftEngine.ts |
| useGiftEvents | src/lib/hooks/useGiftEvents.ts |
| useGoldenBuzzer | src/lib/useGoldenBuzzer.ts |
| useHiddenAchievements | src/hooks/useFamilyAchievementSystem.ts |
| useHighlightedChat | src/hooks/useHighlightedChat.ts |
| useHouseRaids | src/lib/hooks/useNeighborhood.ts |
| useIncomingMessagePopup | src/hooks/useIncomingMessagePopup.ts |
| useInstallState | src/contexts/PWAContext.tsx |
| useInsurance | src/lib/hooks/useInsurance.ts |
| useInsurancePlans | src/hooks/useInsurance.ts |
| useInsurancePurchase | src/hooks/useInsurance.ts |
| useIsMarketingReadonly | src/components/marketing/ReadOnlyGuard.tsx |
| useIsPwa | src/lib/hooks/useIsPwa.ts |
| useJailTimeState | src/components/broadcast/JailBarOverlay.tsx |
| useJudgeRole | src/hooks/useJudgeRole.ts |
| useKeyboard | src/contexts/KeyboardContext.tsx |
| useLazyAPI | src/lib/hooks/useLazyAPI.ts |
| useLazyOperation | src/lib/hooks/useVisibilityOptimized.ts |
| useLeadOfficerApplication | src/fixes/application-lead-officer-fix.ts |
| useLeaguePoints | src/hooks/useLeaguePoints.ts |
| useLeagues | src/hooks/useLeagues.ts |
| useLeagueSeason | src/hooks/useFamilyLeagues.ts |
| useLeagueStandings | src/hooks/useFamilyLeagues.ts |
| useLevelStore | src/lib/levelStore.ts |
| useLiveKitRoomLegacy | src/hooks/useRoom.ts |
| useLiveSettings | src/hooks/useLiveSettings.ts |
| useLiveStreamingSubscription | src/hooks/useLiveStreamingSubscription.ts |
| useLivestreamStability | src/hooks/useRealtimeStability.ts |
| useLiveTimer | src/hooks/useLiveTimer.ts |
| useLiveViewer | src/hooks/useLiveViewer.ts |
| useLiveViewerCount | src/hooks/useViewerTracking.ts |
| useMediaStream | src/hooks/useMediaStream.js |
| useMemberEarnings | src/hooks/useFamilyAchievementSystem.ts |
| useMemoized | src/lib/performance.ts |
| useMobileBreakpoint | src/hooks/useMobileBreakpoint.ts |
| useMobileLayout | src/hooks/useMobileLayout.ts |
| useMyFamilyLeagueStanding | src/hooks/useFamilyLeagues.ts |
| useMyOnlineStatus | src/hooks/useUserPresence.ts |
| useNetworkStatus | src/contexts/PWAContext.tsx |
| useObsScenes | src/hooks/useObsScenes.ts |
| useOfficerBroadcastTracking | src/hooks/useOfficerBroadcastTracking.ts |
| useOfficerStreamTracking | src/hooks/useOfficerStreamTracking.ts |
| useOrderDetails | src/hooks/useLiveCommerceOrders.ts |
| usePageChannel | src/contexts/PageChannelContext.tsx |
| usePageChannelSubscription | src/contexts/PageChannelContext.tsx |
| usePayoutHistory | src/hooks/useFamilyAchievementSystem.ts |
| usePerformanceBenchmark | src/hooks/usePerformanceBenchmark.ts |
| usePerformanceMonitor | src/lib/performance.ts |
| usePerkPurchase | src/hooks/usePerks.ts |
| usePerkStatus | src/hooks/usePerks.ts |
| usePersistentGifts | src/hooks/usePersistentGifts.ts |
| usePhoneViewerDebug | src/hooks/usePhoneViewerDebug.ts |
| usePodcastRecorder | DELETED - file removed |
| useProcessFridayRewards | src/hooks/useWeeklyCashback.ts |VERIFIED UNUSED - not wired to anything | 
| useProfileData | src/fixes/profile-flash-fix.ts |
| useProfileViewPayment | src/hooks/useProfileViewPayment.ts |VERIFIED UNUSED - not part of subscriptions |
| useProtectionStatus | src/hooks/useInsurance.ts |
| usePushNotifications | src/contexts/PWAContext.tsx |VERIFIED UNUSED - not used anywhere |
| usePWACache | src/contexts/PWAContext.tsx |
| useQuickBroadcastGifts | src/hooks/useQuickBroadcastGifts.ts |
| useRealtimeStability | src/hooks/useRealtimeStability.ts |
| useRealtimeStreams | src/pages/admin/hooks/useRealtimeStreams.ts |
| useRealtimeUsers | src/pages/admin/hooks/useRealtimeUsers.ts |
| useRefreshPrevention | src/lib/hooks/usePreventRefresh.ts |
| useReplayBalance | src/hooks/useStorageUsage.ts |UNUSED - defined but not referenced (useStorageUsage IS used)
| useRequestScheduler | src/lib/requestScheduler.ts |VERIFIED UNUSED - dead code, safe to delete | 
| useRTCAdminMonitor | src/hooks/useRTCAdminMonitor.ts |VERIFIED UNUSED - component is separate, safe to delete |
| useSafeAreaHeight | src/hooks/useMobileLayout.ts |
| useSavedAddresses | src/components/AddressManager.tsx |
| useSeatLiveKit | DELETED - file removed |
| useSeatRequests | src/hooks/useSeatRequests.ts |
| useSeatRoster | DELETED - file removed |
| useSellerProducts | src/hooks/useLiveCommerceOrders.ts |
| useSettingsError | src/lib/appSettingsStore.ts |
| useSettingsLoading | src/lib/appSettingsStore.ts |
| useSetupLeaderTax | src/hooks/useFamilyAchievementSystem.ts |
| useShowFounderBadge | src/hooks/useFounderProgram.ts |VERIFIED UNUSED - but file is used by other hooks, keep file |
| useSlaViolations | src/hooks/useSlaStatus.ts |KEEP SHOULD BE WIRED 
| useSmokeathon | src/lib/hooks/useSmokeathon.ts |DELETE
| useSmokeEvent | src/lib/hooks/useSmokeEvent.ts |
| useStableCallback | src/lib/performance.ts |
| useStateBattle | src/hooks/useStateBattle.ts |
| useStatePersistence | src/lib/hooks/usePreventRefresh.ts |
| useStockMarket | src/lib/hooks/useStockMarket.ts |
| useStream | src/hooks/useQueries.ts |
| useStreamEndListener | src/hooks/useStreamEndListener.ts |
| useStreamEngagement | src/lib/engagement/useStreamEngagement.ts |
| useStreamLikes | src/hooks/useStreamLikes.ts |
| useStreamMomentum | src/lib/hooks/useStreamMomentum.ts |
| useStreamStats | src/hooks/useStreamStats.ts |
| useSubscriptionSlaStatus | src/hooks/useSlaStatus.ts |
| useSupabaseQuery | src/pages/admin/hooks/useSupabaseQuery.ts |
| useSWStatus | src/contexts/PWAContext.tsx |
| useTCNNAdmin | src/hooks/useTCNNAdmin.ts |
| useThrottledCallback | src/lib/performance.ts |
| useTMSendMessage | src/hooks/useTrollMatch.ts |
| useTopFamilies | src/hooks/useTopFamilies.ts |
| useTrendingPosts | src/hooks/useTrendingPosts.ts |
| useTrollBattle | src/hooks/useTrollBattle.ts |
| useTrollContext | src/troll/TrollProvider.tsx |
| useTrollminSystem | src/hooks/useTrollminSystem.ts |
| useTrollopoly | src/hooks/useTrollopoly.ts | DELETE
| useUpcomingEvents | src/hooks/useUpcomingEvents.ts |
| useUpdateAddress | src/components/AddressManager.tsx |
| useUserOnlineStatus | src/hooks/useUserPresence.ts |
| useUserPresence | src/hooks/useUserPresence.ts |
| useUserProfile | src/hooks/useQueries.ts |
| useVandalism | src/lib/hooks/useVandalism.ts |
| useVehicleAdmin | src/lib/hooks/useVehicleAssets.ts |
| useVisibilityAwareInterval | src/lib/hooks/useVisibilityOptimized.ts |
| useVisibilityMemo | src/lib/hooks/useLazyAPI.ts |
| useVisibilityOptimized | src/lib/hooks/useVisibilityOptimized.ts |
| useVisibilityPolling | src/hooks/useVisibilityPolling.ts |
| useWallPosts | src/hooks/useWallPosts.ts |
| useWeeklyTasks | src/lib/weeklyTasks.ts |
| useWishlistProgress | src/hooks/useBroadcasterWishlist.ts |
| useXPSync | src/lib/hooks/useXPSync.ts |

