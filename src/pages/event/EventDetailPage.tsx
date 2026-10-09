import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Users, MapPin, Bell, BellOff, Share2, Radio, Trophy, Shield, Star, Edit, Trash2, Lock, Send, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '@/lib/store';
import type { CalendarEvent, EventParticipant } from '@/types/calendar';
import { EVENT_CATEGORIES } from '@/types/calendar';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);

  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const fetchEvent = async () => {
    if (!eventId) return;
    setLoading(true);

    try {
      const { supabase } = await import('@/lib/supabase');

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select(`
          *,
          event_categories(name, icon, color)
        `)
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;

      if (eventData) {
        setEvent({
          ...eventData,
          category_name: eventData.event_categories?.name,
          category_icon: eventData.event_categories?.icon,
          category_color: eventData.event_categories?.color,
        } as CalendarEvent);
      }

      const { data: participantsData } = await supabase
        .from('event_participants')
        .select('*')
        .eq('event_id', eventId)
        .in('status', ['registered', 'confirmed'])
        .order('registered_at', { ascending: true });

      setParticipants(participantsData || []);

      if (user?.id) {
        setIsRegistered(participantsData?.some(p => p.user_id === user.id) || false);
      }
    } catch (err) {
      console.error('Error fetching event:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!eventId || !user || !profile) return;
    setRegistering(true);

    try {
      const { supabase } = await import('@/lib/supabase');

      if (isRegistered) {
        await supabase.rpc('cancel_event_registration', {
          p_event_id: eventId,
          p_user_id: user.id,
        });
        setIsRegistered(false);
        setParticipants(prev => prev.filter(p => p.user_id !== user.id));
      } else {
        const { data } = await supabase.rpc('register_for_event', {
          p_event_id: eventId,
          p_user_id: user.id,
          p_username: profile.username || user.email?.split('@')[0] || 'User',
          p_avatar_url: profile.avatar_url,
        });

        if (data?.success) {
        setIsRegistered(true);
        setParticipants(prev => [...prev, {
          id: '',
          event_id: eventId,
          user_id: user.id,
          username: profile.username || user.email?.split('@')[0] || 'User',
          avatar_url: profile.avatar_url,
          status: data.status as EventParticipant['status'],
          registered_at: new Date().toISOString(),
          metadata: {},
        }]);
        }
      }
    } catch (err) {
      console.error('Error registering for event:', err);
    } finally {
      setRegistering(false);
    }
  };

  const getCategoryColor = (): string => {
    if (!event) return '#8B5CF6';
    const cat = EVENT_CATEGORIES.find(c => c.slug === event.category_slug);
    return cat?.color || '#8B5CF6';
  };

  const getCategoryIcon = (): string => {
    if (!event) return '📅';
    const cat = EVENT_CATEGORIES.find(c => c.slug === event.category_slug);
    return cat?.icon || '📅';
  };

  const getCountdown = (): { days: number; hours: number; minutes: number; seconds: number; isLive: boolean; isPast: boolean } => {
    if (!event) return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive: false, isPast: false };

    const now = new Date();
    const eventTime = new Date(event.event_date);
    if (event.start_time) {
      const startTime = new Date(event.start_time);
      eventTime.setHours(startTime.getHours(), startTime.getMinutes(), startTime.getSeconds());
    }

    const diff = eventTime.getTime() - now.getTime();

    if (event.status === 'live') {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive: true, isPast: false };
    }

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive: false, isPast: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, isLive: false, isPast: false };
  };

  const isAdmin = profile?.is_admin || profile?.role === 'admin';
  const isCreator = user?.id === event?.creator_id;

  const countdown = getCountdown();
  const categoryColor = getCategoryColor();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050715]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050715] text-white">
        <div className="text-center">
          <Calendar className="mx-auto h-16 w-16 text-slate-600" />
          <h2 className="mt-4 text-xl font-black">Event Not Found</h2>
          <p className="mt-2 text-sm text-slate-400">This event may have been deleted or does not exist.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-2.5 text-sm font-black text-white"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050715] text-white">
      {/* Banner */}
      {event.banner_image_url ? (
        <div className="relative h-64 w-full overflow-hidden md:h-80">
          <img
            src={event.banner_image_url}
            alt={event.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050715] via-[#050715]/40 to-transparent" />
        </div>
      ) : (
        <div
          className="relative h-48 w-full overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${categoryColor}30, ${categoryColor}10, #050715)`,
          }}
        >
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.05) 0%, transparent 50%)',
          }} />
        </div>
      )}

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-12">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Calendar
        </button>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Event Header */}
            <div className={`${glass} rounded-2xl p-6`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getCategoryIcon()}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
                    >
                      {event.category_name || event.category_slug.replace(/_/g, ' ')}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      event.status === 'live'
                        ? 'bg-red-500/20 text-red-300'
                        : event.status === 'upcoming'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-gray-500/20 text-gray-300'
                    }`}>
                      {event.status === 'live' ? '● LIVE' : event.status}
                    </span>
                  </div>

                  <h1 className="mt-3 text-3xl font-black text-white">{event.title}</h1>

                  {event.description && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{event.description}</p>
                  )}
                </div>

                {(isAdmin || isCreator) && (
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-white/10 bg-white/[0.05] p-2 text-slate-300 transition hover:bg-white/[0.1] hover:text-white">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Event Details */}
            <div className={`${glass} rounded-2xl p-6`}>
              <h3 className="mb-4 text-sm font-black text-white">Event Details</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <Calendar className="h-5 w-5 text-violet-400" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400">Date</p>
                    <p className="text-sm font-bold text-white">{format(parseISO(event.event_date), 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                </div>

                {event.start_time && (
                  <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <Clock className="h-5 w-5 text-cyan-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Time</p>
                      <p className="text-sm font-bold text-white">
                        {event.start_time}
                        {event.end_time && ` - ${event.end_time}`}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <Users className="h-5 w-5 text-amber-400" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400">Participants</p>
                    <p className="text-sm font-bold text-white">
                      {participants.length}{event.max_participants ? ` / ${event.max_participants}` : ''}
                    </p>
                  </div>
                </div>

                {event.location_type !== 'virtual' && (
                  <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <MapPin className="h-5 w-5 text-green-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Location</p>
                      <p className="text-sm font-bold text-white">{event.location_type}</p>
                      {event.location_details && (
                        <p className="text-[10px] text-slate-400">{event.location_details}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Creator */}
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
                  <Star className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400">Created by</p>
                  <p className="text-sm font-bold text-white">{event.creator_username}</p>
                </div>
              </div>
            </div>

            {/* Rules & Requirements */}
            {(event.rules || (event.requirements && event.requirements.length > 0)) && (
              <div className={`${glass} rounded-2xl p-6`}>
                <h3 className="mb-4 text-sm font-black text-white">Rules & Requirements</h3>

                {event.requirements && event.requirements.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-xs font-bold text-slate-400">Requirements:</p>
                    {event.requirements.map((req, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                        <Shield className="h-3 w-3 text-amber-400" />
                        {req}
                      </div>
                    ))}
                  </div>
                )}

                {event.rules && (
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <p className="text-xs leading-relaxed text-slate-300">{event.rules}</p>
                  </div>
                )}
              </div>
            )}

            {/* Live Stream Embed (if event is live) */}
            {event.status === 'live' && event.stream_id && (
              <div className={`${glass} rounded-2xl overflow-hidden`}>
                <div className="flex items-center gap-2 border-b border-white/10 p-3">
                  <Radio className="h-4 w-4 text-red-400" />
                  <span className="text-xs font-bold text-red-300">LIVE STREAM</span>
                </div>
                <div className="aspect-video bg-black">
                  <iframe
                    src={`/broadcast/${event.stream_id}`}
                    className="h-full w-full"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Countdown */}
            {event.status === 'upcoming' && !countdown.isPast && (
              <div className={`${glass} rounded-2xl p-4`}>
                <h3 className="mb-3 text-xs font-bold uppercase text-slate-400">Event Starts In</h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { value: countdown.days, label: 'Days' },
                    { value: countdown.hours, label: 'Hours' },
                    { value: countdown.minutes, label: 'Min' },
                    { value: countdown.seconds, label: 'Sec' },
                  ].map(({ value, label }) => (
                    <div key={label} className="rounded-lg border border-white/10 bg-white/[0.05] p-2">
                      <p className="text-xl font-black text-white">{String(value).padStart(2, '0')}</p>
                      <p className="text-[9px] font-bold text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Registration */}
            <div className={`${glass} rounded-2xl p-4`}>
              {event.status === 'cancelled' ? (
                <div className="text-center">
                  <Shield className="mx-auto h-8 w-8 text-orange-400" />
                  <p className="mt-2 text-sm font-bold text-orange-300">Event Cancelled</p>
                </div>
              ) : event.status === 'completed' ? (
                <div className="text-center">
                  <Trophy className="mx-auto h-8 w-8 text-amber-400" />
                  <p className="mt-2 text-sm font-bold text-amber-300">Event Completed</p>
                </div>
              ) : (
                <>
                  {event.registration_locked ? (
                    <div className="text-center">
                      <Lock className="mx-auto h-8 w-8 text-slate-400" />
                      <p className="mt-2 text-sm font-bold text-slate-400">Registration Locked</p>
                    </div>
                  ) : (
                    <button
                      onClick={handleRegister}
                      disabled={registering}
                      className={`w-full rounded-xl px-4 py-3 text-sm font-black text-white transition ${
                        isRegistered
                          ? 'border border-red-400/30 bg-red-500/20 hover:bg-red-500/30'
                          : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:scale-[1.02]'
                      } disabled:opacity-50`}
                    >
                      {registering
                        ? '...'
                        : isRegistered
                        ? 'Cancel Registration'
                        : 'Join Event'
                      }
                    </button>
                  )}

                  {event.max_participants !== undefined && event.max_participants !== null && (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">
                          {participants.length}/{event.max_participants} spots taken
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (participants.length / event.max_participants) * 100)}%`,
                            backgroundColor: categoryColor,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Notification Toggle */}
            <button className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]">
              {isRegistered ? (
                <Bell className="h-4 w-4 text-violet-400" />
              ) : (
                <BellOff className="h-4 w-4 text-slate-500" />
              )}
              <div>
                <p className="text-xs font-bold text-white">Notifications</p>
                <p className="text-[10px] text-slate-400">
                  {isRegistered ? 'Reminders enabled' : 'Join to receive updates'}
                </p>
              </div>
            </button>

            {/* Share */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
              }}
              className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]"
            >
              <Share2 className="h-4 w-4 text-cyan-400" />
              <div>
                <p className="text-xs font-bold text-white">Share Event</p>
                <p className="text-[10px] text-slate-400">Copy event link</p>
              </div>
            </button>

            {/* Admin Actions */}
            {(isAdmin || isCreator) && (
              <div className={`${glass} rounded-2xl p-4`}>
                <h3 className="mb-3 text-xs font-bold uppercase text-slate-400">Admin Actions</h3>
                <div className="space-y-2">
                  <button className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-left text-xs font-bold text-white transition hover:bg-white/[0.06]">
                    <Lock className="h-3.5 w-3.5" />
                    Lock Registration
                  </button>
                  <button className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-left text-xs font-bold text-white transition hover:bg-white/[0.06]">
                    <Send className="h-3.5 w-3.5" />
                    Send Notification
                  </button>
                  <button className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-left text-xs font-bold text-white transition hover:bg-white/[0.06]">
                    <Download className="h-3.5 w-3.5" />
                    Export Participants
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
