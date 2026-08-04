import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Flag,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { PermissionGate } from '../components/PermissionGate'

type TaskStatus =
  | 'assigned'
  | 'in_progress'
  | 'blocked'
  | 'awaiting_review'
  | 'completed'
  | 'cancelled'

type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

type EmployeeRole =
  | 'troll_officer'
  | 'lead_troll_officer'
  | 'secretary'
  | 'ceo_assistant'
  | 'noah_assistant'
  | 'admin'
  | 'broadcaster'
  | 'broadofficer'
  | 'employee'
  | string

interface TasksTabProps {
  profile?: EmployeeProfileLike | null
  realProfile?: EmployeeProfileLike | null
  previewMode?: boolean
}

interface EmployeeProfileLike {
  id?: string
  username?: string | null
  role?: EmployeeRole | null
  is_admin?: boolean | null
  [key: string]: unknown
}

interface EmployeeProfile {
  id: string
  username: string | null
  role: EmployeeRole | null
}

interface EmployeeTask {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  assigned_to: string | null
  assigned_by: string
  assigned_role?: EmployeeRole | null
  department?: string | null
  due_date?: string | null
  category?: string | null
  created_at: string
  updated_at?: string | null
  completed_at?: string | null
  assignee?: EmployeeProfile | null
  assigner?: EmployeeProfile | null
}

interface RoleTaskTemplate {
  title: string
  description: string
  category: string
  priority: TaskPriority
}

interface TaskFormState {
  title: string
  description: string
  priority: TaskPriority
  assignedRole: string
  assignedTo: string
  category: string
  dueDate: string
}

const EMPLOYEE_ROLES: Array<{
  value: string
  label: string
  department: string
}> = [
  {
    value: 'troll_officer',
    label: 'Troll Officer',
    department: 'Moderation',
  },
  {
    value: 'lead_troll_officer',
    label: 'Lead Troll Officer',
    department: 'Moderation Management',
  },
  {
    value: 'secretary',
    label: 'Secretary',
    department: 'Administration',
  },
  {
    value: 'ceo_assistant',
    label: 'CEO Assistant',
    department: 'Executive Office',
  },
  {
    value: 'noah_assistant',
    label: 'Noah Assistant',
    department: 'Executive Support',
  },
  {
    value: 'admin',
    label: 'Administrator',
    department: 'Administration',
  },
  {
    value: 'broadofficer',
    label: 'Broadcast Officer',
    department: 'Broadcast Operations',
  },
  {
    value: 'broadcaster',
    label: 'Broadcaster',
    department: 'Broadcasting',
  },
]

const ROLE_TASK_TEMPLATES: Record<string, RoleTaskTemplate[]> = {
  troll_officer: [
    {
      title: 'Review assigned live broadcasts',
      description:
        'Monitor assigned live broadcasts, respond to reported violations, and document any moderation action taken.',
      category: 'Broadcast Monitoring',
      priority: 'normal',
    },
    {
      title: 'Review moderation reports',
      description:
        'Review pending user and broadcast reports assigned to your moderation queue.',
      category: 'Report Review',
      priority: 'high',
    },
    {
      title: 'Complete shift incident report',
      description:
        'Submit a complete incident report for moderation actions taken during the assigned shift.',
      category: 'Incident Reporting',
      priority: 'normal',
    },
    {
      title: 'Verify active broadcast coverage',
      description:
        'Confirm assigned live broadcasts have active officer coverage and escalate coverage gaps.',
      category: 'Coverage',
      priority: 'high',
    },
  ],

  lead_troll_officer: [
    {
      title: 'Assign officer broadcast coverage',
      description:
        'Review active broadcasts and assign available Troll Officers based on current coverage requirements.',
      category: 'Staff Assignment',
      priority: 'high',
    },
    {
      title: 'Review officer incident reports',
      description:
        'Review moderation incident reports submitted by Troll Officers and approve, return, or escalate them.',
      category: 'Incident Review',
      priority: 'high',
    },
    {
      title: 'Conduct officer shift review',
      description:
        'Review officer attendance, actions, unresolved reports, and shift performance.',
      category: 'Shift Management',
      priority: 'normal',
    },
    {
      title: 'Escalate serious safety incident',
      description:
        'Prepare and escalate any serious safety, threat, or platform emergency incident to administration.',
      category: 'Safety Escalation',
      priority: 'urgent',
    },
  ],

  secretary: [
    {
      title: 'Review employee attendance records',
      description:
        'Review employee clock-in records, missed shifts, attendance requests, and unresolved corrections.',
      category: 'Attendance',
      priority: 'normal',
    },
    {
      title: 'Prepare employee announcement',
      description:
        'Draft and publish an approved internal announcement for employees.',
      category: 'Communications',
      priority: 'normal',
    },
    {
      title: 'Organize employee records',
      description:
        'Review assigned employee records and ensure required documentation is complete and properly categorized.',
      category: 'Records',
      priority: 'normal',
    },
    {
      title: 'Review schedule change requests',
      description:
        'Review pending employee schedule, absence, and time-off requests requiring administrative handling.',
      category: 'Scheduling',
      priority: 'high',
    },
  ],

  ceo_assistant: [
    {
      title: 'Prepare executive daily briefing',
      description:
        'Prepare a summary of platform activity, employee issues, urgent reports, pending decisions, and major business updates.',
      category: 'Executive Briefing',
      priority: 'high',
    },
    {
      title: 'Track executive action items',
      description:
        'Review open executive action items, update progress, and identify overdue decisions.',
      category: 'Executive Operations',
      priority: 'high',
    },
    {
      title: 'Review department updates',
      description:
        'Collect and summarize updates from moderation, administration, broadcasting, and platform operations.',
      category: 'Department Reporting',
      priority: 'normal',
    },
    {
      title: 'Prepare meeting materials',
      description:
        'Prepare notes, supporting records, reports, and action items for an upcoming executive meeting.',
      category: 'Meetings',
      priority: 'normal',
    },
  ],

  noah_assistant: [
    {
      title: 'Review assigned operational requests',
      description:
        'Review operational requests assigned to the Noah Assistant office and document the required next action.',
      category: 'Operational Support',
      priority: 'normal',
    },
    {
      title: 'Prepare platform issue summary',
      description:
        'Summarize assigned platform issues, user concerns, or department requests for management review.',
      category: 'Issue Reporting',
      priority: 'high',
    },
    {
      title: 'Follow up on pending action items',
      description:
        'Contact the responsible department or employee and update the status of pending action items.',
      category: 'Follow-Up',
      priority: 'normal',
    },
    {
      title: 'Verify task completion evidence',
      description:
        'Review notes, records, or supporting evidence submitted for completed operational tasks.',
      category: 'Quality Review',
      priority: 'normal',
    },
  ],

  broadofficer: [
    {
      title: 'Review assigned broadcaster',
      description:
        'Review the assigned broadcaster’s active session, broadcast health, viewer activity, and reported issues.',
      category: 'Broadcast Operations',
      priority: 'normal',
    },
    {
      title: 'Resolve broadcast support issue',
      description:
        'Investigate and resolve an assigned broadcaster support or technical issue.',
      category: 'Broadcaster Support',
      priority: 'high',
    },
    {
      title: 'Verify broadcast compliance',
      description:
        'Confirm the assigned broadcast complies with current Mai Troll broadcasting requirements.',
      category: 'Compliance',
      priority: 'normal',
    },
  ],

  broadcaster: [
    {
      title: 'Review upcoming broadcast schedule',
      description:
        'Confirm your upcoming broadcast schedule and report any scheduling conflicts.',
      category: 'Broadcast Planning',
      priority: 'normal',
    },
    {
      title: 'Complete broadcast preparation checklist',
      description:
        'Verify camera, microphone, internet connection, lighting, and broadcast environment before going live.',
      category: 'Broadcast Preparation',
      priority: 'normal',
    },
    {
      title: 'Submit broadcast issue report',
      description:
        'Document any technical or operational issue that affected your broadcast.',
      category: 'Issue Reporting',
      priority: 'high',
    },
  ],

  admin: [
    {
      title: 'Review unresolved employee issues',
      description:
        'Review unresolved employee, attendance, moderation, scheduling, and operational issues.',
      category: 'Administration',
      priority: 'high',
    },
    {
      title: 'Review platform compliance report',
      description:
        'Review current compliance, moderation, safety, and employee access reports.',
      category: 'Compliance',
      priority: 'high',
    },
    {
      title: 'Complete administrative audit',
      description:
        'Audit assigned employee records, task actions, permissions, and department activity.',
      category: 'Audit',
      priority: 'normal',
    },
  ],
}

const INITIAL_FORM: TaskFormState = {
  title: '',
  description: '',
  priority: 'normal',
  assignedRole: '',
  assignedTo: '',
  category: '',
  dueDate: '',
}

function formatRole(role?: string | null): string {
  if (!role) return 'Employee'

  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    )
}

function formatStatus(status: TaskStatus): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    )
}

function formatPriority(priority: TaskPriority): string {
  return priority
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    )
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDueDate(value?: string | null): string {
  if (!value) return 'No due date'

  // Handle both plain date strings (YYYY-MM-DD) and full ISO timestamps.
  const datePart = value.split('T')[0]
  const [year, month, day] = datePart.split('-').map(Number)

  const date =
    Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
      ? new Date(year, month - 1, day)
      : new Date(value)

  if (Number.isNaN(date.getTime())) return 'No due date'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getPriorityClasses(
  priority: TaskPriority,
): string {
  switch (priority) {
    case 'urgent':
      return 'border-rose-400/20 bg-rose-500/10 text-rose-200'
    case 'high':
      return 'border-orange-400/20 bg-orange-500/10 text-orange-200'
    case 'low':
      return 'border-slate-500/20 bg-slate-500/10 text-slate-300'
    default:
      return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200'
  }
}

function getStatusClasses(status: TaskStatus): string {
  switch (status) {
    case 'completed':
      return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
    case 'in_progress':
      return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200'
    case 'blocked':
      return 'border-rose-400/20 bg-rose-500/10 text-rose-200'
    case 'awaiting_review':
      return 'border-violet-400/20 bg-violet-500/10 text-violet-200'
    case 'cancelled':
      return 'border-slate-500/20 bg-slate-500/10 text-slate-400'
    default:
      return 'border-amber-400/20 bg-amber-500/10 text-amber-200'
  }
}

function getAllowedStatusChanges(
  task: EmployeeTask,
  currentUserId?: string,
): TaskStatus[] {
  if (!currentUserId) return []

  const isAssignedEmployee =
    task.assigned_to === currentUserId

  if (!isAssignedEmployee) return []

  switch (task.status) {
    case 'assigned':
      return ['in_progress', 'blocked']
    case 'in_progress':
      return ['blocked', 'awaiting_review']
    case 'blocked':
      return ['in_progress', 'awaiting_review']
    case 'awaiting_review':
    case 'completed':
    case 'cancelled':
      return []
    default:
      return []
  }
}

function getDepartmentForRole(role?: string | null): string {
  return (
    EMPLOYEE_ROLES.find((item) => item.value === role)
      ?.department ?? 'General Operations'
  )
}

export default function TasksTab({
  profile,
  realProfile,
  previewMode = false,
}: TasksTabProps) {
  const { user } = useAuthStore()

  const actualProfile = realProfile ?? profile
  const actualRole = actualProfile?.role ?? null

  const [tasks, setTasks] = useState<EmployeeTask[]>([])
  const [employees, setEmployees] = useState<
    EmployeeProfile[]
  >([])
  const [loading, setLoading] = useState(true)
  const [employeeLoading, setEmployeeLoading] =
    useState(false)
  const [loadError, setLoadError] =
    useState<string | null>(null)
  const [filter, setFilter] =
    useState<'active' | 'completed' | 'all'>('active')
  const [searchTerm, setSearchTerm] = useState('')

  const loadTasks = useCallback(async () => {
    if (!user?.id) {
      setTasks([])
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(null)

    try {
      const filters = [
        `assigned_to.eq.${user.id}`,
        `assigned_by.eq.${user.id}`,
      ]

      if (actualRole) {
        filters.push(`assigned_role.eq.${actualRole}`)
      }

      const { data, error } = await supabase
        .from('employee_tasks')
        .select(
          `
            id,
            title,
            description,
            priority,
            status,
            assigned_to,
            assigned_by,
            assigned_role,
            department,
            due_date,
            category,
            created_at,
            updated_at,
            completed_at
          `,
        )
        .or(filters.join(','))
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        throw error
      }

      let loadedTasks =
        (data as EmployeeTask[] | null) ?? []

      const profileIds = [
        ...new Set(
          loadedTasks
            .flatMap((task) => [
              task.assigned_to,
              task.assigned_by,
            ])
            .filter(
              (id): id is string => Boolean(id),
            ),
        ),
      ]

      if (profileIds.length > 0) {
        const { data: profileData, error: profileError } =
          await supabase
            .from('user_profiles')
            .select('id, username, role')
            .in('id', profileIds)

        if (profileError) {
          throw profileError
        }

        const profileMap = new Map(
          (
            (profileData as EmployeeProfile[] | null) ??
            []
          ).map((employee) => [
            employee.id,
            employee,
          ]),
        )

        loadedTasks = loadedTasks.map((task) => ({
          ...task,
          assignee: task.assigned_to
            ? profileMap.get(task.assigned_to) ?? null
            : null,
          assigner:
            profileMap.get(task.assigned_by) ?? null,
        }))
      }

      setTasks(loadedTasks)
    } catch (error) {
      console.error('Unable to load employee tasks:', error)

      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load employee tasks.',
      )
    } finally {
      setLoading(false)
    }
  }, [actualRole, user?.id])

  const loadEmployees = useCallback(async () => {
    setEmployeeLoading(true)

    try {
      const allowedRoles = EMPLOYEE_ROLES.map(
        (role) => role.value,
      )

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, role')
        .in('role', allowedRoles)
        .order('username', { ascending: true })

      if (error) {
        throw error
      }

      setEmployees(
        (data as EmployeeProfile[] | null) ?? [],
      )
    } catch (error) {
      console.error(
        'Unable to load employee directory:',
        error,
      )

      toast.error(
        error instanceof Error
          ? error.message
          : 'Employee directory could not be loaded.',
      )
    } finally {
      setEmployeeLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`employee-tasks:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_tasks',
        },
        () => {
          void loadTasks()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadTasks, user?.id])

  const filteredTasks = useMemo(() => {
    const normalizedSearch =
      searchTerm.trim().toLowerCase()

    return tasks.filter((task) => {
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'completed'
            ? task.status === 'completed'
            : !['completed', 'cancelled'].includes(
                task.status,
              )

      const matchesSearch =
        !normalizedSearch ||
        task.title
          .toLowerCase()
          .includes(normalizedSearch) ||
        task.description
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        task.category
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        task.assignee?.username
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        task.assigner?.username
          ?.toLowerCase()
          .includes(normalizedSearch)

      return matchesFilter && matchesSearch
    })
  }, [filter, searchTerm, tasks])

  const summary = useMemo(() => {
    const assignedToMe = tasks.filter(
      (task) => task.assigned_to === user?.id,
    )

    return {
      assigned: assignedToMe.filter(
        (task) => task.status === 'assigned',
      ).length,
      inProgress: assignedToMe.filter(
        (task) => task.status === 'in_progress',
      ).length,
      awaitingReview: assignedToMe.filter(
        (task) =>
          task.status === 'awaiting_review',
      ).length,
      completed: assignedToMe.filter(
        (task) => task.status === 'completed',
      ).length,
    }
  }, [tasks, user?.id])

  return (
    <div className="space-y-4">
      {previewMode && <PreviewNotice />}

      <TaskSummary
        assigned={summary.assigned}
        inProgress={summary.inProgress}
        awaitingReview={summary.awaitingReview}
        completed={summary.completed}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/80">
          <TaskListHeader
            role={actualRole}
            loading={loading}
            filter={filter}
            searchTerm={searchTerm}
            onFilterChange={setFilter}
            onSearchChange={setSearchTerm}
            onRefresh={loadTasks}
          />

          <div className="p-3 sm:p-4">
            {loading && tasks.length === 0 ? (
              <TaskLoadingState />
            ) : loadError ? (
              <TaskErrorState
                message={loadError}
                onRetry={loadTasks}
              />
            ) : filteredTasks.length === 0 ? (
              <TaskEmptyState filter={filter} />
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUserId={user?.id}
                    realProfile={actualProfile}
                    onChanged={loadTasks}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <PermissionGate
          profile={realProfile}
          action="assign_tasks"
        >
          <TaskAssignmentPanel
            actorId={user?.id}
            employees={employees}
            employeeLoading={employeeLoading}
            onLoadEmployees={loadEmployees}
            onCreated={loadTasks}
          />
        </PermissionGate>
      </div>
    </div>
  )
}

function PreviewNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-4">
      <ShieldCheck
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
        aria-hidden="true"
      />

      <div>
        <p className="text-sm font-bold text-amber-100">
          Administrative preview is active
        </p>

        <p className="mt-1 text-xs leading-5 text-amber-100/70">
          Your real employee role continues to control task access
          and assignment permissions. Preview mode does not allow
          you to act as another employee.
        </p>
      </div>
    </div>
  )
}

interface TaskSummaryProps {
  assigned: number
  inProgress: number
  awaitingReview: number
  completed: number
}

function TaskSummary({
  assigned,
  inProgress,
  awaitingReview,
  completed,
}: TaskSummaryProps) {
  const cards = [
    {
      label: 'Assigned',
      value: assigned,
      icon: ClipboardCheck,
    },
    {
      label: 'In Progress',
      value: inProgress,
      icon: Clock3,
    },
    {
      label: 'Awaiting Review',
      value: awaitingReview,
      icon: ShieldCheck,
    },
    {
      label: 'Completed',
      value: completed,
      icon: CheckCircle2,
    },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon

        return (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-[#101520]/80 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {card.label}
                </p>

                <p className="mt-2 text-2xl font-black text-white">
                  {card.value}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}

interface TaskListHeaderProps {
  role?: string | null
  loading: boolean
  filter: 'active' | 'completed' | 'all'
  searchTerm: string
  onFilterChange: (
    filter: 'active' | 'completed' | 'all',
  ) => void
  onSearchChange: (value: string) => void
  onRefresh: () => void | Promise<void>
}

function TaskListHeader({
  role,
  loading,
  filter,
  searchTerm,
  onFilterChange,
  onSearchChange,
  onRefresh,
}: TaskListHeaderProps) {
  return (
    <div className="border-b border-white/10 px-4 py-4 sm:px-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {getDepartmentForRole(role)}
          </p>

          <h2 className="mt-1 text-lg font-black text-white">
            {formatRole(role)} Tasks
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            Tasks assigned directly to you or to your employee role.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? 'animate-spin' : ''
            }`}
          />
          Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

          <input
            value={searchTerm}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="Search tasks"
            className="min-h-10 w-full rounded-xl border border-white/10 bg-black/25 py-2 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/30"
          />
        </div>

        <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
          {(['active', 'completed', 'all'] as const).map(
            (value) => (
              <button
                key={value}
                type="button"
                onClick={() => onFilterChange(value)}
                className={`rounded-lg px-3 py-2 text-xs font-bold capitalize transition ${
                  filter === value
                    ? 'bg-cyan-500/15 text-cyan-200'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {value}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

interface TaskCardProps {
  task: EmployeeTask
  currentUserId?: string
  realProfile?: EmployeeProfileLike | null
  onChanged: () => void | Promise<void>
}

function TaskCard({
  task,
  currentUserId,
  realProfile,
  onChanged,
}: TaskCardProps) {
  const [updating, setUpdating] = useState(false)

  const allowedChanges = getAllowedStatusChanges(
    task,
    currentUserId,
  )

  const updateStatus = async (status: TaskStatus) => {
    if (!currentUserId) return

    setUpdating(true)

    try {
      const updatePayload: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      }

      if (status === 'completed') {
        updatePayload.completed_at =
          new Date().toISOString()
      }

      const { error } = await supabase
        .from('employee_tasks')
        .update(updatePayload)
        .eq('id', task.id)
        .eq('assigned_to', currentUserId)

      if (error) {
        throw error
      }

      toast.success(
        `Task marked ${formatStatus(status).toLowerCase()}.`,
      )

      await onChanged()
    } catch (error) {
      console.error('Unable to update task:', error)

      toast.error(
        error instanceof Error
          ? error.message
          : 'The task could not be updated.',
      )
    } finally {
      setUpdating(false)
    }
  }

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${getPriorityClasses(
                task.priority,
              )}`}
            >
              {formatPriority(task.priority)}
            </span>

            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${getStatusClasses(
                task.status,
              )}`}
            >
              {formatStatus(task.status)}
            </span>

            {task.category && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300">
                {task.category}
              </span>
            )}
          </div>

          <h3 className="mt-3 text-lg font-black text-white">
            {task.title}
          </h3>

          {task.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {task.description}
            </p>
          )}
        </div>

        <Flag
          className={`h-5 w-5 shrink-0 ${
            task.priority === 'urgent'
              ? 'text-rose-300'
              : task.priority === 'high'
                ? 'text-orange-300'
                : 'text-slate-500'
          }`}
        />
      </div>

      <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 text-xs sm:grid-cols-2">
        <div>
          <p className="font-bold text-slate-500">
            Assigned To
          </p>

          <p className="mt-1 text-slate-300">
            {task.assignee?.username ??
              (task.assigned_role
                ? `All ${formatRole(task.assigned_role)} employees`
                : 'Unassigned')}
          </p>
        </div>

        <div>
          <p className="font-bold text-slate-500">
            Assigned By
          </p>

          <p className="mt-1 text-slate-300">
            {task.assigner?.username ?? 'Management'}
          </p>
        </div>

        <div>
          <p className="font-bold text-slate-500">
            Department
          </p>

          <p className="mt-1 text-slate-300">
            {task.department ??
              getDepartmentForRole(
                task.assigned_role ?? task.assignee?.role,
              )}
          </p>
        </div>

        <div>
          <p className="font-bold text-slate-500">
            Due Date
          </p>

          <p className="mt-1 text-slate-300">
            {formatDueDate(task.due_date)}
          </p>
        </div>
      </div>

      <div className="mt-3 text-[10px] text-slate-600">
        Created {formatDateTime(task.created_at)}
      </div>

      {allowedChanges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          {allowedChanges.map((status) => (
            <button
              key={status}
              type="button"
              disabled={updating}
              onClick={() => void updateStatus(status)}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              {updating ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : null}

              {formatStatus(status)}
            </button>
          ))}
        </div>
      )}

      <PermissionGate
        profile={realProfile}
        action="assign_tasks"
      >
        <ManagementTaskActions
          task={task}
          onChanged={onChanged}
        />
      </PermissionGate>
    </article>
  )
}

function ManagementTaskActions({
  task,
  onChanged,
}: {
  task: EmployeeTask
  onChanged: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  const reviewTask = async (
    status: 'completed' | 'in_progress' | 'cancelled',
  ) => {
    const confirmed = window.confirm(
      `Change this task to ${formatStatus(
        status,
      ).toLowerCase()}?`,
    )

    if (!confirmed) return

    setBusy(true)

    try {
      const update: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      }

      if (status === 'completed') {
        update.completed_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('employee_tasks')
        .update(update)
        .eq('id', task.id)

      if (error) {
        throw error
      }

      toast.success('Task status updated.')
      await onChanged()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Task status could not be updated.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 border-t border-amber-400/10 pt-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-200/60">
        Management Actions
      </p>

      <div className="flex flex-wrap gap-2">
        {task.status === 'awaiting_review' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void reviewTask('completed')
              }
              className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200"
            >
              Approve Completion
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void reviewTask('in_progress')
              }
              className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200"
            >
              Return for Changes
            </button>
          </>
        )}

        {!['completed', 'cancelled'].includes(task.status) && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void reviewTask('cancelled')
            }
            className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200"
          >
            Cancel Task
          </button>
        )}
      </div>
    </div>
  )
}

interface TaskAssignmentPanelProps {
  actorId?: string
  employees: EmployeeProfile[]
  employeeLoading: boolean
  onLoadEmployees: () => void | Promise<void>
  onCreated: () => void | Promise<void>
}

function TaskAssignmentPanel({
  actorId,
  employees,
  employeeLoading,
  onLoadEmployees,
  onCreated,
}: TaskAssignmentPanelProps) {
  const [form, setForm] =
    useState<TaskFormState>(INITIAL_FORM)
  const [busy, setBusy] = useState(false)
  const [directoryLoaded, setDirectoryLoaded] =
    useState(false)

  useEffect(() => {
    if (!directoryLoaded) {
      setDirectoryLoaded(true)
      void onLoadEmployees()
    }
  }, [directoryLoaded, onLoadEmployees])

  const roleTemplates =
    ROLE_TASK_TEMPLATES[form.assignedRole] ?? []

  const eligibleEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          !form.assignedRole ||
          employee.role === form.assignedRole,
      ),
    [employees, form.assignedRole],
  )

  const updateForm = <K extends keyof TaskFormState>(
    field: K,
    value: TaskFormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const selectTemplate = (
    template: RoleTaskTemplate,
  ) => {
    setForm((current) => ({
      ...current,
      title: template.title,
      description: template.description,
      category: template.category,
      priority: template.priority,
    }))
  }

  const createTask = async () => {
    const normalizedTitle = form.title.trim()
    const normalizedDescription =
      form.description.trim()

    if (!actorId) {
      toast.error(
        'Your management account could not be verified.',
      )
      return
    }

    if (!form.assignedRole) {
      toast.error('Select the employee role.')
      return
    }

    if (!normalizedTitle) {
      toast.error('Enter a task title.')
      return
    }

    if (normalizedDescription.length < 10) {
      toast.error(
        'Enter a complete task description.',
      )
      return
    }

    setBusy(true)

    try {
      const selectedEmployee = employees.find(
        (employee) =>
          employee.id === form.assignedTo,
      )

      if (
        selectedEmployee &&
        selectedEmployee.role !== form.assignedRole
      ) {
        throw new Error(
          'The selected employee does not belong to the selected role.',
        )
      }

      const { error } = await supabase
        .from('employee_tasks')
        .insert({
          title: normalizedTitle,
          description: normalizedDescription,
          priority: form.priority,
          assigned_by: actorId,
          assigned_to: form.assignedTo || null,
          assigned_role: form.assignedRole,
          department: getDepartmentForRole(
            form.assignedRole,
          ),
          category: form.category.trim() || null,
          due_date: form.dueDate || null,
          status: 'assigned',
        })

      if (error) {
        throw error
      }

      toast.success(
        form.assignedTo
          ? 'Task assigned to employee.'
          : `Task assigned to the ${formatRole(
              form.assignedRole,
            )} role.`,
      )

      setForm(INITIAL_FORM)
      await onCreated()
    } catch (error) {
      console.error('Unable to create task:', error)

      toast.error(
        error instanceof Error
          ? error.message
          : 'The task could not be created.',
      )
    } finally {
      setBusy(false)
    }
  }

  const canCreate =
    Boolean(actorId) &&
    Boolean(form.assignedRole) &&
    Boolean(form.title.trim()) &&
    form.description.trim().length >= 10 &&
    !busy

  return (
    <aside className="h-fit overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/80 xl:sticky xl:top-6">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
            <Plus className="h-5 w-5" />
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Management Assignment
            </p>

            <h2 className="mt-1 text-lg font-black text-white">
              Assign Role Task
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              Assign a task to one employee or to an entire employee
              role.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <label
            htmlFor="task-role"
            className="text-xs font-bold text-slate-300"
          >
            Employee role
          </label>

          <select
            id="task-role"
            value={form.assignedRole}
            onChange={(event) => {
              updateForm(
                'assignedRole',
                event.target.value,
              )
              updateForm('assignedTo', '')
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 py-2.5 text-sm text-white outline-none"
          >
            <option value="">Select employee role</option>

            {EMPLOYEE_ROLES.map((role) => (
              <option
                key={role.value}
                value={role.value}
              >
                {role.label}
              </option>
            ))}
          </select>
        </div>

        {form.assignedRole && (
          <div>
            <label
              htmlFor="task-template"
              className="text-xs font-bold text-slate-300"
            >
              Role task template
            </label>

            <select
              id="task-template"
              defaultValue=""
              onChange={(event) => {
                const template = roleTemplates.find(
                  (item) =>
                    item.title === event.target.value,
                )

                if (template) {
                  selectTemplate(template)
                }
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 py-2.5 text-sm text-white outline-none"
            >
              <option value="">
                Select a template or create custom
              </option>

              {roleTemplates.map((template) => (
                <option
                  key={template.title}
                  value={template.title}
                >
                  {template.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label
            htmlFor="task-assignee"
            className="text-xs font-bold text-slate-300"
          >
            Specific employee
          </label>

          <select
            id="task-assignee"
            value={form.assignedTo}
            disabled={
              !form.assignedRole || employeeLoading
            }
            onChange={(event) =>
              updateForm(
                'assignedTo',
                event.target.value,
              )
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 py-2.5 text-sm text-white outline-none disabled:opacity-50"
          >
            <option value="">
              Assign to all employees in this role
            </option>

            {eligibleEmployees.map((employee) => (
              <option
                key={employee.id}
                value={employee.id}
              >
                {employee.username ??
                  'Unnamed Employee'}
              </option>
            ))}
          </select>

          <p className="mt-1 text-[10px] text-slate-500">
            Leave blank to create a task for the selected role.
          </p>
        </div>

        <div>
          <label
            htmlFor="task-title"
            className="text-xs font-bold text-slate-300"
          >
            Task title
          </label>

          <input
            id="task-title"
            value={form.title}
            onChange={(event) =>
              updateForm('title', event.target.value)
            }
            maxLength={150}
            placeholder="Enter task title"
            className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </div>

        <div>
          <label
            htmlFor="task-description"
            className="text-xs font-bold text-slate-300"
          >
            Instructions
          </label>

          <textarea
            id="task-description"
            value={form.description}
            onChange={(event) =>
              updateForm(
                'description',
                event.target.value,
              )
            }
            maxLength={2000}
            placeholder="Provide complete instructions, expected result, and any required documentation."
            className="mt-2 min-h-32 w-full resize-y rounded-xl border border-white/10 bg-[#090D15] p-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div>
            <label
              htmlFor="task-priority"
              className="text-xs font-bold text-slate-300"
            >
              Priority
            </label>

            <select
              id="task-priority"
              value={form.priority}
              onChange={(event) =>
                updateForm(
                  'priority',
                  event.target.value as TaskPriority,
                )
              }
              className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 py-2.5 text-sm text-white outline-none"
            >
              {(
                [
                  'low',
                  'normal',
                  'high',
                  'urgent',
                ] as TaskPriority[]
              ).map((priority) => (
                <option
                  key={priority}
                  value={priority}
                >
                  {formatPriority(priority)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="task-due-date"
              className="text-xs font-bold text-slate-300"
            >
              Due date
            </label>

            <input
              id="task-due-date"
              type="date"
              value={form.dueDate}
              onChange={(event) =>
                updateForm(
                  'dueDate',
                  event.target.value,
                )
              }
              className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 py-2.5 text-sm text-white outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="task-category"
            className="text-xs font-bold text-slate-300"
          >
            Category
          </label>

          <input
            id="task-category"
            value={form.category}
            onChange={(event) =>
              updateForm(
                'category',
                event.target.value,
              )
            }
            placeholder="Example: Attendance, Moderation, Records"
            className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </div>

        <button
          type="button"
          disabled={!canCreate}
          onClick={() => void createTask()}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BriefcaseBusiness className="h-4 w-4" />
          )}

          Assign Task
        </button>
      </div>
    </aside>
  )
}

function TaskLoadingState() {
  return (
    <div className="flex min-h-72 items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" />

        <p className="mt-3 text-sm font-bold text-slate-300">
          Loading employee tasks
        </p>
      </div>
    </div>
  )
}

function TaskErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void | Promise<void>
}) {
  return (
    <div className="rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-6 text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-rose-300" />

      <p className="mt-3 text-sm font-bold text-rose-100">
        Tasks could not be loaded
      </p>

      <p className="mt-1 text-xs text-rose-100/60">
        {message}
      </p>

      <button
        type="button"
        onClick={() => void onRetry()}
        className="mt-4 rounded-lg border border-rose-300/20 px-4 py-2 text-xs font-bold text-rose-100"
      >
        Try Again
      </button>
    </div>
  )
}

function TaskEmptyState({
  filter,
}: {
  filter: 'active' | 'completed' | 'all'
}) {
  return (
    <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/10 p-6 text-center">
      <div>
        <ClipboardCheck className="mx-auto h-9 w-9 text-slate-600" />

        <p className="mt-3 text-sm font-bold text-slate-300">
          No {filter === 'all' ? '' : filter} tasks
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Tasks assigned directly to you or your employee role will
          appear here.
        </p>
      </div>
    </div>
  )
}