import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
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
  Mail,
  ClipboardCheck,
} from 'lucide-react'

interface JobPosition {
  id: string
  title: string
  department: string
  description: string
  requirements: string[]
  benefits: string[]
  icon: React.ElementType
  color: string
  isEmployeePosition: boolean
}

interface CareerPositionSettings {
  id: string
  title: string
  department: string
  description: string | null
  max_applications: number
  is_open: boolean
}

interface JobApplication {
  id: string
  position_id: string | null
  status: string
  created_at: string
}

const EMPLOYEE_ROLES = new Set([
  'troll_officer',
  'lead_troll_officer',
  'secretary',
  'ceo_assistant',
  'noah_assistant',
])

const jobPositions: JobPosition[] = [
  {
    id: 'auctioneer',
    title: 'Auctioneer',
    department: 'Live Auctions',
    description: 'Host live auction shows where users bid with Troll Coins and build a trusted auctioneer reputation.',
    requirements: ['Must be 18 years or older', 'Good community standing', 'Reliable streaming setup'],
    benefits: ['Auctioneer Studio access', 'Earn from successful auctions', 'Moderate auction rooms'],
    icon: Star,
    color: 'from-green-500 to-emerald-500',
    isEmployeePosition: false,
  },
  {
    id: 'prosecutor',
    title: 'Prosecutor',
    department: 'Troll Court',
    description: 'Represents Mai Troll in court cases, reviews evidence, presents charges, and supports city justice.',
    requirements: ['Understanding of court process', 'Strong presentation skills', 'Commitment to fair judgment'],
    benefits: ['Prosecutor badge', 'Access to case management', 'City-wide recognition'],
    icon: Gavel,
    color: 'from-red-500 to-orange-500',
    isEmployeePosition: false,
  },
  {
    id: 'attorney',
    title: 'Attorney',
    department: 'Troll Court',
    description: 'Defense attorney representing defendants in Troll Court cases, appeals, hearings, and disputes.',
    requirements: ['Strong reasoning skills', 'Excellent communication', 'Professional courtroom conduct'],
    benefits: ['Attorney badge', 'Access to court case system', 'Build reputation as advocate'],
    icon: FileText,
    color: 'from-amber-500 to-yellow-500',
    isEmployeePosition: false,
  },
  {
    id: 'tcnn_news_caster',
    title: 'TCNN News Caster',
    department: 'TCNN',
    description: 'On-air TCNN personality delivering breaking news, live reports, and official city broadcasts.',
    requirements: ['Broadcasting or journalism experience', 'Professional on-camera presence', 'Must be at least 18 years old'],
    benefits: ['News Caster badge', 'Ability to go live on TCNN', 'Platform-wide visibility'],
    icon: Mic,
    color: 'from-red-500 to-orange-500',
    isEmployeePosition: false,
  },
  {
    id: 'secretary',
    title: 'Secretary',
    department: 'City Operations',
    description: 'Official city support role for admin operations, reports, meetings, and city coordination.',
    requirements: ['Strong communication', 'Reliable follow-up', 'Can organize reports and city requests'],
    benefits: ['Secretary tools access', 'City operations role', 'Potential weekly role perk from Treasury'],
    icon: Briefcase,
    color: 'from-cyan-500 to-blue-500',
    isEmployeePosition: true,
  },
  {
    id: 'tcnn_chief_news_caster',
    title: 'TCNN Chief News Caster',
    department: 'TCNN Leadership',
    description: 'Lead the TCNN team, manage journalists and news casters, and maintain editorial standards.',
    requirements: ['News/journalism leadership experience', 'Strong editorial judgment', 'Team management skills'],
    benefits: ['Chief News Caster badge', 'Manage TCNN staff', 'Access to TCNN analytics dashboard'],
    icon: Radio,
    color: 'from-amber-500 to-yellow-500',
    isEmployeePosition: false,
  },
  {
    id: 'troll_officer',
    title: 'Troll Officer',
    department: 'Utromail',
    description: 'Official city enforcer responsible for reports, moderation, investigations, arrests, and safety response.',
    requirements: ['Previous moderation experience', 'Strong understanding of city rules', 'Good judgment under pressure'],
    benefits: ['Officer badge', 'Access to officer tools', 'Potential weekly role perk from Treasury'],
    icon: Shield,
    color: 'from-purple-500 to-pink-500',
    isEmployeePosition: true,
  },
  {
    id: 'journalist',
    title: 'Journalist',
    department: 'TCNN',
    description: 'Write articles, conduct investigations, and keep the city informed through Mai Troll News Network.',
    requirements: ['Strong writing skills', 'Ability to research and verify facts', 'Commitment to unbiased reporting'],
    benefits: ['Journalist badge', 'Access to TCNN content dashboard', 'Potential to advance to News Caster'],
    icon: Newspaper,
    color: 'from-blue-500 to-cyan-500',
    isEmployeePosition: false,
  },
  {
    id: 'lead_troll_officer',
    title: 'Lead Troll Officer',
    department: 'Utromail Leadership',
    description: 'Senior enforcement role overseeing Troll Officers, cases, escalation, and city safety consistency.',
    requirements: ['Previous Troll Officer experience', 'Leadership skills', 'Ability to train officers'],
    benefits: ['Leadership role', 'Officer oversight tools', 'Potential weekly role perk from Treasury'],
    icon: Crown,
    color: 'from-yellow-500 to-orange-500',
    isEmployeePosition: true,
  },
  {
    id: 'troller',
    title: 'Troller',
    department: 'Broadcasting',
    description: 'Entertainer role focused on playful chaos, satire, comedy, and broadcast engagement within city rules.',
    requirements: ['Must be 18 years or older', 'Ability to create engaging content', 'Stable internet and streaming setup'],
    benefits: ['Earn coins from engagement', 'Broadcast growth opportunities', 'Platform-wide promotion potential'],
    icon: Video,
    color: 'from-cyan-500 to-blue-500',
    isEmployeePosition: false,
  },
  {
    id: 'agency_hr_manager',
    title: 'Agency HR Manager',
    department: 'Agency HR',
    description: 'Manage, approve, review, and settle issues for Mai Troll agencies.',
    requirements: ['Attention to detail', 'Reliable communication', 'Ability to review agency applications'],
    benefits: ['Agency HR dashboard access', 'Oversees all agencies', 'Reports to admin dashboard'],
    icon: Building2,
    color: 'from-slate-400 to-cyan-500',
    isEmployeePosition: false,
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
    isEmployeePosition: false,
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
    isEmployeePosition: false,
  },
  {
    id: 'ceo_assistant',
    title: 'CEO Assistant',
    department: 'Executive Office',
    description: 'Assist the CEO with reports, coordination, admin follow-up, and platform operations.',
    requirements: ['Reliable communication', 'Confidentiality', 'Strong organization'],
    benefits: ['Executive assistant role', 'Potential weekly role perk from Treasury', 'Direct CEO support assignment'],
    icon: Crown,
    color: 'from-yellow-400 to-cyan-500',
    isEmployeePosition: true,
  },
  {
    id: 'noah_assistant',
    title: 'Noah Assistant',
    department: 'Executive Office',
    description: 'Assist Noah Admin with reports, support tasks, and city operation follow-up.',
    requirements: ['Reliable communication', 'Admin support mindset', 'Strong follow-up'],
    benefits: ['Admin assistant role', 'Potential weekly role perk from Treasury', 'Assigned to Noah Admin support'],
    icon: Briefcase,
    color: 'from-purple-500 to-cyan-500',
    isEmployeePosition: true,
  },
  {
    id: 'pastor',
    title: 'Pastor',
    department: 'Troll Church',
    description: 'Lead spiritual services, provide guidance and pastoral care to the community, and officiate church events.',
    requirements: ['Strong communication skills', 'Commitment to community support', 'Good community standing'],
    benefits: ['Pastor badge', 'Access to Pastor Dashboard', 'Church broadcast capabilities', 'Pastoral chat channels'],
    icon: Church,
    color: 'from-green-500 to-emerald-500',
    isEmployeePosition: false,
  },
]

const DEFAULT_MAX_APPLICATIONS = 10

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
  agency_leader: { field: 'is_agency_leader', message: 'You are already an Agency Leader' },
  ceo_assistant: { field: 'is_ceo_assistant', message: 'You are already a CEO Assistant' },
  noah_assistant: { field: 'is_noah_assistant', message: 'You are already a Noah Assistant' },
}

export default function JobsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, user } = useAuthStore()

  useSEO({
    title: 'Jobs | Mai Troll - Join Our Team & Make Money Online',
    description: 'Browse open positions at Mai Troll. Apply for roles in moderation, court, broadcasting, agency management, and executive support.',
    keywords: ['jobs', 'careers', 'hiring', 'MaiTroll jobs', 'online jobs', 'remote work'],
  })

  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('All')
  const [settingsById, setSettingsById] = useState<Record<string, CareerPositionSettings>>({})
  const [countsById, setCountsById] = useState<Record<string, number>>({})
  const [adminDrafts, setAdminDrafts] = useState<Record<string, { max_applications: number; is_open: boolean }>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [userApplications, setUserApplications] = useState<JobApplication[]>([])

  const isAdminOrLead =
    profile?.role === 'admin' ||
    profile?.troll_role === 'admin' ||
    profile?.role === UserRole.ADMIN ||
    profile?.role === UserRole.HR_ADMIN ||
    profile?.role === UserRole.AGENCY_HR_MANAGER ||
    profile?.is_admin ||
    profile?.role === 'superadmin' ||
    profile?.troll_role === 'ceo' ||
    profile?.is_superadmin ||
    profile?.role === 'lead_troll_officer' ||
    profile?.troll_role === 'lead_troll_officer' ||
    profile?.is_lead_officer

  const departments = useMemo(() => {
    return ['All', ...Array.from(new Set(jobPositions.map((job) => job.department)))]
  }, [])

  const loadJobsData = async () => {
    setIsLoading(true)

    try {
      const { data: careerSettings, error: settingsError } = await supabase
        .from('career_positions')
        .select('id, title, department, description, max_applications, is_open')

      if (settingsError) throw settingsError

      const { data: applicationRows, error: applicationsError } = await supabase
        .from('job_applications')
        .select('position_id, status')
        .not('position_id', 'is', null)

      if (applicationsError) throw applicationsError

      const nextSettingsById: Record<string, CareerPositionSettings> = {}
      const nextDrafts: Record<string, { max_applications: number; is_open: boolean }> = {}

      ;(careerSettings || []).forEach((item) => {
        nextSettingsById[item.id] = item
        nextDrafts[item.id] = {
          max_applications: Number(item.max_applications ?? DEFAULT_MAX_APPLICATIONS),
          is_open: Boolean(item.is_open),
        }
      })

      const nextCountsById: Record<string, number> = {}

      ;(applicationRows || []).forEach((row: any) => {
        if (!row.position_id) return
        if (['rejected', 'withdrawn', 'cancelled'].includes(String(row.status || '').toLowerCase())) return
        nextCountsById[row.position_id] = (nextCountsById[row.position_id] || 0) + 1
      })

      setSettingsById(nextSettingsById)
      setAdminDrafts(nextDrafts)
      setCountsById(nextCountsById)

      if (user) {
        const { data: myApps, error: myAppsError } = await supabase
          .from('job_applications')
          .select('id, position_id, status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (!myAppsError && myApps) {
          setUserApplications(myApps)
        }
      }
    } catch (error: any) {
      console.error('[Jobs] Failed to load jobs data:', error)
      toast.error(error?.message || 'Could not load job listings')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadJobsData()
  }, [])

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return jobPositions.filter((job) => {
      const matchesDepartment = department === 'All' || job.department === department
      const matchesSearch =
        !normalized ||
        job.title.toLowerCase().includes(normalized) ||
        job.department.toLowerCase().includes(normalized) ||
        job.description.toLowerCase().includes(normalized)

      return matchesDepartment && matchesSearch
    })
  }, [query, department])

  const getJobState = (position: JobPosition) => {
    const settings = settingsById[position.id]
    const maxApplications = Number(settings?.max_applications ?? DEFAULT_MAX_APPLICATIONS)
    const usedApplications = Number(countsById[position.id] ?? 0)
    const remainingApplications = Math.max(maxApplications - usedApplications, 0)
    const isOpen = settings?.is_open ?? true
    const isFilled = maxApplications <= 0 || remainingApplications <= 0
    const canApply = isOpen && !isFilled

    return {
      settings,
      maxApplications,
      usedApplications,
      remainingApplications,
      isOpen,
      isFilled,
      canApply,
    }
  }

  const getUserApplicationStatus = (positionId: string): JobApplication | undefined => {
    return userApplications.find((app) => app.position_id === positionId)
  }

  const handleApply = async (position: JobPosition) => {
    if (!user) {
      navigate(`/jobs/apply?position=${position.id}`)
      return
    }

    const state = getJobState(position)

    if (!state.isOpen) {
      toast.error('This position is currently closed')
      return
    }

    if (state.isFilled) {
      toast.error('This position is filled right now')
      return
    }

    const roleCheck = positionToRoleCheck[position.id]
    if (roleCheck) {
      const roleValue = (profile as any)?.[roleCheck.field]
      if (roleValue) {
        toast.error(roleCheck.message)
        return
      }
    } else if (profile?.role === position.id || profile?.troll_role === position.id) {
      toast.error(`You are already a ${position.title}`)
      return
    }

    const existing = getUserApplicationStatus(position.id)
    if (existing) {
      toast.info('You already applied for this position')
      navigate('/jobs/status')
      return
    }

    navigate(`/jobs/apply?position=${position.id}`)
  }

  const saveJobSettings = async (position: JobPosition) => {
    if (!user || !isAdminOrLead) return

    const draft = adminDrafts[position.id] || {
      max_applications: DEFAULT_MAX_APPLICATIONS,
      is_open: true,
    }

    const maxApplications = Math.max(0, Number(draft.max_applications || 0))

    setSavingId(position.id)

    try {
      const { error } = await supabase
        .from('career_positions')
        .upsert(
          {
            id: position.id,
            title: position.title,
            department: position.department,
            description: position.description,
            max_applications: maxApplications,
            is_open: draft.is_open,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )

      if (error) throw error

      toast.success(`${position.title} settings saved`)
      await loadJobsData()
    } catch (error: any) {
      console.error('[Jobs] Save failed:', error)
      toast.error(error?.message || 'Could not save job settings')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_38%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_35%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(236,72,153,0.16),transparent_42%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-white/[0.04] p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-bl-[5rem] bg-cyan-500/10 blur-2xl" />
          <div className="absolute bottom-0 left-0 h-44 w-44 rounded-tr-[5rem] bg-purple-400/10 blur-2xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-100">
                <Sparkles className="h-4 w-4" />
                Mai Troll Jobs
              </div>

              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Open Positions &{' '}
                <span className="bg-gradient-to-r from-cyan-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
                  Careers
                </span>
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                Browse open positions at Mai Troll. Employee positions include payroll, onboarding, and employee tools.
                Platform roles unlock department access after approval.
              </p>

              {isAdminOrLead && (
                <p className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100">
                  Admin mode active: set application slots to 0 to disable a position.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                <Briefcase className="mb-3 h-5 w-5 text-cyan-300" />
                <p className="text-2xl font-black">{jobPositions.length}</p>
                <p className="text-xs font-medium text-slate-300">Open positions</p>
              </div>

              <div className="rounded-2xl border border-purple-400/20 bg-purple-500/10 p-4">
                <Crown className="mb-3 h-5 w-5 text-purple-300" />
                <p className="text-2xl font-black">
                  {jobPositions.reduce((total, job) => total + getJobState(job).remainingApplications, 0)}
                </p>
                <p className="text-xs font-medium text-slate-300">Open slots</p>
              </div>
            </div>
          </div>
        </section>

        {user && (
          <section className="mt-8 rounded-[1.75rem] border border-white/10 bg-black/50 p-4 shadow-xl shadow-black/30 backdrop-blur-xl">
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
                View Status
              </button>
            </div>
            {userApplications.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {userApplications.slice(0, 6).map((app) => {
                  const position = jobPositions.find((j) => j.id === app.position_id)
                  if (!position) return null
                  return (
                    <div key={app.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="font-black text-white">{position.title}</p>
                      <p className="text-xs text-slate-400">{position.department}</p>
                      <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                        app.status === 'pending' ? 'bg-amber-500/10 text-amber-200' :
                        app.status === 'reviewing' ? 'bg-cyan-500/10 text-cyan-200' :
                        app.status === 'interview' ? 'bg-violet-500/10 text-violet-200' :
                        app.status === 'approved' ? 'bg-emerald-500/10 text-emerald-200' :
                        app.status === 'rejected' ? 'bg-rose-500/10 text-rose-200' :
                        'bg-slate-500/10 text-slate-200'
                      }`}>
                        {app.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        <section className="mt-8 rounded-[1.75rem] border border-white/10 bg-black/50 p-4 shadow-xl shadow-black/30 backdrop-blur-xl">
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

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((position) => {
            const Icon = position.icon
            const state = getJobState(position)
            const draft = adminDrafts[position.id] || {
              max_applications: state.maxApplications,
              is_open: state.isOpen,
            }
            const userApp = user ? getUserApplicationStatus(position.id) : null

            return (
              <article
                key={position.id}
                className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] shadow-xl shadow-black/30 backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.06]"
              >
                <div className={`bg-gradient-to-r ${position.color} p-5`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white/20 p-3">
                        <Icon className="h-6 w-6 text-white" />
                      </div>

                      <div>
                        <h2 className="text-xl font-black text-white">{position.title}</h2>
                        <p className="text-sm font-semibold text-white/75">{position.department}</p>
                      </div>
                    </div>

                    <div className="rounded-full bg-black/25 px-3 py-1 text-xs font-black text-white">
                      {position.isEmployeePosition ? 'Employee Position' : 'Platform Role'}
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  {position.isEmployeePosition && (
                    <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs font-semibold text-amber-100">
                      This position requires a desktop computer or laptop with a webcam, microphone, speakers, and reliable internet connection.
                    </div>
                  )}

                  <p className="min-h-24 text-sm leading-6 text-slate-300">
                    {position.description}
                  </p>

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
                    <h3 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                      Requirements
                    </h3>
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
                    <h3 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-purple-200">
                      Benefits
                    </h3>
                    <ul className="space-y-2">
                      {position.benefits.map((benefit) => (
                        <li key={benefit} className="flex gap-2 text-sm text-slate-300">
                          <Star className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {isAdminOrLead && (
                    <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-950/20 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                          Admin Slots
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setAdminDrafts((prev) => ({
                              ...prev,
                              [position.id]: {
                                ...draft,
                                is_open: !draft.is_open,
                              },
                            }))
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-white"
                        >
                          {draft.is_open ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          {draft.is_open ? 'Open' : 'Closed'}
                        </button>
                      </div>

                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <input
                          type="number"
                          min={0}
                          value={draft.max_applications}
                          onChange={(event) =>
                            setAdminDrafts((prev) => ({
                              ...prev,
                              [position.id]: {
                                ...draft,
                                max_applications: Number(event.target.value),
                              },
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
                          <Save className="h-4 w-4" />
                          {savingId === position.id ? 'Saving' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}

                  {userApp && (
                    <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-center">
                      <p className="text-sm font-bold text-cyan-100">Application Status: {userApp.status}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!state.canApply && !userApp}
                    onClick={() => handleApply(position)}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg shadow-black/30 transition ${
                      state.canApply
                        ? `bg-gradient-to-r ${position.color} hover:scale-[1.02]`
                        : userApp
                          ? 'bg-cyan-600 hover:bg-cyan-500'
                          : 'cursor-not-allowed bg-slate-700 text-slate-400'
                    }`}
                  >
                    {userApp ? 'View Application' : state.canApply ? 'Apply Now' : state.isOpen ? 'Filled' : 'Closed'}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      </main>
    </div>
  )
}
