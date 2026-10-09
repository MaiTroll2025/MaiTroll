import React, { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { PermissionGate } from '../components/PermissionGate'

export default function AnnouncementsTab({ profile: _profile, realProfile }: { profile?: any; realProfile?: any }) {
  const { user } = useAuthStore()
  const [items, setItems] = useState<any[]>([])
  const [acks, setAcks] = useState<Record<string, boolean>>({})
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [level, setLevel] = useState<'normal' | 'important' | 'urgent'>('normal')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('employee_announcements').select('*').order('created_at', { ascending: false }).limit(50)
    setItems((data as any[]) || [])
    if (user) {
      const { data: ackData } = await supabase.from('employee_announcement_acks').select('announcement_id').eq('user_id', user.id)
      const map: Record<string, boolean> = {}
      ;(ackData as any[])?.forEach((a) => { map[a.announcement_id] = true })
      setAcks(map)
    }
  }
  useEffect(() => { load() }, [user])

  const ack = async (id: string) => {
    if (!user) return
    await supabase.from('employee_announcement_acks').upsert({ announcement_id: id, user_id: user.id })
    setAcks((p) => ({ ...p, [id]: true }))
  }

  const create = async () => {
    if (!title || !body || !user) return
    setBusy(true)
    try {
      const { error } = await supabase.from('employee_announcements').insert({ title, body, level, author_id: user.id })
      if (error) throw error
      setTitle(''); setBody(''); setLevel('normal'); load()
      import('sonner').then((s) => s.toast.success('Announcement published'))
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-slate-400">No announcements.</p>}
        {items.map((a) => (
          <div key={a.id} className={`rounded-2xl border bg-black/30 p-5 ${
            a.level === 'urgent' ? 'border-red-400/30' : a.level === 'important' ? 'border-amber-400/30' : 'border-white/10'
          }`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{a.title}</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${a.level === 'urgent' ? 'bg-red-500/15 text-red-300' : a.level === 'important' ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-500/15 text-slate-300'}`}>{a.level}</span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{a.body}</p>
            <p className="mt-2 text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</p>
            {(a.level === 'important' || a.level === 'urgent') && (
              <button onClick={() => ack(a.id)} disabled={acks[a.id]}
                className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                {acks[a.id] ? '✓ Acknowledged' : 'Acknowledge'}
              </button>
            )}
          </div>
        ))}
      </div>

      <PermissionGate profile={realProfile} action="manage_announcements">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h2 className="mb-3 text-lg font-bold">New Announcement</h2>
          <div className="space-y-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
            <select value={level} onChange={(e) => setLevel(e.target.value as any)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm">
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message"
              className="min-h-[100px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm outline-none" />
            <button disabled={busy || !title || !body} onClick={create}
              className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-black disabled:opacity-50">Publish</button>
          </div>
        </div>
      </PermissionGate>
    </div>
  )
}
