import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Church,
  Clock,
  Gift,
  Megaphone,
  Mic,
  MicOff,
  Monitor,
  Radio,
  Save,
  Shield,
  Sparkles,
  Users,
  Video,
  VideoOff,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import PastorPayouts from './PastorPayouts';
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom';

type TabKey = 'sermon' | 'service' | 'prayers' | 'announcements' | 'payouts';

const page =
  'min-h-screen bg-[radial-gradient(circle_at_top,#8B5A2B22,transparent_34%),linear-gradient(135deg,#120A05_0%,#2A1408_42%,#3A1C0A_100%)] px-4 pb-10 pt-24 text-[#FFF8E7] md:px-8';

const panel =
  'rounded-[2rem] border border-[#D6B36A]/25 bg-[#1C0F08]/80 shadow-[0_0_45px_rgba(214,179,106,0.12)] backdrop-blur-xl';

const card =
  'rounded-2xl border border-[#D6B36A]/20 bg-[#241208]/75 shadow-[0_0_28px_rgba(214,179,106,0.08)] backdrop-blur-xl';

const input =
  'w-full rounded-xl border border-[#D6B36A]/25 bg-[#120A05]/70 px-4 py-3 text-[#FFF8E7] placeholder:text-[#E8D7B0]/35 outline-none transition focus:border-[#F6D98B]/60 focus:ring-2 focus:ring-[#D6B36A]/20';

const goldButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[#F6D98B]/40 bg-[#D6B36A] px-4 py-2 text-sm font-black text-[#1C0F08] shadow-[0_0_24px_rgba(214,179,106,0.22)] transition hover:bg-[#F6D98B] disabled:cursor-not-allowed disabled:opacity-50';

const brownButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[#D6B36A]/25 bg-[#2A1408]/80 px-4 py-2 text-sm font-bold text-[#F6D98B] transition hover:bg-[#3A1C0A] hover:text-[#FFF8E7]';

const liveButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-600 px-4 py-2 text-sm font-black text-white shadow-[0_0_24px_rgba(220,38,38,0.3)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50';

const endButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-400/40 bg-gray-700 px-4 py-2 text-sm font-black text-white transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50';

export default function PastorDashboard() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>('sermon');
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('');
  const [scripture, setScripture] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceTheme, setServiceTheme] = useState('');
  const [announcement, setAnnouncement] = useState('Troll Church is now LIVE! Join us for Sunday Service.');
  const [prayerCount, setPrayerCount] = useState(0);
  const [offeringCoins, setOfferingCoins] = useState(0);
  const [saving, setSaving] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isPrivateService, setIsPrivateService] = useState(false);

  const canAccess = Boolean(
    profile?.is_pastor ||
    profile?.role === 'pastor' ||
    profile?.troll_role === 'pastor' ||
    profile?.role === 'admin' ||
    (profile as any)?.is_admin
  );

  const isSunday = new Date().getDay() === 0;
  const hour = new Date().getHours();
  const serviceOpen = isSunday && hour >= 13 && hour < 15;

  // LiveKit integration for church broadcast
  const churchRoomId = useMemo(() => {
    if (!profile?.id) return null;
    return `church-service-${profile.id}-${new Date().toISOString().split('T')[0]}`;
  }, [profile?.id]);

  const {
    isConnected,
    isPublishing,
    isJoining,
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    joinAsPublisher,
    leaveRoom,
    toggleMicrophone,
    toggleCamera,
    setMicEnabled,
    getMicEnabled,
  } = useLiveKitRoom({
    roomId: churchRoomId || '',
    roomType: 'church',
    role: 'publisher',
    publish: false,
    userName: profile?.username || profile?.display_name,
  });

  const viewerCount = remoteUsers.length;
  const isMicOn = getMicEnabled();

  const toggleMic = useCallback(async () => {
    await toggleMicrophone();
    toast.info(getMicEnabled() ? 'Microphone muted' : 'Microphone unmuted');
  }, [toggleMicrophone, getMicEnabled]);

  useEffect(() => {
    if (profile && !canAccess) {
      navigate('/church');
      toast.error('Unauthorized access');
    }
  }, [profile, canAccess, navigate]);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchNotes = async () => {
      const { data } = await supabase
        .from('church_sermon_notes')
        .select('*')
        .eq('pastor_id', profile.id)
        .eq('date', date)
        .maybeSingle();

      setNotes(data?.notes || '');
      setTitle(data?.title || '');
      setScripture(data?.scripture || '');
      setServiceTheme(data?.service_theme || '');
    };

    void fetchNotes();
  }, [date, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    const loadStats = async () => {
      const today = new Date().toISOString().split('T')[0];

      const [{ count: prayers }, { data: gifts }] = await Promise.all([
        supabase
          .from('church_prayers')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', `${today}T00:00:00`),
        supabase
          .from('coin_transactions')
          .select('amount, coins, metadata, created_at')
          .eq('source', 'church_gift')
          .gte('created_at', `${today}T00:00:00`),
      ]);

      setPrayerCount(prayers || 0);
      setOfferingCoins(
        (gifts || []).reduce((sum: number, row: any) => {
          return sum + Number(row.coins || row.amount || 0);
        }, 0)
      );
    };

    void loadStats();
  }, [profile?.id]);

  const completion = useMemo(() => {
    let score = 0;
    if (title.trim()) score += 25;
    if (scripture.trim()) score += 25;
    if (serviceTheme.trim()) score += 20;
    if (notes.trim().length > 50) score += 30;
    return score;
  }, [title, scripture, serviceTheme, notes]);

  const handleSave = async () => {
    if (!profile?.id) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('church_sermon_notes')
        .upsert(
          {
            pastor_id: profile.id,
            date,
            title,
            scripture,
            service_theme: serviceTheme,
            notes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'pastor_id, date' }
        );

      if (error) throw error;

      toast.success('Sermon notes saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const handleBroadcast = async () => {
    if (!profile?.id) return;

    setBroadcasting(true);

    try {
      const { error } = await supabase.from('admin_broadcasts').insert({
        message: announcement || 'Troll Church is now LIVE! Join us for Sunday Service.',
        type: 'church',
        is_active: true,
        created_by: profile.id,
      });

      if (error) throw error;

      toast.success('Church announcement sent');
    } catch (error) {
      console.error(error);
      toast.error('Failed to send broadcast');
    } finally {
      setBroadcasting(false);
    }
  };

  const handleGoLive = async () => {
    if (!profile?.id || !churchRoomId) return;

    try {
      const { data: session, error: sessionError } = await supabase
        .from('church_live_sessions')
        .insert({
          pastor_id: profile.id,
          room_name: churchRoomId,
          livekit_room_id: churchRoomId,
          status: 'live',
          sermon_title: title || 'Sunday Service',
          scripture_reference: scripture || null,
          is_private: isPrivateService,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;
      setSessionId(session.id);

      await joinAsPublisher(profile.id);

      await supabase.from('admin_broadcasts').insert({
        message: `Troll Church is LIVE! "${title || 'Sunday Service'}" — Join now!`,
        type: 'church',
        is_active: true,
        created_by: profile.id,
      });

      const wallPostContent = `Troll Church is LIVE! Join the service: /church/live/${session.id}`;
      const { error: wallPostError } = await supabase.from('troll_wall_posts').insert({
        user_id: profile.id,
        username: 'MaiTroll System',
        post_type: 'stream_announce',
        content: wallPostContent,
        is_system_generated: true,
        metadata: {
          live_service: true,
          church_service_session_id: session.id,
          url: `/church/live/${session.id}`,
        },
      });

      if (wallPostError) {
        console.error('[PastorDashboard] failed to create church live wall post', wallPostError);
      }

      toast.success('Church service is now LIVE!');
      navigate(`/church/live/${session.id}`);
    } catch (err: any) {
      console.error('Go live error:', err);
      toast.error(err?.message || 'Failed to go live');
    }
  };

  const handleEndService = async () => {
    if (!sessionId) return;

    try {
      await leaveRoom();

      await supabase
        .from('church_live_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          attendee_count: viewerCount,
        })
        .eq('id', sessionId);

      // Remove the "Troll Church is LIVE" broadcast when service ends
      await supabase
        .from('admin_broadcasts')
        .delete()
        .eq('created_by', profile.id)
        .eq('type', 'church')
        .eq('is_active', true);

      setSessionId(null);
      toast.success('Church service ended');
    } catch (err: any) {
      console.error('End service error:', err);
      toast.error('Failed to end service');
    }
  };

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: 'sermon', label: 'Sermon', icon: <BookOpen className="h-4 w-4" /> },
    { key: 'service', label: 'Service', icon: <Church className="h-4 w-4" /> },
    { key: 'prayers', label: 'Prayers', icon: <Users className="h-4 w-4" /> },
    { key: 'announcements', label: 'Announcements', icon: <Megaphone className="h-4 w-4" /> },
    { key: 'payouts', label: 'Earnings', icon: <Gift className="h-4 w-4" /> },
  ];

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#120A05] text-[#F6D98B]">
        Loading pastor dashboard...
      </div>
    );
  }

  return (
    <div className={page}>
      <div className="pointer-events-none fixed inset-0 opacity-20">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[#D6B36A]/10 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className={`${panel} p-6`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#F6D98B]/35 bg-[#D6B36A]/15 shadow-[0_0_34px_rgba(214,179,106,0.22)]">
                <Church className="h-8 w-8 text-[#F6D98B]" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-[#D6B36A]">
                  Troll Church
                </p>
                <h1 className="bg-gradient-to-r from-[#F6D98B] via-[#FFF8E7] to-[#D6B36A] bg-clip-text text-4xl font-black text-transparent">
                  Pastor Dashboard
                </h1>
                <p className="mt-1 text-sm text-[#E8D7B0]/70">
                  Prepare service, manage prayers, send announcements, and review offerings.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge open={serviceOpen} live={isConnected} />
              <button onClick={() => navigate('/church')} className={brownButton}>
                View Church
              </button>
            </div>
          </div>
        </header>

        <nav className={`${panel} p-2`}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black transition ${
                  activeTab === tab.key
                    ? 'border-[#F6D98B]/45 bg-[#D6B36A] text-[#1C0F08] shadow-[0_0_24px_rgba(214,179,106,0.2)]'
                    : 'border-[#D6B36A]/15 bg-[#120A05]/60 text-[#E8D7B0]/70 hover:border-[#F6D98B]/35 hover:text-[#FFF8E7]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {activeTab === 'payouts' ? (
          <section className={`${panel} p-5`}>
            <PastorPayouts />
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className={`${panel} p-5`}>
              {activeTab === 'sermon' && (
                <div className="space-y-4">
                  <SectionTitle
                    icon={<BookOpen className="h-5 w-5 text-[#F6D98B]" />}
                    title="Sermon Builder"
                    subtitle="Prepare the title, scripture, theme, and notes for service."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Sermon Title">
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={input}
                        placeholder="Example: Faith Through the Storm"
                      />
                    </Field>

                    <Field label="Service Date">
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className={input}
                      />
                    </Field>

                    <Field label="Scripture Reference">
                      <input
                        value={scripture}
                        onChange={(e) => setScripture(e.target.value)}
                        className={input}
                        placeholder="Example: Psalm 23"
                      />
                    </Field>

                    <Field label="Service Theme">
                      <input
                        value={serviceTheme}
                        onChange={(e) => setServiceTheme(e.target.value)}
                        className={input}
                        placeholder="Hope, forgiveness, patience..."
                      />
                    </Field>
                  </div>

                  <Field label="Sermon Notes">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className={`${input} min-h-[420px] resize-none leading-relaxed`}
                      placeholder="Write sermon notes, talking points, prayer focus, call-to-action, announcements..."
                    />
                  </Field>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-[#E8D7B0]/65">
                      Sermon readiness:{' '}
                      <span className="font-black text-[#F6D98B]">{completion}%</span>
                    </div>

                    <button onClick={handleSave} disabled={saving} className={goldButton}>
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving...' : 'Save Notes'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'service' && (
                <div className="space-y-4">
                  <SectionTitle
                    icon={<Mic className="h-5 w-5 text-[#F6D98B]" />}
                    title="Sunday Service Controls"
                    subtitle="Go live with video and audio for your congregation."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <StatCard label="Service Window" value={serviceOpen ? 'Live Now' : 'Closed'} />
                    <StatCard label="Today" value={isSunday ? 'Sunday' : 'Not Sunday'} />
                    <StatCard label="Sermon Ready" value={`${completion}%`} />
                    <StatCard label="Offering Coins" value={offeringCoins.toLocaleString()} />
                  </div>

                  {/* Live Broadcast Controls */}
                  <div className={`${card} p-5`}>
                    <h3 className="mb-4 flex items-center gap-2 font-black text-[#FFF8E7]">
                      <Radio className="h-5 w-5 text-red-400" />
                      Church Broadcast
                    </h3>

                    {!isConnected ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="privateService"
                            checked={isPrivateService}
                            onChange={(e) => setIsPrivateService(e.target.checked)}
                            className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-purple-600 focus:ring-purple-500"
                          />
                          <label htmlFor="privateService" className="text-sm text-[#E8D7B0]/70">
                            Private service (invite only)
                          </label>
                        </div>

                        <button onClick={handleGoLive} disabled={isJoining} className={liveButton}>
                          <Video className="h-4 w-4" />
                          {isJoining ? 'Starting...' : 'Go Live'}
                        </button>

                        <p className="text-xs text-[#E8D7B0]/50">
                          Viewers will be able to watch, hear, and interact via the church page.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3">
                          <span className="relative flex h-3 w-3">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                          </span>
                          <span className="text-sm font-bold text-red-200">LIVE — Church Service Broadcasting</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-3 text-center">
                            <UsersRound className="mx-auto mb-1 h-5 w-5 text-cyan-400" />
                            <p className="text-lg font-black text-white">{viewerCount}</p>
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Viewers</p>
                          </div>
                          <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-3 text-center">
                            <Monitor className="mx-auto mb-1 h-5 w-5 text-green-400" />
                            <p className="text-lg font-black text-white">{isPublishing ? 'On' : 'Off'}</p>
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Publishing</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button onClick={toggleMic} className={`${brownButton} flex-1`}>
                            {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                            {isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                          </button>
                          <button onClick={toggleCamera} className={`${brownButton} flex-1`}>
                            {(localVideoTrack as any)?.isEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                            {(localVideoTrack as any)?.isEnabled ? 'Stop Camera' : 'Start Camera'}
                          </button>
                        </div>

                        <button onClick={handleEndService} className={`${endButton} w-full`}>
                          <VideoOff className="h-4 w-4" />
                          End Service
                        </button>
                      </div>
                    )}
                  </div>

                  <div className={`${card} p-5`}>
                    <h3 className="mb-2 font-black text-[#FFF8E7]">Service Checklist</h3>
                    <ChecklistItem done={Boolean(title)} text="Sermon title added" />
                    <ChecklistItem done={Boolean(scripture)} text="Scripture reference added" />
                    <ChecklistItem done={Boolean(serviceTheme)} text="Service theme added" />
                    <ChecklistItem done={notes.trim().length > 50} text="Sermon notes prepared" />
                    <ChecklistItem done={serviceOpen} text="Sunday 1 PM – 3 PM service window open" />
                    <ChecklistItem done={isConnected} text="Live broadcast active" />
                  </div>
                </div>
              )}

              {activeTab === 'prayers' && (
                <div className="space-y-4">
                  <SectionTitle
                    icon={<Users className="h-5 w-5 text-[#F6D98B]" />}
                    title="Prayer Room"
                    subtitle="Monitor prayer activity and community needs."
                  />

                  <div className="grid gap-4 md:grid-cols-3">
                    <StatCard label="Today's Prayers" value={prayerCount.toLocaleString()} />
                    <StatCard label="Service Status" value={serviceOpen ? 'Open' : 'Closed'} />
                    <StatCard label="Moderation" value="Pastor Led" />
                  </div>

                  <div className={`${card} p-5`}>
                    <p className="text-sm leading-relaxed text-[#E8D7B0]/75">
                      Prayer feed moderation should stay respectful, supportive, and community-centered.
                      Use the main church page to review live prayer activity.
                    </p>

                    <button onClick={() => navigate('/church')} className={`${brownButton} mt-4`}>
                      Open Prayer Feed
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'announcements' && (
                <div className="space-y-4">
                  <SectionTitle
                    icon={<Megaphone className="h-5 w-5 text-[#F6D98B]" />}
                    title="Church Announcements"
                    subtitle="Send global church alerts and Sunday service notices."
                  />

                  <Field label="Announcement Message">
                    <textarea
                      value={announcement}
                      onChange={(e) => setAnnouncement(e.target.value)}
                      className={`${input} min-h-[180px] resize-none`}
                    />
                  </Field>

                  <button onClick={handleBroadcast} disabled={broadcasting} className={goldButton}>
                    <Bell className="h-4 w-4" />
                    {broadcasting ? 'Sending...' : 'Send Church Alert'}
                  </button>
                </div>
              )}
            </section>

            <aside className="space-y-6">
              <div className={`${card} p-5`}>
                <h3 className="mb-4 flex items-center gap-2 font-black text-[#FFF8E7]">
                  <Sparkles className="h-5 w-5 text-[#F6D98B]" />
                  Service Snapshot
                </h3>

                <div className="space-y-3">
                  <SummaryRow label="Date" value={date} />
                  <SummaryRow label="Title" value={title || 'Not set'} />
                  <SummaryRow label="Scripture" value={scripture || 'Not set'} />
                  <SummaryRow label="Theme" value={serviceTheme || 'Not set'} />
                  <SummaryRow label="Readiness" value={`${completion}%`} />
                  <SummaryRow label="Broadcast" value={isConnected ? 'LIVE' : 'Offline'} />
                </div>
              </div>

              <div className={`${card} p-5`}>
                <h3 className="mb-4 flex items-center gap-2 font-black text-[#FFF8E7]">
                  <Gift className="h-5 w-5 text-[#F6D98B]" />
                  Sunday Gifts
                </h3>

                <div className="rounded-2xl border border-[#D6B36A]/15 bg-[#120A05]/45 p-5 text-center">
                  <p className="text-4xl font-black text-[#F6D98B]">
                    {offeringCoins.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-[#E8D7B0]/50">
                    Coins Received Today
                  </p>
                </div>
              </div>

              <div className={`${card} p-5`}>
                <h3 className="mb-4 flex items-center gap-2 font-black text-[#FFF8E7]">
                  <Shield className="h-5 w-5 text-[#F6D98B]" />
                  Pastor Access
                </h3>

                <p className="text-sm text-[#E8D7B0]/70">
                  This dashboard is limited to pastors, admins, and church staff.
                </p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ open, live }: { open: boolean; live: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${
        live
          ? 'border-red-400/45 bg-red-900/30 text-red-200'
          : open
            ? 'border-[#F6D98B]/45 bg-[#D6B36A]/20 text-[#F6D98B]'
            : 'border-[#D6B36A]/25 bg-[#2A1408]/80 text-[#E8D7B0]'
      }`}
    >
      {live && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
      )}
      <Clock className="h-4 w-4" />
      {live ? 'Broadcasting' : open ? 'Service Live' : 'Service Closed'}
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-2xl font-black text-[#FFF8E7]">
        {icon}
        {title}
      </h2>
      <p className="mt-1 text-sm text-[#E8D7B0]/65">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-black text-[#F6D98B]">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${card} p-5 text-center`}>
      <p className="text-2xl font-black text-[#F6D98B]">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-[#E8D7B0]/50">
        {label}
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#D6B36A]/10 py-2 last:border-b-0">
      <span className="text-sm text-[#E8D7B0]/55">{label}</span>
      <span className="max-w-[180px] truncate text-right text-sm font-black text-[#FFF8E7]">
        {value}
      </span>
    </div>
  );
}

function ChecklistItem({ done, text }: { done: boolean; text: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#D6B36A]/10 py-3 last:border-b-0">
      <CheckCircle2 className={`h-5 w-5 ${done ? 'text-[#F6D98B]' : 'text-[#E8D7B0]/25'}`} />
      <span className={done ? 'text-[#FFF8E7]' : 'text-[#E8D7B0]/45'}>{text}</span>
    </div>
  );
}
