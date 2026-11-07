import React, { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Shield, Flame } from 'lucide-react'
import { toast } from 'sonner'

export default function SquadBattles() {
  const { slug } = useParams()
  const { user } = useAuthStore()
  const [squad, setSquad] = useState<any | null>(null)
  const [battles, setBattles] = useState<any[]>([])
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
      if (user) {
        const meRes = await supabase.from('squad_memberships').select('*').eq('squad_id', squadId).eq('user_id', user.id).is('left_at', null).maybeSingle()
        setMembership(meRes.data || null)
      }
      // Squad battle records would live here; surface live battle streams as proxy activity
      const membersRes = await supabase.from('squad_memberships').select('user_id').eq('squad_id', squadId).is('left_at', null)
      if (membersRes.error) throw membersRes.error
      const memberIds = (membersRes.data || []).map(m => m.user_id)
      if (memberIds.length > 0) {
        const streamsRes = await supabase.from('streams').select('*').in('broadcaster_id', memberIds).eq('stream_type', 'battle').order('created_at', { ascending: false }).limit(50)
        if (streamsRes.error) throw streamsRes.error
        setBattles(streamsRes.data || [])
      }
    } catch (e: any) {
      toast.error('Failed to load battles')
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
          <h2 className="text-xl font-black mb-2">Squad Battles</h2>
          <p className="text-slate-400">Only active members of <b>{squad.name}</b> can view Squad battle tracking.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Flame className="w-6 h-6 text-yellow-400 mr-2" />
            <h1 className="text-2xl font-black">Squad Battles</h1>
            <p className="text-sm text-slate-400">{squad.name} — battle competition tracking</p>
          </div>
          <Link to={`/squads/${slug}`} className="text-xs text-cyan-400 underline">← Back to Squad</Link>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#10101a]/60 p-6">
          <p className="text-sm text-slate-300 mb-4">Track Squad battle participation, victories, and Squad Flame awards.</p>
          <div className="space-y-3">
            {battles.length === 0 ? (
              <p className="text-slate-400 text-center py-6">No recorded Squad battles yet.</p>
            ) : (
              battles.map((b) => (
                <div key={b.id} className="rounded-lg border border-white/10 bg-[#0b0b12]/40 p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{b.title || 'Battle'}</div>
                    <div className="text-xs text-slate-500">{new Date(b.created_at).toLocaleDateString()} • battle stream</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-yellow-400">{b.viewer_count ?? b.current_viewers ?? 0} viewers</div>
                    <div className="text-xs text-slate-400">Squad Flame eligible</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
