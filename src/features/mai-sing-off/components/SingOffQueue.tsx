import { User, Clock, Skull, ArrowUpLeft, Users } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useSingOffStore } from '../store/useSingOffStore'
import { useSingOffActions } from '../hooks/useSingOffActions'
import { useShallow } from 'zustand/react/shallow'

export function SingOffQueue() {
  const { user } = useAuthStore()
  const store = useSingOffStore(
    useShallow((s) => ({
      queue: s.queue,
      authority: s.authority,
      session: s.session,
    })),
  )
  const actions = useSingOffActions()

  const canCall = store.authority.is_host || store.authority.is_staff
  const waiting = store.queue.filter((q) => q.status === 'waiting')

  if (!store.session) return null

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-1">
          <Users className="w-4 h-4 text-cyan-400" /> Stage Queue
        </h3>
        <span className="text-xs text-zinc-400">{waiting.length} waiting</span>
      </div>

      {waiting.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-zinc-400">
          <Clock className="w-5 h-5 mr-2" /> The queue is empty. Be the first to request a turn!
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto pr-1">
          {waiting.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-md bg-zinc-800/60 p-2">
              <div className="flex items-center gap-2">
                <img src={entry.avatar_url || '/placeholder.svg'} alt={entry.display_name} className="h-7 w-7 rounded-full" />
                <div>
                  <div className="text-sm font-medium text-white">{entry.display_name} {entry.user_id === user?.id && <span className="text-xs text-cyan-300">(you)</span>}</div>
                  <div className="text-xs text-zinc-400">Level {entry.level} · {entry.troll_coins.toLocaleString()} 🪙</div>
                </div>
              </div>
              {canCall && (
                <div className="flex gap-1">
                  <button
                    onClick={() => actions.callToStage(entry.user_id, 'challenger_a')}
                    className="rounded bg-cyan-600 px-2 py-0.5 text-[10px] font-bold text-white"
                  >
                    Call A
                  </button>
                  <button
                    onClick={() => actions.callToStage(entry.user_id, 'challenger_b')}
                    className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white"
                  >
                    Call B
                  </button>
                </div>
              )}
              {!canCall && entry.user_id === user?.id && <Skull className="w-3 h-3 text-zinc-500" />}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => actions.requestQueue()}
        disabled={!!store.queue.find((q) => q.user_id === user?.id && q.status === 'waiting')}
        className="mt-auto rounded-md bg-gradient-to-r from-pink-600 to-rose-600 py-1.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
      >
        <ArrowUpLeft className="w-3 h-3 inline mr-1 -scale-x-100" /> Request to Perform
      </button>
    </div>
  )
}
