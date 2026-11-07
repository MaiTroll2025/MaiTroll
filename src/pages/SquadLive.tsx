import React, { useCallback, useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { Radio, Play, Shield, Eye, Clock, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface StreamItem {
  id: string
  broadcaster_id: string
  title: string
  is_live: boolean
  viewer_count?: number | null
  current_viewers?: number
  start_time: string
  total_gifts_coins?: number
  broadcaster?: any
}

export default function SquadLive() {
  const { slug } = useParams()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [squad, setSquad] = useState<any | null>(null)
  const [streams, setStreams] = useState<StreamItem[]>([])
  const [membership, setMembership] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const squadRes = await supabase.from('squads').select('*').eq('slug', slug).maybeSingle()
      if (squadRes.error) throw squadRes.error
      setSquad(squadRes.data || null)
      const squadId = squadRes.data?.id
      if (!squadId) return

      const membersRes = await supabase
        .from('squad_memberships')
        .select('user_id')
        .eq('squad_id', squadId)
        .is('left_at', null)
      if (membersRes.error) throw membersRes.error
      const memberIds = (membersRes.data || []).map(m => m.user_id)

      if (user) {
        const meRes = await supabase.from('squad_memberships').select('*').eq('user_id', user.id).eq('squad_id', squadId).is('left_at', null).maybeSingle()
        setMembership(meRes.data || null)
      }

      if (memberIds.length > 0) {
        const streamsRes = await supabase
          .from('streams')
          .select('*')
          .in('broadcaster_id', memberIds)
          .eq('is_live', true)
          .order('current_viewers', { ascending: false })
          .limit(50)
        if (streamsRes.error) throw streamsRes.error
        setStreams((streamsRes.data || []) as StreamItem[])
      }
    } catch (e: any) {
      toast.error('Failed to load live streams')
      console.error(e)
    } finally { setLoading(false) }
  }, [slug, user])

  useEffect(() => { void load() }, [load])

  const canView = !!membership && !membership.left_at

  if (loading || !squad) {
    return <div className="min-h-screen bg-[#0A0814] text-white p-6 flex items-center justify-center"><div className="text-slate-400">Loading…</div></div>
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6 flex flex-col items-center justify-center">
        <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-8 text-center">
          <Shield className="w-10 h-10 text-slate-600 mb-3" />
          <h2 className="text-xl font-black mb-2">Squad Live Monitor</h2>
          <p className="text-slate-400">Only active members of <b>{squad.name}</b> can view the live broadcast monitor.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Radio className="w-6 h-6 text-red-400" />
          <h1 className="text-2xl font-black">{squad.name}</h1>
          <span className="ml-auto text-xs text-slate-500">Live Squad Broadcast Monitor</span>
        </div>
        <Link to={`/squads/${slug}`} className="mb-4 inline-block text-xs text-cyan-400 underline">← Back to Squad</Link>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Live Squad Streams</p>
            <p className="text-sm text-slate-300">{streams.length} member{streams.length !== 1 ? 's' : ''} live</p>
          </div>
          <p className="text-xs text-slate-500">Lightweight metadata only. Video connects when you select a stream.</p>
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
                      <div>
                        <div className="font-bold text-white text-sm truncate w-32">{s.broadcaster?.display_name || s.broadcaster?.username || 'Broadcaster'}</div>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-900/30 text-red-300 text-[10px] font-bold animate-pulse"><span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE</span>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-white">{s.viewer_count ?? s.current_viewers ?? 0}</span>
                  </div>
                  <p className="text-xs text-slate-300 truncate mb-2">{s.title}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                    <Clock className="w-3 h-3" />
                    <span>Broadcasting</span>
                    <span className="ml-auto">
                      <DollarSign className="w-3 h-3" />
                      {Number(s.total_gifts_coins ?? 0).toLocaleString()} TC gifts
                    </span>
                  </div>
                  <button
                    onClick={() => navigate(`/watch/${s.id}`)}
                    className="w-full rounded-xl border border-cyan-400/30 bg-cyan-900/20 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-800/40"
                  >
                    Watch Stream
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Leaders and members view verified stream metadata only. Squad Cash earnings attributed to a verified stream appear in weekly settlement and honor financial visibility settings.
        </p>
      </div>
    </div>
  )
}
