import { LayoutDashboard, ClipboardList, AlertTriangle, DollarSign, CreditCard, Shield, Landmark, Crown, FileText, Building2, Users, Bell, Briefcase, LogOut, ChevronRight, Activity, CalendarDays, CheckSquare, Coins, Music } from 'lucide-react'

type Section =
  | 'dashboard'
  | 'intake'
  | 'finance'
  | 'governance'
  | 'community'
  | 'administration'
  | 'my_dashboard'
  | 'security'

type View =
  | 'overview'
  | 'intake_queue'
  | 'reports'
  | 'alerts'
  | 'elections'
  | 'proposals'
  | 'neighbors'
  | 'ads'
  | 'staff'
  | 'calendar'
  | 'secretary_dashboard'
  | 'crown_redemptions'
  | 'coin_liability'
  | 'mai_record_label_contracts'

interface NavigationItem {
  id: View
  label: string
  icon: React.ReactNode
}

interface NavigationGroup {
  id: Section
  title: string
  icon: React.ReactNode
  items: NavigationItem[]
}

export const navigation: NavigationGroup[] = [
  {
    id: 'dashboard',
    title: 'Overview',
    icon: <LayoutDashboard className="w-4 h-4" />,
    items: [
      {
        id: 'overview',
        label: 'Operations Overview',
        icon: <Activity className="w-4 h-4" />
      }
    ]
  },

  {
    id: 'intake',
    title: 'Intake & Workflow',
    icon: <ClipboardList className="w-4 h-4" />,
    items: [
      {
        id: 'intake_queue',
        label: 'Intake Queue',
        icon: <ClipboardList className="w-4 h-4" />
      },
      {
        id: 'reports',
        label: 'Executive Reports',
        icon: <FileText className="w-4 h-4" />
      },
      {
        id: 'alerts',
        label: 'Critical Alerts',
        icon: <AlertTriangle className="w-4 h-4" />
      }
    ]
  },

  {
    id: 'finance',
    title: 'Finance',
    icon: <DollarSign className="w-4 h-4" />,
    items: [
      {
        id: 'coin_liability',
        label: 'Coin Liability',
        icon: <Coins className="w-4 h-4" />
      }
    ]
  },

  {
    id: 'governance',
    title: 'Governance',
    icon: <Landmark className="w-4 h-4" />,
    items: [
      {
        id: 'elections',
        label: 'Elections',
        icon: <Crown className="w-4 h-4" />
      },
      {
        id: 'proposals',
        label: 'Proposals',
        icon: <FileText className="w-4 h-4" />
      }
    ]
  },

  {
    id: 'community',
    title: 'Community',
    icon: <Building2 className="w-4 h-4" />,
    items: [
      {
        id: 'neighbors',
        label: 'Neighbors',
        icon: <Users className="w-4 h-4" />
      },
      {
        id: 'ads',
        label: 'Promo Ads',
        icon: <Bell className="w-4 h-4" />
      }
    ]
  },

  {
    id: 'administration',
    title: 'Administration',
    icon: <Briefcase className="w-4 h-4" />,
    items: [
      {
        id: 'staff',
        label: 'Staff Management',
        icon: <Users className="w-4 h-4" />
      },
      {
        id: 'mai_record_label_contracts',
        label: 'MAI Record Label',
        icon: <Music className="w-4 h-4" />
      },
      {
        id: 'calendar',
        label: 'Secretary Calendar',
        icon: <CalendarDays className="w-4 h-4" />
      },
      {
        id: 'crown_redemptions',
        label: 'Crown Redemptions',
        icon: <Crown className="w-4 h-4" />
      }
    ]
  },

  {
    id: 'my_dashboard',
    title: 'My Dashboard',
    icon: <CheckSquare className="w-4 h-4" />,
    items: [
      {
        id: 'secretary_dashboard',
        label: 'Secretary Dashboard',
        icon: <LayoutDashboard className="w-4 h-4" />
      }
    ]
  }
]