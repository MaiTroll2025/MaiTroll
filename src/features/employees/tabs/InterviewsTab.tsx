import React, { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, CalendarClock, CheckCircle2, XCircle, Loader2, Video, Users, Clock, FileText } from 'lucide-react';
import { toast } from 'sonner'

import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { isAdmin } from '../permissions'
import {
  notifyInterviewScheduled,
  notifyInterviewStarted,
} from '../../../lib/notifications'
import InterviewScreen from '../components/InterviewScreen'

interface EmployeeProfileLike {
  id?: string
  username?: string | null
  role?: string | null
  is_admin?: boolean | null
  is_lead_officer?: boolean | null
  is_troll_officer?: boolean | null
  is_secretary?: boolean | null
  [key: string]: unknown
}

interface ApplicantOption {
  application_id: string
  user_id: string
  username: string | null
  position_id: string | null
  position_title: string | null
  status: string
}

interface InterviewerOption {
  id: string
  username: string | null
  role: string | null
}

interface InterviewRow {
  id: string
  job_application_id: string
  applicant_id: string
  position_id: string | null
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number
  interviewer_id: string | null
  instructions: string | null
  internal_notes: string | null
  call_room_id: string | null
  status: string
  applicant_username?: string | null
  interviewer_username?: string | null
  room_name?: string | null
}

const _INTERVIEW_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'] as const

function formatDateValue(value?: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatLabel(value?: string | null): string {
  if (!value) return '—'
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function statusClasses(status: string): string {
  switch (status) {
    case 'completed':
      return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
    case 'in_progress':
      return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200'
    case 'cancelled':
    case 'no_show':
      return 'border-rose-400/20 bg-rose-500/10 text-rose-200'
    default:
      return 'border-violet-400/20 bg-violet-500/10 text-violet-200'
  }
}

/** Returns true if two time ranges overlap on the same date. */
function rangesOverlap(
  start1: string,
  dur1: number,
  start2: string,
  dur2: number,
): boolean {
  const toMinutes = (t: string): number => {
    const [h, m] = t.split(':').map((n) => parseInt(n, 10))
    return h * 60 + m
  }
  const a1 = toMinutes(start1)
  const a2 = a1 + dur1
  const b1 = toMinutes(start2)
  const b2 = b1 + dur2
  return a1 < b2 && b1 < a2
}

export default function InterviewsTab({
  profile,
  realProfile,
}: {
  profile?: EmployeeProfileLike | null
  realProfile?: EmployeeProfileLike | null
}) {
  const { user } = useAuthStore()
  const effectiveProfile = realProfile ?? profile
  const canManage =
    isAdmin(effectiveProfile) ||
    Boolean(effectiveProfile?.is_lead_officer) ||
    Boolean(effectiveProfile?.is_secretary) ||
    effectiveProfile?.role === 'lead_troll_officer' ||
    effectiveProfile?.role === 'secretary' ||
    effectiveProfile?.role === 'agency_hr_manager' ||
    effectiveProfile?.role === 'hr_admin'

  const [loading, setLoading] = useState(true)
  const [applicants, setApplicants] = useState<ApplicantOption[]>([])
  const [interviewers, setInterviewers] = useState<InterviewerOption[]>([])
  const [interviews, setInterviews] = useState<InterviewRow[]>([])
  const [activeInterview, setActiveInterview] = useState<InterviewRow | null>(
    null,
  )
  const [scheduling, setScheduling] = useState(false)

  // Form state
  const [formApplicant, setFormApplicant] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formTime, setFormTime] = useState('12:00')
  const [formDuration, setFormDuration] = useState(30)
  const [formInterviewer, setFormInterviewer] = useState('')
  const [formInstructions, setFormInstructions] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const loadInterviewers = useCallback(async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username, role, is_admin, is_lead_officer, is_troll_officer')
      .or(
        'is_admin.eq.true,is_lead_officer.eq.true,is_troll_officer.eq.true,role.eq.lead_troll_officer,role.eq.secretary,role.eq.agency_hr_manager,role.eq.hr_admin,role.eq.admin',
      )
      .limit(200)

    setInterviewers(
      (data as InterviewerOption[] | null)?.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
      })) ?? [],
    )
  }, [])

  const loadApplicants = useCallback(async () => {
    const { data, error } = await supabase
      .from('job_applications')
      .select(
        'id, user_id, position_id, status, position:career_positions(title), applicant:user_profiles(username)',
      )
      .in('status', ['pending', 'reviewing', 'interview'])
      .limit(200)

    if (error) {
      console.error('Unable to load applicants:', error)
      return
    }

    setApplicants(
      (data as unknown as Array<{
        id: string
        user_id: string
        position_id: string | null
        status: string
        position?: { title: string | null } | null
        applicant?: { username: string | null } | null
      }> | null)?.map((a) => ({
        application_id: a.id,
        user_id: a.user_id,
        username: a.applicant?.username ?? null,
        position_id: a.position_id,
        position_title: a.position?.title ?? null,
        status: a.status,
      })) ?? [],
    )
  }, [])

  const loadInterviews = useCallback(async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select(
        'id, job_application_id, applicant_id, position_id, scheduled_date, scheduled_time, duration_minutes, interviewer_id, instructions, internal_notes, call_room_id, status, applicant:user_profiles!interviews_applicant_id_fkey(username), interviewer:user_profiles!interviews_interviewer_id_fkey(username), session:interview_sessions(room_name)',
      )
      .order('scheduled_date', { ascending: true })

    if (error) {
      console.error('Unable to load interviews:', error)
      toast.error('Could not load interviews.')
      return
    }

    setInterviews(
      (data as unknown as Array<{
        id: string
        job_application_id: string
        applicant_id: string
        position_id: string | null
        scheduled_date: string
        scheduled_time: string
        duration_minutes: number
        interviewer_id: string | null
        instructions: string | null
        internal_notes: string | null
        call_room_id: string | null
        status: string
        applicant?: { username: string | null } | null
        interviewer?: { username: string | null } | null
        session?: { room_name: string } | null
      }> | null)?.map((i) => ({
        id: i.id,
        job_application_id: i.job_application_id,
        applicant_id: i.applicant_id,
        position_id: i.position_id,
        scheduled_date: i.scheduled_date,
        scheduled_time: i.scheduled_time,
        duration_minutes: i.duration_minutes,
        interviewer_id: i.interviewer_id,
        instructions: i.instructions,
        internal_notes: i.internal_notes,
        call_room_id: i.call_room_id,
        status: i.status,
        applicant_username: i.applicant?.username ?? null,
        interviewer_username: i.interviewer?.username ?? null,
        room_name: i.session?.room_name ?? null,
      })) ?? [],
    )
  }, [])

  const initialLoad = useCallback(async () => {
    if (!canManage) {
      setLoading(false)
      return
    }
    setLoading(true)
    await Promise.all([
      loadApplicants(),
      loadInterviewers(),
      loadInterviews(),
    ])
    setLoading(false)
  }, [canManage, loadApplicants, loadInterviewers, loadInterviews])

  useEffect(() => {
    void initialLoad()
  }, [initialLoad])

  useEffect(() => {
    if (!canManage || !user?.id) return

    const channel = supabase
      .channel(`hr-interviews:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interviews',
        },
        () => void loadInterviews(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [canManage, loadInterviews, user?.id])

  const scheduleInterview = useCallback(async () => {
    if (!user?.id) return
    if (!formApplicant || !formDate || !formTime || !formInterviewer) {
      toast.error('Select an applicant, date, time, and interviewer.')
      return
    }

    setScheduling(true)

    try {
      const applicant = applicants.find(
        (a) => a.application_id === formApplicant,
      )
      if (!applicant) {
        throw new Error('Selected applicant not found.')
      }

      // CONFLICT PREVENTION
      const { data: conflicts, error: conflictError } = await supabase
        .from('interviews')
        .select(
          'id, applicant_id, interviewer_id, scheduled_date, scheduled_time, duration_minutes, status',
        )
        .in('status', ['scheduled', 'in_progress'])

      if (conflictError) throw conflictError

      const sameApplicant = (conflicts as Array<{
        applicant_id: string
        scheduled_date: string
        scheduled_time: string
        duration_minutes: number
      }> | null)?.find(
        (c) =>
          c.applicant_id === applicant.user_id &&
          c.scheduled_date === formDate &&
          rangesOverlap(
            c.scheduled_time,
            c.duration_minutes,
            formTime,
            formDuration,
          ),
      )

      if (sameApplicant) {
        toast.error(
          `Conflict: this applicant already has an interview on ${formatDateValue(
            formDate,
          )} at ${sameApplicant.scheduled_time}.`,
        )
        return
      }

      const sameInterviewer = (conflicts as Array<{
        interviewer_id: string | null
        scheduled_date: string
        scheduled_time: string
        duration_minutes: number
      }> | null)?.find(
        (c) =>
          c.interviewer_id === formInterviewer &&
          c.scheduled_date === formDate &&
          rangesOverlap(
            c.scheduled_time,
            c.duration_minutes,
            formTime,
            formDuration,
          ),
      )

      if (sameInterviewer) {
        toast.error(
          `Conflict: the interviewer is booked on ${formatDateValue(
            formDate,
          )} at ${sameInterviewer.scheduled_time}.`,
        )
        return
      }

      // Create interview_sessions room row
      const roomName = `interview-${crypto.randomUUID()}`
      const { data: session, error: sessionError } = await supabase
        .from('interview_sessions')
        .insert({
          room_name: roomName,
          admin_id: user.id,
          user_id: applicant.user_id,
          status: 'active',
        })
        .select('id')
        .single()

      if (sessionError) throw sessionError

      const { data: inserted, error: insertError } = await supabase
        .from('interviews')
        .insert({
          job_application_id: applicant.application_id,
          applicant_id: applicant.user_id,
          position_id: applicant.position_id,
          scheduled_date: formDate,
          scheduled_time: formTime,
          duration_minutes: formDuration,
          interviewer_id: formInterviewer,
          instructions: formInstructions || null,
          internal_notes: formNotes || null,
          call_room_id: session.id,
          status: 'scheduled',
          created_by: user.id,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      // Update job_application status + timeline
      const scheduledAtIso = `${formDate}T${formTime}:00`
      const timelineEntry = {
        event: 'interview_scheduled',
        at: new Date().toISOString(),
        interview_id: inserted.id,
        scheduled_for: scheduledAtIso,
        room_name: roomName,
      }

      await supabase
        .from('job_applications')
        .update({
          status: 'interview_scheduled',
          timeline: supabase.rpc('append_timeline', {
            p_timeline: undefined,
            p_entry: timelineEntry,
          }) as never,
        })
        .eq('id', applicant.application_id)

      // Fallback timeline write if RPC unavailable
      const { data: appRow } = await supabase
        .from('job_applications')
        .select('timeline')
        .eq('id', applicant.application_id)
        .maybeSingle()

      if (appRow) {
        const existing = Array.isArray((appRow as { timeline?: unknown[] }).timeline)
          ? ((appRow as { timeline?: unknown[] }).timeline as unknown[])
          : []
        const merged = [...existing, timelineEntry]
        await supabase
          .from('job_applications')
          .update({ timeline: merged })
          .eq('id', applicant.application_id)
      }

      await notifyInterviewScheduled(
        applicant.user_id,
        formInterviewer,
        scheduledAtIso,
        roomName,
      )

      toast.success('Interview scheduled.')
      setFormApplicant('')
      setFormDate('')
      setFormTime('12:00')
      setFormDuration(30)
      setFormInterviewer('')
      setFormInstructions('')
      setFormNotes('')
      await loadInterviews()
    } catch (error) {
      console.error('Unable to schedule interview:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'The interview could not be scheduled.',
      )
    } finally {
      setScheduling(false)
    }
  }, [
    user?.id,
    applicants,
    formApplicant,
    formDate,
    formTime,
    formDuration,
    formInterviewer,
    formInstructions,
    formNotes,
    loadInterviews,
  ])

  const startInterview = useCallback(
    async (row: InterviewRow) => {
      if (!row.room_name) {
        toast.error('This interview has no video room.')
        return
      }
      try {
        await supabase
          .from('interviews')
          .update({ status: 'in_progress' })
          .eq('id', row.id)
        if (row.call_room_id) {
          await supabase
            .from('interview_sessions')
            .update({ status: 'active' })
            .eq('id', row.call_room_id)
        }
        if (row.applicant_id && row.interviewer_id) {
          await notifyInterviewStarted(row.applicant_id, row.interviewer_id)
        }
        setActiveInterview(row)
        await loadInterviews()
      } catch (error) {
        console.error('Unable to start interview:', error)
        toast.error('Could not start the interview.')
      }
    },
    [loadInterviews],
  )

  const completeInterview = useCallback(
    async (row: InterviewRow) => {
      try {
        await supabase
          .from('interviews')
          .update({ status: 'completed' })
          .eq('id', row.id)
        if (row.call_room_id) {
          await supabase
            .from('interview_sessions')
            .update({ status: 'completed', ended_at: new Date().toISOString() })
            .eq('id', row.call_room_id)
        }
        const { data: appRow } = await supabase
          .from('job_applications')
          .select('timeline')
          .eq('id', row.job_application_id)
          .maybeSingle()
        const existing = Array.isArray((appRow as { timeline?: unknown[] } | null)?.timeline)
          ? ((appRow as { timeline?: unknown[] }).timeline as unknown[])
          : []
        await supabase
          .from('job_applications')
          .update({
            timeline: [
              ...existing,
              {
                event: 'interview_completed',
                at: new Date().toISOString(),
                interview_id: row.id,
              },
            ],
          })
          .eq('id', row.job_application_id)
        toast.success('Interview marked complete.')
        await loadInterviews()
      } catch (error) {
        console.error('Unable to complete interview:', error)
        toast.error('Could not complete the interview.')
      }
    },
    [loadInterviews],
  )

  const cancelInterview = useCallback(
    async (row: InterviewRow) => {
      try {
        await supabase
          .from('interviews')
          .update({ status: 'cancelled' })
          .eq('id', row.id)
        if (row.call_room_id) {
          await supabase
            .from('interview_sessions')
            .update({ status: 'completed', ended_at: new Date().toISOString() })
            .eq('id', row.call_room_id)
        }
        toast.success('Interview cancelled.')
        await loadInterviews()
      } catch (error) {
        console.error('Unable to cancel interview:', error)
        toast.error('Could not cancel the interview.')
      }
    },
    [loadInterviews],
  )

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-slate-400">
        You do not have permission to manage interviews.
      </div>
    )
  }

  if (activeInterview?.room_name) {
    return (
      <InterviewScreen
        interviewId={activeInterview.id}
        applicantId={activeInterview.applicant_id}
        interviewerId={activeInterview.interviewer_id ?? ''}
        isInterviewer={true}
        roomName={activeInterview.room_name}
        onClose={() => {
          setActiveInterview(null)
          void loadInterviews()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <header className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/90">
        <div className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">
            Human Resources
          </p>
          <h1 className="mt-1 text-2xl font-black text-white">
            Interview Scheduling
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Schedule live interviews, prevent double-bookings, and join the
            video room when it begins.
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/80">
        <div className="border-b border-white/10 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-black text-white">
            <CalendarPlus className="h-5 w-5 text-cyan-300" />
            Schedule Interview
          </h2>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-slate-300">
              Applicant
            </label>
            <select
              value={formApplicant}
              onChange={(e) => {
                const id = e.target.value
                setFormApplicant(id)
                const a = applicants.find(
                  (x) => x.application_id === id,
                )
                if (a) setFormNotes((prev) => prev || '')
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none"
            >
              <option value="">Select applicant</option>
              {applicants.map((a) => (
                <option key={a.application_id} value={a.application_id}>
                  {a.username ?? 'Applicant'} —{' '}
                  {a.position_title ?? 'Position'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300">
              Interviewer
            </label>
            <select
              value={formInterviewer}
              onChange={(e) => setFormInterviewer(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none"
            >
              <option value="">Select interviewer</option>
              {interviewers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.username ?? 'Staff'} — {formatLabel(i.role)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300">
              Date
            </label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-300">
                Time
              </label>
              <input
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-bold text-slate-300">
                Minutes
              </label>
              <select
                value={formDuration}
                onChange={(e) => setFormDuration(parseInt(e.target.value, 10))}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={45}>45</option>
                <option value={60}>60</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-300">
              Instructions (shown to applicant)
            </label>
            <textarea
              value={formInstructions}
              onChange={(e) => setFormInstructions(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 py-2 text-sm text-white outline-none"
              placeholder="What the applicant should prepare..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-300">
              Internal notes
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 py-2 text-sm text-white outline-none"
              placeholder="Private HR notes (not visible to applicant)"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              disabled={scheduling}
              onClick={() => void scheduleInterview()}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-black text-slate-950 disabled:opacity-40"
            >
              {scheduling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="h-4 w-4" />
              )}
              Schedule Interview
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/80">
        <div className="border-b border-white/10 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-black text-white">
            <CalendarClock className="h-5 w-5 text-cyan-300" />
            Scheduled Interviews
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : interviews.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-9 w-9 text-slate-600" />
            <p className="mt-3 text-sm font-bold text-slate-300">
              No interviews scheduled
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {interviews.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-white">
                      {row.applicant_username ?? 'Applicant'}
                    </p>
                    <span
                      className={`rounded-full border px-2 py-1 text-[9px] font-bold ${statusClasses(
                        row.status,
                      )}`}
                    >
                      {formatLabel(row.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">
                    Interviewer: {row.interviewer_username ?? 'Unassigned'}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    {formatDateValue(row.scheduled_date)} at {row.scheduled_time}{' '}
                    · {row.duration_minutes} min
                  </p>
                  {row.instructions && (
                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <FileText className="h-3 w-3" />
                      {row.instructions}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {row.status === 'scheduled' && (
                    <button
                      type="button"
                      onClick={() => void startInterview(row)}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950"
                    >
                      <Video className="h-4 w-4" /> Start
                    </button>
                  )}
                  {row.status === 'in_progress' && (
                    <button
                      type="button"
                      onClick={() => void startInterview(row)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950"
                    >
                      <Video className="h-4 w-4" /> Rejoin
                    </button>
                  )}
                  {row.status !== 'completed' &&
                    row.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => void completeInterview(row)}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Complete
                      </button>
                    )}
                  {row.status !== 'completed' &&
                    row.status !== 'cancelled' &&
                    row.status !== 'no_show' && (
                      <button
                        type="button"
                        onClick={() => void cancelInterview(row)}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200"
                      >
                        <XCircle className="h-4 w-4" /> Cancel
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
