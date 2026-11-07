import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Plus,
  Grid3X3, X, Share2, Download, Globe, Edit3,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, subMonths, addMonths, isSameMonth, isSameDay, isToday } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import {
  isCalendarStaff,
  isCalendarAdmin,
  fetchPublicEvents,
  fetchStaffEvents,
  cancelCalendarEvent,
  googleCalendarUrl,
  appleCalendarUrl,
  downloadICS,
  formatUtcInZone,
  detectTimeZone,
  utcToLocalInput,
  statusLabel,
  MAI_CALENDAR_EVENT_PATH,
  MAI_OFFICIAL_EVENT_PATH,
  type MaiCalendarEvent,
} from '@/lib/maiCalendar';
import EventForm from '@/components/maiCalendar/EventForm';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function MaiCalendarPage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const staff = isCalendarStaff(profile);
  const [events, setEvents] = useState<MaiCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'month' | 'week' | 'upcoming'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [openEvent, setOpenEvent] = useState<MaiCalendarEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MaiCalendarEvent | null>(null);
  const [newEventDate, setNewEventDate] = useState<string | undefined>();
  const [newEventIsOfficial, setNewEventIsOfficial] = useState(false);
  const [displayTimeZone, setDisplayTimeZone] = useState(detectTimeZone());

  useEffect(() => {
    (staff ? fetchStaffEvents() : fetchPublicEvents())
      .then(setEvents)
      .catch((err) => {
        console.error('Calendar fetch error:', err);
        toast.error('Failed to load events');
      })
      .finally(() => setLoading(false));
  }, [staff]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

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
    const map: Record<string, MaiCalendarEvent[]> = {};
    events.forEach((e) => {
      const key = utcToLocalInput(e.starts_at, displayTimeZone).date;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events, displayTimeZone]);

  const upcomingEvents = useMemo(() => {
    return events
      .filter((e) => e.status === 'upcoming' || e.status === 'live')
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
  }, [events]);

  const displayEventTime = useCallback(
    (e: MaiCalendarEvent) => {
      const { localISO, abbreviated, offset } = formatUtcInZone(
        e.starts_at,
        displayTimeZone,
      );
      return { localISO, abbreviated, offset };
    },
    [displayTimeZone],
  );

  const handleDayClick = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd');
    const dayEvents = eventsByDate[key] || [];
    if (dayEvents.length > 0) {
      setSelectedDate(day);
    } else if (staff) {
      setEditingEvent(null);
      setNewEventDate(key);
      setNewEventIsOfficial(false);
      setShowForm(true);
    }
  };

  const handleCreate = (official = false) => {
    setEditingEvent(null);
    setNewEventDate(undefined);
    setNewEventIsOfficial(official);
    setShowForm(true);
  };

  const handleEdit = (e: MaiCalendarEvent) => {
    setNewEventDate(undefined);
    setNewEventIsOfficial(false);
    setEditingEvent(e);
    setShowForm(true);
  };

  const handleRefresh = () => {
    (staff ? fetchStaffEvents() : fetchPublicEvents())
      .then(setEvents)
      .finally(() => setLoading(false));
  };

  const views = [
    { id: 'month' as const, label: 'Month', icon: Grid3X3 },
    { id: 'week' as const, label: 'Week', icon: Calendar },
    { id: 'upcoming' as const, label: 'Upcoming', icon: Clock },
  ];

  return (
    <div className="space-y-4">
      {/* Header + Post to Calendar button */}
      <section className={`${glass} rounded-2xl p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-[0_0_24px_rgba(139,92,246,0.3)]">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">MaiTroll Calendar</h2>
              <p className="text-xs text-slate-400">Public events &amp; live streams</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/events"
              className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/10"
            >
              Official Events
            </a>
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

          {staff && (
            <button
              onClick={() => handleCreate(false)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-2 text-xs font-black text-white shadow-[0_0_20px_rgba(139,92,246,0.25)] transition hover:scale-[1.02]"
            >
              <Plus className="h-3.5 w-3.5" />
              Post to Calendar
            </button>
          )}
          {isCalendarAdmin(profile) && (
            <button
              onClick={() => handleCreate(true)}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-200 transition hover:bg-cyan-500/20"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Official Event
            </button>
          )}
        </div>
      </section>

      {/* Time-zone selector */}
      <section className={`${glass} rounded-2xl p-3`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">
              Displaying times in {displayTimeZone}
            </span>
          </div>
          <select
            value={displayTimeZone}
            onChange={(e) => setDisplayTimeZone(e.target.value)}
            className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs font-bold text-white [color-scheme:dark] focus:border-cyan-400 focus:outline-none"
          >
            {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'].map((tz) => (
              <option key={tz} value={tz} className="bg-slate-950 text-white">{tz}</option>
            ))}
          </select>
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="rounded-lg border border-white/10 bg-white/[0.05] p-2 text-slate-300 hover:bg-white/[0.1] hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[150px] text-center text-sm font-bold text-white">
                {format(currentDate, 'MMMM yyyy')}
              </span>
              <button
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="rounded-lg border border-white/10 bg-white/[0.05] p-2 text-slate-300 hover:bg-white/[0.1] hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-300 transition hover:bg-violet-500/20"
            >
              Today
            </button>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
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
                  onClick={() => handleDayClick(day)}
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
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className="truncate rounded px-1 py-0.5 text-[9px] font-bold"
                          style={{
                            backgroundColor: '#8B5CF620',
                            color: '#8B5CF6',
                            borderLeft: '2px solid #8B5CF6',
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
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => setOpenEvent(event)}
                        className="w-full rounded-lg border p-2 text-left transition hover:scale-[1.01]"
                        style={{
                          borderColor: '#8B5CF630',
                          backgroundColor: '#8B5CF608',
                        }}
                      >
                        <p className="truncate text-[10px] font-bold text-white">{event.title}</p>
                        <div className="mt-0.5 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5 text-slate-500" />
                          <span className="text-[9px] text-slate-400">
                            {displayEventTime(event).localISO}
                          </span>
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
              {upcomingEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  displayEventTime={displayEventTime}
                  onOpen={() => setOpenEvent(event)}
                  onEdit={handleEdit}
                  staff={staff}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && selectedDate && (
        <section className={`${glass} rounded-2xl p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-black text-white">
              <Calendar className="h-4 w-4 text-violet-400" />
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            <button onClick={() => setSelectedDate(null)} className="text-xs text-slate-400 hover:text-white">
              Close
            </button>
          </div>
          <div className="space-y-2">
            {(eventsByDate[format(selectedDate, 'yyyy-MM-dd')] || []).map((event) => (
              <div
                key={event.id}
                className="cursor-pointer rounded-xl border p-3 transition hover:scale-[1.01]"
                onClick={() => setOpenEvent(event)}
                style={{
                  borderColor: '#8B5CF630',
                  background: 'linear-gradient(135deg, #8B5CF608, transparent)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📅</span>
                      <h4 className="truncate text-sm font-black text-white">{event.title}</h4>
                      <span className={`ml-2 shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${event.status === 'live' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                        {event.status === 'live' ? '● LIVE' : 'Upcoming'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {displayEventTime(event).localISO}
                        {displayEventTime(event).abbreviated && ` ${displayEventTime(event).abbreviated}`}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                    {event.description && <p className="mt-1.5 line-clamp-2 text-xs text-slate-300">{event.description}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Event detail modal */}
      {openEvent && (
        <EventDetailModal
          event={openEvent}
          onClose={() => setOpenEvent(null)}
          onEdit={handleEdit}
          onRefresh={handleRefresh}
          staff={staff}
          admin={isCalendarAdmin(profile)}
          displayEventTime={displayEventTime}
        />
      )}

      {/* Create/edit form */}
      {showForm && (
        <EventForm event={editingEvent} initialDate={newEventDate} isOfficial={newEventIsOfficial} onClose={() => setShowForm(false)} onSuccess={handleRefresh} />
      )}
    </div>
  );
}

interface EventCardProps {
  event: MaiCalendarEvent;
  displayEventTime: (e: MaiCalendarEvent) => { localISO: string; abbreviated: string; offset: string };
  onOpen: () => void;
  onEdit: (e: MaiCalendarEvent) => void;
  staff: boolean;
}

function EventCard({ event, displayEventTime, onOpen, onEdit, staff }: EventCardProps) {
  const { localISO, abbreviated } = displayEventTime(event);
  return (
    <div
      className="cursor-pointer rounded-xl border p-3 transition hover:scale-[1.02]"
      onClick={onOpen}
      style={{
        borderColor: '#8B5CF630',
        background: 'linear-gradient(135deg, #8B5CF608, transparent)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm">📅</span>
            <h4 className="truncate text-sm font-black text-white">{event.title}</h4>
            {event.is_official && (
              <span className="shrink-0 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold text-cyan-200">OFFICIAL</span>
            )}
            <span className={`ml-2 shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${event.status === 'live' ? 'bg-red-500/20 text-red-300 border-red-500/30' : event.status === 'canceled' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
              {event.status === 'live' ? '● LIVE' : event.status === 'canceled' ? 'Canceled' : 'Upcoming'}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400">{event.category?.replace(/_/g, ' ') || 'Event'}</p>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {localISO} {abbreviated}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.location}
              </span>
            )}
          </div>
          {event.description && <p className="mt-2 line-clamp-2 text-xs text-slate-300">{event.description}</p>}
        </div>
        <div className="hidden sm:flex items-end gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(event); }}
            className="rounded-lg p-1.5 text-slate-400 hover:text-violet-300"
            title="Edit"
            disabled={!staff}
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <Share2 className="h-4 w-4 text-slate-500 cursor-pointer hover:text-white" />
        </div>
      </div>
    </div>
  );
}

interface EventDetailModalProps {
  event: MaiCalendarEvent;
  onClose: () => void;
  onEdit: (e: MaiCalendarEvent) => void;
  onRefresh: () => void;
  staff: boolean;
  admin: boolean;
  displayEventTime: (e: MaiCalendarEvent) => { localISO: string; abbreviated: string; offset: string };
}

function EventDetailModal({
  event,
  onClose,
  onEdit,
  onRefresh,
  staff,
  admin,
  displayEventTime,
}: EventDetailModalProps) {
  const navigate = useNavigate();
  const { localISO, abbreviated, offset } = displayEventTime(event);
  const [canceling, setCanceling] = useState(false);

  const handleCancel = async () => {
    if (!window.confirm('Cancel this event? It will remain visible as canceled.')) return;
    setCanceling(true);
    try {
      await cancelCalendarEvent(event.id);
      toast.success('Event canceled');
      onClose();
      onRefresh();
    } catch (error) {
      console.error('Calendar event cancel error:', error);
      toast.error('Failed to cancel event');
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Event details"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className="w-full max-w-lg bg-[#0b1220]/95 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white">{event.title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {event.banner_url && (
          <img
            src={event.banner_url}
            alt={event.title}
            className="w-full h-48 object-cover rounded-xl mb-4 bg-slate-800"
          />
        )}

        {event.description && (
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Description</p>
            <p className="text-slate-300">{event.description}</p>
          </div>
        )}

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-white/10 bg-white/5">
            <Clock className="h-4 w-4 text-cyan-400" />
            <div>
              <p className="text-sm font-black text-white">{localISO}</p>
              <p className="text-xs text-slate-500">{abbreviated} {offset} • Event stored in UTC</p>
            </div>
          </div>
          {event.location && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-white/10 bg-white/5">
              <MapPin className="h-4 w-4 text-cyan-400" />
              <div>
                <p className="text-sm font-black text-white">Location</p>
                <p className="text-xs text-slate-500">{event.location}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-white/10 bg-white/5">
            <span className={`h-4 w-4 rounded-full ${event.status === 'live' ? 'bg-green-500' : event.status === 'canceled' ? 'bg-orange-500' : 'bg-blue-500'}`} />
            <div>
              <p className="text-sm font-black text-white">{statusLabel(event.status)}</p>
              <p className="text-xs text-slate-500">Visibility: {event.visibility}</p>
            </div>
          </div>
        </div>

        {event.is_official && (
          <div className="mb-4 space-y-2">
            <a
              href={MAI_OFFICIAL_EVENT_PATH(event.slug)}
              className="block rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-center text-sm font-black text-cyan-200 transition hover:bg-cyan-400/20"
            >
              {event.status === 'live' ? 'Join Official Live Event' : 'View Official Event'}
            </a>
            {admin && event.status !== 'completed' && event.status !== 'canceled' && (
              <button
                onClick={() => navigate(`/broadcast/setup?event=${encodeURIComponent(event.slug)}`)}
                className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-500 px-4 py-3 text-sm font-black text-white transition hover:brightness-110"
              >
                {event.status === 'live' ? 'Open Event Studio' : 'Start Event in Broadcast Setup'}
              </button>
            )}
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Add to Calendar</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => window.open(googleCalendarUrl(event), '_blank')}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              <Globe className="h-3.5 w-3.5 text-blue-400" /> Google Calendar
            </button>
            <button
              onClick={() => window.open(appleCalendarUrl(event), '_blank')}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              <Globe className="h-3.5 w-3.5 text-green-400" /> Apple Calendar
            </button>
            <button
              onClick={() => downloadICS(event)}
              className="col-span-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5 text-violet-400" /> Download .ics file
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-4 border-t border-white/10">
          <button
            onClick={() => {
              const url = `${window.location.origin}${event.is_official ? MAI_OFFICIAL_EVENT_PATH(event.slug) : MAI_CALENDAR_EVENT_PATH(event.slug)}`;
              navigator.clipboard.writeText(url);
              toast.success('Link copied');
            }}
            className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
          >
            <Share2 className="h-3.5 w-3.5 mr-1" /> Copy link
          </button>
          {staff && (
            <>
              <button
                onClick={() => { onClose(); onEdit(event); }}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
              </button>
              <button
                onClick={handleCancel}
                disabled={canceling || event.status === 'canceled'}
                className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20"
              >
                {canceling ? 'Canceling…' : event.status === 'canceled' ? 'Canceled' : 'Cancel'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
