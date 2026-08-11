import { useEffect, useState } from 'react'
import { Trophy, Clock, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ChampionshipView() {
  return (
    <div className="h-full w-full space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Trophy className="w-6 h-6 text-yellow-400" /> Mai Sing Off Championships
      </h1>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-center">
        <Clock className="w-6 h-6 mx-auto text-zinc-500 mb-2" />
        <p className="text-sm text-zinc-300">Championship seasons are scheduled by staff.</p>
        <p className="text-xs text-zinc-500 mt-1">Season leaders and brackets will appear here once a championship is live.</p>
      </div>

      <RecentWinners />
    </div>
  )
}

function RecentWinners() {
  const [winners, setWinners] = useState<any[]>([])

  useEffect(() => {
    supabase
      .from('mai_singoff_rounds')
      .select('round_number, winner_id, created_at')
      .not('winner_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => setWinners((data as any[]) ?? []))
  }, [])

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-1">
        <Users className="w-4 h-4 text-yellow-400" /> Recent winners
      </h2>
      {winners.length === 0 ? (
        <p className="text-xs text-zinc-500">No winners yet.</p>
      ) : (
        <ul className="text-xs text-zinc-300 space-y-1">
          {winners.map((w) => (
            <li key={w.round_number} className="flex justify-between">
              <span>Round {w.round_number}</span>
              <span>• {w.winner_id.slice(0, 8)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
