import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Play, Eye, Clock, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

export default function SquadManageLive() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [squad, setSquad] = useState<any | null>(null)
  const [streams, setStreams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const meRes = await supabase.from('squad_memberships').select('*, squads(*)').eq('user_id', user.id).eq('role', 'leader').is('left_at', null).maybeSingle()
      if (meRes.error) throw meRes.error
      if (!meRes.data || !meRes.data.squads) {
        setLoading(false)
        return
      }
      setSquad(meRes.data.squads)
      const membersRes = await supabase.from('squad_memberships').select('user_id').eq('squad_id', meRes.data.squads.id).is('left_at', null)
      if (membersRes.error) throw membersRes.error
      const memberIds = (membersRes.data || []).map(m => m.user_id)
      if (memberIds.length > 0) {
        const streamsRes = await supabase.from('streams').select('*').in('broadcaster_id', memberIds).eq('is_live', true).order('current_viewers', { ascending: false })
        if (streamsRes.error) throw streamsRes.error
        setStreams(streamsRes.data || [])
      }
    } catch (e: any) {
      toast.error('Failed to load live monitor')
      console.error(e)
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { void load() }, [load])

  if (loading) return <div className="min-h-screen bg-[#0A0814] text-white p-6 flex items-center justify-center"><div className="text-slate-400">Loading…</div></div>
  if (!squad) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6 flex flex-col items-center justify-center">
        <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-8 text-center">
          <CrownIcon className="w-10 h-10 text-slate-600 mb-3" />
          <h2 className="text-xl font-black mb-2">Leader Live Monitor</h2>
          <p className="text-slate-400">You are not leading a Squad.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">Leader Live Monitor</h1>
            <p className="text-sm text-slate-400">{squad.name} — active member streams</p>
          </div>
          <button onClick={() => navigate('/squads/manage')} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/5">← Dashboard</button>
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-[#10101a]/60 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase">Stream Monitor</p>
          <p className="text-xs text-slate-500">Lightweight metadata only. Video connects when you select a stream. No broadcaster camera/microphone controls are granted.</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#10101a]/60">
          {streams.length === 0 ? (
            <div className="p-8 text-center">
              <Play className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-400">No Squad members are live right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
              {streams.map((s) => (
                <div key={s.id} className="rounded-lg border border-white/10 bg-[#0b0b12]/60 p-3 hover:border-cyan-400/50 transition">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white font-bold">{s.broadcaster?.username?.charAt(0) || '?'}</div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate w-32">{s.broadcaster?.display_name || s.broadcaster?.username || 'Broadcaster'}</div>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-900/30 text-red-300 text-[10px] font-bold animate-pulse"><span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE</span>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-slate-400" /><span className="text-xs font-bold text-white">{s.viewer_count ?? s.current_viewers ?? 0}</span>
                  </div>
                  <p className="text-xs text-slate-300 truncate mb-2">{s.title}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                    <Clock className="w-3 h-3" /><span>Streaming</span><span className="ml-auto"><DollarSign className="w-3 h-3" /> {Number(s.total_gifts_coins ?? 0).toLocaleString()} TC gifts</span>
                  </div>
                  <button onClick={() => navigate(`/watch/${s.id}`)} className="w-full rounded-xl border border-cyan-400/30 bg-cyan-900/20 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-800/40">Watch Stream</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Squad Cash earnings attributed to a verified stream are settled weekly and honor each member&apos;s financial visibility settings. Leaders cannot control broadcaster camera or microphone.
        </p>
      </div>
    </div>
  )
}

function CrownIcon({ className = '' }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 10L1.292 7.928a1 1 0 010-1.156l2.22-2.22a1 1 0 011.414 0l3.164 3.164A4 4 0 0013.828 5H4.172a4 4 0 00-2.83 1.172l3.164 3.164a1 1 0 011.414 0l2.22-2.22a1 1 0 011.414 0L21.708 7.928a1 1 0 010 1.156L21 10M3 10l2.22 2.22a1 1 0 001.414 0l3.164-3.164a1 1 0 011.414 0l2.22 2.22a1 1 0 001.414 0L21 10"></path></svg>
}
