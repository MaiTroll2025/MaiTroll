import React, {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  UserRound,
  UsersRound,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { canEmployee } from '../permissions'
import { PermissionGate } from '../components/PermissionGate'
import {
  canViewDocument,
  getDocumentSensitivity,
  isAdmin as isAdminProfile,
} from '../../../lib/documentAccess'

const DOCS_BUCKET = 'employee-documents'

/** Shared props contract mirroring generated form components (read-only review). */
import type { DocumentFormProps } from '../components/documents/DocumentFormShell'

type ReviewFormComponent = ComponentType<DocumentFormProps>

/** document_key -> generated form component (built by another agent). */
const REVIEW_FORM_LOADERS: Record<
  string,
  () => Promise<{ default: ReviewFormComponent }>
> = {
  offer_letter: () => import('../components/documents/OfferLetterForm'),
  direct_deposit: () => import('../components/documents/DirectDepositForm'),
  emergency_contact: () => import('../components/documents/EmergencyContactForm'),
  handbook_acknowledgement: () =>
    import('../components/documents/HandbookAcknowledgementForm'),
  code_of_conduct: () => import('../components/documents/CodeOfConductForm'),
  confidentiality: () => import('../components/documents/ConfidentialityNDAForm'),
  confidentiality_nda: () => import('../components/documents/ConfidentialityNDAForm'),
  acceptable_use: () => import('../components/documents/AcceptableUseForm'),
  harassment_policy: () => import('../components/documents/AntiHarassmentForm'),
  anti_harassment: () => import('../components/documents/AntiHarassmentForm'),
  background_authorization: () =>
    import('../components/documents/BackgroundAuthorizationForm'),
  tc_enrollment: () => import('../components/documents/TcEnrollmentForm'),
  TC_enrollment: () => import('../components/documents/TcEnrollmentForm'),
  role_training: () => import('../components/documents/RoleTrainingForm'),
  form_i9: () => import('../components/documents/FormI9'),
  i9_identity_documents: () =>
    import('../components/documents/I9IdentityDocumentsForm'),
  form_w4: () => import('../components/documents/FormW4'),
  state_withholding: () => import('../components/documents/StateWithholdingForm'),
}

const reviewLazyCache = new Map<string, ReviewFormComponent>()

function resolveReviewForm(documentKey: string): ReviewFormComponent | null {
  const loader =
    REVIEW_FORM_LOADERS[documentKey] ??
    REVIEW_FORM_LOADERS[documentKey.toLowerCase()]
  if (!loader) return null
  const cached = reviewLazyCache.get(documentKey)
  if (cached) return cached
  const Lazy = lazy(loader) as unknown as ReviewFormComponent
  reviewLazyCache.set(documentKey, Lazy)
  return Lazy
}

class ReviewFormErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: unknown) {
    console.error('Review form failed to render:', error)
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

function parseReviewInitialData(notes?: string | null): Record<string, any> | null {
  if (!notes) return null
  const trimmed = notes.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

/** Extract the storage object path from a stored file_url or raw path. */
function storagePathFromUrl(fileUrl: string): string {
  const marker = `/object/public/${DOCS_BUCKET}/`
  const idx = fileUrl.indexOf(marker)
  if (idx !== -1) return fileUrl.slice(idx + marker.length)
  const altMarker = `/${DOCS_BUCKET}/`
  const altIdx = fileUrl.indexOf(altMarker)
  if (altIdx !== -1) return fileUrl.slice(altIdx + altMarker.length)
  return fileUrl
}

type HrSection =
  | 'overview'
  | 'applicants'
  | 'employees'
  | 'add_employee'
  | 'onboarding'
  | 'payroll'

type ApplicationStatus =
  | 'pending'
  | 'reviewing'
  | 'interview'
  | 'approved'
  | 'rejected'
  | 'withdrawn'

type EmploymentStatus =
  | 'onboarding'
  | 'active'
  | 'suspended'
  | 'terminated'
  | 'leave'

type ChecklistStatus =
  | 'not_sent'
  | 'sent'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'waived'

type HrAction =
  | 'hire'
  | 'reject'
  | 'suspend'
  | 'reactivate'
  | 'terminate'
  | 'promote'
  | 'revoke_lead'

interface HiringTabProps {
  profile?: EmployeeProfileLike | null
  realProfile?: EmployeeProfileLike | null
}

interface EmployeeProfileLike {
  id?: string
  username?: string | null
  role?: string | null
  is_admin?: boolean | null
  [key: string]: unknown
}

interface CareerPosition {
  id?: string
  title?: string | null
  role?: string | null
  department?: string | null
}

interface JobApplication {
  id: string
  user_id: string
  position_id: string | null
  status: ApplicationStatus | string
  created_at: string
  reviewed_at?: string | null
  reviewed_by?: string | null
  applicant_name?: string | null
  email?: string | null
  phone?: string | null
  cover_letter?: string | null
  resume_url?: string | null
  position?: CareerPosition | null
  applicant?: {
    id: string
    username: string | null
    email?: string | null
  } | null
}

interface EmployeeRecord {
  id?: string
  user_id: string
  employment_status: EmploymentStatus | string
  department?: string | null
  job_title?: string | null
  hire_date?: string | null
  termination_date?: string | null
  pay_type?: string | null
  pay_rate?: number | null
  payroll_status?: string | null
  updated_at?: string | null
  profile?: {
    id: string
    username: string | null
    role: string | null
    is_troll_officer?: boolean | null
    is_lead_officer?: boolean | null
    is_officer_active?: boolean | null
  } | null
}

interface OnboardingItem {
  id: string
  employee_id: string
  document_key: string
  document_name: string
  category: string
  required: boolean
  status: ChecklistStatus | string
  due_date?: string | null
  sent_at?: string | null
  submitted_at?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  file_url?: string | null
  notes?: string | null
}

interface PayrollProfile {
  id?: string
  employee_id: string
  provider: string
  provider_employee_id?: string | null
  payroll_status: string
  pay_type?: string | null
  pay_rate?: number | null
  pay_frequency?: string | null
  direct_deposit_status?: string | null
  tax_forms_status?: string | null
  last_synced_at?: string | null
}

interface DocumentTemplate {
  key: string
  name: string
  category: string
  required: boolean
  description: string
}

const EMPLOYEE_ROLES = [
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
    value: 'employee',
    label: 'Employee',
    department: 'General Operations',
  },
] as const

const PROTECTED_ROLES = new Set([
  'admin',
  'ceo',
  'owner',
  'super_admin',
])

const ONBOARDING_DOCUMENTS: DocumentTemplate[] = [
  {
    key: 'offer_letter',
    name: 'Signed Offer Letter',
    category: 'Employment',
    required: true,
    description:
      'Signed offer confirming position, pay, start date, and employment terms.',
  },
  {
    key: 'form_i9',
    name: 'Form I-9',
    category: 'Federal Compliance',
    required: true,
    description:
      'Employment eligibility verification. Employee completes Section 1 and HR completes the employer review.',
  },
  {
    key: 'i9_identity_documents',
    name: 'I-9 Identity and Work Authorization Review',
    category: 'Federal Compliance',
    required: true,
    description:
      'HR records verification of acceptable original identity and work-authorization documents. Do not require a specific document.',
  },
  {
    key: 'form_w4',
    name: 'Federal Form W-4',
    category: 'Tax',
    required: true,
    description:
      'Employee federal income-tax withholding certificate.',
  },
  {
    key: 'state_withholding',
    name: 'State Withholding Setup',
    category: 'Tax',
    required: true,
    description:
      'State withholding information required by the employee work location and payroll provider.',
  },
  {
    key: 'direct_deposit',
    name: 'Direct Deposit or Pay Election',
    category: 'Payroll',
    required: true,
    description:
      'Direct-deposit authorization or alternate lawful payment method election.',
  },
  {
    key: 'emergency_contact',
    name: 'Emergency Contact Form',
    category: 'Employee Information',
    required: true,
    description:
      'Emergency contact name, relationship, and contact information.',
  },
  {
    key: 'handbook_acknowledgement',
    name: 'Employee Handbook Acknowledgment',
    category: 'Company Policy',
    required: true,
    description:
      'Acknowledgment that the employee received and reviewed the employee handbook.',
  },
  {
    key: 'code_of_conduct',
    name: 'Code of Conduct',
    category: 'Company Policy',
    required: true,
    description:
      'Acknowledgment of workplace behavior, platform safety, and professional-conduct rules.',
  },
  {
    key: 'confidentiality',
    name: 'Confidentiality and Data Security Agreement',
    category: 'Company Policy',
    required: true,
    description:
      'Agreement covering private company, employee, user, moderation, and platform information.',
  },
  {
    key: 'acceptable_use',
    name: 'Systems Acceptable Use Policy',
    category: 'Security',
    required: true,
    description:
      'Rules for company accounts, devices, passwords, records, and administrative systems.',
  },
  {
    key: 'role_training',
    name: 'Role Training Completion',
    category: 'Training',
    required: true,
    description:
      'Required training for the employee’s assigned Mai Troll role.',
  },
  {
    key: 'harassment_policy',
    name: 'Anti-Harassment Policy Acknowledgment',
    category: 'Company Policy',
    required: true,
    description:
      'Acknowledgment of reporting channels and anti-harassment expectations.',
  },
  {
    key: 'background_authorization',
    name: 'Background Check Authorization',
    category: 'Screening',
    required: false,
    description:
      'Use only when a lawful background check is required for the position and the proper disclosure process is followed.',
  },
  {
    key: 'TC_enrollment',
    name: 'TC Payroll Enrollment',
    category: 'Payroll',
    required: true,
    description:
      'TC employee setup and payroll enrollment. Keep pending until TC provides the company workflow.',
  },
]

const APPLICATION_FILTERS: Array<
  'all' | 'pending' | 'reviewing' | 'interview' | 'approved' | 'rejected'
> = [
  'all',
  'pending',
  'reviewing',
  'interview',
  'approved',
  'rejected',
]

function formatLabel(value?: string | null): string {
  if (!value) return '—'

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    )
}

function formatDate(value?: string | null): string {
  if (!value) return '—'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
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

function getDepartment(role?: string | null): string {
  return (
    EMPLOYEE_ROLES.find((item) => item.value === role)
      ?.department ?? 'General Operations'
  )
}

function deriveRoleFromPosition(
  position?: CareerPosition | null,
): string {
  if (position?.role) return position.role

  const normalized = position?.title
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  const aliases: Record<string, string> = {
    troll_officer: 'troll_officer',
    lead_troll_officer: 'lead_troll_officer',
    secretary: 'secretary',
    ceo_assistant: 'ceo_assistant',
    noah_assistant: 'noah_assistant',
    broadcast_officer: 'broadofficer',
    broadofficer: 'broadofficer',
    broadcaster: 'broadcaster',
  }

  return (normalized && aliases[normalized]) || 'employee'
}

function applicationStatusClasses(status: string): string {
  switch (status) {
    case 'approved':
      return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
    case 'rejected':
    case 'withdrawn':
      return 'border-rose-400/20 bg-rose-500/10 text-rose-200'
    case 'interview':
      return 'border-violet-400/20 bg-violet-500/10 text-violet-200'
    case 'reviewing':
      return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200'
    default:
      return 'border-amber-400/20 bg-amber-500/10 text-amber-200'
  }
}

function employmentStatusClasses(status: string): string {
  switch (status) {
    case 'active':
      return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
    case 'onboarding':
      return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200'
    case 'suspended':
      return 'border-amber-400/20 bg-amber-500/10 text-amber-200'
    case 'terminated':
      return 'border-rose-400/20 bg-rose-500/10 text-rose-200'
    case 'leave':
      return 'border-violet-400/20 bg-violet-500/10 text-violet-200'
    default:
      return 'border-slate-400/20 bg-slate-500/10 text-slate-300'
  }
}

export default function HiringTab({
  profile,
  realProfile,
}: HiringTabProps) {
  const { user } = useAuthStore()
  const effectiveProfile = realProfile ?? profile
  const canHire = canEmployee(effectiveProfile, 'hire')

  const [section, setSection] =
    useState<HrSection>('overview')
  const [applications, setApplications] = useState<
    JobApplication[]
  >([])
  const [employees, setEmployees] = useState<
    EmployeeRecord[]
  >([])
  const [onboardingItems, setOnboardingItems] = useState<
    OnboardingItem[]
  >([])
  const [payrollProfiles, setPayrollProfiles] = useState<
    PayrollProfile[]
  >([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] =
    useState<string | null>(null)
  const [applicationFilter, setApplicationFilter] =
    useState<(typeof APPLICATION_FILTERS)[number]>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedApplication, setSelectedApplication] =
    useState<JobApplication | null>(null)
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeRecord | null>(null)

  const loadHrData = useCallback(
    async (silent = false) => {
      if (!canHire || !user?.id) {
        setLoading(false)
        return
      }

      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setLoadError(null)

      try {
        let applicationQuery = supabase
          .from('job_applications')
          .select(
            `
              id,
              user_id,
              position_id,
              status,
              created_at,
              reviewed_at,
              reviewed_by,
              applicant_name,
              email,
              phone,
              cover_letter,
              resume_url,
              position:career_positions(
                id,
                title,
                role,
                department
              )
            `,
          )
          .order('created_at', { ascending: false })
          .limit(200)

        if (applicationFilter !== 'all') {
          applicationQuery = applicationQuery.eq(
            'status',
            applicationFilter,
          )
        }

        const [
          applicationResult,
          employeeResult,
          onboardingResult,
          payrollResult,
        ] = await Promise.all([
          applicationQuery,
          supabase
            .from('employee_records')
            .select(
              `
                id,
                user_id,
                employment_status,
                department,
                job_title,
                hire_date,
                termination_date,
                pay_type,
                pay_rate,
                payroll_status,
                updated_at
              `,
            )
            .order('updated_at', { ascending: false })
            .limit(300),
          supabase
            .from('hr_onboarding_items')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000),
          supabase
            .from('hr_payroll_profiles')
            .select('*')
            .limit(300),
        ])

        if (applicationResult.error) {
          throw applicationResult.error
        }

        if (employeeResult.error) {
          throw employeeResult.error
        }

        if (onboardingResult.error) {
          throw onboardingResult.error
        }

        if (payrollResult.error) {
          throw payrollResult.error
        }

        let loadedApplications =
          (applicationResult.data as unknown as JobApplication[]) ??
          []

        let loadedEmployees =
          (employeeResult.data as unknown as EmployeeRecord[]) ??
          []

        const profileIds = [
          ...new Set(
            [
              ...loadedApplications.map(
                (application) => application.user_id,
              ),
              ...loadedEmployees.map(
                (employee) => employee.user_id,
              ),
            ].filter(
              (id): id is string => Boolean(id),
            ),
          ),
        ]

        if (profileIds.length > 0) {
          const { data: profileData, error: profileError } =
            await supabase
              .from('user_profiles')
              .select(
                `
                  id,
                  username,
                  role,
                  is_troll_officer,
                  is_lead_officer,
                  is_officer_active
                `,
              )
              .in('id', profileIds)

          if (profileError) {
            throw profileError
          }

          const profileMap = new Map(
            (
              (profileData as Array<{
                id: string
                username: string | null
                role: string | null
                is_troll_officer?: boolean | null
                is_lead_officer?: boolean | null
                is_officer_active?: boolean | null
              }> | null) ?? []
            ).map((profile) => [profile.id, profile]),
          )

          loadedApplications = loadedApplications.map(
            (application) => ({
              ...application,
              applicant:
                profileMap.get(application.user_id) ?? null,
            }),
          )

          loadedEmployees = loadedEmployees.map(
            (employee) => ({
              ...employee,
              profile:
                profileMap.get(employee.user_id) ?? null,
            }),
          )
        }

        setApplications(loadedApplications)
        setEmployees(loadedEmployees)
        setOnboardingItems(
          (onboardingResult.data as OnboardingItem[]) ?? [],
        )
        setPayrollProfiles(
          (payrollResult.data as PayrollProfile[]) ?? [],
        )
      } catch (error) {
        console.error('Unable to load HR data:', error)

        setLoadError(
          error instanceof Error
            ? error.message
            : 'The HR dashboard could not be loaded.',
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [applicationFilter, canHire, user?.id],
  )

  useEffect(() => {
    void loadHrData()
  }, [loadHrData])

  useEffect(() => {
    if (!canHire || !user?.id) return

    const channel = supabase
      .channel(`hr-management:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
        },
        () => void loadHrData(true),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_records',
        },
        () => void loadHrData(true),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hr_onboarding_items',
        },
        () => void loadHrData(true),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [canHire, loadHrData, user?.id])

  const stats = useMemo(() => {
    const pendingApplications = applications.filter(
      (application) =>
        !['approved', 'rejected', 'withdrawn'].includes(
          application.status,
        ),
    ).length

    const activeEmployees = employees.filter(
      (employee) =>
        employee.employment_status === 'active',
    ).length

    const onboardingEmployees = employees.filter(
      (employee) =>
        employee.employment_status === 'onboarding',
    ).length

    const suspendedEmployees = employees.filter(
      (employee) =>
        employee.employment_status === 'suspended',
    ).length

    const missingDocuments = onboardingItems.filter(
      (item) =>
        item.required &&
        !['approved', 'waived'].includes(item.status),
    ).length

    const payrollPending = payrollProfiles.filter(
      (item) => item.payroll_status !== 'active',
    ).length

    return {
      pendingApplications,
      activeEmployees,
      onboardingEmployees,
      suspendedEmployees,
      missingDocuments,
      payrollPending,
    }
  }, [applications, employees, onboardingItems, payrollProfiles])

  const filteredEmployees = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    if (!search) return employees

    return employees.filter((employee) => {
      return [
        employee.profile?.username,
        employee.profile?.role,
        employee.department,
        employee.job_title,
        employee.employment_status,
      ].some((value) =>
        value?.toLowerCase().includes(search),
      )
    })
  }, [employees, searchTerm])

  return (
    <PermissionGate
      profile={effectiveProfile}
      action="hire"
      fallback={
        <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-slate-400">
          You do not have HR management permissions.
        </div>
      }
    >
      <div className="space-y-4">
        <HrHeader
          refreshing={refreshing}
          onRefresh={() => void loadHrData(true)}
        />

        <HrNavigation
          section={section}
          onChange={setSection}
          counts={{
            applicants: stats.pendingApplications,
            onboarding: stats.missingDocuments,
            payroll: stats.payrollPending,
          }}
        />

        {loading ? (
          <LoadingState />
        ) : loadError ? (
          <ErrorState
            message={loadError}
            onRetry={() => void loadHrData()}
          />
        ) : (
          <>
            {section === 'overview' && (
              <OverviewSection
                stats={stats}
                applications={applications}
                employees={employees}
                onboardingItems={onboardingItems}
                onOpenApplications={() =>
                  setSection('applicants')
                }
                onOpenOnboarding={() =>
                  setSection('onboarding')
                }
              />
            )}

            {section === 'applicants' && (
              <ApplicantsSection
                applications={applications}
                filter={applicationFilter}
                onFilterChange={setApplicationFilter}
                onSelect={setSelectedApplication}
              />
            )}

            {section === 'employees' && (
              <EmployeesSection
                employees={filteredEmployees}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onSelect={setSelectedEmployee}
              />
            )}

            {section === 'add_employee' && (
              <AddEmployeeSection
                onAdded={() => void loadHrData(true)}
              />
            )}

            {section === 'onboarding' && (
              <OnboardingSection
                employees={employees}
                items={onboardingItems}
                actorId={user?.id}
                reviewerProfile={effectiveProfile}
                onChanged={() => void loadHrData(true)}
              />
            )}

            {section === 'payroll' && (
              <PayrollSection
                employees={employees}
                payrollProfiles={payrollProfiles}
              />
            )}
          </>
        )}

        {selectedApplication && (
          <ApplicationReviewModal
            application={selectedApplication}
            actorId={user?.id}
            onClose={() => setSelectedApplication(null)}
            onChanged={async () => {
              setSelectedApplication(null)
              await loadHrData(true)
            }}
          />
        )}

        {selectedEmployee && (
          <EmployeeActionModal
            employee={selectedEmployee}
            actorId={user?.id}
            onClose={() => setSelectedEmployee(null)}
            onChanged={async () => {
              setSelectedEmployee(null)
              await loadHrData(true)
            }}
          />
        )}
      </div>
    </PermissionGate>
  )
}

function HrHeader({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean
  onRefresh: () => void
}) {
  return (
    <header className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/90">
      <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">
            Human Resources
          </p>

          <h1 className="mt-1 text-2xl font-black text-white">
            Hiring & Employee Management
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Manage applicants, hiring, onboarding, required
            documents, employee status, and TC payroll
            readiness from one controlled HR workspace.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={onRefresh}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing ? 'animate-spin' : ''
            }`}
          />
          Refresh HR
        </button>
      </div>

      <div className="border-t border-amber-400/10 bg-amber-500/[0.05] px-5 py-3">
        <p className="text-xs leading-5 text-amber-100/75">
          TC integration is marked as pending until your
          official setup instructions arrive. This dashboard tracks
          readiness without pretending payroll enrollment is
          complete.
        </p>
      </div>
    </header>
  )
}

function HrNavigation({
  section,
  onChange,
  counts,
}: {
  section: HrSection
  onChange: (section: HrSection) => void
  counts: {
    applicants: number
    onboarding: number
    payroll: number
  }
}) {
  const items: Array<{
    id: HrSection
    label: string
    icon: React.ComponentType<{ className?: string }>
    count?: number
  }> = [
    {
      id: 'overview',
      label: 'Dashboard',
      icon: BriefcaseBusiness,
    },
    {
      id: 'applicants',
      label: 'Applicants',
      icon: UserCheck,
      count: counts.applicants,
    },
    {
      id: 'employees',
      label: 'Employees',
      icon: UsersRound,
    },
    {
      id: 'add_employee',
      label: 'Add Employee',
      icon: UserPlus,
    },
    {
      id: 'onboarding',
      label: 'Onboarding',
      icon: ClipboardCheck,
      count: counts.onboarding,
    },
    {
      id: 'payroll',
      label: 'TC',
      icon: Banknote,
      count: counts.payroll,
    },
  ]

  return (
    <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#101520]/80 p-2">
      {items.map((item) => {
        const Icon = item.icon
        const active = item.id === section

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
              active
                ? 'bg-cyan-400 text-slate-950'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}

            {typeof item.count === 'number' &&
              item.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                    active
                      ? 'bg-slate-950/15'
                      : 'bg-white/10'
                  }`}
                >
                  {item.count}
                </span>
              )}
          </button>
        )
      })}
    </nav>
  )
}

function OverviewSection({
  stats,
  applications,
  employees,
  onboardingItems,
  onOpenApplications,
  onOpenOnboarding,
}: {
  stats: {
    pendingApplications: number
    activeEmployees: number
    onboardingEmployees: number
    suspendedEmployees: number
    missingDocuments: number
    payrollPending: number
  }
  applications: JobApplication[]
  employees: EmployeeRecord[]
  onboardingItems: OnboardingItem[]
  onOpenApplications: () => void
  onOpenOnboarding: () => void
}) {
  const cards = [
    {
      label: 'Pending Applicants',
      value: stats.pendingApplications,
      icon: UserCheck,
    },
    {
      label: 'Active Employees',
      value: stats.activeEmployees,
      icon: BadgeCheck,
    },
    {
      label: 'In Onboarding',
      value: stats.onboardingEmployees,
      icon: ClipboardCheck,
    },
    {
      label: 'Suspended',
      value: stats.suspendedEmployees,
      icon: ShieldAlert,
    },
    {
      label: 'Missing Documents',
      value: stats.missingDocuments,
      icon: FileText,
    },
    {
      label: 'Payroll Pending',
      value: stats.payrollPending,
      icon: Banknote,
    },
  ]

  const recentApplications = applications.slice(0, 5)
  const recentEmployees = employees.slice(0, 5)
  const outstanding = onboardingItems
    .filter(
      (item) =>
        item.required &&
        !['approved', 'waived'].includes(item.status),
    )
    .slice(0, 6)

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <div
              key={card.label}
              className="rounded-2xl border border-white/10 bg-[#101520]/80 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
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

      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardList
          title="Recent Applicants"
          actionLabel="Review all"
          onAction={onOpenApplications}
        >
          {recentApplications.length === 0 ? (
            <EmptyLine text="No applicants found." />
          ) : (
            recentApplications.map((application) => (
              <div
                key={application.id}
                className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    {application.applicant?.username ??
                      application.applicant_name ??
                      'Applicant'}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {application.position?.title ??
                      'Employee position'}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-2 py-1 text-[9px] font-bold ${applicationStatusClasses(
                    application.status,
                  )}`}
                >
                  {formatLabel(application.status)}
                </span>
              </div>
            ))
          )}
        </DashboardList>

        <DashboardList title="Recent Employees">
          {recentEmployees.length === 0 ? (
            <EmptyLine text="No employee records found." />
          ) : (
            recentEmployees.map((employee) => (
              <div
                key={employee.user_id}
                className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    {employee.profile?.username ??
                      'Unnamed Employee'}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {formatLabel(
                      employee.profile?.role ??
                        employee.job_title,
                    )}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-2 py-1 text-[9px] font-bold ${employmentStatusClasses(
                    employee.employment_status,
                  )}`}
                >
                  {formatLabel(employee.employment_status)}
                </span>
              </div>
            ))
          )}
        </DashboardList>

        <DashboardList
          title="Compliance Attention"
          actionLabel="Open onboarding"
          onAction={onOpenOnboarding}
        >
          {outstanding.length === 0 ? (
            <EmptyLine text="No required items are outstanding." />
          ) : (
            outstanding.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    {item.document_name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {item.category}
                  </p>
                </div>

                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[9px] font-bold text-amber-200">
                  {formatLabel(item.status)}
                </span>
              </div>
            ))
          )}
        </DashboardList>
      </div>
    </div>
  )
}

function DashboardList({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#101520]/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-white">
          {title}
        </h2>

        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-xs font-bold text-cyan-300"
          >
            {actionLabel}
          </button>
        )}
      </div>

      <div className="mt-2">{children}</div>
    </section>
  )
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="py-8 text-center text-xs text-slate-500">
      {text}
    </p>
  )
}

function ApplicantsSection({
  applications,
  filter,
  onFilterChange,
  onSelect,
}: {
  applications: JobApplication[]
  filter: (typeof APPLICATION_FILTERS)[number]
  onFilterChange: (
    value: (typeof APPLICATION_FILTERS)[number],
  ) => void
  onSelect: (application: JobApplication) => void
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/80">
      <div className="border-b border-white/10 p-4 sm:p-5">
        <h2 className="text-lg font-black text-white">
          Applicant Tracking
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Review applications, confirm the correct role, record a
          decision reason, and launch onboarding after approval.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {APPLICATION_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onFilterChange(value)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold capitalize ${
                filter === value
                  ? 'border-cyan-300/30 bg-cyan-500/15 text-cyan-200'
                  : 'border-white/10 text-slate-400'
              }`}
            >
              {formatLabel(value)}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-white/[0.06]">
        {applications.length === 0 ? (
          <div className="p-10 text-center">
            <UserCheck className="mx-auto h-9 w-9 text-slate-600" />
            <p className="mt-3 text-sm font-bold text-slate-300">
              No applications in this view
            </p>
          </div>
        ) : (
          applications.map((application) => (
            <button
              key={application.id}
              type="button"
              onClick={() => onSelect(application)}
              className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-white">
                    {application.applicant?.username ??
                      application.applicant_name ??
                      'Applicant'}
                  </p>

                  <span
                    className={`rounded-full border px-2 py-1 text-[9px] font-bold ${applicationStatusClasses(
                      application.status,
                    )}`}
                  >
                    {formatLabel(application.status)}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-300">
                  {application.position?.title ??
                    'Position not identified'}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Applied {formatDate(application.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                Review
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  )
}

function EmployeesSection({
  employees,
  searchTerm,
  onSearchChange,
  onSelect,
}: {
  employees: EmployeeRecord[]
  searchTerm: string
  onSearchChange: (value: string) => void
  onSelect: (employee: EmployeeRecord) => void
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/80">
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-lg font-black text-white">
              Employee Directory
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Hire, suspend, reactivate, promote, revoke lead
              authority, or terminate while preserving HR records.
            </p>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={searchTerm}
              onChange={(event) =>
                onSearchChange(event.target.value)
              }
              placeholder="Search employees"
              className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 py-2 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {employees.length === 0 ? (
          <div className="col-span-full py-10 text-center">
            <UsersRound className="mx-auto h-9 w-9 text-slate-600" />
            <p className="mt-3 text-sm font-bold text-slate-300">
              No employee records found
            </p>
          </div>
        ) : (
          employees.map((employee) => (
            <button
              key={employee.user_id}
              type="button"
              onClick={() => onSelect(employee)}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-cyan-300/20 hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-white">
                    {employee.profile?.username ??
                      'Unnamed Employee'}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    {formatLabel(
                      employee.profile?.role ??
                        employee.job_title,
                    )}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-2 py-1 text-[9px] font-bold ${employmentStatusClasses(
                    employee.employment_status,
                  )}`}
                >
                  {formatLabel(employee.employment_status)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-600">
                    Department
                  </p>
                  <p className="mt-1 text-slate-300">
                    {employee.department ??
                      getDepartment(employee.profile?.role)}
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-600">
                    Hired
                  </p>
                  <p className="mt-1 text-slate-300">
                    {formatDate(employee.hire_date)}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
   )
}

function AddEmployeeSection({ onAdded }: { onAdded: () => void }) {
  const { user } = useAuthStore()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<Array<{ id: string; username: string | null; email?: string | null; full_name?: string | null }>>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState(EMPLOYEE_ROLES[EMPLOYEE_ROLES.length - 1].value)
  const [hireDate, setHireDate] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedRoleMeta = EMPLOYEE_ROLES.find((r) => r.value === selectedRole)

  const searchUsers = useCallback(async () => {
    if (!query.trim()) {
      setUsers([])
      return
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, email, full_name')
      .ilike('username', `%${query}%`)
      .limit(20)

    if (error) {
      console.error('Failed to search users:', error)
      return
    }

    setUsers(data || [])
  }, [query])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void searchUsers()
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchUsers])

  const handleAddEmployee = async () => {
    if (!selectedUserId || !user?.id || !selectedRoleMeta) return

    setSaving(true)
    try {
      const now = new Date().toISOString()

      const { error } = await supabase
        .from('employee_records')
        .upsert(
          {
            user_id: selectedUserId,
            employment_status: 'active',
            department: selectedRoleMeta.department || null,
            job_title: selectedRoleMeta.label || null,
            hire_date: hireDate || null,
          },
          { onConflict: 'user_id' }
        )

      if (error) throw error

      // Tell the backend the actual role so RBAC / employee
      // access (set_user_role handles the role flags) is correct.
      const { error: roleError } = await supabase.rpc('set_user_role', {
        target_user: selectedUserId,
        new_role: selectedRoleMeta.value,
        reason: `Employee added via directory as ${selectedRoleMeta.label}`,
        acting_admin_id: user.id,
      })

      if (roleError) throw roleError

      toast.success(`Employee added as ${selectedRoleMeta.label}`)
      setQuery('')
      setUsers([])
      setSelectedUserId(null)
      setSelectedRole(EMPLOYEE_ROLES[EMPLOYEE_ROLES.length - 1].value)
      setHireDate('')
      onAdded()
    } catch (err) {
      console.error('Failed to add employee:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to add employee')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#101520]/95 p-5 shadow-2xl shadow-black/20">
        <h3 className="text-lg font-black text-white">Manually Add Employee</h3>
        <p className="mt-1 text-xs text-slate-400">
          Search for an existing user by username and create an employee record for them.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300">Search User by Username</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type username to search..."
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
            />
            {users.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/40">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
                      selectedUserId === u.id ? 'bg-cyan-500/10 text-cyan-200' : 'text-slate-200'
                    }`}
                  >
                    <span className="font-bold">@{u.username}</span>
                    <span className="text-xs text-slate-400">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedUserId && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-300">
                  Employee Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                >
                  {EMPLOYEE_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  {selectedRoleMeta?.department
                    ? `Department: ${selectedRoleMeta.department}`
                    : 'Pick the role so the backend applies the correct permissions.'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300">
                  Hire Date
                </label>
                <input
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!selectedUserId || !selectedRoleMeta || saving}
            onClick={handleAddEmployee}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {saving ? 'Adding...' : 'Add Employee'}
          </button>
        </div>
      </div>
    </section>
  )
}

function OnboardingSection({
  employees,
  items,
  actorId,
  reviewerProfile,
  onChanged,
}: {
  employees: EmployeeRecord[]
  items: OnboardingItem[]
  actorId?: string
  reviewerProfile?: EmployeeProfileLike | null
  onChanged: () => void
}) {
  const [selectedEmployeeId, setSelectedEmployeeId] =
    useState('')
  const [sending, setSending] = useState(false)
  const [reviewingId, setReviewingId] =
    useState<string | null>(null)
  const [downloadingId, setDownloadingId] =
    useState<string | null>(null)

  const reviewerIsAdmin = isAdminProfile(reviewerProfile)

  const eligibleEmployees = employees.filter((employee) =>
    ['hired_pending_documents', 'onboarding', 'active'].includes(
      employee.employment_status,
    ),
  )

  const selectedItems = items.filter(
    (item) => item.employee_id === selectedEmployeeId,
  )

  const sendPacket = async () => {
    if (!actorId || !selectedEmployeeId) {
      toast.error('Select an employee.')
      return
    }

    setSending(true)

    try {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)

      const payload = ONBOARDING_DOCUMENTS.map(
        (document) => ({
          employee_id: selectedEmployeeId,
          document_key: document.key,
          document_name: document.name,
          category: document.category,
          required: document.required,
          status: 'sent',
          due_date: dueDate.toISOString().slice(0, 10),
          sent_at: new Date().toISOString(),
          requested_by: actorId,
          notes: document.description,
        }),
      )

      const { error } = await supabase
        .from('hr_onboarding_items')
        .upsert(payload, {
          onConflict: 'employee_id,document_key',
        })

      if (error) throw error

      const { error: taskError } = await supabase
        .from('employee_tasks')
        .insert({
          title: 'Complete Employee Onboarding Packet',
          description:
            'Open the HR onboarding checklist and complete every required form, acknowledgment, upload, and payroll-readiness item by the due date.',
          priority: 'high',
          assigned_by: actorId,
          assigned_to: selectedEmployeeId,
          assigned_role:
            eligibleEmployees.find(
              (employee) =>
                employee.user_id === selectedEmployeeId,
            )?.profile?.role ?? null,
          department:
            eligibleEmployees.find(
              (employee) =>
                employee.user_id === selectedEmployeeId,
            )?.department ?? null,
          category: 'HR Onboarding',
          due_date: dueDate.toISOString().slice(0, 10),
          status: 'assigned',
        })

      if (taskError) throw taskError

      await supabase.rpc('log_employee_audit', {
        p_actor: actorId,
        p_action: 'send_onboarding_packet',
        p_target: selectedEmployeeId,
        p_new: {
          item_count: payload.length,
          due_date: dueDate.toISOString().slice(0, 10),
        },
        p_reason: 'HR onboarding packet issued',
        p_department: 'human_resources',
      })

      toast.success('Onboarding packet sent.')
      onChanged()
    } catch (error) {
      console.error('Unable to send onboarding packet:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'The onboarding packet could not be sent.',
      )
    } finally {
      setSending(false)
    }
  }

  const reviewItem = async (
    item: OnboardingItem,
    decision: 'approved' | 'rejected' | 'needs_correction' | 'waived',
  ) => {
    if (!actorId) return

    let reviewedReason: string | null = null
    if (decision === 'rejected' || decision === 'needs_correction') {
      const prompted = window.prompt(
        decision === 'rejected'
          ? `Reason for rejecting "${item.document_name}":`
          : `What must the employee correct on "${item.document_name}"?`,
      )
      if (prompted === null) return
      if (prompted.trim().length < 3) {
        toast.error('Enter a complete review reason.')
        return
      }
      reviewedReason = prompted.trim()
    }

    setReviewingId(item.id)

    try {
      const update: Record<string, any> = {
        status: decision,
        reviewed_at: new Date().toISOString(),
        reviewed_by: actorId,
      }
      if (reviewedReason) update.reviewed_reason = reviewedReason
      if (decision === 'needs_correction') update.resubmit_required = true

      const { error } = await supabase
        .from('hr_onboarding_items')
        .update(update)
        .eq('id', item.id)

      if (error) throw error

      const auditAction =
        decision === 'approved'
          ? 'document_approved'
          : decision === 'rejected'
            ? 'document_rejected'
            : decision === 'needs_correction'
              ? 'document_resubmit'
              : 'onboarding_waived'

      await supabase.rpc('log_employee_audit', {
        p_actor: actorId,
        p_action: auditAction,
        p_target: item.employee_id,
        p_new: {
          document_key: item.document_key,
          status: decision,
        },
        p_reason: reviewedReason ?? `${item.document_name}: ${decision}`,
        p_department: 'human_resources',
      })

      toast.success(
        `${item.document_name} marked ${formatLabel(decision).toLowerCase()}.`,
      )

      // Required-document gate only advances on approve/waive.
      if (decision === 'approved' || decision === 'waived') {
        const employee = employees.find(
          (record) => record.user_id === item.employee_id,
        )
        const employeeItems = items.map((row) =>
          row.id === item.id ? { ...row, status: decision } : row,
        )

        if (
          employee &&
          areRequiredDocsComplete(employeeItems, item.employee_id)
        ) {
          if (employee.employment_status === 'hired_pending_documents') {
            const { error: statusError } = await supabase
              .from('employee_records')
              .update({
                employment_status: 'onboarding',
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', item.employee_id)

            if (statusError) throw statusError

            await supabase.rpc('log_employee_audit', {
              p_actor: actorId,
              p_action: 'employment_status_onboarding',
              p_target: item.employee_id,
              p_new: { employment_status: 'onboarding' },
              p_reason:
                'All required onboarding documents approved; role in onboarding.',
              p_department: 'human_resources',
            })

            toast.success(
              'All required documents approved. Employee moved to onboarding.',
            )
          } else if (
            employee.employment_status === 'onboarding' &&
            decision === 'approved' &&
            item.document_key === 'role_training'
          ) {
            const { error: statusError } = await supabase
              .from('employee_records')
              .update({
                employment_status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', item.employee_id)

            if (statusError) throw statusError

            await supabase.rpc('log_employee_audit', {
              p_actor: actorId,
              p_action: 'activate_employee',
              p_target: item.employee_id,
              p_new: { employment_status: 'active' },
              p_reason:
                'Role training completed. Employee activated; payroll may begin.',
              p_department: 'human_resources',
            })

            toast.success(
              'Role training complete. Employee activated and payroll unlocked.',
            )
          }
        }
      }

      onChanged()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'The checklist item could not be updated.',
      )
    } finally {
      setReviewingId(null)
    }
  }

  /** Download an approved/completed PDF (or any item with file_url) + audit. */
  const downloadItem = async (item: OnboardingItem) => {
    if (!actorId || !item.file_url) return

    setDownloadingId(item.id)
    try {
      const path = storagePathFromUrl(item.file_url)
      const { data, error } = await supabase.storage
        .from(DOCS_BUCKET)
        .download(path)

      if (error || !data) throw error ?? new Error('File not found.')

      const url = URL.createObjectURL(data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${item.document_key}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      try {
        await supabase.rpc('log_employee_audit', {
          p_actor: actorId,
          p_action: 'document_downloaded',
          p_target: item.employee_id,
          p_new: { document_key: item.document_key },
          p_department: 'human_resources',
        })
      } catch {
        // best-effort audit
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'The document could not be downloaded.',
      )
    } finally {
      setDownloadingId(null)
    }
  }

  /** Log that an admin opened a sensitive document for viewing. */
  const logViewSensitive = async (item: OnboardingItem) => {
    if (!actorId || !reviewerIsAdmin) return
    try {
      await supabase.rpc('log_employee_audit', {
        p_actor: actorId,
        p_action: 'document_viewed',
        p_target: item.employee_id,
        p_new: { document_key: item.document_key },
        p_department: 'human_resources',
      })
    } catch {
      // best-effort audit
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-white/10 bg-[#101520]/80 p-4 xl:sticky xl:top-4">
        <h2 className="text-lg font-black text-white">
          Send Onboarding Packet
        </h2>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          Creates the required HR checklist and assigns the employee
          an onboarding task. TC remains pending until the
          official provider workflow arrives.
        </p>

        <label className="mt-4 block text-xs font-bold text-slate-300">
          Employee
        </label>

        <select
          value={selectedEmployeeId}
          onChange={(event) =>
            setSelectedEmployeeId(event.target.value)
          }
          className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none"
        >
          <option value="">Select employee</option>

          {eligibleEmployees.map((employee) => (
            <option
              key={employee.user_id}
              value={employee.user_id}
            >
              {employee.profile?.username ??
                'Unnamed Employee'}{' '}
              —{' '}
              {formatLabel(
                employee.profile?.role ??
                  employee.job_title,
              )}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={!selectedEmployeeId || sending}
          onClick={() => void sendPacket()}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-black text-slate-950 disabled:opacity-40"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send Checklist
        </button>

        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
            Packet includes
          </p>

          <div className="mt-3 space-y-2">
            {ONBOARDING_DOCUMENTS.map((document) => (
              <div
                key={document.key}
                className="flex items-start gap-2 text-xs"
              >
                <FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                <div>
                  <p className="font-bold text-slate-300">
                    {document.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    {document.required
                      ? 'Required'
                      : 'Conditional'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/80">
        <div className="border-b border-white/10 p-4 sm:p-5">
          <h2 className="text-lg font-black text-white">
            Employee Checklist
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Review submissions, approve completed items, reject
            incomplete items, or waive conditional requirements.
          </p>
          <p className="mt-2 text-[10px] leading-4 text-amber-200/70">
            Required-document gate: the employee stays in
            hired_pending_documents until every required item is
            approved/waived. Role training is 2 weeks, 1 hour daily;
            completing the role_training item activates the employee and
            unlocks payroll. Non-payroll platform roles skip payroll
            training (waive/complete without payroll).
          </p>
        </div>

        {!selectedEmployeeId ? (
          <div className="p-12 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm font-bold text-slate-300">
              Select an employee
            </p>
          </div>
        ) : selectedItems.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm font-bold text-slate-300">
              No packet has been sent
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Use Send Checklist to create the employee’s packet.
            </p>
          </div>
        ) : (
          <div>
            <RequiredDocsProgress
              items={selectedItems}
              status={
                employees.find(
                  (record) => record.user_id === selectedEmployeeId,
                )?.employment_status
              }
            />
            <div className="divide-y divide-white/[0.06]">
              {selectedItems.map((item) => {
                const level = getDocumentSensitivity(item.document_key)
                const canView = canViewDocument(reviewerProfile, level)
                const isSensitive =
                  level === 'sensitive' || level === 'admin_only'
                const ReviewForm = canView
                  ? resolveReviewForm(item.document_key)
                  : null
                const initialData = parseReviewInitialData(item.notes)
                const hasFile = Boolean(item.file_url)

                return (
                  <div key={item.id} className="p-4 sm:p-5">
                    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-white">
                            {item.document_name}
                          </p>

                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold text-slate-300">
                            {item.category}
                          </span>

                          <span
                            className={`rounded-full border px-2 py-1 text-[9px] font-bold ${
                              item.status === 'approved'
                                ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                                : item.status === 'rejected'
                                  ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                                  : 'border-amber-400/20 bg-amber-500/10 text-amber-200'
                            }`}
                          >
                            {formatLabel(item.status)}
                          </span>

                          {isSensitive && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[9px] font-bold text-violet-200">
                              <Lock className="h-3 w-3" />
                              Sensitive
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-[10px] text-slate-600">
                          Due {formatDate(item.due_date)} · Submitted{' '}
                          {formatDateTime(item.submitted_at)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={reviewingId === item.id}
                          onClick={() => void reviewItem(item, 'approved')}
                          className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 disabled:opacity-40"
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          disabled={reviewingId === item.id}
                          onClick={() => void reviewItem(item, 'rejected')}
                          className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 disabled:opacity-40"
                        >
                          Reject
                        </button>

                        <button
                          type="button"
                          disabled={reviewingId === item.id}
                          onClick={() =>
                            void reviewItem(item, 'needs_correction')
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 disabled:opacity-40"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Request Resubmission
                        </button>

                        {!item.required && (
                          <button
                            type="button"
                            disabled={reviewingId === item.id}
                            onClick={() => void reviewItem(item, 'waived')}
                            className="rounded-lg border border-slate-400/20 bg-slate-500/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40"
                          >
                            Waive
                          </button>
                        )}

                        {hasFile &&
                          ['approved', 'completed', 'submitted'].includes(
                            item.status,
                          ) && (
                            <button
                              type="button"
                              disabled={
                                downloadingId === item.id || !canView
                              }
                              onClick={() => void downloadItem(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200 disabled:opacity-40"
                            >
                              {downloadingId === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              Download PDF
                            </button>
                          )}
                      </div>
                    </div>

                    {/* Read-only review of the submitted form (RBAC-gated). */}
                    <div className="mt-4">
                      {isSensitive && !canView ? (
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-slate-400">
                          <Lock className="h-5 w-5 shrink-0 text-slate-500" />
                          <div>
                            <p className="text-sm font-bold text-slate-200">
                              Restricted — Admin Only
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              This document contains sensitive personal
                              information (SSN, tax, banking, or identity) and
                              is only visible to administrators.
                            </p>
                          </div>
                        </div>
                      ) : ReviewForm ? (
                        <details
                          className="group rounded-xl border border-white/10 bg-black/20"
                          onToggle={(event) => {
                            if (
                              (event.currentTarget as HTMLDetailsElement).open &&
                              isSensitive
                            ) {
                              void logViewSensitive(item)
                            }
                          }}
                        >
                          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs font-bold text-cyan-200">
                            <Eye className="h-4 w-4" />
                            View submitted form
                          </summary>
                          <div className="border-t border-white/10 px-4 py-4">
                            <ReviewFormErrorBoundary
                              fallback={
                                <p className="text-xs text-slate-500">
                                  This form could not be displayed.
                                </p>
                              }
                            >
                              <Suspense
                                fallback={
                                  <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
                                    <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                                    Loading form…
                                  </div>
                                }
                              >
                                <ReviewForm
                                  documentKey={item.document_key}
                                  documentName={item.document_name}
                                  category={item.category}
                                  required={item.required}
                                  status={item.status as any}
                                  canEdit={false}
                                  initialData={initialData}
                                />
                              </Suspense>
                            </ReviewFormErrorBoundary>
                          </div>
                        </details>
                      ) : (
                        <p className="text-xs text-slate-500">
                          No submitted form data to review yet.
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function RequiredDocsProgress({
  items,
  status,
}: {
  items: OnboardingItem[]
  status?: string | null
}) {
  const required = items.filter((item) => item.required)
  const done = required.filter((item) =>
    ['approved', 'waived', 'completed'].includes(item.status),
  ).length
  const total = required.length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  const training = items.find(
    (item) => item.document_key === 'role_training',
  )

  return (
    <div className="border-b border-white/10 bg-black/20 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-300">
          Required Documents
        </p>
        <span
          className={`rounded-full border px-2 py-1 text-[9px] font-bold ${
            status === 'active'
              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
              : status === 'onboarding'
                ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200'
                : 'border-amber-400/20 bg-amber-500/10 text-amber-200'
          }`}
        >
          {formatLabel(status ?? 'hired_pending_documents')}
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2 text-[10px] text-slate-500">
        {done}/{total} required items approved. Employment stays
        pending until all are approved.
      </p>

      {training && (
        <p className="mt-1 text-[10px] text-slate-500">
          Training ({formatLabel(training.status)}): 2 weeks, 1 hour
          daily. Completing it activates the role and unlocks payroll.
          {training.status === 'waived' &&
            ' Waived for non-payroll platform role.'}
        </p>
      )}
    </div>
  )
}

function PayrollSection({
  employees,
  payrollProfiles,
}: {
  employees: EmployeeRecord[]
  payrollProfiles: PayrollProfile[]
}) {
  const profileMap = new Map(
    payrollProfiles.map((profile) => [
      profile.employee_id,
      profile,
    ]),
  )

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/80">
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
            <Banknote className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-black text-white">
              TC Payroll Readiness
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              This area tracks what Mai Troll has collected. It does
              not claim that an employee is enrolled in TC until
              a provider employee ID or confirmed integration status
              is recorded.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-white/10 bg-black/20 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-bold">Employee</th>
              <th className="px-4 py-3 font-bold">Employment</th>
              <th className="px-4 py-3 font-bold">Payroll</th>
              <th className="px-4 py-3 font-bold">Tax Forms</th>
              <th className="px-4 py-3 font-bold">
                Direct Deposit
              </th>
              <th className="px-4 py-3 font-bold">Provider ID</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/[0.06]">
            {employees
              .filter(
                (employee) =>
                  employee.employment_status !== 'terminated',
              )
              .map((employee) => {
                const payroll = profileMap.get(employee.user_id)

                return (
                  <tr key={employee.user_id}>
                    <td className="px-4 py-4">
                      <p className="font-bold text-white">
                        {employee.profile?.username ??
                          'Unnamed Employee'}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {formatLabel(employee.profile?.role)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {formatLabel(
                        employee.employment_status,
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {formatLabel(
                        payroll?.payroll_status ??
                          employee.payroll_status ??
                          'not_started',
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {formatLabel(
                        payroll?.tax_forms_status ??
                          'not_started',
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {formatLabel(
                        payroll?.direct_deposit_status ??
                          'not_started',
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {payroll?.provider_employee_id ??
                        'Pending TC'}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ApplicationReviewModal({
  application,
  actorId,
  onClose,
  onChanged,
}: {
  application: JobApplication
  actorId?: string
  onClose: () => void
  onChanged: () => void | Promise<void>
}) {
  const suggestedRole = deriveRoleFromPosition(
    application.position,
  )
  const [role, setRole] = useState(suggestedRole)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const updateApplicationStatus = async (
    status: ApplicationStatus,
  ) => {
    if (!actorId) {
      toast.error('Your HR account could not be verified.')
      return
    }

    if (reason.trim().length < 5) {
      toast.error('Enter a complete decision reason.')
      return
    }

    setBusy(true)

    try {
      const { error } = await supabase
        .from('job_applications')
        .update({
          status,
          reviewed_by: actorId,
          reviewed_at: new Date().toISOString(),
          review_notes: reason.trim(),
        })
        .eq('id', application.id)

      if (error) throw error

      if (status === 'approved') {
        await grantEmployeeRole({
          userId: application.user_id,
          role,
          applicationId: application.id,
          actorId,
          reason: reason.trim(),
        })

        const now = new Date().toISOString()

        const { error: recordError } = await supabase
          .from('employee_records')
          .upsert(
            {
              user_id: application.user_id,
              employment_status: 'hired_pending_documents',
              department: getDepartment(role),
              job_title:
                application.position?.title ??
                formatLabel(role),
              hire_date: now,
              termination_date: null,
              payroll_status: 'not_started',
              updated_at: now,
            },
            { onConflict: 'user_id' },
          )

        if (recordError) throw recordError

        const { error: payrollError } = await supabase
          .from('hr_payroll_profiles')
          .upsert(
            {
              employee_id: application.user_id,
              provider: 'TC',
              payroll_status: 'not_started',
              direct_deposit_status: 'not_started',
              tax_forms_status: 'not_started',
            },
            { onConflict: 'employee_id' },
          )

        if (payrollError) throw payrollError

        // Automatically issue the required onboarding document packet so the
        // new hire begins the required-documents gate immediately.
        await sendOnboardingPacketFor({
          userId: application.user_id,
          actorId,
          role,
          department: getDepartment(role),
        })

        await supabase.rpc('log_employee_audit', {
          p_actor: actorId,
          p_action: 'hire',
          p_target: application.user_id,
          p_new: {
            role,
            application_status: status,
            employment_status: 'hired_pending_documents',
          },
          p_reason: reason.trim(),
          p_department: getDepartment(role),
        })

        // Notify the newly-hired user that onboarding has started.
        await supabase.from('notifications').insert({
          user_id: application.user_id,
          type: 'employee_hire',
          title: 'You have been hired!',
          message: `Congratulations! You have been hired as ${formatLabel(
            role,
          )}. Complete your onboarding packet to activate your role.`,
          metadata: {
            role,
            employment_status: 'hired_pending_documents',
          },
        })

        toast.success(
          'Applicant hired. Required onboarding docs sent; role activates after documents are approved.',
        )

        await onChanged()
      }

      if (status === 'approved') {
        await onChanged()
        return
      }

      await supabase.rpc('log_employee_audit', {
        p_actor: actorId,
        p_action: `application_${status}`,
        p_target: application.user_id,
        p_new: {
          application_status: status,
        },
        p_reason: reason.trim(),
        p_department: 'human_resources',
      })

      toast.success(
        `Application marked ${formatLabel(status).toLowerCase()}.`,
      )

      await onChanged()
    } catch (error) {
      console.error('Unable to process application:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'The application could not be processed.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Review Application" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-lg font-black text-white">
            {application.applicant?.username ??
              application.applicant_name ??
              'Applicant'}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {application.position?.title ??
              'Position not identified'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Applied {formatDateTime(application.created_at)}
          </p>

          {application.cover_letter && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-400">
              {application.cover_letter}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300">
            Employee role
          </label>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white"
          >
            {EMPLOYEE_ROLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <p className="mt-1 text-[10px] leading-4 text-amber-200/70">
            The role is derived from the career-position record or
            selected here. The position ID itself is never used as a
            role.
          </p>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300">
            HR decision reason
          </label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Document the reason for approval, rejection, or continued review."
            className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-[#090D15] p-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void updateApplicationStatus('approved')
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-black text-slate-950 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            Hire & Start Onboarding
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void updateApplicationStatus('rejected')
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 text-sm font-black text-rose-200 disabled:opacity-40"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void updateApplicationStatus('reviewing')
            }
            className="min-h-11 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 text-sm font-bold text-cyan-200 disabled:opacity-40"
          >
            Mark Reviewing
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void updateApplicationStatus('interview')
            }
            className="min-h-11 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 text-sm font-bold text-violet-200 disabled:opacity-40"
          >
            Move to Interview
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

async function grantEmployeeRole({
  userId,
  role,
  applicationId,
  actorId,
  reason,
}: {
  userId: string
  role: string
  applicationId?: string
  actorId: string
  reason: string
}) {
  if (role === 'troll_officer') {
    const { error } = await supabase.rpc(
      'approve_officer_application',
      {
        p_user_id: userId,
      },
    )

    if (error) throw error
    return
  }

  if (role === 'lead_troll_officer') {
    const { error } = await supabase.rpc(
      'approve_lead_officer_application',
      {
        p_app_id: applicationId,
        p_reviewer_id: actorId,
      },
    )

    if (error) throw error
    return
  }

  const { error } = await supabase.rpc('set_user_role', {
    target_user: userId,
    new_role: role,
    reason,
    acting_admin_id: actorId,
  })

  if (error) throw error
}

/**
 * Builds and upserts the required onboarding document packet for a new hire,
 * one hr_onboarding_items row per template in ONBOARDING_DOCUMENTS.
 * Returns the number of items created.
 */
async function sendOnboardingPacketFor({
  userId,
  actorId,
  role,
  department,
}: {
  userId: string
  actorId: string
  role: string
  department: string
}): Promise<number> {
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 7)

  const payload = ONBOARDING_DOCUMENTS.map((document) => ({
    employee_id: userId,
    document_key: document.key,
    document_name: document.name,
    category: document.category,
    required: document.required,
    status: 'sent',
    due_date: dueDate.toISOString().slice(0, 10),
    sent_at: new Date().toISOString(),
    requested_by: actorId,
    notes: document.description,
  }))

  const { error } = await supabase
    .from('hr_onboarding_items')
    .upsert(payload, {
      onConflict: 'employee_id,document_key',
    })

  if (error) throw error

  const { error: taskError } = await supabase
    .from('employee_tasks')
    .insert({
      title: 'Complete Employee Onboarding Packet',
      description:
        'Open the HR onboarding checklist and complete every required form, acknowledgment, upload, and payroll-readiness item by the due date.',
      priority: 'high',
      assigned_by: actorId,
      assigned_to: userId,
      assigned_role: role,
      department,
      category: 'HR Onboarding',
      due_date: dueDate.toISOString().slice(0, 10),
      status: 'assigned',
    })

  if (taskError) throw taskError

  await supabase.rpc('log_employee_audit', {
    p_actor: actorId,
    p_action: 'send_onboarding_packet',
    p_target: userId,
    p_new: {
      item_count: payload.length,
      due_date: dueDate.toISOString().slice(0, 10),
    },
    p_reason: 'HR onboarding packet issued at hire',
    p_department: 'human_resources',
  })

  return payload.length
}

/**
 * Required-document gate: the employee may only leave
 * 'hired_pending_documents' once every REQUIRED hr_onboarding_items row for
 * them is 'approved' (or 'waived'/'completed'). Training (role_training) is
 * tracked through the same item status.
 */
function areRequiredDocsComplete(
  items: OnboardingItem[],
  employeeId: string,
): boolean {
  const required = items.filter(
    (item) => item.employee_id === employeeId && item.required,
  )

  if (required.length === 0) return false

  return required.every((item) =>
    ['approved', 'waived', 'completed'].includes(item.status),
  )
}

function EmployeeActionModal({
  employee,
  actorId,
  onClose,
  onChanged,
}: {
  employee: EmployeeRecord
  actorId?: string
  onClose: () => void
  onChanged: () => void | Promise<void>
}) {
  const currentRole = employee.profile?.role ?? 'employee'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const protectedEmployee = PROTECTED_ROLES.has(currentRole)

  const performAction = async (action: HrAction) => {
    if (!actorId) {
      toast.error('Your HR account could not be verified.')
      return
    }

    if (protectedEmployee) {
      toast.error(
        'Protected administrative and executive roles cannot be changed from this HR panel.',
      )
      return
    }

    if (reason.trim().length < 5) {
      toast.error('Enter a complete HR action reason.')
      return
    }

    const confirmed = window.confirm(
      `Confirm ${formatLabel(action).toLowerCase()} for ${
        employee.profile?.username ?? 'this employee'
      }?`,
    )

    if (!confirmed) return

    setBusy(true)

    try {
      const now = new Date().toISOString()

      if (action === 'terminate') {
        const { error: roleError } = await supabase.rpc(
          'set_user_role',
          {
            target_user: employee.user_id,
            new_role: 'user',
            reason: reason.trim(),
            acting_admin_id: actorId,
          },
        )

        if (roleError) throw roleError

        const { error } = await supabase
          .from('employee_records')
          .update({
            employment_status: 'terminated',
            termination_date: now,
            payroll_status: 'termination_pending',
            updated_at: now,
          })
          .eq('user_id', employee.user_id)

        if (error) throw error
      }

      if (action === 'suspend') {
        const { error } = await supabase
          .from('employee_records')
          .update({
            employment_status: 'suspended',
            updated_at: now,
          })
          .eq('user_id', employee.user_id)

        if (error) throw error
      }

      if (action === 'reactivate') {
        const { error } = await supabase
          .from('employee_records')
          .update({
            employment_status: 'active',
            termination_date: null,
            updated_at: now,
          })
          .eq('user_id', employee.user_id)

        if (error) throw error
      }

      if (
        action === 'promote' ||
        action === 'revoke_lead'
      ) {
        const { error } = await supabase.rpc(
          'set_lead_officer_status',
          {
            p_user_id: employee.user_id,
            p_make_lead: action === 'promote',
          },
        )

        if (error) throw error
      }

      await supabase.rpc('log_employee_audit', {
        p_actor: actorId,
        p_action: action,
        p_target: employee.user_id,
        p_new: {
          employment_status:
            action === 'terminate'
              ? 'terminated'
              : action === 'suspend'
                ? 'suspended'
                : action === 'reactivate'
                  ? 'active'
                  : undefined,
        },
        p_reason: reason.trim(),
        p_department:
          employee.department ??
          getDepartment(currentRole),
      })

      toast.success(
        `${formatLabel(action)} action completed.`,
      )
      await onChanged()
    } catch (error) {
      console.error('Unable to complete HR action:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'The HR action could not be completed.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Employee HR Record" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-lg font-black text-white">
            {employee.profile?.username ?? 'Unnamed Employee'}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {formatLabel(currentRole)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-bold text-slate-600">
                Status
              </p>
              <p className="mt-1 text-slate-300">
                {formatLabel(employee.employment_status)}
              </p>
            </div>
            <div>
              <p className="font-bold text-slate-600">
                Hire Date
              </p>
              <p className="mt-1 text-slate-300">
                {formatDate(employee.hire_date)}
              </p>
            </div>
          </div>
        </div>

        {protectedEmployee && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4 text-xs leading-5 text-amber-100/75">
            This is a protected administrative or executive role.
            It cannot be suspended, demoted, or terminated from this
            panel.
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-slate-300">
            HR action reason
          </label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Document the factual reason. This will be preserved in the audit trail."
            className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-[#090D15] p-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {employee.employment_status === 'suspended' ? (
            <ActionButton
              label="Reactivate"
              icon={UserCheck}
              disabled={busy || protectedEmployee}
              onClick={() =>
                void performAction('reactivate')
              }
              className="border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
            />
          ) : (
            <ActionButton
              label="Suspend"
              icon={ShieldAlert}
              disabled={
                busy ||
                protectedEmployee ||
                employee.employment_status === 'terminated'
              }
              onClick={() => void performAction('suspend')}
              className="border-amber-400/20 bg-amber-500/10 text-amber-200"
            />
          )}

          <ActionButton
            label={
              employee.profile?.is_lead_officer
                ? 'Revoke Lead'
                : 'Promote to Lead'
            }
            icon={ShieldCheck}
            disabled={
              busy ||
              protectedEmployee ||
              ![
                'troll_officer',
                'lead_troll_officer',
              ].includes(currentRole)
            }
            onClick={() =>
              void performAction(
                employee.profile?.is_lead_officer
                  ? 'revoke_lead'
                  : 'promote',
              )
            }
            className="border-cyan-400/20 bg-cyan-500/10 text-cyan-200"
          />

          <ActionButton
            label="Terminate Employment"
            icon={UserMinus}
            disabled={
              busy ||
              protectedEmployee ||
              employee.employment_status === 'terminated'
            }
            onClick={() => void performAction('terminate')}
            className="border-rose-400/20 bg-rose-500/10 text-rose-200 sm:col-span-2"
          />
        </div>
      </div>
    </ModalShell>
  )
}

function ActionButton({
  label,
  icon: Icon,
  disabled,
  onClick,
  className,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  disabled: boolean
  onClick: () => void
  className: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-35 ${className}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101520] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#101520]/95 px-4 py-4 backdrop-blur sm:px-5">
          <h2 className="text-lg font-black text-white">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-white"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-80 items-center justify-center rounded-2xl border border-white/10 bg-[#101520]/80">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
        <p className="mt-3 text-sm font-bold text-slate-300">
          Loading HR management
        </p>
      </div>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-8 text-center">
      <AlertCircle className="mx-auto h-9 w-9 text-rose-300" />
      <p className="mt-3 text-sm font-black text-rose-100">
        HR dashboard could not be loaded
      </p>
      <p className="mt-2 text-xs text-rose-100/65">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg border border-rose-300/20 px-4 py-2 text-xs font-bold text-rose-100"
      >
        Try Again
      </button>
    </div>
  )
}