import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { isLead, isTrollOfficer } from '../permissions'

export default function HomeTab({ profile }: { profile?: any; realProfile?: any }) {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<any>({
    tasks: 0, announcements: 0, pendingReports: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      try {
        const [tasks, anns, reports] = await Promise.all([
          supabase.from('employee_tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', user.id).in('status', ['assigned', 'in_progress', 'blocked', 'awaiting_review']),
          supabase.from('employee_announcements').select('id', { count: 'exact', head: true }),
          supabase.from('employee_reports').select('id', { count: 'exact', head: true }).eq('submitted_by', user.id).in('status', ['submitted', 'received', 'under_review', 'more_info_needed']),
        ])

        if (alive) setStats({
          tasks: tasks.count ?? 0,
          announcements: anns.count ?? 0,
          pendingReports: reports.count ?? 0,
        })
      } catch (e) {
        console.error(e)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [user])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/5 p-6">
        <p className="text-xs uppercase tracking-widest text-slate-400">Welcome back</p>
        <h1 className="mt-1 text-3xl font-black">{profile?.username}</h1>
        <p className="text-sm capitalize text-cyan-300">{(profile?.role ?? '').replace(/_/g, ' ')}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Open Tasks" value={stats.tasks} />
          <Stat label="Announcements" value={stats.announcements} />
          <Stat label="My Reports" value={stats.pendingReports} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Quick Reminders">
          <ul className="space-y-1 text-sm text-slate-300">
            <li>• Acknowledge important/urgent announcements.</li>
            <li>• Submit incident reports to your Lead.</li>
            <li>• Review your assigned tasks regularly.</li>
          </ul>
        </Card>
        {(isTrollOfficer(profile) || isLead(profile)) && (
          <Card title="Officer Handbook">
            <p className="text-sm text-slate-400">
              Monitor users and broadcasts, create incident reports, and respond to Lead requests using your
              Troll Officer tools tab. Reports route automatically to your Lead Troll Officer.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value ?? 0}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <h2 className="mb-3 text-lg font-bold text-white">{title}</h2>
      {children}
    </div>
  )
}
