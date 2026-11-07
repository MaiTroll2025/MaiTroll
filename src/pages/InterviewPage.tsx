import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, ShieldAlert, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import InterviewScreen from '../features/employees/components/InterviewScreen'

interface InterviewLoad {
  id: string
  applicant_id: string
  interviewer_id: string | null
  room_name: string | null
  status: string
}

/**
 * Public-ish route for applicants (and interviewers) to join their interview.
 * Loads the interview by id and verifies the current user is the applicant or
 * the interviewer. Renders the InterviewScreen with the correct role.
 */
export default function InterviewPage() {
  const { interviewId } = useParams<{ interviewId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [data, setData] = useState<InterviewLoad | null>(null)

  useEffect(() => {
    if (!interviewId) {
      setDenied(true)
      setLoading(false)
      return
    }
    if (!user?.id) {
      // Wait for auth to resolve before deciding.
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        const { data: row, error } = await supabase
          .from('interviews')
          .select(
            'id, applicant_id, interviewer_id, status, session:interview_sessions(room_name)',
          )
          .eq('id', interviewId)
          .maybeSingle()

        if (error) throw error
        if (cancelled) return

        if (!row) {
          setDenied(true)
          setLoading(false)
          return
        }

        const typed = row as unknown as {
          id: string
          applicant_id: string
          interviewer_id: string | null
          status: string
          session?: { room_name: string } | null
        }

        const isApplicant = typed.applicant_id === user.id
        const isInterviewer = typed.interviewer_id === user.id

        if (!isApplicant && !isInterviewer) {
          setDenied(true)
          setLoading(false)
          return
        }

        setData({
          id: typed.id,
          applicant_id: typed.applicant_id,
          interviewer_id: typed.interviewer_id,
          room_name: typed.session?.room_name ?? null,
          status: typed.status,
        })
        setLoading(false)
      } catch (error) {
        console.error('Unable to load interview:', error)
        if (!cancelled) {
          toast.error('Could not load the interview.')
          setDenied(true)
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [interviewId, user?.id])

  const isInterviewer = useMemo(
    () => Boolean(data && data.interviewer_id === user?.id),
    [data, user?.id],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-black text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading interview...
      </div>
    )
  }

  if (denied || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black p-10 text-center">
        <ShieldAlert className="h-10 w-10 text-rose-400" />
        <p className="text-lg font-black text-white">Access Denied</p>
        <p className="max-w-md text-sm text-slate-400">
          You are not authorized to view this interview.
        </p>
        <button
          type="button"
          onClick={() => navigate('/careers')}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950"
        >
          <XCircle className="h-4 w-4" /> Back
        </button>
      </div>
    )
  }

  if (!data.room_name) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-10 text-center text-sm text-slate-400">
        This interview does not have a video room yet.
      </div>
    )
  }

  return (
    <InterviewScreen
      interviewId={data.id}
      applicantId={data.applicant_id}
      interviewerId={data.interviewer_id ?? ''}
      isInterviewer={isInterviewer}
      roomName={data.room_name}
      onClose={() => navigate(isInterviewer ? '/Employees?tab=hiring' : '/careers')}
    />
  )
}
