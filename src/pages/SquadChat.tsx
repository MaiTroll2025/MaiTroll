import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { sendConversationMessage, getConversationMessages, createConversation } from '@/lib/supabase'
import { Send, Shield } from 'lucide-react'
import { toast } from 'sonner'

export default function SquadChat() {
  const { slug } = useParams()
  const { user } = useAuthStore()
  const [squad, setSquad] = useState<any | null>(null)
  const [membership, setMembership] = useState<any | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [memberCount, setMemberCount] = useState(0)

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const squadRes = await supabase.from('squads').select('*').eq('slug', slug).maybeSingle()
      if (squadRes.error) throw squadRes.error
      setSquad(squadRes.data || null)
      const squadId = squadRes.data?.id
      if (!squadId) return

      const meRes = await supabase.from('squad_memberships').select('*').eq('squad_id', squadId).eq('user_id', user?.id).is('left_at', null).maybeSingle()
      if (meRes.error) throw meRes.error
      setMembership(meRes.data || null)

      if (!meRes.data) {
        setLoading(false)
        return
      }

      const memberRes = await supabase.from('squad_memberships').select('user_id').eq('squad_id', squadId).is('left_at', null)
      if (memberRes.error) throw memberRes.error
      setMemberCount((memberRes.data || []).length)
      const memberIds = (memberRes.data || []).map(m => m.user_id)

      // Look for existing group conversation named after squad
      const { data: convs } = await supabase.from('conversations').select('*').eq('is_group', true).eq('name', `Squad: ${squadRes.data.name}`).maybeSingle()
      if (convs) {
        setConversationId(convs.id)
        const msgs = await getConversationMessages(convs.id)
        setMessages(msgs)
      } else if (user) {
        const created = await createConversation(memberIds.filter(id => id !== user.id))
        await supabase.from('conversations').update({ name: `Squad: ${squadRes.data.name}`, is_group: true }).eq('id', created.id)
        setConversationId(created.id)
      }
    } catch (e: any) {
      toast.error('Failed to load squad chat')
      console.error(e)
    } finally { setLoading(false) }
  }, [slug, user])

  useEffect(() => { void load() }, [load])

  const canView = !!membership && !membership.left_at
  const scrollBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }

  useEffect(() => { void scrollBottom() }, [messages])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() || !conversationId || !user) return
    try {
      await sendConversationMessage(conversationId, body.trim())
      setBody('')
      const msgs = await getConversationMessages(conversationId)
      setMessages(msgs)
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message')
    }
  }

  if (loading || !squad) {
    return <div className="min-h-screen bg-[#0A0814] text-white p-6 flex items-center justify-center"><div className="text-slate-400">Loading…</div></div>
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6 flex flex-col items-center justify-center">
        <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-8 text-center">
          <Shield className="w-10 h-10 text-slate-600 mb-3" />
          <h2 className="text-xl font-black mb-2">Squad Chat</h2>
          <p className="text-slate-400">Only active members of <b>{squad.name}</b> can view private Squad chat.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-4 sm:p-6">
      <div className="max-w-2xl mx-auto flex flex-col h-[80vh]">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-cyan-400" />
          <h1 className="text-xl font-black">{squad.name}</h1>
          <span className="ml-auto text-xs text-slate-500">Private Squad Chat</span>
        </div>
        <Link to={`/squads/${slug}`} className="mb-3 inline-block text-xs text-cyan-400 underline">← Back to Squad</Link>

        <div className="flex-1 border border-white/10 bg-[#0b0b12]/40 rounded-xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-white/10 bg-[#10101a]/40">
            <p className="text-xs text-slate-400">{memberCount} active member{memberCount !== 1 ? 's' : ''} • Chat is within the Squad</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={messagesEndRef}>
            {messages.length === 0 && <p className="text-center text-slate-500 text-sm">No messages yet. Say hello!</p>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl p-2.5 text-sm ${m.sender_id === user?.id ? 'bg-purple-600 text-white' : 'bg-white/10 text-slate-200'}`}>
                  <p className="leading-relaxed">{m.body}</p>
                  <p className="text-[10px] opacity-60 mt-1">{m.sender_id === user?.id ? 'You' : (m.sender_username || 'Member')} • {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={send} className="p-3 border-t border-white/10 bg-[#10101a]/40">
            <div className="flex items-center gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message your Squad…"
                className="flex-1 rounded-xl px-4 py-2.5 text-white bg-white/5 border border-white/10 focus:border-cyan-400 focus:outline-none"
              />
              <button type="submit" disabled={!body.trim()} className="rounded-xl px-4 py-2.5 bg-purple-600 text-white font-bold disabled:opacity-50 hover:bg-purple-500">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
