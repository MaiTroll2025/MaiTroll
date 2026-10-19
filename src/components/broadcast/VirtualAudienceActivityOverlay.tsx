import { useEffect, useState } from 'react'
import { Gift, Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type VirtualAudienceActivity = {
  stream_id?: string
  event_id?: string
  activity?: 'virtual_like' | 'virtual_gift'
  username?: string
  label?: string
  message?: string
}

type VisibleActivity = VirtualAudienceActivity & { key: string }

type Props = {
  streamId: string
}

export default function VirtualAudienceActivityOverlay({ streamId }: Props) {
  const [activities, setActivities] = useState<VisibleActivity[]>([])

  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`virtual-audience:${streamId}`)
      .on('broadcast', { event: 'virtual_audience_activity' }, ({ payload }) => {
        const activity = payload as VirtualAudienceActivity
        if (
          activity.stream_id !== streamId ||
          (activity.activity !== 'virtual_like' && activity.activity !== 'virtual_gift')
        ) {
          return
        }

        const key = activity.event_id || `${Date.now()}-${Math.random()}`
        setActivities((current) => [...current, { ...activity, key }].slice(-3))
        window.setTimeout(() => {
          setActivities((current) => current.filter((item) => item.key !== key))
        }, 5000)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [streamId])

  if (activities.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-[260] flex flex-col items-center gap-2 px-4">
      {activities.map((activity) => (
        <div
          key={activity.key}
          role="status"
          className="flex max-w-full items-center gap-3 rounded-xl border border-amber-300/60 bg-black/90 px-4 py-3 text-white shadow-xl"
        >
          {activity.activity === 'virtual_like' ? (
            <Heart className="h-5 w-5 shrink-0 fill-pink-500 text-pink-400" aria-hidden="true" />
          ) : (
            <Gift className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <div className="text-xs font-black tracking-wider text-amber-300">
              {activity.label || 'VIRTUAL AUDIENCE DEMO'}
            </div>
            <div className="truncate text-sm">{activity.message || activity.username}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
