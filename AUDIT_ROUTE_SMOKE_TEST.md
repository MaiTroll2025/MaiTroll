# Route Smoke Test Plan

> Generated: 2026-05-31. Covers all ~298 routes defined in App.tsx + adminRoutes.tsx.
>
> **IMPORTANT**: These are target routes and expected behaviors based on static code analysis. Actual smoke testing requires running the app locally. Known issues are annotated from code inspection, not runtime testing.

---

## Route Inventory Summary

| Category | Count |
|----------|-------|
| Total unique route paths | ~298 |
| Public routes (no auth) | 44 |
| Protected routes (RequireAuth) | ~254 |
| Admin-only routes | ~80+ |
| Role-restricted (troll_officer, pastor, attorney, etc.) | ~25 |

---

## PUBLIC ROUTES

| Route | Page | Expected Load | Auth | Known Issues |
|-------|------|---------------|------|--------------|
| `/` | Home (AuthenticatedHome) | Redirects to auth if not logged in | Required | - |
| `/home` | Home (AuthenticatedHome) | Main dashboard | Required | - |
| `/auth` | Auth | Login/signup | Public | Queue system if waitlist active |
| `/auth/callback` | AuthCallback | OAuth callback | Public | - |
| `/exit` | ExitPage | Public exit page | Public | - |
| `/explore` | ExploreFeed | Live stream feed | Public | Unbounded stream select |
| `/live-swipe` | StreamSwipePage | Swipeable stream cards | Public | - |
| `/embed/:id` | EmbedPage | Embedded player | Public | - |
| `/safety` | Safety | Safety info | Public | - |
| `/agencies` | AgenciesPage | Agency listing | Public | - |
| `/agencies/create` | CreateAgencyPage | Agency creation | Public | - |
| `/agency/:agencyIdOrSlug` | AgencyProfilePage | Agency profile | Public | - |
| `/apply` | ApplicationPage | Job application | Public | - |
| `/careers` | Career | Career info | Public | - |
| `/join` | JoinPage | Waitlist join | Public | signup_queue insert |
| `/terms-of-service` | TermsOfServiceLegal | Legal | Public | redirects to /legal/terms |
| `/privacy-policy` | PrivacyPolicyLegal | Legal | Public | redirects to /legal/privacy |
| `/reset-password` | PasswordReset | Password reset | Public | - |
| `/tax-onboarding` | TaxOnboarding | Tax forms | Anonymous | - |
| `/verification` | VerificationPage | ID verification | Anonymous | - |
| `/verification/complete` | VerificationComplete | Verification done | Anonymous | - |
| `/founding-officer-trial` | FoundingOfficerTrial | Trial period | Limited access | - |
| `/account/earnings` | EarningsDashboard | Earnings info | Public link | - |
| `/payout-status` | PayoutStatus | Payout tracking | Public link | - |
| `/legal` | PolicyCenter | Policy hub | Public | - |
| `/legal/terms` | TermsOfServiceLegal | Legal page | Public | - |
| `/legal/privacy` | PrivacyPolicyLegal | Legal page | Public | - |
| `/legal/refunds` | RefundPolicyLegal | Legal page | Public | - |
| `/legal/payouts` | PayoutPolicyLegal | Legal page | Public | - |
| `/legal/safety` | SafetyGuidelinesLegal | Legal page | Public | - |
| `/legal/creator-earnings` | CreatorEarnings | Legal page | Public | - |
| `/legal/gambling-disclosure` | GamblingDisclosure | Legal page | Public | - |
| `/onboarding/creator` | CreatorOnboarding | Creator flow | Public | - |
| `/president` | PresidentPage | Election info | Public/Protected | - |
| `/dev/theme-preview` | ThemePreviewPage | Theme dev | Dev only | - |
| `/dev/homepage-preview` | HomepageBackgroundShowcase | Dev preview | Dev only | - |
| `/agency-apply/:agencyIdOrSlug` | AgencyApplyPage | Agency application | Public | - |
| `*` | Navigate to `/` | Catch-all redirect | - | - |

---

## PROTECTED ROUTES (RequireAuth)

| Route | Page | Role Required | Key DB Tables | Known Issues |
|-------|------|---------------|---------------|--------------|
| `/wallet` | WalletPage | Authenticated | user_profiles | - |
| `/store`, `/coins` | CoinStore | Authenticated | - | Calls create-paypal-order |
| `/coins/complete` | CoinsComplete | Authenticated | - | - |
| `/cashout` | CashoutPage | Authenticated | - | MAI Pay integration |
| `/cashout-request` | CashoutRequestPage | Authenticated | payout_requests | - |
| `/payouts/setup` | PayoutSetupPage | Authenticated | - | - |
| `/payouts/request` | PayoutRequest | Authenticated | payout_requests | - |
| `/transactions` | TransactionHistory | Authenticated | coin_transactions | - |
| `/profile/settings` | ProfileSettings | Authenticated | user_profiles | - |
| `/profile/delete` | DeleteAccount | Authenticated | - | Calls delete-account |
| `/profile/setup` | ProfileSetup | Authenticated | user_profiles | - |
| `/profile/:username`, `/profile/id/:userId` | Profile | Authenticated | user_profiles, user_stats | 9 parallel SELECTs on mount (N+1) |
| `/profile/:slug` | Profile (alt) | - | - | - |
| `/inventory` | UserInventory | Authenticated | user_inventory, marketplace_items | - |
| `/stats` | StatsPage | Authenticated | user_stats | - |
| `/bank` | TrollBank | Authenticated | - | bank_deposit/withdraw RPCs |
| `/leaderboard` | Leaderboard | Authenticated | user_stats | - |
| `/credit-scores` | CreditScorePage | Authenticated | user_credit | - |
| `/support` | Support | Authenticated | support_tickets | - |
| `/troll-games` | TrollGamesPage | Authenticated | - | - |
| `/troll-wheel` | TrollWheel | Authenticated | - | spin_troll_wheel RPC |
| `/troting` | Troting | Authenticated | - | - |
| `/troll-court` | TrollCourt | Authenticated | court_cases, court_sessions | - |
| `/troll-court/session` | TrollCourtSession | Authenticated | troll_court_* | Multiple unbounded selects |
| `/court/:courtId` | CourtRoom | Authenticated | court_cases, court_dockets | - |
| `/troll-court/watch/:sessionId` | CourtViewerPage | Authenticated | court_sessions | - |
| `/jail` | JailPage | Authenticated | jail | - |
| `/inmates` | InmatesPage | Authenticated | jail, user_profiles | - |
| `/jail/appeal` | JailAppealPage | Authenticated | - | - |
| `/wall` | Mai TrollWall | Authenticated | troll_wall_posts | - |
| `/wall/:postId` | WallPostPage | Authenticated | troll_wall_posts | - |
| `/messages`, `/tcps` | TCPS | Authenticated | conversations, conversation_messages | - |
| `/following` | Following | Authenticated | user_follows | - |
| `/notifications` | Notifications | Authenticated | notifications | - |
| `/trollifications` | Trollifications | Authenticated | - | - |
| `/trollifieds` | Trollifieds | Authenticated | marketplace_items | - |
| `/marketplace` | Marketplace | Authenticated | marketplace_items | - |
| `/marketplace/orders` | Marketplace | Authenticated | marketplace_purchases | - |
| `/marketplace/sales` | Marketplace | Authenticated | marketplace_purchases | - |
| `/shop/:username` | ShopView | Authenticated | shop_items | - |
| `/sell` | SellOnMai Troll | Authenticated | marketplace_items, shop_items | - |
| `/seller/orders` | SellerOrders | Authenticated | marketplace_purchases | - |
| `/my-orders` | MyOrders | Authenticated | marketplace_purchases | - |
| `/seller/earnings` | ShopEarnings | Authenticated | shop_transactions | - |
| `/shop-partner` | ShopPartnerPage | Authenticated | - | - |
| `/family/browse` | FamilyBrowse | Authenticated | troll_families, family_members | - |
| `/family/create` | FamilyBrowse (create mode) | Authenticated | troll_families, family_members | - |
| `/family/city` | TrollFamilyCity | Authenticated | troll_families | - |
| `/family/profile/:id` | FamilyProfilePage | Authenticated | troll_families, family_members | - |
| `/family/chat/:familyId` | FamilyChatPage | Authenticated | conversation_messages | - |
| `/family/wars` | FamilyWarsPage | Authenticated | family_wars | - |
| `/family/wars-hub` | FamilyWarsHub | Authenticated | family_wars | - |
| `/family/home` | TrollFamilyHome | Authenticated | family_members, notifications | - |
| `/family/leaderboard` | FamilyLeaderboard | Authenticated | family_members | - |
| `/family/shop` | FamilyShop | Authenticated | - | - |
| `/church` | ChurchPage | Authenticated | church_live_sessions | - |
| `/church/live/:sessionId` | ChurchLivePage | Authenticated | church_live_sessions | - |
| `/auctions` | AuctionsPage | Authenticated | auction_shows | - |
| `/podcast` | PodcastCentral | Authenticated | pod_rooms | - |
| `/podcast/:id` | PodcastRoom | Authenticated | pod_rooms | - |
| `/tromail` | TromailPage | Authenticated | - | - |
| `/call/:roomId/:type/:userId` | Call | Authenticated | - | LiveKit/Agora |
| `/living` | LivingPage | Authenticated | properties | - |
| `/map` | MapPage | Authenticated | - | Leaflet map |
| `/neighborhood-map` | NeighborhoodMapHub | Authenticated | neighborhoods, houses | Unbounded streams query |
| `/neighborhood-setup` | NeighborhoodOnboarding | Authenticated | neighborhoods, houses, user_licenses | - |
| `/insurance` | InsurancePage | Authenticated | user_insurances | - |
| `/driver-test` | DriverTest | Authenticated | user_licenses | - |
| `/ktauto` | CarDealership | Authenticated | vehicles, user_vehicles | buy_vehicle RPC |
| `/universe-event` | UniverseEventPage | Authenticated | user_stats | - |
| `/tcnn` | TCNNMainPage | Authenticated | - | - |
| `/tcnn/article/:id` | ArticleReader | Authenticated | - | - |
| `/blocked-users` | BlockedUsers | Authenticated | user_blocks | - |
| `/district/:districtName` | DistrictTour | Authenticated | - | - |
| `/government` | Government | Authenticated | government_laws, law_votes, bribe_logs, protests | - |
| `/president/dashboard` | PresidentDashboard | Authenticated | president_elections | - |
| `/under-construction` | UnderConstructionPage | Authenticated | properties, user_profiles | Landlord system |
| `/payment/callback` | PaymentCallback | Authenticated | - | Payment flow |
| `/mai-talent` | MaiTalent | Authenticated | mai_stage_slots, mai_show_sessions | - |
| `/mai-class` | MaiClass | Authenticated | mai_classes, mai_class_enrollments | - |
| `/orders` | BuyerOrders | Authenticated | marketplace_purchases | - |
| `/payment-settings` | PaymentSettings | Authenticated | user_payment_methods | - |
| `/bonuses` | BonusesPage | Authenticated | - | - |
| `/earnings` | EarningsDashboard | Authenticated | - | - |
| `/my-earnings` | MyEarnings | Authenticated | - | - |
| `/gift-cards` | GiftCardsPage | Authenticated | - | - |
| `/changelog` | Changelog | Authenticated | - | - |
| `/perks` | PerksStore | Authenticated | user_perks | shop_buy_perk RPC |
| `/troll-identity-lab` | TrollIdentityLab | Authenticated | - | - |
| `/troller-insurance` | TrollerInsurance | Authenticated | - | - |
| `/reels/*` | ReelSlide, ReelActions, ReelComments | Authenticated | - | - |
| `/gift-sound-player` | GiftSoundPlayer | Authenticated | - | - |
| `/active-assets` | ActiveAssetsPage | Authenticated | - | - |
| `/setting/audio` | AudioSettings | Authenticated | - | - |

---

## BROADCAST ROUTES

| Route | Page | Role Required | Known Issues |
|-------|------|---------------|--------------|
| `/broadcast/setup` | SetupPage | Authenticated | Insert global_events |
| `/broadcast/:id` | BroadcastPage | Authenticated | 4 separate RT channels |
| `/watch/:id` | ViewerPage | Authenticated | 2+ RT channels, gift system |
| `/live/:streamId` | BroadcastRouter | Authenticated | Delegates to Broadcast/Viewer |
| `/stream/:id` | BroadcastRouter | Authenticated | Same |
| `/kick-fee/:streamId` | KickFeePage | Authenticated | - |
| `/broadcast/summary/:streamId` | StreamSummary | Authenticated | - |
| `/live/command-center/:streamId` | LiveCommandCenter | Authenticated | - |
| `/live/overlay/:streamId` | LiveStreamOverlay | Authenticated | - |
| `/meeting/:meetingId` | TeamMeetingRoom | Authenticated | - |

---

## ADMIN ROUTES

| Route | Page | Role Required | Known Performance Issues |
|-------|------|---------------|--------------------------|
| `/admin` | AdminDashboard | admin | 5+ overlapping data hooks, 30s intervals |
| `/admin/system/health` | CityControlCenter | admin | - |
| `/admin/users/forms` | UserFormsTab | admin | - |
| `/admin/officer-operations` | OfficerOperations | admin | - |
| `/admin/officer-reports` | AdminOfficerReports | admin | - |
| `/admin/earnings` | AdminEarningsDashboard | admin | Unbounded earnings_view query |
| `/admin/payments` | PaymentsDashboard | admin | - |
| `/admin/economy` | EconomyDashboard | admin | Scans entire coin_transactions table |
| `/admin/payouts` | AdminPayoutDashboard | admin | - |
| `/admin/payout-batches` | PayoutBatches | admin | - |
| `/admin/cashout-manager` | CashoutManager | admin | - |
| `/admin/cashout/:id` | AdminCashoutDetailPage | admin | - |
| `/admin/coinpurchase-ledger` | CoinPackPurchasesLedger | admin | - |
| `/admin/verified-users` | AdminVerifiedUsers | admin | - |
| `/admin/verification` | AdminVerificationReview | admin | - |
| `/admin/applications` | ApplicationsPage | admin | - |
| `/admin/support-tickets` | AdminSupportTicketsPage | admin | - |
| `/admin/customer-service` | CustomerServiceDashboard | admin | - |
| `/admin/seller-management` | SellerManagement | admin | - |
| `/admin/court-dockets` | CourtDocketsManager | admin | - |
| `/admin/seasonal-goals` | SeasonalGoals | admin | - |
| `/admin/tournaments` | TournamentManager | admin | - |
| `/admin/chat-moderation` | ChatModeration | admin | - |
| `/admin/announcements` | Announcements | admin | - |
| `/admin/send-notifications` | SendNotifications | admin | send-bulk-notifications |
| `/admin/export-data` | ExportData | admin | - |
| `/admin/user-search` | UserSearch | admin | - |
| `/admin/reports-queue` | ReportsQueue | admin | - |
| `/admin/stream-monitor` | StreamMonitorPage | admin | - |
| `/admin/night-watch` | NightWatchDashboard | admin | - |
| `/admin/voting` | TrotingAdminPage | admin | - |
| `/admin/payment-logs` | PaymentLogs | admin | - |
| `/admin/launch-trial` | AdminLaunchTrial | admin | - |
| `/admin/finance` | AdminFinanceDashboard | admin | Duplicate economy_summary fetch |
| `/admin/manual-orders` | AdminManualOrders | admin | - |
| `/admin/buckets` | BucketsDashboard | admin | - |
| `/admin/grant-coins` | GrantCoins | admin | troll_bank_credit_coins |
| `/admin/create-schedule` | CreateSchedule | admin | - |
| `/admin/officer-shifts` | OfficerShifts | admin | - |
| `/admin/referral-bonuses` | ReferralBonuses | admin | - |
| `/admin/control-panel` | ControlPanel | admin | - |
| `/admin/errors` | AdminErrors | admin | - |
| `/admin/hr` | AdminHR | admin | - |
| `/admin/appeals` | AppealManagement | admin | - |
| `/admin/meetings` | AdminMeetingsDashboard | admin | send-bulk-notifications |
| `/admin/tax-reviews` | TaxReviewPanel | admin | - |
| `/admin/media-library` | MediaLibrary | admin | - |
| `/admin/role-management` | RoleManagement | admin | Critical - modifies user roles |
| `/admin/troll-town-deeds` | AdminTrollTownDeeds | admin | - |
| `/admin/officer-management` | OfficerManager | admin | - |
| `/admin/executive-secretaries` | ExecutiveSecretaries | admin | - |
| `/admin/executive-intake` | ExecutiveIntake | admin | - |
| `/admin/executive-reports` | ExecutiveReports | admin | - |
| `/admin/officer-payroll` | OfficerPayrollReports | admin | - |
| `/admin/zip-governance` | ZipGovernanceDashboard | admin | - |
| `/admin/advertisements` | AdminAdvertisements | admin | Ad/social edge functions |
| `/admin/system/cache` | CacheClear | admin | - |
| `/admin/system/config` | SystemConfig | admin | - |
| `/admin/load-lab` | LoadLab | admin | - |
| `/admin/test-diagnostics` | TestDiagnosticsPage | admin | Tests edge functions |
| `/admin/reset-maintenance` | ResetMaintenance | admin | admin-reset, streams-maintenance |
| `/admin/docs/policies` | AdminPoliciesDocs | admin | - |
| `/admin/security-command-center` | SecurityCommandCenter | admin | - |
| `/admin/startup-expense-tracker` | StartupExpenseTracker | admin | - |
| `/admin/weekly-reports` | WeeklyReportsView | admin | - |
| `/admin/trollmers-tournament` | TrollmersTournament | admin | - |

---

## ROLE-RESTRICTED ROUTES

| Route | Page | Required Role | Key Tables |
|-------|------|---------------|------------|
| `/president/secretary` | SecretaryDashboard | president/secretary | - |
| `/secretary` | SecretaryConsole | secretary | properties, deeds |
| `/president/treasury` | TreasuryDashboard | president/secretary | - |
| `/prosecutor` | ProsecutorDashboard | prosecutor | court_* |
| `/officer/dashboard` | OfficerDashboard | troll_officer/admin | officer_* |
| `/officer/moderation` | OfficerModeration | troll_officer/admin | moderation_* |
| `/officer/report/:id` | ReportDetailsPage | troll_officer/admin | moderation_reports |
| `/officer/scheduling` | OfficerScheduling | troll_officer/admin | officer_* |
| `/officer/lounge` | TrollOfficerLounge | troll_officer/admin | - |
| `/lead-officer` | LeadOfficerDashboard | lead/owner | officer_* |
| `/ceo-assistant-dashboard` | CEOAssistantDashboard | ceo_assistant | payout_requests, user_reports |
| `/noah-assistant-dashboard` | NoahAssistantDashboard | noah_assistant | payout_requests, user_reports |
| `/attorney` | AttorneyDashboard | attorney | court_cases |
| `/church/pastor` | PastorDashboard | pastor | church_* |
| `/church/pastor/payouts` | PastorPayouts | pastor | - |
| `/organization/dashboard` | OrganizationDashboard | org member | organizations, org_members |
| `/tcnn/dashboard` | TCNNInternalDashboard | tcnn_admin | - |
| `/tcnn/setup` | TCNNSetupPage | tcnn_admin | - |
| `/tcnn/broadcaster` | TCNNBroadcasterPage | tcnn_broadcaster | - |
| `/agencies/dashboard` | AgencyDashboard | agency_member | - |
| `/agencies/hr-dashboard` | AgencyHRDashboard | agency_hr | - |
| `/auction/studio` | AuctionStudio | auctioneer | auction_* |
| `/auctions/studio/:showId/lots` | AuctionStudioLots | auctioneer | auction_lots |
| `/auctions/studio/:showId/live` | AuctioneerDashboard | auctioneer | - |
| `/auctions/my-shows` | MyAuctionShows | auctioneer | auction_shows |
| `/auctions/reports` | AuctionReports | auctioneer | auction_reports |
| `/auctions/bidders` | AuctionBidders | auctioneer | auction_bids |
| `/auctions/sales` | AuctionSales | auctioneer | auction_wins |
| `/auctions/analytics` | AuctionAnalytics | auctioneer | auction_bids |
| `/auctions/settings` | AuctionSettings | auctioneer | auctioneer_profiles |
| `/auctions/inventory` | AuctionInventory | auctioneer | auction_lots |
| `/auctions/applications` | AdminAuctionApps | admin | auctioneer_applications |
| `/inmate-tcps` | InmateTCPS | Authenticated (jailed) | conversations |

---

## BUTTON VISIBILITY BY ROUTE

The following buttons appear on each route (at minimum):

| Route Category | Typical Buttons |
|---------------|----------------|
| Home/Feed | Explore categories, broadcast cards, filter buttons |
| Profile | Follow, Message, Gift, Settings, Inventory |
| Stream Viewer | Gift, Like, Share, Join Seat, Chat |
| Stream Broadcaster | Start/End, Seat Config, Gift Tray, User Actions, Mod Controls |
| Wallet | Buy Coins, Refresh, Request Payout |
| Coin Store | Buy Package (PayPal/Card) |
| Jail | Pay Bail, Request Attorney, Appeal |
| Court | Open/Adjourn, Edit, Extend, Delete Case |
| Auction Room | Bid, Start, End, Lot Management |
| Marketplace | Create Listing, Buy, Manage Shop |
| Admin | Grant Coins, Process Payouts, Manage Roles, View Metrics |
| Family | Create, Join, Chat, War, Shop |
| Church | Pray, Like, Reply, Start Service, Sermon Notes |
| Neighborhood | Buy Car, Insurance, License, Raid, Repair |
| Government | Create Law, Vote, Bribe, Protest |
| Messaging | Send Message, Create Group, Start Call |

---

## KNOWN STATIC ISSUES (from code analysis)

1. **Profile.tsx** - 9 parallel SELECTs on mount + N+1 follow-up queries for marketplace items and insurance plans
2. **AdminDashboard.tsx** - 5+ independent data fetching hooks with overlapping queries, all on 30-second intervals
3. **EconomyDashboard.tsx** - Scans entire `coin_transactions` table client-side with no date filter or limit
4. **useAdminDashboardMetrics.ts** - 4 sequential Supabase queries on every mount with no caching
5. **TrollCourtSession.tsx** - Multiple unbounded `select("*")` queries for court participants/summons
6. **BattleView.tsx** - 6+ separate realtime channel subscriptions per battle participant
7. **BroadcastPage.tsx** - 4 separate realtime channel subscriptions per stream
8. **useTrollToe.ts** - Orphaned realtime subscription with no event handlers
9. **EarningsPayout.tsx** - Channel recreation loop due to missing useCallback
10. **App.tsx** - Suspense fallback is `null`, causing blank screens during code-split navigation
