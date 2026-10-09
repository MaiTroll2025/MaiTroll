import { useMemo } from 'react';
import { Calendar, ChevronsRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { CalendarEvent } from '@/types/calendar';
import { EVENT_CATEGORIES } from '@/types/calendar';

interface UpcomingEventsWidgetProps {
  events: CalendarEvent[]
  onViewAll?: () => void
  maxEvents?: number
  isAdmin?: boolean
}

export default function UpcomingEventsWidget({ events = [], onViewAll, maxEvents = 5, isAdmin: _isAdmin }: UpcomingEventsWidgetProps) {
  const upcomingEvents = useMemo(() => {
    const _now = new Date();
    return events
      .filter(e => e.status === 'upcoming' || e.status === 'live')
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .slice(0, maxEvents);
  }, [events, maxEvents]);

  const getTimeRemaining = (eventDate: string, startTime?: string): string => {
    const now = new Date();
    const eventTime = new Date(eventDate);
    if (startTime) {
      const [hours, minutes] = startTime.split(':');
      eventTime.setHours(parseInt(hours), parseInt(minutes));
    }

    const diff = eventTime.getTime() - now.getTime();
    if (diff < 0) return 'Now';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 7) return `${Math.floor(days / 7)}w ${days % 7}d`;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getCategoryColor = (slug: string): string => {
    const cat = EVENT_CATEGORIES.find(c => c.slug === slug);
    return cat?.color || '#8B5CF6';
  };

  const getCategoryIcon = (slug: string): string => {
    const cat = EVENT_CATEGORIES.find(c => c.slug === slug);
    return cat?.icon || '📅';
  };

  const nextEvent = upcomingEvents[0];

  return (
    <div className="space-y-3">
      {/* Next Event Highlight */}
      {nextEvent && (
        <div
          className="rounded-xl border p-3"
          style={{
            borderColor: `${getCategoryColor(nextEvent.category_slug)}30`,
            background: `linear-gradient(135deg, ${getCategoryColor(nextEvent.category_slug)}10, transparent)`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{getCategoryIcon(nextEvent.category_slug)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase text-slate-400">Next Event</p>
              <p className="truncate text-xs font-black text-white">{nextEvent.title}</p>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">
              {format(parseISO(nextEvent.event_date), 'EEE, MMM d')}
            </span>
            <span className="font-bold" style={{ color: getCategoryColor(nextEvent.category_slug) }}>
              {getTimeRemaining(nextEvent.event_date, nextEvent.start_time)}
            </span>
          </div>

          <button className="mt-3 w-full rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-2 text-xs font-black text-white transition hover:scale-[1.02]">
            Join Event
          </button>
        </div>
      )}

      {/* Upcoming Event List */}
      {upcomingEvents.length > 1 && (
        <div className="space-y-2">
          {upcomingEvents.slice(1).map(event => (
            <div
              key={event.id}
              className="group flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2 transition hover:border-white/10 hover:bg-white/[0.05]"
            >
              <span className="text-sm">{getCategoryIcon(event.category_slug)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{event.title}</p>
                <p className="text-[9px] text-slate-400">
                  {format(parseISO(event.event_date), 'MMM d')}
                  {event.start_time && ` • ${event.start_time}`}
                </p>
              </div>
              <span className="shrink-0 text-[9px] font-bold" style={{ color: getCategoryColor(event.category_slug) }}>
                {getTimeRemaining(event.event_date, event.start_time)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {upcomingEvents.length === 0 && (
        <div className="py-6 text-center">
          <Calendar className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-2 text-xs text-slate-500">No upcoming events</p>
        </div>
      )}

      {/* View All Link */}
      {onViewAll && upcomingEvents.length > 0 && (
        <button
          onClick={onViewAll}
          className="flex w-full items-center justify-center gap-1 text-[10px] font-bold text-violet-400 transition hover:text-violet-300"
        >
          View All Events
          <ChevronsRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
