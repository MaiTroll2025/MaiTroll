import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Building2,
  ChevronRight,
  DollarSign,
  Gavel,
  Hand,
  History,
  Lock,
  Menu,
  PartyPopper,
  Scale,
  Scroll,
  Shield,
  Siren,
  TrendingUp,
  Users,
  Vote,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useGovernmentSystem } from '@/hooks/useGovernmentSystem'
import useSEO from '@/hooks/useSEO';

import LawsTab from '@/components/government/LawsTab'
import VotingTab from '@/components/government/VotingTab'
import JailTab from '@/components/government/JailTab'
import RolesTab from '@/components/government/RolesTab'
import HistoryTab from '@/components/government/HistoryTab'
import PartiesTab from '@/components/government/PartiesTab'
import CorruptionTab from '@/components/government/CorruptionTab'
import ProtestsTab from '@/components/government/ProtestsTab'
import EmergencyTab from '@/components/government/EmergencyTab'
import OfficerDashboardTab from '@/components/government/OfficerDashboardTab'

const pageShell =
  'relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#050714] px-4 pb-8 pt-24 text-white md:px-6'
const glassPanel =
  'rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const innerPanel =
  'rounded-2xl border border-cyan-300/15 bg-slate-950/65 shadow-[0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200'
const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white'

type TabId =
  | 'laws'
  | 'voting'
  | 'jail'
  | 'roles'
  | 'history'
  | 'parties'
  | 'corruption'
  | 'protests'
  | 'emergency'
  | 'officer-dashboard'

const roleStyles: Record<string, string> = {
  admin: 'border-red-300/30 bg-red-500/10 text-red-100',
  president: 'border-cyan-300/35 bg-cyan-400/10 text-cyan-100',
  secretary: 'border-blue-300/30 bg-blue-400/10 text-blue-100',
  lead: 'border-sky-300/30 bg-sky-400/10 text-sky-100',
  officer: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
  citizen: 'border-slate-400/30 bg-slate-500/10 text-slate-200',
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  president: 'President',
  secretary: 'Secretary',
  lead: 'Lead Officer',
  officer: 'Officer',
  citizen: 'Citizen',
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em]',
        roleStyles[role] || roleStyles.citizen
      )}
    >
      {roleLabels[role] || 'Citizen'}
    </span>
  )
}

const tabConfig: Record<
  TabId,
  {
    component: React.ComponentType<any>
    icon: React.ComponentType<any>
    label: string
    description: string
  }
> = {
  laws: {
    component: LawsTab,
    icon: Scroll,
    label: 'Laws',
    description: 'City legislation and statutes',
  },
  voting: {
    component: VotingTab,
    icon: Vote,
    label: 'Voting',
    description: 'Vote on active legislation',
  },
  jail: {
    component: JailTab,
    icon: Lock,
    label: 'Jail',
    description: 'Jail management and enforcement',
  },
  roles: {
    component: RolesTab,
    icon: Building2,
    label: 'Roles & Power',
    description: 'Government hierarchy and permissions',
  },
  history: {
    component: HistoryTab,
    icon: History,
    label: 'History',
    description: 'Government action history',
  },
  parties: {
    component: PartiesTab,
    icon: PartyPopper,
    label: 'Parties',
    description: 'Political parties and affiliations',
  },
  corruption: {
    component: CorruptionTab,
    icon: DollarSign,
    label: 'Corruption',
    description: 'Bribery and corruption tracking',
  },
  protests: {
    component: ProtestsTab,
    icon: Hand,
    label: 'Protests',
    description: 'City protests and demonstrations',
  },
  emergency: {
    component: EmergencyTab,
    icon: Siren,
    label: 'Emergency',
    description: 'Emergency powers and declarations',
  },
  'officer-dashboard': {
    component: OfficerDashboardTab,
    icon: Activity,
    label: 'Officer Dashboard',
    description: 'Officer operations and moderation',
  },
}

export default function GovernmentPage() {
   const { user } = useAuthStore()
   const navigate = useNavigate()
   const [searchParams, setSearchParams] = useSearchParams()
   const [sidebarOpen, setSidebarOpen] = useState(false)
   const [votingLawId, setVotingLawId] = useState<string | null>(null)

  useSEO({
    title: 'Government | Mai Troll - Digital Democracy & Community Leadership',
    description: 'Participate in Mai Troll government. Vote for leaders, run for office, debate policies, and shape the future of our virtual nation. Digital democracy at its finest.',
    keywords: [
      'online government', 'virtual government', 'community government',
      'digital leadership', 'online elections', 'virtual president',
      'community leadership', 'digital democracy', 'vote online',
      'MaiTroll government', 'civic engagement', 'platform governance'
    ]
  });

  const {
    laws,
    activeLaw,
    politicalParties,
    bribes,
    protests,
    reputation,
    cityReputation,
    governmentHistory,
    userProtestIds,
    loading,
    error,
    setActiveLaw,
    createLaw,
    voteOnLaw,
    fetchPoliticalParties,
    createPoliticalParty,
    submitBribe,
    exposeBribe,
    createProtest,
    joinProtest,
    leaveProtest,
    useEmergencyPower,
    getUserRoleLevel,
    getAvailableTabs,
    fetchGovernmentHistory,
  } = useGovernmentSystem()

const currentTab = searchParams.get('tab') || 'laws'
   const roleLevel = getUserRoleLevel()
   const availableTabs = getAvailableTabs()

   const handleVoteOnLaw = useCallback(async (lawId: string, vote: 'yes' | 'no' | 'abstain') => {
     setVotingLawId(lawId);
     try {
       await voteOnLaw(lawId, vote);
     } catch (err) {
       console.error('Vote failed:', err);
     } finally {
       setVotingLawId(null);
     }
   }, [voteOnLaw]);

  const activeTabMeta = tabConfig[currentTab as TabId]
  const ActiveComponent = activeTabMeta?.component

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find((tab) => tab.id === currentTab)) {
      setSearchParams({ tab: availableTabs[0].id })
    }
  }, [currentTab, availableTabs, setSearchParams])

  const cityStats = useMemo(
    () => [
      {
        label: 'Active Laws',
        value: cityReputation?.active_laws ?? 0,
        tone: 'text-cyan-200',
      },
      {
        label: 'Trust',
        value:
          cityReputation?.average_trust != null
            ? `${Math.round(cityReputation.average_trust)}%`
            : '--',
        tone: 'text-emerald-200',
      },
      {
        label: 'Protests',
        value: cityReputation?.protest_count ?? 0,
        tone: 'text-red-200',
      },
    ],
    [cityReputation]
  )

  if (!user) {
    return (
      <div className={pageShell}>
        <BackgroundFX />

        <div className="relative z-10 flex min-h-[calc(100vh-120px)] items-center justify-center">
          <div className={cn(glassPanel, 'max-w-md p-8 text-center')}>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
              <Lock className="h-10 w-10 text-cyan-200" />
            </div>

            <h1 className="text-3xl font-black text-white">Restricted Access</h1>

            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              You must be signed in as a Mai Troll citizen to access government systems.
            </p>

            <button onClick={() => navigate('/auth')} className={cn(primaryButton, 'mt-6')}>
              Login to Access
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={pageShell}>
      <BackgroundFX />

      <div className="relative z-10 mx-auto flex h-[calc(100vh-120px)] max-w-7xl flex-col gap-4">
        <header className={cn(glassPanel, 'shrink-0 p-5')}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <button
                onClick={() => setSidebarOpen((value) => !value)}
                className={cn(secondaryButton, 'px-3 lg:hidden')}
                aria-label={sidebarOpen ? 'Close government menu' : 'Open government menu'}
                aria-expanded={sidebarOpen}
                aria-controls="government-sidebar"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                <Scale className="h-6 w-6 text-cyan-200" />
              </div>

              <div className="min-w-0">
                <h1 className="bg-gradient-to-r from-cyan-200 via-blue-300 to-cyan-100 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                  Mai Troll Government
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Laws, voting, jail, protests, and officer operations.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="grid grid-cols-3 gap-2">
                {cityStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="min-w-[92px] rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center"
                  >
                    <p className={cn('text-lg font-black', stat.tone)}>{stat.value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              <RoleBadge role={roleLevel} />
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[330px_1fr]">
          <aside
            id="government-sidebar"
            aria-label="Government departments"
            className={cn(
              glassPanel,
              'fixed inset-y-0 left-0 z-50 w-[330px] translate-x-[-110%] overflow-hidden p-3 pb-20 transition-transform duration-200 lg:static lg:w-auto lg:translate-x-0 lg:pb-3',
              sidebarOpen && 'translate-x-0'
            )}
          >
            <div className="mb-4 flex items-center justify-between px-2 pt-2 lg:hidden">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">
                Government Menu
              </p>
              <button onClick={() => setSidebarOpen(false)} className={secondaryButton}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 px-2">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">
                City Branches
              </p>
              <p className="text-xs text-slate-500">
                {availableTabs.length} accessible departments
              </p>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1">
              {availableTabs.map((tab) => {
                const config = tabConfig[tab.id as TabId]
                const Icon = config?.icon || Scroll
                const isActive = currentTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setSearchParams({ tab: tab.id })
                      setSidebarOpen(false)
                    }}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                      isActive
                        ? 'border-cyan-300/40 bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)]'
                        : 'border-white/10 bg-slate-950/70 text-slate-400 hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-white'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-black">{config?.label || tab.name}</p>
                      <p
                        className={cn(
                          'line-clamp-1 text-xs',
                          isActive ? 'text-slate-700' : 'text-slate-500'
                        )}
                      >
                        {config?.description || tab.name}
                      </p>
                    </div>
                    {isActive && <ChevronRight className="h-4 w-4 shrink-0" />}
                  </button>
                )
              }              )}
            </div>

            <div className="mt-4 space-y-2 overflow-y-auto pr-1">
              <button
                onClick={() => {
                  navigate('/president')
                  setSidebarOpen(false)
                }}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                  'border-white/10 bg-slate-950/70 text-slate-400 hover:border-purple-300/25 hover:bg-purple-400/10 hover:text-white'
                )}
              >
                <Vote className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-black">Elections</p>
                  <p className="line-clamp-1 text-xs text-slate-500">
                    Presidential elections and candidates
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </button>
            </div>

            {reputation && (
              <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                  Your Reputation
                </p>

                <div className="space-y-3">
                  <MiniMetric
                    label="Government Trust"
                    value={
                      reputation.government_trust != null
                        ? `${Math.round(reputation.government_trust)}%`
                        : '--'
                    }
                    icon={<Shield className="h-4 w-4 text-cyan-300" />}
                  />
                  <MiniMetric
                    label="Influence"
                    value={
                      reputation.player_influence != null
                        ? String(Math.round(reputation.player_influence))
                        : '--'
                    }
                    icon={<TrendingUp className="h-4 w-4 text-cyan-300" />}
                  />
                </div>
              </div>
            )}
          </aside>

          {sidebarOpen && (
            <button
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close government sidebar"
            />
          )}

          <main className={cn(glassPanel, 'min-h-0 overflow-hidden p-4 md:p-5')}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-300/15 pb-4">
              <div>
                <h2 className="text-2xl font-black text-white">
                  {activeTabMeta?.label || 'Government'}
                </h2>
                <p className="text-sm text-slate-400">
                  {activeTabMeta?.description || 'Select a government department.'}
                </p>
              </div>

              <RoleBadge role={roleLevel} />
            </div>

            <div className="h-[calc(100%-88px)] overflow-auto pr-1">
              {loading ? (
                <div className="flex h-full min-h-[380px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-200/70">
                      Loading Government
                    </p>
                  </div>
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-5 text-red-100">
                  {error}
                </div>
              ) : ActiveComponent ? (
                <div className={cn(innerPanel, 'min-h-full p-4')}>
<ActiveComponent
                     laws={laws}
                     activeLaw={activeLaw}
                     politicalParties={politicalParties}
                     bribes={bribes}
                     protests={protests}
                     reputation={reputation}
                     cityReputation={cityReputation}
                     onSetActiveLaw={setActiveLaw}
                     onCreateLaw={createLaw}
                     onVoteOnLaw={handleVoteOnLaw}
                     votingLawId={votingLawId}
                     onFetchPoliticalParties={fetchPoliticalParties}
                     onCreatePoliticalParty={createPoliticalParty}
                     onSubmitBribe={submitBribe}
                     onExposeBribe={exposeBribe}
                     onCreateProtest={createProtest}
                     onJoinProtest={joinProtest}
                     onLeaveProtest={leaveProtest}
                     onUseEmergencyPower={useEmergencyPower}
                     onFetchGovernmentHistory={fetchGovernmentHistory}
                     roleLevel={roleLevel}
                     userId={user?.id}
                     governmentHistory={governmentHistory}
                     userProtestIds={userProtestIds}
                   />
                </div>
              ) : (
                <div className="flex min-h-[380px] items-center justify-center text-center">
                  <div>
                    <AlertTriangle className="mx-auto mb-4 h-14 w-14 text-slate-600" />
                    <h3 className="text-xl font-black text-slate-300">No Tab Selected</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Select a tab from the government menu.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function BackgroundFX() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />
    </>
  )
}

function MiniMetric({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-bold text-slate-400">{label}</span>
      </div>
      <span className="font-black text-cyan-100">{value}</span>
    </div>
  )
}
