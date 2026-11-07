import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ActiveOfficialEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  category: string;
}

interface ActiveOfficialEventTilesProps {
  compact?: boolean;
}

export default function ActiveOfficialEventTiles({ compact = false }: ActiveOfficialEventTilesProps) {
  const [events, setEvents] = useState<ActiveOfficialEvent[]>([]);

  const loadEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('mai_calendar_events')
      .select('id, slug, title, description, banner_url, category')
      .eq('is_official', true)
      .eq('visibility', 'public')
      .eq('status', 'live')
      .order('live_started_at', { ascending: false })
      .limit(6);

    if (error) {
      console.error('[ActiveOfficialEventTiles] Failed to load live events:', error);
      return;
    }

    setEvents((data ?? []) as ActiveOfficialEvent[]);
  }, []);

  useEffect(() => {
    void loadEvents();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadEvents();
    }, 30_000);
    const channel = supabase
      .channel('active-official-event-tiles')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mai_calendar_events',
      }, () => void loadEvents())
      .subscribe();

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [loadEvents]);

  if (events.length === 0) return null;

  return (
    <section aria-label="Live official events" className={compact ? 'space-y-2' : 'mb-6 space-y-3'}>
      {!compact && (
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-cyan-200">
          <Radio className="h-4 w-4 text-red-400" />
          Live MaiTroll Events
        </h2>
      )}
      <div className={compact ? 'flex gap-3 overflow-x-auto pb-1' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
        {events.map((event) => (
          <Link
            key={event.id}
            to={`/events/${encodeURIComponent(event.slug)}`}
            className={`group relative isolate flex min-h-40 flex-col justify-end overflow-hidden rounded-2xl border border-cyan-300/25 bg-slate-950 text-white shadow-lg transition hover:-translate-y-0.5 hover:border-cyan-200/60 ${
              compact ? 'w-64 shrink-0' : ''
            }`}
          >
            {event.banner_url
              ? <img src={event.banner_url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
              : <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_10%,rgba(34,211,238,.35),transparent_35%),linear-gradient(135deg,#4c1d95,#020617_70%)]" />}
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/10" />
            <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-red-300/30 bg-red-950/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-100">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              Agora Live
            </div>
            <div className="p-4 pt-12">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200">MaiTroll Official Event</p>
              <h3 className="mt-1 line-clamp-2 text-base font-black group-hover:text-cyan-100">{event.title}</h3>
              <p className="mt-1 line-clamp-1 text-[10px] font-bold uppercase tracking-wider text-white/65">
                {event.category.replace(/_/g, ' ')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
