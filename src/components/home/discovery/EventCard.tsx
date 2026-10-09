import React from 'react'
import { Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils'

interface EventCardProps {
  event: {
    id: string
    title: string
    description?: string | null
    event_date: string
    start_time?: string | null
    type?: string
    icon?: string
    participant_count?: number
  }
  onClick?: (id: string) => void
  className?: string
}

export default function EventCard({ event, onClick, className }: EventCardProps) {
  const eventDate = new Date(event.event_date)
  const isToday = new Date().toDateString() === eventDate.toDateString()
  const isTomorrow = new Date(Date.now() + 86400000).toDateString() === eventDate.toDateString()

  let dateLabel = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (isToday) dateLabel = 'Today'
  if (isTomorrow) dateLabel = 'Tomorrow'

  return (
    <div
      onClick={() => onClick?.(event.id)}
      className={cn(
        'snap-start flex-shrink-0 w-[200px] rounded-2xl border border-white/10 bg-white/[0.04] p-3 cursor-pointer transition-all hover:border-violet-400/30 hover:bg-white/[0.07] group/card',
        isToday && 'border-violet-500/30 bg-gradient-to-b from-violet-500/[0.08] to-transparent',
        className
      )}
    >
      {/* Date badge */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          'w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0',
          isToday
            ? 'bg-gradient-to-b from-violet-500 to-purple-600'
            : 'bg-white/5 border border-white/10'
        )}>
          <span className={cn(
            'text-[9px] font-bold uppercase',
            isToday ? 'text-white/80' : 'text-slate-400'
          )}>
            {eventDate.toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className={cn(
            'text-sm font-black leading-none',
            isToday ? 'text-white' : 'text-white'
          )}>
            {eventDate.getDate()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black text-white leading-tight truncate">{event.title}</p>
          <p className="text-[9px] text-slate-400">{dateLabel}</p>
        </div>
      </div>

      {event.description && (
        <p className="text-[9px] text-slate-400 line-clamp-2 leading-tight mb-2">{event.description}</p>
      )}

      <div className="flex items-center gap-3 text-[9px] text-slate-500">
        {event.start_time && (
          <span className="flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {event.start_time}
          </span>
        )}
        {event.participant_count ? (
          <span className="flex items-center gap-0.5">
            <Users className="w-2.5 h-2.5" />
            {event.participant_count}
          </span>
        ) : null}
        {event.icon && <span className="ml-auto text-sm">{event.icon}</span>}
      </div>
    </div>
  )
}
