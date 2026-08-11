import { useEffect, useState } from 'react'
import { Check, X, Gavel, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useSingOffActions } from '../hooks/useSingOffActions'
import type { SingOffJudgeApplication } from '../types'

export function SingOffJudgeApplicationsAdmin() {
  const { user, profile } = useAuthStore()
  const actions = useSingOffActions()
  const isStaff = !!(profile?.is_ceo || profile?.is_admin)
  const [apps, setApps] = useState<SingOffJudgeApplication[]>([])
  const [mine, setMine] = useState<SingOffJudgeApplication | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [statement, setStatement] = useState('')
  const [experience, setExperience] = useState('')
  const [broadcastExp, setBroadcastExp] = useState('')
  const [agree, setAgree] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    if (isStaff) {
      const { data } = await supabase.from('mai_singoff_judge_applications').select('*').order('created_at', { ascending: false })
      setApps((data as SingOffJudgeApplication[]) ?? [])
    }
    if (user?.id) {
      const { data } = await supabase.from('mai_singoff_judge_applications').select('*').eq('user_id', user.id).maybeSingle()
      setMine((data as SingOffJudgeApplication) ?? null)
    }
  }

useEffect(() => {
    void load()
    if (isStaff && user?.id) {
      const channel = supabase
        .channel('mai-singoff:judge-apps')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mai_singoff_judge_applications' }, (payload: any) => {
          const app = payload.new as SingOffJudgeApplication
          if (payload.eventType === 'INSERT') setApps((a) => [app, ...a])
          else if (payload.eventType === 'UPDATE') setApps((a) => a.map((x) => (x.id === app.id ? app : x)))
          else if (payload.eventType === 'DELETE') setApps((a) => a.filter((x) => x.id !== app.id))
          if (user?.id && app.user_id === user.id) setMine(app)
        })
        .subscribe()
return () => {
        void supabase.removeChannel(channel)
      }
    }
    return undefined
  }, [isStaff])

  const handleApply = async () => {
    if (!user?.id) return
    setSubmitting(true)
const res = await actions.applyJudge(statement, experience, broadcastExp, agree)
    setSubmitting(false)
    if (res.success) {
      toast.success('Application submitted!')
      setFormOpen(false)
      load()
    } else {
      toast.error(res.error || 'Could not submit application.')
    }
  }

  const handleStatus = async (id: string, action: string) => {
    const res = await actions.setJudgeStatus(id, user?.id ?? '', action)
    if (res.success) {
      toast.success(`Application ${action}d`)
      load()
    } else {
      toast.error(res.error || 'Could not update application.')
    }
  }

  const list: SingOffJudgeApplication[] = (isStaff ? apps : [mine].filter(Boolean)) as SingOffJudgeApplication[]

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Gavel className="w-5 h-5 text-cyan-400" /> Judge Applications
        </h2>
        {!isStaff && !mine && (
          <button onClick={() => setFormOpen(true)} className="flex items-center gap-1 rounded-md bg-cyan-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-cyan-500">
            <Plus className="w-3 h-3" /> Apply
          </button>
        )}
      </div>

      {!isStaff && mine && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
          Your application status:{' '}
          <span className={`font-bold ${
            mine.status === 'approved' ? 'text-emerald-400' : mine.status === 'pending' ? 'text-amber-400' : 'text-red-400'
          }`}>
            {mine.status}
          </span>
        </div>
      )}

      {list.map((app) => (
        <div key={app.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-white">• {app.user_id.slice(0, 8)}</div>
            <span className={`text-xs font-bold ${
              app.status === 'approved' ? 'text-emerald-400' : app.status === 'pending' ? 'text-amber-400' : app.status === 'rejected' ? 'text-red-400' : 'text-purple-400'
            }`}>
              {app.status}
            </span>
          </div>
          {app.statement && <p className="mt-1 text-xs text-zinc-300 line-clamp-2">{app.statement}</p>}
          {isStaff && app.status === 'pending' && (
            <div className="mt-2 flex gap-1.5">
              <button onClick={() => handleStatus(app.id, 'approve')} className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold">
                <Check className="w-3 h-3" /> Approve
              </button>
              <button onClick={() => handleStatus(app.id, 'reject')} className="flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold">
                <X className="w-3 h-3" /> Reject
              </button>
            </div>
          )}
          {isStaff && app.status === 'approved' && (
            <button onClick={() => handleStatus(app.id, 'suspend')} className="mt-1 rounded bg-purple-700 px-2 py-0.5 text-[10px] font-bold">
              Suspend
            </button>
          )}
        </div>
      ))}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-zinc-900 border border-zinc-800 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-3">Apply to be a Judge</h3>
            <textarea value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Why do you want to judge?" className="w-full rounded-md bg-zinc-800 p-2 text-sm text-white" rows={3} />
            <textarea value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Judging/singing experience" className="w-full rounded-md bg-zinc-800 p-2 text-sm text-white mt-2" rows={2} />
            <textarea value={broadcastExp} onChange={(e) => setBroadcastExp(e.target.value)} placeholder="Broadcast experience" className="w-full rounded-md bg-zinc-800 p-2 text-sm text-white mt-2" rows={2} />
            <label className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I agree to the judge code of conduct.
            </label>
            <button
              onClick={handleApply}
              disabled={submitting || !agree}
              className="mt-3 w-full rounded-md bg-cyan-600 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
