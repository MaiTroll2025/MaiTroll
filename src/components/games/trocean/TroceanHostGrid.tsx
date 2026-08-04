import { Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TroceanPlayer, TroceanTeam } from '@/lib/trocean'

export default function TroceanHostGrid({ players, currentPlayerId }: { players: TroceanPlayer[]; currentPlayerId?: string | null }) {
  const renderTeam = (team: TroceanTeam, label: string) => {
    const teamPlayers = players.filter((player) => player.team === team).sort((a, b) => a.team_slot - b.team_slot)
    return (
      <section className={cn('rounded-2xl border p-3', team === 'tide' ? 'border-cyan-400/20 bg-cyan-500/5' : 'border-pink-400/20 bg-pink-500/5')}>
        <div className="mb-3 flex items-center justify-between"><h3 className="font-black">{label}</h3><span className="text-xs text-slate-400">{teamPlayers.filter(p => !p.is_eliminated).length}/6 afloat</span></div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, index) => teamPlayers.find((p) => p.team_slot === index + 1)).map((player, index) => (
            <div key={player?.id || index} className={cn('relative aspect-video overflow-hidden rounded-xl border bg-black/80', team === 'tide' ? 'border-cyan-400/25' : 'border-pink-400/25', player?.id === currentPlayerId && 'ring-2 ring-yellow-300 shadow-[0_0_20px_rgba(250,204,21,.45)]', player?.is_eliminated && 'grayscale opacity-45')}>
              {player ? <>
                <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle,rgba(255,255,255,.08),transparent_55%)]"><span className="text-2xl font-black text-white/25">{player.username.slice(0, 1).toUpperCase()}</span></div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/75 px-2 py-1 text-[10px]"><span className="truncate font-bold">{player.username}</span><span>{player.is_connected ? <Mic className="h-3 w-3 text-emerald-300" /> : <MicOff className="h-3 w-3 text-red-300" />}</span></div>
                <div className="absolute right-1 top-1">{player.is_connected ? <Video className="h-3 w-3 text-cyan-200" /> : <VideoOff className="h-3 w-3 text-red-300" />}</div>
                {player.is_eliminated && <div className="absolute inset-0 flex items-center justify-center text-xs font-black uppercase tracking-widest text-red-200">Sunk</div>}
              </> : <div className="flex h-full items-center justify-center text-[10px] font-bold text-slate-600">Open slot</div>}
            </div>
          ))}
        </div>
      </section>
    )
  }
  return <div className="grid gap-3 xl:grid-cols-2">{renderTeam('tide', 'Team Tide')}{renderTeam('storm', 'Team Storm')}</div>
}
