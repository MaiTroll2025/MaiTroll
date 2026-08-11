import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  HandHeart,
  Search,
  Shield,
  Users,
  XCircle,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface VolunteerRole {
  id: string
  roleKey: string
  title: string
  category: string
  description: string
  responsibilities: string[]
  powers: string[]
  requirements: string[]
}

const volunteerRoles: VolunteerRole[] = [
  {
    id: 'lead_troll_officer',
    roleKey: 'lead_troll_officer',
    title: 'Lead Troll Officer',
    category: 'Community Safety',
    description: 'Help coordinate Troll Officers and support community safety actions across Mai Troll.',
    responsibilities: [
      'Help guide Troll Officers',
      'Assist with escalated community safety situations',
      'Follow Mai Troll rules and internal procedures',
    ],
    powers: ['Role-based moderation and officer tools assigned by Mai Troll'],
    requirements: ['Good judgment', 'Responsible use of platform powers', 'Ability to remain fair during disputes'],
  },
  {
    id: 'troll_officer',
    roleKey: 'troll_officer',
    title: 'Troll Officer',
    category: 'Community Safety',
    description: 'Help with community safety, reports, and role-specific enforcement tools inside Mai Troll.',
    responsibilities: [
      'Help respond to community issues',
      'Use officer powers only for approved purposes',
      'Document or escalate serious situations when required',
    ],
    powers: ['Officer tools and permissions assigned by Mai Troll'],
    requirements: ['Fair judgment', 'Respect for users', 'Responsible use of platform permissions'],
  },
  {
    id: 'secretary',
    roleKey: 'secretary',
    title: 'Secretary',
    category: 'Operations',
    description: 'Help organize community information, notices, records, and role-related administrative tasks.',
    responsibilities: ['Help organize notices and records', 'Support approved administrative workflows', 'Keep information accurate'],
    powers: ['Secretary tools and permissions assigned by Mai Troll'],
    requirements: ['Organization', 'Attention to detail', 'Good communication'],
  },
  {
    id: 'prosecutor',
    roleKey: 'prosecutor',
    title: 'Prosecutor',
    category: 'Troll Court',
    description: 'Participate in Mai Troll court features as a volunteer prosecutor role.',
    responsibilities: ['Review eligible Troll Court matters', 'Present the prosecution side', 'Follow Troll Court procedures'],
    powers: ['Troll Court prosecutor permissions assigned by Mai Troll'],
    requirements: ['Fairness', 'Clear communication', 'Ability to follow platform court procedures'],
  },
  {
    id: 'attorney',
    roleKey: 'attorney',
    title: 'Attorney',
    category: 'Troll Court',
    description: 'Participate in Mai Troll court features as a volunteer attorney role.',
    responsibilities: ['Help users within Troll Court features', 'Present arguments in eligible cases', 'Follow Troll Court procedures'],
    powers: ['Troll Court attorney permissions assigned by Mai Troll'],
    requirements: ['Clear communication', 'Fairness', 'Ability to understand platform court rules'],
  },
  {
    id: 'judge',
    roleKey: 'judge',
    title: 'Judge',
    category: 'Troll Court',
    description: 'Help oversee eligible Troll Court proceedings and make platform decisions within the assigned court powers.',
    responsibilities: ['Review eligible cases', 'Remain neutral', 'Apply Mai Troll court rules consistently'],
    powers: ['Judge permissions within Troll Court assigned by Mai Troll'],
    requirements: ['Strong judgment', 'Neutrality', 'Ability to make fair platform decisions'],
  },
  {
    id: 'auctioneer',
    roleKey: 'auctioneer',
    title: 'Auctioneer',
    category: 'Marketplace',
    description: 'Help host and manage approved auction activity inside Mai Troll.',
    responsibilities: ['Help run approved auctions', 'Keep auction activity organized', 'Follow marketplace rules'],
    powers: ['Auction tools and permissions assigned by Mai Troll'],
    requirements: ['Clear speaking', 'Organization', 'Understanding of auction rules'],
  },
  {
    id: 'pastor',
    roleKey: 'pastor',
    title: 'Pastor',
    category: 'Community',
    description: 'Support the voluntary community and church-style features available inside Mai Troll.',
    responsibilities: ['Support approved community activities', 'Treat users respectfully', 'Follow platform rules'],
    powers: ['Pastor/community permissions assigned by Mai Troll'],
    requirements: ['Respectful communication', 'Community-minded behavior', 'Reliable conduct'],
  },
  {
    id: 'journalist',
    roleKey: 'journalist',
    title: 'Journalist',
    category: 'News',
    description: 'Help create and report community stories for approved Mai Troll news features.',
    responsibilities: ['Cover approved community stories', 'Verify information before publishing', 'Follow news and platform rules'],
    powers: ['Journalist publishing tools assigned by Mai Troll'],
    requirements: ['Clear writing', 'Accuracy', 'Ability to separate facts from opinion'],
  },
  {
    id: 'tcnn_news_caster',
    roleKey: 'tcnn_news_caster',
    title: 'TCNN News Caster',
    category: 'TCNN',
    description: 'Appear in approved TCNN news broadcasts and present community news inside Mai Troll.',
    responsibilities: ['Present approved stories', 'Follow TCNN format and platform rules', 'Communicate clearly on broadcasts'],
    powers: ['TCNN broadcaster permissions assigned by Mai Troll'],
    requirements: ['Clear speaking', 'Comfort on camera', 'Reliability'],
  },
  {
    id: 'tcnn_chief_news_caster',
    roleKey: 'tcnn_chief_news_caster',
    title: 'TCNN Chief News Caster',
    category: 'TCNN',
    description: 'Help coordinate TCNN news casting and approved news presentation workflows.',
    responsibilities: ['Help organize TCNN coverage', 'Guide approved news casters', 'Support accurate and orderly broadcasts'],
    powers: ['Chief TCNN permissions assigned by Mai Troll'],
    requirements: ['Leadership', 'Clear communication', 'Strong judgment'],
  },
  {
    id: 'agency_hr_manager',
    roleKey: 'agency_hr_manager',
    title: 'Agency HR Manager',
    category: 'Agency',
    description: 'Help an approved Mai Troll agency manage its internal volunteer/member workflows.',
    responsibilities: ['Help manage agency member processes', 'Support approved agency role workflows', 'Follow agency and platform rules'],
    powers: ['Agency HR manager tools, including permissions tied to is_agency_hr_manager where applicable'],
    requirements: ['Organization', 'Fair judgment', 'Ability to handle member information responsibly'],
  },
  {
    id: 'agency_leader',
    roleKey: 'agency_leader',
    title: 'Agency Leader',
    category: 'Agency',
    description: 'Help lead an approved Mai Troll agency and coordinate its platform activities.',
    responsibilities: ['Guide agency activity', 'Help manage agency members', 'Follow Mai Troll agency rules'],
    powers: ['Agency leadership permissions assigned by Mai Troll'],
    requirements: ['Leadership', 'Responsibility', 'Good communication'],
  },
  {
    id: 'hr_manager',
    roleKey: 'hr_manager',
    title: 'HR Manager',
    category: 'Operations',
    description: 'Help review and organize approved Mai Troll role and volunteer workflows.',
    responsibilities: ['Help review role-related requests', 'Support volunteer workflow organization', 'Follow internal platform procedures'],
    powers: ['HR manager permissions assigned by Mai Troll'],
    requirements: ['Organization', 'Fairness', 'Discretion'],
  },
  {
    id: 'hr_admin',
    roleKey: 'hr_admin',
    title: 'HR Admin',
    category: 'Operations',
    description: 'Help administer approved volunteer-role workflows and related records inside Mai Troll.',
    responsibilities: ['Support role administration', 'Keep volunteer records organized', 'Use HR permissions responsibly'],
    powers: ['HR admin permissions assigned by Mai Troll'],
    requirements: ['Attention to detail', 'Discretion', 'Responsible platform use'],
  },
  {
    id: 'ceo_assistant',
    roleKey: 'ceo_assistant',
    title: 'CEO Assistant',
    category: 'Executive Support',
    description: 'Provide volunteer assistance with approved Mai Troll executive and platform support tasks.',
    responsibilities: ['Help with approved support tasks', 'Keep assigned information organized', 'Follow platform instructions'],
    powers: ['CEO Assistant permissions assigned by Mai Troll'],
    requirements: ['Reliability', 'Organization', 'Discretion'],
  },
  {
    id: 'noah_assistant',
    roleKey: 'noah_assistant',
    title: 'Noah Assistant',
    category: 'Executive Support',
    description: 'Provide volunteer assistance with approved Noah-related Mai Troll support tasks.',
    responsibilities: ['Help with approved assigned tasks', 'Keep information organized', 'Use permissions only as intended'],
    powers: ['Noah Assistant permissions assigned by Mai Troll'],
    requirements: ['Reliability', 'Organization', 'Discretion'],
  },
  {
    id: 'academy_teacher',
    roleKey: 'academy_teacher',
    title: 'Academy Teacher',
    category: 'Academy',
    description: 'Help teach or guide users through approved Mai Troll Academy content and activities.',
    responsibilities: ['Help users learn approved material', 'Support Academy activities', 'Follow Academy guidelines'],
    powers: ['Academy teacher permissions assigned by Mai Troll'],
    requirements: ['Patience', 'Clear communication', 'Ability to explain information'],
  },
  {
    id: 'academy_director',
    roleKey: 'academy_director',
    title: 'Academy Director',
    category: 'Academy',
    description: 'Help coordinate approved Mai Troll Academy activities, teachers, and learning workflows.',
    responsibilities: ['Help organize Academy activity', 'Support Academy teachers', 'Maintain approved learning standards'],
    powers: ['Academy director permissions assigned by Mai Troll'],
    requirements: ['Leadership', 'Organization', 'Clear communication'],
  },
  {
    id: 'troller',
    roleKey: 'troller',
    title: 'Troller',
    category: 'Community',
    description: 'Participate in approved Mai Troll community activities under the Troller volunteer role.',
    responsibilities: ['Participate responsibly', 'Follow platform rules', 'Use any assigned role powers appropriately'],
    powers: ['Troller permissions assigned by Mai Troll'],
    requirements: ['Good standing', 'Responsible behavior', 'Understanding of community rules'],
  },
  {
    id: 'troll_family',
    roleKey: 'troll_family',
    title: 'Troll Family',
    category: 'Community',
    description: 'Participate in approved Troll Family community features and responsibilities inside Mai Troll.',
    responsibilities: ['Support approved family activities', 'Follow community rules', 'Use family-related permissions responsibly'],
    powers: ['Troll Family permissions assigned by Mai Troll'],
    requirements: ['Good standing', 'Community participation', 'Responsible conduct'],
  },
]

export default function CareersPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [selectedRole, setSelectedRole] = useState<VolunteerRole | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(volunteerRoles.map((role) => role.category)))],
    [],
  )

  const filteredRoles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return volunteerRoles.filter((role) => {
      const matchesFilter = filter === 'all' || role.category === filter
      const matchesSearch =
        !query ||
        role.title.toLowerCase().includes(query) ||
        role.roleKey.toLowerCase().includes(query) ||
        role.category.toLowerCase().includes(query) ||
        role.description.toLowerCase().includes(query)

      return matchesFilter && matchesSearch
    })
  }, [filter, searchQuery])

  const handleApplyClick = (role: VolunteerRole) => {
    if (!user) {
      toast.error('Please sign in to apply for a Mai Troll volunteer role.')
      navigate('/auth')
      return
    }

    setSelectedRole(role)
    setAcknowledged(false)
  }

  const handleSubmitApplication = async () => {
    if (!user || !selectedRole) return

    if (!acknowledged) {
      toast.error('You must confirm that you understand this is an unpaid volunteer role.')
      return
    }

    setIsSubmitting(true)

    try {
      // Keep the existing career_applications backend contract unless/until the
      // database schema is deliberately migrated. The role key is used as the
      // position_id so existing application review flows continue to receive a
      // stable identifier without inventing a new table or column here.
      const { error } = await supabase.from('career_applications').insert({
        user_id: user.id,
        position_id: selectedRole.roleKey,
        status: 'applied',
        applied_at: new Date().toISOString(),
      })

      if (error) throw error

      setAppliedIds((previous) => new Set(previous).add(selectedRole.roleKey))
      toast.success(`Application submitted for ${selectedRole.title}.`)
      setSelectedRole(null)
      setAcknowledged(false)
    } catch (error) {
      console.error('Volunteer role application error:', error)
      toast.error('Failed to submit your role application. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#180927] via-[#0A1222] to-[#111827]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.14),_transparent_38%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2">
              <HandHeart className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold uppercase tracking-[0.16em] text-amber-300">Volunteer Community Roles</span>
            </div>

            <h1 className="mb-5 text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
              <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                Mai Troll Roles
              </span>
            </h1>

            <p className="mx-auto max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">
              Choose a volunteer role that interests you and apply to help with approved areas of the Mai Troll community.
              These roles are optional, unpaid, and do not have set working hours.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-10 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 shadow-2xl shadow-amber-950/10 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-black">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-black text-white">Important Volunteer Notice</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-300 sm:text-base">
                Every role listed on this page is a volunteer-only Mai Troll community role. Applying for or receiving a role does not create paid employment.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Volunteer Only</div>
                  <div className="mt-1 text-sm text-zinc-300">Participation is optional.</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Unpaid</div>
                  <div className="mt-1 text-sm text-zinc-300">No wages, salary, or hourly pay.</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">No Set Hours</div>
                  <div className="mt-1 text-sm text-zinc-300">Volunteer when you are available.</div>
                </div>
              </div>

              <div className="mt-5 grid gap-x-8 gap-y-3 text-sm text-zinc-300 md:grid-cols-2">
                <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />You are not an employee because you hold one of these roles.</div>
                <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />Applying does not guarantee approval.</div>
                <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />Some roles include special platform permissions or powers.</div>
                <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />Powers can be limited, suspended, or removed.</div>
                <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />Users may stop volunteering.</div>
                <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />Mai Troll may remove a volunteer from a role.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#2C2C2C] bg-[#121212] p-5">
            <Users className="mb-3 h-6 w-6 text-amber-400" />
            <div className="text-3xl font-black">{volunteerRoles.length}</div>
            <div className="mt-1 text-sm text-zinc-500">Available Roles</div>
          </div>
          <div className="rounded-2xl border border-[#2C2C2C] bg-[#121212] p-5">
            <Clock3 className="mb-3 h-6 w-6 text-sky-400" />
            <div className="text-3xl font-black">Flexible</div>
            <div className="mt-1 text-sm text-zinc-500">No Set Hours</div>
          </div>
          <div className="rounded-2xl border border-[#2C2C2C] bg-[#121212] p-5">
            <HandHeart className="mb-3 h-6 w-6 text-emerald-400" />
            <div className="text-3xl font-black">Volunteer</div>
            <div className="mt-1 text-sm text-zinc-500">Unpaid Community Roles</div>
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search Mai Troll roles..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-[#2C2C2C] bg-[#121212] py-3 pl-12 pr-4 text-white placeholder-zinc-500 outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setFilter(category)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  filter === category
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                    : 'border-[#2C2C2C] bg-[#121212] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                }`}
              >
                {category === 'all' ? 'All Roles' : category}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {filteredRoles.length === 0 ? (
            <div className="rounded-2xl border border-[#2C2C2C] bg-[#121212] py-14 text-center">
              <Search className="mx-auto mb-4 h-10 w-10 text-zinc-700" />
              <p className="text-zinc-500">No Mai Troll roles match your search.</p>
            </div>
          ) : (
            filteredRoles.map((role) => {
              const applied = appliedIds.has(role.roleKey)

              return (
                <div
                  key={role.roleKey}
                  className="rounded-3xl border border-[#2C2C2C] bg-[#121212] p-6 transition hover:border-amber-500/30 sm:p-7"
                >
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
                    <div className="flex-1">
                      <div className="mb-4 flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-black text-white">{role.title}</h3>
                        <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-300">
                          {role.category}
                        </span>
                        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-300">
                          Volunteer
                        </span>
                        <span className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-red-300">
                          Unpaid
                        </span>
                      </div>

                      <p className="max-w-4xl text-sm leading-6 text-zinc-400 sm:text-base">{role.description}</p>

                      <div className="mt-6 grid gap-5 lg:grid-cols-3">
                        <div>
                          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                            <BadgeCheck className="h-4 w-4 text-amber-400" />
                            What You Help With
                          </div>
                          <ul className="space-y-2 text-sm text-zinc-400">
                            {role.responsibilities.map((item) => (
                              <li key={item} className="flex gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                            <Shield className="h-4 w-4 text-sky-400" />
                            Role Powers
                          </div>
                          <ul className="space-y-2 text-sm text-zinc-400">
                            {role.powers.map((item) => (
                              <li key={item} className="flex gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                                {item}
                              </li>
                            ))}
                            <li className="flex gap-2 text-amber-300/90">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                              Powers are not permanent and may be removed.
                            </li>
                          </ul>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                            <Users className="h-4 w-4 text-violet-400" />
                            What We Look For
                          </div>
                          <ul className="space-y-2 text-sm text-zinc-400">
                            {role.requirements.map((item) => (
                              <li key={item} className="flex gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-5 text-zinc-400">
                        Backend role key: <span className="font-mono text-zinc-300">{role.roleKey}</span>. This is an unpaid volunteer role with no set hours. Approval does not guarantee permanent access to role powers.
                      </div>
                    </div>

                    <div className="xl:w-52">
                      {applied ? (
                        <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />
                          Applied
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApplyClick(role)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-black text-black transition hover:scale-[1.02] hover:from-amber-300 hover:to-orange-400"
                        >
                          Apply for Role
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      )}

                      <div className="mt-3 text-center text-xs leading-5 text-zinc-500">
                        Volunteer only<br />No pay • No set hours
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {selectedRole && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-[#343434] bg-[#111111] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Volunteer Role Application</div>
                <h2 className="mt-2 text-2xl font-black text-white">{selectedRole.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="rounded-xl border border-white/10 p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Close application"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                  <div>
                    <h3 className="font-black text-white">You must understand this before applying</h3>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                      <li>• This is a volunteer role only.</li>
                      <li>• You will not receive wages, salary, hourly pay, or guaranteed compensation.</li>
                      <li>• There are no set hours. You choose when you are available.</li>
                      <li>• Applying does not guarantee approval.</li>
                      <li>• Role powers and permissions can be limited, suspended, or removed.</li>
                      <li>• Mai Troll may remove you from the role.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-amber-400"
                />
                <span className="text-sm leading-6 text-zinc-300">
                  I understand that <strong>{selectedRole.title}</strong> is an unpaid volunteer role with no set hours and that any powers or permissions can be taken away.
                </span>
              </label>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!acknowledged || isSubmitting}
                  onClick={handleSubmitApplication}
                  className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-black text-black transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Volunteer Application'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
