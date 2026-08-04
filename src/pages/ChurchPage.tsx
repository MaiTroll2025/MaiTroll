import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  Church,
  Clock,
  Gift,
  Info,
  Loader2,
  Shield,
  Sparkles,
  XCircle,
  Radio,
  Video,
  UsersRound,
  Play,
} from 'lucide-react';

import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import useSEO from '@/hooks/useSEO';
import DailyPassage from '@/components/church/DailyPassage';
import PrayerFeed from '@/components/church/PrayerFeed';

interface LiveSession {
  id: string;
  pastor_id: string;
  room_name: string;
  sermon_title: string | null;
  scripture_reference: string | null;
  viewer_count: number;
  attendee_count: number;
  started_at: string | null;
  user_profiles: {
    username: string;
    avatar_url: string;
  };
}

const pageBg =
  'min-h-screen bg-[radial-gradient(circle_at_top,#8B5A2B22,transparent_34%),linear-gradient(135deg,#120A05_0%,#2A1408_42%,#3A1C0A_100%)] px-4 pb-24 pt-24 text-[#FFF8E7] md:px-8';

const panel =
  'rounded-[2rem] border border-[#D6B36A]/25 bg-[#1C0F08]/80 shadow-[0_0_45px_rgba(214,179,106,0.12)] backdrop-blur-xl';

const card =
  'rounded-2xl border border-[#D6B36A]/20 bg-[#241208]/75 shadow-[0_0_28px_rgba(214,179,106,0.08)] backdrop-blur-xl';

const goldButton =
  'rounded-xl border border-[#F6D98B]/40 bg-[#D6B36A] px-4 py-2 text-sm font-black text-[#1C0F08] shadow-[0_0_24px_rgba(214,179,106,0.22)] transition hover:bg-[#F6D98B]';

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
  const [sessionLoading, setSessionLoading] = useState(false);

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#120A05] text-[#F6D98B]">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className={pageBg}>
      <div className="pointer-events-none fixed inset-0 opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(246,217,139,0.08)_50%,transparent_100%)]" />
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[#D6B36A]/10 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto max-w-6xl space-y-8">
        <header className={`${panel} overflow-hidden p-6 text-center md:p-8`}>
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-[#F6D98B]/35 bg-[#D6B36A]/15 shadow-[0_0_34px_rgba(214,179,106,0.22)]">
            <Church className="h-10 w-10 text-[#F6D98B]" />
          </div>

          <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-[#D6B36A]">
            Sunday Sanctuary
          </p>

          <h1 className="bg-gradient-to-r from-[#F6D98B] via-[#FFF8E7] to-[#D6B36A] bg-clip-text text-4xl font-black tracking-tight text-transparent md:text-6xl">
            Troll Church
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#E8D7B0]/80 md:text-lg">
            A peaceful sanctuary for reflection, prayer, encouragement, and weekly Sunday service.
          </p>

          <div className="mt-6">
            <ChurchStatus
              isCancelled={isCancelled}
              isOpen={isOpen}
              timeUntilOpen={timeUntilOpen}
            />
          </div>
        </header>

        {/* Live Church Session Viewer */}
        {liveSession && (
          <section className={`${panel} relative overflow-hidden p-6`}>
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />

            <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-red-400/35 bg-red-900/20">
                <div className="relative">
                  <Radio className="h-8 w-8 text-red-400" />
                  <span className="absolute -right-1 -top-1 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                  </span>
                </div>
              </div>

              <div className="flex-1">
                <h2 className="text-xl font-black text-[#FFF8E7]">
                  {liveSession.sermon_title || 'Sunday Service'} — LIVE NOW
                </h2>
                {liveSession.scripture_reference && (
                  <p className="mt-1 text-sm text-[#D6B36A]">
                    Scripture: {liveSession.scripture_reference}
                  </p>
                )}
                <p className="mt-1 text-sm text-[#E8D7B0]/60">
                  Pastor: {liveSession.user_profiles?.username || 'Pastor'} • {liveSession.attendee_count} attending
                </p>
              </div>

              <button
                onClick={handleOpenLivePage}
                className="inline-flex items-center gap-2 rounded-xl border border-[#F6D98B]/40 bg-[#D6B36A] px-6 py-3 text-sm font-black text-[#1C0F08] shadow-[0_0_24px_rgba(214,179,106,0.22)] transition hover:bg-[#F6D98B]"
              >
                <Play className="h-4 w-4" />
                Join Service
              </button>
            </div>
          </section>
        )}

        {isSunday && isOpen && !liveSession && (
          <section className={`${panel} relative overflow-hidden p-6 text-center`}>
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#F6D98B] to-transparent" />

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#F6D98B]/35 bg-[#D6B36A]/15">
              <Gift className="h-7 w-7 text-[#F6D98B]" />
            </div>

            <h2 className="text-2xl font-black text-[#FFF8E7]">Sunday Service Window Open</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#E8D7B0]/75">
              The service window is open. A pastor can start a live broadcast. Check back for live video and audio.
            </p>
          </section>
        )}

        <section className={panel}>
          <div className="border-b border-[#D6B36A]/15 px-5 py-4">
            <h2 className="flex items-center gap-2 text-lg font-black text-[#FFF8E7]">
              <BookOpen className="h-5 w-5 text-[#F6D98B]" />
              Daily Passage
            </h2>
          </div>
          <div className="p-5">
            <DailyPassage />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
          <section className={panel}>
            <div className="border-b border-[#D6B36A]/15 px-5 py-4">
              <h2 className="text-lg font-black text-[#FFF8E7]">Prayer Wall</h2>
              <p className="text-sm text-[#E8D7B0]/60">Share prayers, encouragement, and community support.</p>
            </div>
            <div className="p-5">
              <PrayerFeed isOpen={isOpen} />
            </div>
          </section>

          <aside className="space-y-6">
            <InfoCard
              title="Church Info"
              icon={<Info className="h-5 w-5 text-[#F6D98B]" />}
            >
              <InfoRow icon={<Clock className="h-4 w-4" />} text="Open Sundays: 1 PM – 3 PM" />
              <InfoRow icon={<Calendar className="h-4 w-4" />} text="Sunday Service: Broadcast and offerings enabled." />
              <InfoRow icon={<Shield className="h-4 w-4" />} text="Moderated by pastors and officers. Please be respectful." />
            </InfoCard>

            <InfoCard
              title="Church Attendee"
              icon={<Sparkles className="h-5 w-5 text-[#F6D98B]" />}
              center
            >
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[#F6D98B]/30 bg-[#D6B36A]/15">
                <BookOpen className="h-7 w-7 text-[#F6D98B]" />
              </div>
              <p className="text-sm text-[#E8D7B0]/70">
                Visit, pray, or participate to earn this badge.
              </p>
            </InfoCard>

            {(profile?.is_pastor || profile?.role === 'admin' || (profile as any)?.is_admin) && (
              <InfoCard
                title="Pastor Controls"
                icon={<Shield className="h-5 w-5 text-[#F6D98B]" />}
              >
                <button onClick={() => navigate('/church/pastor')} className={`${goldButton} w-full`}>
                  Open Pastor Dashboard
                </button>
              </InfoCard>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function ChurchStatus({
  isCancelled,
  isOpen,
  timeUntilOpen,
}: {
  isCancelled: boolean;
  isOpen: boolean;
  timeUntilOpen: string;
}) {
  if (isCancelled) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-red-300/35 bg-red-900/30 px-4 py-2 text-sm font-black uppercase tracking-[0.14em] text-red-100">
        <XCircle className="h-4 w-4" />
        Church is Cancelled
      </div>
    );
  }

  if (isOpen) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[#F6D98B]/45 bg-[#D6B36A]/20 px-4 py-2 text-sm font-black uppercase tracking-[0.14em] text-[#F6D98B] shadow-[0_0_20px_rgba(214,179,106,0.18)]">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F6D98B] opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#F6D98B]" />
        </span>
        Sunday Service Window Open
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#D6B36A]/25 bg-[#2A1408]/80 px-4 py-2 text-sm font-black uppercase tracking-[0.14em] text-[#E8D7B0]">
      <Clock className="h-4 w-4 text-[#F6D98B]" />
      Closed • Opens in {timeUntilOpen}
    </div>
  );
}

function InfoCard({
  title,
  icon,
  children,
  center,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`${card} p-5 ${center ? 'text-center' : ''}`}>
      <h3 className={`mb-4 flex items-center gap-2 font-black text-[#FFF8E7] ${center ? 'justify-center' : ''}`}>
        {icon}
        {title}
      </h3>
      <div className="space-y-3 text-sm text-[#E8D7B0]/75">{children}</div>
    </div>
  );
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#D6B36A]/10 bg-[#120A05]/35 p-3">
      <span className="mt-0.5 shrink-0 text-[#F6D98B]">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
