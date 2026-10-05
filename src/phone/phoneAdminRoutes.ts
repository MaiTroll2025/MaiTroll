import { lazyWithRetry } from '@/utils/lazyImport'
import type { ComponentType } from 'react'

interface PhoneAdminRouteEntry {
  Component: ComponentType<any>
  title: string
}

// ---------------------------------------------------------------------------
// Lazy-loaded web admin components (code-split — only loaded when rendered)
// ---------------------------------------------------------------------------

// User Management
const LazyUserSearch = lazyWithRetry(() => import('@/pages/admin/UserSearch'))
const LazyRoleManagement = lazyWithRetry(() => import('@/pages/admin/RoleManagement'))
const LazyUserFormsTab = lazyWithRetry(() => import('@/pages/admin/components/UserFormsTab'))
const LazyStaffAudit = lazyWithRetry(() => import('@/pages/admin/StaffAuditDashboard'))
const LazyCreatorSwitchApprovals = lazyWithRetry(
  () => import('@/pages/admin/components/CreatorSwitchApprovals'),
)
const LazyOfficerManagement = lazyWithRetry(() => import('@/pages/admin/OfficerManager'))
const LazyVerifiedUsers = lazyWithRetry(() => import('@/pages/admin/AdminVerifiedUsers'))
const LazyVerificationReview = lazyWithRetry(() => import('@/pages/admin/AdminVerificationReview'))

// Reports & Support
const LazyReportsQueue = lazyWithRetry(() => import('@/pages/admin/ReportsQueue'))
const LazyAdminSupportTickets = lazyWithRetry(() => import('@/pages/admin/AdminSupportTicketsPage'))
const LazyCustomerService = lazyWithRetry(() => import('@/pages/admin/CustomerServiceDashboard'))
const LazyAppeals = lazyWithRetry(() => import('@/pages/admin/AppealManagement'))
const LazySendNotifications = lazyWithRetry(() => import('@/pages/admin/SendNotifications'))
const LazyCalls = lazyWithRetry(() => import('@/pages/admin/components/AdminCallsTab'))
const LazySurveys = lazyWithRetry(() => import('@/pages/admin/AdminSurveysPage'))
const LazyCriticalAlerts = lazyWithRetry(() => import('@/pages/admin/CriticalAlertsManager'))

// Content & Media
const LazyMediaLibrary = lazyWithRetry(() => import('@/pages/admin/MediaLibrary'))
const LazyChatModeration = lazyWithRetry(() => import('@/pages/admin/ChatModeration'))
const LazyAnnouncements = lazyWithRetry(() => import('@/pages/admin/Announcements'))
const LazyLaunchTrial = lazyWithRetry(() => import('@/pages/admin/LaunchTrial'))
const LazyStorePriceEditor = lazyWithRetry(() => import('@/pages/admin/components/StorePriceEditor'))

// Economy & Finance
const LazyFinanceDashboard = lazyWithRetry(() => import('@/pages/admin/AdminFinanceDashboard'))
const LazyEconomyDashboard = lazyWithRetry(() => import('@/pages/admin/EconomyDashboard'))
const LazyGrantCoins = lazyWithRetry(() => import('@/pages/admin/GrantCoins'))
const LazyTaxReviewPanel = lazyWithRetry(() => import('@/pages/admin/TaxReviewPanel'))
const LazyPaymentLogs = lazyWithRetry(() => import('@/pages/admin/PaymentLogs'))
const LazyPaymentsDashboard = lazyWithRetry(() => import('@/pages/admin/PaymentsDashboard'))
const LazyCashoutManager = lazyWithRetry(() => import('@/pages/admin/CashoutManager'))
const LazyCashoutDetail = lazyWithRetry(() => import('@/pages/admin/CashoutDetailPage'))
const LazyReferralBonusPanel = lazyWithRetry(() => import('@/pages/admin/ReferralBonusPanel'))
const LazyReferralBonuses = lazyWithRetry(() => import('@/pages/admin/ReferralBonuses'))
const LazyFeePool = lazyWithRetry(() => import('@/pages/admin/FeePool'))
const LazyCoinPurchaseLedger = lazyWithRetry(() => import('@/pages/admin/CoinPackPurchasesLedger'))
const LazyPayoutBatches = lazyWithRetry(() => import('@/pages/admin/PayoutBatches'))
const LazyAdminPool = lazyWithRetry(() => import('@/pages/admin/AdminPoolPage'))
const LazyBucketsDashboard = lazyWithRetry(() => import('@/pages/admin/BucketsDashboard'))
const LazyTicketManagement = lazyWithRetry(() => import('@/pages/admin/TicketManagement'))

// Operations & Scheduling
const LazyCreateSchedule = lazyWithRetry(() => import('@/pages/admin/CreateSchedule'))
const LazyOfficerOperations = lazyWithRetry(() => import('@/pages/admin/OfficerOperations'))
const LazyOfficerPayroll = lazyWithRetry(() => import('@/pages/admin/OfficerPayrollReports'))
const LazyDepartmentTools = lazyWithRetry(() => import('@/pages/department-tools/DepartmentToolsPage'))
const LazyMeetings = lazyWithRetry(() => import('@/pages/admin/AdminMeetingsDashboard'))

// System Management
const LazyDatabaseBackup = lazyWithRetry(() => import('@/pages/admin/DatabaseBackup'))
const LazyCacheClear = lazyWithRetry(() => import('@/pages/admin/CacheClear'))
const LazySystemConfig = lazyWithRetry(() => import('@/pages/admin/SystemConfig'))
const LazySystemHealth = lazyWithRetry(() => import('@/pages/admin/CityControlCenter'))
const LazyAdminErrors = lazyWithRetry(() => import('@/pages/admin/AdminErrors'))
const LazyAdminActivity = lazyWithRetry(() => import('@/pages/admin/AdminActivity'))
const LazySupabaseUsage = lazyWithRetry(() => import('@/pages/admin/SupabaseUsageDashboard'))
const LazyLoadLab = lazyWithRetry(() => import('@/components/admin/LoadLab'))
const LazyControlPanel = lazyWithRetry(() => import('@/pages/admin/ControlPanel'))
const LazyTestDiagnostics = lazyWithRetry(() => import('@/pages/admin/TestDiagnosticsPage'))
const LazyResetMaintenance = lazyWithRetry(() => import('@/pages/admin/ResetMaintenance'))
const LazyExportData = lazyWithRetry(() => import('@/pages/admin/ExportData'))
const LazyManualOrders = lazyWithRetry(() => import('@/pages/admin/AdminManualOrders'))
const LazyPageVisibility = lazyWithRetry(() => import('@/pages/admin/AdminPageVisibility'))

// HR & Executive
const LazyExecutiveSecretaries = lazyWithRetry(() => import('@/pages/admin/ExecutiveSecretaries'))
const LazyExecutiveIntake = lazyWithRetry(() => import('@/pages/admin/ExecutiveIntake'))
const LazyExecutiveReports = lazyWithRetry(() => import('@/pages/admin/ExecutiveReports'))

// Special Tools
const LazySecurityCommandCenter = lazyWithRetry(() => import('@/pages/admin/SecurityCommandCenter'))
const LazyAdminEarningsDashboard = lazyWithRetry(() => import('@/pages/admin/AdminEarningsDashboard'))
const LazyAdminPoliciesDocs = lazyWithRetry(() => import('@/pages/admin/AdminPoliciesDocs'))
const LazyAdminMarketplace = lazyWithRetry(() => import('@/pages/admin/AdminMarketplace'))
const LazyMarketplaceReleaseRequests = lazyWithRetry(
  () => import('@/pages/admin/MarketplaceReleaseRequests'),
)
const LazyTrollTownDeeds = lazyWithRetry(() => import('@/pages/admin/AdminTrollTownDeeds'))
const LazyJailManagement = lazyWithRetry(() => import('@/pages/admin/AdminJailManagement'))
const LazyVoting = lazyWithRetry(() => import('@/pages/admin/TrotingAdminPage'))
const LazyTromocodes = lazyWithRetry(() => import('@/pages/admin/TromoCodesAdmin'))
const LazyCrownRedemptions = lazyWithRetry(() => import('@/pages/admin/AdminCrownRedemptions'))
const LazyStartupExpenseTracker = lazyWithRetry(() => import('@/pages/admin/StartupExpenseTracker'))
const LazyFirstCashoutMatch = lazyWithRetry(() => import('@/pages/admin/FirstCashoutMatch'))
const LazyEmpireApplications = lazyWithRetry(() => import('@/pages/admin/EmpireApplicationsPage'))
const LazyAdminAdvertisements = lazyWithRetry(() => import('@/pages/admin/AdminAdvertisements'))
const LazyTrollmersTournament = lazyWithRetry(() => import('@/pages/admin/TrollmersTournament'))
const LazyZipGovernance = lazyWithRetry(() => import('@/pages/admin/ZipGovernanceDashboard'))
const LazySellerManagement = lazyWithRetry(() => import('@/pages/admin/SellerManagement'))
const LazyCourtDockets = lazyWithRetry(() => import('@/pages/admin/CourtDocketsManager'))
const LazySeasonalGoals = lazyWithRetry(() => import('@/pages/admin/SeasonalGoals'))
const LazyFridayBattles = lazyWithRetry(() => import('@/pages/admin/FridayBattlesDashboard'))
const LazyTournaments = lazyWithRetry(() => import('@/pages/admin/components/TournamentManager'))
const LazyWeeklyReports = lazyWithRetry(() => import('@/pages/admin/WeeklyReportsView'))
const LazyStreamMonitor = lazyWithRetry(() => import('@/pages/admin/StreamMonitorPage'))
const LazyNightWatch = lazyWithRetry(() => import('@/pages/admin/NightWatchDashboard'))
const LazyLiveOfficersTracker = lazyWithRetry(() => import('@/pages/admin/AdminLiveOfficersTracker'))

// Mai Sing Off Judges (named export, not default)
const LazySingOffJudges = lazyWithRetry(() =>
  import('@/features/mai-sing-off/pages/SingOffJudgeApplicationsAdmin').then((m) => ({
    default: m.SingOffJudgeApplicationsAdmin,
  })),
)

// ---------------------------------------------------------------------------
// Route table — maps phone `/admin/*` paths to their web components
// ---------------------------------------------------------------------------

const exactRoutes: Array<[string, PhoneAdminRouteEntry]> = [
  // User Management
  ['/admin/user-search', { Component: LazyUserSearch, title: 'User Search' }],
  ['/admin/role-management', { Component: LazyRoleManagement, title: 'Role Management' }],
  ['/admin/user-forms', { Component: LazyUserFormsTab, title: 'User Forms' }],
  ['/admin/users/forms', { Component: LazyUserFormsTab, title: 'User Forms' }],
  ['/admin/staff-audit', { Component: LazyStaffAudit, title: 'Staff Audit' }],
  ['/admin/creator-approvals', { Component: LazyCreatorSwitchApprovals, title: 'Creator Approvals' }],
  ['/admin/officer-management', { Component: LazyOfficerManagement, title: 'Officer Management' }],
  ['/admin/verified-users', { Component: LazyVerifiedUsers, title: 'Verified Users' }],
  ['/admin/verification', { Component: LazyVerificationReview, title: 'Verification Review' }],

  // Reports & Support
  ['/admin/reports-queue', { Component: LazyReportsQueue, title: 'Reports Queue' }],
  ['/admin/support-tickets', { Component: LazyAdminSupportTickets, title: 'Support Tickets' }],
  ['/admin/customer-service', { Component: LazyCustomerService, title: 'Customer Service' }],
  ['/admin/appeals', { Component: LazyAppeals, title: 'Appeals' }],
  ['/admin/send-notifications', { Component: LazySendNotifications, title: 'Send Notifications' }],
  ['/admin/calls', { Component: LazyCalls, title: 'Calls' }],
  ['/admin/surveys', { Component: LazySurveys, title: 'Surveys' }],
  ['/admin/critical-alerts', { Component: LazyCriticalAlerts, title: 'Critical Alerts' }],

  // Content & Media
  ['/admin/media-library', { Component: LazyMediaLibrary, title: 'Media Library' }],
  ['/admin/chat-moderation', { Component: LazyChatModeration, title: 'Chat Moderation' }],
  ['/admin/announcements', { Component: LazyAnnouncements, title: 'Announcements' }],
  ['/admin/launch-trial', { Component: LazyLaunchTrial, title: 'Launch Trial' }],
  ['/admin/store-pricing', { Component: LazyStorePriceEditor, title: 'Store Pricing' }],

  // Economy & Finance
  ['/admin/finance', { Component: LazyFinanceDashboard, title: 'Finance Dashboard' }],
  ['/admin/economy', { Component: LazyEconomyDashboard, title: 'Economy Dashboard' }],
  ['/admin/grant-coins', { Component: LazyGrantCoins, title: 'Grant Coins' }],
  ['/admin/tax-reviews', { Component: LazyTaxReviewPanel, title: 'Tax Reviews' }],
  ['/admin/payment-logs', { Component: LazyPaymentLogs, title: 'Payment Logs' }],
  ['/admin/payments', { Component: LazyPaymentsDashboard, title: 'Payments Dashboard' }],
  ['/admin/cashout-manager', { Component: LazyCashoutManager, title: 'Cashout Manager' }],
  ['/admin/referrals', { Component: LazyReferralBonusPanel, title: 'Referral Bonus Panel' }],
  ['/admin/referral-bonuses', { Component: LazyReferralBonuses, title: 'Referral Bonuses' }],
  ['/admin/fee-pool', { Component: LazyFeePool, title: 'Fee Pool' }],
  ['/admin/coinpurchase-ledger', { Component: LazyCoinPurchaseLedger, title: 'Coin Purchases Ledger' }],
  ['/admin/payout-batches', { Component: LazyPayoutBatches, title: 'Payout Batches' }],
  ['/admin/pool', { Component: LazyAdminPool, title: 'Admin Pool' }],
  ['/admin/tickets', { Component: LazyTicketManagement, title: 'Ticket Management' }],
  ['/admin/buckets', { Component: LazyBucketsDashboard, title: 'Buckets' }],

  // Operations & Scheduling
  ['/admin/create-schedule', { Component: LazyCreateSchedule, title: 'Create Schedule' }],
  ['/admin/officer-operations', { Component: LazyOfficerOperations, title: 'Officer Operations' }],
  ['/admin/officer-payroll', { Component: LazyOfficerPayroll, title: 'Officer Payroll' }],
  ['/admin/officer-shifts', { Component: LazyDepartmentTools, title: 'Department Tools' }],
  ['/admin/meetings', { Component: LazyMeetings, title: 'Meetings' }],

  // System Management
  ['/admin/system/backup', { Component: LazyDatabaseBackup, title: 'Database Backup' }],
  ['/admin/system/cache', { Component: LazyCacheClear, title: 'Cache Clear' }],
  ['/admin/system/config', { Component: LazySystemConfig, title: 'System Config' }],
  ['/admin/system/health', { Component: LazySystemHealth, title: 'System Health' }],
  ['/admin/errors', { Component: LazyAdminErrors, title: 'System Errors' }],
  ['/admin/activity', { Component: LazyAdminActivity, title: 'Activity' }],
  ['/admin/supabase-usage', { Component: LazySupabaseUsage, title: 'Supabase Usage' }],
  ['/admin/load-lab', { Component: LazyLoadLab, title: 'Load Lab' }],
  ['/admin/control-panel', { Component: LazyControlPanel, title: 'Control Panel' }],
  ['/admin/test-diagnostics', { Component: LazyTestDiagnostics, title: 'Test Diagnostics' }],
  ['/admin/reset-maintenance', { Component: LazyResetMaintenance, title: 'Reset & Maintenance' }],
  ['/admin/export-data', { Component: LazyExportData, title: 'Export Data' }],
  ['/admin/manual-orders', { Component: LazyManualOrders, title: 'Manual Orders' }],
  ['/admin/page-visibility', { Component: LazyPageVisibility, title: 'Page Visibility' }],

  // HR & Executive
  ['/admin/hr', { Component: LazyDepartmentTools, title: 'Department Tools' }],
  ['/admin/executive-secretaries', { Component: LazyExecutiveSecretaries, title: 'Executive Secretaries' }],
  ['/admin/secretary', { Component: LazyExecutiveSecretaries, title: 'Secretary & Founder Rewards' }],
  ['/admin/executive-intake', { Component: LazyExecutiveIntake, title: 'Executive Intake' }],
  ['/admin/executive-reports', { Component: LazyExecutiveReports, title: 'Executive Reports' }],

  // Special Tools
  ['/admin/security-command-center', { Component: LazySecurityCommandCenter, title: 'Security Command Center' }],
  ['/admin/earnings', { Component: LazyAdminEarningsDashboard, title: 'Earnings Dashboard' }],
  ['/admin/docs/policies', { Component: LazyAdminPoliciesDocs, title: 'Policy Docs' }],
  ['/admin/policies', { Component: LazyAdminPoliciesDocs, title: 'Policy Docs' }],
  ['/admin/marketplace', { Component: LazyAdminMarketplace, title: 'Admin Marketplace' }],
  ['/admin/marketplace/release-requests', { Component: LazyMarketplaceReleaseRequests, title: 'Release Requests' }],
  ['/admin/troll-town-deeds', { Component: LazyTrollTownDeeds, title: 'Troll Town Deeds' }],
  ['/admin/jail-management', { Component: LazyJailManagement, title: 'Jail Management' }],
  ['/admin/jail-test', { Component: LazyJailManagement, title: 'Jail Test Simulator' }],
  ['/admin/voting', { Component: LazyVoting, title: 'Voting / Troting' }],
  ['/admin/tromocodes', { Component: LazyTromocodes, title: 'TromoCodes' }],
  ['/admin/crown-redemptions', { Component: LazyCrownRedemptions, title: 'Crown Redemptions' }],
  ['/admin/startup-expense-tracker', { Component: LazyStartupExpenseTracker, title: 'Startup Expense Tracker' }],
  ['/admin/first-cashout-match', { Component: LazyFirstCashoutMatch, title: 'First Cashout Match' }],
  ['/admin/empire-applications', { Component: LazyEmpireApplications, title: 'Empire Applications' }],
  ['/admin/advertisements', { Component: LazyAdminAdvertisements, title: 'Advertisements' }],
  ['/admin/mai-singoff-judges', { Component: LazySingOffJudges, title: 'Mai Sing Off Judges' }],
  ['/admin/trollmers-tournament', { Component: LazyTrollmersTournament, title: 'Trollmers Tournament' }],
  ['/admin/zip-governance', { Component: LazyZipGovernance, title: 'Zip Governance' }],
  ['/admin/seller-management', { Component: LazySellerManagement, title: 'Seller Management' }],
  ['/admin/court-dockets', { Component: LazyCourtDockets, title: 'Court Dockets' }],
  ['/admin/seasonal-goals', { Component: LazySeasonalGoals, title: 'Seasonal Goals' }],
  ['/admin/friday-battles', { Component: LazyFridayBattles, title: 'Friday Battles' }],
  ['/admin/tournaments', { Component: LazyTournaments, title: 'Tournaments' }],

  // Streaming & Monitoring
  ['/admin/stream-monitor', { Component: LazyStreamMonitor, title: 'Stream Monitor' }],
  ['/admin/officers-live', { Component: LazyLiveOfficersTracker, title: 'Live Officers' }],
  ['/admin/night-watch', { Component: LazyNightWatch, title: 'Night Watch' }],

  // Reports
  ['/admin/reports/weekly', { Component: LazyWeeklyReports, title: 'Weekly Reports' }],
]

// Prefix routes — matched when the path starts with the prefix
// (used for dynamic routes like /admin/cashout/:id)
const prefixRoutes: Array<[string, PhoneAdminRouteEntry]> = [
  ['/admin/cashout/', { Component: LazyCashoutDetail, title: 'Cashout Detail' }],
]

export function getPhoneAdminRoute(pathname: string): PhoneAdminRouteEntry | null {
  for (const [path, entry] of exactRoutes) {
    if (pathname === path) return entry
  }
  for (const [prefix, entry] of prefixRoutes) {
    if (pathname.startsWith(prefix)) return entry
  }
  return null
}
