import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { Users, Crown, Shield, ArrowRight, Radio } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSquads } from '@/lib/hooks/useSquads'

export default function SquadProfile() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { joinSquad, fetchSquadMembers } = useSquads()

  const [squad, setSquad] = useState<any | null>(null)
  const [membership, setMembership] = useState<any | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const [sRes, mRes] = await Promise.all([
        supabase.from('squads').select('*').eq('slug', slug).eq('status', 'active').maybeSingle(),
        user ? supabase.from('squad_memberships').select('*').eq('user_id', user.id).is('left_at', null).maybeSingle() : Promise.resolve({ data: null }),
      ])
      if (sRes.error) throw sRes.error
      setSquad(sRes.data || null)
      if (user) {
        setMembership(mRes.data || null)
        if (!mRes.data || mRes.data.squad_id !== sRes.data?.id) {
          const memRes = await fetchSquadMembers(sRes.data.id)
          setMembers(memRes)
        } else {
          const memRes = await fetchSquadMembers(sRes.data.id)
          setMembers(memRes)
        }
      }
    } catch (e: any) {
      console.error('SquadProfile load error', e)
      setSquad(null)
    } finally { setLoading(false) }
  }, [slug, user, fetchSquadMembers])

  useEffect(() => { void load() }, [load])

  const handleJoin = async () => {
    if (!user) { navigate('/auth'); return }
    const res = await joinSquad(squad!.id)
    if (res.success) {
      setMembership({ squad_id: squad!.id, user_id: user.id, role: 'member', joined_at: new Date().toISOString(), left_at: null, join_fee_paid: true })
      navigate(`/squads/${slug}`)
    }
  }

  if (loading || !squad) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6 flex items-center justify-center">
        <div className="text-slate-400">Loading Squad…</div>
      </div>
    )
  }

  const isMember = !!membership && membership.squad_id === squad.id && !membership.left_at

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl border border-white/10 bg-[#10101a]/60 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-white font-black text-2xl">
              {squad.tag?.charAt(0) || 'S'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white">{squad.name}</h1>
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-900/30 px-2 py-0.5 rounded">@{squad.tag}</span>
              </div>
              {squad.block_name && <p className="text-xs text-slate-400">City Block: {squad.block_name}</p>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              <span className="text-xs font-bold text-slate-300">Leader</span>
            </div>
          </div>
          {squad.description && <p className="text-sm text-slate-300 mb-4">{squad.description}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-slate-400">Members</div>
              <div className="font-bold text-white">{members.length}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-slate-400">Squad Cash</div>
              <div className="font-bold text-cyan-300">Weekly payout</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-slate-400">Squad Flame</div>
              <div className="font-bold text-yellow-400">Competitive points</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-slate-400">Status</div>
              <div className="font-bold text-emerald-400">{squad.status}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Members</h2>
          <Link to={`/squads/${slug}/members`} className="text-xs text-cyan-400 underline">View all →</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {members.slice(0, 12).map((m) => (
            <div key={m.user_id} className="rounded-lg border border-white/10 bg-[#10101a]/40 p-3 flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white font-bold">{m.user_profiles?.username?.charAt(0) || '?'}</div>
              <p className="text-xs font-bold text-white truncate w-full">{m.user_profiles?.display_name || m.user_profiles?.username}</p>
              <p className="text-[10px] text-slate-500 capitalize">{m.role}</p>
              {m.role === 'leader' && <span className="text-[10px] text-yellow-400 font-bold">Leader</span>}
            </div>
          ))}
        </div>

        {!isMember && user ? (
          <div className="mt-6">
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-auto rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-bold text-white shadow-lg hover:from-purple-500 hover:to-pink-500 disabled:opacity-60"
            >
              <Users className="w-4 h-4 mr-2" /> Join Squad (100 TC)
            </button>
          </div>
        ) : null}

        {isMember ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link to={`/squads/${slug}/chat`} className="rounded-xl border border-white/10 bg-[#10101a]/60 p-4 flex items-center gap-2 text-left hover:bg-white/5">
              <Shield className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="text-xs text-slate-400">Squad Chat</div>
                <div className="font-bold text-white">Private</div>
              </div>
            </Link>
            <Link to={`/squads/${slug}/live`} className="rounded-xl border border-white/10 bg-[#10101a]/60 p-4 flex items-center gap-2 text-left hover:bg-white/5">
              <Radio className="w-5 h-5 text-red-400" />
              <div>
                <div className="text-xs text-slate-400">Live Monitor</div>
                <div className="font-bold text-white">Streams</div>
              </div>
            </Link>
            {membership?.role === 'leader' && (
              <Link to="/squads/manage" className="rounded-xl bg-purple-600 p-4 flex items-center gap-2 text-left hover:bg-purple-500">
                <ArrowRight className="w-5 h-5 text-white" />
                <div>
                  <div className="text-xs text-purple-200">Leader Dashboard</div>
                  <div className="font-bold text-white">Manage</div>
                </div>
              </Link>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
