# Mai Troll Frontend Page Inventory
## All Pages That Should Show in the Frontend
### Generated from App.tsx route definitions

---

## PUBLIC ROUTES (No Authentication Required)

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | AuthenticatedHome | Home page (redirects to auth if not logged in) |
| `/auth` | Auth | Login/Register |
| `/auth/callback` | AuthCallback | OAuth callback |
| `/reset-password` | PasswordReset | Password reset |
| `/legal` | PolicyCenter | Legal hub |
| `/legal/terms` | TermsOfServiceLegal | Terms of service |
| `/legal/privacy` | PrivacyPolicyLegal | Privacy policy |
| `/legal/refunds` | RefundPolicyLegal | Refund policy |
| `/legal/refund` | RefundPolicyLegal | Refund policy (alt) |
| `/legal/payouts` | PayoutPolicyLegal | Payout policy |
| `/legal/safety` | SafetyGuidelinesLegal | Safety guidelines |
| `/legal/creator-earnings` | CreatorEarnings | Creator earnings |
| `/legal/gambling-disclosure` | GamblingDisclosure | Gambling disclosure |
| `/about` | SEOAboutPage | About page |
| `/contact` | SEOContactPage | Contact page |
| `/faq` | SEOFAQPage | FAQ page |
| `/privacy` | SEOPrivacyPage | Privacy page |
| `/terms` | SEOTermsPage | Terms page |
| `/podcast` | PodcastCentral | Podcast central |
| `/podcast/:id` | PodcastRoom | Podcast room |
| `/troll-court` | TrollCourt | Court public view |
| `/troll-court/watch/:sessionId` | CourtViewerPage | Court session viewer |
| `/universe/dev-preview` | UniverseArenaDevPreview | Universe dev preview |
| `/explore` | ExploreSearchResults | Explore/Search |
| `/high-bcasters` | HighBcastersPage | High broadcasters |
| `/live-swipe` | StreamSwipePage | Live swipe |
| `/embed/:id` | EmbedPage | Embedded stream |
| `/jobs` | HowToVideosPage | Jobs/How-to videos |
| `/hytrogaming` | HytroGaming | Hytro Gaming |
| `/hytrogaming/apply` | HytroGamingApply | Gaming apply |
| `/hytrogaming/contract/:id` | HytroGamingContract | Gaming contract |
| `/hytro/:id` | HytroGamingViewer | Gaming viewer |
| `/safety` | Safety | Safety page |
| `/help` | HelpPage | Help page |
| `/agencies` | AgenciesPage | Agencies list |
| `/agencies/create` | CreateAgencyPage | Create agency |
| `/agency/:agencyIdOrSlug` | AgencyProfilePage | Agency profile |
| `/agency/:agencyIdOrSlug/roster` | AgencyProfilePage | Agency roster |
| `/agency/:agencyIdOrSlug/goals` | AgencyProfilePage | Agency goals |
| `/agency-apply/:agencyIdOrSlug` | AgencyApplyPage | Apply to agency |
| `/apply` | ApplicationPage | Creator application |
| `/auctions` | AuctionsPage | Auctions list |
| `/auctions/:showId` | LiveAuctionRoom | Live auction room |
| `/auctions/won/:showId` | AuctionWon | Auction won |
| `/treelz` | TreelzPage | Treelz |
| `/treelz/upload` | TreelzUploadPage | Treelz upload |
| `/profile/:username` | Profile | User profile |
| `/profile/id/:userId` | Profile | User profile by ID |
| `/replay/:streamId` | ReplayPage | Stream replay |
| `/replay/id/:streamId` | ReplayPage | Stream replay by ID |
| `/gaming/watch/:streamId` | HytroGamingViewer | Gaming watch |
| `/live/:username` | BroadcastRouter | Live by username |
| `/stream/:username` | BroadcastRouter | Stream by username |
| `/broadcast/:id` | BroadcastRouter | Broadcast by ID |
| `/watch/:id` | BroadcastRouter | Watch by ID |
| `/live/:streamId` | BroadcastRouter | Live by stream ID |
| `/stream/:id` | BroadcastRouter | Stream by ID |
| `/state-rankings` | StateRankings | State rankings |
| `/state/:stateCode` | StateDetail | State detail |
| `/verified-badge` | VerifiedBadgePage | Verified badge info |
| `/academy` | AcademyHomePage | Academy home |
| `/academy/courses` | CourseCatalogPage | Course catalog |
| `/academy/course/:slug` | CourseDetailPage | Course detail |
| `/academy/verify` | VerifyCertificatePage | Verify certificate |
| `/academy/teachers` | TeacherDirectoryPage | Teacher directory |
| `/academy/assignments` | AssignmentsListPage | Assignments list |
| `/tcnn` | TCNNMainPage | TCNN main |
| `/tcnn/article/:id` | ArticleReader | Article reader |
| `/tcnn/viewer/:streamId` | TCNNViewerPage | TCNN viewer |
| `/marketplace` | Marketplace | Marketplace |
| `/marketplace/orders` | Marketplace | Marketplace orders |
| `/marketplace/sales` | Marketplace | Marketplace sales |
| `/pool` | PublicPool | Public coin pool |
| `/troll-games/giveaways` | GiveawaysPage | Giveaways |
| `/troll-wheel` | TrollWheel | Troll wheel |
| `/ktauto` | CarDealership | Car dealership |
| `/garage` | GaragePage | Garage |
| `/vehicle-transactions` | VehicleTransactionsPage | Vehicle transactions |
| `/shop/:username` | ShopView | User shop |
| `/inventory` | UserInventory | User inventory |
| `/troting` | Troting | Troting/voting |
| `/leaderboard` | Leaderboard | Leaderboard |
| `/credit-scores` | CreditScorePage | Credit scores |
| `/support` | Support | Support |
| `/beta-feedback` | BetaFeedback | Beta feedback |
| `/survey/:surveyId` | SurveyPage | Survey |
| `/under-construction` | UnderConstructionPage | Under construction |
| `/jail` | JailPage | Jail public view |
| `/inmates` | InmatesPage | Inmates list |
| `/jail/appeal` | JailAppealPage | Jail appeal |
| `/wall` | WallPage | Troll wall |
| `/wall/:postId` | WallPostPage | Wall post |
| `/search` | SearchPage | Search |
| `/blocked-users` | BlockedUsers | Blocked users |
| `/living` | LivingPage | Living page |
| `/map` | MapPage | City map |
| `/neighborhood-map` | NeighborhoodMapHub | Neighborhood map |
| `/neighborhood-setup` | NeighborhoodOnboarding | Neighborhood setup |
| `/driver-test` | DriverTest | Driver test |
| `/insurance` | InsurancePage | Insurance |
| `/church` | ChurchPage | Church |
| `/church/live/:sessionId` | ChurchLivePage | Church live |
| `/court` | CourtRoom | Court room |
| `/court/:courtId/summary` | CourtSummary | Court summary |
| `/court/:courtId` | CourtRoom | Court room by ID |
| `/meeting/:meetingId` | TeamMeetingRoom | Team meeting |
| `/team-meeting/:meetingId` | TeamMeetingRoom | Team meeting (alias) |
| `/tromail` | TromailPage | Tromail |
| `/tromail/office` | TroMailOfficePage | Tromail office |
| `/pride-shop` | PrideShop | Pride shop |
| `/pride-challenges` | PrideChallengesPage | Pride challenges |
| `/store` | CoinStore | Coin store |
| `/coins` | CoinStore | Coin store (alt) |
| `/profile-frames` | ProfileFrameStore | Profile frames |
| `/coins/complete` | CoinsComplete | Purchase complete |
| `/stats` | StatsPage | Stats |
| `/earnings` | EarningsDashboard | Earnings |
| `/bonuses` | BonusesPage | Bonuses |
| `/cashout` | CashoutPage | Cashout |
| `/fast-pay-application` | FastPayApplication | Fast pay application |
| `/mai-pay` | MaiPayPage | Mai pay |
| `/shop-partner` | ShopPartnerPage | Shop partner |
| `/sell` | SellOnmaitroll | Sell |
| `/seller/orders` | SellerOrders | Seller orders |
| `/my-orders` | MyOrders | My orders |
| `/seller/earnings` | ShopEarnings | Shop earnings |
| `/family/browse` | FamilyBrowse | Family browse |
| `/family/create` | FamilyBrowse | Family create |
| `/family/city` | TrollFamilyCity | Family city |
| `/family/profile/:id` | FamilyProfilePage | Family profile |
| `/family/chat/:familyId` | FamilyChatPage | Family chat |
| `/family/wars` | FamilyWarsPage | Family wars |
| `/family/home` | TrollFamilyHome | Family home |
| `/family/wars-hub` | FamilyWarsHub | Family wars hub |
| `/family/leaderboard` | FamilyLeaderboard | Family leaderboard |
| `/family/shop` | FamilyShop | Family shop |
| `/government` | Government | Government |
| `/government/streams` | GovernmentStreams | Government streams |
| `/notifications` | Notifications | Notifications |
| `/following` | Following | Following |
| `/following/:userId` | Following | Following by user |
| `/trollifications` | Trollifications | Trollifications |
| `/trollifieds` | Trollifieds | Trollifieds |
| `/call/:roomId/:type/:userId` | Call | Call/voice/video |
| `/interview/:interviewId` | InterviewPage | Interview |
| `/xtrollz` | XtrollzHome | Xtrollz home |
| `/xtrollz/rules` | XtrollzRulesPage | Xtrollz rules |
| `/xtrollz/apply` | XtrollzApplyPage | Xtrollz apply |
| `/xtrollz/payment` | XtrollzPaymentPage | Xtrollz payment |
| `/xtrollz/live/:streamId` | XTrollzLiveViewer | Xtrollz live |
| `/universe-event` | UniverseEventPage | Universe event |
| `/universe` | UniverseBattlesPage | Universe battles |
| `/universe/home` | UniverseBattlesPage | Universe home |
| `/universe/register` | UniverseRegisterPage | Universe register |
| `/universe/my-battles` | UniverseRegisterPage | Universe my battles |
| `/universe/calendar` | UniverseCalendarPage | Universe calendar |
| `/universe/live` | UniverseLiveArenaPage | Universe live |
| `/universe/history` | UniverseBattlesPage | Universe history |
| `/universe/champions` | UniverseBattlesPage | Universe champions |
| `/events/universe` | UniverseBattlesPage | Universe events (alt) |
| `/city-laws-fees` | CityLawsFeesPage | City laws/fees |
| `/city-registry` | CityRegistry | City registry |
| `/city-registry/advertise` | AdvertisePage | Advertise |
| `/access-denied` | AccessDenied | Access denied |
| `/terms-of-service` | PolicyCenter | Terms (alt) |
| `/privacy-policy` | PolicyCenter | Privacy (alt) |
| `/payment-terms` | PolicyCenter | Payment terms (alt) |
| `/creator-agreement` | PolicyCenter | Creator agreement (alt) |
| `/careers` | HowToVideosPage | Careers (alt) |
| `/career` | HowToVideosPage | Career (alt) |
| `/home` | AuthenticatedHome | Home (alt) |
| `/landing` | AuthenticatedHome | Landing (alt) |
| `/intro` | AuthenticatedHome | Intro (alt) |
| `/mobile` | AuthenticatedHome | Mobile (alt) |
| `/messages` | UtromailPage | Messages (alt) |
| `/add-card` | ProfileSetup | Add card (alt) |
| `/exit` | ExitPage | Exit page |
| `/profile/setup` | ProfileSetup | Profile setup |
| `/profile/settings` | ProfileSettings | Profile settings |
| `/profile/delete` | DeleteAccount | Delete account |
| `/bank` | TrollBank | Troll bank |
| `/payouts/setup` | PayoutSetupPage | Payout setup |
| `/payouts/request` | PayoutRequest | Payout request |
| `/payment/callback` | PaymentCallback | Payment callback |
| `/tax-onboarding` | TaxOnboarding | Tax onboarding |
| `/verification` | VerificationPage | Verification |
| `/verification/complete` | VerificationComplete | Verification complete |
| `/founding-officer-trial` | FoundingOfficerTrial | Founding officer trial |
| `/account/earnings` | EarningsDashboard | Account earnings |
| `/payout-status` | PayoutStatus | Payout status |
| `/kick-fee/:streamId` | KickFeePage | Kick fee |
| `/broadcast/setup` | SetupPage | Broadcast setup |
| `/broadcast/setup/gaming` | GamingSetupPage | Gaming setup |
| `/broadcast/setup/gaming/analytics` | GamingAnalytics | Gaming analytics |
| `/broadcast/setup/gaming/community` | GamingCommunity | Gaming community |
| `/broadcast/setup/gaming/monetization` | GamingMonetization | Gaming monetization |
| `/broadcast/setup/gaming/store` | GamingStore | Gaming store |
| `/president` | PresidentPage | President |
| `/president/dashboard` | PresidentDashboard | President dashboard |
| `/president/secretary` | SecretaryDashboard | Secretary dashboard |
| `/president/treasury` | TreasuryDashboard | Treasury dashboard |
| `/prosecutor` | ProsecutorDashboard | Prosecutor dashboard |
| `/live/command-center/:streamId` | LiveCommandCenter | Live command center |
| `/live/overlay/:streamId` | LiveStreamOverlay | Live stream overlay |
| `/settings/audio` | AudioSettings | Audio settings |
| `/match` | MatchPage | Match |
| `/city-hall` | AuthenticatedHome | City hall (alt) |
| `/universe-event` | UniverseEventPage | Universe event |
| `/dev/theme-preview` | ThemePreviewPage | Theme preview (dev) |
| `/dev/homepage-preview` | HomepageBackgroundShowcase | Homepage preview (dev) |

---

## AUTHENTICATED ROUTES (Any Logged-In User)

| Route | Component | Description |
|-------|-----------|-------------|
| `/agency-dashboard` | AgencyDashboard | Agency dashboard |
| `/hr-center` | HRCenter | HR center |
| `/onboarding/creator` | CreatorOnboarding | Creator onboarding |
| `/creator-switch` | CreatorSwitchProgram | Creator switch |
| `/pride-shop` | PrideShop | Pride shop |
| `/pride-challenges` | PrideChallengesPage | Pride challenges |
| `/profile-frames` | ProfileFrameStore | Profile frames |
| `/stats` | StatsPage | Stats |
| `/bonuses` | BonusesPage | Bonuses |
| `/fast-pay-application` | FastPayApplication | Fast pay application |
| `/mai-pay` | MaiPayPage | Mai pay |
| `/shop-partner` | ShopPartnerPage | Shop partner |
| `/sell` | SellOnmaitroll | Sell |
| `/seller/orders` | SellerOrders | Seller orders |
| `/my-orders` | MyOrders | My orders |
| `/seller/earnings` | ShopEarnings | Shop earnings |
| `/family/browse` | FamilyBrowse | Family browse |
| `/family/create` | FamilyBrowse | Family create |
| `/family/city` | TrollFamilyCity | Family city |
| `/family/profile/:id` | FamilyProfilePage | Family profile |
| `/family/chat/:familyId` | FamilyChatPage | Family chat |
| `/family/wars` | FamilyWarsPage | Family wars |
| `/family/home` | TrollFamilyHome | Family home |
| `/family/wars-hub` | FamilyWarsHub | Family wars hub |
| `/family/leaderboard` | FamilyLeaderboard | Family leaderboard |
| `/family/shop` | FamilyShop | Family shop |
| `/government` | Government | Government |
| `/government/streams` | GovernmentStreams | Government streams |
| `/notifications` | Notifications | Notifications |
| `/following` | Following | Following |
| `/following/:userId` | Following | Following by user |
| `/trollifications` | Trollifications | Trollifications |
| `/trollifieds` | Trollifieds | Trollifieds |
| `/call/:roomId/:type/:userId` | Call | Call/voice/video |
| `/interview/:interviewId` | InterviewPage | Interview |
| `/universe-event` | UniverseEventPage | Universe event |
| `/universe` | UniverseBattlesPage | Universe battles |
| `/universe/home` | UniverseBattlesPage | Universe home |
| `/universe/register` | UniverseRegisterPage | Universe register |
| `/universe/my-battles` | UniverseRegisterPage | Universe my battles |
| `/universe/calendar` | UniverseCalendarPage | Universe calendar |
| `/universe/live` | UniverseLiveArenaPage | Universe live |
| `/universe/history` | UniverseBattlesPage | Universe history |
| `/universe/champions` | UniverseBattlesPage | Universe champions |
| `/events/universe` | UniverseBattlesPage | Universe events (alt) |
| `/city-laws-fees` | CityLawsFeesPage | City laws/fees |
| `/city-registry` | CityRegistry | City registry |
| `/city-registry/advertise` | AdvertisePage | Advertise |
| `/jail` | JailPage | Jail |
| `/inmates` | InmatesPage | Inmates |
| `/jail/appeal` | JailAppealPage | Jail appeal |
| `/wall` | WallPage | Troll wall |
| `/wall/:postId` | WallPostPage | Wall post |
| `/search` | SearchPage | Search |
| `/blocked-users` | BlockedUsers | Blocked users |
| `/living` | LivingPage | Living |
| `/map` | MapPage | Map |
| `/neighborhood-map` | NeighborhoodMapHub | Neighborhood map |
| `/neighborhood-setup` | NeighborhoodOnboarding | Neighborhood setup |
| `/driver-test` | DriverTest | Driver test |
| `/insurance` | InsurancePage | Insurance |
| `/church` | ChurchPage | Church |
| `/church/live/:sessionId` | ChurchLivePage | Church live |
| `/court` | CourtRoom | Court |
| `/court/:courtId/summary` | CourtSummary | Court summary |
| `/court/:courtId` | CourtRoom | Court by ID |
| `/meeting/:meetingId` | TeamMeetingRoom | Team meeting |
| `/team-meeting/:meetingId` | TeamMeetingRoom | Team meeting (alias) |
| `/tromail` | TromailPage | Tromail |
| `/tromail/office` | TroMailOfficePage | Tromail office |
| `/store` | CoinStore | Coin store |
| `/coins` | CoinStore | Coin store (alt) |
| `/profile-frames` | ProfileFrameStore | Profile frames |
| `/coins/complete` | CoinsComplete | Purchase complete |
| `/stats` | StatsPage | Stats |
| `/payouts/setup` | PayoutSetupPage | Payout setup |
| `/payouts/request` | PayoutRequest | Payout request |
| `/payment/callback` | PaymentCallback | Payment callback |
| `/earnings` | EarningsDashboard | Earnings |
| `/bonuses` | BonusesPage | Bonuses |
| `/cashout` | CashoutPage | Cashout |
| `/fast-pay-application` | FastPayApplication | Fast pay application |
| `/mai-pay` | MaiPayPage | Mai pay |
| `/shop-partner` | ShopPartnerPage | Shop partner |
| `/sell` | SellOnmaitroll | Sell |
| `/seller/orders` | SellerOrders | Seller orders |
| `/my-orders` | MyOrders | My orders |
| `/seller/earnings` | ShopEarnings | Shop earnings |
| `/government` | Government | Government |
| `/government/streams` | GovernmentStreams | Government streams |

---

## ROLE-PROTECTED ROUTES

### Admin Only

| Route | Component | Required Role |
|-------|-----------|---------------|
| `/admin` | AdminDashboard | ADMIN |
| `/admin/security-command-center` | SecurityCommandCenter | ADMIN |
| `/admin/creator-approvals` | CreatorSwitchApprovals | ADMIN, SECRETARY, LEAD_TROLL_OFFICER |
| `/admin/officer-operations` | OfficerOperations | ADMIN |
| `/store-debug` | StoreDebug | ADMIN |
| `/admin-mobile` | MobileAdminDashboard | ADMIN |
| `/admin/officer-reports` | AdminOfficerReports | ADMIN |
| `/admin/earnings` | AdminEarningsDashboard | ADMIN |
| `/admin/payments` | PaymentsDashboard | ADMIN, TROLL_OFFICER |
| `/admin/economy` | EconomyDashboard | ADMIN, TROLL_OFFICER |
| `/admin/tax-reviews` | TaxReviewPanel | ADMIN, TROLL_OFFICER |
| `/tax/upload` | TaxUpload | Any authenticated |
| `/admin/referrals` | ReferralBonusPanel | ADMIN, TROLL_OFFICER |
| `/admin/payouts` | AdminPayoutDashboard | ADMIN |
| `/admin/officers-live` | AdminLiveOfficersTracker | ADMIN |
| `/admin/verified-users` | AdminVerifiedUsers | ADMIN |
| `/admin/verification` | AdminVerificationReview | ADMIN |
| `/admin/applications` | ApplicationsPage | ADMIN |
| `/admin/docs/policies` | AdminPoliciesDocs | ADMIN |
| `/admin/marketplace` | AdminMarketplace | ADMIN |
| `/admin/marketplace/release-requests` | MarketplaceReleaseRequests | ADMIN |
| `/admin/pool` | AdminPoolPage | ADMIN |
| `/admin/trollmers-tournament` | TrollmersTournament | ADMIN |
| `/admin/jail-management` | AdminJailManagement | ADMIN |
| `/admin/user-forms` | UserFormsTab | ADMIN |
| `/admin/executive-secretaries` | ExecutiveSecretaries | ADMIN |
| `/admin/executive-intake` | ExecutiveIntake | ADMIN |
| `/admin/executive-reports` | ExecutiveReports | ADMIN |
| `/admin/troll-town-deeds` | AdminTrollTownDeeds | ADMIN |
| `/admin/cashout-manager` | CashoutManager | ADMIN |
| `/admin/cashout/:id` | AdminCashoutDetailPage | ADMIN |
| `/admin/officer-management` | OfficerManager | ADMIN |
| `/admin/role-management` | RoleManagement | ADMIN |
| `/admin/staff-audit` | StaffAuditDashboard | ADMIN, SECRETARY, LEAD_TROLL_OFFICER |
| `/admin/media-library` | MediaLibrary | ADMIN |
| `/admin/chat-moderation` | ChatModeration | ADMIN |
| `/admin/announcements` | Announcements | ADMIN |
| `/admin/send-notifications` | SendNotifications | ADMIN |
| `/admin/xtrollz-apps` | XtrollzAdminDashboard | ADMIN |
| `/admin/export-data` | ExportData | ADMIN |
| `/admin/user-search` | UserSearch | ADMIN |
| `/admin/reports-queue` | ReportsQueue | ADMIN |
| `/admin/stream-monitor` | StreamMonitorPage | ADMIN |
| `/admin/night-watch` | NightWatchDashboard | NIGHT_WATCH_PATROL_ROLES |
| `/admin/voting` | TrotingAdminPage | ADMIN |
| `/admin/payment-logs` | PaymentLogs | ADMIN |
| `/admin/launch-trial` | AdminLaunchTrial | ADMIN |
| `/admin/store-pricing` | StorePriceEditor | ADMIN |
| `/admin/errors` | AdminErrors | ADMIN |
| `/admin/activity` | AdminActivity | ADMIN |
| `/admin/supabase-usage` | SupabaseUsageDashboard | ADMIN |
| `/admin/finance` | AdminFinanceDashboard | ADMIN |
| `/admin/manual-orders` | AdminManualOrders | ADMIN, SECRETARY |
| `/admin/buckets` | BucketsDashboard | ADMIN |
| `/admin/grant-coins` | GrantCoins | ADMIN |
| `/admin/create-schedule` | CreateSchedule | ADMIN |
| `/admin/officer-shifts` | OfficerShifts | ADMIN |
| `/admin/referral-bonuses` | ReferralBonuses | ADMIN |
| `/admin/control-panel` | ControlPanel | ADMIN |
| `/admin/page-visibility` | AdminPageVisibility | ADMIN |
| `/admin/test-diagnostics` | TestDiagnosticsPage | ADMIN |
| `/admin/reset-maintenance` | ResetMaintenance | ADMIN |
| `/admin/appeals` | AppealManagement | ADMIN, SECRETARY |
| `/admin/meetings` | AdminMeetingsDashboard | ADMIN, CEO, LEAD_TROLL_OFFICER, TROLL_OFFICER, OFFICER, SECRETARY |
| `/rtcadminmonitor` | RTCAdminMonitor | ADMIN, HR_ADMIN, AGENCY_HR_MANAGER, LEAD_TROLL_OFFICER, TROLL_OFFICER, SECRETARY, CEO, OFFICER, PASTOR |
| `/rfc` | AdminRFC | Any authenticated |
| `/changelog` | Changelog | ADMIN |

### Staff Routes (Department Tools)

| Route | Component | Required Role |
|-------|-----------|---------------|
| `/Employees` | EmployeesPage | Employee roles |
| `/employees` | EmployeesPage | Employee roles (alt) |
| `/department-tools` | DepartmentToolsPage | Staff roles |
| `/officer` | DepartmentToolsPage | TROLL_OFFICER |
| `/officer/dashboard` | DepartmentToolsPage | TROLL_OFFICER |
| `/officer/scheduling` | DepartmentToolsPage | TROLL_OFFICER |
| `/officer/payroll` | DepartmentToolsPage | TROLL_OFFICER |
| `/officer/moderation` | DepartmentToolsPage | TROLL_OFFICER |
| `/officer/lounge` | DepartmentToolsPage | TROLL_OFFICER |
| `/officer/report/:id` | EmployeesPage | Employee roles |
| `/lead-officer` | DepartmentToolsPage | LEAD_TROLL_OFFICER |
| `/secretary` | SecretaryConsole | ADMIN, SECRETARY |
| `/ceo-assistant-dashboard` | CEOAssistantDashboard | CEO_ASSISTANT |
| `/noah-assistant-dashboard` | NoahAssistantDashboard | NOAH_ASSISTANT |
| `/hr-center` | HRCenter | Staff roles |
| `/agency-hr` | AgencyHRDashboard | AGENCY_HR_MANAGER |
| `/pastor` | DepartmentToolsPage | PASTOR |
| `/church/pastor` | PastorDashboard | PASTOR |
| `/attorney` | AttorneyDashboard | ATTORNEY |
| `/prosecutor` | ProsecutorDashboard | PROSECUTOR |
| `/notary` | NotaryDashboard | NOTARY, ADMIN, ATTORNEY |

### Special Role Routes

| Route | Component | Required Role |
|-------|-----------|---------------|
| `/agency-hr-dashboard` | AgencyHRDashboard | ADMIN, AGENCY_HR_MANAGER, HR_ADMIN |
| `/hr-center` | HRCenter | ADMIN, HR_ADMIN, HR_MANAGER, AGENCY_HR_MANAGER, TROLL_OFFICER, LEAD_TROLL_OFFICER, PASTOR, AGENCY_LEADER, SECRETARY, ATTORNEY, PROSECUTOR, JOURNALIST, AUCTIONEER, TROLLER, CEO_ASSISTANT, NOAH_ASSISTANT |
| `/president/dashboard` | PresidentDashboard | PRESIDENT, ADMIN |
| `/president/secretary` | SecretaryDashboard | SECRETARY, ADMIN |
| `/president/treasury` | TreasuryDashboard | PRESIDENT, ADMIN |
| `/prosecutor` | ProsecutorDashboard | PROSECUTOR |
| `/tcnn/dashboard` | TCNNInternalDashboard | JOURNALIST, TCNN_NEWS_CASTER, TCNN_CHIEF_NEWS_CASTER |
| `/tcnn/setup` | TCNNSetupPage | TCNN_NEWS_CASTER, TCNN_CHIEF_NEWS_CASTER |
| `/tcnn/broadcaster` | TCNNBroadcasterPage | TCNN_NEWS_CASTER, TCNN_CHIEF_NEWS_CASTER |
| `/tcnn/broadcaster/:streamId` | TCNNBroadcasterPage | TCNN_NEWS_CASTER, TCNN_CHIEF_NEWS_CASTER |
| `/auctions/studio` | AuctionStudio | AUCTIONEER |
| `/auctions/studio/:showId/lots` | AuctionStudioLots | AUCTIONEER |
| `/auctions/studio/:showId/live` | AuctioneerDashboard | AUCTIONEER |
| `/auctions/my-shows` | MyAuctionShows | AUCTIONEER |
| `/auctions/bidders` | AuctionBidders | AUCTIONEER |
| `/auctions/sales` | AuctionSales | AUCTIONEER |
| `/auctions/analytics` | AuctionAnalytics | AUCTIONEER |
| `/auctions/settings` | AuctionSettings | AUCTIONEER |
| `/auctions/inventory` | AuctionInventory | AUCTIONEER |
| `/auctions/orders` | AuctionOrderManagement | AUCTIONEER |
| `/auctions/packing` | PackingStation | AUCTIONEER |
| `/auctions/devices` | DeviceManagement | AUCTIONEER |
| `/auctioneer/scanner` | AuctioneerScanner | AUCTIONEER |
| `/auction-app` | AuctionApp | AUCTIONEER |
| `/auction-app/:showId` | AuctionApp | AUCTIONEER |
| `/ceo-assistant-dashboard` | CEOAssistantDashboard | CEO_ASSISTANT |
| `/noah-assistant-dashboard` | NoahAssistantDashboard | NOAH_ASSISTANT |

### Academy Role Routes

| Route | Component | Required Role |
|-------|-----------|---------------|
| `/academy/admin` | AcademyAdminPage | ADMIN |
| `/academy/teacher/apply` | TeacherApplyPage | Any authenticated |
| `/academy/teacher/dashboard` | TeacherDashboardPage | Teacher role |
| `/academy/teacher/course/new` | TeacherCoursePage | Teacher role |
| `/academy/teacher/course/:courseId` | TeacherCoursePage | Teacher role |
| `/academy/grades` | AcademyTranscriptPage | Student/Teacher |
| `/academy/certificates` | AcademyCertificatesPage | Any authenticated |
| `/academy/transcript` | AcademyTranscriptPage | Any authenticated |
| `/academy/coins` | AcademyCoinsPage | Any authenticated |
| `/academy/admissions` | AcademyAdmissionsPage | Any authenticated |
| `/academy/classroom` | AcademyClassroomPage | Enrolled students |
| `/academy/classroom/:courseId` | AcademyClassroomPage | Enrolled students |
| `/academy/assignment/new` | AssignmentCreatePage | Teacher role |
| `/academy/assignment/edit/:assignmentId` | AssignmentCreatePage | Teacher role |
| `/academy/assignment/grade/:assignmentId` | AssignmentGradingPage | Teacher role |
| `/academy/course/:slug/assignments` | AssignmentStudentPage | Enrolled students |
| `/academy/course/:slug/quiz/:quizId` | QuizTakePage | Enrolled students |
| `/academy/quiz/new` | QuizBuilderPage | Teacher role |
| `/academy/quiz/new/:courseId` | QuizBuilderPage | Teacher role |
| `/academy/attendance/:courseId` | AttendancePage | Teacher role |
| `/academy/attendance/:courseId/:sessionId` | AttendancePage | Teacher role |
| `/academy/pathway/:pathwayId` | PathwayDetailPage | Any authenticated |
| `/academy/loans` | LoanServicingPage | Any authenticated |
| `/academy/teacher/revenue` | TeacherRevenuePage | Teacher role |
| `/academy/course/:slug/communication` | CommunicationCenterPage | Enrolled students |
| `/academy/transcript/official` | TranscriptPage | Any authenticated |
| `/academy/accreditation` | AccreditationPage | Any authenticated |
| `/academy/admin/teachers` | TeacherManagementPage | ADMIN |
| `/academy/teachers` | TeacherDirectoryPage | Any authenticated |

### Redirect/Alias Routes

| Route | Redirects To | Description |
|-------|--------------|-------------|
| `/auction/dashboard` | `/auctions/studio` | Auction dashboard alias |
| `/auction/studio` | `/auctions/studio` | Auction studio alias |
| `/auction/studio/lots` | `/auctions/studio/lots` | Auction lots alias |
| `/auction/my-shows` | `/auctions/my-shows` | My shows alias |
| `/auction/bidders` | `/auctions/bidders` | Bidders alias |
| `/auction/sales` | `/auctions/sales` | Sales alias |
| `/auction/reports` | `/auction/reports` | Reports alias |
| `/auction/analytics` | `/auction/analytics` | Analytics alias |
| `/auction/settings` | `/auction/settings` | Settings alias |
| `/auction/inventory` | `/auction/inventory` | Inventory alias |
| `/auction/orders` | `/auction/orders` | Orders alias |
| `/auction/packing` | `/auction/packing` | Packing alias |
| `/auction/devices` | `/auction/devices` | Devices alias |
| `/tcnn/chief` | `/tcnn/dashboard` | TCNN chief alias |
| `/officer` | `/department-tools?role=troll_officer` | Officer alias |
| `/officer/dashboard` | `/department-tools?role=troll_officer` | Officer dashboard alias |
| `/officer/scheduling` | `/department-tools?role=troll_officer` | Officer scheduling alias |
| `/officer/payroll` | `/department-tools?role=troll_officer` | Officer payroll alias |
| `/officer/moderation` | `/department-tools?role=troll_officer` | Officer moderation alias |
| `/officer/lounge` | `/department-tools?role=troll_officer` | Officer lounge alias |
| `/officer/report/:id` | `/Employees` | Officer report alias |
| `/lead-officer` | `/department-tools?role=lead_troll_officer` | Lead officer alias |
| `/secretary` | `/department-tools?role=secretary` | Secretary alias |
| `/ceo-assistant-dashboard` | `/department-tools?role=ceo_assistant` | CEO assistant alias |
| `/noah-assistant-dashboard` | `/department-tools?role=noah_assistant` | Noah assistant alias |
| `/hr-center` | `/department-tools` | HR center alias |
| `/agency-hr` | `/agency-hr-dashboard` | Agency HR alias |
| `/pastor` | `/department-tools?role=pastor` | Pastor alias |
| `/church/pastor` | `/department-tools?role=pastor` | Church pastor alias |
| `/attorney` | `/department-tools?role=attorney` | Attorney alias |
| `/prosecutor` | `/department-tools?role=prosecutor` | Prosecutor alias |
| `/notary` | `/department-tools?role=notary` | Notary alias |
| `/city-hall` | `/home` | City hall alias |
| `/appeals` | `/city-registry` | Appeals alias |
| `/careers` | `/jobs` | Careers alias |
| `/career` | `/jobs` | Career alias |
| `/home` | `/` | Home alias |
| `/landing` | `/` | Landing alias |
| `/intro` | `/` | Intro alias |
| `/mobile` | `/home` | Mobile alias |
| `/messages` | `/utromail` | Messages alias |
| `/add-card` | `/profile/setup` | Add card alias |
| `/family` | `/family/browse` | Family alias |
| `/family/chat` | `/family` | Family chat alias |
| `/admin/hr` | `/hr-center` | Admin HR alias |
| `/dev/theme-preview` | ThemePreviewPage | Dev only |
| `/dev/homepage-preview` | HomepageBackgroundShowcase | Dev only |

---

## TOTAL ROUTE COUNT

| Category | Count |
|----------|-------|
| Public Routes | ~80 |
| Authenticated Routes | ~40 |
| Admin/Staff Routes | ~60+ |
| Redirect/Alias Routes | ~25 |
| **TOTAL UNIQUE PAGES** | **~150+** |

---

## NOTES

1. Many routes are aliases/redirects to the same component
2. Some routes have dynamic parameters (`:id`, `:username`, `:streamId`, etc.)
3. Role requirements are enforced by `RequireRole` and `RequireAuth` components
4. The `/:username` catch-all route at the end redirects to user profiles or live streams
5. Some pages may be conditionally rendered based on feature flags or app state
6. The actual visibility may also depend on `page_visibility` table settings
