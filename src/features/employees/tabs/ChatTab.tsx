import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'

export default function ChatTab({ profile: _profile, realProfile: _realProfile }: { profile?: any; realProfile?: any }) {
  const { user } = useAuthStore()
  const [channels, setChannels] = useState<any[]>([])
  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('employee_chat_channels').select('*').order('created_at')
      const list = (data as any[]) || []
      setChannels(list)
      setActiveChannel(list[0]?.id ?? null)
    })()
  }, [])

  useEffect(() => {
    if (!activeChannel) return
    let alive = true
    const load = async () => {
      const { data } = await supabase
        .from('employee_chat_messages')
        .select('*')
        .eq('channel_id', activeChannel)
        .order('created_at', { ascending: true })
        .limit(100)
      let messages = (data as any[]) || []
      const ids = [...new Set(messages.map(m => m.sender_id).filter(Boolean))]
      if (ids.length) {
        const { data: profiles } = await supabase.from('user_profiles').select('id, username, avatar_url').in('id', ids)
        const map = new Map((profiles || []).map((p: any) => [p.id, p]))
        messages = messages.map(m => ({ ...m, sender: map.get(m.sender_id) || null }))
      }
      if (alive) setMessages(messages)
    }
    load()
    const ch = supabase
      .channel(`emp-chat:${activeChannel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employee_chat_messages', filter: `channel_id=eq.${activeChannel}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as any])
      })
      .subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [activeChannel])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!body.trim() || !activeChannel || !user) return
    setBusy(true)
    try {
      const { error } = await supabase.from('employee_chat_messages').insert({
        channel_id: activeChannel, sender_id: user.id, body: body.trim(),
      })
      if (error) throw error
      setBody('')
    } catch (e: any) { import('sonner').then((s) => s.toast.error(e.message)) }
    finally { setBusy(false) }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <div className="space-y-1 rounded-2xl border border-white/10 bg-black/30 p-2">
        {channels.map((c) => (
          <button key={c.id} onClick={() => setActiveChannel(c.id)}
            className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${c.id === activeChannel ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-300 hover:bg-white/5'}`}>
            # {c.name}
          </button>
        ))}
      </div>

      <div className="flex h-[70vh] flex-col rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && <p className="text-sm text-slate-400">No messages yet.</p>}
          {messages.map((m) => (
            <div key={m.id} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-cyan-200">{m.sender?.username ?? 'Employee'}</span>
                <span className="text-xs text-slate-500">{new Date(m.created_at).toLocaleTimeString()}</span>
              </div>
              <p className="mt-1 text-sm text-slate-200">{m.body}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="mt-3 flex gap-2">
          <input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Message…" className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none" />
          <button disabled={busy} onClick={send} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">Send</button>
        </div>
      </div>
    </div>
  )
}
