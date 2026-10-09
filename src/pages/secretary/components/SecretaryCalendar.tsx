import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../lib/store';
import { toast } from 'sonner';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO
} from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  starts_at: string;
  ends_at: string | null;
  meeting_id: string | null;
  status: string;
  created_by_user_id: string;
  created_at: string;
}

export default function SecretaryCalendar() {
  const { user, profile } = useAuthStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'meeting',
    date: '',
    start_time: '09:00',
    end_time: '10:00',
  });

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from('tromail_calendar_events')
        .select('*')
        .gte('starts_at', monthStart.toISOString())
        .lte('starts_at', monthEnd.toISOString())
        .order('starts_at', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [user, currentMonth]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Build calendar grid
  const calendarStart = startOfWeek(startOfMonth(currentMonth));
  const calendarEnd = endOfWeek(endOfMonth(currentMonth));
  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const getEventsForDay = (date: Date) => {
    return events.filter((e) => isSameDay(parseISO(e.starts_at), date));
  };

  const handleCreateEvent = async () => {
    if (!user || !newEvent.title || !newEvent.date) {
      toast.error('Please fill in title and date');
      return;
    }

    try {
      const startsAt = new Date(`${newEvent.date}T${newEvent.start_time}`).toISOString();
      const endsAt = new Date(`${newEvent.date}T${newEvent.end_time}`).toISOString();

      const { data: event, error: eventError } = await supabase
        .from('tromail_calendar_events')
        .insert({
          created_by_user_id: user.id,
          created_by_role: profile?.role || 'secretary',
          title: newEvent.title,
          description: newEvent.description || null,
          event_type: newEvent.event_type,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'scheduled',
        })
        .select('id, title, description, event_type, starts_at, ends_at, status, created_by_user_id, created_by_role')
        .single();

      if (eventError) throw eventError;

      // Add creator as recipient
      await supabase.from('tromail_calendar_event_recipients').insert({
        calendar_event_id: event.id,
        recipient_user_id: user.id,
        recipient_role: profile?.role || 'secretary',
      });

      toast.success('Meeting scheduled successfully');
      setShowCreateModal(false);
      setNewEvent({
        title: '',
        description: '',
        event_type: 'meeting',
        date: '',
        start_time: '09:00',
        end_time: '10:00',
      });
      fetchEvents();
    } catch (err: any) {
      console.error('Error creating event:', err);
      toast.error('Failed to create event: ' + err.message);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      const { error } = await supabase
        .from('tromail_calendar_events')
        .delete()
        .eq('id', eventId);
      if (error) throw error;
      toast.success('Event deleted');
      fetchEvents();
    } catch (_err: any) {
      toast.error('Failed to delete event');
    }
  };

  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 text-purple-400" />
            Secretary Calendar
          </h2>
          <p className="text-slate-400 mt-1">Schedule and manage meetings</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Meeting
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-400" />
            </button>
            <h3 className="text-xl font-semibold text-white">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-slate-500 py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const dayEvents = getEventsForDay(d);
              const isSelected = selectedDate && isSameDay(d, selectedDate);
              const isCurrentMonth = isSameMonth(d, currentMonth);

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(d)}
                  className={`
                    relative p-2 min-h-[60px] rounded-lg text-sm transition-colors text-left
                    ${isCurrentMonth ? 'text-white' : 'text-slate-600'}
                    ${isSelected ? 'bg-purple-600/30 border border-purple-500/50' : 'hover:bg-slate-800 border border-transparent'}
                    ${isToday(d) ? 'ring-1 ring-purple-400' : ''}
                  `}
                >
                  <span className="text-xs">{format(d, 'd')}</span>
                  {dayEvents.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 2).map((evt) => (
                        <div
                          key={evt.id}
                          className="text-[10px] truncate px-1 py-0.5 rounded bg-purple-500/20 text-purple-300"
                        >
                          {format(parseISO(evt.starts_at), 'HH:mm')} {evt.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-slate-500 px-1">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Events */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a date'}
          </h3>

          {!selectedDate ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Click a date to view events</p>
            </div>
          ) : loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : selectedDateEvents.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No events scheduled</p>
              <button
                onClick={() => {
                  setNewEvent((prev) => ({ ...prev, date: format(selectedDate, 'yyyy-MM-dd') }));
                  setShowCreateModal(true);
                }}
                className="mt-3 text-purple-400 text-sm hover:text-purple-300"
              >
                + Schedule one
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-4 bg-slate-800 rounded-xl border border-slate-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-white">{evt.title}</h4>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(evt.starts_at), 'HH:mm')}
                          {evt.ends_at && ` - ${format(parseISO(evt.ends_at), 'HH:mm')}`}
                        </span>
                      </div>
                      {evt.description && (
                        <p className="text-xs text-slate-500 mt-2">{evt.description}</p>
                      )}
                      <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 capitalize">
                        {evt.event_type}
                      </span>
                    </div>
                    {evt.created_by_user_id === user?.id && (
                      <button
                        onClick={() => handleDeleteEvent(evt.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Schedule Meeting</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Title</label>
                <input
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Meeting title"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Description</label>
                <textarea
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm h-20 focus:outline-none focus:border-purple-500"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Type</label>
                <select
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
                >
                  <option value="meeting">Meeting</option>
                  <option value="hearing">Hearing</option>
                  <option value="interview">Interview</option>
                  <option value="review">Review</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1">Date</label>
                <input
                  type="date"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Start Time</label>
                  <input
                    type="time"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    value={newEvent.start_time}
                    onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">End Time</label>
                  <input
                    type="time"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    value={newEvent.end_time}
                    onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEvent}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
