import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Lock, Radio, Shield, Users } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useTrocean } from '@/hooks/useTrocean'
import TroceanGrid from '@/components/games/trocean/TroceanGrid'

export default function TroceanLobbyPage() {
  const { matchId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { publicState, privateState, loading, error, joinTeam, chooseLocation, setReady } = useTrocean(matchId, user?.id)
  const [selectedTile, setSelectedTile] = useState<string | null>(privateState?.own_tile || null)
  const me = useMemo(() => publicState?.players.find(p => p.user_id === user?.id), [publicState?.players, user?.id])

  const lockPlacement = async () => {
    if (!selectedTile) return toast.error('Choose a private Trocean tile first.')
    try { await chooseLocation(selectedTile); toast.success('Hidden placement locked.') } catch (e: any) { toast.error(e.message) }
  }

  if (loading) return <div className="p-8 text-white">Loading Trocean lobby…</div>
  if (error || !publicState) return <div className="p-8 text-red-200">{error || 'Lobby not found.'}</div>

  return <div className="min-h-screen bg-[#030712] p-4 text-white md:p-6">
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 rounded-[28px] border border-cyan-400/20 bg-slate-950/85 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[.3em] text-cyan-300">Trocean lobby</div><h1 className="mt-1 text-3xl font-black">{publicState.match.name}</h1><p className="text-sm text-slate-400">Twelve hosts. Two teams. One hidden ocean.</p></div><div className="flex gap-2 text-xs"><span className="rounded-full border border-white/10 px-3 py-2"><Users className="mr-1 inline h-4 w-4" />{publicState.players.length}/12</span><span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-emerald-200"><Radio className="mr-1 inline h-4 w-4" />{publicState.match.status}</span></div></div></header>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
        <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-black">Private placement</h2><span className="text-xs text-slate-400"><Lock className="mr-1 inline h-3.5 w-3.5" />Only you can see your selection</span></div><TroceanGrid attacked={[]} selected={selectedTile} ownTile={privateState?.own_tile} placementMode disabled={Boolean(privateState?.location_locked)} onSelect={setSelectedTile} /></section>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4"><h3 className="font-black">Choose a team</h3><div className="mt-3 grid gap-2"><button onClick={()=>joinTeam('tide')} className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-3 font-black text-cyan-100">Join Team Tide</button><button onClick={()=>joinTeam('storm')} className="rounded-xl border border-pink-400/25 bg-pink-500/10 p-3 font-black text-pink-100">Join Team Storm</button></div><p className="mt-3 text-xs text-slate-400">Current team: {me?.team || 'None'}</p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4"><h3 className="font-black">Ready checklist</h3><div className="mt-3 space-y-2 text-sm text-slate-300"><p>✓ Join one team</p><p>✓ Connect camera and microphone</p><p>{privateState?.location_locked ? '✓' : '○'} Lock hidden placement</p><p>{me?.is_ready ? '✓' : '○'} Mark ready</p></div></div>
          {!privateState?.location_locked ? <button onClick={lockPlacement} className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 px-4 py-3 font-black text-slate-950">Lock hidden placement</button> : <button onClick={()=>setReady(!me?.is_ready)} className="w-full rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 font-black text-slate-950">{me?.is_ready ? 'Not ready' : 'I am ready'}</button>}
          {publicState.match.status === 'active' && <button onClick={()=>navigate(`/games/trocean/${matchId}`)} className="w-full rounded-xl border border-yellow-300/30 bg-yellow-500/10 px-4 py-3 font-black text-yellow-100">Enter Trocean</button>}
          <div className="rounded-2xl border border-purple-400/20 bg-purple-500/8 p-4 text-sm text-slate-300"><Shield className="mb-2 h-5 w-5 text-purple-200" />Teammates, opponents, and viewers never receive your exact location.</div>
        </aside>
      </div>
    </div>
  </div>
}
