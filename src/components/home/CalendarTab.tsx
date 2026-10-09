import { useState, useMemo, useCallback, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, MapPin, Plus, List, Grid3X3, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, addWeeks, subWeeks, isSameMonth, isSameDay, isToday, parseISO } from 'date-fns';
import type { CalendarEvent, CalendarViewType, EventCategory } from '@/types/calendar';
import { EVENT_CATEGORIES } from '@/types/calendar';
import { supabase } from '@/lib/supabase';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

interface CalendarTabProps {
  onCreateEvent?: () => void
  isAdmin?: boolean
  refreshKey?: number
}

export default function CalendarTab({ onCreateEvent, isAdmin, refreshKey }: CalendarTabProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeView, setActiveView] = useState<CalendarViewType>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [popupDate, setPopupDate] = useState<Date | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('visibility', 'public')
        .order('event_date', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Calendar fetch error:', error);
        throw error;
      }

      const mapped: CalendarEvent[] = (data || []).map((e: any) => {
        const cat = EVENT_CATEGORIES.find(c => c.slug === e.category_slug);
        return {
          ...e,
          category_name: cat?.name || e.category_slug?.replace(/_/g, ' ') || 'Event',
          category_icon: cat?.icon || '📅',
          category_color: cat?.color || e.event_color || '#8B5CF6',
          participant_count: e.participant_count || 0,
        };
      });

      setEvents(mapped);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents, refreshKey]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = useMemo(() => {
    const result: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      result.push(day);
      day = addDays(day, 1);
    }
    return result;
  }, [calendarStart, calendarEnd]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(event => {
      const key = event.event_date;
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    return map;
  }, [events]);
  const popupEvents = useMemo(() => {
    if (!popupDate) return [];
    const key = format(popupDate, 'yyyy-MM-dd');
    return eventsByDate[key] || [];
  }, [popupDate, eventsByDate]);

  const upcomingEvents = useMemo(() => {
    return events
      .filter(e => e.status === 'upcoming' || e.status === 'live')
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }, [events]);

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  }, []);

  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
  }, []);

  const getCategory = (slug: string): EventCategory | undefined => {
    return EVENT_CATEGORIES.find(c => c.slug === slug);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      upcoming: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      live: 'bg-red-500/20 text-red-300 border-red-500/30',
      completed: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
      cancelled: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      archived: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    };
    return styles[status] || styles.upcoming;
  };

  const getCategoryColor = (slug: string): string => {
    const cat = getCategory(slug);
    return cat?.color || '#8B5CF6';
  };

  const formatEventTime = (time?: string): string => {
    if (!time) return '';
    try {
      const d = new Date(time);
      if (isNaN(d.getTime())) return time;
      const h = d.getHours();
      const m = d.getMinutes().toString().padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      return `${hour}:${m} ${ampm}`;
    } catch {
      return time;
    }
  };

  const getTimeRemaining = (eventDate: string, startTime?: string): string => {
    const now = new Date();
    const eventTime = new Date(eventDate);
    if (startTime) {
      const st = new Date(startTime);
      if (!isNaN(st.getTime())) {
        eventTime.setHours(st.getHours(), st.getMinutes(), st.getSeconds());
      }
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

  const views: Array<{ id: CalendarViewType; label: string; icon: React.ElementType }> = [
    { id: 'month', label: 'Month', icon: Grid3X3 },
    { id: 'week', label: 'Week', icon: Calendar },
    { id: 'agenda', label: 'Agenda', icon: List },
    { id: 'upcoming', label: 'Upcoming', icon: Clock },
  ];

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedDateEvents = selectedDateKey ? (eventsByDate[selectedDateKey] || []) : [];

  const handleDayClick = (day: Date, e: React.MouseEvent<HTMLButtonElement>) => {
    const key = format(day, 'yyyy-MM-dd');
    const dayEvents = eventsByDate[key] || [];
    if (dayEvents.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopupDate(day);
      setPopupPosition({
        x: Math.min(rect.left, window.innerWidth - 320),
        y: Math.min(rect.bottom + 4, window.innerHeight - 300),
      });
    } else if (isAdmin && onCreateEvent) {
      onCreateEvent();
    }
  };

  const handleClosePopup = () => {
    setPopupDate(null);
    setPopupPosition(null);
  };

  return (
    <div className="space-y-4">
      <section className={`${glass} rounded-2xl p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-[0_0_24px_rgba(139,92,246,0.3)]">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Calendar</h2>
              <p className="text-xs text-slate-400">Events & Activities</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={onCreateEvent}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-2 text-xs font-black text-white shadow-[0_0_20px_rgba(139,92,246,0.25)] transition hover:scale-[1.02]"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Event
            </button>
          )}
        </div>
      </section>

      <section className={`${glass} rounded-2xl p-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {views.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  activeView === id
                    ? 'bg-gradient-to-r from-violet-500/30 to-purple-500/30 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => activeView === 'month' ? navigateMonth('prev') : navigateWeek('prev')}
              className="rounded-lg border border-white/10 bg-white/[0.05] p-2 text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[140px] text-center text-sm font-bold text-white">
              {activeView === 'month'
                ? format(currentDate, 'MMMM yyyy')
                : `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`
              }
            </span>
            <button
              onClick={() => activeView === 'month' ? navigateMonth('next') : navigateWeek('next')}
              className="rounded-lg border border-white/10 bg-white/[0.05] p-2 text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-300 transition hover:bg-violet-500/20"
            >
              Today
            </button>
          </div>
        </div>
      </section>

      {loading && (
        <section className={`${glass} rounded-2xl p-8`}>
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-transparent" />
          </div>
        </section>
      )}

      {!loading && activeView === 'month' && (
        <section className={`${glass} rounded-2xl p-4`}>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-2 text-center text-xs font-black uppercase tracking-wider text-slate-500">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const today = isToday(day);

              return (
                <button
                  key={idx}
                  onClick={(e) => handleDayClick(day, e)}
                  className={`group relative min-h-[80px] rounded-lg border p-1 text-left transition ${
                    isSelected
                      ? 'border-violet-400/50 bg-violet-500/10'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]'
                  } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  <span className={`text-xs font-bold ${today ? 'text-violet-300' : 'text-slate-400'}`}>
                    {format(day, 'd')}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 3).map((event, eIdx) => (
                        <div
                          key={eIdx}
                          className="truncate rounded px-1 py-0.5 text-[9px] font-bold"
                          style={{
                            backgroundColor: `${getCategoryColor(event.category_slug)}20`,
                            color: getCategoryColor(event.category_slug),
                            borderLeft: `2px solid ${getCategoryColor(event.category_slug)}`,
                          }}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="px-1 text-[8px] font-bold text-slate-500">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!loading && activeView === 'week' && (
        <section className={`${glass} rounded-2xl p-4`}>
          <div className="grid grid-cols-7 gap-2">
            {days.slice(0, 7).map((day, idx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[dateKey] || [];
              const today = isToday(day);

              return (
                <div key={idx} className="min-w-0">
                  <div className={`mb-2 rounded-lg border p-2 text-center ${
                    today ? 'border-violet-400/30 bg-violet-500/10' : 'border-white/5 bg-white/[0.02]'
                  }`}>
                    <p className="text-[10px] font-bold uppercase text-slate-500">{format(day, 'EEE')}</p>
                    <p className={`text-lg font-black ${today ? 'text-violet-300' : 'text-white'}`}>{format(day, 'd')}</p>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.map((event, eIdx) => (
                      <button
                        key={eIdx}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setPopupDate(day);
                          setPopupPosition({ x: Math.min(rect.left, window.innerWidth - 320), y: Math.min(rect.bottom + 4, window.innerHeight - 300) });
                        }}
                        className="w-full rounded-lg border p-2 text-left transition hover:scale-[1.01]"
                        style={{
                          borderColor: `${getCategoryColor(event.category_slug)}30`,
                          backgroundColor: `${getCategoryColor(event.category_slug)}08`,
                        }}
                      >
                        <p className="truncate text-[10px] font-bold text-white">{event.title}</p>
                        <div className="mt-0.5 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5 text-slate-500" />
                          <span className="text-[9px] text-slate-400">{formatEventTime(event.start_time)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!loading && activeView === 'agenda' && (
        <section className={`${glass} rounded-2xl p-4`}>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
            <List className="h-4 w-4 text-violet-400" />
            Event Agenda
          </h3>
          {upcomingEvents.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-3 text-sm font-bold text-slate-400">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map(event => (
                <AgendaEventCard key={event.id} event={event} getCategoryColor={getCategoryColor} formatEventTime={formatEventTime} getStatusBadge={getStatusBadge} />
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && activeView === 'upcoming' && (
        <section className={`${glass} rounded-2xl p-4`}>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
            <Clock className="h-4 w-4 text-cyan-400" />
            Upcoming Events
          </h3>
          {upcomingEvents.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-3 text-sm font-bold text-slate-400">No upcoming events</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map(event => (
                <UpcomingEventCard key={event.id} event={event} getCategoryColor={getCategoryColor} getTimeRemaining={getTimeRemaining} getStatusBadge={getStatusBadge} />
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && selectedDate && selectedDateEvents.length > 0 && activeView === 'month' && (
        <section className={`${glass} rounded-2xl p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-black text-white">
              <Calendar className="h-4 w-4 text-violet-400" />
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            <button onClick={() => setSelectedDate(null)} className="text-xs text-slate-400 hover:text-white">Close</button>
          </div>
          <div className="space-y-2">
            {selectedDateEvents.map((event, idx) => (
              <DayPopupEventCard key={idx} event={event} getCategoryColor={getCategoryColor} formatEventTime={formatEventTime} getStatusBadge={getStatusBadge} />
            ))}
          </div>
        </section>
      )}

      {!loading && popupDate && popupEvents.length > 0 && popupPosition && (
        <div
          className="fixed z-[200] w-80 rounded-xl border border-white/10 bg-[#0a0e1a]/95 p-4 shadow-2xl backdrop-blur-xl"
          style={{ left: popupPosition.x, top: popupPosition.y }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-black text-white">
              <Calendar className="h-3.5 w-3.5 text-violet-400" />
              {format(popupDate, 'MMM d, yyyy')}
              <span className="text-[9px] text-slate-500">({popupEvents.length})</span>
            </h3>
            <button onClick={handleClosePopup} className="rounded p-1 text-slate-400 transition hover:bg-white/10 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {popupEvents.map((event, idx) => (
              <div
                key={idx}
                className="cursor-pointer rounded-lg border p-2.5 transition hover:scale-[1.01]"
                style={{
                  borderColor: `${getCategoryColor(event.category_slug)}30`,
                  background: `linear-gradient(135deg, ${getCategoryColor(event.category_slug)}08, transparent)`,
                }}
                onClick={() => {
                  window.location.href = `/events/${event.id}`;
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{event.category_icon}</span>
                      <h4 className="truncate text-xs font-black text-white">{event.title}</h4>
                    </div>
                    <p className="mt-0.5 text-[9px] text-slate-400">{event.creator_username}</p>
                    <div className="mt-1 flex items-center gap-2 text-[9px] text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formatEventTime(event.start_time)}
                        {event.end_time && ` - ${formatEventTime(event.end_time)}`}
                      </span>
                      {event.max_participants !== undefined && event.max_participants !== null && (
                        <span className="flex items-center gap-0.5">
                          <Users className="h-2.5 w-2.5" />
                          {event.participant_count || 0}/{event.max_participants}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${getStatusBadge(event.status)}`}>
                    {event.status === 'live' ? '● LIVE' : event.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[9px] text-slate-500">Click an event to view details</p>
        </div>
      )}

      {!loading && popupDate && popupEvents.length > 0 && popupPosition && (
        <div className="fixed inset-0 z-[190]" onClick={handleClosePopup} />
      )}
    </div>
  );

  function AgendaEventCard({
    event, getCategoryColor, formatEventTime, getStatusBadge,
  }: {
    event: CalendarEvent;
    getCategoryColor: (slug: string) => string;
    formatEventTime: (time?: string) => string;
    getStatusBadge: (status: string) => string;
  }) {
    return (
      <div
        className="cursor-pointer rounded-xl border p-3 transition hover:scale-[1.01]"
        style={{
          borderColor: `${getCategoryColor(event.category_slug)}30`,
          background: `linear-gradient(135deg, ${getCategoryColor(event.category_slug)}08, transparent)`,
        }}
        onClick={() => window.location.href = `/events/${event.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-sm font-black text-white">{event.title}</h4>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${getStatusBadge(event.status)}`}>
                {event.status === 'live' ? '● LIVE' : event.status.toUpperCase()}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{event.creator_username}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(event.event_date), 'MMM d')}</span>
              {event.start_time && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatEventTime(event.start_time)}
                  {event.end_time && ` - ${formatEventTime(event.end_time)}`}
                </span>
              )}
              {event.max_participants !== undefined && event.max_participants !== null && (
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{event.participant_count || 0}/{event.max_participants}</span>
              )}
            </div>
            {event.description && <p className="mt-2 line-clamp-2 text-xs text-slate-300">{event.description}</p>}
          </div>
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg sm:flex" style={{ backgroundColor: `${getCategoryColor(event.category_slug)}15` }}>
            <span className="text-xl">{event.category_icon || '📅'}</span>
          </div>
        </div>
      </div>
    );
  }

  function UpcomingEventCard({
    event, getCategoryColor, getTimeRemaining, getStatusBadge,
  }: {
    event: CalendarEvent;
    getCategoryColor: (slug: string) => string;
    getTimeRemaining: (date: string, time?: string) => string;
    getStatusBadge: (status: string) => string;
  }) {
    return (
      <div
        className="cursor-pointer rounded-xl border p-3 transition hover:scale-[1.02]"
        style={{
          borderColor: `${getCategoryColor(event.category_slug)}30`,
          background: `linear-gradient(135deg, ${getCategoryColor(event.category_slug)}08, transparent)`,
        }}
        onClick={() => window.location.href = `/events/${event.id}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xl">{event.category_icon || '📅'}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${getStatusBadge(event.status)}`}>
            {event.status === 'live' ? '● LIVE' : event.status.toUpperCase()}
          </span>
        </div>
        <h4 className="mt-2 truncate text-sm font-black text-white">{event.title}</h4>
        <p className="mt-0.5 text-[10px] text-slate-400">{event.creator_username}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-300">
            {format(parseISO(event.event_date), 'MMM d')}
            {event.start_time && ` • ${formatEventTime(event.start_time)}`}
          </span>
          <span className="text-xs font-bold" style={{ color: getCategoryColor(event.category_slug) }}>
            {getTimeRemaining(event.event_date, event.start_time)}
          </span>
        </div>
        {event.max_participants !== undefined && event.max_participants !== null && (
          <div className="mt-2">
            <div className="h-1.5 w-full rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, ((event.participant_count || 0) / event.max_participants) * 100)}%`,
                  backgroundColor: getCategoryColor(event.category_slug),
                }}
              />
            </div>
            <p className="mt-0.5 text-[9px] text-slate-500">{event.participant_count || 0}/{event.max_participants} spots</p>
          </div>
        )}
      </div>
    );
  }

  function DayPopupEventCard({
    event, getCategoryColor, formatEventTime, getStatusBadge,
  }: {
    event: CalendarEvent;
    getCategoryColor: (slug: string) => string;
    formatEventTime: (time?: string) => string;
    getStatusBadge: (status: string) => string;
  }) {
    return (
      <div
        className="cursor-pointer rounded-xl border p-3 transition hover:scale-[1.01]"
        style={{
          borderColor: `${getCategoryColor(event.category_slug)}30`,
          background: `linear-gradient(135deg, ${getCategoryColor(event.category_slug)}08, transparent)`,
        }}
        onClick={() => window.location.href = `/events/${event.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm">{event.category_icon || '📅'}</span>
              <h4 className="truncate text-sm font-black text-white">{event.title}</h4>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">{event.creator_username}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatEventTime(event.start_time)}
                {event.end_time && ` - ${formatEventTime(event.end_time)}`}
              </span>
              {event.max_participants !== undefined && event.max_participants !== null && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {event.participant_count || 0}/{event.max_participants}
                </span>
              )}
              {event.location_type !== 'virtual' && event.location_details && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location_type}</span>
              )}
            </div>
            {event.description && <p className="mt-1.5 line-clamp-2 text-xs text-slate-300">{event.description}</p>}
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${getStatusBadge(event.status)}`}>
            {event.status === 'live' ? '● LIVE' : event.status.toUpperCase()}
          </span>
        </div>
      </div>
    );
  }
}
