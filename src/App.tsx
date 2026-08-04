// src/App.tsx
import React, { useEffect, Suspense, useState, useRef } from "react";
import TrollProvider from "./troll/TrollProvider";
import { EffectsProvider } from "./contexts/BroadcastEffectsContext";
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import TreelzPage from "./pages/TreelzPage";
import TreelzUploadPage from "./pages/TreelzUploadPage";
import { useAuthStore } from "./lib/store";
import XtrollzHome from "./pages/xtrollz/XtrollzHome";
import XtrollzRulesPage from "./pages/xtrollz/XtrollzRulesPage";
import XtrollzApplyPage from "./pages/xtrollz/XtrollzApplyPage";
import XtrollzPaymentPage from "./pages/xtrollz/XtrollzPaymentPage";
import XTrollzLiveViewer from "./pages/xtrollz/XtrollzLiveViewer";
import XTrollzBroadcasterStudio from "./pages/xtrollz/XtrollzBroadcasterStudio";
import XtrollzAdminDashboard from "./pages/admin/XtrollzAdminDashboard";
import { GlobalEventProvider } from "./contexts/GlobalEventContext";
import { BatterySaverProvider } from "./contexts/BatterySaverContext";
import { ProfileFrameProvider } from "./contexts/ProfileFrameContext";

import { useEligibilityStore } from "./lib/eligibilityStore";
import { useJailMode } from "./hooks/useJailMode";
import { supabase, UserRole, reportError } from "./lib/supabase";
import { NIGHT_WATCH_PATROL_ROLES } from "./lib/staff";
import { Toaster, toast } from "sonner";
import GlobalLoadingOverlay from "./components/GlobalLoadingOverlay";
import GlobalErrorBanner from "./components/GlobalErrorBanner";
import GlobalGiftBanner from "./components/GlobalGiftBanner";
import BroadcastAnnouncement from "./components/BroadcastAnnouncement";
import GlobalPodBanner from './components/GlobalPodBanner';
import MiniPodcastPlayer from './components/podcast/MiniPodcastPlayer';
import { usePodcastStore } from './stores/podcastStore';
import BugAlertPopup from './components/BugAlertPopup';

import { useBugAlertStore } from "./stores/useBugAlertStore";
import DailyChurchNotification from "./components/church/DailyChurchNotification";
import TeamMeetingNotification from "./components/TeamMeetingRoom/TeamMeetingNotification";
import SurveyNotification from "./components/SurveyNotification";
import GlobalPromoCardListener from "./components/promo/GlobalPromoCardListener";

import { useGlobalApp } from "./contexts/GlobalAppContext";
import { updateRoute } from "./utils/sessionStorage";
import { useDebouncedProfileUpdate } from "./hooks/useDebouncedProfileUpdate";
import { initTimeUpdater } from "./hooks/useGlobalTime";
import { APP_DATA_REFETCH_EVENT_NAME } from "./lib/appEvents";
import { autoUnlockPayouts } from "./lib/supabase";
import { PageVisibilityProvider } from "./contexts/PageVisibilityContext";
import { LiveContentProvider } from "./contexts/LiveContentContext";
import TabSwitchHandler from "./components/TabSwitchHandler";
import { initTelemetry } from "./lib/telemetry";
import GlobalPresenceTracker from "./components/GlobalPresenceTracker";
import ChatBubble from "./components/ChatBubble";
import { useChatStore } from "./lib/chatStore";
import { useUserPresenceRoute } from "./hooks/useUserPresenceRoute";
import { useIsMobile } from "./hooks/useIsMobile";
import { reportBug } from "./lib/bugReporter";
import { lazyWithRetry } from "./utils/lazyImport";

// Animation components
import { AnimationsContainer } from "./components/animations";

// Layout
import OfficerAlertBanner from "./components/OfficerAlertBanner";
import AdminOfficerQuickMenu from "./components/AdminOfficerQuickMenu";
import { PageChannelProvider } from "./contexts/PageChannelContext";
import { StaffWalkieTalkieProvider } from "./components/StaffWalkieTalkieProvider";

import AdminErrors from "./pages/admin/AdminErrors";
import ProfileSetupModal from "./components/ProfileSetupModal";
import RequireRole from "./components/RequireRole";
import { RequireLeadOrOwner } from "./components/auth/RequireLeadOrOwner";
import ErrorBoundary from "./components/ErrorBoundary";
import GrandCityEntrance from "./components/entrance/GrandCityEntrance";
import UnderConstructionPage from "./components/UnderConstructionPage";
import CareersPage from "./pages/CareersPage";

// Agency Pages (lazy-loaded)
const AgenciesPage = lazyWithRetry(() => import("./pages/agencies"));
const CreateAgencyPage = lazyWithRetry(() => import("./pages/agencies/CreateAgencyPage"));
const AgencyProfilePage = lazyWithRetry(() => import("./pages/agency/[agencyId]"));
const AgencyApplyPage = lazyWithRetry(() => import("./pages/agency-apply/[agencyId]"));
const AgencyDashboard = lazyWithRetry(() => import("./pages/agency-dashboard"));
import HytroGamingApply from "./pages/gaming/HytroGamingApply";
import HytroGamingContract from "./pages/gaming/HytroGamingContract";
const AgencyHRDashboard = lazyWithRetry(() => import("./pages/agency-hr-dashboard"));
const AttorneyDashboard = lazyWithRetry(() => import("./pages/attorney/AttorneyDashboard"));
const ProsecutorDashboard = lazyWithRetry(() => import("./pages/prosecutor/ProsecutorDashboard"));
const Support = lazyWithRetry(() => import("./pages/Support"));
const BetaFeedback = lazyWithRetry(() => import("./pages/BetaFeedback"));
const SurveyPage = lazyWithRetry(() => import("./pages/SurveyPage"));
const JailPage = lazyWithRetry(() => import("./pages/JailPage"));
const Safety = lazyWithRetry(() => import("./pages/Safety"));
const AdminRFC = lazyWithRetry(() => import("./components/AdminRFC"));
const AdminEarningsDashboard = lazyWithRetry(() => import("./pages/admin/AdminEarningsDashboard"));
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const AdminPoolPage = lazyWithRetry(() => import("./pages/admin/AdminPoolPage"));
const ApplicationsPage = lazyWithRetry(() => import("./pages/admin/Applications"));
const AdminMarketplace = lazyWithRetry(() => import("./pages/admin/AdminMarketplace"));
const MarketplaceReleaseRequests = lazyWithRetry(() => import("./pages/admin/MarketplaceReleaseRequests"));
const AdminOfficerReports = lazyWithRetry(() => import("./pages/admin/AdminOfficerReports"));
const StoreDebug = lazyWithRetry(() => import("./pages/admin/StoreDebug"));
const Changelog = lazyWithRetry(() => import("./pages/Changelog"));
const HelpPage = lazyWithRetry(() => import("./pages/HelpPage"));
const AccessDenied = lazyWithRetry(() => import("./pages/AccessDenied"));
const ReferralBonusPanel = lazyWithRetry(() => import("./pages/admin/ReferralBonusPanel"));
const SecretaryConsole = lazyWithRetry(() => import("./pages/secretary/SecretaryConsole"));
const CoinLiabilityPage = lazyWithRetry(() => import("./pages/secretary/coin-liability/CoinLiabilityPage"));
const AppealManagement = lazyWithRetry(() => import("./pages/admin/AppealManagement"));
const AdminMeetingsDashboard = lazyWithRetry(() => import("./pages/admin/AdminMeetingsDashboard"));
import { systemManagementRoutes } from "./pages/admin/adminRoutes";
const CEOAssistantDashboard = lazyWithRetry(() => import("./pages/ceo-assistant-dashboard"));
const NoahAssistantDashboard = lazyWithRetry(() => import("./pages/noah-assistant-dashboard"));

const TaxOnboarding = lazyWithRetry(() => import("./pages/TaxOnboarding"));

const EarningsDashboard = lazyWithRetry(() => import("./pages/EarningsDashboard"));
const VerificationPage = lazyWithRetry(() => import("./pages/VerificationPage"));
const VerificationComplete = lazyWithRetry(() => import("./pages/VerificationComplete"));
const PayoutStatus = lazyWithRetry(() => import("./pages/PayoutStatus"));
const PayoutSetupPage = lazyWithRetry(() => import("./pages/PayoutSetupPage"));
const AdminLaunchTrial = lazyWithRetry(() => import("./pages/admin/LaunchTrial"));
const SecurityCommandCenter = lazyWithRetry(() => import("./pages/admin/SecurityCommandCenter"));
const PayoutRequest = lazyWithRetry(() => import("./pages/PayoutRequest"));
const PaymentCallback = lazyWithRetry(() => import("./pages/PaymentCallback"));
const BonusesPage = lazyWithRetry(() => import("./pages/Bonuses"));
const CashoutPage = lazyWithRetry(() => import("./pages/CashoutPage"));
const FastPayApplication = lazyWithRetry(() => import("./pages/FastPayApplication"));
const MaiPayPage = lazyWithRetry(() => import("./pages/MaiPayPage"));

const ShopPartnerPage = lazyWithRetry(() => import("./pages/ShopPartnerPage"));
const ShopEarnings = lazyWithRetry(() => import("./pages/ShopEarnings"));
const PrideShop = lazyWithRetry(() => import("./pages/PrideShop"));
const PrideChallengesPage = lazyWithRetry(() => import("./pages/PrideChallengesPage"));
const NotaryDashboard = lazyWithRetry(() => import("./pages/NotaryDashboard"));


const CreatorOnboarding = lazyWithRetry(() => import("./pages/CreatorOnboarding"));
const CreatorSwitchProgram = lazyWithRetry(() => import("./pages/CreatorSwitchProgram"));
const JoinPage = lazyWithRetry(() => import("./pages/Join"));
const KickFeePage = lazyWithRetry(() => import("./pages/broadcast/KickFeePage"));
const KickFee = lazyWithRetry(() => import("./pages/KickFee"));
const CourtViewerPage = lazyWithRetry(() => import("./pages/CourtViewerPage"));

const Call = lazyWithRetry(() => import("./pages/Call"));
const InterviewPage = lazyWithRetry(() => import("./pages/InterviewPage"));
const Notifications = lazyWithRetry(() => import("./pages/Notifications"));
const HytroGaming = lazyWithRetry(() => import("./pages/gaming/HytroGaming"));
const HytroGamingViewer = lazyWithRetry(() => import("./pages/gaming/HytroGamingViewer"));
const Trollifications = lazyWithRetry(() => import("./pages/Trollifications"));
const Trollifieds = lazyWithRetry(() => import("./pages/Trollifieds"));
const HowToVideosPage = lazyWithRetry(() => import("./pages/JobsHowToPage"));
const JobsPage = lazyWithRetry(() => import("./pages/Jobs"));
const OfficerScheduling = lazyWithRetry(() => import("./pages/OfficerScheduling"));
const PolicyCenter = lazyWithRetry(() => import("./pages/PolicyCenter"));
const UniverseEventPage = lazyWithRetry(() => import("./pages/UniverseEventPage"));
const UniverseBattlesPage = lazyWithRetry(() => import("./pages/UniverseBattlesPage"));
const UniverseLiveArenaPage = lazyWithRetry(() => import("./pages/UniverseLiveArenaPage"));
const UniverseArenaDevPreview = lazyWithRetry(() => import("./pages/UniverseArenaDevPreview"));
const UniverseRegisterPage = lazyWithRetry(() => import("./pages/UniverseRegisterPage"));
const UniverseCalendarPage = lazyWithRetry(() => import("./pages/UniverseCalendarPage"));
const TermsOfServiceLegal = lazyWithRetry(() => import("./pages/legal/TermsOfService"));
const PrivacyPolicyLegal = lazyWithRetry(() => import("./pages/legal/PrivacyPolicy"));
const RefundPolicyLegal = lazyWithRetry(() => import("./pages/legal/RefundPolicy"));
const PayoutPolicyLegal = lazyWithRetry(() => import("./pages/legal/PayoutPolicy"));
const SafetyGuidelinesLegal = lazyWithRetry(() => import("./pages/legal/SafetyGuidelines"));
const CreatorEarnings = lazyWithRetry(() => import("./pages/legal/CreatorEarnings"));
const GamblingDisclosure = lazyWithRetry(() => import("./pages/legal/GamblingDisclosure"));

// SEO Pages (public, indexed by search engines)
const SEOAboutPage = lazyWithRetry(() => import("./pages/seo/AboutPage"));
const SEOContactPage = lazyWithRetry(() => import("./pages/seo/ContactPage"));
const SEOSupportPage = lazyWithRetry(() => import("./pages/seo/SupportPage"));
const SEOFAQPage = lazyWithRetry(() => import("./pages/seo/FAQPage"));
const SEOPrivacyPage = lazyWithRetry(() => import("./pages/seo/PrivacyPage"));
const SEOTermsPage = lazyWithRetry(() => import("./pages/seo/TermsPage"));

const OfficerPayrollDashboard = lazyWithRetry(() => import("./pages/officer/OfficerPayrollDashboard"));
const OfficerDashboard = lazyWithRetry(() => import("./pages/officer/OfficerDashboard"));
const OfficerOWCDashboard = lazyWithRetry(() => import("./pages/OfficerOWCDashboard"));
const OfficerVote = lazyWithRetry(() => import("./pages/OfficerVote"));
const LeadOfficerDashboard = lazyWithRetry(() => import("./pages/lead-officer/LeadOfficerDashboard"));
const EmployeesPage = lazyWithRetry(() => import("./features/employees/EmployeesPage"));
const ReportDetailsPage = lazyWithRetry(() => import("./pages/ReportDetailsPage"));
const PasswordReset = lazyWithRetry(() => import("./pages/PasswordReset"));
const CreditScorePage = lazyWithRetry(() => import("./pages/CreditScorePage"));
const DepartmentToolsPage = lazyWithRetry(() => import("./pages/department-tools/DepartmentToolsPage"));
const CityLawsFeesPage = lazyWithRetry(() => import("./pages/CityLawsFeesPage"));



// Admin pages
const AdminJailManagement = lazyWithRetry(() => import("./pages/admin/AdminJailManagement"));
const RoleManagement = lazyWithRetry(() => import("./pages/admin/RoleManagement"));
const StaffAuditDashboard = lazyWithRetry(() => import("./pages/admin/StaffAuditDashboard"));
const MediaLibrary = lazyWithRetry(() => import("./pages/admin/MediaLibrary"));
const ChatModeration = lazyWithRetry(() => import("./pages/admin/ChatModeration"));
const Announcements = lazyWithRetry(() => import("./pages/admin/Announcements"));
const SendNotifications = lazyWithRetry(() => import("./pages/admin/SendNotifications"));
const ExportData = lazyWithRetry(() => import("./pages/admin/ExportData"));
const UserSearch = lazyWithRetry(() => import("./pages/admin/UserSearch"));
const ReportsQueue = lazyWithRetry(() => import("./pages/admin/ReportsQueue"));
const StreamMonitorPage = lazyWithRetry(() => import("./pages/admin/StreamMonitorPage"));
const NightWatchDashboard = lazyWithRetry(() => import("./pages/admin/NightWatchDashboard"));
const TrotingAdminPage = lazyWithRetry(() => import("./pages/admin/TrotingAdminPage"));
const PaymentLogs = lazyWithRetry(() => import("./pages/admin/PaymentLogs"));
const StorePriceEditor = lazyWithRetry(() => import("./pages/admin/components/StorePriceEditor"));
const AdminFinanceDashboard = lazyWithRetry(() => import("./pages/admin/AdminFinanceDashboard"));
const CreateSchedule = lazyWithRetry(() => import("./pages/admin/CreateSchedule"));
const OfficerShifts = lazyWithRetry(() => import("./pages/admin/OfficerShifts"));


const ReferralBonuses = lazyWithRetry(() => import("./pages/admin/ReferralBonuses"));
const ControlPanel = lazyWithRetry(() => import("./pages/admin/ControlPanel"));
const AdminPageVisibility = lazyWithRetry(() => import("./pages/admin/AdminPageVisibility"));
const ShareAThonLanding = lazyWithRetry(() => import("./pages/shareathon/ShareAThonLanding"));
const ShareAThonSubmit = lazyWithRetry(() => import("./pages/shareathon/ShareAThonSubmit"));
const ShareAThonLeaderboard = lazyWithRetry(() => import("./pages/shareathon/ShareAThonLeaderboard"));
const ShareAThonAdminDashboard = lazyWithRetry(() => import("./pages/shareathon/ShareAThonAdminDashboard"));
const ShareAThonVerification = lazyWithRetry(() => import("./pages/shareathon/ShareAThonVerification"));

 const TestDiagnosticsPage = lazyWithRetry(() => import("./pages/admin/TestDiagnosticsPage"));
const ResetMaintenance = lazyWithRetry(() => import("./pages/admin/ResetMaintenance"));
const Government = lazyWithRetry(() => import("./pages/Government"));
const GovernmentStreams = lazyWithRetry(() => import("./pages/government/GovernmentStreams"));
const MayorDashboard = lazyWithRetry(() => import("./pages/MayorDashboard"));
const TownMeetingPage = lazyWithRetry(() => import("./pages/TownMeetingPage"));
const CityGovernmentPage = lazyWithRetry(() => import("./pages/CityGovernmentPage"));
const GovernmentProposalsPage = lazyWithRetry(() => import("./pages/GovernmentProposalsPage"));
const CityOpeningsPage = lazyWithRetry(() => import("./pages/CityOpeningsPage"));
const CityNewspaperPage = lazyWithRetry(() => import("./pages/CityNewspaperPage"));
const HRCenter = lazyWithRetry(() => import("./pages/HRCenter"));
const UserFormsTab = lazyWithRetry(() => import("./pages/admin/components/UserFormsTab"));
const BucketsDashboard = lazyWithRetry(() => import("./pages/admin/BucketsDashboard"));
const GrantCoins = lazyWithRetry(() => import("./pages/admin/GrantCoins"));
const OfficerOperations = lazyWithRetry(() => import("./pages/admin/OfficerOperations"));
const CreatorSwitchApprovals = lazyWithRetry(() => import("./pages/admin/components/CreatorSwitchApprovals"));
const MobileAdminDashboard = lazyWithRetry(() => import("./pages/admin/MobileAdminDashboard"));
const PaymentsDashboard = lazyWithRetry(() => import("./pages/admin/PaymentsDashboard"));
const EconomyDashboard = lazyWithRetry(() => import("./pages/admin/EconomyDashboard"));
const TaxReviewPanel = lazyWithRetry(() => import("./pages/admin/TaxReviewPanel"));
const TaxUpload = lazyWithRetry(() => import("./pages/TaxUpload"));
const AdminPayoutDashboard = lazyWithRetry(() => import("./pages/admin/components/AdminPayoutDashboard"));
const AdminLiveOfficersTracker = lazyWithRetry(() => import("./pages/admin/AdminLiveOfficersTracker"));
const AdminVerifiedUsers = lazyWithRetry(() => import("./pages/admin/AdminVerifiedUsers"));
const AdminActivity = lazyWithRetry(() => import("./pages/admin/AdminActivity"));
const AdminVerificationReview = lazyWithRetry(() => import("./pages/admin/AdminVerificationReview"));
const CelebVerificationDashboard = lazyWithRetry(() => import("./pages/admin/CelebVerificationDashboard"));
const AdminPoliciesDocs = lazyWithRetry(() => import("./pages/admin/AdminPoliciesDocs"));
const ExecutiveSecretaries = lazyWithRetry(() => import("./pages/admin/ExecutiveSecretaries"));
const ExecutiveReports = lazyWithRetry(() => import("./pages/admin/ExecutiveReports"));
const AdminTrollTownDeeds = lazyWithRetry(() => import("./pages/admin/AdminTrollTownDeeds"));
const TrollmersTournament = lazyWithRetry(() => import("./pages/admin/TrollmersTournament"));
const SupabaseUsageDashboard = lazyWithRetry(() => import("./pages/admin/SupabaseUsageDashboard"));
const StateRankings = lazyWithRetry(() => import("./pages/StateRankings"));
const StateDetail = lazyWithRetry(() => import("./pages/StateDetail"));
import VerifiedBadgePage from "./pages/VerifiedBadgePage";
const TMFamilyInviteHandler = lazyWithRetry(() => import("./components/trollmatch/TMFamilyInviteHandler"));
const EmbedPage = lazyWithRetry(() => import("./pages/broadcast/EmbedPage"));
const HomepageBackgroundShowcase = lazyWithRetry(() => import("./pages/dev/HomepageBackgroundShowcase"));
const BlockedUsers = lazyWithRetry(() => import("./pages/BlockedUsers"));
const CelebEarningsDashboard = lazyWithRetry(() => import("./pages/CelebEarningsDashboard"));
const CelebStreamDiscovery = lazyWithRetry(() => import("./pages/CelebStreamDiscovery"));

const AuthenticatedHome = lazyWithRetry(() => import("./pages/Home"));

// Tromail & UTroMail
const TromailPage = lazyWithRetry(() => import("./pages/tromail/TromailPage"));
const TroMailOfficePage = lazyWithRetry(() => import("./pages/office/TroMailOfficePage"));
const UtromailPage = lazyWithRetry(() => import("./pages/utromail/UtromailPage"));
const UtromailThreadView = lazyWithRetry(() => import("./pages/utromail/UtromailThreadView"));
const UtromailCompose = lazyWithRetry(() => import("./pages/utromail/UtromailCompose"));
const CourseCatalogPage = lazyWithRetry(() => import("./pages/academy/CourseCatalogPage"));
const CourseDetailPage = lazyWithRetry(() => import("./pages/academy/CourseDetailPage"));
const VerifyCertificatePage = lazyWithRetry(() => import("./pages/academy/VerifyCertificatePage"));
const TeacherApplyPage = lazyWithRetry(() => import("./pages/academy/TeacherApplyPage"));
const TeacherDashboardPage = lazyWithRetry(() => import("./pages/academy/TeacherDashboardPage"));
const TeacherCoursePage = lazyWithRetry(() => import("./pages/academy/TeacherCoursePage"));
const AcademyAdmissionsPage = lazyWithRetry(() => import("./pages/academy/AdmissionsDashboardPage"));
const AcademyCertificatesPage = lazyWithRetry(() => import("./pages/academy/AcademyCertificatesPage"));
const AcademyTranscriptPage = lazyWithRetry(() => import("./pages/academy/AcademyTranscriptPage"));
const AcademyCoinsPage = lazyWithRetry(() => import("./pages/academy/AcademyCoinsPage"));
const AcademyClassroomPage = lazyWithRetry(() => import("./pages/academy/AcademyClassroomPage"));
const AcademyAdminPage = lazyWithRetry(() => import("./pages/academy/AcademyAdminPage"));
const AssignmentCreatePage = lazyWithRetry(() => import("./pages/academy/AssignmentCreatePage"));
const AssignmentStudentPage = lazyWithRetry(() => import("./pages/academy/AssignmentStudentPage"));
const AssignmentGradingPage = lazyWithRetry(() => import("./pages/academy/AssignmentGradingPage"));
const AttendancePage = lazyWithRetry(() => import("./pages/academy/AttendancePage"));
const QuizBuilderPage = lazyWithRetry(() => import("./pages/academy/QuizBuilderPage"));
const QuizTakePage = lazyWithRetry(() => import("./pages/academy/QuizTakePage"));
const PathwayDetailPage = lazyWithRetry(() => import("./pages/academy/PathwayDetailPage"));
const LoanServicingPage = lazyWithRetry(() => import("./pages/academy/LoanServicingPage"));
const TeacherRevenuePage = lazyWithRetry(() => import("./pages/academy/TeacherRevenuePage"));
const CommunicationCenterPage = lazyWithRetry(() => import("./pages/academy/CommunicationCenterPage"));
const TranscriptPage = lazyWithRetry(() => import("./pages/academy/TranscriptPage"));
const AccreditationPage = lazyWithRetry(() => import("./pages/academy/AccreditationPage"));
const TeacherManagementPage = lazyWithRetry(() => import("./pages/academy/TeacherManagementPage"));
const TeacherDirectoryPage = lazyWithRetry(() => import("./pages/academy/TeacherDirectoryPage"));
const AssignmentsListPage = lazyWithRetry(() => import("./pages/academy/AssignmentsListPage"));

const LoadingScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0814] text-white">
      <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">
        Loading…
      </div>
    </div>
  );

const isPublicRoute = (pathname: string) => {
  if (pathname === '/' || pathname === '/home') {
    return true
  }

  // Live auctions browse/watch are public — anyone can view
  if (pathname === '/auctions') return true
  if (pathname.startsWith('/auctions/') && !pathname.startsWith('/auctions/studio')) return true

  // SEO pages are public — indexable by search engines
  if (pathname === '/about') return true
  if (pathname === '/contact') return true
  if (pathname === '/support') return true
  if (pathname === '/faq') return true
  if (pathname === '/privacy') return true
  if (pathname === '/terms') return true

  // Legal pages are public
  if (pathname.startsWith('/legal/')) return true

  // Jobs page is public
  if (pathname === '/jobs') return true

  // Careers page is public
  if (pathname === '/careers') return true

  // Profile pages are public - usernames and user IDs
  if (pathname.startsWith('/profile/')) return true

  // Podcast routes are public — anyone can listen without signing in
  if (pathname === '/podcast' || pathname.startsWith('/podcast/')) return true

  // Court routes are public (Agreed access handled by /allowedPaths guard)
  if (pathname === '/court') return true
  if (pathname === '/troll-court') return true
  if (pathname.startsWith('/troll-court/')) return true
  if (pathname.startsWith('/court/')) return true

  // Username-based routes (e.g., /ceo_of_mai) are public profile redirects
  // Must come before broadcast check - route must look like a username (alphanumeric + underscores/hyphens)
  if (/^[a-zA-Z0-9_-]+$/.test(pathname.slice(1))) return true

  // Broadcast/Stream routes - public with password protection (handled by components)
  return (
    (pathname.startsWith('/broadcast/') &&
     !pathname.startsWith('/broadcast/setup') &&
     !pathname.startsWith('/broadcast/summary')) ||
    pathname.startsWith('/watch/') ||
    pathname.startsWith('/live/') ||
    pathname.startsWith('/stream/') ||
    pathname.startsWith('/gaming/watch/')
  )
}

   // 🔐 Route Guard — prevents flash by overlaying loading state instead of unmounting
   const RequireAuth = () => {
     const user = useAuthStore((s) => s.user);
     const profile = useAuthStore((s) => s.profile);
     const isLoading = useAuthStore((s) => s.isLoading);
     const isRefreshing = useAuthStore((s) => s.isRefreshing);
      const { isJailed } = useJailMode(user?.id);
      const xtrollzDobMismatch = useAuthStore((s) => s.xtrollzDobMismatch);
      const location = useLocation();
     
     // Show loading overlay while auth is initializing, but keep children mounted behind it
       if (isLoading) {
         return (
           <>
             <div className="fixed inset-0 flex items-center justify-center bg-[#0A0814] z-[100]">
               <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">
                 Loading…
               </div>
             </div>
             <div style={{ visibility: 'hidden' }}>
               <Outlet />
             </div>
           </>
         );
       }

     if (!user && !isPublicRoute(location.pathname)) return <Navigate to="/auth" replace />;

    // 🚔 Jail Guard - Exempt admins from jail redirect so they can manage the system
    const isAdminUser = profile?.role === UserRole.ADMIN || profile?.is_admin === true || (profile as any)?.role === 'superadmin';
    const onCourtSummary = location.pathname.startsWith('/court/') && location.pathname.endsWith('/summary');
    if (isJailed && !isAdminUser && location.pathname !== "/jail" && !onCourtSummary) {
      return <Navigate to="/jail" replace />;
    }
    
    // If we have a user but no profile, and we are not loading, it means the profile row is missing.
    // We must redirect to setup to create one.
     if (!profile && location.pathname !== "/profile/setup") {
       if (isLoading) {
         // Add a timeout to prevent infinite loading
         setTimeout(() => {
           if (useAuthStore.getState().isLoading) {
             console.warn('[App] Force clearing loading state after timeout');
             useAuthStore.getState().setLoading(false);
           }
         }, 15000); // 15 second timeout
          // Show overlay while keeping Outlet mounted invisibly
          return (
            <>
              <div className="fixed inset-0 flex items-center justify-center bg-[#0A0814] z-[100]">
                <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">
                  Loading…
                </div>
              </div>
              <div style={{ visibility: 'hidden' }}>
                <Outlet />
              </div>
            </>
          );
       }
       return <Outlet />;
     }
    
    // Do not force profile editing after login. Missing usernames are handled inside profile surfaces.
    
 if (
      profile &&
      profile?.application_required &&
      !profile?.application_submitted &&
      location.pathname !== "/apply"
    ) {
      return <Navigate to="/apply" replace />;
    }

    if (xtrollzDobMismatch && location.pathname !== '/xtrollz/apply') {
      return <Navigate to="/xtrollz/apply" replace />;
    }

    // Neighborhood setup guard - redirect users without neighborhood_id to setup
    if (
      profile &&
      !profile?.neighborhood_id &&
      (location.pathname === "/map" || location.pathname === "/neighborhood-map") &&
      !isPublicRoute(location.pathname)
    ) {
      return <Navigate to="/neighborhood-setup" replace />;
    }

    return (
        <>
          
          <Outlet />
        </>
      );
  };

  // 🔒 Internal Route Guard — prevents direct URL access to pages that should only be reached via internal navigation
  // Pages like /exit, /stream-ended, /broadcast/summary should not be accessible by typing the URL directly
  const INTERNAL_ONLY_PATHS = ['/exit', '/stream-ended']

  const RequireInternalNavigation = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation()
    const navigate = useNavigate()

    React.useEffect(() => {
      // Check if the page was reached via internal navigation (has navigation state)
      // or if it was a direct URL entry / external link (no state, referrer is external)
      const navState = location.state
      const hasDocumentReferrer = document.referrer && document.referrer.includes(window.location.hostname)

      // Allow access if: has navigation state from React Router, or has a document referrer from same origin
      // Block if: direct URL entry with no state and no same-origin referrer
      if (!navState && !hasDocumentReferrer && INTERNAL_ONLY_PATHS.includes(location.pathname)) {
        console.warn(`[Route Guard] Blocked direct access to ${location.pathname}`)
        navigate('/', { replace: true })
      }
    }, [location.pathname, navigate])

    return <>{children}</>
  }

import { useSidebarStore } from './stores/useSidebarStore';
import TCNNMainPage from "./pages/tcnn/TCNNMainPage.js";
import ArticleReader from "./pages/tcnn/ArticleReader.js";
import TCNNInternalDashboard from "./pages/tcnn/TCNNInternalDashboard.js";
import TCNNSetupPage from "./pages/tcnn/TCNNSetupPage.js";
import TCNNViewerPage from "./pages/tcnn/TCNNViewerPage.js";
import TCNNBroadcasterPage from "./pages/tcnn/TCNNBroadcasterPage.js";
import ShopView from "./pages/ShopView.js";
import InmatesPage from "./pages/InmatesPage.js";
import JailAppealPage from "./pages/JailAppealPage.js";
import ProfileSetup from "./pages/ProfileSetup.js";
import Profile from "./pages/Profile.js";
import MapPage from "./pages/MapPage.js";
import NeighborhoodMapHub from "./pages/NeighborhoodMapHub.js";
import InsurancePage from "./pages/InsurancePage.js";
import NeighborhoodOnboarding from "./pages/NeighborhoodOnboarding.js";
import DriverTest from "./pages/DriverTest.js";
import AdminManualOrders from "./pages/admin/AdminManualOrders.js";
import OfficerManager from "./pages/admin/OfficerManager.js";
import ThemePreviewPage from "./pages/dev/ThemePreviewPage.js";
import ExecutiveIntake from "./pages/admin/ExecutiveIntake.js";
import AdminCashoutDetailPage from "./pages/admin/CashoutDetailPage.js";
import CashoutManager from "./pages/admin/CashoutManager.js";
import CourtRoom from "./pages/CourtRoom.js";
import CourtSummary from "./pages/CourtSummary.js";
import TeamMeetingRoom from "./pages/TeamMeetingRoom";
import CoinsComplete from "./pages/CoinsComplete.js";

import StatsPage from "./pages/Stats";
import Auth from "./pages/Auth.js";
import AuthCallback from "./pages/AuthCallback.js";
import ExitPage from "./pages/ExitPage.js";
import FoundingOfficerTrial from "./pages/FoundingOfficerTrial.js";
import AppLayout from "./components/layout/AppLayout.js";
import ExploreFeed from "./pages/ExploreFeed.js";
import HighBcastersPage from "./pages/HighBcasters";
import ExploreSearchResults from "./pages/ExploreSearchResults.js";
import StreamSwipePage from "./pages/StreamSwipePage.js";
import ApplicationPage from "./pages/ApplicationPage.js";
import JobsApplicationPage from "./pages/ApplicationPage.js";
import JobsStatusPage from "./pages/Jobs.tsx";
import SetupPage from "./pages/broadcast/SetupPage.js";
import GamingSetupPage from "./pages/broadcast/GamingSetupPage.tsx";
import GamingAnalytics from "./pages/broadcast/gaming/GamingAnalytics.tsx";
import GamingCommunity from "./pages/broadcast/gaming/GamingCommunity.tsx";
import GamingMonetization from "./pages/broadcast/gaming/GamingMonetization.tsx";
import GamingStore from "./pages/broadcast/gaming/GamingStore.tsx";
import BroadcastRouter from "./pages/broadcast/BroadcastRouter.js";
import StreamSummary from "./pages/broadcast/StreamSummary.js";
import ReplayPage from "./pages/broadcast/ReplayPage.tsx";
import PresidentPage from "./pages/President.js";
import PresidentDashboard from "./pages/president/PresidentDashboard.js";
import SecretaryDashboard from "./pages/president/SecretaryDashboard.js";
import TreasuryDashboard from "./pages/TreasuryDashboard";
import MatchPage from "./pages/MatchPage";
import CityRegistry from "./pages/CityRegistry";
import AdvertisePage from "./pages/city-registry/AdvertisePage";
import Following from "./pages/Following";
import PublicPool from "./pages/PublicPool";
import GiveawaysPage from "./pages/GiveawaysPage";
import TrollWheel from "./pages/TrollWheel";
import CarDealership from "./pages/CarDealership";
const GaragePage = lazyWithRetry(() => import("./pages/GaragePage"));
const VehicleTransactionsPage = lazyWithRetry(() => import("./pages/VehicleTransactionsPage"));
import UserInventory from "./pages/UserInventory";
import Troting from "./pages/Troting";
import ProfileSettings from "./pages/ProfileSettings";
import DeleteAccount from "./pages/DeleteAccount";
import TrollBank from "./pages/TrollBank";
import Leaderboard from "./pages/Leaderboard";
import WallPage from "./pages/WallPage";
import WallPostPage from "./pages/WallPostPage";
import LivingPage from "./pages/UnderConstructionPage";
import ChurchPage from "./pages/ChurchPage";
import PastorDashboard from "./pages/church/PastorDashboard";
const ChurchLivePage = lazyWithRetry(() => import("./pages/church/ChurchLivePage.tsx"));
import LiveCommandCenter from "./pages/live/LiveCommandCenter";
import LiveStreamOverlay from "./pages/live/LiveStreamOverlay";
import AudioSettings from "./pages/live/AudioSettings.js";
import TrollCourt from "./pages/TrollCourt.js";
import AuctionsPage from "./pages/AuctionsPage.js";
import SearchPage from "./pages/SearchPage.tsx";
import PodcastCentral from "./pages/PodcastCentral.js";
import PodcastRoom from "./pages/PodcastRoom.js";
import AuctionStudio from "./pages/auction/AuctionStudio.js";
import AuctionStudioLots from "./pages/auction/AuctionStudioLots.js";
import AuctioneerDashboard from "./pages/auction/AuctioneerDashboard.js";
import MyAuctionShows from "./pages/auction/MyAuctionShows.js";
import AuctionReports from "./pages/auction/AuctionReports.js";
import AdminAuctionApps from "./pages/auction/AdminAuctionApps.js";
import LiveAuctionRoom from "./pages/auction/LiveAuctionRoom.js";
import AuctionWon from "./pages/auction/AuctionWon.js";
import AuctionBidders from "./pages/auction/AuctionBidders.js";
import AuctionSales from "./pages/auction/AuctionSales.js";
import AuctionAnalytics from "./pages/auction/AuctionAnalytics.js";
import AuctionSettings from "./pages/auction/AuctionSettings.js";
import AuctionInventory from "./pages/auction/AuctionInventory.js";
import AuctionOrderManagement from "./pages/auction/AuctionOrderManagement.js";
import PackingStation from "./pages/auction/PackingStation.js";
import DeviceManagement from "./pages/auction/DeviceManagement.js";
import AuctioneerScanner from "./pages/auction/AuctioneerScanner.js";
import AuctionApp from "./pages/auction/AuctionApp.js";
import CoinStore from "./pages/CoinStore.jsx";
import ProfileFrameStore from "./pages/ProfileFrameStore";
import SellOnTrollCity from "./pages/SellOnTrollCity";
import SellerOrders from "./pages/SellerOrders.js";
import MyOrders from "./pages/MyOrders.js";
import FamilyBrowse from "./pages/FamilyBrowse.js";
import TrollFamilyCity from "./pages/TrollFamilyCity.js";
import FamilyProfilePage from "./pages/FamilyProfilePage.js";
import FamilyChatPage from "./pages/FamilyChatPage.js";
import FamilyWarsPage from "./pages/FamilyChatPage.js";
import TrollFamilyHome from "./pages/TrollFamilyHome.js";
import FamilyWarsHub from "./pages/FamilyWarsHub.js";
import FamilyLeaderboard from "./pages/FamilyLeaderboard.js";
import FamilyShop from "./pages/FamilyShop.js";
import TrollOfficerLounge from "./pages/TrollOfficerLounge.js";
import OfficerModeration from "./pages/OfficerModeration.js";
import HomeNotificationPrompt from "./components/HomeNotificationPrompt.js";
import { GhostDropInProvider } from "./context/GhostDropInContext";
import GhostBanner from "./components/home/GhostBanner";
import RTCAdminMonitor from "./components/admin/RTCAdminMonitor.tsx";


function AppContent() {
  // Lightweight render counter (dev only)
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    const w = window as any;
    w.__tc_app_renders = (w.__tc_app_renders || 0) + 1;
    if (w.__tc_app_renders % 50 === 0) {
      console.debug('[App] render count', w.__tc_app_renders);
    }
  }

  // Use granular selectors to prevent unnecessary re-renders
  // Only re-render when these specific values change
  const userId = useAuthStore((s) => s.user?.id);
  const user = useAuthStore((s) => s.user); // Keep full user object for components that need it
  const userRole = useAuthStore((s) => s.profile?.role);
  const isAdmin = useAuthStore((s) => s.profile?.is_admin);
  const isLeadOfficer = useAuthStore((s) => s.profile?.is_lead_officer);
  const isTrollOfficer = useAuthStore((s) => s.profile?.is_troll_officer);
  const isPastor = useAuthStore((s) => s.profile?.is_pastor);
  const isJailed = useAuthStore((s) => (s.profile as any)?.is_jailed);
  const isBanned = useAuthStore((s) => s.profile?.is_banned);
  const isKicked = useAuthStore((s) => s.profile?.is_kicked);
  const hasActiveWarrant = useAuthStore((s) => s.profile?.has_active_warrant);
  const username = useAuthStore((s) => s.profile?.username);
  const profileRole = useAuthStore((s) => s.profile?.role);

  // Some legacy logic needs the full profile object in several effects
  const profile = useAuthStore((s) => s.profile);

  // Track user route presence for Customer Service dashboard
  useUserPresenceRoute();

  const { expandGroup } = useSidebarStore();


  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalLoading] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { isMobile, isMobileWidth } = useIsMobile();
  const isMobileUI = isMobileWidth || isStandalone;
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingServiceWorker, setWaitingServiceWorker] = useState<ServiceWorker | null>(null);
  const [initialProfileLoaded, setInitialProfileLoaded] = useState(false);
  const [activeMeetingNotification, setActiveMeetingNotification] = useState<{
    meetingId: string;
    meetingTitle: string;
  } | null>(null);
  const userIdRef = useRef<string | null>(null);
  const hasNavigatedRef = useRef(false);
  const lastVisibilityRefreshRef = useRef(0);


  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const eligibilityRefresh = useEligibilityStore((s) => s.refresh);

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOffline = () => {
      toast.error('You are offline', { duration: 4000 })
    }

    const handleOnline = () => {
      toast.success('Back online', { duration: 2500 })
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  // Global app context for loading and error states
  const {
    isLoading: globalLoading,
    loadingMessage,
    error,
    retryLastAction,
    isReconnecting,
    reconnectMessage,
  } = useGlobalApp();

  // Initial profile load
  useEffect(() => {
    if (userId && !initialProfileLoaded && userIdRef.current !== userId) {
      console.log(`Found user, refreshing profile ${userId}`);
      refreshProfile();
      eligibilityRefresh(userId);
      setInitialProfileLoaded(true);
      userIdRef.current = userId;
    }
  }, [userId, initialProfileLoaded, refreshProfile, eligibilityRefresh]);

  // Handle Service Worker navigation requests (e.g. from push notifications)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && event.data.url) {
        console.log('[App] Received NAVIGATE from SW:', event.data.url);
        navigate(event.data.url);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [navigate]);

  // Global unhandled rejection handler for AuthApiError
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Check if the error is related to "Invalid Refresh Token" or similar auth errors
      const reason = event.reason;
      const message = reason?.message || reason?.error_description || '';
      
      if (
        message.includes('Invalid Refresh Token') ||
        message.includes('Refresh Token Not Found')
      ) {
        console.warn('Caught invalid refresh token error, attempting recovery...');
        event.preventDefault(); // Prevent default console error
        
        // Don't immediately logout - attempt session recovery first
        // The background refresh hook will handle logout if recovery truly fails
        supabase.auth.getSession().then(({ data }) => {
          if (!data.session?.access_token) {
            // Try refreshing once before giving up
            supabase.auth.refreshSession().then(({ data: refreshData }) => {
              if (!refreshData.session?.access_token) {
                console.warn('Session recovery failed, signing out...')
                useAuthStore.getState().logout()
                window.location.href = '/auth'
              }
            }).catch(() => {
              useAuthStore.getState().logout()
              window.location.href = '/auth'
            })
          }
        })
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Bug Alert real-time subscription for admins
  useEffect(() => {
    const { subscribeToRealtime, unsubscribeFromRealtime, fetchAlerts } = useBugAlertStore.getState();
    
    // Only set up subscription if user is admin
    if (userId && userRole === 'admin') {
      console.log('[BugAlert] Admin detected, setting up real-time subscription');
      
      // Subscribe to real-time bug alerts
      subscribeToRealtime(userId, true);
      
      // Fetch initial alerts
      fetchAlerts({ status: 'active' });
    }
    
    // Cleanup on unmount
    return () => {
      unsubscribeFromRealtime();
    };
  }, [userId, userRole]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      ((window.navigator as any).standalone === true);
    setIsStandalone(standalone);
  }, []);

  // Warrant Access Restriction
  useEffect(() => {
    if (!hasNavigatedRef.current && profile?.has_active_warrant) {
       // Allow access to court pages, auth pages, and static assets
       const allowedPaths = ['/troll-court', '/court', '/auth', '/legal', '/support'];
       const isAllowed = allowedPaths.some(path => location.pathname.startsWith(path));
       
       if (!isAllowed) {
         hasNavigatedRef.current = true;
         toast.error("Active Warrant Issued! You must appear in Troll Court.");
         navigate('/troll-court');
       }
    }
  }, [profile?.has_active_warrant, location.pathname, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const handleUpdateAvailable = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const waiting = registration?.waiting;
        if (waiting) {
          setWaitingServiceWorker(waiting);
          setUpdateAvailable(true);
        }
      } catch {}
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  // Show update toast when update is available
  useEffect(() => {
    if (!updateAvailable || !waitingServiceWorker) return;

    // Don't auto-reload - let user click the toast action to update
    // This prevents infinite reload loops in PWA mode
    if (isStandalone) {
      toast.info("New update available!", {
        duration: Infinity,
        description: "A new version of Mai Troll is available.",
        action: {
          label: "Update Now",
          onClick: () => {
            waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }
        },
        onDismiss: () => {}
      });
      return;
    }

    toast.info("New update available!", {
      duration: Infinity,
      description: "A new version of Mai Troll is available.",
      action: {
        label: "Update Now",
        onClick: () => {
          waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      },
      onDismiss: () => {}
    });
  }, [updateAvailable, waitingServiceWorker, isStandalone]);

  useEffect(() => {
    if (hasNavigatedRef.current) return;
    if (!userId || !isStandalone) return;
    // Mobile UI is now activated automatically for PWA standalone.
  }, [userId, isStandalone, location.pathname, navigate]);

  // Track route changes for session persistence
  useEffect(() => {
    updateRoute(location.pathname);
  }, [location.pathname]);

  // Check payouts unlock on mount
  useEffect(() => {
    void autoUnlockPayouts();
  }, []);

  // 🔹 Auto-routing after approval (only on landing page, not on every route change)
  useEffect(() => {
    // Only auto-route from landing page (/) - never redirect from other pages
    if (hasNavigatedRef.current) return;
    if (location.pathname !== '/') {
      return;
    }

    // Don't redirect if user is not logged in
    if (!userId || !profile) {
      return;
    }

    hasNavigatedRef.current = true;

    // Redirect to family home if troll_family role, otherwise stay on /
    // Note: /home redirects back to /, so we avoid that loop by staying on /
    if (profileRole === 'troll_family') {
      navigate('/family/home', { replace: true });
    }
    // For all other roles, stay on / (the homepage) — no redirect needed
  }, [location.pathname, userId, profile, profileRole, navigate]);


  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      // Ignore if user is typing in an input/textarea/contentEditable
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // 'd' -> District Tour
      if (event.key === 'd' || event.key === 'D') {
        navigate('/district/main_plaza', { replace: true })
        return
      }

      // 'a' -> Admin Dashboard
      if ((event.key === 'a' || event.key === 'A') && (profile?.role === 'admin' || profile?.is_admin)) {
        navigate('/admin', { replace: true })
        return
      }

      // 't' -> Employees Office (officer / lead officer)
      if (event.key === 't' || event.key === 'T') {
        if (profile?.is_lead_officer || profile?.is_troll_officer) {
          navigate('/Employees', { replace: true })
          return
        }
      }

      // 's' -> Employees Office (secretary)
      if ((event.key === 's' || event.key === 'S') && profile?.role === 'secretary') {
        navigate('/Employees', { replace: true })
        return
      }

      // 'p' -> Pastor Dashboard
      if ((event.key === 'p' || event.key === 'P') && profile?.is_pastor) {
        navigate('/church/pastor', { replace: true })
        return
      }

      // 'v' -> Toggle Voice Notifications (Admin Only)
      if ((event.key === 'v' || event.key === 'V') && (profile?.role === 'admin' || profile?.is_admin)) {
        const currentState = localStorage.getItem('voiceNotificationsEnabled') === 'true';
        const newState = !currentState;
        localStorage.setItem('voiceNotificationsEnabled', String(newState));
        
        // Dispatch event for hook to listen
        const event_toggle = new CustomEvent('toggleVoiceNotifications', {
          detail: { enabled: newState }
        });
        window.dispatchEvent(event_toggle);
        
        // Show feedback
        toast[newState ? 'success' : 'info'](
          newState ? '🔊 Voice Notifications: ACTIVE' : '🔇 Voice Notifications: INACTIVE'
        );
        return
      }

      // General navigation shortcuts
      if (event.key === 'c' || event.key === 'C') {
        navigate('/city-hall');
        expandGroup('City Center');
        return;
      }
      if (event.key === 'p' || event.key === 'P') {
        navigate('/pool');
        expandGroup('Social');
        return;
      }
      if (event.key === 's' || event.key === 'S') {
        navigate('/marketplace');
        expandGroup('City Center');
        return;
      }
      if (event.key === 'g' || event.key === 'G') {
        navigate('/government');
        expandGroup('Government Sector');
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        navigate('/city-registry');
        expandGroup('City Registry');
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigate, profile, expandGroup])

  // 🔹 Check if user is kicked or banned and route to fee pages
  useEffect(() => {
    if (!profile) return;

    if (profile.is_banned && location.pathname !== '/jail' && location.pathname !== '/jail/appeal') {
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        navigate('/jail', { replace: true });
      }
      return;
    }

    if (profile.is_kicked && location.pathname !== '/kick-fee') {
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        navigate('/kick-fee', { replace: true });
      }
    }
  }, [profile, location.pathname, navigate]);

  // 🔹 Global arrest handler - monitor jail table for real-time arrests
  // Uses a single stable channel per user — only depends on user.id, not location
  useEffect(() => {
    if (!user?.id || !profile) return;

    let channel: any = null;
    let isCleanedUp = false;

    const setupArrestMonitoring = async () => {
      // Check if user is currently jailed (for direct URL access)
      const checkJailStatus = async () => {
        const { data } = await supabase
          .from('jail')
          .select('id, reason, severity, bond_amount, arrested_by, release_time, bond_posted')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && !data.bond_posted) {
          const releaseTime = new Date(data.release_time);
          if (releaseTime > new Date() && !isCleanedUp) {
            navigate('/jail', { replace: true });
            return true;
          }
        }
        return false;
      };

      const isAlreadyJailed = await checkJailStatus();
      if (isAlreadyJailed || isCleanedUp) return;

      // Single stable channel per user — no location dependency
      channel = supabase
        .channel(`app-arrests:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'jail',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (isCleanedUp) return;
            const data = (payload as any).new;
            if (data && data.user_id === user.id) {
              const releaseTime = new Date(data.release_time);
              if (releaseTime > new Date()) {
                toast.error(`🚔 ARRESTED: ${data.reason || 'Violation of Mai Troll rules'}`, { duration: 5000 });
                const onCourtSummary =
                  location.pathname.startsWith('/court/') && location.pathname.endsWith('/summary');
                if (!onCourtSummary) {
                  navigate('/jail', { replace: true });
                }
              }
            }
          }
        )
        .subscribe();
    };

    setupArrestMonitoring();

    return () => {
      isCleanedUp = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, profile, navigate]);

  // 🔹 Track user IP address and check for IP bans
  useEffect(() => {
    const controller = new AbortController()

    const trackIP = async () => {
      if (!userId) return

      try {
        // Get user's IP address with timeout
        const ipResponse = await fetch('https://api.ipify.org?format=json', {
            signal: controller.signal
        })
        const ipData = await ipResponse.json()
        const userIP = ipData.ip

        if (controller.signal.aborted) return

        // Check if IP is banned
        const { data: isBanned, error: banError } = await supabase.rpc('is_ip_banned', {
          p_ip_address: userIP
        })

        if (banError) {
          // Ignore abort/timeout errors from Supabase
          if (
            banError.message?.includes('AbortError') || 
            banError.details?.includes('AbortError') ||
            banError.message?.includes('timeout')
          ) {
            return
          }
          console.error('Error checking IP ban:', banError)
          return
        }

        if (isBanned) {
          if (controller.signal.aborted) return
          toast.error('Your IP address has been banned. Please contact support.')
          // Sign out user (defensive)
          try {
            const { data: sessionData } = await supabase.auth.getSession()
            const hasSession = !!sessionData?.session
            if (hasSession) {
              const { error } = await supabase.auth.signOut()
              if (error) console.warn('supabase.signOut returned error:', error)
            } else {
              console.debug('No active session; skipping supabase.auth.signOut()')
            }
          } catch (innerErr) {
            console.warn('Error during sign-out (ignored):', innerErr)
          }

          useAuthStore.getState().logout()
          navigate('/auth', { replace: true })
          return
        }

        if (controller.signal.aborted) return

        // Update user's last known IP
        const { data: currentProfile } = await supabase
          .from('user_profiles')
          .select('ip_address_history')
          .eq('id', userId)
          .maybeSingle()

        const ipHistory = currentProfile?.ip_address_history || []
        const newIPEntry = {
          ip: userIP,
          timestamp: new Date().toISOString()
        }

        // Add to history if not already present
        const updatedHistory = [...ipHistory, newIPEntry].slice(-10) // Keep last 10 IPs

        await supabase
          .from('user_profiles')
          .update({
            last_known_ip: userIP,
            ip_address_history: updatedHistory
          })
          .eq('id', userId)
      } catch (error: any) {
        // Ignore abort errors
        if (error.name === 'AbortError' || error.message?.includes('AbortError')) return
        console.error('Error tracking IP:', error)
      }
    }

    if (userId) {
      trackIP()
    }

    return () => {
        controller.abort()
    }
  }, [userId, navigate])

  // 🔹 Check Daily Login for XP
  useEffect(() => {
    if (userId) {
      const checkLogin = async () => {
        try {
          // This function checks the date, updates streak, and awards XP if valid
          await supabase.rpc('check_daily_login');
        } catch (e) {
          console.error('Error checking daily login:', e);
        }
      };
      checkLogin();
    }
  }, [userId]);

  

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void reportBug(event.error || new Error(event.message || 'window.onerror'), {
        source: 'frontend',
        severity: 'high',
        functionName: 'App.windowError',
      })
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      
      // Handle Invalid Refresh Token error - attempt recovery before logging out
      const reasonMsg = reason?.message || String(reason)
      if (reasonMsg.includes('Invalid Refresh Token') || reasonMsg.includes('Refresh Token Not Found')) {
        console.warn('Invalid refresh token detected, attempting recovery...')
        // Attempt session recovery instead of immediate logout
        supabase.auth.refreshSession().then(({ data }) => {
          if (!data.session?.access_token) {
            console.warn('Session recovery failed, logging out...')
            useAuthStore.getState().logout()
          }
        }).catch(() => {
          useAuthStore.getState().logout()
        })
        return
      }

      void reportBug(reason, {
        source: 'frontend',
        severity: 'high',
        functionName: 'App.unhandledRejection',
      })
    }
    let isReportingConsoleError = false
    const originalConsoleError = console.error
    console.error = (...args: any[]) => {
      // If we're already reporting a console.error, just output using the
      // original console function and return immediately to avoid re-entry.
      if (isReportingConsoleError) {
        originalConsoleError(...args)
        return
      }

      // Preserve original behaviour first
      originalConsoleError(...args)

      try {
        isReportingConsoleError = true

        const safeSerialize = (value: any, depth = 0): any => {
          const maxDepth = 4
          try {
            if (value instanceof Error) {
              return {
                _type: 'Error',
                name: value.name,
                message: value.message,
                stack: value.stack,
                cause: safeSerialize((value as any).cause, depth + 1),
              }
            }

            if (depth >= maxDepth) {
              return '[Truncated]'
            }

            if (typeof value === 'object' && value !== null) {
              const seen = new WeakSet()
              const clone = (obj: any, currentDepth: number): any => {
                if (obj === null) return null
                if (typeof obj !== 'object') return obj
                if (currentDepth >= maxDepth) return '[Truncated]'
                if (seen.has(obj)) return '[Circular]'
                seen.add(obj)
                if (Array.isArray(obj)) return obj.map((item) => clone(item, currentDepth + 1))
                const res: any = {}
                for (const k of Object.keys(obj)) {
                  try { res[k] = clone(obj[k], currentDepth + 1) } catch { res[k] = '[Unserializable]' }
                }
                return res
              }
              return clone(value, depth)
            }

            return value
          } catch (e) {
            return String(value)
          }
        }

        let serializedArgs: any[]
        try {
          serializedArgs = args.map((arg) => safeSerialize(arg, 0))
        } catch {
          serializedArgs = args.map((arg) => {
            try {
              return String(arg)
            } catch {
              return '[Unserializable argument]'
            }
          })
        }

        const firstString = args.find(a => typeof a === 'string')
        const firstError = args.find(a => a instanceof Error) as Error | undefined
        const firstObjMessage = args.find(a => typeof a === 'object' && a && (a.message || a.error || a.error_description))

        const rootMessage = (firstString ? String(firstString) : '') +
          (firstError ? (firstError.message ? ` ${firstError.message}` : '') : '') +
          (firstObjMessage && !firstError ? ` ${String((firstObjMessage as any).message || (firstObjMessage as any).error || '')}` : '')

        const fullMessage = rootMessage.trim() || serializedArgs.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')

        // Supabase Realtime AbortError ("Lock broken by another request with the 'steal' option")
        // is a known non-fatal issue when multiple realtime channels compete for the same connection.
        // Supabase auto-retries, so we suppress it from Bug Center reporting.
        // LiveKit "Tried to add a track for a participant, that's not present" is a known non-fatal
        // race condition when a participant leaves while a track event is being processed.
        // LiveKit "Unknown DataChannel error on reliable/lossy" is a non-fatal transport hiccup that
        // fires during data-channel setup/teardown; LiveKit auto-recovers, so we suppress it.
        // Supabase auth errors like invalid refresh token and JWT user_not_found are transient
        // auth issues that are handled by the auth recovery logic and should not be reported as bugs.
        // Edge Function "Failed to send a request" errors are typically deployment/network issues
        // and should not be reported as frontend bugs.
        if (
          fullMessage.includes('Lock broken by another request') ||
          fullMessage.includes("'steal' option") ||
          fullMessage.includes('was released because another request stole it') ||
          (firstError && firstError.name === 'AbortError') ||
          fullMessage.includes('Tried to add a track for a participant, that\'s not present') ||
          fullMessage.includes('Unknown DataChannel error') ||
          fullMessage.includes('Invalid Refresh Token') ||
          fullMessage.includes('Refresh Token Not Found') ||
          fullMessage.includes('User from sub claim in JWT does not exist') ||
          fullMessage.includes('Failed to send a request to the Edge Function')
        ) {
          return
        }

        let stack = null
        if (firstError && firstError.stack) stack = firstError.stack
        if (!stack) stack = new Error(fullMessage).stack

        const pageUrl = typeof window !== 'undefined' ? window.location.href : null
        const route = typeof window !== 'undefined' ? window.location.pathname : null
        // Extract streamId from common watch/broadcast routes for better bug grouping
        let streamIdFromRoute: string | null = null
        try {
          if (route) {
            const m = route.match(/\/(?:watch|broadcast|mobile\/watch|pwa\/watch)\/([0-9a-fA-F-]{36})/)
            if (m && m[1]) streamIdFromRoute = m[1]
          }
        } catch {}
        const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null
        const userId = ((supabase.auth as any)?.user?.id) || null

        const isReporterCall = serializedArgs.some((a: any) => typeof a === 'object' && a && (a?.requestPayload || a?.functionName === 'console.error' || a?.table === 'app_bug_reports'))
        if (isReporterCall) return

        // Report the error to Bug Center. Marking `isReportingConsoleError`
        // prevents recursive console.error handling while the reporter runs.
        void reportBug(new Error(fullMessage), {
          source: 'frontend',
          severity: 'medium',
          functionName: 'console.error',
          requestPayload: {
            args: serializedArgs,
            userAgent,
            route,
            pageUrl,
          },
          streamId: streamIdFromRoute,
          userId: userId,
          stack,
        })
      } catch (reportErr) {
        // Use the original console error to avoid re-entering this wrapper.
        originalConsoleError('[BugCenter] console.error reporter failed', reportErr)
      } finally {
        isReportingConsoleError = false
      }
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      console.error = originalConsoleError
    }
  }, [userId])

  // 🔹 Tab Visibility Change Handler
  useEffect(() => {
    if (!userId) return
 
const handleVisibilityChange = async () => {
      if (!document.hidden) {
        const now = Date.now();
        if (now - lastVisibilityRefreshRef.current < 10000) {
          return;
        }
        lastVisibilityRefreshRef.current = now;

        const currentPath = window.location.pathname;
        const isNoRefreshRoute = /\/(battle|broadcast|watch|live|broadcasting|stats)(\/|$)/.test(currentPath)
        if (isNoRefreshRoute) {
          console.log('⏳ Route detected - skipping visibility refresh to prevent disruption');
          return;
        }

        refreshProfile()
        eligibilityRefresh(userId)
        // Dispatch global refetch event for all components
        window.dispatchEvent(new CustomEvent(APP_DATA_REFETCH_EVENT_NAME))
      }
    }
 
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [userId, refreshProfile, eligibilityRefresh])

  // 🔹 Scroll to top on route change
  useEffect(() => {
    const targets = [mainRef.current, document.scrollingElement, document.body]
    targets.forEach((el) => {
      if (el && typeof (el as HTMLElement).scrollTo === "function") {
        ;(el as HTMLElement).scrollTo({ top: 0, left: 0 })
      }
    })
  }, [location.pathname])

  const handleUpdateClick = () => {
    if (!waitingServiceWorker) return;
    waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
    setUpdateAvailable(false);
  };

  const appShell = (
    <>
      {updateAvailable && (
        <div className="fixed top-0 inset-x-0 z-[60] flex items-center justify-between bg-purple-900 text-white px-4 py-2">
          <span className="text-sm">A new version of Mai Troll is available.</span>
          <button
            type="button"
            onClick={handleUpdateClick}
            className="ml-4 rounded bg-purple-600 text-white text-sm font-semibold px-3 py-1 hover:bg-purple-500"
          >
            Update now
          </button>
        </div>
      )}
      {/* Global Error Banner */}
      <GlobalErrorBanner />

      {/* Officer Alert Banner */}
      <OfficerAlertBanner />

      {/* Global Gift Banner */}
      <GlobalGiftBanner />

      {/* Animation System Container */}
      <AnimationsContainer />

      {/* Broadcast Announcement */}
      <BroadcastAnnouncement />
      <GlobalPodBanner />
      <DailyChurchNotification />
      <SurveyNotification />
      <GlobalPromoCardListener />

      {/* Global Loading Overlay */}
      <GlobalLoadingOverlay
        isVisible={globalLoading}
        message={loadingMessage}
        type="loading"
      />

      {/* Global Reconnecting Overlay */}
      <GlobalLoadingOverlay
        isVisible={isReconnecting}
        message={reconnectMessage}
        type="reconnecting"
      />

      {/* Global Error Overlay (for critical errors) */}
      <GlobalLoadingOverlay
        isVisible={!!error && !isReconnecting}
        message={error || ''}
        type="error"
        onRetry={retryLastAction}
      />

<LiveContentProvider>
            <AppLayout showSidebar={!isMobileUI || isStandalone} showHeader={true} showBottomNav={true}>
           <GlobalPresenceTracker />
           {user && <AdminOfficerQuickMenu />}
           {user && <ChatBubble />}
           <StaffWalkieTalkieProvider>
             <RTCAdminMonitor />
             {import.meta.env.DEV && (profile?.is_admin || profile?.is_superadmin || ['admin','ceo','superadmin'].includes(profile?.role || '')) }
             <ErrorBoundary>
               <Suspense fallback={null}>
                 <PageChannelProvider>
                 <Routes>
                 {/* Public Routes */}
                 <Route path="/intro" element={<Navigate to="/" replace />} />
                 <Route path="/landing" element={<Navigate to="/" replace />} />
                 
                 
                 {/* Authentication */}
                 <Route path="/auth" element={user ? <Navigate to="/home" replace /> : <Auth />} />
                 <Route path="/auth/callback" element={<AuthCallback />} />
                 <Route path="/exit" element={<RequireInternalNavigation><ExitPage /></RequireInternalNavigation>} />
                 <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
                 <Route path="/access-denied" element={<AccessDenied />} />
                 <Route path="/terms-of-service" element={<Navigate to="/legal/terms" replace />} />
                 <Route path="/privacy-policy" element={<Navigate to="/legal/privacy" replace />} />
                 <Route path="/payment-terms" element={<Navigate to="/legal/refunds" replace />} />
                 <Route path="/creator-agreement" element={<Navigate to="/legal/creator-earnings" replace />} />
                 <Route path="/reset-password" element={<PasswordReset />} />
                <Route path="/tax-onboarding" element={<TaxOnboarding />} />
                <Route path="/verification" element={<VerificationPage />} />
                <Route path="/verification/complete" element={<VerificationComplete />} />
                <Route path="/founding-officer-trial" element={<FoundingOfficerTrial />} />

                  <Route path="/account/earnings" element={<EarningsDashboard />} />
                <Route path="/payout-status" element={<PayoutStatus />} />
                 
                {/* 📜 Legal & Policy Pages (Public) */}
                <Route path="/legal" element={<PolicyCenter />} />
                <Route path="/legal/terms" element={<TermsOfServiceLegal />} />
                <Route path="/legal/privacy" element={<PrivacyPolicyLegal />} />
                <Route path="/legal/refunds" element={<RefundPolicyLegal />} />
                <Route path="/legal/refund" element={<RefundPolicyLegal />} />
                <Route path="/legal/payouts" element={<PayoutPolicyLegal />} />
                <Route path="/legal/safety" element={<SafetyGuidelinesLegal />} />
                <Route path="/legal/creator-earnings" element={<CreatorEarnings />} />
                <Route path="/legal/gambling-disclosure" element={<GamblingDisclosure />} />
                 
                 {/* 🔓 Public Discover & Watch */}
                 <Route path="/explore" element={<ExploreSearchResults />} />
                 <Route path="/high-bcasters" element={<HighBcastersPage />} />
                 <Route path="/live-swipe" element={<StreamSwipePage />} />
                <Route path="/embed/:id" element={<EmbedPage />} />
                <Route path="/jobs" element={<HowToVideosPage />} />
                <Route path="/hytrogaming" element={<HytroGaming />} />
                <Route path="/hytrogaming/apply" element={<HytroGamingApply />} />
                <Route path="/hytrogaming/contract/:id" element={<HytroGamingContract />} />
                <Route path="/hytro/:id" element={<HytroGamingViewer />} />
                <Route path="/dev/theme-preview" element={<ThemePreviewPage />} />
                <Route path="/dev/homepage-preview" element={<HomepageBackgroundShowcase />} />

                 {/* Safety Page (standalone) */}
                 <Route path="/safety" element={<Safety />} />
                 <Route path="/help" element={<HelpPage />} />

                 {/* 🔒 Authenticated Support Route - must come before SEO */}

                {/* 🔍 SEO Pages (Public, Indexable by Search Engines) */}
                <Route path="/about" element={<SEOAboutPage />} />
                <Route path="/contact" element={<SEOContactPage />} />
                <Route path="/faq" element={<SEOFAQPage />} />
                <Route path="/privacy" element={<SEOPrivacyPage />} />
                <Route path="/terms" element={<SEOTermsPage />} />

                {/* 🏢 Talent Offices (Public) */}
                <Route path="/agencies" element={<AgenciesPage />} />
                <Route path="/agencies/create" element={<CreateAgencyPage />} />
                <Route path="/agency/:agencyIdOrSlug" element={<AgencyProfilePage />} />
                <Route path="/agency/:agencyIdOrSlug/roster" element={<AgencyProfilePage />} />
                <Route path="/agency/:agencyIdOrSlug/goals" element={<AgencyProfilePage />} />
                <Route path="/agency-apply/:agencyIdOrSlug" element={<AgencyApplyPage />} />

                {/* Jobs Routes */}
                <Route path="/jobs" element={<HowToVideosPage />} />
                <Route path="/jobs/apply" element={<JobsApplicationPage />} />
                <Route path="/jobs/status" element={<JobsStatusPage />} />

                {/* Application Routes */}
                <Route path="/apply" element={<ApplicationPage />} />

                <Route path="/careers" element={<CareersPage />} />

                {/* 🏠 Home - Public with limited auth for interactions */}
                <Route path="/home" element={<Navigate to="/" replace />} />
                <Route path="/" element={<ErrorBoundary><AuthenticatedHome /></ErrorBoundary>} />

                {/* 🎤 Live Auctions — Public browse/watch, studio gated below */}
                <Route path="/auctions" element={<AuctionsPage />} />
                <Route path="/auctions/:showId" element={<LiveAuctionRoom />} />
                <Route path="/auctions/won/:showId" element={<AuctionWon />} />
                <Route path="/treelz" element={<TreelzPage />} />
                <Route path="/treelz/upload" element={<TreelzUploadPage />} />

{/* Username-based public profile routes - must be after known routes */}
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/id/:userId" element={<Profile />} />
                <Route path="/profile/:username" element={<Profile />} />

                {/* Broadcast/Stream routes - public with password protection */}
                 <Route path="/replay/:streamId" element={<ReplayPage />} />
                 <Route path="/replay/id/:streamId" element={<ReplayPage />} />

                 <Route path="/gaming/watch/:streamId" element={<HytroGamingViewer />} />
                {/* Username-based stream routes (SEO-friendly, e.g. /live/username) */}
                <Route path="/live/:username" element={<BroadcastRouter />} />
                <Route path="/stream/:username" element={<BroadcastRouter />} />
                {/* UUID-based stream routes (backwards compatibility) */}
                <Route path="/broadcast/:id" element={<BroadcastRouter />} />
                <Route path="/watch/:id" element={<BroadcastRouter />} />
                <Route path="/live/:streamId" element={<BroadcastRouter />} />
                 <Route path="/stream/:id" element={<BroadcastRouter />} />

                 {/* Stream summary page (reached after a broadcast ends) */}
                 <Route path="/broadcast/summary/:streamId" element={<StreamSummary />} />

                 {/* 🏛️ State Battle Routes */}
                 <Route path="/state-rankings" element={<StateRankings />} />
                <Route path="/state/:stateCode" element={<StateDetail />} />

                {/* ✅ Verified Badge */}
                <Route path="/verified-badge" element={<VerifiedBadgePage />} />

                {/* 🎓 Mai Troll Academy */}
                <Route path="/academy" element={<UnderConstructionPage pageName="Academy" openingDate="Oct 1, 2026" />} />
                <Route path="/academy/courses" element={<CourseCatalogPage />} />
                <Route path="/academy/course/:slug" element={<CourseDetailPage />} />
                <Route path="/academy/verify" element={<VerifyCertificatePage />} />
                <Route path="/academy/teacher/apply" element={<TeacherApplyPage />} />
                <Route path="/academy/teacher/dashboard" element={<TeacherDashboardPage />} />
                <Route path="/academy/teacher/course/new" element={<TeacherCoursePage />} />
                <Route path="/academy/teacher/course/:courseId" element={<TeacherCoursePage />} />
                <Route path="/academy/grades" element={<AcademyTranscriptPage />} />
                <Route path="/academy/certificates" element={<AcademyCertificatesPage />} />
                <Route path="/academy/transcript" element={<AcademyTranscriptPage />} />
                <Route path="/academy/coins" element={<AcademyCoinsPage />} />
                <Route path="/academy/admissions" element={<AcademyAdmissionsPage />} />
                <Route path="/academy/classroom" element={<AcademyClassroomPage />} />
                <Route path="/academy/classroom/:courseId" element={<AcademyClassroomPage />} />
                <Route path="/academy/admin" element={<RequireRole roles={[UserRole.ADMIN]}><AcademyAdminPage /></RequireRole>} />
                <Route path="/academy/assignment/new" element={<AssignmentCreatePage />} />
                <Route path="/academy/assignment/edit/:assignmentId" element={<AssignmentCreatePage />} />
                <Route path="/academy/assignment/grade/:assignmentId" element={<AssignmentGradingPage />} />
                <Route path="/academy/course/:slug/assignments" element={<AssignmentStudentPage />} />
                <Route path="/academy/course/:slug/quiz/:quizId" element={<QuizTakePage />} />
                <Route path="/academy/quiz/new" element={<QuizBuilderPage />} />
                <Route path="/academy/quiz/new/:courseId" element={<QuizBuilderPage />} />
                <Route path="/academy/attendance/:courseId" element={<AttendancePage />} />
                <Route path="/academy/attendance/:courseId/:sessionId" element={<AttendancePage />} />
                <Route path="/academy/pathway/:pathwayId" element={<PathwayDetailPage />} />
                <Route path="/academy/loans" element={<LoanServicingPage />} />
                <Route path="/academy/teacher/revenue" element={<TeacherRevenuePage />} />
                <Route path="/academy/course/:slug/communication" element={<CommunicationCenterPage />} />
                <Route path="/academy/transcript/official" element={<TranscriptPage />} />
                <Route path="/academy/accreditation" element={<AccreditationPage />} />
                <Route path="/academy/admin/teachers" element={<RequireRole roles={[UserRole.ADMIN]}><TeacherManagementPage /></RequireRole>} />
                <Route path="/academy/teachers" element={<TeacherDirectoryPage />} />
                <Route path="/academy/assignments" element={<AssignmentsListPage />} />

                 {/* 📨 UTroMail */}
                 <Route path="/utromail" element={<UtromailPage />} />
                 <Route path="/utromail/thread/:threadId" element={<UtromailPage />} />
                 <Route path="/utromail/compose" element={<UtromailPage />} />
                 <Route path="/utromail/settings" element={<UtromailPage />} />

                 {/* ⚖️ Court - public viewing */}
                 <Route path="/troll-court" element={<TrollCourt />} />
                 <Route path="/troll-court/watch/:sessionId" element={<CourtViewerPage />} />

                 {/* 🛰️ Universe Arena Dev Preview — public, fake data, no auth */}
                 <Route path="/universe/dev-preview" element={<UniverseArenaDevPreview />} />

                 {/* 🔐 Protected Routes */}
                 <Route element={<RequireAuth />}>
                  
                  {/* Talent Office Dashboard (Protected) */}
                  <Route path="/agency-dashboard" element={<AgencyDashboard />} />
                  <Route
                    path="/agency-hr-dashboard"
                    element={
                      <RequireRole
                        roles={[
                          UserRole.ADMIN,
                          UserRole.AGENCY_HR_MANAGER,
                          UserRole.HR_ADMIN,
                          'agency hr',
                          'agency_hr',
                          'agency hr manager',
                          'agency_hr_manager',
                        ]}
                      >
                        <AgencyHRDashboard />
                      </RequireRole>
                    }
                   />
                   <Route
                     path="/hr-center"
                     element={
                       <RequireRole
                         roles={[
                           UserRole.ADMIN,
                           UserRole.HR_ADMIN,
                           UserRole.HR_MANAGER,
                           UserRole.AGENCY_HR_MANAGER,
                           UserRole.TROLL_OFFICER,
                           UserRole.LEAD_TROLL_OFFICER,
                           UserRole.PASTOR,
                           UserRole.AGENCY_LEADER,
                           UserRole.SECRETARY,
                           UserRole.ATTORNEY,
                           UserRole.PROSECUTOR,
                           UserRole.JOURNALIST,
                           UserRole.AUCTIONEER,
                           UserRole.TROLLER,
                           UserRole.CEO_ASSISTANT,
                           UserRole.NOAH_ASSISTANT,
                         ]}
                       >
                         <HRCenter />
                       </RequireRole>
                     }
                   />
                   <Route path="/broadcast/setup" element={<SetupPage />} />
<Route path="/broadcast/setup/gaming" element={<GamingSetupPage />}>
  <Route path="analytics" element={<GamingAnalytics />} />
  <Route path="community" element={<GamingCommunity />} />
  <Route path="monetization" element={<GamingMonetization />} />
<Route path="store" element={<GamingStore />} />
                   </Route>

                   {/* Kick Fee - for users who were kicked from streams */}
                   <Route path="/kick-fee/:streamId" element={<KickFeePage />} />

                   {/* President Routes */}
                  <Route path="/president" element={<PresidentPage />} />
                  <Route path="/president/dashboard" element={
                    <RequireRole roles={[UserRole.PRESIDENT, UserRole.ADMIN]}>
                      <PresidentDashboard />
                    </RequireRole>
                  } />
                  <Route path="/mayor" element={<MayorDashboard />} />
                  <Route path="/town-meeting" element={<TownMeetingPage />} />
                  <Route path="/city-government" element={<CityGovernmentPage />} />
                  <Route path="/government/proposals" element={<GovernmentProposalsPage />} />
                  <Route path="/government/openings" element={<CityOpeningsPage />} />
                  <Route path="/government/newspaper" element={<CityNewspaperPage />} />
                  <Route path="/president/secretary" element={
                    <RequireRole roles={[UserRole.SECRETARY, UserRole.ADMIN]}>
                      <SecretaryDashboard />
                    </RequireRole>
                  } />
                  <Route path="/president/treasury" element={
                    <RequireRole roles={[UserRole.PRESIDENT, UserRole.ADMIN]}>
                      <TreasuryDashboard />
                    </RequireRole>
                  } />
                  <Route path="/prosecutor" element={
                    <RequireRole roles={['prosecutor']}>
                      <ProsecutorDashboard />
                    </RequireRole>
                  } />

<Route path="/mobile" element={<Navigate to="/home" replace />} />
                   <Route path="/messages" element={<Navigate to="/utromail" replace />} />

                   {/* Dashboard redirects — commonly expected paths */}
                   <Route path="/auction/dashboard" element={<Navigate to="/auctions/studio" replace />} />
                   <Route path="/auction/studio" element={<Navigate to="/auctions/studio" replace />} />
                   <Route path="/auction/studio/lots" element={<Navigate to="/auctions/studio/lots" replace />} />
                   <Route path="/auction/my-shows" element={<Navigate to="/auctions/my-shows" replace />} />
                   <Route path="/auction/bidders" element={<Navigate to="/auctions/bidders" replace />} />
                   <Route path="/auction/sales" element={<Navigate to="/auctions/sales" replace />} />
                   <Route path="/auction/reports" element={<Navigate to="/auctions/reports" replace />} />
                   <Route path="/auction/analytics" element={<Navigate to="/auctions/analytics" replace />} />
                   <Route path="/auction/settings" element={<Navigate to="/auctions/settings" replace />} />
                   <Route path="/auction/inventory" element={<Navigate to="/auctions/inventory" replace />} />
                   <Route path="/auction/orders" element={<Navigate to="/auctions/orders" replace />} />
                   <Route path="/auction/packing" element={<Navigate to="/auctions/packing" replace />} />
                   <Route path="/auction/devices" element={<Navigate to="/auctions/devices" replace />} />
                    <Route path="/tcnn/chief" element={<Navigate to="/tcnn/dashboard" replace />} />
                     {/* 🏢 Unified Employees Office — all non-admin employee roles use one page */}
                     <Route path="/Employees" element={<EmployeesPage />} />
                     <Route path="/employees" element={<Navigate to="/Employees" replace />} />
                     <Route path="/department-tools" element={<DepartmentToolsPage />} />
                     <Route path="/officer" element={<Navigate to="/department-tools" replace />} />
                     <Route path="/officer/dashboard" element={<Navigate to="/department-tools?role=troll_officer" replace />} />
                     <Route path="/officer/scheduling" element={<Navigate to="/department-tools?role=troll_officer" replace />} />
                     <Route path="/officer/payroll" element={<Navigate to="/department-tools?role=troll_officer" replace />} />
                     <Route path="/officer/moderation" element={<Navigate to="/department-tools?role=troll_officer" replace />} />
                     <Route path="/officer/lounge" element={<Navigate to="/department-tools?role=troll_officer" replace />} />
                     <Route path="/officer/report/:id" element={<Navigate to="/Employees" replace />} />
                     <Route path="/lead-officer" element={<Navigate to="/department-tools?role=lead_troll_officer" replace />} />
                     <Route path="/secretary" element={<Navigate to="/department-tools?role=secretary" replace />} />
                     <Route path="/ceo-assistant-dashboard" element={<Navigate to="/department-tools?role=ceo_assistant" replace />} />
                     <Route path="/noah-assistant-dashboard" element={<Navigate to="/department-tools?role=noah_assistant" replace />} />
                     <Route path="/hr-center" element={<Navigate to="/department-tools" replace />} />
                     <Route path="/agency-hr" element={<Navigate to="/agency-hr-dashboard" replace />} />
                    <Route path="/pastor" element={<Navigate to="/department-tools?role=pastor" replace />} />
                    <Route path="/church/pastor" element={<Navigate to="/department-tools?role=pastor" replace />} />
                    <Route path="/attorney" element={<Navigate to="/department-tools?role=attorney" replace />} />
                    <Route path="/prosecutor" element={<Navigate to="/department-tools?role=prosecutor" replace />} />
                    <Route path="/notary" element={<Navigate to="/department-tools?role=notary" replace />} />

                    <Route path="/match" element={<MatchPage />} />
                    <Route path="/city-laws-fees" element={<CityLawsFeesPage />} />
           <Route path="/city-hall" element={<Navigate to="/home" replace />} />
                   <Route path="/city-registry" element={<CityRegistry />} />
                   <Route path="/appeals" element={<Navigate to="/city-registry" replace />} />
                   <Route path="/city-registry/advertise" element={<AdvertisePage />} />
                <Route path="/universe-event" element={<UniverseEventPage />} />
                <Route path="/universe" element={<UniverseBattlesPage />} />
                <Route path="/universe/home" element={<UniverseBattlesPage />} />
                <Route path="/universe/register" element={<UniverseRegisterPage />} />
                <Route path="/universe/my-battles" element={<UniverseRegisterPage />} />
                <Route path="/universe/calendar" element={<UniverseCalendarPage />} />
                <Route path="/universe/live" element={<UniverseLiveArenaPage />} />
                <Route path="/universe/history" element={<UniverseBattlesPage />} />
                <Route path="/universe/champions" element={<UniverseBattlesPage />} />
                <Route path="/events/universe" element={<Navigate to="/universe" replace />} />
                
                {/* 📺 TCNN - Mai Troll News Network */}
                <Route path="/tcnn" element={<TCNNMainPage />} />
                <Route path="/tcnn/article/:id" element={<ArticleReader />} />
                <Route
                  path="/tcnn/dashboard"
                  element={
                    <RequireRole roles={['journalist', 'tcnn_news_caster', 'tcnn_chief_news_caster']}>
                      <TCNNInternalDashboard />
                    </RequireRole>
                  }
                />
                <Route
                  path="/tcnn/setup"
                  element={
                    <RequireRole roles={['tcnn_news_caster', 'tcnn_chief_news_caster']}>
                      <TCNNSetupPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/tcnn/broadcaster"
                  element={
                    <RequireRole roles={['tcnn_news_caster', 'tcnn_chief_news_caster']}>
                      <TCNNBroadcasterPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/tcnn/broadcaster/:streamId"
                  element={
                    <RequireRole roles={['tcnn_news_caster', 'tcnn_chief_news_caster']}>
                      <TCNNBroadcasterPage />
                    </RequireRole>
                  }
                />
                <Route path="/tcnn/viewer/:streamId" element={<TCNNViewerPage />} />
                
                <Route path="/call/:roomId/:type/:userId" element={<Call />} />
                <Route path="/interview/:interviewId" element={<InterviewPage />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/following" element={<Following />} />
                  <Route path="/following/:userId" element={<Following />} />
                  <Route path="/trollifications" element={<Trollifications />} />
                  <Route path="/trollifieds" element={<Trollifieds />} />
                  <Route path="/marketplace" element={<UnderConstructionPage pageName="Shop" openingDate="Oct 1, 2026" />} />
                  <Route path="/marketplace/orders" element={<UnderConstructionPage pageName="Shop" openingDate="Oct 1, 2026" />} />
                  <Route path="/marketplace/sales" element={<UnderConstructionPage pageName="Shop" openingDate="Oct 1, 2026" />} />
                  <Route path="/pool" element={<PublicPool />} />

                  <Route path="/troll-games/giveaways" element={<GiveawaysPage />} />
                  <Route path="/troll-wheel" element={<TrollWheel />} />
                  <Route path="/ktauto" element={<CarDealership />} />
                  <Route path="/garage" element={<GaragePage />} />
                  <Route path="/vehicle-transactions" element={<VehicleTransactionsPage />} />

                  <Route path="/shop/:username" element={<ShopView />} />
                  <Route path="/inventory" element={<UserInventory />} />
          <Route path="/troting" element={<Troting />} />
          <Route path="/profile/settings" element={<ProfileSettings />} />
                  <Route path="/profile/delete" element={<DeleteAccount />} />
                  <Route path="/bank" element={<TrollBank />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/credit-scores" element={<CreditScorePage />} />
                  <Route path="/support" element={<Support />} />
            <Route path="/beta-feedback" element={<BetaFeedback />} />
                  <Route path="/survey/:surveyId" element={<SurveyPage />} />
                  <Route path="/under-construction" element={<UnderConstructionPage />} />
                  <Route path="/jail" element={<JailPage />} />
                  <Route path="/inmates" element={<InmatesPage />} />
                  <Route path="/jail/appeal" element={<JailAppealPage />} />
                  <Route path="/wall" element={<WallPage />} />
                  <Route path="/wall/:postId" element={<WallPostPage />} />
<Route path="/profile/setup" element={<ProfileSetup />} />
                   <Route path="/profile/settings" element={<ProfileSettings />} />
                   <Route path="/profile/delete" element={<DeleteAccount />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/blocked-users" element={<BlockedUsers />} />
                   <Route path="/living" element={<LivingPage />} />
                    <Route path="/map" element={<MapPage />} />
                    <Route path="/neighborhood-map" element={<NeighborhoodMapHub />} />
                    <Route path="/neighborhood-setup" element={<NeighborhoodOnboarding />} />
                    <Route path="/driver-test" element={<DriverTest />} />
                    <Route path="/insurance" element={<InsurancePage />} />
                    
                    <Route path="/church" element={<ChurchPage />} />
                    <Route path="/church/live/:sessionId" element={<ChurchLivePage />} />
                  <Route path="/church/pastor" element={
                    <RequireRole roles={['pastor']}>
                      <PastorDashboard />
                    </RequireRole>
                  } />
                  <Route
                    path="/attorney"
                    element={
                      <RequireRole roles={['attorney']}>
                        <AttorneyDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/notary"
                    element={
                      <RequireRole roles={['notary', 'admin', 'attorney']}>
                        <NotaryDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/ceo-assistant-dashboard"
                    element={
                      <RequireRole roles={['ceo_assistant']}>
                        <CEOAssistantDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/noah-assistant-dashboard"
                    element={
                      <RequireRole roles={['noah_assistant']}>
                        <NoahAssistantDashboard />
                      </RequireRole>
                    }
                  />
                   {/* 📺 Live Streaming System */}
                   <Route path="/live/command-center/:streamId" element={<LiveCommandCenter />} />
                   <Route path="/live/overlay/:streamId" element={<LiveStreamOverlay />} />
                   <Route path="/settings/audio" element={<AudioSettings />} />

                     <Route path="/court" element={<CourtRoom />} />
                     <Route path="/court/:courtId/summary" element={<CourtSummary />} />
                     <Route path="/court/:courtId" element={<CourtRoom />} />

                   {/* Team Meeting Room */}
                   <Route path="/meeting/:meetingId" element={<TeamMeetingRoom />} />
                   
                   {/* /team-meeting/:meetingId - alias for joining meetings */}
                   <Route path="/team-meeting/:meetingId" element={<TeamMeetingRoom />} />

                   {/* 📧 Tromail - Internal Role Email */}
                   <Route path="/tromail" element={<TromailPage />} />
                   <Route path="/tromail/office" element={<TroMailOfficePage />} />

                   {/* 🎥 Team Meeting Room */}
                   <Route
                     path="/auctions/studio"
                     element={
                       <RequireRole roles={['auctioneer']}>
                         <AuctionStudio />
                       </RequireRole>
                     }
                   />
                   <Route
                     path="/auctions/studio/:showId/lots"
                     element={
                       <RequireRole roles={['auctioneer']}>
                         <AuctionStudioLots />
                       </RequireRole>
                     }
                   />
                   <Route
                     path="/auctions/studio/:showId/live"
                     element={
                       <RequireRole roles={['auctioneer']}>
                         <AuctioneerDashboard />
                       </RequireRole>
                     }
                   />
                   <Route
                     path="/auctions/my-shows"
                     element={
                       <RequireRole roles={['auctioneer']}>
                         <MyAuctionShows />
                       </RequireRole>
                     }
                   />
                   <Route path="/auctions/reports" element={<AuctionReports />} />
                   <Route path="/auctions/applications" element={<AdminAuctionApps />} />
                   <Route
                     path="/auctions/bidders"
                     element={
                       <RequireRole roles={['auctioneer']}>
                         <AuctionBidders />
                       </RequireRole>
                     }
                   />
                   <Route
                     path="/auctions/sales"
                     element={
                       <RequireRole roles={['auctioneer']}>
                         <AuctionSales />
                       </RequireRole>
                     }
                   />
                   <Route
                     path="/auctions/analytics"
                     element={
                       <RequireRole roles={['auctioneer']}>
                         <AuctionAnalytics />
                       </RequireRole>
                     }
                   />
                   <Route
                     path="/auctions/settings"
                     element={
                       <RequireRole roles={['auctioneer']}>
                         <AuctionSettings />
                       </RequireRole>
                     }
                   />
                   <Route
                     path="/auctions/inventory"
                     element={
                       <RequireRole roles={['auctioneer']}>
                         <AuctionInventory />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/auctions/orders"
                      element={
                        <RequireRole roles={['auctioneer']}>
                          <AuctionOrderManagement />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/auctions/packing"
                      element={
                        <RequireRole roles={['auctioneer']}>
                          <PackingStation />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/auctions/devices"
                      element={
                        <RequireRole roles={['auctioneer']}>
                          <DeviceManagement />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/auctioneer/scanner"
                      element={
                        <RequireRole roles={['auctioneer']}>
                          <AuctioneerScanner />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/auction-app"
                      element={
                        <RequireRole roles={['auctioneer']}>
                          <AuctionApp />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/auction-app/:showId"
                      element={
                        <RequireRole roles={['auctioneer']}>
                          <AuctionApp />
                        </RequireRole>
                      }
                    />


                   
                  {/* 🎮 Multi-Box Streaming */}

                   
                  {/*  Payment Methods */}
                  <Route path="/add-card" element={<Navigate to="/profile/setup" replace />} />
                   
                  {/* 📝 Creator Onboarding */}
                  <Route path="/onboarding/creator" element={<CreatorOnboarding />} />
                  <Route path="/creator-switch" element={<CreatorSwitchProgram />} />

{/* 🏳️‍🌈 Pride Shop */}
                   <Route path="/pride-shop" element={<PrideShop />} />
                   {/* 🏳️‍🌈 Pride Challenges */}
                   <Route path="/pride-challenges" element={<PrideChallengesPage />} />
                    {/* 💰 Earnings & Coins */}
                    <Route path="/store" element={<CoinStore />} />
                    <Route path="/coins" element={<CoinStore />} />
                    <Route path="/profile-frames" element={<ProfileFrameStore />} />
                    <Route path="/coins/complete" element={<CoinsComplete />} />


                   <Route path="/stats" element={<StatsPage />} />
                   <Route path="/payouts/setup" element={<PayoutSetupPage />} />
                  <Route path="/payouts/request" element={<PayoutRequest />} />
                  <Route path="/payment/callback" element={<PaymentCallback />} />
                   <Route path="/earnings" element={<EarningsDashboard />} />

                  <Route path="/bonuses" element={<BonusesPage />} />
                   <Route path="/cashout" element={<CashoutPage />} />
                    <Route path="/fast-pay-application" element={<FastPayApplication />} />
                    <Route path="/mai-pay" element={<MaiPayPage />} />

                  <Route path="/shop-partner" element={<ShopPartnerPage />} />
                  <Route path="/sell" element={<SellOnTrollCity />} />
                  <Route path="/seller/orders" element={<SellerOrders />} />
                  <Route path="/my-orders" element={<MyOrders />} />
                  <Route path="/seller/earnings" element={<ShopEarnings />} />
                  {/* Gift store routes removed */}

                  {/* 👨‍👩‍👧 Family */}
                <Route path="/family" element={<Navigate to="/family/browse" replace />} />
                <Route path="/family/browse" element={<FamilyBrowse />} />
                  <Route path="/family/create" element={<FamilyBrowse />} />
                  <Route path="/family/city" element={<TrollFamilyCity />} />
                  <Route path="/family/profile/:id" element={<FamilyProfilePage />} />
                  <Route path="/family/chat" element={<Navigate to="/family" replace />} />
                  <Route path="/family/chat/:familyId" element={<FamilyChatPage />} />
                  <Route path="/family/wars" element={<FamilyWarsPage />} />

                  {/* 🏰 Troll Family Ecosystem */}
                  <Route path="/family/home" element={<TrollFamilyHome />} />
                  <Route path="/family/wars-hub" element={<FamilyWarsHub />} />
                  <Route path="/family/leaderboard" element={<FamilyLeaderboard />} />
                  <Route path="/family/shop" element={<FamilyShop />} />

                   

                   {/* Government */}
                    <Route path="/government" element={<Government />} />
                    <Route path="/government/streams" element={<GovernmentStreams />} />

                    {/* 👑 Admin */}
                   <Route
                     path="/admin"
                     element={
                       <RequireRole roles={[UserRole.ADMIN]}>
                         <AdminDashboard />
                       </RequireRole>
                     }
                   />
                   <Route
                     path="/admin/security-command-center"
                     element={
                       <RequireRole roles={[UserRole.ADMIN]}>
                         <SecurityCommandCenter />
                       </RequireRole>
                     }
                   />
                  <Route
                    path="/admin/creator-approvals"
                    element={
                      <RequireRole roles={[UserRole.ADMIN, UserRole.SECRETARY, UserRole.LEAD_TROLL_OFFICER]}>
                        <CreatorSwitchApprovals />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/officer-operations"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <OfficerOperations />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/store-debug"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <StoreDebug />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin-mobile"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <MobileAdminDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/officer-reports"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <AdminOfficerReports />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/earnings"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <AdminEarningsDashboard />
                      </RequireRole>
                    }
                  />
                    <Route
                      path="/admin/payments"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                          <PaymentsDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/economy"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                          <EconomyDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/tax-reviews"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                          <TaxReviewPanel />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/tax/upload"
                      element={<TaxUpload />}
                    />
                    <Route
                      path="/admin/referrals"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.TROLL_OFFICER]}>
                          <ReferralBonusPanel />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/payouts"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminPayoutDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/officers-live"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminLiveOfficersTracker />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/verified-users"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminVerifiedUsers />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/verification"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminVerificationReview />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/celeb-verification"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <CelebVerificationDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/celeb/dashboard"
                      element={
                        <CelebEarningsDashboard />
                      }
                    />
                    <Route
                      path="/celeb/dashboard/products"
                      element={
                        <CelebEarningsDashboard />
                      }
                    />
                    <Route
                      path="/celeb/dashboard/earnings"
                      element={
                        <CelebEarningsDashboard />
                      }
                    />
                    <Route
                      path="/celeb/streams"
                      element={
                        <CelebStreamDiscovery />
                      }
                    />
                    <Route
                      path="/admin/applications"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ApplicationsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/docs/policies"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminPoliciesDocs />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/marketplace"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminMarketplace />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/marketplace/release-requests"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <MarketplaceReleaseRequests />
                        </RequireRole>
                      }
                    />
                    {systemManagementRoutes.map((route) => {
                      const Component = route.component
                      return (
                        <Route
                          key={route.id}
                          path={route.path}
                          element={
                            <RequireRole roles={route.roles ?? [UserRole.ADMIN]}>
                              <Component />
                            </RequireRole>
                          }
                        />
                      )
                     })}

                     <Route
                       path="/admin/pool"
                       element={
                         <RequireRole roles={[UserRole.ADMIN]}>
                           <AdminPoolPage />
                         </RequireRole>
                       }
                     />

                     <Route
                       path="/admin/trollmers-tournament"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <TrollmersTournament />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/jail-management"
                        element={
                          <RequireRole roles={[UserRole.ADMIN]}>
                            <AdminJailManagement />
                          </RequireRole>
                        }
                      />

                    <Route
                      path="/admin/user-forms"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <UserFormsTab />
                        </RequireRole>
                      }
                    />
                    

                    
                    {/* Executive Office Routes */}
                    <Route
                      path="/admin/executive-secretaries"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ExecutiveSecretaries />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/executive-intake"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ExecutiveIntake />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/executive-reports"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ExecutiveReports />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/troll-town-deeds"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminTrollTownDeeds />
                        </RequireRole>
                      }
                    />
                     <Route
                       path="/admin/cashout-manager"
                       element={
                         <RequireRole roles={[UserRole.ADMIN]}>
                           <CashoutManager />
                         </RequireRole>
                       }
                     />
                     <Route
                       path="/admin/cashout/:id"
                       element={
                         <RequireRole roles={[UserRole.ADMIN]}>
                           <AdminCashoutDetailPage />
                         </RequireRole>
                       }
                     />
                    <Route
                      path="/admin/executive-intake"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ExecutiveIntake />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/officer-management"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <OfficerManager />
                        </RequireRole>
                      }
                    />
                    
                    {/* Secretary Console */}
                    <Route
                      path="/secretary"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.SECRETARY]}>
                          <SecretaryConsole />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/secretary/coin-liability"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.SECRETARY, UserRole.OWNER, UserRole.CEO]}>
                          <CoinLiabilityPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/role-management"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <RoleManagement />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/staff-audit"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.SECRETARY, UserRole.LEAD_TROLL_OFFICER]}>
                          <StaffAuditDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/media-library"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <MediaLibrary />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/chat-moderation"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ChatModeration />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/announcements"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <Announcements />
                        </RequireRole>
                      }
                    />
                     <Route
                       path="/admin/send-notifications"
                       element={
                         <RequireRole roles={[UserRole.ADMIN]}>
                           <SendNotifications />
                         </RequireRole>
                       }
                     />
                     <Route
                       path="/admin/xtrollz-apps"
                       element={
                         <RequireRole roles={[UserRole.ADMIN]}>
                           <XtrollzAdminDashboard />
                         </RequireRole>
                       }
                     />

                     <Route
                       path="/admin/export-data"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ExportData />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/user-search"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <UserSearch />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/reports-queue"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ReportsQueue />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/stream-monitor"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <StreamMonitorPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/night-watch"
                      element={
                        <RequireRole roles={NIGHT_WATCH_PATROL_ROLES}>
                          <NightWatchDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/voting"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <TrotingAdminPage />
                        </RequireRole>
                      }
                    />
                  
                    <Route
                      path="/admin/payment-logs"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <PaymentLogs />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/launch-trial"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminLaunchTrial />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/store-pricing"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <StorePriceEditor />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/errors"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminErrors />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/activity"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminActivity />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/supabase-usage"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <SupabaseUsageDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/finance"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminFinanceDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/manual-orders"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.SECRETARY]}>
                          <AdminManualOrders />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/buckets"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <BucketsDashboard />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/grant-coins"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <GrantCoins />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/create-schedule"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <CreateSchedule />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/officer-shifts"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <OfficerShifts />
                        </RequireRole>
                      }
                    />
                                      <Route
                      path="/admin/referral-bonuses"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ReferralBonuses />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/control-panel"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ControlPanel />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/page-visibility"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <AdminPageVisibility />
                        </RequireRole>
                      }
                    />
                     <Route
                       path="/admin/test-diagnostics"
                       element={
                         <RequireRole roles={[UserRole.ADMIN]}>
                           <TestDiagnosticsPage />
                         </RequireRole>
                       }
                     />                   
        
                    <Route
                      path="/admin/reset-maintenance"
                      element={
                        <RequireRole roles={[UserRole.ADMIN]}>
                          <ResetMaintenance />
                        </RequireRole>
                      }
                    />
                   <Route
                     path="/admin/hr"
                     element={<Navigate to="/hr-center" replace />}
                   />
                  <Route
                    path="/admin/appeals"
                    element={
                      <RequireRole roles={[UserRole.ADMIN, UserRole.SECRETARY]}>
                        <AppealManagement />
                      </RequireRole>
                    }
                  />
                   <Route
                     path="/admin/meetings"
                     element={
                       <RequireRole roles={[UserRole.ADMIN, 'ceo', UserRole.LEAD_TROLL_OFFICER, UserRole.TROLL_OFFICER, 'officer', UserRole.SECRETARY]}>
                         <AdminMeetingsDashboard />
                       </RequireRole>
                     }
                   />
<Route
                      path="/rtcadminmonitor"
                      element={
                        <RequireRole roles={[UserRole.ADMIN, UserRole.HR_ADMIN, UserRole.AGENCY_HR_MANAGER, UserRole.LEAD_TROLL_OFFICER, UserRole.TROLL_OFFICER, UserRole.SECRETARY, 'ceo', 'officer', 'pastor']}>
                          <RTCAdminMonitor />
                        </RequireRole>
                      }
                    />
                  <Route path="/rfc" element={<AdminRFC />} />
                  <Route
                    path="/changelog"
                    element={
                      <RequireRole roles={[UserRole.ADMIN]}>
                        <Changelog />
                      </RequireRole>
                    }
                  />
{/* Account routes removed - Settings/Account pages no longer in sidebar */}
                </Route>

                {/* 🎙️ Podcast Central — public, no sign-in required to listen */}
                <Route path="/podcast" element={<PodcastCentral />} />
                <Route path="/podcast/:id" element={<PodcastRoom />} />

                 {/* 🎥 XTrollz (secure 21+ area) */}
                 <Route path="/xtrollz" element={<XtrollzHome />} />
                 <Route path="/xtrollz/rules" element={<XtrollzRulesPage />} />
                 <Route path="/xtrollz/apply" element={<XtrollzApplyPage />} />
                 <Route path="/xtrollz/payment" element={<XtrollzPaymentPage />} />
                 <Route path="/xtrollz/live/:streamId" element={<XTrollzLiveViewer />} />

                {/* 🔙 Catch-all - redirect username patterns to profile (PUBLIC ACCESS) */}
                 <Route path="/:username" element={<UsernameRedirect />} />
                <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </PageChannelProvider>
              </Suspense>
            </ErrorBoundary>
          </StaffWalkieTalkieProvider>
           <GlobalPodBanner />
           <BugAlertPopup />
          </AppLayout>
        </LiveContentProvider>

        {/* Grand City Entrance — cinematic first-visit reveal.
            Null fallback guarantees a render failure never blocks the home page. */}
        <ErrorBoundary fallback={null}>
          <GrandCityEntrance />
        </ErrorBoundary>

       {/* Mini Podcast Player - persists across navigation */}
       <MiniPodcastPlayerWrapper />
        
       {/* Profile setup modal */}
      <ProfileSetupModal
        isOpen={profileModalOpen}
        onSubmit={() => {}}
        loading={profileModalLoading}
        onClose={() => setProfileModalOpen(false)}
      />

      {/* Toast system */}
      <Toaster
        position="top-right"
        duration={5000}
        toastOptions={{
          style: {
            background: "#2e1065",
            color: "#fff",
            border: "1px solid #22c55e",
          },
        }}
      />
      
      {/* Home page notification permission prompt */}
      <ErrorBoundary>
        <HomeNotificationPrompt />
      </ErrorBoundary>
    </>
  );

  return appShell;
}

function App() {
  useEffect(() => {
    initTelemetry();
    const cleanup = initTimeUpdater();
    return cleanup;
  }, []);

  return (
    <PageVisibilityProvider>
      <GlobalEventProvider>
        <BatterySaverProvider>
          <EffectsProvider>
            <TrollProvider>
              <ProfileFrameProvider>
                <TabSwitchHandler>
                  <GhostDropInProvider>
                    <AppContent />
                    <GhostBanner />
                  </GhostDropInProvider>
                </TabSwitchHandler>
                <TMFamilyInviteHandler />
              </ProfileFrameProvider>
            </TrollProvider>
          </EffectsProvider>
        </BatterySaverProvider>
      </GlobalEventProvider>
    </PageVisibilityProvider>
  );
}

export default App;

// Username redirect component - redirects /{username} to their live stream or profile
function UsernameRedirect() {
  const { username } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    
    if (!username) return;
    
    // Check if this looks like a username (not a known route)
    const knownRoutes = ['home', 'auth', 'api', 'admin', 'agency', 'auctions', 'academy', 
      'apply', 'careers', 'live', 'broadcast', 'watch', 'stream', 'gaming', 'hytrogaming',
      'profile', 'wallet', 'stats', 'support', 'legal', 'church', 'podcast', 'auctions',
      'government', 'troll-court', 'court', 'meeting', 'team-meeting', 'tromail', 'utromail',
      'explore', 'leaderboard', 'marketplace', 'pool', 'map', 'settings', 'notifications',
      'following', 'trollifications', 'trollifieds', 'garage', 'ktauto', 'district', 'living',
      'insurance', 'neighborhood', 'driver-test', 'inbox', 'shop', 'inventory', 'troting',
      'match', 'city-hall', 'city-registry', 'universe-event', 'events', 'terms',
      'access-denied', 'reset-password', 'tax-onboarding', 'verification', 'founding-officer-trial',
      'under-construction', 'jail', 'inmates', 'wall', 'crowns', 'credit-scores', 'search',
      'blocked-users', 'pool', 'troll-games', 'troll-wheel', 'decree', 'executive', 'noah'];
    
    if (knownRoutes.includes(username)) return;
    
    // First look up the user_id from username
    supabase
      .from('user_profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
      .then(({ data: userProfile }) => {
        if (cancelled) return;
        if (!userProfile?.id) {
          navigate(`/profile/${encodeURIComponent(username)}`, { replace: true });
          return;
        }
        
        // Check if user has an active live stream
        return supabase
          .from('streams')
          .select('id, category')
          .eq('user_id', userProfile.id)
          .eq('is_live', true)
          .eq('status', 'live')
          .maybeSingle();
      })
      .then((result) => {
        if (cancelled) return;
        // Handle both the direct stream result and the chained promise result
        const liveStream = result?.data || result;
        if (liveStream?.id) {
          // Gaming streams route to gaming viewer, others to username-based watch URL
          const targetPath = liveStream.category === 'gaming' 
            ? `/gaming/watch/${username}` 
            : `/live/${encodeURIComponent(username)}`;
          navigate(targetPath, { replace: true });
        } else {
          navigate(`/profile/${encodeURIComponent(username)}`, { replace: true });
        }
      });

    return () => { cancelled = true };
  }, [username, navigate]);

  return <div className="flex min-h-screen items-center justify-center bg-[#0A0814] text-white"><div>Loading...</div></div>;
}

// Mini Podcast Player wrapper component
function MiniPodcastPlayerWrapper() {
  const activePodcast = usePodcastStore(state => state.activePodcast)
  const showMiniPlayer = usePodcastStore(state => state.showMiniPlayer)
  const isPlaying = usePodcastStore(state => state.isPlaying)
  const isMuted = usePodcastStore(state => state.isMuted)
  const volume = usePodcastStore(state => state.volume)
  const elapsedTime = usePodcastStore(state => state.elapsedTime)
  const setPlaying = usePodcastStore(state => state.setPlaying)
  const setMuted = usePodcastStore(state => state.setMuted)
  const setVolume = usePodcastStore(state => state.setVolume)
  const setShowMiniPlayer = usePodcastStore(state => state.setShowMiniPlayer)

  if (!activePodcast || !showMiniPlayer) return null

  const handleClose = () => {
    setShowMiniPlayer(false)
  }

  const handleExpand = () => {
    // Navigate to podcast room
    window.location.href = `/podcast/${activePodcast.id}`
  }

  return (
    <MiniPodcastPlayer
      podcast={{
        ...activePodcast,
        description: activePodcast.description || '',
        started_at: activePodcast.started_at || new Date().toISOString(),
        listener_count: activePodcast.listener_count || 0,
        host_user_id: activePodcast.host_user_id || ''
      }}
      isPlaying={isPlaying}
      isMuted={isMuted}
      volume={volume}
      elapsedTime={elapsedTime}
      onPlayPause={() => setPlaying(!isPlaying)}
      onMuteToggle={() => setMuted(!isMuted)}
      onVolumeChange={setVolume}
      onClose={handleClose}
      onExpand={handleExpand}
    />
  )
}