import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coins, Eye, Gamepad2, Plus, Radio, Shield, Sparkles, Target, Trophy, Users, Waves } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useTrocean } from '@/hooks/useTrocean'

interface GameDashboard {
  live_matches: any[]
  open_lobbies: any[]
  leaderboard: any[]
  my_stats: Record<string, any>
  totals: { active_matches: number; open_lobbies: number; spectators: number; prize_pool: number }
}

export default function GamesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { createLobby } = useTrocean(undefined, user?.id)
  const [dashboard, setDashboard] = useState<GameDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.rpc('get_trocean_games_dashboard').then(({ data, error }) => {
      if (!active) return
      if (!error) setDashboard(data as GameDashboard)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const totals = dashboard?.totals || { active_matches: 0, open_lobbies: 0, spectators: 0, prize_pool: 0 }
  const liveMatches = dashboard?.live_matches || []
  const openLobbies = dashboard?.open_lobbies || []
  const leaderboard = dashboard?.leaderboard || []
  const myStats = dashboard?.my_stats || {}

  const create = async () => {
    const name = window.prompt('Name this Trocean lobby:', 'Neon Reef Clash')?.trim()
    if (!name) return
    const result = await createLobby(name)
    navigate(`/games/trocean/lobby/${result.match_id}`)
  }

  const pulseCards = useMemo(() => [
    ['Hosts', '12 total', Users], ['Teams', '2 teams of 6', Shield], ['Attack cost', '50 TC', Target], ['Takedown reward', '100 TC', Coins], ['Match length', '15 min', Trophy],
  ] as const, [])

  return <div className="min-h-screen bg-[#030712] text-white">
    <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-6 md:px-6">
      <header className="mb-6 overflow-hidden rounded-[30px] border border-cyan-400/20 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,.16),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(217,70,239,.14),transparent_32%),#050816] p-6 shadow-[0_0_45px_rgba(34,211,238,.08)]">
        <div className="flex flex-wrap items-end justify-between gap-5"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.32em] text-cyan-300"><Gamepad2 className="h-4 w-4"/>MAI Troll Games</div><h1 className="mt-2 text-4xl font-black md:text-6xl">Play live. Think faster.</h1><p className="mt-3 max-w-2xl text-slate-300">Original multiplayer games powered by LiveKit, Troll Coins, strategy, and MAI Troll broadcasting.</p></div><button onClick={create} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-5 py-3 font-black shadow-[0_0_25px_rgba(217,70,239,.3)]"><Plus className="h-4 w-4"/>Create Trocean lobby</button></div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_.75fr]">
        <article className="relative overflow-hidden rounded-[32px] border border-cyan-400/25 bg-[linear-gradient(135deg,rgba(8,47,73,.72),rgba(3,7,18,.96)_45%,rgba(88,28,135,.35))] p-6">
          <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(34,211,238,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.05)_1px,transparent_1px)] [background-size:30px_30px]"/>
          <div className="relative"><div className="flex items-center justify-between"><span className="rounded-full border border-yellow-400/25 bg-yellow-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.25em] text-yellow-200"><Sparkles className="mr-1 inline h-3.5 w-3.5"/>Featured game</span><span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black text-emerald-200"><Radio className="mr-1 inline h-3.5 w-3.5"/>{totals.active_matches} live</span></div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]"><div><div className="text-[11px] font-black tracking-[.42em] text-cyan-300">TROCEAN</div><h2 className="mt-2 text-4xl font-black leading-tight md:text-6xl">Hidden ocean strategy, live.</h2><p className="mt-3 text-lg text-cyan-100/85">Twelve hosts. Two teams. One hidden ocean.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={create} className="rounded-full bg-cyan-300 px-5 py-3 font-black text-slate-950">Play Trocean</button><button onClick={()=>liveMatches[0]?.id && navigate(`/games/trocean/${liveMatches[0].id}`)} className="rounded-full border border-pink-400/30 bg-pink-500/10 px-5 py-3 font-black text-pink-100"><Eye className="mr-2 inline h-4 w-4"/>Spectate</button><button className="rounded-full border border-white/10 bg-white/5 px-5 py-3 font-black">How to play</button></div></div>
              <div className="rounded-[26px] border border-cyan-400/15 bg-slate-950/65 p-3"><div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-cyan-200"><Waves className="h-4 w-4"/>The Trocean</div><div className="grid grid-cols-12 gap-1">{Array.from({length:144},(_,i)=><div key={i} className={`aspect-square rounded-[4px] border ${i%17===0?'border-pink-400/40 bg-pink-500/15':i%11===0?'border-cyan-300/40 bg-cyan-500/15':'border-white/5 bg-slate-900/80'}`}/>)}</div></div></div>
            <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4"><HeroStat label="Active matches" value={totals.active_matches}/><HeroStat label="Open lobbies" value={totals.open_lobbies}/><HeroStat label="Spectators" value={totals.spectators}/><HeroStat label="Prize pool" value={`${totals.prize_pool} TC`}/></div>
          </div>
        </article>

        <aside className="rounded-[30px] border border-purple-400/20 bg-slate-950/80 p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-black">Game pulse</h3><span className="text-xs text-emerald-300">Live</span></div><div className="space-y-3">{pulseCards.map(([label,value,Icon])=><div key={label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 p-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-cyan-500/10 p-2 text-cyan-200"><Icon className="h-4 w-4"/></span><span><b className="block text-[10px] uppercase tracking-widest text-slate-500">{label}</b>{value}</span></div></div>)}</div><div className="mt-4 rounded-2xl border border-yellow-400/15 bg-yellow-500/5 p-4 text-sm text-slate-300"><b className="text-yellow-100">Core privacy:</b> exact host placements never leave secure server functions.</div></aside>
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-2"><Section title="Live Games" action="View all">{loading ? <Loading/> : liveMatches.length ? liveMatches.map((m:any)=><Row key={m.id} title={`${m.team_tide_name} vs ${m.team_storm_name}`} detail={`Round ${m.current_round} • ${m.hosts_remaining}/12 hosts remaining`} meta={`${m.spectators} watching`} onClick={()=>navigate(`/games/trocean/${m.id}`)} button="Spectate"/>) : <Empty text="No Trocean matches are live."/>}</Section><Section title="Open Lobbies" action="Create lobby" onAction={create}>{loading ? <Loading/> : openLobbies.length ? openLobbies.map((l:any)=><Row key={l.id} title={l.name} detail={`${l.joined_players}/12 joined • ${l.ready_players} ready`} meta={`${l.attack_cost} TC attack`} onClick={()=>navigate(`/games/trocean/lobby/${l.id}`)} button="Join"/>) : <Empty text="No open lobbies yet. Create the first one."/>}</Section></div>
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><Section title="My Trocean" action="History"><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{[['Current lobby',myStats.current_lobby||'None'],['Active match',myStats.active_match||'None'],['Wins',myStats.wins||0],['Takedowns',myStats.takedowns||0],['Accuracy',`${myStats.accuracy||0}%`],['Net TC',myStats.net_tc||0]].map(([l,v])=><HeroStat key={String(l)} label={String(l)} value={v}/>)}</div></Section><Section title="Leaderboards" action="See all">{leaderboard.length ? leaderboard.slice(0,5).map((p:any,i:number)=><div key={p.user_id} className="mb-2 flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 p-3"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-purple-500 font-black text-slate-950">#{i+1}</span><span><b className="block">{p.username}</b><small className="text-slate-500">{p.takedowns} takedowns</small></span></div><span className="text-right text-xs text-cyan-200">{p.wins} wins<br/>{p.accuracy}% accuracy</span></div>) : <Empty text="Leaderboard opens after completed matches."/>}</Section></div>
    </main>
  </div>
}

function HeroStat({label,value}:{label:string;value:any}){return <div className="rounded-2xl border border-white/8 bg-black/25 p-3"><div className="text-[9px] font-black uppercase tracking-[.2em] text-slate-500">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>}
function Section({title,action,onAction,children}:{title:string;action:string;onAction?:()=>void;children:React.ReactNode}){return <section className="rounded-[28px] border border-white/8 bg-slate-950/75 p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-black">{title}</h3><button onClick={onAction} className="text-xs font-black uppercase tracking-widest text-cyan-200">{action}</button></div><div className="space-y-3">{children}</div></section>}
function Row({title,detail,meta,onClick,button}:{title:string;detail:string;meta:string;onClick:()=>void;button:string}){return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 p-3"><div><b>{title}</b><div className="text-xs text-slate-500">{detail}</div></div><span className="text-xs text-cyan-200">{meta}</span><button onClick={onClick} className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-100">{button}</button></div>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">{text}</div>}
function Loading(){return <div className="p-5 text-center text-sm text-slate-500">Loading live game data…</div>}
