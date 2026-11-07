import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, MapPin, Globe, Download, Share2, Smartphone } from 'lucide-react';
import useSEO from '@/hooks/useSEO';
import { toast } from 'sonner';
import {
  fetchEventBySlug,
  googleCalendarUrl,
  appleCalendarUrl,
  downloadICS,
  formatUtcInZone,
  MAI_CALENDAR_EVENT_PATH,
  type MaiCalendarEvent,
} from '@/lib/maiCalendar';

export default function MaiCalendarEventPage() {
  const { slug } = useParams();
  const [event, setEvent] = useState<MaiCalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const displayTimeZone = 'UTC';

  const loadEvent = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const e = await fetchEventBySlug(slug);
      setEvent(e || null);
    } catch (err) {
      console.error('Event fetch error:', err);
      toast.error('Event not found');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const { localISO, abbreviated, offset } = event
    ? formatUtcInZone(event.starts_at, displayTimeZone)
    : { localISO: '', abbreviated: '', offset: '' };

  useSEO({
    title: event ? `${event.title} | MaiTroll Calendar` : 'Event | MaiTroll Calendar',
    description: event
      ? (event.description || `Join ${event.title} on ${localISO}.`).slice(0, 160)
      : 'MaiTroll public events calendar.',
    keywords: ['MaiTroll', 'calendar', 'event', event?.title, 'live stream', 'community event'].filter(Boolean),
    canonical: event ? `https://www.maitroll.com${MAI_CALENDAR_EVENT_PATH(event.slug)}` : 'https://www.maitroll.com/calendar',
    robots: 'index, follow',
    ogImage: event?.banner_url || undefined,
    publishedTime: event?.created_at || undefined,
    modifiedTime: event?.updated_at || undefined,
    section: 'Events',
    structuredData: event
      ? {
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: event.title,
          description: event.description || '',
          startDate: event.starts_at,
          endDate: event.ends_at,
          eventStatus: event.status === 'live'
            ? 'https://schema.org/EventScheduled'
            : event.status === 'canceled'
              ? 'https://schema.org/EventCancelled'
              : 'https://schema.org/EventScheduled',
          eventAttendanceMode: event.location ? 'https://schema.org/PhysicalEventAttendanceMode' : 'https://schema.org/OnlineEventAttendanceMode',
          location: event.stream_url || event.location
            ? {
                '@type': 'VirtualLocation',
                name: event.location || 'Online',
                url: event.stream_url || undefined,
              }
            : { '@type': 'Place', name: 'Online' },
          organizer: {
            '@type': 'Organization',
            name: 'MaiTroll',
            url: 'https://www.maitroll.com',
          },
          url: `https://www.maitroll.com${MAI_CALENDAR_EVENT_PATH(event.slug)}`,
          image: event.banner_url || undefined,
        }
      : undefined,
  });

  if (loading || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
        <div className="flex flex-col items-center gap-3">
          <Clock className="h-8 w-8 animate-spin text-violet-400" />
          <p className="text-slate-400">Loading event…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0e1a]/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon />
              <span className="font-black text-white text-lg tracking-tight">MaiTroll Calendar</span>
            </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a
              href="/calendar"
              className="hover:text-violet-300 transition-colors"
            >
              Calendar
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <article className="rounded-2xl border border-white/10 bg-[#0b1220]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
            <div className="flex flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 w-12 h-12 sm:w-16 sm:h-16 text-white text-xl font-black">
              📅
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">{event.title}</h1>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${event.status === 'live' ? 'bg-green-500/20 text-green-300 border-green-500/30' : event.status === 'canceled' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                {event.status === 'live' ? '● LIVE' : event.status === 'canceled' ? 'Canceled' : 'Upcoming'}
              </span>
              {event.visibility === 'draft' && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-slate-600 px-2 py-0.5 text-[10px] font-bold text-slate-400">Draft</span>
              )}
            </div>
          </div>

          {event.banner_url && (
            <img
              src={event.banner_url}
              alt={event.title}
              className="w-full h-48 sm:h-64 object-cover rounded-xl mb-6 bg-slate-800"
            />
          )}

          {event.description && (
            <section className="mb-6">
              <h2 className="text-sm font-black text-slate-300 uppercase tracking-wider mb-2">Description</h2>
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">{event.description}</p>
            </section>
          )}

          <section className="mb-6">
            <h2 className="text-sm font-black text-slate-300 uppercase tracking-wider mb-3">When & Where</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 flex-shrink-0">
                  <Clock className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">{localISO}</p>
                  <p className="text-xs text-slate-500">{abbreviated} {offset} (event stored in UTC)</p>
                </div>
              </div>
              {event.location && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 flex-shrink-0">
                    <MapPin className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Location</p>
                    <p className="text-xs text-slate-500">{event.location}</p>
                  </div>
                </div>
              )}
              {event.stream_url && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 flex-shrink-0">
                    <Globe className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Stream</p>
                    <a
                      href={event.stream_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-300 hover:text-violet-200 break-all"
                    >
                      {event.stream_url}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>

          {event.stream_url && event.status === 'live' && (
            <section className="mb-6">
              <a
                href={event.stream_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-4 py-3 text-sm font-black text-white shadow-[0_0_24px_rgba(34,197,94,0.35)] hover:from-green-500 hover:to-emerald-400 transition"
              >
                <Smartphone className="h-4 w-4" /> Join Live Event
              </a>
            </section>
          )}

          <section className="mb-6">
            <h2 className="text-sm font-black text-slate-300 uppercase tracking-wider mb-3">Add to Calendar</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                onClick={() => window.open(googleCalendarUrl(event), '_blank')}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
              >
                <Globe className="h-3.5 w-3.5 text-blue-400" />
                <span>Google Calendar</span>
              </button>
              <button
                onClick={() => window.open(appleCalendarUrl(event), '_blank')}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
              >
                <Globe className="h-3.5 w-3.5 text-green-400" />
                <span>Apple Calendar</span>
              </button>
              <button
                onClick={() => downloadICS(event)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
              >
                <Download className="h-3.5 w-3.5 text-violet-400" />
                <span>.ics file</span>
              </button>
            </div>
          </section>

          <section className="mb-8 pt-6 border-t border-white/10">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Share this event</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 break-all">
              {`https://www.maitroll.com${MAI_CALENDAR_EVENT_PATH(event.slug)}`}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://www.maitroll.com${MAI_CALENDAR_EVENT_PATH(event.slug)}`);
                toast.success('Link copied');
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
            >
              <span className="h-3.5 w-3.5">🔗</span> Copy link
            </button>
          </section>
        </article>
      </main>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
