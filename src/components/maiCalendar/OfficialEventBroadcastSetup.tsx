import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Camera, CameraOff, Loader2, Mic, MicOff, Radio, Square } from 'lucide-react';
import { toast } from 'sonner';
import { useAgoraRoom } from '@/hooks/useAgoraRoom';
import { useAuthStore } from '@/lib/store';
import { isCalendarAdmin, MAI_CALENDAR_PATH } from '@/lib/maiCalendar';
import { supabase } from '@/lib/supabase';

interface OfficialEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  status: 'upcoming' | 'live' | 'completed' | 'canceled';
  visibility: 'public' | 'draft';
  agora_channel: string;
  official_host_id: string | null;
}

function LocalEventVideo({ track }: { track: NonNullable<ReturnType<typeof useAgoraRoom>['localVideoTrack']> }) {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    track.play(videoRef.current);
    return () => track.stop();
  }, [track]);

  return <div ref={videoRef} className="aspect-video w-full rounded-xl bg-black" />;
}

async function callOfficialEvent<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('official-events', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export default function OfficialEventBroadcastSetup({ eventSlug }: { eventSlug: string }) {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [event, setEvent] = useState<OfficialEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const isAdmin = isCalendarAdmin(profile);
  const isHost = Boolean(user?.id && event?.official_host_id === user.id);
  const room = useAgoraRoom({
    channelName: event?.agora_channel ?? '',
    eventId: event?.id,
    userId: user?.id ?? 'unjoined',
    role: 'publisher',
    onError: (message) => toast.error(message),
  });

  const loadEvent = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callOfficialEvent<{ event: OfficialEvent }>({
        action: 'detail',
        event: eventSlug,
      });
      setEvent(result.event);
    } catch (error) {
      console.error('[OfficialEventBroadcastSetup] Event load failed:', error);
      toast.error(error instanceof Error ? error.message : 'Could not load this event');
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventSlug]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  const handleStartOrJoin = async () => {
    if (!event || !user?.id || !isAdmin || !isHost) {
      toast.error('Only the admin who created this event can start its broadcast.');
      return;
    }
    if (event.status !== 'upcoming' && event.status !== 'live') {
      toast.error('This event is no longer available to broadcast.');
      return;
    }

    setBusy(true);
    try {
      const joined = room.isConnected || await room.joinChannel();
      if (!joined) {
        throw new Error(room.error || 'Could not connect to the Agora event room.');
      }

      if (event.status === 'upcoming') {
        const result = await callOfficialEvent<{ event: OfficialEvent }>({
          action: 'start',
          event: event.id,
        });
        setEvent(result.event);
      }
      toast.success(event.status === 'upcoming' ? 'Your Agora event is live' : 'Joined your live event');
    } catch (error) {
      console.error('[OfficialEventBroadcastSetup] Broadcast start failed:', error);
      await room.leaveChannel();
      toast.error(error instanceof Error ? error.message : 'Failed to start the event broadcast');
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    if (!event) return;
    setBusy(true);
    try {
      await callOfficialEvent({ action: 'stop', event: event.id });
      await room.leaveChannel();
      setEvent((current) => current ? { ...current, status: 'completed' } : current);
      toast.success('Event broadcast ended');
    } catch (error) {
      console.error('[OfficialEventBroadcastSetup] Event end failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to end the event');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#070b19] text-slate-300"><Loader2 className="h-7 w-7 animate-spin text-cyan-300" /></main>;
  }

  if (!event) {
    return <main className="min-h-screen bg-[#070b19] p-8 text-center text-slate-300">Event not found.</main>;
  }

  if (!user || !isAdmin || !isHost) {
    return (
      <main className="min-h-screen bg-[#070b19] px-4 py-12 text-center text-white">
        <p className="text-lg font-black">Admin event broadcaster</p>
        <p className="mt-2 text-sm text-slate-400">Sign in as the admin who created this event to start its Agora broadcast.</p>
        <button onClick={() => navigate(`/events/${encodeURIComponent(event.slug)}`)} className="mt-5 rounded-xl bg-cyan-500 px-4 py-2 font-bold text-slate-950">View event</button>
      </main>
    );
  }

  const isLive = event.status === 'live';

  return (
    <main className="min-h-screen bg-[#070b19] px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => navigate(MAI_CALENDAR_PATH)} className="flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-white">
            <Calendar className="h-4 w-4" /> Calendar
          </button>
          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${isLive ? 'border-red-400/40 bg-red-500/10 text-red-200' : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'}`}>
            {isLive ? 'Event live' : event.status}
          </span>
        </div>

        <section className="overflow-hidden rounded-2xl border border-cyan-300/20 bg-white/[0.03] shadow-2xl">
          {event.banner_url && <img src={event.banner_url} alt="" className="h-40 w-full object-cover sm:h-64" />}
          <div className="p-5 sm:p-8">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-200"><Radio className="h-4 w-4 text-red-400" /> MaiTroll Agora Event Studio</p>
            <h1 className="mt-3 text-2xl font-black sm:text-4xl">{event.title}</h1>
            {event.description && <p className="mt-3 max-w-3xl whitespace-pre-line text-sm text-slate-300">{event.description}</p>}

            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_260px]">
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                {room.localVideoTrack && room.isPublishing
                  ? <LocalEventVideo track={room.localVideoTrack} />
                  : <div className="grid aspect-video place-items-center rounded-xl bg-black text-sm text-slate-500">{isLive ? 'Join Agora to reconnect your camera and microphone.' : 'Your camera and microphone connect when you start the event.'}</div>}
                {room.remoteUsers.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {room.remoteUsers.slice(0, 8).map((remote) => (
                      <RemoteEventVideo key={String(remote.uid)} user={remote} />
                    ))}
                  </div>
                )}
              </div>
              <aside className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Broadcast controls</p>
                {room.error && <p role="alert" className="rounded-lg bg-red-500/10 p-2 text-xs text-red-200">{room.error}</p>}
                {!room.isConnected ? (
                  <button disabled={busy || room.isJoining || (event.status !== 'upcoming' && event.status !== 'live')} onClick={() => void handleStartOrJoin()} className="rounded-xl bg-gradient-to-r from-red-600 to-rose-500 px-4 py-3 text-sm font-black disabled:opacity-50">
                    {room.isJoining || busy ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Radio className="mr-2 inline h-4 w-4" />}
                    {event.status === 'live' ? 'Join live event' : 'Start event broadcast'}
                  </button>
                ) : (
                  <>
                    <button onClick={() => { void room.toggleCamera(); setCameraEnabled((enabled) => !enabled); }} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold">
                      {cameraEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />} Camera
                    </button>
                    <button onClick={() => { void room.toggleMicrophone(); setMicrophoneEnabled((enabled) => !enabled); }} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold">
                      {microphoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />} Microphone
                    </button>
                    {isLive && (
                      <button disabled={busy} onClick={() => void handleEnd()} className="rounded-xl border border-red-400/30 px-4 py-2 text-sm font-black text-red-200 disabled:opacity-50">
                        <Square className="mr-2 inline h-4 w-4" />End event
                      </button>
                    )}
                    <button onClick={() => void room.leaveChannel()} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300">Leave studio</button>
                  </>
                )}
                <p className="mt-auto text-[11px] leading-5 text-slate-500">The public event tile links viewers to the Agora event room. Keep this studio open while broadcasting.</p>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function RemoteEventVideo({ user }: { user: ReturnType<typeof useAgoraRoom>['remoteUsers'][number] }) {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user.videoTrack && videoRef.current) user.videoTrack.play(videoRef.current);
    return () => user.videoTrack?.stop();
  }, [user]);

  useEffect(() => {
    user.audioTrack?.play();
    return () => user.audioTrack?.stop();
  }, [user]);

  return <div ref={videoRef} className="aspect-video rounded-lg bg-black" />;
}
