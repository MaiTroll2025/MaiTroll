import React from "react";
import {
  Bell,
  Briefcase,
  Crown,
  FileText,
  Gavel,
  GraduationCap,
  Hammer,
  Home,
  Lock,
  MessageCircle,
  Mic,
  PlayCircle,
  Radio,
  Scale,
  Scan,
  Settings,
  Shield,
  Sparkles,
  Store,
  User,
  Users,
  Wallet,
  Wrench,
  Heart,
  Landmark,
  Gamepad2,
  DollarSign,
} from "lucide-react";

import MobileHomePage from "./pages/MobileHomepage";
import MobileSetupPage from "./pages/MobileSetupPage";
import MobileViewerPage from "./pages/MobileViewerPage";
import MobileBroadcastPage from "./pages/MobileBroadcastPage";
import MobileProfilePage from "./pages/MobileProfilePage";
import MobileWalletPage from "./pages/MobileWalletPage";
import MobileHighBcastersPage from "./pages/MobileHighBcastersPage";
import MobileLiveNowPage from "./pages/MobileLiveNowPage";
import MobileNotificationsPage from "./pages/MobileNotificationsPage";
import MobileMessagesPage from "./pages/MobileMessagesPage";
import MobileCoinStorePage from "./pages/MobileCoinStorePage";
import MobileTreelzPage from "./pages/MobileTreelzPage";
import MobileTreelzUpload from "./pages/MobileTreelzUpload";
import MobileTreelzSettings from "./pages/MobileTreelzSettings";
import MobileTreelzSaved from "./pages/MobileTreelzSaved";
import MobilePrideChallenges from "./pages/MobilePrideChallenges";
import MobilePodcastPage from "./pages/MobilePodcastPage";
import HowToVideosPage from "../pages/JobsHowToPage";

import MobilePlaceholder from "./components/MobilePlaceholder";
import AuctioneerScanner from "../pages/auction/AuctioneerScanner";

export type MobileUserRole =
  | "user"
  | "staff"
  | "officer"
  | "troll_officer"
  | "lead_troll_officer"
  | "broadofficer"
  | "secretary"
  | "president"
  | "admin"
  | "ceo"
  | "student"
  | "org_student"
  | "org_admin"
  | "pastor"
  | "auctioneer"
  | "journalist"
  | "news_caster"
  | "chief_news_caster"
  | "troll_court_attorney"
  | "troll_court_prosecutor"
  | "seller"
  | "troller"
  | "agency_hr"
  | "agency_hr_manager"
  | "agency_leader"
  | "ceo_assistant"
  | "noah_assistant"
  | string;

export interface MobileRouteItem {
  path: string;
  label: string;
  key: string;
  element: React.ReactElement;
  icon: React.ElementType;
  priority: number;
  regular?: boolean;
  adminOnly?: boolean;
  roles?: MobileUserRole[];
  showInBottomBubble?: boolean;
  public?: boolean;
}

export const mobileRoutes: MobileRouteItem[] = [
  // Main regular Mai Troll pages
  {
    key: "home",
    label: "Home",
    path: "/",
    element: <MobileHomePage />,
    icon: Home,
    priority: 10,
    regular: true,
    public: true,
    showInBottomBubble: true,
  },
  {
    key: "profile",
    label: "Profile",
    path: "/profile",
    element: <MobileProfilePage />,
    icon: User,
    priority: 20,
    regular: true,
    showInBottomBubble: true,
  },
  {
    key: "store",
    label: "Store",
    path: "/store",
    element: <MobileCoinStorePage />,
    icon: Store,
    priority: 30,
    regular: true,
    showInBottomBubble: true,
  },
  {
    key: "mai-pay",
    label: "MAI Pay",
    path: "/mai-pay",
    element: <MobileWalletPage />,
    icon: DollarSign,
    priority: 40,
    regular: true,
    showInBottomBubble: true,
  },
  {
    key: "high-bcasters",
    label: "High Bcasters",
    path: "/high-bcasters",
    element: <MobileHighBcastersPage />,
    icon: Crown,
    priority: 52,
    regular: true,
    public: true,
    showInBottomBubble: true,
  },
  {
    key: "live-now",
    label: "Live Now",
    path: "/live",
    element: <MobileLiveNowPage />,
    icon: Radio,
    priority: 50,
    regular: true,
    public: true,
    showInBottomBubble: true,
  },
  {
    key: "jobs",
    label: "Jobs",
    path: "/jobs",
    element: <HowToVideosPage />,
    // NOTE: HowToVideosPage is now the Jobs how-to page
    icon: PlayCircle,
    priority: 55,
    regular: true,
    public: true,
    showInBottomBubble: true,
  },
  {
    key: "treelz",
    label: "Treelz",
    path: "/treelz",
    element: <MobileTreelzPage />,
    icon: Sparkles,
    priority: 60,
    regular: true,
    public: true,
    showInBottomBubble: true,
  },
  {
    key: "podcast",
    label: "Podcast",
    path: "/podcast",
    element: <MobilePodcastPage />,
    icon: Mic,
    priority: 62,
    regular: true,
    public: true,
    showInBottomBubble: true,
  },
  {
    key: "inmates",
    label: "Inmates",
    path: "/inmates",
    element: <MobilePlaceholder title="Inmates" />,
    icon: Lock,
    priority: 65,
    regular: true,
    public: true,
    showInBottomBubble: true,
  },
  {
    key: "messages",
    label: "Messages",
    path: "/messages",
    element: <MobileMessagesPage />,
    icon: MessageCircle,
    priority: 70,
    regular: true,
    showInBottomBubble: true,
  },
  {
    key: "notifications",
    label: "Notifications",
    path: "/notifications",
    element: <MobileNotificationsPage />,
    icon: Bell,
    priority: 80,
    regular: true,
    showInBottomBubble: true,
  },
  {
    key: "settings",
    label: "Settings",
    path: "/settings",
    element: <MobilePlaceholder title="Settings" />,
    icon: Settings,
    priority: 90,
    regular: true,
    showInBottomBubble: true,
  },
  {
    key: "treelz-upload",
    label: "Upload Treelz",
    path: "/treelz/upload",
    element: <MobileTreelzUpload />,
    icon: Sparkles,
    priority: 92,
    regular: true,
    showInBottomBubble: false,
  },
  {
    key: "treelz-settings",
    label: "Treelz Settings",
    path: "/treelz/settings",
    element: <MobileTreelzSettings />,
    icon: Settings,
    priority: 93,
    regular: true,
    showInBottomBubble: false,
  },
  {
    key: "treelz-saved",
    label: "Saved Treelz",
    path: "/treelz/saved",
    element: <MobileTreelzSaved />,
    icon: Settings,
    priority: 94,
    regular: true,
    showInBottomBubble: false,
  },
  {
    key: "pride-challenges",
    label: "Pride Challenges",
    path: "/pride-challenges",
    element: <MobilePrideChallenges />,
    icon: Sparkles,
    priority: 95,
    regular: true,
    public: true,
    showInBottomBubble: false,
  },
  {
    key: "hytrogaming",
    label: "Hytro Gaming",
    path: "/hytrogaming",
    element: <MobilePlaceholder title="Hytro Gaming" />,
    icon: Gamepad2,
    priority: 96,
    regular: true,
    public: true,
    showInBottomBubble: true,
  },
  {
    key: "troll-match",
    label: "Troll Match",
    path: "/match",
    element: <MobilePlaceholder title="Troll Match" />,
    icon: Heart,
    priority: 97,
    regular: true,
    public: true,
    showInBottomBubble: true,
  },
  {
    key: "city-laws-fees",
    label: "City Laws & Fees",
    path: "/city-laws-fees",
    element: <MobilePlaceholder title="City Laws & Fees" />,
    icon: FileText,
    priority: 98,
    regular: true,
    public: true,
    showInBottomBubble: true,
  },
  {
    key: "department-tools",
    label: "Department Tools",
    path: "/department-tools",
    element: <MobilePlaceholder title="Department Tools" />,
    icon: Wrench,
    priority: 99,
    roles: ["troll_officer", "lead_troll_officer", "secretary", "ceo_assistant", "noah_assistant", "pastor", "attorney", "prosecutor", "moderator", "agency_hr_manager", "hr_admin", "journalist", "auctioneer", "admin", "ceo"],
    showInBottomBubble: true,
  },

  // Broadcast pages
  {
    key: "setup",
    label: "Setup",
    path: "/broadcast/setup",
    element: <MobileSetupPage />,
    icon: Radio,
    priority: 95,
    regular: true,
    showInBottomBubble: false,
  },
  {
    key: "viewer",
    label: "Viewer",
    path: "/viewer/:streamId",
    element: <MobileViewerPage />,
    icon: Radio,
    priority: 96,
    regular: true,
    public: true,
    showInBottomBubble: false,
  },
  {
    key: "broadcast",
    label: "Broadcast",
    path: "/broadcast/:streamId",
    element: <MobileBroadcastPage />,
    icon: Radio,
    priority: 97,
    regular: true,
    showInBottomBubble: false,
  },

  // Role pages
  {
    key: "staff-dashboard",
    label: "Staff",
    path: "/staff",
    element: <MobilePlaceholder title="Staff Dashboard" />,
    icon: Shield,
    priority: 100,
    roles: ["staff", "officer", "troll_officer", "lead_troll_officer", "broadofficer", "secretary", "president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "officer-dashboard",
    label: "Officer",
    path: "/department-tools",
    element: <MobilePlaceholder title="Department Tools" />,
    icon: Wrench,
    priority: 110,
    roles: ["officer", "troll_officer", "lead_troll_officer", "broadofficer", "president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "night-watch",
    label: "Night Watch",
    path: "/night-watch",
    element: <MobilePlaceholder title="Night Watch" />,
    icon: Radio,
    priority: 120,
    roles: ["staff", "officer", "troll_officer", "lead_troll_officer", "broadofficer", "president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "secretary",
    label: "Secretary",
    path: "/department-tools",
    element: <MobilePlaceholder title="Department Tools" />,
    icon: Wrench,
    priority: 130,
    roles: ["secretary", "president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "president",
    label: "President",
    path: "/department-tools",
    element: <MobilePlaceholder title="Department Tools" />,
    icon: Wrench,
    priority: 140,
    roles: ["president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "pastor",
    label: "Pastor",
    path: "/department-tools",
    element: <MobilePlaceholder title="Department Tools" />,
    icon: Wrench,
    priority: 150,
    roles: ["pastor", "president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "troll-court",
    label: "Troll Court",
    path: "/troll-court",
    element: <MobilePlaceholder title="Troll Court" />,
    icon: Gavel,
    priority: 160,
    roles: [
      "troll_court_attorney",
      "troll_court_prosecutor",
      "officer",
      "troll_officer",
      "lead_troll_officer",
      "broadofficer",
      "president",
      "ceo",
      "admin",
    ],
    showInBottomBubble: true,
  },
  {
    key: "prosecutor",
    label: "Prosecutor",
    path: "/department-tools",
    element: <MobilePlaceholder title="Department Tools" />,
    icon: Wrench,
    priority: 170,
    roles: ["troll_court_prosecutor", "president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "attorney",
    label: "Attorney",
    path: "/department-tools",
    element: <MobilePlaceholder title="Department Tools" />,
    icon: Wrench,
    priority: 180,
    roles: ["troll_court_attorney", "president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "auctioneer",
    label: "Auctioneer",
    path: "/department-tools",
    element: <MobilePlaceholder title="Department Tools" />,
    icon: Wrench,
    priority: 190,
    roles: ["auctioneer", "president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "auctioneer-scanner",
    label: "Scanner",
    path: "/auctioneer/scanner",
    element: <AuctioneerScanner />,
    icon: Scan,
    priority: 191,
    roles: ["auctioneer", "president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "tcnn",
    label: "TCNN",
    path: "/department-tools",
    element: <MobilePlaceholder title="Department Tools" />,
    icon: Wrench,
    priority: 200,
    roles: ["journalist", "news_caster", "chief_news_caster", "president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "student",
    label: "Student",
    path: "/student",
    element: <MobilePlaceholder title="Student Dashboard" />,
    icon: GraduationCap,
    priority: 210,
    roles: ["student", "org_student", "org_admin", "president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "agency-hr",
    label: "Agency HR",
    path: "/department-tools",
    element: <MobilePlaceholder title="Department Tools" />,
    icon: Wrench,
    priority: 220,
    roles: ["agency_hr", "agency_hr_manager", "agency_leader", "org_admin", "president", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "ceo-assistant",
    label: "CEO Assistant",
    path: "/department-tools",
    element: <MobilePlaceholder title="Department Tools" />,
    icon: Wrench,
    priority: 230,
    roles: ["ceo_assistant", "ceo", "admin"],
    showInBottomBubble: true,
  },
  {
    key: "noah-assistant",
    label: "Noah Assistant",
    path: "/department-tools",
    element: <MobilePlaceholder title="Department Tools" />,
    icon: Wrench,
    priority: 240,
    roles: ["noah_assistant", "ceo", "admin"],
    showInBottomBubble: true,
  },

  // Admin
  {
    key: "admin",
    label: "Admin",
    path: "/admin",
    element: <MobilePlaceholder title="Admin Dashboard" />,
    icon: Crown,
    priority: 1000,
    adminOnly: true,
    showInBottomBubble: true,
  },
];

export function normalizeMobileRole(role: unknown): MobileUserRole {
  return String(role || "user").trim().toLowerCase();
}

export function isMobileAdminRole(role: MobileUserRole): boolean {
  return role === "admin" || role === "ceo";
}

export function canAccessMobileRoute(route: MobileRouteItem, role: MobileUserRole): boolean {
  if (isMobileAdminRole(role)) return true;
  if (route.regular) return true;
  if (route.adminOnly) return false;
  if (!route.roles?.length) return false;
  return route.roles.includes(role);
}

export function getMobileBubbleRoutes(role: MobileUserRole): MobileRouteItem[] {
  return mobileRoutes
    .filter((route) => route.showInBottomBubble !== false)
    .filter((route) => canAccessMobileRoute(route, role))
    .sort((a, b) => a.priority - b.priority);
}

export function getPublicMobilePaths(): string[] {
  return mobileRoutes.filter((route) => route.public).map((route) => route.path);
}