import React, {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Loader2,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'

import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { format12hr } from '../../utils/timeFormat'

import {
  getEmployeeTabs,
  isAdmin,
  isEmployeeProfile,
  type EmployeeProfileLike,
  type EmployeeTabId,
} from './permissions'

import { OnlineEmployees } from './components/OnlineEmployees'

/**
 * Lazy loading prevents the employee portal from loading every department
 * module before the employee actually opens it.
 */
const HomeTab = lazy(() => import('./tabs/HomeTab'))
const ClockTab = lazy(() => import('./tabs/ClockTab'))
const ScheduleTab = lazy(() => import('./tabs/ScheduleTab'))
const ChatTab = lazy(() => import('./tabs/ChatTab'))
const TasksTab = lazy(() => import('./tabs/TasksTab'))
const ReportsTab = lazy(() => import('./tabs/ReportsTab'))
const AnnouncementsTab = lazy(() => import('./tabs/AnnouncementsTab'))
const ChangeRequestsTab = lazy(() => import('./tabs/ChangeRequestsTab'))
const FrontendStudioTab = lazy(() => import('./tabs/FrontendStudioTab'))
const DepartmentToolsTab = lazy(() => import('./tabs/DepartmentToolsTab'))
const ModerationTab = lazy(() => import('./tabs/ModerationTab'))
const ModActionsTab = lazy(() => import('./tabs/ModActionsTab'))
const ManagementTab = lazy(() => import('./tabs/ManagementTab'))
const HiringTab = lazy(() => import('./tabs/HiringTab'))
const AttendanceTab = lazy(() => import('./tabs/AttendanceTab'))
const RecordsTab = lazy(() => import('./tabs/RecordsTab'))
const PayrollTab = lazy(() => import('./tabs/PayrollTab'))
const EmploymentVerificationTab = lazy(
  () => import('./tabs/EmploymentVerificationTab'),
)
const DocumentsTab = lazy(
  () => import('./tabs/DocumentsTab'),
)

type WorkSessionStatus = 'working' | 'break' | 'meal' | string

interface ActiveWorkSession {
  id: string
  officer_id: string
  clock_in: string
  clock_out: string | null
  status: WorkSessionStatus | null
  created_at?: string
  updated_at?: string
}

interface ClockStatusResult {
  session: ActiveWorkSession | null
  loading: boolean
  error: string | null
}

interface EmployeeTabProps {
  profile: EmployeeProfileLike | null
  realProfile: EmployeeProfileLike
  previewMode?: boolean
}

const TAB_COMPONENTS: Record<
  EmployeeTabId,
  React.ComponentType<EmployeeTabProps>
> = {
  home: HomeTab,
  clock: ClockTab,
  schedule: ScheduleTab,
  chat: ChatTab,
  tasks: TasksTab,
  reports: ReportsTab,
  announcements: AnnouncementsTab,
  change_requests: ChangeRequestsTab,
  frontend_studio: FrontendStudioTab,
  department_tools: DepartmentToolsTab,
  moderation: ModerationTab,
  mod_actions: ModActionsTab,
  management: ManagementTab,
  hiring: HiringTab as React.ComponentType<EmployeeTabProps>,
  attendance: AttendanceTab,
  records: RecordsTab,
  payroll: PayrollTab,
  employment_verification: EmploymentVerificationTab,
  documents: DocumentsTab,
}

const ADMIN_PREVIEW_ROLES = [
  'troll_officer',
  'lead_troll_officer',
  'secretary',
  'ceo_assistant',
  'noah_assistant',
] as const

function formatRoleName(role?: string | null): string {
  if (!role) return 'Employee'

  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getSessionLabel(session: ActiveWorkSession | null): string {
  if (!session) return 'Clocked Out'

  switch (session.status) {
    case 'break':
      return 'On Break'
    case 'meal':
      return 'Meal Period'
    default:
      return 'Clocked In'
  }
}

function getSessionStatusClasses(
  session: ActiveWorkSession | null,
): string {
  if (!session) {
    return 'border-slate-700 bg-slate-800/80 text-slate-300'
  }

  if (session.status === 'break' || session.status === 'meal') {
    return 'border-amber-400/20 bg-amber-500/10 text-amber-200'
  }

  return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
}

function getSessionIndicatorClasses(
  session: ActiveWorkSession | null,
): string {
  if (!session) return 'bg-slate-400'

  if (session.status === 'break' || session.status === 'meal') {
    return 'bg-amber-400'
  }

  return 'animate-pulse bg-emerald-400'
}

function useClockStatus(userId?: string | null): ClockStatusResult {
  const [session, setSession] = useState<ActiveWorkSession | null>(null)
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setSession(null)
      setLoading(false)
      setError(null)
      return
    }

    let mounted = true

    const loadActiveSession = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('officer_work_sessions')
          .select(
            `
              id,
              officer_id,
              clock_in,
              clock_out,
              status,
              created_at,
              updated_at
            `,
          )
          .eq('officer_id', userId)
          .is('clock_out', null)
          .order('clock_in', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (queryError) {
          throw queryError
        }

        if (!mounted) return

        setSession((data as ActiveWorkSession | null) ?? null)
        setError(null)
      } catch (loadError) {
        console.error('Unable to load active employee work session:', loadError)

        if (!mounted) return

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load work status.',
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadActiveSession()

    const channel = supabase
      .channel(`employee-work-session:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'officer_work_sessions',
          filter: `officer_id=eq.${userId}`,
        },
        () => {
          void loadActiveSession()
        },
      )
      .subscribe((status) => {
        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT'
        ) {
          console.error(
            `Employee work-session subscription failed: ${status}`,
          )
        }
      })

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [userId])

  return {
    session,
    loading,
    error,
  }
}

export default function EmployeesPage() {
  const { user, profile } = useAuthStore()

  const employeeProfile =
    profile as EmployeeProfileLike | null

  /**
   * Navigation permissions always come from the employee's real profile.
   * Admin preview must never grant additional access.
   */
  const authorizedTabs = useMemo(
    () => getEmployeeTabs(employeeProfile),
    [employeeProfile],
  )

  const [activeTab, setActiveTab] =
    useState<EmployeeTabId>('home')
  const [previewRole, setPreviewRole] =
    useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] =
    useState(false)

  const {
    session: activeSession,
    loading: clockStatusLoading,
    error: clockStatusError,
  } = useClockStatus(user?.id)

  const selectedTab = useMemo(
    () =>
      authorizedTabs.find((tab) => tab.id === activeTab) ??
      authorizedTabs.find((tab) => tab.id === 'home') ??
      authorizedTabs[0],
    [activeTab, authorizedTabs],
  )

  const previewProfile = useMemo<EmployeeProfileLike | null>(() => {
    if (!employeeProfile) return null
    if (!previewRole) return employeeProfile

    return {
      ...employeeProfile,
      role: previewRole,
    }
  }, [employeeProfile, previewRole])

  useEffect(() => {
    if (!authorizedTabs.length) return

    const activeTabIsAuthorized = authorizedTabs.some(
      (tab) => tab.id === activeTab,
    )

    if (!activeTabIsAuthorized) {
      const fallbackTab =
        authorizedTabs.find((tab) => tab.id === 'home') ??
        authorizedTabs[0]

      if (fallbackTab) {
        setActiveTab(fallbackTab.id)
      }
    }
  }, [activeTab, authorizedTabs])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [activeTab])

  useEffect(() => {
    if (!isAdmin(employeeProfile)) {
      setPreviewRole(null)
    }
  }, [employeeProfile])

  if (!user) {
    return <EmployeePortalLoading />
  }

  if (!isEmployeeProfile(employeeProfile)) {
    return <EmployeeAccessDenied />
  }

  if (!authorizedTabs.length || !selectedTab) {
    return <NoEmployeeModules />
  }

  const ActiveComponent =
    TAB_COMPONENTS[selectedTab.id] ?? HomeTab

  const handleTabChange = (tabId: EmployeeTabId) => {
    const hasAccess = authorizedTabs.some(
      (tab) => tab.id === tabId,
    )

    if (!hasAccess) {
      console.warn(
        `Blocked unauthorized employee tab navigation: ${tabId}`,
      )
      return
    }

    setActiveTab(tabId)
  }

  return (
    <div className="min-h-screen bg-[#080B12] text-white">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-3 sm:p-4 md:flex-row md:gap-6 md:p-6">
        <DesktopSidebar
          profile={employeeProfile}
          currentUserId={user.id}
          tabs={authorizedTabs}
          activeTab={selectedTab.id}
          activeSession={activeSession}
          clockStatusLoading={clockStatusLoading}
          clockStatusError={clockStatusError}
          onTabChange={handleTabChange}
        />

        <main className="min-w-0 flex-1">
          <div className="space-y-4">
            <MobileHeader
              profile={employeeProfile}
              activeSession={activeSession}
              clockStatusLoading={clockStatusLoading}
              mobileNavOpen={mobileNavOpen}
              onToggleNavigation={() =>
                setMobileNavOpen((current) => !current)
              }
            />

            {mobileNavOpen && (
              <MobileNavigation
                tabs={authorizedTabs}
                activeTab={selectedTab.id}
                onTabChange={handleTabChange}
                onClose={() => setMobileNavOpen(false)}
              />
            )}

            {isAdmin(employeeProfile) && (
              <AdminPreviewBar
                previewRole={previewRole}
                setPreviewRole={setPreviewRole}
              />
            )}

            <EmployeePageHeading
              title={selectedTab.label}
              role={previewRole ?? employeeProfile.role}
              previewMode={Boolean(previewRole)}
            />

            <Suspense
              fallback={
                <EmployeeModuleLoading
                  moduleName={selectedTab.label}
                />
              }
            >
              <ActiveComponent
                profile={previewProfile}
                realProfile={employeeProfile}
                previewMode={Boolean(previewRole)}
              />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}

interface DesktopSidebarProps {
  profile: EmployeeProfileLike
  currentUserId: string
  tabs: ReturnType<typeof getEmployeeTabs>
  activeTab: EmployeeTabId
  activeSession: ActiveWorkSession | null
  clockStatusLoading: boolean
  clockStatusError: string | null
  onTabChange: (tabId: EmployeeTabId) => void
}

function DesktopSidebar({
  profile,
  currentUserId,
  tabs,
  activeTab,
  activeSession,
  clockStatusLoading,
  clockStatusError,
  onTabChange,
}: DesktopSidebarProps) {
  return (
    <aside className="hidden w-72 shrink-0 md:block">
      <div className="sticky top-6 space-y-4">
        <EmployeesHeader
          profile={profile}
          activeSession={activeSession}
          clockStatusLoading={clockStatusLoading}
          clockStatusError={clockStatusError}
        />

        <nav
          aria-label="Employee portal navigation"
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/95 shadow-2xl shadow-black/20"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Employee Workspace
            </p>
          </div>

          <div className="space-y-1 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const tabIsActive = tab.id === activeTab

              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={
                    tabIsActive ? 'page' : undefined
                  }
                  onClick={() => onTabChange(tab.id)}
                  className={[
                    'group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition',
                    tabIsActive
                      ? 'bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/20'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  ].join(' ')}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={[
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition',
                        tabIsActive
                          ? 'bg-cyan-400/15 text-cyan-300'
                          : 'bg-white/5 text-slate-400 group-hover:text-white',
                      ].join(' ')}
                    >
                      <Icon
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </span>

                    <span className="truncate text-sm font-semibold">
                      {tab.label}
                    </span>
                  </span>

                  <ChevronRight
                    className={[
                      'h-4 w-4 shrink-0 transition',
                      tabIsActive
                        ? 'text-cyan-300'
                        : 'text-slate-600 group-hover:text-slate-300',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                </button>
              )
            })}
          </div>
        </nav>

        <OnlineEmployees currentUserId={currentUserId} />
      </div>
    </aside>
  )
}

interface MobileHeaderProps {
  profile: EmployeeProfileLike
  activeSession: ActiveWorkSession | null
  clockStatusLoading: boolean
  mobileNavOpen: boolean
  onToggleNavigation: () => void
}

function MobileHeader({
  profile,
  activeSession,
  clockStatusLoading,
  mobileNavOpen,
  onToggleNavigation,
}: MobileHeaderProps) {
  return (
    <header className="rounded-2xl border border-white/10 bg-[#101520]/95 p-3 shadow-xl shadow-black/20 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20">
            <BriefcaseBusiness
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">
              Employee Operations
            </p>

            <p className="truncate text-xs text-slate-400">
              {formatRoleName(profile.role)}
            </p>

            <div className="mt-1 flex items-center gap-1.5">
              {clockStatusLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                  <span className="text-[11px] text-slate-400">
                    Checking status
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={`h-2 w-2 rounded-full ${getSessionIndicatorClasses(
                      activeSession,
                    )}`}
                  />
                  <span className="text-[11px] font-semibold text-slate-300">
                    {getSessionLabel(activeSession)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label={
            mobileNavOpen
              ? 'Close employee navigation'
              : 'Open employee navigation'
          }
          aria-expanded={mobileNavOpen}
          onClick={onToggleNavigation}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
        >
          {mobileNavOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  )
}

interface MobileNavigationProps {
  tabs: ReturnType<typeof getEmployeeTabs>
  activeTab: EmployeeTabId
  onTabChange: (tabId: EmployeeTabId) => void
  onClose: () => void
}

function MobileNavigation({
  tabs,
  activeTab,
  onTabChange,
  onClose,
}: MobileNavigationProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101520]/95 p-3 shadow-xl shadow-black/20 md:hidden">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          Employee Menu
        </p>

        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-slate-400 hover:text-white"
        >
          Close
        </button>
      </div>

      <nav
        aria-label="Mobile employee portal navigation"
        className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const tabIsActive = tab.id === activeTab

          return (
            <button
              key={tab.id}
              type="button"
              aria-current={
                tabIsActive ? 'page' : undefined
              }
              onClick={() => onTabChange(tab.id)}
              className={[
                'flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                tabIsActive
                  ? 'border-cyan-400/20 bg-cyan-500/15 text-cyan-100'
                  : 'border-white/5 bg-white/[0.03] text-slate-300 hover:bg-white/5',
              ].join(' ')}
            >
              <Icon
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span className="text-xs font-bold">
                {tab.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

interface EmployeesHeaderProps {
  profile: EmployeeProfileLike
  activeSession: ActiveWorkSession | null
  clockStatusLoading: boolean
  clockStatusError: string | null
}

function EmployeesHeader({
  profile,
  activeSession,
  clockStatusLoading,
  clockStatusError,
}: EmployeesHeaderProps) {
  const employeeName =
    profile.username?.trim() ||
    'Employee'

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/95 shadow-2xl shadow-black/20">
      <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-transparent to-violet-500/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20">
            <UserRound
              className="h-6 w-6"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Mai Troll Employee
            </p>

            <h1 className="mt-1 truncate text-lg font-black text-white">
              {employeeName}
            </h1>

            <p className="mt-0.5 text-xs font-semibold text-cyan-300">
              {formatRoleName(profile.role)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Current Work Status
        </p>

        {clockStatusLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
            <span className="text-xs font-semibold text-slate-300">
              Checking work session…
            </span>
          </div>
        ) : (
          <div
            className={`rounded-xl border px-3 py-2.5 ${getSessionStatusClasses(
              activeSession,
            )}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${getSessionIndicatorClasses(
                  activeSession,
                )}`}
              />

              <span className="text-xs font-bold">
                {getSessionLabel(activeSession)}
              </span>
            </div>

            {activeSession?.clock_in && (
              <p className="mt-1 pl-[18px] text-[11px] opacity-75">
                Started at{' '}
                {format12hr(
                  new Date(activeSession.clock_in),
                )}
              </p>
            )}
          </div>
        )}

        {clockStatusError && (
          <p className="mt-2 text-[11px] text-rose-300">
            Work status may be temporarily unavailable.
          </p>
        )}
      </div>
    </section>
  )
}

interface EmployeePageHeadingProps {
  title: string
  role?: string | null
  previewMode: boolean
}

function EmployeePageHeading({
  title,
  role,
  previewMode,
}: EmployeePageHeadingProps) {
  return (
    <header className="rounded-2xl border border-white/10 bg-[#101520]/75 px-4 py-4 sm:px-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Employee Operations Portal
          </p>

          <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-2 self-start rounded-xl border border-white/10 bg-black/20 px-3 py-2 sm:self-auto">
          {previewMode ? (
            <ShieldCheck
              className="h-4 w-4 text-amber-300"
              aria-hidden="true"
            />
          ) : (
            <BriefcaseBusiness
              className="h-4 w-4 text-cyan-300"
              aria-hidden="true"
            />
          )}

          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
              {previewMode
                ? 'Previewing Role'
                : 'Assigned Role'}
            </p>

            <p className="text-xs font-bold text-slate-200">
              {formatRoleName(role)}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}

interface AdminPreviewBarProps {
  previewRole: string | null
  setPreviewRole: (role: string | null) => void
}

function AdminPreviewBar({
  previewRole,
  setPreviewRole,
}: AdminPreviewBarProps) {
  const [expanded, setExpanded] = useState(
    Boolean(previewRole),
  )

  useEffect(() => {
    if (previewRole) {
      setExpanded(true)
    }
  }, [previewRole])

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-400/20 bg-amber-500/[0.06]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300">
            <ShieldCheck
              className="h-4 w-4"
              aria-hidden="true"
            />
          </div>

          <div>
            <p className="text-xs font-black text-amber-100">
              Administrative Role Preview
            </p>

            <p className="mt-0.5 text-[11px] text-amber-100/60">
              Preview employee-facing content without changing
              account permissions.
            </p>
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-amber-300 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="border-t border-amber-400/10 px-4 py-4">
          <div className="flex flex-wrap gap-2">
            {ADMIN_PREVIEW_ROLES.map((role) => {
              const roleIsSelected =
                previewRole === role

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() =>
                    setPreviewRole(
                      roleIsSelected ? null : role,
                    )
                  }
                  className={[
                    'rounded-lg border px-3 py-2 text-xs font-bold transition',
                    roleIsSelected
                      ? 'border-amber-300/40 bg-amber-500/20 text-amber-100'
                      : 'border-white/10 bg-black/10 text-slate-300 hover:border-amber-300/20 hover:text-white',
                  ].join(' ')}
                >
                  {formatRoleName(role)}
                </button>
              )
            })}
          </div>

          {previewRole && (
            <div className="mt-3 flex flex-col justify-between gap-2 rounded-xl border border-amber-400/10 bg-black/15 px-3 py-2.5 sm:flex-row sm:items-center">
              <p className="text-xs text-amber-100/80">
                Previewing content as{' '}
                <span className="font-black text-amber-100">
                  {formatRoleName(previewRole)}
                </span>
                . Your administrative permissions remain unchanged.
              </p>

              <button
                type="button"
                onClick={() => setPreviewRole(null)}
                className="self-start text-xs font-bold text-amber-300 underline decoration-amber-300/40 underline-offset-4 hover:text-amber-200 sm:self-auto"
              >
                Exit preview
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function EmployeeModuleLoading({
  moduleName,
}: {
  moduleName: string
}) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-[#101520]/75 p-8">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" />

        <p className="mt-4 text-sm font-bold text-slate-200">
          Loading {moduleName}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Preparing your employee workspace.
        </p>
      </div>
    </div>
  )
}

function EmployeePortalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080B12] px-4 text-white">
      <div className="text-center">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-300" />

        <h1 className="mt-4 text-xl font-black">
          Employee Operations
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Verifying your employee account.
        </p>
      </div>
    </div>
  )
}

function EmployeeAccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080B12] px-4 py-10 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#101520] p-6 text-center shadow-2xl shadow-black/30 sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-500/10 text-slate-300 ring-1 ring-white/10">
          <BriefcaseBusiness
            className="h-7 w-7"
            aria-hidden="true"
          />
        </div>

        <h1 className="mt-5 text-2xl font-black">
          Employee Access Required
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
          This portal is available only to approved Mai Troll
          employees with an active employee role.
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Interested in joining the team?
          </p>

          <p className="mt-2 text-sm text-slate-300">
            Review available positions and submit an official
            employment application through the Jobs page.
          </p>
        </div>

        <a
          href="/jobs"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300"
        >
          View Jobs
        </a>
      </div>
    </div>
  )
}

function NoEmployeeModules() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080B12] px-4 text-white">
      <div className="max-w-md rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-6 text-center">
        <h1 className="text-xl font-black text-rose-100">
          Employee Role Configuration Required
        </h1>

        <p className="mt-2 text-sm leading-6 text-rose-100/70">
          Your employee account is active, but no portal modules
          have been assigned to your role. Contact an administrator
          or Human Resources for assistance.
        </p>
      </div>
    </div>
  )
}