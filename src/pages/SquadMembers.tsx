import React, { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { Users, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function SquadMembers() {
  const { slug } = useParams()
  const { user } = useAuthStore()
  const [squad, setSquad] = useState<any | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [membership, setMembership] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const squadRes = await supabase.from('squads').select('*').eq('slug', slug).maybeSingle()
      if (squadRes.error) throw squadRes.error
      setSquad(squadRes.data || null)
      const membersRes = await supabase
        .from('squad_memberships')
        .select('*, user_profiles(username, display_name, avatar_url)')
        .eq('squad_id', squadRes.data.id)
        .is('left_at', null)
        .order('role', { ascending: true })
      if (membersRes.error) throw membersRes.error
      setMembers(membersRes.data || [])
      if (user) {
        const meRes = await supabase.from('squad_memberships').select('*').eq('user_id', user.id).is('left_at', null).maybeSingle()
        setMembership(meRes.data || null)
      }
    } catch (e: any) {
      toast.error('Failed to load members')
      console.error(e)
    } finally { setLoading(false) }
  }, [slug, user])

  useEffect(() => { void load() }, [load])

  const isLeader = !!membership && membership.role === 'leader' && !membership.left_at
  const isMember = !!membership && membership.squad_id === squad?.id && !membership.left_at

  if (loading || !squad) {
    return <div className="min-h-screen bg-[#0A0814] text-white p-6 flex items-center justify-center"><div className="text-slate-400">Loading…</div></div>
  }

  const handleKick = async (targetUserId: string, targetName: string) => {
    if (!isLeader) return
    const reason = window.prompt(`Reason for kicking ${targetName}?`)
    if (!reason) return
    const { error } = await supabase.rpc('kick_squad_member', { p_squad_id: squad.id, p_target_user_id: targetUserId, p_reason: reason })
    if (error) { toast.error(error.message); return }
    toast.success('Member kicked')
    void load()
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-cyan-400" />
          <h1 className="text-2xl font-black">{squad.name} — Members</h1>
        </div>
        <Link to={`/squads/${slug}`} className="mb-4 inline-block text-xs text-cyan-400 underline">← Back to Squad</Link>

        <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-4">
          <p className="text-sm text-slate-300 mb-4">{members.length} active member{members.length !== 1 ? 's' : ''}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="pb-2 text-slate-400 font-bold">Member</th>
                  <th className="pb-2 text-slate-400 font-bold">Role</th>
                  <th className="pb-2 text-slate-400 font-bold">Joined</th>
                  {isLeader && <th className="pb-2 text-slate-400 font-bold">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white font-bold">{m.user_profiles?.username?.charAt(0) || '?'}</div>
                      <div>
                        <div className="font-bold text-white">{m.user_profiles?.display_name || m.user_profiles?.username}</div>
                        <div className="text-xs text-slate-500">@{m.user_profiles?.username}</div>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${m.role === 'leader' ? 'bg-yellow-900/30 text-yellow-300' : 'bg-blue-900/30 text-blue-300'}`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">{new Date(m.joined_at).toLocaleDateString()}</td>
                    {isLeader && m.role !== 'leader' && (
                      <td className="py-3">
                        <button
                          onClick={() => handleKick(m.user_id, m.user_profiles?.display_name || m.user_profiles?.username)}
                          className="text-xs text-red-400 underline hover:text-red-300"
                        >
                          Kick
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr><td colSpan={isLeader ? 4 : 3} className="py-8 text-center text-slate-500">No members yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!isMember && user && (
          <div className="mt-6">
            <AlertTriangle className="w-5 h-5 inline text-yellow-400 mr-2" />
            <span className="text-sm text-slate-300">You are not a member of this Squad. Joining costs 100 Troll Coins.</span>
          </div>
        )}
      </div>
    </div>
  )
}
