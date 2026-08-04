import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Coins, Crosshair, Eye, Timer } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useTrocean } from '@/hooks/useTrocean'
import { formatTroceanCountdown } from '@/lib/trocean'
import TroceanGrid from '@/components/games/trocean/TroceanGrid'
import TroceanHostGrid from '@/components/games/trocean/TroceanHostGrid'
import { TroceanActivityFeed, TroceanTeamPanel, TroceanTrumpPanel } from '@/components/games/trocean/TroceanPanels'

export default function TroceanGamePage() {
  const { matchId = '' } = useParams()
  const { user } = useAuthStore()
  const { publicState, privateState, loading, error, submitAttack } = useTrocean(matchId, user?.id)
  const [selectedTile, setSelectedTile] = useState<string | null>(null)
  const [clock, setClock] = useState('--:--')
  useEffect(() => { const id = window.setInterval(()=>setClock(formatTroceanCountdown(publicState?.match.turn_ends_at)), 500); return ()=>window.clearInterval(id) }, [publicState?.match.turn_ends_at])
  const current = useMemo(()=>publicState?.players.find(p=>p.id===publicState.match.current_turn_player_id), [publicState])

  const attack = async () => {
    if (!selectedTile) return toast.error('Choose an unexplored tile.')
    try { const result: any = await submitAttack(selectedTile); toast[result?.result === 'takedown' ? 'success' : 'info'](result?.message || `Attack result: ${result?.result}`); setSelectedTile(null) } catch (e: any) { toast.error(e.message) }
  }
  if (loading) return <div className="p-8 text-white">Entering the Trocean…</div>
  if (error || !publicState) return <div className="p-8 text-red-200">{error || 'Match unavailable.'}</div>

  return <div className="min-h-screen bg-[#020611] p-3 text-white md:p-5">
    <div className="mx-auto max-w-[1800px]">
      <header className="mb-4 rounded-[24px] border border-cyan-400/20 bg-slate-950/90 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.35em] text-cyan-300">TROCEAN</div><h1 className="text-2xl font-black">{publicState.match.name}</h1></div><div className="flex flex-wrap gap-2 text-xs"><Stat icon={Timer} label="Turn" value={clock}/><Stat icon={Crosshair} label="Current" value={current?.username || 'Waiting'}/><Stat icon={Coins} label="Attack" value={`${publicState.match.attack_cost} TC`}/><Stat icon={Eye} label="Spectators" value={String(publicState.spectators)}/></div></div></header>
      <TroceanHostGrid players={publicState.players} currentPlayerId={publicState.match.current_turn_player_id} />
      <div className="mt-4 grid gap-4 2xl:grid-cols-[280px_minmax(600px,1fr)_340px]">
        <div className="space-y-4"><TroceanTeamPanel players={publicState.players}/><TroceanTrumpPanel trump={publicState.trumps.at(-1)}/></div>
        <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-black">The Trocean</h2><span className="text-xs text-slate-400">Hidden locations remain server-only</span></div><TroceanGrid attacked={publicState.attacked_tiles} selected={selectedTile} disabled={!privateState?.is_my_turn} onSelect={setSelectedTile}/><div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/80 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs uppercase tracking-widest text-slate-500">Selected tile</div><div className="text-2xl font-black">{selectedTile || 'None'}</div></div>{privateState?.is_my_turn ? <button onClick={attack} disabled={!selectedTile} className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 px-5 py-3 font-black disabled:opacity-40">Launch attack • {publicState.match.attack_cost} TC</button> : <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/8 px-4 py-3 text-sm font-bold text-cyan-100">Waiting for {current?.username || 'next player'}</div>}</div></div></section>
        <TroceanActivityFeed attacks={publicState.attacks}/>
      </div>
    </div>
  </div>
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) { return <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><Icon className="h-4 w-4 text-cyan-200"/><span><b className="block text-[9px] uppercase tracking-widest text-slate-500">{label}</b>{value}</span></div> }
