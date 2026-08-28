import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { encryptPII } from '../lib/piiEncryption'
import {
  Shield,
  XCircle,
  User as UserIcon,
  MapPin,
  Briefcase,
  CalendarDays,
  GraduationCap,
  Building2,
  CheckCircle2,
  Users,
  HelpCircle,
  FileSignature,
} from 'lucide-react'
import { notifyCareerApplicationSubmitted } from '../lib/notifications'
import AuthModal from '../components/auth/AuthModal'

interface JobPositionMeta {
  id: string
  title: string
  department: string
  icon: React.ElementType
  isEmployeePosition: boolean
}

const JOB_POSITIONS: Record<string, JobPositionMeta> = {
  auctioneer: { id: 'auctioneer', title: 'Auctioneer', department: 'Live Auctions', icon: Briefcase, isEmployeePosition: false },
  prosecutor: { id: 'prosecutor', title: 'Prosecutor', department: 'Troll Court', icon: Shield, isEmployeePosition: false },
  attorney: { id: 'attorney', title: 'Attorney', department: 'Troll Court', icon: Shield, isEmployeePosition: false },
  news_caster: { id: 'news_caster', title: 'News Caster', department: 'TCNN', icon: Briefcase, isEmployeePosition: false },
  tcnn_news_caster: { id: 'tcnn_news_caster', title: 'TCNN News Caster', department: 'TCNN', icon: Briefcase, isEmployeePosition: false },
  secretary: { id: 'secretary', title: 'Secretary', department: 'City Operations', icon: Briefcase, isEmployeePosition: true },
  pastor: { id: 'pastor', title: 'Pastor', department: 'Troll Church', icon: Shield, isEmployeePosition: false },
  chief_news_caster: { id: 'chief_news_caster', title: 'Chief News Caster', department: 'TCNN Leadership', icon: Briefcase, isEmployeePosition: false },
  tcnn_chief_news_caster: { id: 'tcnn_chief_news_caster', title: 'TCNN Chief News Caster', department: 'TCNN Leadership', icon: Briefcase, isEmployeePosition: false },
  troll_officer: { id: 'troll_officer', title: 'Troll Officer', department: 'Utromail', icon: Shield, isEmployeePosition: true },
  lead_officer: { id: 'lead_officer', title: 'Lead Troll Officer', department: 'Utromail Leadership', icon: Shield, isEmployeePosition: true },
  lead_troll_officer: { id: 'lead_troll_officer', title: 'Lead Troll Officer', department: 'Utromail Leadership', icon: Shield, isEmployeePosition: true },
  journalist: { id: 'journalist', title: 'Journalist', department: 'TCNN', icon: Briefcase, isEmployeePosition: false },
  agency_hr_manager: { id: 'agency_hr_manager', title: 'Agency HR Manager', department: 'Agency HR', icon: Building2, isEmployeePosition: false },
  agency_leader: { id: 'agency_leader', title: 'Agency Leader', department: 'Agencies', icon: Users, isEmployeePosition: false },
  ceo_assistant: { id: 'ceo_assistant', title: 'CEO Assistant', department: 'Executive Office', icon: Briefcase, isEmployeePosition: true },
  noah_assistant: { id: 'noah_assistant', title: 'Noah Assistant', department: 'Executive Office', icon: Briefcase, isEmployeePosition: true },
  troller: { id: 'troller', title: 'Troller', department: 'Broadcasting', icon: UserIcon, isEmployeePosition: false },
}

const CUSTOM_QUESTIONS: Record<string, { id: string; label: string }[]> = {
  troll_officer: [
    { id: 'moderation_experience_years', label: 'Years of moderation experience?' },
    { id: 'shifts_available', label: 'Which shifts can you reliably cover?' },
    { id: 'handling_disputes', label: 'Describe how you would handle a heated dispute between users.' },
  ],
  lead_troll_officer: [
    { id: 'officer_experience_years', label: 'Years as a Troll Officer?' },
    { id: 'team_size_managed', label: 'Largest team you have managed?' },
  ],
  secretary: [
    { id: 'typing_wpm', label: 'Typing speed (WPM)?' },
    { id: 'tools_proficiency', label: 'Which office tools are you proficient in?' },
  ],
  ceo_assistant: [
    { id: 'calendar_mgmt', label: 'Describe your calendar / executive support experience.' },
    { id: 'confidentiality', label: 'How do you handle confidential information?' },
  ],
  noah_assistant: [
    { id: 'admin_support_experience', label: 'Describe your admin support experience.' },
  ],
  journalist: [
    { id: 'writing_samples', label: 'Link a writing sample or portfolio.' },
    { id: 'beats', label: 'Which beats / topics interest you most?' },
  ],
}

const SKILL_OPTIONS = [
  'Moderation', 'Communication', 'Writing', 'Public Speaking', 'Leadership', 'Investigation',
  'Customer Service', 'Data Entry', 'Broadcasting', 'Video Editing', 'Social Media', 'Legal Research',
  'Conflict Resolution', 'Organization', 'Reporting', 'Event Planning',
]

const ACK_POLICIES: { key: string; label: string }[] = [
  { key: 'handbook', label: 'I have read and agree to the Employee Handbook.' },
  { key: 'code_of_conduct', label: 'I agree to abide by the Code of Conduct.' },
  { key: 'at_will', label: 'I understand employment is at-will where applicable.' },
  { key: 'background_check', label: 'I consent to a background check.' },
  { key: 'e_verify_consent', label: 'I consent to E-Verify employment eligibility verification.' },
  { key: 'policy_acknowledgement', label: 'I acknowledge receipt of company policies.' },
]

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <legend className="flex items-center gap-2 px-2 text-lg font-bold text-white">
        <Icon className="h-5 w-5 text-cyan-300" />
        {title}
      </legend>
      <div className="space-y-4">{children}</div>
    </fieldset>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-300">
      {children} {required && <span className="text-rose-400">*</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20'

export default function Application() {
  const { user, profile, isLoading } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const positionId = searchParams.get('position')

  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [existingApplication, setExistingApplication] = useState<any | null>(null)

  const position = positionId ? JOB_POSITIONS[positionId] : null

  const [form, setForm] = useState({
    legal_first_name: '',
    legal_last_name: '',
    preferred_name: '',
    date_of_birth: '',
    ssn_full: '',
    ssn_last4: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'United States',
    email: '',
    phone: '',
    alternate_phone: '',
    citizenship_status: '',
    work_authorization_detail: '',
    authorized_to_work: false,
    convicted_felony: false,
    felony_explanation: '',
    available_start_date: '',
    employment_type: 'full_time',
    desired_pay_rate: '',
    availability: {
      days: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false },
      earliest_start: '09:00',
      latest_end: '17:00',
      hours_per_week: '',
      shift_pref: 'day',
    },
    skills: [] as string[],
    education: [] as any[],
    employment_history: [] as any[],
    references: [] as any[],
    cover_letter: '',
    resume_url: '',
    equipment_verification: {
      has_desktop: false,
      has_webcam: false,
      has_microphone: false,
      has_speakers: false,
      has_reliable_internet: false,
      internet_speed_mbps: '',
      verified: false,
    },
    custom_answers: {} as Record<string, string>,
    wotc: {
      received_public_assistance: false,
      snap: false,
      tanf: false,
      ssi: false,
      unemployed_18_39: false,
      summer_youth: false,
      supplemental_nutrition: false,
      vocational_rehab: false,
      ex_felony: false,
      ex_conviction: false,
      long_term_family_assistance: false,
      veteran: false,
      disabled_veteran: false,
      guard_reserve: false,
      food_stamp_recipient: false,
      qualified_vet: false,
      unemployed_vet: false,
      authorized_signature: false,
    },
    eeo: {
      gender: '',
      race_ethnicity: [] as string[],
      veteran_status: '',
      disability: '',
      decline_to_self_identify: false,
    },
    acknowledgements: [] as string[],
    background_check_consent: false,
    signature_name: '',
    agreed_to_terms: false,
  })

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))

  useEffect(() => {
    if (!isLoading && user && positionId) {
      supabase
        .from('job_applications')
        .select('*')
        .eq('user_id', user.id)
        .eq('position_id', positionId)
        .maybeSingle()
        .then(
          ({ data }) => {
            setExistingApplication(data || null)
            setChecking(false)
          },
          () => setChecking(false)
        )
    } else if (!isLoading) {
      setChecking(false)
    }
  }, [isLoading, user, positionId])

  useEffect(() => {
    if (profile?.email && !form.email) {
      set({ email: profile.email })
    }
    if (profile?.phone && !form.phone) {
      set({ phone: profile.phone })
    }
  }, [profile])

  const age = useMemo(() => {
    if (!form.date_of_birth) return null
    const dob = new Date(form.date_of_birth)
    if (isNaN(dob.getTime())) return null
    const diff = Date.now() - dob.getTime()
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000))
  }, [form.date_of_birth])

  const toggleSkill = (skill: string) => {
    set({ skills: form.skills.includes(skill) ? form.skills.filter((s) => s !== skill) : [...form.skills, skill] })
  }

  const toggleDay = (day: keyof typeof form.availability.days) => {
    set({ availability: { ...form.availability, days: { ...form.availability.days, [day]: !form.availability.days[day] } } })
  }

  const addEducation = () => set({ education: [...form.education, { school: '', degree: '', field: '', start_year: '', end_year: '', completed: false }] })
  const updateEducation = (i: number, patch: any) => {
    const next = [...form.education]
    next[i] = { ...next[i], ...patch }
    set({ education: next })
  }
  const removeEducation = (i: number) => set({ education: form.education.filter((_, idx) => idx !== i) })

  const addEmployment = () => set({ employment_history: [...form.employment_history, { employer: '', title: '', start_date: '', end_date: '', responsibilities: '', reason_leaving: '', phone: '', supervisor: '', may_contact: false }] })
  const updateEmployment = (i: number, patch: any) => {
    const next = [...form.employment_history]
    next[i] = { ...next[i], ...patch }
    set({ employment_history: next })
  }
  const removeEmployment = (i: number) => set({ employment_history: form.employment_history.filter((_, idx) => idx !== i) })

  const addReference = () => set({ references: [...form.references, { name: '', relationship: '', title: '', company: '', email: '', phone: '', years_known: '' }] })
  const updateReference = (i: number, patch: any) => {
    const next = [...form.references]
    next[i] = { ...next[i], ...patch }
    set({ references: next })
  }
  const removeReference = (i: number) => set({ references: form.references.filter((_, idx) => idx !== i) })

  useEffect(() => {
    if (form.references.length === 0 && user) addReference()
  }, [user])

  const customQuestions = positionId ? CUSTOM_QUESTIONS[positionId] || [] : []

  const validate = (): string | null => {
    if (!form.legal_first_name.trim()) return 'Legal first name is required.'
    if (!form.legal_last_name.trim()) return 'Legal last name is required.'
    if (!form.date_of_birth) return 'Date of birth is required.'
    if (age !== null && age < 18) return 'You must be at least 18 years old to apply.'
    if (!/^\d{4}$/.test(form.ssn_last4)) return 'Enter the last 4 digits of your SSN.'
    if (!form.ssn_full || form.ssn_full.replace(/\D/g, '').length !== 9) return 'Enter your full 9-digit SSN (encrypted before submit).'
    if (!form.address_line1.trim()) return 'Street address is required.'
    if (!form.city.trim()) return 'City is required.'
    if (!form.state.trim()) return 'State is required.'
    if (!form.postal_code.trim()) return 'Postal code is required.'
    if (!form.email.trim()) return 'Email is required.'
    if (!form.phone.trim()) return 'Phone number is required.'
    if (!form.citizenship_status) return 'Select your citizenship status.'
    if (!form.authorized_to_work) return 'You must be authorized to work to apply.'
    if (form.convicted_felony && !form.felony_explanation.trim()) return 'Please explain the felony conviction.'
    if (!form.available_start_date) return 'Available start date is required.'
    if (!form.desired_pay_rate || Number(form.desired_pay_rate) <= 0) return 'Enter a valid desired pay rate.'
    if (form.employment_history.length === 0) return 'Add at least one employment history entry.'
    if (form.references.length < 2) return 'Provide at least two references.'
    for (const r of form.references) {
      if (!r.name.trim() || !r.email.trim()) return 'Every reference needs a name and email.'
    }
    if (position?.isEmployeePosition && !form.equipment_verification.verified) return 'Confirm your equipment attestation for this employee position.'
    for (const p of ACK_POLICIES) {
      if (!form.acknowledgements.includes(p.key)) return `You must acknowledge: ${p.label}`
    }
    if (!form.background_check_consent) return 'Background check consent is required.'
    if (!form.signature_name.trim()) return 'Type your full legal name as a signature.'
    if (!form.agreed_to_terms) return 'You must agree to the terms to submit.'
    return null
  }

  const handleSubmit = useCallback(async () => {
    if (!user || !position) return
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }

    setLoading(true)
    try {
      const ssnEnc = await encryptPII(form.ssn_full.replace(/\D/g, ''), user.id)
      const dobEnc = await encryptPII(form.date_of_birth, user.id)

      const payload = {
        user_id: user.id,
        position_id: position.id,
        department: position.department,
        legal_first_name: form.legal_first_name,
        legal_last_name: form.legal_last_name,
        preferred_name: form.preferred_name,
        date_of_birth: form.date_of_birth,
        ssn_last4: form.ssn_last4,
        pii_encrypted: { ssn: ssnEnc, dob: dobEnc },
        address_line1: form.address_line1,
        address_line2: form.address_line2,
        city: form.city,
        state: form.state,
        postal_code: form.postal_code,
        country: form.country,
        citizenship_status: form.citizenship_status,
        work_authorization_detail: form.work_authorization_detail,
        authorized_to_work: form.authorized_to_work,
        convicted_felony: form.convicted_felony,
        felony_explanation: form.felony_explanation,
        available_start_date: form.available_start_date,
        employment_type: form.employment_type,
        desired_pay_rate: Number(form.desired_pay_rate),
        availability: form.availability,
        skills: form.skills,
        education: form.education,
        employment_history: form.employment_history,
        references: form.references,
        cover_letter: form.cover_letter,
        resume_url: form.resume_url,
        equipment_verification: position.isEmployeePosition ? form.equipment_verification : null,
        custom_answers: form.custom_answers,
        wotc: { ...form.wotc, signature_date: new Date().toISOString() },
        eeo: form.eeo,
        acknowledgements: form.acknowledgements,
        background_check_consent: form.background_check_consent,
        signature_name: form.signature_name,
        signature_date: new Date().toISOString(),
        agreed_to_terms: form.agreed_to_terms,
        status: 'pending',
      }

      const { error } = await supabase.from('job_applications').insert(payload)
      if (error) throw error

      await supabase.from('profiles').update({ application_submitted: true }).eq('id', user.id)

      await notifyCareerApplicationSubmitted(user.id, position.id, position.title)

      toast.success('Application submitted! We will review it soon.')
      navigate('/jobs')
    } catch (err: any) {
      console.error('Application error:', err)
      toast.error(err.message || 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }, [user, position, form, navigate])

  const noPosition = !positionId || !position

  useEffect(() => {
    if (noPosition) {
      navigate('/jobs')
    }
  }, [noPosition, navigate])

  if (noPosition) {
    return null
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <p className="text-slate-400">Loading application…</p>
      </div>
    )
  }

  if (existingApplication) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <CheckCircle2 className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Application Already Submitted</h1>
            <p className="text-gray-400">You have already applied for {position.title}.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/50 p-6">
            <p className="text-sm text-slate-400 mb-1">Status</p>
            <span className="inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-200">
              {existingApplication.status}
            </span>
            {existingApplication.created_at && (
              <p className="mt-4 text-xs text-slate-500">
                Submitted {new Date(existingApplication.created_at).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/jobs')}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 font-bold text-white transition hover:scale-[1.02]"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <position.icon className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Apply for {position.title}</h1>
            <p className="text-gray-400">{position.department}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/50 p-6 text-center">
            <UserIcon className="w-12 h-12 text-cyan-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Create your Mai Troll account to apply</h2>
            <p className="text-slate-400 mb-4">
              You need a Mai Troll account to submit an employment application. Create one below and your application will be ready.
            </p>
            <button
              onClick={() => navigate('/jobs/apply?position=' + position.id + '&signup=true')}
              className="rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 font-bold text-white transition hover:scale-[1.02]"
            >
              Create Account / Sign In
            </button>
          </div>
          <AuthModal />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <position.icon className="w-14 h-14 text-purple-400 mx-auto mb-3" />
          <h1 className="text-3xl font-bold mb-1">Apply for {position.title}</h1>
          <p className="text-gray-400">{position.department} · {position.isEmployeePosition ? 'Employee Position' : 'Platform Role'}</p>
        </div>

        <div className="space-y-5">
          <Section icon={UserIcon} title="1. Personal Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>Legal First Name</Label>
                <input className={inputCls} value={form.legal_first_name} onChange={(e) => set({ legal_first_name: e.target.value })} />
              </div>
              <div>
                <Label required>Legal Last Name</Label>
                <input className={inputCls} value={form.legal_last_name} onChange={(e) => set({ legal_last_name: e.target.value })} />
              </div>
              <div>
                <Label>Preferred Name</Label>
                <input className={inputCls} value={form.preferred_name} onChange={(e) => set({ preferred_name: e.target.value })} />
              </div>
              <div>
                <Label required>Date of Birth</Label>
                <input type="date" className={inputCls} value={form.date_of_birth} onChange={(e) => set({ date_of_birth: e.target.value })} />
                {age !== null && (
                  <p className={`text-xs mt-1 ${age < 18 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    Age: {age} {age < 18 ? '(must be 18+)' : ''}
                  </p>
                )}
              </div>
              <div>
                <Label required>SSN (Last 4)</Label>
                <input className={inputCls} maxLength={4} inputMode="numeric" placeholder="••••" value={form.ssn_last4} onChange={(e) => set({ ssn_last4: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
              </div>
              <div>
                <Label required>Full SSN (encrypted before submit)</Label>
                <input className={inputCls} inputMode="numeric" placeholder="XXX-XX-XXXX" value={form.ssn_full} onChange={(e) => set({ ssn_full: e.target.value })} />
                <p className="text-xs text-slate-500 mt-1">Only the last 4 are stored in clear. Full SSN is encrypted client-side.</p>
              </div>
            </div>
          </Section>

          <Section icon={MapPin} title="2. Contact Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>Email</Label>
                <input className={inputCls} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
              </div>
              <div>
                <Label required>Phone</Label>
                <input className={inputCls} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </div>
              <div>
                <Label>Alternate Phone</Label>
                <input className={inputCls} value={form.alternate_phone} onChange={(e) => set({ alternate_phone: e.target.value })} />
              </div>
              <div>
                <Label required>Country</Label>
                <input className={inputCls} value={form.country} onChange={(e) => set({ country: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label required>Address Line 1</Label>
                <input className={inputCls} value={form.address_line1} onChange={(e) => set({ address_line1: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Address Line 2</Label>
                <input className={inputCls} value={form.address_line2} onChange={(e) => set({ address_line2: e.target.value })} />
              </div>
              <div>
                <Label required>City</Label>
                <input className={inputCls} value={form.city} onChange={(e) => set({ city: e.target.value })} />
              </div>
              <div>
                <Label required>State / Region</Label>
                <input className={inputCls} value={form.state} onChange={(e) => set({ state: e.target.value })} />
              </div>
              <div>
                <Label required>Postal Code</Label>
                <input className={inputCls} value={form.postal_code} onChange={(e) => set({ postal_code: e.target.value })} />
              </div>
            </div>
          </Section>

          <Section icon={Shield} title="3. Employment Eligibility">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>Citizenship Status</Label>
                <select className={inputCls} value={form.citizenship_status} onChange={(e) => set({ citizenship_status: e.target.value })}>
                  <option value="">Select…</option>
                  <option value="us_citizen">U.S. Citizen</option>
                  <option value="permanent_resident">Permanent Resident</option>
                  <option value="authorized_alien">Authorized Alien</option>
                </select>
              </div>
              <div>
                <Label required>Authorized to Work</Label>
                <label className="flex items-center gap-2 mt-2 text-sm">
                  <input type="checkbox" checked={form.authorized_to_work} onChange={(e) => set({ authorized_to_work: e.target.checked })} />
                  I am legally authorized to work in this country
                </label>
              </div>
              <div className="sm:col-span-2">
                <Label>Work Authorization Detail</Label>
                <input className={inputCls} value={form.work_authorization_detail} onChange={(e) => set({ work_authorization_detail: e.target.value })} placeholder="e.g. Visa type / expiration" />
              </div>
              <div>
                <Label>Convicted of a Felony?</Label>
                <label className="flex items-center gap-2 mt-2 text-sm">
                  <input type="checkbox" checked={form.convicted_felony} onChange={(e) => set({ convicted_felony: e.target.checked })} />
                  I have been convicted of a felony
                </label>
              </div>
              {form.convicted_felony && (
                <div className="sm:col-span-2">
                  <Label required>Explanation</Label>
                  <textarea className={inputCls} rows={3} value={form.felony_explanation} onChange={(e) => set({ felony_explanation: e.target.value })} />
                </div>
              )}
            </div>
          </Section>

          <Section icon={CalendarDays} title="4. Work Availability">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>Available Start Date</Label>
                <input type="date" className={inputCls} value={form.available_start_date} onChange={(e) => set({ available_start_date: e.target.value })} />
              </div>
              <div>
                <Label required>Employment Type</Label>
                <select className={inputCls} value={form.employment_type} onChange={(e) => set({ employment_type: e.target.value })}>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="seasonal">Seasonal</option>
                </select>
              </div>
              <div>
                <Label required>Desired Pay Rate (per hour)</Label>
                <input type="number" className={inputCls} value={form.desired_pay_rate} onChange={(e) => set({ desired_pay_rate: e.target.value })} />
              </div>
              <div>
                <Label required>Hours Per Week</Label>
                <input className={inputCls} value={form.availability.hours_per_week} onChange={(e) => set({ availability: { ...form.availability, hours_per_week: e.target.value } })} />
              </div>
              <div>
                <Label>Shift Preference</Label>
                <select className={inputCls} value={form.availability.shift_pref} onChange={(e) => set({ availability: { ...form.availability, shift_pref: e.target.value } })}>
                  <option value="day">Day</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
              <div>
                <Label>Earliest Start</Label>
                <input type="time" className={inputCls} value={form.availability.earliest_start} onChange={(e) => set({ availability: { ...form.availability, earliest_start: e.target.value } })} />
              </div>
              <div>
                <Label>Latest End</Label>
                <input type="time" className={inputCls} value={form.availability.latest_end} onChange={(e) => set({ availability: { ...form.availability, latest_end: e.target.value } })} />
              </div>
            </div>
            <div>
              <Label>Available Days</Label>
              <div className="flex flex-wrap gap-3 mt-2">
                {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((d) => (
                  <label key={d} className="flex items-center gap-2 text-sm capitalize">
                    <input type="checkbox" checked={form.availability.days[d]} onChange={() => toggleDay(d)} />
                    {d}
                  </label>
                ))}
              </div>
            </div>
          </Section>

          <Section icon={Building2} title="5. Experience">
            <div>
              <Label>Skills</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SKILL_OPTIONS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => toggleSkill(s)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      form.skills.includes(s) ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100' : 'border-white/10 bg-black/30 text-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Education</Label>
                <button type="button" onClick={addEducation} className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-100">+ Add</button>
              </div>
              {form.education.map((ed, i) => (
                <div key={i} className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input className={inputCls} placeholder="School" value={ed.school} onChange={(e) => updateEducation(i, { school: e.target.value })} />
                    <input className={inputCls} placeholder="Degree" value={ed.degree} onChange={(e) => updateEducation(i, { degree: e.target.value })} />
                    <input className={inputCls} placeholder="Field of Study" value={ed.field} onChange={(e) => updateEducation(i, { field: e.target.value })} />
                    <input className={inputCls} placeholder="Start Year" value={ed.start_year} onChange={(e) => updateEducation(i, { start_year: e.target.value })} />
                    <input className={inputCls} placeholder="End Year" value={ed.end_year} onChange={(e) => updateEducation(i, { end_year: e.target.value })} />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={ed.completed} onChange={(e) => updateEducation(i, { completed: e.target.checked })} /> Completed
                    </label>
                  </div>
                  <button type="button" onClick={() => removeEducation(i)} className="text-xs text-rose-400">Remove</button>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Previous Employment</Label>
                <button type="button" onClick={addEmployment} className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-100">+ Add</button>
              </div>
              {form.employment_history.map((emp, i) => (
                <div key={i} className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input className={inputCls} placeholder="Employer" value={emp.employer} onChange={(e) => updateEmployment(i, { employer: e.target.value })} />
                    <input className={inputCls} placeholder="Job Title" value={emp.title} onChange={(e) => updateEmployment(i, { title: e.target.value })} />
                    <input className={inputCls} placeholder="Start Date" value={emp.start_date} onChange={(e) => updateEmployment(i, { start_date: e.target.value })} />
                    <input className={inputCls} placeholder="End Date" value={emp.end_date} onChange={(e) => updateEmployment(i, { end_date: e.target.value })} />
                    <input className={inputCls} placeholder="Supervisor" value={emp.supervisor} onChange={(e) => updateEmployment(i, { supervisor: e.target.value })} />
                    <input className={inputCls} placeholder="Phone" value={emp.phone} onChange={(e) => updateEmployment(i, { phone: e.target.value })} />
                  </div>
                  <textarea className={inputCls} rows={2} placeholder="Responsibilities" value={emp.responsibilities} onChange={(e) => updateEmployment(i, { responsibilities: e.target.value })} />
                  <input className={inputCls} placeholder="Reason for Leaving" value={emp.reason_leaving} onChange={(e) => updateEmployment(i, { reason_leaving: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={emp.may_contact} onChange={(e) => updateEmployment(i, { may_contact: e.target.checked })} /> May contact this employer
                  </label>
                  <button type="button" onClick={() => removeEmployment(i)} className="text-xs text-rose-400">Remove</button>
                </div>
              ))}
            </div>
          </Section>

          {position.isEmployeePosition && (
            <Section icon={Shield} title="9. Equipment Verification">
              <p className="text-xs text-slate-400">Employee positions require a desktop/laptop with webcam, mic, speakers, and reliable internet.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['has_desktop', 'Desktop / Laptop computer'],
                  ['has_webcam', 'Webcam'],
                  ['has_microphone', 'Microphone'],
                  ['has_speakers', 'Speakers'],
                  ['has_reliable_internet', 'Reliable Internet'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(form.equipment_verification as any)[key]}
                      onChange={(e) => set({ equipment_verification: { ...form.equipment_verification, [key]: e.target.checked } })}
                    />
                    {label}
                  </label>
                ))}
                <input className={inputCls} placeholder="Internet speed (Mbps)" value={form.equipment_verification.internet_speed_mbps} onChange={(e) => set({ equipment_verification: { ...form.equipment_verification, internet_speed_mbps: e.target.value } })} />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                <input type="checkbox" checked={form.equipment_verification.verified} onChange={(e) => set({ equipment_verification: { ...form.equipment_verification, verified: e.target.checked } })} />
                I verify the above equipment is available and functional.
              </label>
            </Section>
          )}

          <Section icon={Users} title="10. References">
            <p className="text-xs text-slate-400">Provide at least two references.</p>
            {form.references.map((ref, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Full Name" value={ref.name} onChange={(e) => updateReference(i, { name: e.target.value })} />
                  <input className={inputCls} placeholder="Relationship" value={ref.relationship} onChange={(e) => updateReference(i, { relationship: e.target.value })} />
                  <input className={inputCls} placeholder="Title" value={ref.title} onChange={(e) => updateReference(i, { title: e.target.value })} />
                  <input className={inputCls} placeholder="Company" value={ref.company} onChange={(e) => updateReference(i, { company: e.target.value })} />
                  <input className={inputCls} placeholder="Email" value={ref.email} onChange={(e) => updateReference(i, { email: e.target.value })} />
                  <input className={inputCls} placeholder="Phone" value={ref.phone} onChange={(e) => updateReference(i, { phone: e.target.value })} />
                  <input className={inputCls} placeholder="Years Known" value={ref.years_known} onChange={(e) => updateReference(i, { years_known: e.target.value })} />
                </div>
                {form.references.length > 1 && (
                  <button type="button" onClick={() => removeReference(i)} className="text-xs text-rose-400">Remove</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addReference} className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-100">+ Add Reference</button>
          </Section>

          {customQuestions.length > 0 && (
            <Section icon={HelpCircle} title="11. Role-Specific Questions">
              {customQuestions.map((q) => (
                <div key={q.id}>
                  <Label>{q.label}</Label>
                  <input className={inputCls} value={form.custom_answers[q.id] || ''} onChange={(e) => set({ custom_answers: { ...form.custom_answers, [q.id]: e.target.value } })} />
                </div>
              ))}
            </Section>
          )}

          <Section icon={FileSignature} title="12. WOTC Screening (Voluntary)">
            <p className="text-xs text-slate-400">This helps determine if Mai Troll may qualify for Work Opportunity Tax Credits (IRS Form 8850). It is completely voluntary and will not affect your application.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['received_public_assistance', 'Received public assistance'],
                ['snap', 'SNAP / Food Assistance'],
                ['tanf', 'TANF'],
                ['ssi', 'SSI'],
                ['unemployed_18_39', 'Unemployed age 18-39'],
                ['summer_youth', 'Summer youth program'],
                ['supplemental_nutrition', 'Supplemental nutrition program'],
                ['vocational_rehab', 'Vocational rehab referral'],
                ['ex_felony', 'Ex-felony (cond. hiring credit)'],
                ['ex_conviction', 'Ex-conviction'],
                ['long_term_family_assistance', 'Long-term family assistance'],
                ['veteran', 'Veteran'],
                ['disabled_veteran', 'Disabled veteran'],
                ['guard_reserve', 'Guard / Reserve'],
                ['food_stamp_recipient', 'Food stamp recipient'],
                ['qualified_vet', 'Qualified veteran (IRS)'],
                ['unemployed_vet', 'Unemployed veteran'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={(form.wotc as any)[key]} onChange={(e) => set({ wotc: { ...form.wotc, [key]: e.target.checked } })} />
                  {label}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
              <input type="checkbox" checked={form.wotc.authorized_signature} onChange={(e) => set({ wotc: { ...form.wotc, authorized_signature: e.target.checked } })} />
              I authorize the use of this information for WOTC determination.
            </label>
          </Section>

          <Section icon={Users} title="13. Equal Employment Opportunity (Voluntary)">
            <p className="text-xs text-slate-400">Self-identification is voluntary and used only for federal EEO reporting. Choose "Decline to self-identify" if you prefer not to answer.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Gender</Label>
                <select className={inputCls} value={form.eeo.gender} onChange={(e) => set({ eeo: { ...form.eeo, gender: e.target.value } })}>
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="nonbinary">Non-binary</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label>Veteran Status</Label>
                <input className={inputCls} value={form.eeo.veteran_status} onChange={(e) => set({ eeo: { ...form.eeo, veteran_status: e.target.value } })} />
              </div>
              <div>
                <Label>Disability</Label>
                <input className={inputCls} value={form.eeo.disability} onChange={(e) => set({ eeo: { ...form.eeo, disability: e.target.value } })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Race / Ethnicity</Label>
                <input className={inputCls} value={form.eeo.race_ethnicity.join(', ')} onChange={(e) => set({ eeo: { ...form.eeo, race_ethnicity: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })} placeholder="Comma separated" />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={form.eeo.decline_to_self_identify} onChange={(e) => set({ eeo: { ...form.eeo, decline_to_self_identify: e.target.checked } })} />
                Decline to self-identify
              </label>
            </div>
          </Section>

          <Section icon={CheckCircle2} title="14. Acknowledgements">
            {ACK_POLICIES.map((p) => (
              <label key={p.key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.acknowledgements.includes(p.key)}
                  onChange={(e) => set({ acknowledgements: e.target.checked ? [...form.acknowledgements, p.key] : form.acknowledgements.filter((k) => k !== p.key) })}
                />
                {p.label}
              </label>
            ))}
            <label className="flex items-start gap-2 text-sm font-semibold">
              <input type="checkbox" className="mt-1" checked={form.background_check_consent} onChange={(e) => set({ background_check_consent: e.target.checked })} />
              I consent to a background check as part of the application process.
            </label>
          </Section>

          <Section icon={FileSignature} title="15. Electronic Signature">
            <div>
              <Label required>Type Full Legal Name</Label>
              <input className={inputCls} value={form.signature_name} onChange={(e) => set({ signature_name: e.target.value })} placeholder="Your full legal name" />
            </div>
            <div>
              <Label>Cover Letter</Label>
              <textarea className={inputCls} rows={4} value={form.cover_letter} onChange={(e) => set({ cover_letter: e.target.value })} />
            </div>
            <div>
              <Label>Resume URL</Label>
              <input className={inputCls} value={form.resume_url} onChange={(e) => set({ resume_url: e.target.value })} placeholder="https://…" />
            </div>
            <label className="flex items-start gap-2 text-sm font-semibold">
              <input type="checkbox" className="mt-1" checked={form.agreed_to_terms} onChange={(e) => set({ agreed_to_terms: e.target.checked })} />
              I agree that the information provided is true and complete to the best of my knowledge.
            </label>
          </Section>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 font-bold text-white transition hover:scale-[1.01] disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit Application'}
          </button>
        </div>
      </div>
    </div>
  )
}
