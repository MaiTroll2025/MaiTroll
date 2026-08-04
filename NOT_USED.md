# Not Used

This file is an inventory of frontend files that appear disconnected or weakly referenced from the current app graph. Nothing has been moved or deleted. Treat this as a review queue, not proof that a file is safe to remove.

Method used: static literal-reference scan across `src` for TS/JS/JSX/TSX files. This can miss dynamic imports, route indirection, barrel exports, CSS-only references, and runtime names.

## High-Confidence Review Candidates

These had no obvious import/path reference in the scan:

- `src/components/admin/DailyRewardsAdminPanel.tsx`
- `src/components/admin/LocationIntelligencePanel.tsx`
- `src/components/admin/RepossessionPanel.tsx`
- `src/components/AdminForWeekModal.tsx`
- `src/components/AdminNotificationVoiceIntegration.tsx`
- `src/components/AdminOnly.tsx`
- `src/components/agora/VideoTile.tsx`
- `src/components/AppealMediaUpload.tsx`
- `src/components/auth/AuthModal.tsx`
- `src/components/auth/RequireSecretary.tsx`
- `src/components/AuthorityPanel.tsx`
- `src/components/AuthorityPresenceBadge.tsx`
- `src/components/avatar/AvatarCreator.tsx`
- `src/components/BanPage.tsx`
- `src/components/broadcast/ActiveUserStrip.tsx`
- `src/components/broadcast/AllUsersList.tsx`
- `src/components/broadcast/BattleControls.tsx`
- `src/components/broadcast/BattleControlsList.tsx`
- `src/components/broadcast/BattleGridOverlay.tsx`
- `src/components/broadcast/BattleStartModal.tsx`
- `src/components/broadcast/BattleThemeBackground.tsx`
- `src/components/broadcast/BattleThreeAnimations.tsx`
- `src/components/broadcast/BroadcastEffectsLayer.tsx`
- `src/components/broadcast/BroadcastGridOverlay.tsx`
- `src/components/broadcast/ChallengeManager.tsx`
- `src/components/broadcast/ChallengeRequestModal.tsx`
- `src/components/broadcast/ChatInputBox.tsx`
- `src/components/broadcast/EnhancedGiftAnimation.tsx`
- `src/components/broadcast/FloatingChatOverlay.tsx`
- `src/components/broadcast/Gift3DAnimations.tsx`
- `src/components/broadcast/GiftComboDisplay.tsx`
- `src/components/broadcast/GiftLeaderboard.tsx`
- `src/components/broadcast/GiftLiveAnimation.tsx`
- `src/components/broadcast/GiftSceneAnimations.tsx`
- `src/components/broadcast/GiftTicker.tsx`
- `src/components/broadcast/GiftVideoPlayer.tsx`
- `src/components/broadcast/MinorSafetyBadge.tsx`
- `src/components/broadcast/MinorSafetyConfirmationModal.tsx`
- `src/components/broadcast/MobileBroadcastLayout.tsx`
- `src/components/broadcast/RiveGiftPlayer.tsx`
- `src/components/broadcast/TrollBattleArena.tsx`
- `src/components/broadcast/TrollBattleRoom.tsx`
- `src/components/broadcast/Mai TrollLoading.tsx`
- `src/components/broadcast/TrollmersBattleControls.tsx`
- `src/components/CarUpgradesModal.tsx`
- `src/components/ClickableUsernameWithReport.tsx`
- `src/components/CourtAIAssistant.tsx`
- `src/components/CourtAIController.tsx`
- `src/components/CourtDocketDashboard.tsx`
- `src/components/CourtDocketView.tsx`
- `src/components/CourtGeminiModal.tsx`
- `src/components/CourtRulingArchive.tsx`
- `src/components/CreatorSafetyPanel.tsx`
- `src/components/DistrictNavigation.tsx`
- `src/components/easter/EasterEggGlobalOverlay.tsx`
- `src/components/easter/EasterEggOverlay.tsx`
- `src/components/easter/EasterHuntBanner.tsx`
- `src/components/EscalateReportModal.tsx`
- `src/components/EventCountdown.tsx`
- `src/components/examples/EventSystemExamples.tsx`
- `src/components/ExpandedStatsPanel.tsx`
- `src/components/family/FamilyHub.tsx`
- `src/components/GeminiChatButton.tsx`
- `src/components/GiftActionPanel.tsx`
- `src/components/GiftersModal.tsx`
- `src/components/GlobalEventsBanner.tsx`
- `src/components/GlobalPodNotification.tsx`
- `src/components/government/LeadHQTab.tsx`
- `src/components/government/OfficerLoungeTab.tsx`
- `src/components/government/OfficerModerationTab.tsx`
- `src/components/government/SecretaryTab.tsx`
- `src/components/header/TestNotificationBanner.tsx`
- `src/components/home/FloatingUserBackground.tsx`
- `src/components/home/HouseFeesModal.tsx`
- `src/components/home/TopRentPayersWidget.tsx`
- `src/components/home/TrollPodsWidget.tsx`
- `src/components/HomePageStats.tsx`
- `src/components/IdVerifyClient.tsx`
- `src/components/KickPage.tsx`
- `src/components/KickReentryModal.tsx`
- `src/components/KickUserButton.tsx`
- `src/components/LandingHero.tsx`
- `src/components/live/BadgeEnhancement.tsx`
- `src/components/live/BroadcastAudioControls.tsx`
- `src/components/live/MissionTracker.tsx`
- `src/components/live/RecognitionPanel.tsx`
- `src/components/live/StreamPolls.tsx`
- `src/components/LiveAvatar.tsx`
- `src/components/mai/MAIAuthorityPanel.tsx`
- `src/components/MaiClassParticipantTile.tsx`
- `src/components/marketing/ReadOnlyGuard.tsx`
- `src/components/media/AudioPlayer.tsx`
- `src/components/mobile/MobileHUD.tsx`
- `src/components/ModerationPanel.tsx`
- `src/components/MuxViewer.tsx`
- `src/components/NewUserApplicationModal.tsx`

## Homepage Preview Candidates

These preview layouts are not currently proven reachable from the production route graph. They should stay until the homepage design decision is final.

- `src/components/home/previews/AmbientAuroraLayout.tsx`
- `src/components/home/previews/CinematicMarqueeLayout.tsx`
- `src/components/home/previews/DarkCrystallineLayout.tsx`
- `src/components/home/previews/DashboardGridLayout.tsx`
- `src/components/home/previews/GlassBentoLayout.tsx`
- `src/components/home/previews/HeroImmersiveLayout.tsx`
- `src/components/home/previews/LayoutSelector.tsx`
- `src/components/home/previews/LuxuryCarouselLayout.tsx`
- `src/components/home/previews/NeonNoirLayout.tsx`
- `src/components/home/previews/ParallaxDepthLayout.tsx`
- `src/components/home/previews/SpreadMagazineLayout.tsx`
- `src/components/home/previews/SwissMinimalLayout.tsx`

## Do Not Move Without Manual Route Review

These appeared weakly referenced in the static scan but are likely route, shell, modal, or dynamic-import participants. Do not move them until route coverage is verified in browser:

- `src/App.tsx`
- `src/main.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/Header.tsx`
- `src/components/Sidebar.tsx`
- `src/components/BottomNavigation.tsx`
- `src/pages/Home.tsx`
- `src/pages/PublicLandingPage.tsx`
- `src/pages/Auth.tsx`
- `src/pages/AuthCallback.tsx`
- `src/pages/TCPS.tsx`
- `src/pages/broadcast/BroadcastPage.tsx`
- `src/pages/broadcast/BroadcastRouter.tsx`
- `src/pages/PayoutRequest.tsx`
- `src/pages/Wallet.tsx`
- `src/pages/Stats.tsx`
- `src/troll/TrollProvider.tsx`

