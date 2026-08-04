import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { useAuthStore } from '@/lib/store'
import { supabase, UserRole } from '@/lib/supabase'
import useSEO from '@/hooks/useSEO'
import {
  Briefcase,
  Search,
  Shield,
  Church,
  Video,
  FileText,
  Star,
  Newspaper,
  Radio,
  Mic,
  Users,
  Crown,
  ChevronRight,
  Sparkles,
  Gavel,
  Building2,
  Save,
  Lock,
  Unlock,
  RefreshCw,
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock3,
  ClipboardCheck,
  BadgeCheck,
  DollarSign,
  HeartHandshake,
  Loader2,
  UserPlus,
  Download,
  FileSignature,
  AlertTriangle,
  Wallet,
  Layers,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface JobPosition {
  id: string
  title: string
  department: string
  description: string
  requirements: string[]
  benefits: string[]
  icon: React.ElementType
  color: string
  /** Payroll employees vs volunteer/community platform roles */
  isPayroll: boolean
}

interface CareerPositionSettings {
  id: string
  title: string
  department: string
  description: string | null
  max_applications: number
  is_open: boolean
  is_payroll?: boolean | null
  requirements?: string[] | null
  benefits?: string[] | null
  icon?: string | null
  color?: string | null
}

interface JobApplication {
  id: string
  user_id: string
  position_id: string | null
  status: string
  created_at: string
  reviewed_by?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
}

interface ApplicantRow extends JobApplication {
  applicant?: { id: string; username: string | null } | null
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_MAX_APPLICATIONS = 10
const ADMIN_MAX_APPLICATIONS_PER_POSITION = 2
const INACTIVE_STATUSES = new Set(['rejected', 'withdrawn', 'cancelled', 'archived'])

const jobPositions: JobPosition[] = [
  // ---------------- PAYROLL EMPLOYEE POSITIONS ----------------
  {
    id: 'secretary',
    title: 'Secretary',
    department: 'City Operations',
    description:
      'Official city support role for admin operations, reports, meetings, and city coordination. Salaried employee with full onboarding.',
    requirements: ['Strong communication', 'Reliable follow-up', 'Can organize reports and city requests'],
    benefits: ['Weekly salary', 'Secretary tools access', 'Full employee onboarding & benefits'],
    icon: Briefcase,
    color: 'from-cyan-500 to-blue-500',
    isPayroll: true,
  },
  {
    id: 'troll_officer',
    title: 'Troll Officer',
    department: 'Utromail',
    description:
      'Official city enforcer responsible for reports, moderation, investigations, arrests, and safety response. Salaried employee.',
    requirements: ['Previous moderation experience', 'Strong understanding of city rules', 'Good judgment under pressure'],
    benefits: ['Weekly salary', 'Officer badge & tools', 'Full employee onboarding & benefits'],
    icon: Shield,
    color: 'from-purple-500 to-pink-500',
    isPayroll: true,
  },
  {
    id: 'lead_troll_officer',
    title: 'Lead Troll Officer',
    department: 'Utromail Leadership',
    description:
      'Senior enforcement role overseeing Troll Officers, cases, escalation, and city safety consistency. Salaried leadership employee.',
    requirements: ['Previous Troll Officer experience', 'Leadership skills', 'Ability to train officers'],
    benefits: ['Leadership salary', 'Officer oversight tools', 'Full employee onboarding & benefits'],
    icon: Crown,
    color: 'from-yellow-500 to-orange-500',
    isPayroll: true,
  },
  {
    id: 'ceo_assistant',
    title: 'CEO Assistant',
    department: 'Executive Office',
    description:
      'Assist the CEO with reports, coordination, admin follow-up, and platform operations. Salaried executive support employee.',
    requirements: ['Reliable communication', 'Confidentiality', 'Strong organization'],
    benefits: ['Executive salary', 'Direct CEO support assignment', 'Full employee onboarding & benefits'],
    icon: Crown,
    color: 'from-yellow-400 to-cyan-500',
    isPayroll: true,
  },
  {
    id: 'noah_assistant',
    title: 'Noah Assistant',
    department: 'Executive Office',
    description:
      'Assist Noah Admin with reports, support tasks, and city operation follow-up. Salaried admin support employee.',
    requirements: ['Reliable communication', 'Admin support mindset', 'Strong follow-up'],
    benefits: ['Admin salary', 'Assigned to Noah Admin support', 'Full employee onboarding & benefits'],
    icon: Briefcase,
    color: 'from-purple-500 to-cyan-500',
    isPayroll: true,
  },
  {
    id: 'tcnn_chief_news_caster',
    title: 'TCNN Chief News Caster',
    department: 'TCNN Leadership',
    description:
      'Lead the TCNN team, manage journalists and news casters, and maintain editorial standards. Salaried leadership employee.',
    requirements: ['News/journalism leadership experience', 'Strong editorial judgment', 'Team management skills'],
    benefits: ['Leadership salary', 'Manage TCNN staff', 'Access to TCNN analytics dashboard'],
    icon: Radio,
    color: 'from-amber-500 to-yellow-500',
    isPayroll: true,
  },
  {
    id: 'agency_hr_manager',
    title: 'Agency HR Manager',
    department: 'Agency HR',
    description:
      'Manage, approve, review, and settle issues for Mai Troll agencies. Salaried HR management employee.',
    requirements: ['Attention to detail', 'Reliable communication', 'Ability to review agency applications'],
    benefits: ['HR salary', 'Agency HR dashboard access', 'Reports to admin dashboard'],
    icon: Building2,
    color: 'from-slate-400 to-cyan-500',
    isPayroll: true,
  },

  // ---------------- NON-PAYROLL PLATFORM ROLES ----------------
  {
    id: 'auctioneer',
    title: 'Auctioneer',
    department: 'Live Auctions',
    description:
      'Host live auction shows where users bid with Troll Coins and build a trusted auctioneer reputation.',
    requirements: ['Must be 18 years or older', 'Good community standing', 'Reliable streaming setup'],
    benefits: ['Auctioneer Studio access', 'Earn from successful auctions', 'Moderate auction rooms'],
    icon: Star,
    color: 'from-green-500 to-emerald-500',
    isPayroll: false,
  },
  {
    id: 'prosecutor',
    title: 'Prosecutor',
    department: 'Troll Court',
    description:
      'Represents Mai Troll in court cases, reviews evidence, presents charges, and supports city justice.',
    requirements: ['Understanding of court process', 'Strong presentation skills', 'Commitment to fair judgment'],
    benefits: ['Prosecutor badge', 'Access to case management', 'City-wide recognition'],
    icon: Gavel,
    color: 'from-red-500 to-orange-500',
    isPayroll: false,
  },
  {
    id: 'attorney',
    title: 'Attorney',
    department: 'Troll Court',
    description:
      'Defense attorney representing defendants in Troll Court cases, appeals, hearings, and disputes.',
    requirements: ['Strong reasoning skills', 'Excellent communication', 'Professional courtroom conduct'],
    benefits: ['Attorney badge', 'Access to court case system', 'Build reputation as advocate'],
    icon: FileText,
    color: 'from-amber-500 to-yellow-500',
    isPayroll: false,
  },
  {
    id: 'tcnn_news_caster',
    title: 'TCNN News Caster',
    department: 'TCNN',
    description:
      'On-air TCNN personality delivering breaking news, live reports, and official city broadcasts.',
    requirements: ['Broadcasting or journalism experience', 'Professional on-camera presence', 'Must be at least 18 years old'],
    benefits: ['News Caster badge', 'Ability to go live on TCNN', 'Platform-wide visibility'],
    icon: Mic,
    color: 'from-red-500 to-orange-500',
    isPayroll: false,
  },
  {
    id: 'journalist',
    title: 'Journalist',
    department: 'TCNN',
    description:
      'Write articles, conduct investigations, and keep the city informed through Mai Troll News Network.',
    requirements: ['Strong writing skills', 'Ability to research and verify facts', 'Commitment to unbiased reporting'],
    benefits: ['Journalist badge', 'Access to TCNN content dashboard', 'Potential to advance to News Caster'],
    icon: Newspaper,
    color: 'from-blue-500 to-cyan-500',
    isPayroll: false,
  },
  {
    id: 'troller',
    title: 'Troller',
    department: 'Broadcasting',
    description:
      'Entertainer role focused on playful chaos, satire, comedy, and broadcast engagement within city rules.',
    requirements: ['Must be 18 years or older', 'Ability to create engaging content', 'Stable internet and streaming setup'],
    benefits: ['Earn coins from engagement', 'Broadcast growth opportunities', 'Platform-wide promotion potential'],
    icon: Video,
    color: 'from-cyan-500 to-blue-500',
    isPayroll: false,
  },
  {
    id: 'agency_hr',
    title: 'Agency HR',
    department: 'Agency HR',
    description: 'Support agency applications, reports, fee reviews, and HR operations.',
    requirements: ['Organized workflow', 'Professional communication', 'Can follow review checklists'],
    benefits: ['Agency support access', 'HR experience', 'Staff pipeline'],
    icon: UserCheck,
    color: 'from-teal-500 to-cyan-500',
    isPayroll: false,
  },
  {
    id: 'agency_leader',
    title: 'Agency Leader',
    department: 'Agencies',
    description: 'Lead a Mai Troll agency, recruit members, and grow creator talent.',
    requirements: ['Leadership skills', 'Recruitment ability', 'Strong community standing'],
    benefits: ['Agency dashboard access', 'Build creator teams', 'Potential weekly role perk from Treasury'],
    icon: Users,
    color: 'from-violet-500 to-purple-500',
    isPayroll: false,
  },
  {
    id: 'pastor',
    title: 'Pastor',
    department: 'Troll Church',
    description:
      'Lead spiritual services, provide guidance and pastoral care to the community, and officiate church events.',
    requirements: ['Strong communication skills', 'Commitment to community support', 'Good community standing'],
    benefits: ['Pastor badge', 'Access to Pastor Dashboard', 'Church broadcast capabilities', 'Pastoral chat channels'],
    icon: Church,
    color: 'from-green-500 to-emerald-500',
    isPayroll: false,
  },
]

const positionToRoleCheck: Record<string, { field: string; message: string }> = {
  auctioneer: { field: 'is_auctioneer', message: 'You are already an Auctioneer' },
  secretary: { field: 'is_secretary', message: 'You are already a Secretary' },
  troll_officer: { field: 'is_troll_officer', message: 'You are already a Troll Officer' },
  lead_troll_officer: { field: 'is_lead_officer', message: 'You are already a Lead Troll Officer' },
  troller: { field: 'is_troller', message: 'You are already a Troller' },
  journalist: { field: 'is_journalist', message: 'You are already a Journalist' },
  tcnn_news_caster: { field: 'is_news_caster', message: 'You are already a News Caster' },
  tcnn_chief_news_caster: { field: 'is_chief_news_caster', message: 'You are already a Chief News Caster' },
  prosecutor: { field: 'is_prosecutor', message: 'You are already a Prosecutor' },
  attorney: { field: 'is_attorney', message: 'You are already an Attorney' },
  pastor: { field: 'is_pastor', message: 'You are already a Pastor' },
  agency_hr_manager: { field: 'is_agency_hr_manager', message: 'You are already an Agency HR Manager' },
  agency_hr: { field: 'is_agency_hr', message: 'You are already Agency HR' },
  agency_leader: { field: 'is_agency_leader', message: 'You are already an Agency Leader' },
  ceo_assistant: { field: 'is_ceo_assistant', message: 'You are already a CEO Assistant' },
  noah_assistant: { field: 'is_noah_assistant', message: 'You are already a Noah Assistant' },
}

const roleBooleanField: Record<string, string> = {
  auctioneer: 'is_auctioneer',
  prosecutor: 'is_prosecutor',
  attorney: 'is_attorney',
  tcnn_news_caster: 'is_news_caster',
  secretary: 'is_secretary',
  tcnn_chief_news_caster: 'is_chief_news_caster',
  troll_officer: 'is_troll_officer',
  journalist: 'is_journalist',
  lead_troll_officer: 'is_lead_officer',
  troller: 'is_troller',
  pastor: 'is_pastor',
  agency_hr: 'is_agency_hr',
  agency_hr_manager: 'is_agency_hr_manager',
  agency_leader: 'is_agency_leader',
  ceo_assistant: 'is_ceo_assistant',
  noah_assistant: 'is_noah_assistant',
}

/* ------------------------------------------------------------------ */
/*  I-9 acceptable documents (List A / B / C)                          */
/* ------------------------------------------------------------------ */

const I9_LIST_A = [
  'U.S. Passport or U.S. Passport Card',
  'Permanent Resident Card / Alien Registration Receipt Card (Form I-551)',
  'Foreign passport with a temporary I-551 stamp or MRIV',
  'Employment Authorization Document that contains a photograph (Form I-766)',
  'Foreign passport with Form I-94 (FSM / RMI nationals)',
]

const I9_LIST_B = [
  "Driver's license or ID card issued by a U.S. state or outlying possession",
  'ID card issued by federal, state, or local government agencies',
  'School ID card with a photograph',
  'Voter registration card',
  'U.S. Military card or draft record',
  'Native American tribal document',
]

const I9_LIST_C = [
  'U.S. Social Security Account Number card (unrestricted)',
  'Certification of Birth Abroad (Form FS-545) or Report of Birth (Form DS-1350)',
  'Original or certified copy of a U.S. birth certificate',
  'U.S. Citizen ID Card (Form I-197)',
  'Employment authorization document issued by DHS',
]

const DOCS_BUCKET = 'employee-documents'

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

function statusTone(status?: string | null) {
  const s = (status || 'pending').toLowerCase()
  if (s === 'approved' || s === 'hired') return 'bg-emerald-500/10 text-emerald-200 border-emerald-300/20'
  if (s === 'rejected') return 'bg-rose-500/10 text-rose-200 border-rose-300/20'
  if (s === 'reviewing' || s === 'interview') return 'bg-cyan-500/10 text-cyan-200 border-cyan-300/20'
  if (s === 'archived' || s === 'withdrawn') return 'bg-slate-500/10 text-slate-200 border-slate-300/20'
  return 'bg-amber-500/10 text-amber-200 border-amber-300/20'
}

function statusIcon(status?: string | null) {
  const s = (status || 'pending').toLowerCase()
  if (s === 'approved' || s === 'hired') return <CheckCircle2 className="h-3.5 w-3.5" />
  if (s === 'rejected') return <XCircle className="h-3.5 w-3.5" />
  return <Clock3 className="h-3.5 w-3.5" />
}

/* ------------------------------------------------------------------ */
/*  I-9 Section 2 PDF generation (pdf-lib, generated from scratch)     */
/* ------------------------------------------------------------------ */

export interface I9Section2Data {
  employeeName: string
  positionTitle: string
  documentTitle: string
  issuingAuthority: string
  documentNumber: string
  expirationDate: string
  firstDayOfEmployment: string
  employerRepSignature: string
  employerRepNameTitle: string
  businessName: string
  businessAddress: string
  dateCompleted: string
}

async function generateI9Section2Pdf(data: I9Section2Data): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792]) // US Letter
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const marginX = 48
  let y = 744
  const line = (
    text: string,
    opts: { size?: number; font?: any; color?: [number, number, number]; indent?: number } = {},
  ) => {
    const size = opts.size ?? 10
    page.drawText(text, {
      x: marginX + (opts.indent ?? 0),
      y,
      size,
      font: opts.font ?? font,
      color: rgb(...(opts.color ?? [0.1, 0.1, 0.12])),
    })
    y -= size + 8
  }
  const gap = (h = 6) => {
    y -= h
  }
  const rule = () => {
    page.drawLine({
      start: { x: marginX, y: y + 4 },
      end: { x: 612 - marginX, y: y + 4 },
      thickness: 0.75,
      color: rgb(0.75, 0.78, 0.82),
    })
    y -= 10
  }
  const field = (label: string, value: string) => {
    page.drawText(`${label}:`, { x: marginX, y, size: 9, font: bold, color: rgb(0.25, 0.28, 0.32) })
    page.drawText(value || '—', { x: marginX + 190, y, size: 10, font, color: rgb(0.08, 0.08, 0.1) })
    y -= 22
  }

  line('MaiTroll', { size: 16, font: bold, color: [0.05, 0.6, 0.72] })
  line('Form I-9, Section 2 — Employer or Authorized Representative Review and Verification', {
    size: 11,
    font: bold,
  })
  line('U.S. Employment Eligibility Verification (completed by HR)', { size: 8, color: [0.4, 0.42, 0.46] })
  gap(2)
  rule()
  gap(4)

  line('Employee', { size: 10, font: bold, color: [0.05, 0.6, 0.72] })
  field('Employee name', data.employeeName)
  field('Position', data.positionTitle)
  gap(4)

  line('Documents examined', { size: 10, font: bold, color: [0.05, 0.6, 0.72] })
  field('Document title', data.documentTitle)
  field('Issuing authority', data.issuingAuthority)
  field('Document number', data.documentNumber)
  field('Expiration date', data.expirationDate)
  gap(4)

  line('Certification', { size: 10, font: bold, color: [0.05, 0.6, 0.72] })
  const cert =
    'I attest, under penalty of perjury, that (1) I have examined the document(s) presented by the ' +
    'above-named employee, (2) the above-listed document(s) appear to be genuine and to relate to the ' +
    'employee named, and (3) to the best of my knowledge the employee is authorized to work in the United States.'
  const wrapped = wrapText(cert, font, 8.5, 612 - marginX * 2)
  wrapped.forEach((w) => line(w, { size: 8.5, color: [0.3, 0.32, 0.36] }))
  gap(2)

  field("Employee's first day of employment", data.firstDayOfEmployment)
  field('Employer rep. signature', data.employerRepSignature)
  field('Employer rep. name & title', data.employerRepNameTitle)
  field('Business/Organization name', data.businessName)
  field('Business/Organization address', data.businessAddress)
  field('Date completed', data.dateCompleted)

  gap(8)
  rule()
  page.drawText(
    `Generated by Mai Troll HR · ${new Date().toISOString().slice(0, 10)} · This is an internal I-9 Section 2 record.`,
    { x: marginX, y, size: 7.5, font, color: rgb(0.55, 0.57, 0.6) },
  )

  return pdf.save()
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

/* ================================================================== */
/*  Careers Portal Page                                               */
/* ================================================================== */

export default function JobsHowToPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuthStore()

  useSEO({
    title: 'Careers | Mai Troll - Employee Positions & Platform Roles',
    description:
      'Apply for payroll employee positions and community platform roles at Mai Troll. Track your applications, view status, and join the team.',
    keywords: ['careers', 'jobs', 'hiring', 'MaiTroll jobs', 'employee positions', 'platform roles'],
  })

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'payroll' | 'platform'>('all')
  const [department, setDepartment] = useState('All')

  const [settingsById, setSettingsById] = useState<Record<string, CareerPositionSettings>>({})
  const [countsById, setCountsById] = useState<Record<string, number>>({})
  const [adminDrafts, setAdminDrafts] = useState<Record<string, { max_applications: number; is_open: boolean }>>({})
  const [userApplications, setUserApplications] = useState<JobApplication[]>([])
  const [applicantsByPosition, setApplicantsByPosition] = useState<Record<string, ApplicantRow[]>>({})

  const [isLoading, setIsLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [expandedAdminPosition, setExpandedAdminPosition] = useState<string | null>(null)

  const roleValue = String(profile?.role ?? '')
  const isAdminOrLead =
    roleValue === 'admin' ||
    profile?.troll_role === 'admin' ||
    roleValue === UserRole.HR_ADMIN ||
    roleValue === UserRole.AGENCY_HR_MANAGER ||
    profile?.is_admin ||
    roleValue === 'superadmin' ||
    profile?.troll_role === 'ceo' ||
    profile?.is_superadmin ||
    roleValue === 'lead_troll_officer' ||
    profile?.troll_role === 'lead_troll_officer' ||
    profile?.is_lead_officer

  const departments = useMemo(
    () => ['All', ...Array.from(new Set(jobPositions.map((job) => job.department)))],
    [],
  )

  const payrollPositions = useMemo(() => jobPositions.filter((j) => j.isPayroll), [])
  const platformPositions = useMemo(() => jobPositions.filter((j) => !j.isPayroll), [])

  /* --------------------------- Data loading --------------------------- */

  const loadJobsData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Positions settings — select only guaranteed columns to stay resilient
      const { data: careerSettings } = await supabase
        .from('career_positions')
        .select('id, title, department, description, max_applications, is_open')

      const nextSettingsById: Record<string, CareerPositionSettings> = {}
      const nextDrafts: Record<string, { max_applications: number; is_open: boolean }> = {}
      ;(careerSettings || []).forEach((item: any) => {
        nextSettingsById[item.id] = item
        nextDrafts[item.id] = {
          max_applications: Number(item.max_applications ?? DEFAULT_MAX_APPLICATIONS),
          is_open: Boolean(item.is_open),
        }
      })
      setSettingsById(nextSettingsById)
      setAdminDrafts(nextDrafts)

      // Application counts (active only)
      const { data: applicationRows } = await supabase
        .from('job_applications')
        .select('position_id, status')
        .not('position_id', 'is', null)

      const nextCountsById: Record<string, number> = {}
      ;(applicationRows || []).forEach((row: any) => {
        if (!row.position_id) return
        if (INACTIVE_STATUSES.has(String(row.status || '').toLowerCase())) return
        nextCountsById[row.position_id] = (nextCountsById[row.position_id] || 0) + 1
      })
      setCountsById(nextCountsById)

      // Current user's applications
      if (user) {
        const { data: myApps } = await supabase
          .from('job_applications')
          .select('id, user_id, position_id, status, created_at, reviewed_by, reviewed_at, review_notes')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        setUserApplications((myApps as JobApplication[]) || [])
      } else {
        setUserApplications([])
      }

      // Admin: load applicants grouped by position (usernames only)
      if (isAdminOrLead) {
        const { data: allApps } = await supabase
          .from('job_applications')
          .select(
            'id, user_id, position_id, status, created_at, reviewed_by, reviewed_at, review_notes, applicant:user_profiles!job_applications_user_id_fkey_to_user_profiles(id, username)',
          )
          .order('created_at', { ascending: false })
          .limit(500)

        const grouped: Record<string, ApplicantRow[]> = {}
        ;(allApps as any[] | null)?.forEach((row) => {
          if (!row.position_id) return
          grouped[row.position_id] = grouped[row.position_id] || []
          grouped[row.position_id].push(row as ApplicantRow)
        })
        setApplicantsByPosition(grouped)
      }
    } catch (error: any) {
      console.error('[Careers] Failed to load data:', error)
      toast.error(error?.message || 'Could not load careers portal')
    } finally {
      setIsLoading(false)
    }
  }, [user, isAdminOrLead])

  useEffect(() => {
    loadJobsData()
  }, [loadJobsData])

  /* --------------------------- Derived state --------------------------- */

  const getJobState = useCallback(
    (position: JobPosition) => {
      const settings = settingsById[position.id]
      const maxApplications = Number(settings?.max_applications ?? DEFAULT_MAX_APPLICATIONS)
      const usedApplications = Number(countsById[position.id] ?? 0)
      const remainingApplications = Math.max(maxApplications - usedApplications, 0)
      const isOpen = settings?.is_open ?? true
      const isFilled = maxApplications <= 0 || remainingApplications <= 0
      const canApply = isOpen && !isFilled
      return { settings, maxApplications, usedApplications, remainingApplications, isOpen, isFilled, canApply }
    },
    [settingsById, countsById],
  )

  const getUserApplicationsForPosition = useCallback(
    (positionId: string) => userApplications.filter((app) => app.position_id === positionId),
    [userApplications],
  )

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return jobPositions.filter((job) => {
      const matchesCategory =
        categoryFilter === 'all' ||
        (categoryFilter === 'payroll' && job.isPayroll) ||
        (categoryFilter === 'platform' && !job.isPayroll)
      const matchesDepartment = department === 'All' || job.department === department
      const matchesSearch =
        !normalized ||
        job.title.toLowerCase().includes(normalized) ||
        job.department.toLowerCase().includes(normalized) ||
        job.description.toLowerCase().includes(normalized)
      return matchesCategory && matchesDepartment && matchesSearch
    })
  }, [query, department, categoryFilter])

  /* --------------------------- Actions --------------------------- */

  const handleApply = useCallback(
    async (position: JobPosition) => {
      if (!user) {
        toast.error('Please sign in to apply')
        navigate('/login')
        return
      }

      const state = getJobState(position)
      if (!state.isOpen) {
        toast.error('This position is currently closed')
        return
      }
      if (!state.canApply) {
        toast.error('This position is filled right now')
        return
      }

      // Already holds the role?
      const roleCheck = positionToRoleCheck[position.id]
      if (roleCheck && (profile as any)?.[roleCheck.field]) {
        toast.error(roleCheck.message)
        return
      }

      const myApps = getUserApplicationsForPosition(position.id)

      // Admins are limited to 2 applications PER POSITION.
      if (isAdminOrLead) {
        const activeAdminApps = myApps.filter(
          (a) => !INACTIVE_STATUSES.has(String(a.status || '').toLowerCase()),
        )
        if (activeAdminApps.length >= ADMIN_MAX_APPLICATIONS_PER_POSITION) {
          toast.error(
            `Admins are limited to ${ADMIN_MAX_APPLICATIONS_PER_POSITION} applications per position for "${position.title}".`,
          )
          return
        }
      } else if (myApps.some((a) => !INACTIVE_STATUSES.has(String(a.status || '').toLowerCase()))) {
        toast.info('You already applied for this position')
        navigate('/jobs/status')
        return
      }

      setApplyingId(position.id)
      try {
        // Make sure the position row exists so counts/relationships resolve.
        await supabase.from('career_positions').upsert(
          {
            id: position.id,
            title: position.title,
            department: position.department,
            description: position.description,
          },
          { onConflict: 'id' },
        )

        const { error } = await supabase.from('job_applications').insert({
          user_id: user.id,
          position_id: position.id,
          status: 'pending',
        })
        if (error) throw error

        toast.success(`Application submitted for ${position.title}`)
        await loadJobsData()
      } catch (error: any) {
        console.error('[Careers] Apply failed:', error)
        toast.error(error?.message || 'Could not submit application')
      } finally {
        setApplyingId(null)
      }
    },
    [user, profile, isAdminOrLead, navigate, getJobState, getUserApplicationsForPosition, loadJobsData],
  )

  const saveJobSettings = useCallback(
    async (position: JobPosition) => {
      if (!user || !isAdminOrLead) return
      const draft = adminDrafts[position.id] || { max_applications: DEFAULT_MAX_APPLICATIONS, is_open: true }
      const maxApplications = Math.max(0, Number(draft.max_applications || 0))
      setSavingId(position.id)
      try {
        const { error } = await supabase.from('career_positions').upsert(
          {
            id: position.id,
            title: position.title,
            department: position.department,
            description: position.description,
            max_applications: maxApplications,
            is_open: draft.is_open,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        )
        if (error) throw error
        toast.success(`${position.title} settings saved`)
        await loadJobsData()
      } catch (error: any) {
        console.error('[Careers] Save failed:', error)
        toast.error(error?.message || 'Could not save job settings')
      } finally {
        setSavingId(null)
      }
    },
    [user, isAdminOrLead, adminDrafts, loadJobsData],
  )

  const reviewApplication = useCallback(
    async (app: ApplicantRow, newStatus: 'reviewing' | 'approved' | 'rejected') => {
      if (!isAdminOrLead || !user) return
      if (app.user_id === user.id) {
        toast.error('You cannot review your own application')
        return
      }
      setActingId(app.id)
      try {
        const { error } = await supabase
          .from('job_applications')
          .update({
            status: newStatus,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', app.id)
        if (error) throw error
        toast.success(`Application marked ${newStatus}`)
        await loadJobsData()
      } catch (error: any) {
        console.error('[Careers] Review failed:', error)
        toast.error(error?.message || 'Could not update application')
      } finally {
        setActingId(null)
      }
    },
    [isAdminOrLead, user, loadJobsData],
  )

  // Admin: manually hire an applicant (grant role + add to payroll pipeline)
  const addEmployeeFromApplicant = useCallback(
    async (app: ApplicantRow, position: JobPosition) => {
      if (!isAdminOrLead || !user || !app.position_id) return
      if (app.user_id === user.id) {
        toast.error('You cannot hire yourself')
        return
      }
      setActingId(app.id)
      try {
        await supabase
          .from('job_applications')
          .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            review_notes: `Hired into ${position.title} by admin`,
          })
          .eq('id', app.id)

        // Grant the role via SECURITY DEFINER RPC (protected column).
        const { error: roleError } = await supabase.rpc('set_user_role', {
          target_user: app.user_id,
          new_role: position.id,
          reason: `Hired from careers portal (${position.title})`,
          acting_admin_id: user.id,
        })

        // Apply the role-specific boolean + troll_role (unrestricted columns).
        const extra: Record<string, unknown> = {
          troll_role: position.id,
          updated_at: new Date().toISOString(),
        }
        const booleanField = roleBooleanField[position.id]
        if (booleanField) extra[booleanField] = true
        await supabase.from('user_profiles').update(extra).eq('id', app.user_id)

        if (roleError) {
          console.warn('[Careers] set_user_role warning:', roleError)
          toast.warning('Applicant hired, but role assignment needs a manual check.')
        } else {
          toast.success(`${app.applicant?.username || 'Applicant'} hired as ${position.title}`)
        }
        await loadJobsData()
      } catch (error: any) {
        console.error('[Careers] Hire failed:', error)
        toast.error(error?.message || 'Could not add employee')
      } finally {
        setActingId(null)
      }
    },
    [isAdminOrLead, user, loadJobsData],
  )

  /* --------------------------- Render --------------------------- */

  const totalOpenSlots = jobPositions.reduce(
    (total, job) => total + getJobState(job).remainingApplications,
    0,
  )

  const renderCard = (position: JobPosition) => {
    const Icon = position.icon
    const state = getJobState(position)
    const draft = adminDrafts[position.id] || { max_applications: state.maxApplications, is_open: state.isOpen }
    const myApps = user ? getUserApplicationsForPosition(position.id) : []
    const activeApp = myApps.find((a) => !INACTIVE_STATUSES.has(String(a.status || '').toLowerCase()))
    const adminAppsUsed = myApps.filter(
      (a) => !INACTIVE_STATUSES.has(String(a.status || '').toLowerCase()),
    ).length
    const adminAtLimit = isAdminOrLead && adminAppsUsed >= ADMIN_MAX_APPLICATIONS_PER_POSITION
    const applicants = applicantsByPosition[position.id] || []
    const isExpanded = expandedAdminPosition === position.id

    return (
      <article
        key={position.id}
        className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] shadow-xl shadow-black/30 backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.06]"
      >
        <div className={`bg-gradient-to-r ${position.color} p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/20 p-3">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">{position.title}</h3>
                <p className="text-sm font-semibold text-white/75">{position.department}</p>
              </div>
            </div>
            <div
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${
                position.isPayroll ? 'bg-emerald-950/40 text-emerald-100' : 'bg-black/30 text-white'
              }`}
            >
              {position.isPayroll ? <Wallet className="h-3 w-3" /> : <HeartHandshake className="h-3 w-3" />}
              {position.isPayroll ? 'Payroll' : 'Platform'}
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div
            className={`mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
              position.isPayroll
                ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                : 'border-purple-400/20 bg-purple-500/10 text-purple-100'
            }`}
          >
            {position.isPayroll ? (
              <>
                <DollarSign className="h-3.5 w-3.5" /> Payroll Employee Position
              </>
            ) : (
              <>
                <Users className="h-3.5 w-3.5" /> Non-Payroll Platform Role
              </>
            )}
          </div>

          {position.isPayroll && (
            <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs font-semibold text-amber-100">
              Employee positions include salary, benefits, and full onboarding (I-9, tax forms). Requires a
              desktop/laptop with webcam, microphone, speakers, and reliable internet.
            </div>
          )}

          <p className="min-h-20 text-sm leading-6 text-slate-300">{position.description}</p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
              <p className="text-lg font-black text-cyan-100">{state.maxApplications}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Slots</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
              <p className="text-lg font-black text-purple-100">{state.usedApplications}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Applied</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
              <p className="text-lg font-black text-emerald-100">{state.remainingApplications}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Left</p>
            </div>
          </div>

          <div className="mt-5">
            <h4 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Requirements</h4>
            <ul className="space-y-2">
              {position.requirements.map((requirement) => (
                <li key={requirement} className="flex gap-2 text-sm text-slate-300">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                  <span>{requirement}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5">
            <h4 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-purple-200">Benefits</h4>
            <ul className="space-y-2">
              {position.benefits.map((benefit) => (
                <li key={benefit} className="flex gap-2 text-sm text-slate-300">
                  <Star className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Admin controls */}
          {isAdminOrLead && (
            <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-950/20 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Admin Controls</p>
                <button
                  type="button"
                  onClick={() =>
                    setAdminDrafts((prev) => ({
                      ...prev,
                      [position.id]: { ...draft, is_open: !draft.is_open },
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-white"
                >
                  {draft.is_open ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {draft.is_open ? 'Open' : 'Closed'}
                </button>
              </div>

              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Max applications
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="number"
                  min={0}
                  value={draft.max_applications}
                  onChange={(event) =>
                    setAdminDrafts((prev) => ({
                      ...prev,
                      [position.id]: { ...draft, max_applications: Number(event.target.value) },
                    }))
                  }
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
                />
                <button
                  type="button"
                  disabled={savingId === position.id}
                  onClick={() => saveJobSettings(position)}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                >
                  {savingId === position.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>

              <button
                type="button"
                onClick={() => setExpandedAdminPosition(isExpanded ? null : position.id)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]"
              >
                <Layers className="h-3.5 w-3.5" />
                {isExpanded ? 'Hide Applicants' : `Applicants (${applicants.length})`}
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-2">
                  {applicants.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-black/30 p-3 text-center text-xs text-slate-400">
                      No applicants yet.
                    </p>
                  ) : (
                    applicants.map((app) => (
                      <div key={app.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-bold text-white">
                            <UserCheck className="h-4 w-4 text-cyan-300" />
                            <span className="truncate">@{app.applicant?.username || 'unknown'}</span>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(
                              app.status,
                            )}`}
                          >
                            {statusIcon(app.status)}
                            {app.status || 'pending'}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={actingId === app.id || app.status === 'reviewing'}
                            onClick={() => reviewApplication(app, 'reviewing')}
                            className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-bold text-cyan-100 disabled:opacity-40"
                          >
                            Review
                          </button>
                          <button
                            type="button"
                            disabled={actingId === app.id || app.status === 'rejected'}
                            onClick={() => reviewApplication(app, 'rejected')}
                            className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-2 py-1 text-[11px] font-bold text-rose-100 disabled:opacity-40"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={actingId === app.id || app.status === 'approved'}
                            onClick={() => addEmployeeFromApplicant(app, position)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-100 disabled:opacity-40"
                          >
                            <UserPlus className="h-3 w-3" />
                            {position.isPayroll ? 'Add Employee' : 'Approve'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Applicant's own status */}
          {activeApp && (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3">
              <span className="text-sm font-bold text-cyan-100">Your status: {activeApp.status}</span>
              <button
                type="button"
                onClick={() => navigate('/jobs/status')}
                className="text-xs font-bold text-cyan-200 underline decoration-cyan-300/40"
              >
                Details
              </button>
            </div>
          )}

          {isAdminOrLead && (
            <p className="mt-3 text-center text-[11px] font-semibold text-amber-200">
              Admin limit: {adminAppsUsed}/{ADMIN_MAX_APPLICATIONS_PER_POSITION} applications used for this position
            </p>
          )}

          <button
            type="button"
            disabled={
              applyingId === position.id ||
              (!state.canApply && !activeApp) ||
              (isAdminOrLead && adminAtLimit) ||
              (!isAdminOrLead && !!activeApp)
            }
            onClick={() => (activeApp ? navigate('/jobs/status') : handleApply(position))}
            className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg shadow-black/30 transition ${
              activeApp
                ? 'bg-cyan-600 hover:bg-cyan-500'
                : state.canApply && !(isAdminOrLead && adminAtLimit)
                  ? `bg-gradient-to-r ${position.color} hover:scale-[1.02]`
                  : 'cursor-not-allowed bg-slate-700 text-slate-400'
            }`}
          >
            {applyingId === position.id ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
              </>
            ) : activeApp ? (
              <>
                View Application <ChevronRight className="h-4 w-4" />
              </>
            ) : isAdminOrLead && adminAtLimit ? (
              'Admin Limit Reached'
            ) : state.canApply ? (
              <>
                Apply Now <ChevronRight className="h-4 w-4" />
              </>
            ) : state.isOpen ? (
              'Filled'
            ) : (
              'Closed'
            )}
          </button>
        </div>
      </article>
    )
  }

  const displayedPayroll = filteredJobs.filter((j) => j.isPayroll)
  const displayedPlatform = filteredJobs.filter((j) => !j.isPayroll)

  return (
    <div className="min-h-screen overflow-y-auto overflow-x-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_38%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_35%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(236,72,153,0.16),transparent_42%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-white/[0.04] p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-bl-[5rem] bg-cyan-500/10 blur-2xl" />
          <div className="absolute bottom-0 left-0 h-44 w-44 rounded-tr-[5rem] bg-purple-400/10 blur-2xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-100">
                <Sparkles className="h-4 w-4" />
                Mai Troll Careers
              </div>
              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Careers &{' '}
                <span className="bg-gradient-to-r from-cyan-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
                  Open Positions
                </span>
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                Apply for <strong className="text-emerald-200">payroll employee positions</strong> — salaried roles
                with benefits and full onboarding — or join a{' '}
                <strong className="text-purple-200">non-payroll platform role</strong> to contribute to the community.
                Track your applications and status right here.
              </p>
              {isAdminOrLead && (
                <p className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100">
                  Admin mode active. Toggle positions open/closed, set max applications, and manage applicants below.
                  Note: admins can apply but are limited to {ADMIN_MAX_APPLICATIONS_PER_POSITION} applications per
                  position.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <Wallet className="mb-3 h-5 w-5 text-emerald-300" />
                <p className="text-2xl font-black">{payrollPositions.length}</p>
                <p className="text-xs font-medium text-slate-300">Payroll positions</p>
              </div>
              <div className="rounded-2xl border border-purple-400/20 bg-purple-500/10 p-4">
                <HeartHandshake className="mb-3 h-5 w-5 text-purple-300" />
                <p className="text-2xl font-black">{platformPositions.length}</p>
                <p className="text-xs font-medium text-slate-300">Platform roles</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                <Briefcase className="mb-3 h-5 w-5 text-cyan-300" />
                <p className="text-2xl font-black">{jobPositions.length}</p>
                <p className="text-xs font-medium text-slate-300">Total openings</p>
              </div>
              <div className="rounded-2xl border border-pink-400/20 bg-pink-500/10 p-4">
                <Crown className="mb-3 h-5 w-5 text-pink-300" />
                <p className="text-2xl font-black">{totalOpenSlots}</p>
                <p className="text-xs font-medium text-slate-300">Open slots</p>
              </div>
            </div>
          </div>
        </section>

        {/* My Applications */}
        {user && (
          <section className="mt-8 rounded-[1.75rem] border border-white/10 bg-black/50 p-4 shadow-xl shadow-black/30 backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">My Applications</h2>
                <p className="text-sm text-slate-400">Track your application status</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/jobs/status')}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <ClipboardCheck className="h-4 w-4" />
                View Status Page
              </button>
            </div>
            {userApplications.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                You haven't applied to any positions yet. Browse the openings below to get started.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {userApplications.map((app) => {
                  const position = jobPositions.find((j) => j.id === app.position_id)
                  if (!position) return null
                  return (
                    <div key={app.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-black text-white">{position.title}</p>
                          <p className="text-xs text-slate-400">{position.department}</p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusTone(
                            app.status,
                          )}`}
                        >
                          {statusIcon(app.status)}
                          {app.status}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Applied {new Date(app.created_at).toLocaleDateString()}
                        {position.isPayroll ? ' · Payroll' : ' · Platform'}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* Filters */}
        <section className="mt-8 rounded-[1.75rem] border border-white/10 bg-black/50 p-4 shadow-xl shadow-black/30 backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                { key: 'all', label: 'All Positions' },
                { key: 'payroll', label: 'Payroll Employees' },
                { key: 'platform', label: 'Platform Roles' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCategoryFilter(tab.key)}
                className={`rounded-2xl border px-4 py-2 text-xs font-black uppercase tracking-wide transition ${
                  categoryFilter === tab.key
                    ? 'border-cyan-300/40 bg-cyan-500/15 text-cyan-50'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search positions, departments, or descriptions..."
                className="w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-12 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
              />
            </label>
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20 lg:w-64"
            >
              {departments.map((item) => (
                <option key={item} value={item} className="bg-black">
                  {item}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadJobsData}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white transition hover:border-cyan-300/40 hover:bg-white/[0.08]"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </section>

        {/* Payroll Employee Positions */}
        {displayedPayroll.length > 0 && (
          <section className="mt-10">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-300">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">Payroll Employee Positions</h2>
                <p className="text-sm text-slate-400">Salaried roles with benefits, onboarding, and payroll.</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{displayedPayroll.map(renderCard)}</div>
          </section>
        )}

        {/* Non-Payroll Platform Roles */}
        {displayedPlatform.length > 0 && (
          <section className="mt-12">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-purple-500/15 p-2 text-purple-300">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">Non-Payroll Platform Roles</h2>
                <p className="text-sm text-slate-400">Volunteer & community roles — badges and platform access.</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{displayedPlatform.map(renderCard)}</div>
          </section>
        )}

        {filteredJobs.length === 0 && (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-slate-400">
            No positions match your filters.
          </div>
        )}

        {/* I-9 Section 2 Admin Workflow */}
        {isAdminOrLead && <I9Section2AdminPanel applicantsByPosition={applicantsByPosition} />}
      </main>
    </div>
  )
}

/* ================================================================== */
/*  I-9 Section 2 — HR / Admin workflow                               */
/* ================================================================== */

interface EmployeeOption {
  id: string
  username: string | null
  positionTitle: string
}

function I9Section2AdminPanel({
  applicantsByPosition,
}: {
  applicantsByPosition: Record<string, ApplicantRow[]>
}) {
  const { user } = useAuthStore()

  const employeeOptions = useMemo<EmployeeOption[]>(() => {
    const seen = new Set<string>()
    const options: EmployeeOption[] = []
    Object.entries(applicantsByPosition).forEach(([positionId, apps]) => {
      const position = jobPositions.find((j) => j.id === positionId)
      apps.forEach((app) => {
        if (String(app.status || '').toLowerCase() !== 'approved') return
        if (seen.has(app.user_id)) return
        seen.add(app.user_id)
        options.push({
          id: app.user_id,
          username: app.applicant?.username ?? null,
          positionTitle: position?.title ?? positionId,
        })
      })
    })
    return options
  }, [applicantsByPosition])

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState<I9Section2Data & { employeeId: string }>({
    employeeId: '',
    employeeName: '',
    positionTitle: '',
    documentTitle: '',
    issuingAuthority: '',
    documentNumber: '',
    expirationDate: '',
    firstDayOfEmployment: '',
    employerRepSignature: '',
    employerRepNameTitle: '',
    businessName: 'MaiTroll',
    businessAddress: '',
    dateCompleted: today,
  })
  const [busy, setBusy] = useState(false)

  const setField = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const onSelectEmployee = (id: string) => {
    const emp = employeeOptions.find((e) => e.id === id)
    setForm((prev) => ({
      ...prev,
      employeeId: id,
      employeeName: emp?.username ? `@${emp.username}` : '',
      positionTitle: emp?.positionTitle ?? '',
    }))
  }

  const buildPdf = useCallback(async () => generateI9Section2Pdf(form), [form])

  const handleDownload = async () => {
    setBusy(true)
    try {
      const bytes = await buildPdf()
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `i9-section2-${form.employeeId || 'employee'}-${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('I-9 Section 2 PDF generated')
    } catch (error: any) {
      console.error('[I-9] PDF generation failed:', error)
      toast.error(error?.message || 'Could not generate I-9 PDF')
    } finally {
      setBusy(false)
    }
  }

  const handleStore = async () => {
    if (!form.employeeId) {
      toast.error('Select an employee first')
      return
    }
    if (!form.documentTitle || !form.employerRepSignature) {
      toast.error('Document Title and Employer Rep Signature are required')
      return
    }
    setBusy(true)
    try {
      const bytes = await buildPdf()
      const path = `${form.employeeId}/i9_section2-${Date.now()}.pdf`
      const { error: uploadError } = await supabase.storage
        .from(DOCS_BUCKET)
        .upload(path, new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }), {
          cacheControl: '3600',
          upsert: true,
        })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from(DOCS_BUCKET).getPublicUrl(path)
      const fileUrl = urlData?.publicUrl ?? path

      // Store in the employee's onboarding documents record.
      const now = new Date().toISOString()
      const { error: recordError } = await supabase.from('hr_onboarding_items').upsert(
        {
          employee_id: form.employeeId,
          document_key: 'form_i9_section2',
          document_name: 'Form I-9 — Section 2 (Employer Verification)',
          category: 'employment_eligibility',
          required: true,
          status: 'completed',
          submitted_at: now,
          file_url: fileUrl,
          notes: JSON.stringify({
            ...form,
            _completed_by: user?.id ?? null,
            _completed_at: now,
            _file_url: fileUrl,
          }),
        },
        { onConflict: 'employee_id,document_key' },
      )
      if (recordError) throw recordError

      toast.success('I-9 Section 2 completed and stored in employee documents')
    } catch (error: any) {
      console.error('[I-9] Store failed:', error)
      toast.error(error?.message || 'Could not store I-9 Section 2')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-14 rounded-[1.75rem] border border-amber-400/20 bg-amber-950/10 p-5 shadow-xl shadow-black/30 backdrop-blur-xl sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-amber-500/15 p-2 text-amber-300">
          <BadgeCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">I-9 Section 2 — Employer Verification</h2>
          <p className="text-sm text-slate-400">
            HR completes document examination and generates the employee's completed I-9 Section 2 record.
          </p>
        </div>
      </div>

      {/* Acceptable documents reference */}
      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        <I9DocList title="List A — Identity & Employment Auth." items={I9_LIST_A} tone="cyan" />
        <I9DocList title="List B — Identity" items={I9_LIST_B} tone="purple" />
        <I9DocList title="List C — Employment Auth." items={I9_LIST_C} tone="emerald" />
      </div>
      <p className="mb-6 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-5 text-slate-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        Examine <strong className="mx-1 text-white">one document from List A</strong> OR{' '}
        <strong className="mx-1 text-white">one from List B and one from List C</strong>. Enter the document
        examined below.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <I9Label>Employee</I9Label>
          <select
            value={form.employeeId}
            onChange={(e) => onSelectEmployee(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none focus:border-amber-300/50"
          >
            <option value="" className="bg-black">
              {employeeOptions.length ? 'Select an approved/hired applicant…' : 'No approved applicants yet'}
            </option>
            {employeeOptions.map((emp) => (
              <option key={emp.id} value={emp.id} className="bg-black">
                {emp.username ? `@${emp.username}` : emp.id} — {emp.positionTitle}
              </option>
            ))}
          </select>
        </div>

        <I9Field label="Employee name" value={form.employeeName} onChange={(v) => setField('employeeName', v)} />
        <I9Field label="Position title" value={form.positionTitle} onChange={(v) => setField('positionTitle', v)} />

        <I9Field label="Document Title" value={form.documentTitle} onChange={(v) => setField('documentTitle', v)} />
        <I9Field
          label="Issuing Authority"
          value={form.issuingAuthority}
          onChange={(v) => setField('issuingAuthority', v)}
        />
        <I9Field
          label="Document Number"
          value={form.documentNumber}
          onChange={(v) => setField('documentNumber', v)}
        />
        <I9Field
          label="Expiration Date"
          value={form.expirationDate}
          onChange={(v) => setField('expirationDate', v)}
          placeholder="YYYY-MM-DD"
        />
        <I9Field
          label="First Day of Employment"
          value={form.firstDayOfEmployment}
          onChange={(v) => setField('firstDayOfEmployment', v)}
          placeholder="YYYY-MM-DD"
        />
        <I9Field
          label="Employer Rep Signature"
          value={form.employerRepSignature}
          onChange={(v) => setField('employerRepSignature', v)}
          placeholder="Type full legal name"
        />
        <I9Field
          label="Employer Rep Name / Title"
          value={form.employerRepNameTitle}
          onChange={(v) => setField('employerRepNameTitle', v)}
        />
        <I9Field label="Business Name" value={form.businessName} onChange={(v) => setField('businessName', v)} />
        <I9Field
          label="Business Address"
          value={form.businessAddress}
          onChange={(v) => setField('businessAddress', v)}
          className="sm:col-span-2"
        />
        <I9Field
          label="Date Completed"
          value={form.dateCompleted}
          onChange={(v) => setField('dateCompleted', v)}
          placeholder="YYYY-MM-DD"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={handleDownload}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-bold text-slate-100 transition hover:bg-white/10 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Generate & Download PDF
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleStore}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
          Complete & Store in Employee Documents
        </button>
      </div>
    </section>
  )
}

function I9Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-slate-300">{children}</label>
}

function I9Field({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={className}>
      <I9Label>{label}</I9Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-300/50"
      />
    </div>
  )
}

function I9DocList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'cyan' | 'purple' | 'emerald'
}) {
  const toneClass =
    tone === 'cyan'
      ? 'border-cyan-400/20 text-cyan-200'
      : tone === 'purple'
        ? 'border-purple-400/20 text-purple-200'
        : 'border-emerald-400/20 text-emerald-200'
  return (
    <div className={`rounded-xl border ${toneClass} bg-black/30 p-4`}>
      <p className="text-[11px] font-black uppercase tracking-wide">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4 text-slate-400">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

