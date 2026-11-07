import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Users, Crown, Trophy, Play, Shield } from 'lucide-react'
import { toast } from 'sonner'

export default function SquadManage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [squad, setSquad] = useState<any | null>(null)
  const [membership, setMembership] = useState<any | null>(null)
  const [stats, setStats] = useState<any>({})
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // Find squad led by this user
      const meRes = await supabase.from('squad_memberships').select('*, squads(*)').eq('user_id', user.id).eq('role', 'leader').is('left_at', null).maybeSingle()
      if (meRes.error) throw meRes.error
      if (!meRes.data || !meRes.data.squads) {
        setLoading(false)
        return
      }
      setMembership(meRes.data)
      setSquad(meRes.data.squads)

      const membersRes = await supabase
        .from('squad_memberships')
        .select('*, user_profiles(username, display_name, avatar_url)')
        .eq('squad_id', meRes.data.squads.id)
        .is('left_at', null)
        .order('role', { ascending: true })
      if (membersRes.error) throw membersRes.error
      setMembers(membersRes.data || [])

      // Aggregate stats
      setStats({
        totalMembers: membersRes.data?.length || 0,
        leaders: 1,
      })
    } catch (e: any) {
      console.error('SquadManage load', e)
      if (!e.message?.includes('not an active member') && !e.message?.includes('JWT')) {
        toast.error('Failed to load squad dashboard')
      }
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { void load() }, [load])

  if (!user) return null
  if (loading) {
    return <div className="min-h-screen bg-[#0A0814] text-white p-6 flex items-center justify-center"><div className="text-slate-400">Loading dashboard…</div></div>
  }
  if (!squad) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6 flex flex-col items-center justify-center">
        <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-8 text-center">
          <Crown className="w-10 h-10 text-slate-600 mb-3" />
          <h2 className="text-xl font-black mb-2">Leader Dashboard</h2>
          <p className="text-slate-400">You are not currently leading a Squad.</p>
          <div className="mt-6">
            <button onClick={() => navigate('/squads/create')} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 font-bold text-white">Create a Squad</button>
          </div>
        </div>
      </div>
    )
  }

  const isLeader = membership?.role === 'leader' && !membership.left_at

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">Squad Leader Dashboard</h1>
            <p className="text-sm text-slate-400">{squad.name} <span className="text-cyan-400 font-mono">@{squad.tag}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/squads/${squad.slug}`} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/5">View Squad</Link>
            <Link to="/squads/manage/live" className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/5">Live Monitor</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-4">
            <p className="text-xs text-slate-400">Total Members</p>
            <div className="text-2xl font-black text-white">{stats.totalMembers}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-4">
            <p className="text-xs text-slate-400">Your Squad Cash</p>
            <div className="text-2xl font-black text-cyan-300">— weekly settlement</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-4">
            <p className="text-xs text-slate-400">Squad Flame</p>
            <div className="text-2xl font-black text-yellow-400">Competitive points</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-4">
            <p className="text-xs text-slate-400">Weekly Payouts</p>
            <div className="text-2xl font-black text-emerald-400">On schedule</div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-6 mb-6">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4">Roster</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="pb-3 text-slate-400 font-bold">Member</th>
                  <th className="pb-3 text-slate-400 font-bold">Role</th>
                  <th className="pb-3 text-slate-400 font-bold">Joined</th>
                  <th className="pb-3 text-slate-400 font-bold">Squad Cash</th>
                  <th className="pb-3 text-slate-400 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id} className="border-b border-white/5">
                    <td className="py-3 flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white font-bold">{m.user_profiles?.username?.charAt(0) || '?'}</div>
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate w-32">{m.user_profiles?.display_name || m.user_profiles?.username}</div>
                        <div className="text-xs text-slate-500">@{m.user_profiles?.username}</div>
                      </div>
                    </td>
                    <td className="py-3"><span className={`px-2 py-0.5 rounded text-xs font-bold ${m.role === 'leader' ? 'bg-yellow-900/30 text-yellow-300' : 'bg-blue-900/30 text-blue-300'}`}>{m.role}</span></td>
                    <td className="py-3 text-slate-400">{new Date(m.joined_at).toLocaleDateString()}</td>
                    <td className="py-3 text-slate-400">Weekly settlement</td>
                    <td className="py-3">
                      {isLeader && m.role !== 'leader' && (
                        <button onClick={() => navigate(`/squads/${squad.slug}/members`)} className="text-xs text-cyan-400 underline">Manage</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-6">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link to="/squads/manage/live" className="block rounded-xl border border-white/10 bg-[#10101a]/40 p-3 text-left hover:bg-white/5"><Play className="w-4 h-4 mr-2 text-red-400" /> Live Stream Monitor</Link>
              <Link to={`/squads/${squad.slug}/chat`} className="block rounded-xl border border-white/10 bg-[#10101a]/40 p-3 text-left hover:bg-white/5"><Shield className="w-4 h-4 mr-2 text-cyan-400" /> Squad Chat</Link>
              <Link to={`/squads/${squad.slug}/members`} className="block rounded-xl border border-white/10 bg-[#10101a]/40 p-3 text-left hover:bg-white/5"><Users className="w-4 h-4 mr-2" /> Roster &amp; Recruitment</Link>
              <Link to={`/squads/${squad.slug}/battles`} className="block rounded-xl border border-white/10 bg-[#10101a]/40 p-3 text-left hover:bg-white/5"><Trophy className="w-4 h-4 mr-2 text-yellow-400" /> Battles</Link>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-6">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4">Financial Notes</h2>
            <p className="text-xs text-slate-400 mb-3">Squad Cash is paid out weekly, not daily. Members keep their weekly payout hold after leaving or being kicked.</p>
            <p className="text-xs text-slate-400 mb-3">Each member controls whether their Squad Cash is visible to fellow Squad members in Profile Settings → Cash Balance Privacy.</p>
            <p className="text-xs text-slate-400">Leader dashboard shows aggregate metrics only — individual hidden balances are never disclosed.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
