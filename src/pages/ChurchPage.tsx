import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CalendarDays, Church, Clock3, HeartHandshake, Info, Loader2, ShieldCheck, Sparkles, XCircle, Play, ArrowRight, Users, Cross, HandHeart } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import useSEO from '@/hooks/useSEO';
import DailyPassage from '@/components/church/DailyPassage';
import PrayerFeed from '@/components/church/PrayerFeed';

/** Church homepage redesign. All original Supabase queries, timing and route callbacks remain intact. */
interface LiveSession {
  id: string;
  pastor_id: string;
  room_name: string;
  sermon_title: string | null;
  scripture_reference: string | null;
  viewer_count: number;
  attendee_count: number;
  started_at: string | null;
  user_profiles: { username: string; avatar_url: string };
}

const surface = 'rounded-[22px] border border-[#d4b57a]/20 bg-[#1b1411]/90 shadow-[0_16px_54px_rgba(0,0,0,.3)]';
const action = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#f8df9e] to-[#cca361] px-5 py-3 text-sm font-bold text-[#21150d] shadow-[0_6px_24px_rgba(220,172,89,.22)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe2a1]';

/** Decorative chapel glass: CSS-only, no external images or assets required. */
function ChapelWindow({ side = false }: { side?: boolean }) {
  return <div aria-hidden="true" className={`relative mx-auto h-48 w-[88px] overflow-hidden rounded-t-[50px] rounded-b-md border-[6px] border-[#9b7546]/70 bg-[#2a1516] shadow-[inset_0_0_30px_#09070a,0_0_28px_rgba(243,178,87,.12)] sm:h-60 sm:w-[108px] ${side ? 'opacity-70' : ''}`}>
    <div className="absolute inset-1 rounded-t-[48px] bg-[conic-gradient(from_0deg_at_50%_43%,#184b70_0deg,#236b8a_46deg,#c58e4c_82deg,#822e43_135deg,#3e6484_180deg,#ba793b_230deg,#6e2c45_285deg,#184b70_360deg)] opacity-90" />
    <div className="absolute inset-1 rounded-t-[48px] bg-[linear-gradient(90deg,transparent_46%,#281b18_47%,#281b18_53%,transparent_54%),linear-gradient(0deg,transparent_43%,#281b18_44%,#281b18_48%,transparent_49%)]" />
    <div className="absolute left-1/2 top-[24%] h-[49%] w-[4px] -translate-x-1/2 rounded bg-[#fff2c6]/80 shadow-[0_0_22px_#fbe4a1]" />
    <div className="absolute left-1/2 top-[38%] h-[4px] w-[35%] -translate-x-1/2 rounded bg-[#fff2c6]/80 shadow-[0_0_15px_#fbe4a1]" />
    <div className="absolute inset-0 bg-gradient-to-t from-[#120b09]/70 via-transparent to-[#ffe4a3]/20" />
  </div>;
}

function SectionHeading({ eyebrow, title, description, icon }: { eyebrow: string; title: string; description?: string; icon: React.ReactNode }) {
  return <div className="flex items-start gap-3 border-b border-[#d4b57a]/15 p-5 sm:p-6">
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#d7b77b]/25 bg-[#d7b77b]/10 text-[#efd39a]">{icon}</span>
    <div className="min-w-0"><p className="mb-1 text-[10px] font-bold uppercase tracking-[.22em] text-[#c9aa76]">{eyebrow}</p><h2 className="font-serif text-2xl font-semibold text-[#fff6e7]">{title}</h2>{description && <p className="mt-1 text-sm leading-relaxed text-[#c8b9a4]">{description}</p>}</div>
  </div>;
}

export default function ChurchPage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  useSEO({
    title: 'Troll Church | Online Faith Community & Gatherings | Mai Troll',
    description: 'Join Troll Church on Mai Troll for virtual faith community gatherings, live services, and spiritual connection. An inclusive online church experience for all.',
    keywords: [
      'online church', 'virtual church', 'faith community', 'community gatherings',
      'Troll Church', 'online ministry', 'virtual services', 'spiritual community',
      'faith platform', 'digital church', 'MaiTroll church'
    ]
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isSunday, setIsSunday] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [timeUntilOpen, setTimeUntilOpen] = useState('');
  const [loading, setLoading] = useState(true);
  const [_pastorId, setPastorId] = useState<string | null>(null);

  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [_sessionLoading, setSessionLoading] = useState(false);

  const checkTime = useCallback(() => {
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();

    const sunday = day === 0;
    const openNow = sunday && hours >= 13 && hours < 15;

    setIsSunday(sunday);
    setIsOpen(openNow);

    if (!openNow) {
      const nextOpen = new Date(now);
      nextOpen.setHours(13, 0, 0, 0);

      let daysUntilSunday = (7 - day) % 7;

      if (day === 0) {
        if (hours >= 15) daysUntilSunday = 7;
        if (hours < 13) daysUntilSunday = 0;
      }

      nextOpen.setDate(now.getDate() + daysUntilSunday);

      const diff = nextOpen.getTime() - now.getTime();
      const daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeUntilOpen(`${daysLeft > 0 ? `${daysLeft}d ` : ''}${hoursLeft}h ${minutesLeft.toString().padStart(2, '0')}m`);
    }

    setLoading(false);
  }, []);

  const fetchActivePastor = useCallback(async () => {
    setIsCancelled(false);

    const today = new Date().toISOString().split('T')[0];

    const { data: notes } = await supabase
      .from('church_sermon_notes')
      .select('pastor_id')
      .eq('date', today)
      .maybeSingle();

    if (notes?.pastor_id) {
      setPastorId(notes.pastor_id);
      return;
    }

    const { data: pastor } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('is_pastor', true)
      .limit(1)
      .maybeSingle();

    if (pastor?.id) {
      setPastorId(pastor.id);
      return;
    }

    const { data: admin } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (admin?.id) {
      setPastorId(admin.id);
      return;
    }

    setIsCancelled(true);
    setIsOpen(false);
  }, []);

  const fetchLiveSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const { data } = await supabase
        .from('church_live_sessions')
        .select(`
          id,
          pastor_id,
          room_name,
          sermon_title,
          scripture_reference,
          viewer_count,
          attendee_count,
          started_at,
          user_profiles:pastor_id (username, avatar_url)
        `)
        .eq('status', 'live')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setLiveSession(data as any || null);
    } catch (err) {
      console.error('Error fetching live session:', err);
      setLiveSession(null);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  const handleOpenLivePage = () => {
    if (!liveSession?.id) return;
    navigate(`/church/live/${liveSession.id}`);
  };

  useEffect(() => {
    checkTime();
    const interval = window.setInterval(checkTime, 60_000);
    return () => window.clearInterval(interval);
  }, [checkTime]);

  useEffect(() => {
    if (isSunday && isOpen) {
      void fetchActivePastor();
    }
  }, [isSunday, isOpen, fetchActivePastor]);

  useEffect(() => {
    fetchLiveSession();
    const interval = window.setInterval(fetchLiveSession, 15000);
    return () => window.clearInterval(interval);
  }, [fetchLiveSession]);

  if (!profile || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#110d0c] text-[#f2d39a]"><Loader2 className="h-9 w-9 animate-spin" aria-label="Loading Troll Church" /></div>;
  }

  const isPastor = !!(profile?.is_pastor || profile?.role === 'admin' || (profile as any)?.is_admin);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#100c0b] pb-16 pt-20 text-[#fff5e8] selection:bg-[#d2aa73]/40">
      {/* Desktop sanctuary atmosphere: oak walls, amber lighting and inset architecture. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(208,153,80,.14),transparent_48%),linear-gradient(90deg,#0b0909,#251813_18%,#16110f_51%,#251813_83%,#0b0909)]" />
        <div className="absolute inset-y-0 left-[8%] w-px bg-[#d0a46b]/10" />
        <div className="absolute inset-y-0 right-[8%] w-px bg-[#d0a46b]/10" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1840px] px-3 sm:px-5 2xl:px-8">
        {/* Desktop masthead: compact so the service remains above the fold. */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d4b57a]/20 bg-[#201611]/90 px-4 py-3 shadow-[0_12px_35px_rgba(0,0,0,.22)] lg:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#e5c689]/30 bg-[#e1ba7d]/10 text-[#f0d19a]"><Church className="h-6 w-6" /></span>
            <div>
              <p className="font-serif text-xl font-semibold leading-tight text-[#fff3d8] lg:text-2xl">Troll Church</p>
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#c3a477]">The sanctuary · Mai Troll</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center gap-2 rounded-lg border border-[#bc955e]/20 bg-black/20 px-3 py-2 text-xs text-[#dec7a7] sm:inline-flex"><CalendarDays className="h-4 w-4" /> Sunday 1–3 PM</span>
            <ChurchStatus isCancelled={isCancelled} isOpen={isOpen} timeUntilOpen={timeUntilOpen} />
          </div>
        </header>

        {/* Desktop 3-column workspace. Sidebar and service information stay close to the sanctuary. */}
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[220px_minmax(0,1fr)_300px] 2xl:grid-cols-[248px_minmax(0,1fr)_330px]">
          <aside className="hidden min-w-0 xl:sticky xl:top-24 xl:block">
            <div className={`${surface} overflow-hidden`}>
              <div className="border-b border-[#d4b57a]/15 bg-[#2c1d15]/70 px-5 py-5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[.22em] text-[#c9a46c]">Welcome inside</p>
                <h2 className="font-serif text-2xl text-[#fff0d4]">The Sanctuary</h2>
                <p className="mt-2 text-xs leading-5 text-[#beaa94]">Worship, scripture, prayer and fellowship in one place.</p>
              </div>
              <nav aria-label="Church sections" className="space-y-1 p-3">
                <a href="#sanctuary" className="flex items-center gap-3 rounded-xl border border-[#d8b77b]/20 bg-[#d8b77b]/10 px-4 py-3 text-sm font-semibold text-[#f1d5a3]"><Church className="h-4 w-4" /> Sanctuary</a>
                <a href="#scripture" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d6c5b0] transition hover:bg-white/5 hover:text-white"><BookOpen className="h-4 w-4" /> Daily Scripture</a>
                <a href="#prayer" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d6c5b0] transition hover:bg-white/5 hover:text-white"><HandHeart className="h-4 w-4" /> Prayer Wall</a>
                <a href="#service-info" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d6c5b0] transition hover:bg-white/5 hover:text-white"><Clock3 className="h-4 w-4" /> Service Times</a>
              </nav>
              {isPastor && <div className="border-t border-[#d4b57a]/15 p-3"><button type="button" onClick={() => navigate('/church/pastor')} className={`${action} w-full text-xs`}><ShieldCheck className="h-4 w-4" /> Pastor Dashboard</button></div>}
            </div>
            <p className="px-4 py-4 text-center font-serif text-sm italic text-[#bca688]">All are welcome here.</p>
          </aside>

          <main className="min-w-0 space-y-4">
            {/* Wide sanctuary scene intentionally built for PC aspect ratios. */}
            <section id="sanctuary" className="relative scroll-mt-24 overflow-hidden rounded-[24px] border border-[#b8905e]/30 bg-[#241710] shadow-[0_22px_75px_rgba(0,0,0,.38)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(240,186,104,.23),transparent_62%),linear-gradient(90deg,rgba(8,6,5,.6),transparent_20%,transparent_80%,rgba(8,6,5,.6))]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-[#553620] via-[#d4a86c] to-[#553620]" />
              <div className="relative px-4 pb-5 pt-7 text-center sm:px-8 lg:px-10 lg:pt-8">
                <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.28em] text-[#e0ba82]"><Sparkles className="h-3.5 w-3.5" /> Welcome to worship</p>
                <h1 className="font-serif text-4xl font-semibold tracking-tight text-[#fff2d8] lg:text-5xl 2xl:text-6xl">Welcome to Troll Church</h1>
                <p className="mx-auto mt-2 max-w-xl font-serif text-base leading-relaxed text-[#dcc7a9] lg:text-lg">A sanctuary for faith, peace, prayer and community.</p>
                <div aria-hidden="true" className="mx-auto mt-5 grid max-w-[660px] grid-cols-[1fr_1.15fr_1fr] items-end gap-2 sm:gap-8">
                  <div className="scale-[.83] origin-bottom"><ChapelWindow side /></div>
                  <ChapelWindow />
                  <div className="scale-[.83] origin-bottom"><ChapelWindow side /></div>
                </div>
                <div aria-hidden="true" className="mx-auto mt-4 flex max-w-[650px] items-center gap-3"><span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#c9a167]/70" /><Cross className="h-5 w-5 text-[#ecd19d]" /><span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#c9a167]/70" /></div>
              </div>
              <div aria-hidden="true" className="relative grid grid-cols-2 gap-3 border-t border-[#b8905e]/15 bg-[#100b09]/35 px-6 pb-4 pt-3 sm:grid-cols-4 sm:px-12">
                {[0,1,2,3].map((n) => <div key={n} className="h-5 rounded-t-md border-x-[5px] border-t-[5px] border-[#8c5d3a] bg-gradient-to-b from-[#715036] to-[#291b14] shadow-[0_8px_0_#130d0a]" />)}
              </div>
            </section>

            {/* Center stage: sermon is always primary and immediately accessible. */}
            <section className={`${surface} scroll-mt-24 overflow-hidden`} aria-label="Sunday worship service">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d4b57a]/15 bg-[#35251b]/45 px-5 py-4">
                <div className="flex items-center gap-2"><Church className="h-5 w-5 text-[#e8c68c]" /><h2 className="font-serif text-xl text-[#ffeed5]">The Pulpit · Sunday Service</h2></div>
                <span className="text-xs text-[#c9ad86]">Sunday 1:00 PM – 3:00 PM</span>
              </div>
              {liveSession ? (
                <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-red-200"><span className="h-2 w-2 animate-pulse rounded-full bg-red-400" /> Worship live now</span>
                    <h3 className="mt-3 font-serif text-2xl text-[#fff4df] sm:text-3xl">{liveSession.sermon_title || 'Sunday Worship Service'}</h3>
                    {liveSession.scripture_reference && <p className="mt-2 flex items-center gap-2 text-sm text-[#efd19b]"><BookOpen className="h-4 w-4" /> {liveSession.scripture_reference}</p>}
                    <p className="mt-2 text-sm text-[#cdbba2]">Led by {liveSession.user_profiles?.username || 'Pastor'} · {liveSession.attendee_count} attending</p>
                  </div>
                  <button type="button" onClick={handleOpenLivePage} className={`${action} w-full lg:w-auto`}><Play className="h-4 w-4 fill-current" /> Enter Live Service <ArrowRight className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-9 text-center sm:px-9">
                  <div className="grid h-14 w-14 place-items-center rounded-full border border-[#d3af77]/25 bg-[#d3af77]/10"><Church className="h-7 w-7 text-[#e7c992]" /></div>
                  <h3 className="font-serif text-2xl text-[#fff4df] sm:text-3xl">{isCancelled ? 'Service Unavailable Today' : isOpen && isSunday ? 'The Sanctuary Is Open' : 'Join Us This Sunday'}</h3>
                  <p className="max-w-xl text-sm leading-6 text-[#cfbba4]">{isCancelled ? 'There is no available pastor for today’s service.' : isOpen && isSunday ? 'The service window is open. A pastor may begin the live gathering shortly.' : 'When the pastor begins the service, you can enter the live worship gathering here.'}</p>
                </div>
              )}
            </section>

            <section id="scripture" className={`${surface} scroll-mt-24`} aria-label="Daily scripture">
              <SectionHeading eyebrow="The reading room" title="Today's Scripture" description="Take a quiet moment for the daily passage." icon={<BookOpen className="h-5 w-5" />} />
              <div className="min-w-0 p-4 sm:p-6"><DailyPassage /></div>
            </section>
            <section id="prayer" className={`${surface} scroll-mt-24`} aria-label="Prayer wall">
              <SectionHeading eyebrow="The prayer chapel" title="Community Prayer Wall" description="Share requests, encouragement and support." icon={<HeartHandshake className="h-5 w-5" />} />
              <div className="min-w-0 p-4 sm:p-6"><PrayerFeed isOpen={isOpen} /></div>
            </section>
          </main>

          {/* Permanent desktop right rail: useful details without taking attention from the sermon. */}
          <aside className="min-w-0 space-y-4 xl:sticky xl:top-24">
            <section id="service-info" className={`${surface} scroll-mt-24 overflow-hidden`}>
              <div className="border-b border-[#d4b57a]/15 bg-[#2b1e16]/60 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[.19em] text-[#c9a46c]">Weekly gathering</p><h2 className="mt-1 font-serif text-2xl text-[#fff1d9]">Service Times</h2></div>
              <div className="space-y-3 p-5">
                <div className="rounded-xl border border-[#bf9c65]/20 bg-black/20 p-4"><p className="flex items-center gap-2 text-xs text-[#caaa78]"><CalendarDays className="h-4 w-4" /> Every Sunday</p><p className="mt-2 font-serif text-2xl text-[#fff0d9]">1:00–3:00 PM</p></div>
                <p className="flex gap-2 text-xs leading-5 text-[#cfbba3]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#e5c58d]" /> Services are moderated by pastors and officers.</p>
                <p className="flex gap-2 text-xs leading-5 text-[#cfbba3]"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#e5c58d]" /> Live worship and offerings are available during Sunday service.</p>
              </div>
            </section>
            <section className={`${surface} p-5 text-center`}>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#e2c18a]/30 bg-[#e2c18a]/10"><BookOpen className="h-7 w-7 text-[#ecd29c]" /></span>
              <h2 className="mt-3 font-serif text-xl text-[#fff1da]">Church Attendee</h2>
              <p className="mt-2 text-xs leading-5 text-[#cbb8a0]">Visit, pray, or participate to earn your Church Attendee badge.</p>
            </section>
            <section className={`${surface} p-5`}>
              <h2 className="flex items-center gap-2 font-serif text-xl text-[#ffeed5]"><HandHeart className="h-5 w-5 text-[#e5c58d]" /> Fellowship</h2>
              <p className="mt-2 text-sm leading-6 text-[#cdb9a1]">A place for encouragement, scripture, reflection and prayer together.</p>
              <a href="#prayer" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#f0ce92] hover:text-white">Visit the Prayer Wall <ArrowRight className="h-4 w-4" /></a>
            </section>
            {isPastor && <section className={`${surface} p-5 xl:hidden`}><button type="button" onClick={() => navigate('/church/pastor')} className={`${action} w-full`}>Open Pastor Dashboard <ArrowRight className="h-4 w-4" /></button></section>}
          </aside>
        </div>
        <footer className="mt-7 border-t border-[#b28f5e]/20 py-6 text-center"><Cross className="mx-auto mb-2 h-5 w-5 text-[#c6a46f]" /><p className="font-serif text-lg text-[#e4cfae]">All are welcome here.</p><p className="mt-1 text-xs text-[#9f8a72]">Troll Church · A community within Mai Troll</p></footer>
      </div>
    </div>
  );
}

function ChurchStatus({ isCancelled, isOpen, timeUntilOpen }: { isCancelled: boolean; isOpen: boolean; timeUntilOpen: string }) {
  if (isCancelled) return <span className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200"><XCircle className="h-4 w-4" /> Service cancelled</span>;
  if (isOpen) return <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Sanctuary open</span>;
  return <span className="inline-flex items-center gap-2 rounded-full border border-[#dab881]/25 bg-[#dab881]/10 px-4 py-2 text-xs font-semibold text-[#efd5a9]"><Clock3 className="h-4 w-4" /> Opens in {timeUntilOpen}</span>;
}
