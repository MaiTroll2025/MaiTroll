import type { TroceanAttack, TroceanPlayer, TroceanTrump } from '@/lib/trocean'

export function TroceanTeamPanel({ players }: { players: TroceanPlayer[] }) {
  const stat = (team: 'tide' | 'storm') => {
    const rows = players.filter(p => p.team === team)
    return { remaining: rows.filter(p => !p.is_eliminated).length, attacks: rows.reduce((n,p)=>n+p.attacks,0), takedowns: rows.reduce((n,p)=>n+p.takedowns,0), misses: rows.reduce((n,p)=>n+p.misses,0) }
  }
  const tide = stat('tide'); const storm = stat('storm')
  return <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4"><h3 className="mb-3 font-black">Team status</h3>{[['Team Tide',tide,'text-cyan-200'],['Team Storm',storm,'text-pink-200']].map(([name,s,tone]: any)=><div key={name} className="mb-3 rounded-xl border border-white/8 bg-white/5 p-3"><div className={`font-black ${tone}`}>{name}</div><div className="mt-2 grid grid-cols-4 gap-2 text-center text-[10px]"><span>{s.remaining}<b className="block text-slate-500">Afloat</b></span><span>{s.attacks}<b className="block text-slate-500">Attacks</b></span><span>{s.takedowns}<b className="block text-slate-500">Downs</b></span><span>{s.misses}<b className="block text-slate-500">Misses</b></span></div></div>)}</div>
}

export function TroceanTrumpPanel({ trump }: { trump?: TroceanTrump | null }) {
  return <div className="rounded-2xl border border-yellow-400/20 bg-[radial-gradient(circle_at_top,rgba(250,204,21,.14),transparent_55%),#050816] p-4"><div className="text-[10px] font-black uppercase tracking-[.28em] text-yellow-200">Troll Trump</div><div className="mt-3 text-lg font-black text-white">{trump?.trump_type?.replaceAll('_',' ') || 'No active Trump'}</div><p className="mt-2 text-sm text-slate-300">{trump?.safe_message || 'The Trocean is calm—for now.'}</p></div>
}

export function TroceanActivityFeed({ attacks }: { attacks: TroceanAttack[] }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4"><h3 className="mb-3 font-black">Match activity</h3><div className="max-h-64 space-y-2 overflow-auto">{attacks.slice().reverse().map(a=><div key={a.id} className="rounded-xl border border-white/5 bg-white/4 p-2 text-xs text-slate-300"><span className="font-bold text-white">{a.target_tile}</span> — <span className={a.result==='takedown'?'text-red-300':'text-cyan-200'}>{a.result.toUpperCase()}</span>{a.revealed_username ? ` • ${a.revealed_username}` : ''}</div>)}</div></div>
}
