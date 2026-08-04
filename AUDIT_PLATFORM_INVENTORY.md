# 🏙️ Mai Troll — PLATFORM INVENTORY AUDIT

**Audit Date:** 2026-06-13  
**Scope:** Complete route, page, component, and feature inventory  
**Method:** Full scan of `src/App.tsx`, `src/pages/`, `src/components/`, `src/hooks/`, `src/lib/`, `src/services/`, `src/stores/`, `src/contexts/`, `src/types/`

---

## 📊 TOP-LEVEL COUNTS

| Metric | Count |
|---|---|
| **Total Unique Routes** | **~260** (including nested & parameterized) |
| **Public Routes** | **~82** |
| **Protected Routes (RequireAuth)** | **~178** |
| **Admin-Only Routes** | **~81** |
| **Total Page Files** | **~230** |
| **Total Component Files** | **~564** |
| **Total Hook Files** | **~150** |
| **Total Lib/Utility Files** | **~200** |
| **Total Service Files** | **12** |
| **Total Store Files** | **10** |
| **Total Context Files** | **13** |
| **Total Type Definition Files** | **33** |
| **Total Edge Function Directories** | **~120** |
| **Total SQL Migrations** | **915** |
| **Total SQL Files (root)** | **60+** |

---

## 🗺️ COMPLETE ROUTE LISTING

### 🔴 PUBLIC ROUTES (No Auth Required) — 82 Routes

| # | Route | Component | File | Purpose |
|---|---|---|---|---|
| 1 | `/` | `AuthenticatedHome` | `src/pages/Home.tsx` | Homepage |
| 2 | `/intro` | `→ /` | Redirect | Legacy |
| 3 | `/landing` | `→ /` | Redirect | Legacy |
| 4 | `/auth` | `Auth` | `src/pages/Auth.tsx` | Login/Register |
| 5 | `/auth/callback` | `AuthCallback` | `src/pages/AuthCallback.tsx` | OAuth callback |
| 6 | `/exit` | `ExitPage` | `src/pages/ExitPage.tsx` | Stream exit |
| 7 | `/access-denied` | `AccessDenied` | `src/pages/AccessDenied.tsx` | Access denied |
| 8 | `/reset-password` | `PasswordReset` | `src/pages/PasswordReset.tsx` | Password reset |
| 9 | `/tax-onboarding` | `TaxOnboarding` | `src/pages/TaxOnboarding.tsx` | Tax forms |
| 10 | `/verification` | `VerificationPage` | `src/pages/VerificationPage.tsx` | ID verification |
| 11 | `/verification/complete` | `VerificationComplete` | `src/pages/VerificationComplete.tsx` | Verified |
| 12 | `/founding-officer-trial` | `FoundingOfficerTrial` | `src/pages/FoundingOfficerTrial.tsx` | Officer trial |
| 13 | `/account/earnings` | `EarningsDashboard` | `src/pages/EarningsDashboard.tsx` | Public earnings |
| 14 | `/payout-status` | `PayoutStatus` | `src/pages/PayoutStatus.tsx` | Payout check |
| 15 | `/explore` | `ExploreFeed` | `src/pages/ExploreFeed.tsx` | Explore feed |
| 16 | `/live-swipe` | `StreamSwipePage` | `src/pages/StreamSwipePage.tsx` | Stream swiper |
| 17 | `/embed/:id` | `EmbedPage` | `src/pages/broadcast/EmbedPage.tsx` | Embed player |
| 18 | `/safety` | `Safety` | `src/pages/Safety.tsx` | Safety page |
| 19 | `/apply` | `ApplicationPage` | `src/pages/ApplicationPage.tsx` | Application |
| 20 | `/careers` | `Career` | `src/pages/Career.tsx` | Careers |
| 21 | `/auctions` | `AuctionsPage` | `src/pages/AuctionsPage.tsx` | Browse auctions |
| 22 | `/auctions/:showId` | `LiveAuctionRoom` | `src/pages/auction/LiveAuctionRoom.tsx` | Watch auction |
| 23 | `/hytrogaming` | `HytroGaming` | `src/pages/gaming/HytroGaming.tsx` | Gaming portal |
| 24 | `/hytrogaming/apply` | `HytroGamingApply` | `src/pages/gaming/HytroGamingApply.tsx` | Gaming apply |
| 25 | `/hytrogaming/contract/:id` | `HytroGamingContract` | `src/pages/gaming/HytroGamingContract.tsx` | Gaming contract |
| 26 | `/hytro/:id` | `HytroGamingViewer` | `src/pages/gaming/HytroGamingViewer.tsx` | Gaming viewer |
| 27 | `/agencies` | `AgenciesPage` | `src/pages/agencies/` | Browse agencies |
| 28 | `/agencies/create` | `CreateAgencyPage` | `src/pages/agencies/CreateAgencyPage.tsx` | Create agency |
| 29 | `/agency/:id` | `AgencyProfilePage` | `src/pages/agency/[agencyId].tsx` | Agency profile |
| 30 | `/agency-apply/:id` | `AgencyApplyPage` | `src/pages/agency-apply/[agencyId].tsx` | Apply to agency |
| 31 | `/shareathon` | `ShareAThonLanding` | `src/pages/shareathon/ShareAThonLanding.tsx` | Share-A-Thon |
| 32 | `/shareathon/leaderboard` | `ShareAThonLeaderboard` | `src/pages/shareathon/ShareAThonLeaderboard.tsx` | SA LB |
| 33 | `/rfc` | `AdminRFC` | `src/components/AdminRFC.tsx` | RFC proposals |
| 34-41 | `/legal/*` | Various | `src/pages/legal/` | Legal pages (7 routes) |
| 42-50 | `/about`, `/broadcasting`, `/categories`, `/creators`, `/go-live`, `/seo-government`, `/categories/:slug`, `/top-creators`, `/trending` | SEO Pages | `src/pages/seo/` | SEO pages (9 routes) |
| 51-80 | `/academy/*` | Various | `src/pages/academy/` | Academy (30 routes) |
| 81 | `/dev/theme-preview` | `ThemePreviewPage` | `src/pages/dev/ThemePreviewPage.tsx` | Dev tool |
| 82 | `/dev/homepage-preview` | `HomepageBackgroundShowcase` | `src/pages/dev/HomepageBackgroundShowcase.tsx` | Dev tool |

### 🔐 PROTECTED ROUTES (RequireAuth) — ~178 Routes

#### Core User (20 routes)
| Route | Component |
|---|---|
| `/notifications` | `Notifications` |
| `/following` | `Following` |
| `/following/:userId` | `Following` |
| `/trollifications` | `Trollifications` |
| `/trollifieds` | `Trollifieds` |
| `/marketplace` | `Marketplace` |
| `/marketplace/orders` | `Marketplace` |
| `/marketplace/sales` | `Marketplace` |
| `/pool` | `PublicPool` |
| `/search` | `SearchPage` |
| `/blocked-users` | `BlockedUsers` |
| `/support` | `Support` |
| `/profile/setup` | `ProfileSetup` |
| `/profile/settings` | `ProfileSettings` |
| `/profile/delete` | `DeleteAccount` |
| `/profile/id/:userId` | `Profile` |
| `/profile/:username` | `Profile` |
| `/leaderboard` | `Leaderboard` |
| `/credit-scores` | `CreditScorePage` |
| `/crowns/redeem` | `CrownRedemption` |

#### UTroMail (4 routes)
| Route | Component |
|---|---|
| `/utromail` | `UtromailPage` |
| `/utromail/thread/:id` | `UtromailPage` |
| `/utromail/compose` | `UtromailPage` |
| `/utromail/settings` | `UtromailPage` |

#### Tromail (1 route)
| Route | Component |
|---|---|
| `/tromail` | `TromailPage` |

#### Broadcasting (17 routes)
| Route | Component |
|---|---|
| `/broadcast/setup` | `SetupPage` |
| `/broadcast/setup/gaming` | `GamingSetupPage` |
| `/broadcast/setup/gaming/analytics` | `GamingAnalytics` |
| `/broadcast/setup/gaming/community` | `GamingCommunity` |
| `/broadcast/setup/gaming/monetization` | `GamingMonetization` |
| `/broadcast/setup/gaming/store` | `GamingStore` |
| `/broadcast/:id` | `BroadcastRouter` |
| `/watch/:id` | `BroadcastRouter` |
| `/live/:streamId` | `BroadcastRouter` |
| `/stream/:id` | `BroadcastRouter` |
| `/kick-fee/:streamId` | `KickFeePage` |
| `/broadcast/summary/:id` | `StreamSummary` |
| `/replay/:streamId` | `ReplayPage` |
| `/gaming/watch/:streamId` | `HytroGamingViewer` |
| `/onboarding/creator` | `CreatorOnboarding` |
| `/creator-switch` | `CreatorSwitchProgram` |
| `/join` | `JoinPage` |

#### TCNN News Network (6 routes)
| Route | Component | Roles |
|---|---|---|
| `/tcnn` | `TCNNMainPage` | Any auth |
| `/tcnn/article/:id` | `ArticleReader` | Any auth |
| `/tcnn/dashboard` | `TCNNInternalDashboard` | journalist, tcnn_news_caster |
| `/tcnn/setup` | `TCNNSetupPage` | tcnn_news_caster |
| `/tcnn/broadcaster` | `TCNNBroadcasterPage` | tcnn_news_caster |
| `/tcnn/viewer/:id` | `TCNNViewerPage` | Any auth |

#### Podcast (2 routes)
| Route | Component |
|---|---|
| `/podcast` | `PodcastCentral` |
| `/podcast/:id` | `PodcastRoom` |

#### Gaming (8 routes)
| Route | Component |
|---|---|
| `/troll-games` | `TrollGamesPage` |
| `/troll-games/queue` | `TrollGamesPage` |
| `/troll-games/live` | `TrollGamesPage` |
| `/troll-games/match/:id` | `TrollGamesPage` |
| `/troll-games/:type/:id` | `TrollGamesPage` |
| `/troll-games/giveaways` | `GiveawaysPage` |
| `/troll-wheel` | `TrollWheel` |
| `/match` | `MatchPage` |

#### Economy (22 routes)
| Route | Component |
|---|---|
| `/store` | `CoinStore` |
| `/coins` | `CoinStore` |
| `/coins/complete` | `CoinsComplete` |
| `/wallet` | `WalletPage` |
| `/bank` | `TrollBank` |
| `/earnings` | `EarningsDashboard` |
| `/my-earnings` | `MyEarnings` |
| `/bonuses` | `BonusesPage` |
| `/cashout` | `CashoutPage` |
| `/cashout-request` | `CashoutRequestPage` |
| `/withdraw` | `Withdraw` |
| `/transactions` | `TransactionHistory` |
| `/payouts/setup` | `PayoutSetupPage` |
| `/payouts/request` | `PayoutRequest` |
| `/payment/callback` | `PaymentCallback` |
| `/shop-partner` | `ShopPartnerPage` |
| `/sell` | `SellOnMai Troll` |
| `/seller/orders` | `SellerOrders` |
| `/my-orders` | `MyOrders` |
| `/seller/earnings` | `ShopEarnings` |
| `/pride-shop` | `PrideShop` |
| `/shop/:username` | `ShopView` |

#### Vehicles & Real Estate (6 routes)
| Route | Component |
|---|---|
| `/ktauto` | `CarDealership` |
| `/garage` | `GaragePage` |
| `/vehicle-transactions` | `VehicleTransactionsPage` |
| `/driver-test` | `DriverTest` |
| `/insurance` | `InsurancePage` |
| `/troting` | `Troting` |

#### Family (10 routes)
| Route | Component |
|---|---|
| `/family/browse` | `FamilyBrowse` |
| `/family/create` | `FamilyBrowse` |
| `/family/city` | `TrollFamilyCity` |
| `/family/profile/:id` | `FamilyProfilePage` |
| `/family/chat/:id` | `FamilyChatPage` |
| `/family/wars` | `FamilyWarsPage` |
| `/family/home` | `TrollFamilyHome` |
| `/family/wars-hub` | `FamilyWarsHub` |
| `/family/leaderboard` | `FamilyLeaderboard` |
| `/family/shop` | `FamilyShop` |

#### Government (6 routes)
| Route | Component | Roles |
|---|---|---|
| `/government` | `Government` | Any auth |
| `/government/streams` | `GovernmentStreams` | Any auth |
| `/president` | `PresidentPage` | Any auth |
| `/president/dashboard` | `PresidentDashboard` | PRESIDENT, ADMIN |
| `/president/secretary` | `SecretaryDashboard` | SECRETARY, ADMIN |
| `/president/treasury` | `TreasuryDashboard` | PRESIDENT, ADMIN |

#### Court & Justice (6 routes)
| Route | Component |
|---|---|
| `/troll-court` | `TrollCourt` |
| `/troll-court/session` | `TrollCourtSession` |
| `/troll-court/watch/:id` | `CourtViewerPage` |
| `/court/:courtId` | `CourtRoom` |
| `/jail` | `JailPage` |
| `/inmates` | `InmatesPage` |
| `/jail/appeal` | `JailAppealPage` |

#### Church (3 routes)
| Route | Component | Roles |
|---|---|---|
| `/church` | `ChurchPage` | Any auth |
| `/church/live/:id` | `ChurchLivePage` | Any auth |
| `/church/pastor` | `PastorDashboard` | pastor |

#### Meetings & Calls (3 routes)
| Route | Component |
|---|---|
| `/meeting/:id` | `TeamMeetingRoom` |
| `/team-meeting/:id` | `TeamMeetingRoom` |
| `/call/:roomId/:type/:userId` | `Call` |

#### Auction Studio (13 routes)
| Route | Component | Roles |
|---|---|---|
| `/auctions/studio` | `AuctionStudio` | auctioneer |
| `/auctions/studio/:id/lots` | `AuctionStudioLots` | auctioneer |
| `/auctions/studio/:id/live` | `AuctioneerDashboard` | auctioneer |
| `/auctions/my-shows` | `MyAuctionShows` | auctioneer |
| `/auctions/bidders` | `AuctionBidders` | auctioneer |
| `/auctions/sales` | `AuctionSales` | auctioneer |
| `/auctions/analytics` | `AuctionAnalytics` | auctioneer |
| `/auctions/settings` | `AuctionSettings` | auctioneer |
| `/auctions/inventory` | `AuctionInventory` | auctioneer |
| `/auctions/orders` | `AuctionOrderManagement` | auctioneer |
| `/auctions/packing` | `PackingStation` | auctioneer |
| `/auctions/devices` | `DeviceManagement` | auctioneer |
| `/auctioneer/scanner` | `AuctioneerScanner` | auctioneer |

#### Role-Specific (8 routes)
| Route | Component | Roles |
|---|---|---|
| `/lead-officer` | `LeadOfficerDashboard` | Lead Officer |
| `/officer/lounge` | `TrollOfficerLounge` | TROLL_OFFICER, ADMIN |
| `/officer/moderation` | `OfficerModeration` | TROLL_OFFICER, ADMIN |
| `/officer/report/:id` | `ReportDetailsPage` | TROLL_OFFICER, ADMIN |
| `/officer/scheduling` | `OfficerScheduling` | TROLL_OFFICER, ADMIN |
| `/officer/dashboard` | `OfficerDashboard` | TROLL_OFFICER, ADMIN |
| `/attorney` | `AttorneyDashboard` | attorney |
| `/prosecutor` | `ProsecutorDashboard` | prosecutor |
| `/notary` | `NotaryDashboard` | notary, admin, attorney |
| `/ceo-assistant-dashboard` | `CEOAssistantDashboard` | ceo_assistant |
| `/noah-assistant-dashboard` | `NoahAssistantDashboard` | noah_assistant |
| `/secretary` | `SecretaryConsole` | ADMIN, SECRETARY |

### 👑 ADMIN ROUTES — 81 Routes

All require `ADMIN` role unless otherwise noted:

| # | Route | Component |
|---|---|---|
| 1 | `/admin` | `AdminDashboard` |
| 2 | `/admin/creator-approvals` | `CreatorSwitchApprovals` |
| 3 | `/admin/officer-operations` | `OfficerOperations` |
| 4 | `/admin-mobile` | `MobileAdminDashboard` |
| 5 | `/admin/officer-reports` | `AdminOfficerReports` |
| 6 | `/admin/earnings` | `AdminEarningsDashboard` |
| 7 | `/admin/payments` | `PaymentsDashboard` |
| 8 | `/admin/economy` | `EconomyDashboard` |
| 9 | `/admin/tax-reviews` | `TaxReviewPanel` |
| 10 | `/admin/referrals` | `ReferralBonusPanel` |
| 11 | `/admin/payouts` | `AdminPayoutDashboard` |
| 12 | `/admin/officers-live` | `AdminLiveOfficersTracker` |
| 13 | `/admin/verified-users` | `AdminVerifiedUsers` |
| 14 | `/admin/verification` | `AdminVerificationReview` |
| 15 | `/admin/applications` | `Applications` |
| 16 | `/admin/docs/policies` | `AdminPoliciesDocs` |
| 17 | `/admin/marketplace` | `AdminMarketplace` |
| 18 | `/admin/trollmers-tournament` | `TrollmersTournament` |
| 19 | `/admin/jail-management` | `AdminJailManagement` |
| 20 | `/admin/user-forms` | `UserFormsTab` |
| 21 | `/admin/executive-secretaries` | `ExecutiveSecretaries` |
| 22 | `/admin/executive-intake` | `ExecutiveIntake` |
| 23 | `/admin/executive-reports` | `ExecutiveReports` |
| 24 | `/admin/troll-town-deeds` | `AdminTrollTownDeeds` |
| 25 | `/admin/cashout-manager` | `CashoutManager` |
| 26 | `/admin/cashout/:id` | `AdminCashoutDetailPage` |
| 27 | `/admin/officer-management` | `OfficerManager` |
| 28 | `/admin/role-management` | `RoleManagement` |
| 29 | `/admin/media-library` | `MediaLibrary` |
| 30 | `/admin/chat-moderation` | `ChatModeration` |
| 31 | `/admin/announcements` | `Announcements` |
| 32 | `/admin/send-notifications` | `SendNotifications` |
| 33 | `/admin/export-data` | `ExportData` |
| 34 | `/admin/user-search` | `UserSearch` |
| 35 | `/admin/reports-queue` | `ReportsQueue` |
| 36 | `/admin/stream-monitor` | `StreamMonitorPage` |
| 37 | `/admin/night-watch` | `NightWatchDashboard` |
| 38 | `/admin/voting` | `TrotingAdminPage` |
| 39 | `/admin/payment-logs` | `PaymentLogs` |
| 40 | `/admin/launch-trial` | `AdminLaunchTrial` |
| 41 | `/admin/store-pricing` | `StorePriceEditor` |
| 42 | `/admin/errors` | `AdminErrors` |
| 43 | `/admin/finance` | `AdminFinanceDashboard` |
| 44 | `/admin/manual-orders` | `AdminManualOrders` |
| 45 | `/admin/buckets` | `BucketsDashboard` |
| 46 | `/admin/grant-coins` | `GrantCoins` |
| 47 | `/admin/create-schedule` | `CreateSchedule` |
| 48 | `/admin/officer-shifts` | `OfficerShifts` |
| 49 | `/admin/referral-bonuses` | `ReferralBonuses` |
| 50 | `/admin/control-panel` | `ControlPanel` |
| 51 | `/admin/page-visibility` | `AdminPageVisibility` |
| 52 | `/admin/test-diagnostics` | `TestDiagnosticsPage` |
| 53 | `/admin/reset-maintenance` | `ResetMaintenance` |
| 54 | `/admin/hr` | `AdminHR` |
| 55 | `/admin/appeals` | `AppealManagement` |
| 56 | `/admin/meetings` | `AdminMeetingsDashboard` |
| 57 | `/admin/shareathon/dashboard` | `ShareAThonAdminDashboard` |
| 58 | `/admin/shareathon/verification` | `ShareAThonVerification` |
| 59 | `/academy/admin` | `AcademyAdminPage` |
| 60-81 | `/admin/system/*`, `/admin/*` | Various system management routes from `adminRoutes.tsx` |

---

## 📁 COMPONENT INVENTORY BY DIRECTORY

| Directory | Count | Purpose |
|---|---|---|
| `src/components/admin/` | ~15 | Admin panels |
| `src/components/auction/` | 8 | Auction UI |
| `src/components/auth/` | 3 | Auth guards |
| `src/components/broadcast/` | 25 | Broadcasting |
| `src/components/church/` | 3 | Church |
| `src/components/city/` | 5 | City/Map |
| `src/components/family/` | 8 | Family system |
| `src/components/gifts/` | 10 | Gift system |
| `src/components/government/` | 5 | Government |
| `src/components/home/` | 10 | Homepage |
| `src/components/jail/` | 3 | Jail |
| `src/components/layout/` | 5 | Layout |
| `src/components/live/` | 5 | Live streaming |
| `src/components/mai/` | 8 | Mai Talent |
| `src/components/officer/` | 8 | Officer |
| `src/components/podcast/` | 5 | Podcast |
| `src/components/profile/` | 10 | Profile |
| `src/components/tcnn/` | 5 | TCNN |
| `src/components/trollmatch/` | 3 | TrollMatch |
| `src/components/trollWall/` | 3 | Troll Wall |
| `src/components/ui/` | 10 | Shared UI |
| `src/components/animations/` | 5 | Animations |
| Other directories | ~380 | Misc components |
| **TOTAL** | **~564** | |

---

## 📊 FINAL TOTALS

| Category | Count |
|---|---|
| **Total Routes** | **~260** |
| **Public Routes** | **~82** |
| **Protected Routes** | **~178** |
| **Admin Routes** | **~81** |
| **Page Files** | **~230** |
| **Component Files** | **~564** |
| **Hook Files** | **~150** |
| **Lib/Utility Files** | **~200** |
| **Service Files** | **12** |
| **Store Files** | **10** |
| **Context Files** | **13** |
| **Type Definition Files** | **33** |
| **Edge Functions** | **~120** |
| **SQL Migrations** | **915** |

---

*Generated by automated scan of the entire Mai Troll codebase.*
