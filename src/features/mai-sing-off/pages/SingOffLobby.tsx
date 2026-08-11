import { useEffect, useState } from 'react'
import { Play, Users, Loader2, Trophy, Mic } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useSingOffActions } from '../hooks/useSingOffActions'
import { getActiveShows } from '../services/singoffService'
import type { SingOffJudgeApplication } from '../types'

export function SingOffLobby() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const actions = useSingOffActions()
  const [shows, setShows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [myApp, setMyApp] = useState<SingOffJudgeApplication | null>(null)

  const canStartShow = !!profile && (profile.is_ceo || profile.is_admin)

  useEffect(() => {
    setLoading(true)
    getActiveShows().then((data) => {
      setShows(data)
      setLoading(false)
    })
    if (user?.id) {
      supabase
        .from('mai_singoff_judge_applications')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => setMyApp(data as SingOffJudgeApplication | null))
    }
  }, [user?.id])

  const handleStartShow = async () => {
    const id = await actions.startShow({})
    if (id) navigate(`/mai-sing-off/live/${id}`)
  }

  return (
    <div className="h-full w-full space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Mic className="w-6 h-6 text-pink-400" /> Mai Sing Off
        </h1>
        {canStartShow && (
          <button
            onClick={handleStartShow}
            className="flex items-center gap-2 rounded-md bg-gradient-to-r from-pink-600 to-rose-600 px-4 py-2 text-sm font-bold text-white hover:brightness-110"
          >
            <Play className="w-4 h-4" /> Start a Show
          </button>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-1">
          <Users className="w-4 h-4 text-cyan-400" /> Live Stages
        </h2>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-pink-400" />
        ) : shows.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No active shows right now. {canStartShow && 'Be the first to start one!'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shows.map((show) => (
              <div key={show.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="text-sm font-bold text-white truncate">Room: {show.room_name}</div>
                <div className="text-xs text-zinc-400">
                  Started {new Date(show.started_at).toLocaleTimeString()}
                </div>
                <button
                  onClick={() => navigate(`/mai-sing-off/live/${show.id}`)}
                  className="mt-2 w-full rounded-md bg-cyan-600 py-1.5 text-xs font-bold text-white hover:bg-cyan-500"
                >
                  Join as Audience
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="text-sm font-semibold text-zinc-300 mb-1 flex items-center gap-1">
          <Trophy className="w-4 h-4 text-yellow-400" /> Your Judge Status
        </div>
        {myApp ? (
          <div className="text-sm text-zinc-300">
            You applied as a judge. Status:{' '}
            <span
              className={`font-bold ${
                myApp.status === 'approved'
                  ? 'text-emerald-400'
                  : myApp.status === 'pending'
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              {myApp.status}
            </span>
          </div>
        ) : (
          <button
            onClick={() => navigate('/mai-sing-off?view=judges')}
            className="text-xs text-cyan-300 hover:underline"
          >
            Apply to be a judge →
          </button>
        )}
      </div>
    </div>
  )
}
