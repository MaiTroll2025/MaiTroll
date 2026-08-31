import { lazy } from 'react'
import { Database, Shield, RefreshCw, Settings, FileText, AlertTriangle, Phone, Gavel, Trophy, DollarSign, Lock, Zap, MapPin, ShoppingCart, Megaphone, Share2, Image, TrendingUp, PieChart, HeadphonesIcon, Gift, Calendar, Crown, Award, Activity, Coins } from 'lucide-react'

const CustomerServiceDashboard = lazy(() => import('./CustomerServiceDashboard'))

const AdminAdvertisements = lazy(() => import('./AdminAdvertisements'))

const DatabaseBackup = lazy(() => import('./DatabaseBackup'))
const CityControlCenter = lazy(() => import('./CityControlCenter'))
const CacheClear = lazy(() => import('./CacheClear'))
const SystemConfig = lazy(() => import('./SystemConfig'))
const CoinPackPurchasesLedger = lazy(() => import('./CoinPackPurchasesLedger'))
const FeePool = lazy(() => import('./FeePool'))
const StartupExpenseTracker = lazy(() => import('./StartupExpenseTracker'))
const AdminActivity = lazy(() => import('./AdminActivity'))

const UserFormsTab = lazy(() => import('./components/UserFormsTab'))
const AdminErrors = lazy(() => import('./AdminErrors'))
const AdminCallsTab = lazy(() => import('./components/AdminCallsTab'))
const OfficerOperations = lazy(() => import('./OfficerOperations'))
const OfficerPayrollReports = lazy(() => import('./OfficerPayrollReports'))
const ZipGovernanceDashboard = lazy(() => import('./ZipGovernanceDashboard'))
const AdminSupportTicketsPage = lazy(() => import('./AdminSupportTicketsPage'))
const AdminSurveysPage = lazy(() => import('./AdminSurveysPage'))
const CourtDocketsManager = lazy(() => import('./CourtDocketsManager'))
const TournamentManager = lazy(() => import('./components/TournamentManager'))
const WeeklyReportsView = lazy(() => import('./WeeklyReportsView'))
const AdminJailManagement = lazy(() => import('./AdminJailManagement'))
const SeasonalGoals = lazy(() => import('./SeasonalGoals'))
const PayoutBatches = lazy(() => import('./PayoutBatches'))
const FridayBattlesDashboard = lazy(() => import('./FridayBattlesDashboard'))
const LoadLab = lazy(() => import('../../components/admin/LoadLab'))
const AdminCrownRedemptions = lazy(() => import('./AdminCrownRedemptions'))
const SellerManagement = lazy(() => import('./SellerManagement'))
const ExecutiveSecretaries = lazy(() => import('./ExecutiveSecretaries'))
const SupabaseUsageDashboard = lazy(() => import('./SupabaseUsageDashboard'))

export interface AdminRoute {
  id: string
  title: string
  path: string
  component: React.ComponentType<any>
  roles?: string[]
  apiEndpoint?: string
  category?: string
  description?: string
  icon?: React.ReactNode
  tileColor?: string
  tileBgColor?: string
  tileBorderColor?: string
}

export const systemManagementRoutes: AdminRoute[] = [
  {
    id: 'database-backup',
    title: 'Database Backup',
    path: '/admin/system/backup',
    component: DatabaseBackup,
    roles: ['admin'],
    description: 'Create a fresh database backup',
    icon: <Database className="w-5 h-5 text-cyan-200" />,
    tileColor: 'text-cyan-200',
    tileBgColor: 'bg-cyan-500/10',
    tileBorderColor: 'border-cyan-500/30',
    category: 'system'
  },
  {
    id: 'system-errors',
    title: 'System Errors',
    path: '/admin/errors',
    component: AdminErrors,
    roles: ['admin'],
    description: 'View and respond to errors',
    icon: <AlertTriangle className="w-5 h-5 text-yellow-200" />,
    tileColor: 'text-yellow-200',
    tileBgColor: 'bg-yellow-500/10',
    tileBorderColor: 'border-yellow-500/30',
    category: 'system'
  },
  {
    id: 'activity',
    title: 'Activity',
    path: '/admin/activity',
    component: AdminActivity,
    roles: ['admin'],
    description: 'Monitor frontend user activity by page, user, errors, and actions',
    icon: <Activity className="w-5 h-5 text-cyan-200" />,
    tileColor: 'text-cyan-200',
    tileBgColor: 'bg-cyan-500/10',
    tileBorderColor: 'border-cyan-500/30',
    category: 'system'
  },
  {
    id: 'system-health',
    title: 'System Health',
    path: '/admin/system/health',
    component: CityControlCenter,
    roles: ['admin'],
    description: 'Check core service statuses',
    icon: <Shield className="w-5 h-5 text-green-200" />,
    tileColor: 'text-green-200',
    tileBgColor: 'bg-emerald-500/10',
    tileBorderColor: 'border-emerald-500/30',
    category: 'system'
  },
  {
    id: 'supabase-usage-dashboard',
    title: 'Supabase Usage',
    path: '/admin/supabase-usage',
    component: SupabaseUsageDashboard,
    roles: ['admin'],
    description: 'Review server-only Supabase usage metrics and estimated monthly cost',
    icon: <TrendingUp className="w-5 h-5 text-cyan-200" />,
    tileColor: 'text-cyan-200',
    tileBgColor: 'bg-cyan-500/10',
    tileBorderColor: 'border-cyan-500/30',
    category: 'system'
  },
  {
    id: 'officer-operations',
    title: 'Officer Operations',
    path: '/admin/officer-operations',
    component: OfficerOperations,
    roles: ['admin'],
    description: 'Manage officer shifts, patrols, and panic alerts',
    icon: <Shield className="w-5 h-5 text-indigo-200" />,
    tileColor: 'text-indigo-200',
    tileBgColor: 'bg-indigo-500/10',
    tileBorderColor: 'border-indigo-500/30',
    category: 'system'
  },
  {
    id: 'weekly-role-perks',
    title: 'Weekly Role Perks',
    path: '/admin/officer-payroll',
    component: OfficerPayrollReports,
    roles: ['admin', 'secretary'],
    description: 'Review weekly role perk payments and manage Treasury allocations',
    icon: <DollarSign className="w-5 h-5 text-emerald-200" />,
    tileColor: 'text-emerald-200',
    tileBgColor: 'bg-emerald-500/10',
    tileBorderColor: 'border-emerald-500/30',
    category: 'economy'
  },
  {
    id: 'coin-purchases-ledger',
    title: 'Coin Purchases Ledger',
    path: '/admin/coinpurchase-ledger',
    component: CoinPackPurchasesLedger,
    roles: ['admin'],
    description: 'View and manage coin pack purchases',
    icon: <TrendingUp className="w-5 h-5 text-green-200" />,
    tileColor: 'text-green-200',
    tileBgColor: 'bg-green-500/10',
    tileBorderColor: 'border-green-500/30',
    category: 'economy'
  },
  {
    id: 'fee-pool',
    title: 'Fee Pool',
    path: '/admin/fee-pool',
    component: FeePool,
    roles: ['admin'],
    description: 'Every platform fee collected across Troll City, with USD value at 100 coins = $1',
    icon: <Coins className="w-5 h-5 text-emerald-200" />,
    tileColor: 'text-emerald-200',
    tileBgColor: 'bg-emerald-500/10',
    tileBorderColor: 'border-emerald-500/30',
    category: 'economy'
  },
  {
    id: 'zip-governance',
    title: 'Zip Governance',
    path: '/admin/zip-governance',
    component: ZipGovernanceDashboard,
    roles: ['admin'],
    description: 'Manage zip jurisdictions and officer hierarchy',
    icon: <MapPin className="w-5 h-5 text-amber-200" />,
    tileColor: 'text-amber-200',
    tileBgColor: 'bg-amber-500/10',
    tileBorderColor: 'border-amber-500/30',
    category: 'system'
  },
  {
    id: 'advertisements',
    title: 'Advertisements',
    path: '/admin/advertisements',
    component: AdminAdvertisements,
    roles: ['admin', 'secretary'],
    description: 'Manage user submitted advertisements',
    icon: <Megaphone className="w-5 h-5 text-purple-200" />,
    tileColor: 'text-purple-200',
    tileBgColor: 'bg-purple-500/10',
    tileBorderColor: 'border-purple-500/30',
    category: 'economy'
  },

  {
    id: 'cache-clear',
    title: 'Cache Clear',
    path: '/admin/system/cache',
    component: CacheClear,
    roles: ['admin'],
    description: 'Flush caches and temporary storage',
    icon: <RefreshCw className="w-5 h-5 text-amber-200" />,
    tileColor: 'text-amber-200',
    tileBgColor: 'bg-amber-500/10',
    tileBorderColor: 'border-amber-500/30',
    category: 'system'
  },
  {
    id: 'load-lab',
    title: '100k Load Lab',
    path: '/admin/load-lab',
    component: LoadLab,
    roles: ['admin'],
    description: 'Stress test the UI with simulated 100k traffic',
    icon: <Zap className="w-5 h-5 text-yellow-400" />,
    tileColor: 'text-yellow-400',
    tileBgColor: 'bg-yellow-500/10',
    tileBorderColor: 'border-yellow-500/30',
    category: 'system'
  },
  {
    id: 'system-config',
    title: 'System Config',
    path: '/admin/system/config',
    component: SystemConfig,
    roles: ['admin'],
    description: 'Edit global platform settings',
    icon: <Settings className="w-5 h-5 text-purple-200" />,
    tileColor: 'text-purple-200',
    tileBgColor: 'bg-purple-500/10',
    tileBorderColor: 'border-purple-500/30',
    category: 'system'
  },

  {
    id: 'user-forms',
    title: 'User Forms',
    path: '/admin/users/forms',
    component: UserFormsTab,
    roles: ['admin'],
    description: 'Track and prompt user forms',
    icon: <FileText className="w-5 h-5 text-blue-200" />,
    tileColor: 'text-blue-200',
    tileBgColor: 'bg-blue-500/10',
    tileBorderColor: 'border-amber-500/30',
    category: 'users'
  },
  {
    id: 'calls',
    title: 'Calls',
    path: '/admin/calls',
    component: AdminCallsTab,
    roles: ['admin'],
    description: 'View and audit user calls',
    icon: <Phone className="w-5 h-5 text-yellow-200" />,
    tileColor: 'text-yellow-200',
    tileBgColor: 'bg-yellow-500/10',
    tileBorderColor: 'border-yellow-500/30',
    category: 'system'
  },
  {
    id: 'support-tickets',
    title: 'Support Tickets',
    path: '/admin/support-tickets',
    component: AdminSupportTicketsPage,
    roles: ['admin'],
    description: 'Manage user support requests',
    icon: <FileText className="w-5 h-5 text-purple-200" />,
    tileColor: 'text-purple-200',
    tileBgColor: 'bg-purple-500/10',
    tileBorderColor: 'border-purple-500/30',
    category: 'support'
  },
  {
    id: 'surveys',
    title: 'Surveys',
    path: '/admin/surveys',
    component: AdminSurveysPage,
    roles: ['admin'],
    description: 'Manage weekly user surveys and view responses',
    icon: <FileText className="w-5 h-5 text-pink-200" />,
    tileColor: 'text-pink-200',
    tileBgColor: 'bg-pink-500/10',
    tileBorderColor: 'border-pink-500/30',
    category: 'support'
  },
  {
    id: 'customer-service',
    title: 'Customer Service',
    path: '/admin/customer-service',
    component: CustomerServiceDashboard,
    roles: ['admin'],
    description: 'Admin support dashboard — user management, password reset, screen share',
    icon: <HeadphonesIcon className="w-5 h-5 text-cyan-200" />,
    tileColor: 'text-cyan-200',
    tileBgColor: 'bg-cyan-500/10',
    tileBorderColor: 'border-cyan-500/30',
    category: 'support'
  },
  {
    id: 'seller-management',
    title: 'Seller Management',
    path: '/admin/seller-management',
    component: SellerManagement,
    roles: ['admin'],
    description: 'Manage seller tiers, reviews, and performance',
    icon: <ShoppingCart className="w-5 h-5 text-orange-200" />,
    tileColor: 'text-orange-200',
    tileBgColor: 'bg-orange-500/10',
    tileBorderColor: 'border-orange-500/30',
    category: 'economy'
  },
  {
    id: 'court-dockets',
    title: 'Court Dockets',
    path: '/admin/court-dockets',
    component: CourtDocketsManager,
    roles: [], // Any authenticated user; RequireRole still blocks public access
    description: 'View court dockets and cases',
    icon: <Gavel className="w-5 h-5 text-red-200" />,
    tileColor: 'text-red-200',
    tileBgColor: 'bg-red-500/10',
    tileBorderColor: 'border-red-500/30',
    category: 'moderation'
  },
  {
    id: 'seasonal-goals',
    title: 'Seasonal Goals',
    path: '/admin/seasonal-goals',
    component: SeasonalGoals,
    roles: ['admin'],
    description: 'Manage creator seasons and tasks',
    icon: <Trophy className="w-5 h-5 text-yellow-400" />,
    tileColor: 'text-yellow-400',
    tileBgColor: 'bg-yellow-500/10',
    tileBorderColor: 'border-yellow-500/30',
    category: 'events'
  },
  {
    id: 'payout-batches',
    title: 'Payout Batches',
    path: '/admin/payout-batches',
    component: PayoutBatches,
    roles: ['admin', 'secretary'],
    description: 'Manage payout batches',
    icon: <DollarSign className="w-5 h-5 text-green-400" />,
    tileColor: 'text-green-400',
    tileBgColor: 'bg-green-500/10',
    tileBorderColor: 'border-green-500/30',
    category: 'economy'
  },
  {
    id: 'jail-management',
    title: 'Jail Management',
    path: '/admin/jail-management',
    component: AdminJailManagement,
    roles: ['admin', 'troll_officer', 'lead_troll_officer'],
    description: 'Monitor and manage current city inmates',
    icon: <Lock className="w-5 h-5 text-red-400" />,
    tileColor: 'text-red-400',
    tileBgColor: 'bg-red-500/10',
    tileBorderColor: 'border-red-500/30',
    category: 'moderation'
  },
  {
    id: 'friday-battles',
    title: 'Friday Battles',
    path: '/admin/friday-battles',
    component: FridayBattlesDashboard,
    roles: ['admin'],
    description: 'View and manage Friday battle bonuses',
    icon: <Gift className="w-5 h-5 text-purple-400" />,
    tileColor: 'text-purple-400',
    tileBgColor: 'bg-purple-500/10',
    tileBorderColor: 'border-purple-500/30',
    category: 'economy'
  },

  {
    id: 'tournaments',
    title: 'Tournaments',
    path: '/admin/tournaments',
    component: TournamentManager,
    roles: ['admin'],
    description: 'Manage universe events and tournaments',
    icon: <Trophy className="w-5 h-5 text-yellow-200" />,
    tileColor: 'text-yellow-200',
    tileBgColor: 'bg-yellow-500/10',
    tileBorderColor: 'border-yellow-500/30',
    category: 'events'
  },

  {
    id: 'weekly-reports',
    title: 'Weekly Reports',
    path: '/admin/reports/weekly',
    component: WeeklyReportsView,
    roles: ['admin', 'secretary', 'lead_troll_officer'],
    description: 'View weekly reports from officers',
    icon: <FileText className="w-5 h-5 text-blue-200" />,
    tileColor: 'text-blue-200',
    tileBgColor: 'bg-blue-500/10',
    tileBorderColor: 'border-blue-500/30',
    category: 'moderation'
  },
  {
    id: 'jail-test-simulator',
    title: 'Jail Test Simulator',
    path: '/admin/jail-test',
    component: AdminJailManagement,
    roles: ['admin'],
    description: 'Test jail system functionality',
    icon: <Lock className="w-5 h-5 text-red-200" />,
    tileColor: 'text-red-200',
    tileBgColor: 'bg-red-500/10',
    tileBorderColor: 'border-red-500/30',
    category: 'moderation'
  },
  {
    id: 'crown-redemptions',
    title: 'Crown Redemptions',
    path: '/admin/crown-redemptions',
    component: AdminCrownRedemptions,
    roles: ['admin'],
    description: 'Review and manage crown redemption requests',
    icon: <Crown className="w-5 h-5 text-amber-300" />,
    tileColor: 'text-amber-300',
    tileBgColor: 'bg-amber-500/10',
    tileBorderColor: 'border-amber-500/30',
    category: 'economy'
  },
  {
    id: 'startup-expense-tracker',
    title: 'Startup Expense Tracker',
    path: '/admin/startup-expense-tracker',
    component: StartupExpenseTracker,
    roles: ['admin'],
    description: 'Track and manage startup expenses',
    icon: <PieChart className="w-5 h-5 text-blue-200" />,
    tileColor: 'text-blue-200',
    tileBgColor: 'bg-blue-500/10',
     tileBorderColor: 'border-blue-500/30',
     category: 'economy'
   },
  {
    id: 'executive-secretaries',
    title: 'Secretary & Founder Rewards',
    path: '/admin/secretary',
    component: ExecutiveSecretaries,
    roles: ['admin', 'secretary', 'executive_secretary', 'troll_city_secretary'],
    description: 'Manage secretary assignments and grant exclusive founder rewards (CEO Fam Badge, Agency Fee Waiver, Early Supporter, Founder Status)',
    icon: <Award className="w-5 h-5 text-amber-200" />,
    tileColor: 'text-amber-200',
    tileBgColor: 'bg-amber-500/10',
    tileBorderColor: 'border-amber-500/30',
    category: 'users'
  }
]
