import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, Camera, Check, Clock, Gift, MessageCircle, Mic, Play, Radio, Shield, Square, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import useSEO from '@/hooks/useSEO';
import { useAgoraRoom } from '@/hooks/useAgoraRoom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { isCalendarAdmin, isCalendarStaff, MAI_CALENDAR_PATH } from '@/lib/maiCalendar';

type OfficialEvent = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location: string | null;
  status: 'upcoming' | 'live' | 'completed' | 'canceled';
  visibility: 'public' | 'draft';
  is_official: boolean;
  agora_channel: string;
  official_host_id: string | null;
  live_started_at: string | null;
  live_ended_at: string | null;
  max_guest_slots: number;
};

type Participant = {
  user_id: string;
  display_name: string;
  status: 'requested' | 'approved' | 'rejected' | 'removed';
  assigned_slot: number | null;
  can_receive_gifts?: boolean;
};

type EventMessage = {
  id: string;
  sender_id: string;
  display_name: string;
  content: string;
  created_at: string;
};

type EventDetails = {
  event: OfficialEvent;
  participants: Participant[];
  messages: EventMessage[];
  myParticipant: Pick<Participant, 'status' | 'assigned_slot'> | null;
  freeCoinBalance: number;
};

async function callOfficialEvent<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('official-events', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

function RemoteVideo({ user }: { user: ReturnType<typeof useAgoraRoom>['remoteUsers'][number] }) {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user.videoTrack && videoRef.current) user.videoTrack.play(videoRef.current);
    return () => user.videoTrack?.stop();
  }, [user]);

  useEffect(() => {
    user.audioTrack?.play();
    return () => user.audioTrack?.stop();
  }, [user]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-slate-950">
      <div ref={videoRef} className="h-full w-full" />
      <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-white">{String(user.uid)}</span>
    </div>
  );
}

export default function OfficialEventsPage() {
  const { eventSlug } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const staff = isCalendarStaff(profile);
  const admin = isCalendarAdmin(profile);
  const [events, setEvents] = useState<OfficialEvent[]>([]);
  const [details, setDetails] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [viewerId, setViewerId] = useState(user?.id ?? '');
  const [guestName, setGuestName] = useState('');
  const [chatText, setChatText] = useState('');
  const [giftRecipient, setGiftRecipient] = useState('');
  const [giftAmount, setGiftAmount] = useState(10);
  const [joined, setJoined] = useState(false);

  const event = details?.event ?? null;
  const isHost = Boolean(event?.official_host_id && viewerId === event.official_host_id);
  const approved = details?.myParticipant?.status === 'approved';
  const role = isHost || approved ? 'publisher' : 'subscriber';
  const room = useAgoraRoom({
    channelName: event?.agora_channel ?? '',
    eventId: event?.id,
    userId: viewerId || 'unjoined',
    role,
    onError: (message) => toast.error(message),
  });

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      if (eventSlug) {
        const result = await callOfficialEvent<EventDetails>({ action: 'detail', event: eventSlug });
        setDetails(result);
        setEvents([]);
      } else {
        const result = await callOfficialEvent<{ events: OfficialEvent[] }>({ action: 'list' });
        setEvents(result.events ?? []);
        setDetails(null);
      }
    } catch (error) {
      console.error('[official-events] Load failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load official events');
    } finally {
      setLoading(false);
    }
  }, [eventSlug]);

  useEffect(() => {
    setViewerId(user?.id ?? '');
  }, [user?.id]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!event) return;
    const timer = window.setInterval(() => {
      void loadPage();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [event, loadPage]);

  useEffect(() => {
    setJoined(room.isConnected);
  }, [room.isConnected]);

  const orderedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [events],
  );

  useSEO({
    title: event ? `${event.title} | MaiTroll Official Events` : 'Official Events | MaiTroll',
    description: event?.description || 'Join MaiTroll official community events and live shows.',
    canonical: event ? `https://www.maitroll.com/events/${event.slug}` : 'https://www.maitroll.com/events',
    robots: 'index, follow',
    ogImage: event?.banner_url || undefined,
    structuredData: event ? {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.title,
      description: event.description || '',
      startDate: event.starts_at,
      endDate: event.ends_at,
      eventStatus: event.status === 'canceled'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      location: { '@type': 'VirtualLocation', name: 'MaiTroll Agora Event' },
      organizer: { '@type': 'Organization', name: 'MaiTroll', url: 'https://www.maitroll.com' },
      url: `https://www.maitroll.com/events/${event.slug}`,
      image: event.banner_url || undefined,
    } : undefined,
  });

  const ensureUser = useCallback(async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session?.user) {
      setViewerId(sessionData.session.user.id);
      return sessionData.session.user.id;
    }
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (!data.user) throw new Error('Could not create an anonymous event session');
    setViewerId(data.user.id);
    return data.user.id;
  }, []);

  const performAction = useCallback(async (
    action: string,
    values: Record<string, unknown> = {},
    shouldAuthenticate = true,
  ) => {
    setBusy(true);
    try {
      if (shouldAuthenticate) await ensureUser();
      const result = await callOfficialEvent<Record<string, unknown>>({
        action,
        ...(event ? { event: event.id } : {}),
        ...values,
      });
      if (action === 'chat' && result.message) {
        setChatText('');
      }
      if (action === 'gift' && result.gift) {
        toast.success('Event gift sent');
        setGiftRecipient('');
      } else if (action === 'moderate_chat') {
        toast.success('Message removed');
      } else if (['start', 'stop', 'request', 'approve', 'reject', 'remove'].includes(action)) {
        toast.success(action === 'request' ? 'Guest request submitted' : 'Event updated');
      }
      await loadPage();
      return result;
    } catch (error) {
      console.error(`[official-events] ${action} failed:`, error);
      toast.error(error instanceof Error ? error.message : 'Event action failed');
      return null;
    } finally {
      setBusy(false);
    }
  }, [ensureUser, event, loadPage]);

  const joinRoom = async () => {
    try {
      await ensureUser();
      await room.joinChannel();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not join this event');
    }
  };

  const leaveRoom = async () => {
    await room.leaveChannel();
    setJoined(false);
  };

  if (loading) {
    return <main className="min-h-screen bg-[#070b19] p-8 text-center text-slate-300">Loading official events…</main>;
  }

  if (!eventSlug) {
    return (
      <main className="min-h-screen bg-[#070b19] px-4 py-10 text-white sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">MaiTroll Agora</p>
              <h1 className="mt-2 text-3xl font-black sm:text-5xl">Official Events</h1>
              <p className="mt-2 text-slate-400">Watch live events, request a guest seat, and join the conversation.</p>
            </div>
            <Link to={MAI_CALENDAR_PATH} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/5">
              <Calendar className="mr-2 inline h-4 w-4" /> Calendar
            </Link>
          </div>
          {orderedEvents.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center text-slate-400">No official events are scheduled yet.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {orderedEvents.map((item) => (
                <Link key={item.id} to={`/events/${item.slug}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-cyan-400/40">
                  {item.banner_url && <img src={item.banner_url} alt="" className="h-44 w-full object-cover" />}
                  <div className="p-5">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${item.status === 'live' ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'}`}>
                      {item.status === 'live' ? 'LIVE NOW' : item.status.toUpperCase()}
                    </span>
                    <h2 className="mt-3 text-xl font-black">{item.title}</h2>
                    <p className="mt-2 flex items-center gap-2 text-xs text-slate-400"><Clock className="h-4 w-4" />{new Date(item.starts_at).toLocaleString()}</p>
                    {item.description && <p className="mt-3 line-clamp-3 text-sm text-slate-300">{item.description}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  if (!event) {
    return <main className="min-h-screen bg-[#070b19] p-8 text-center text-slate-300">Official event not found.</main>;
  }

  const approvedParticipants = details?.participants.filter((participant) => participant.status === 'approved') ?? [];
  const requestedParticipants = details?.participants.filter((participant) => participant.status === 'requested') ?? [];

  return (
    <main className="min-h-screen bg-[#070b19] px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link to="/events" className="text-sm font-bold text-cyan-200 hover:text-white">← All official events</Link>
          <Link to={MAI_CALENDAR_PATH} className="text-sm font-bold text-slate-400 hover:text-white">Calendar</Link>
        </div>

        <header className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {event.banner_url && <img src={event.banner_url} alt="" className="h-52 w-full object-cover sm:h-72" />}
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${event.status === 'live' ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'}`}>
                {event.status === 'live' ? '● LIVE' : event.status.toUpperCase()}
              </span>
              <span className="text-xs text-slate-500">AGORA • up to 1 host + {event.max_guest_slots} guests</span>
            </div>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">{event.title}</h1>
            {event.description && <p className="mt-3 max-w-3xl whitespace-pre-line text-slate-300">{event.description}</p>}
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Clock className="h-4 w-4" />{new Date(event.starts_at).toLocaleString()} {event.timezone}</p>
            {admin && (
              <div className="mt-5 flex gap-2">
                {isHost && (event.status === 'upcoming' || event.status === 'live') && (
                  <button onClick={() => navigate(`/broadcast/setup?event=${encodeURIComponent(event.slug)}`)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black">
                    <Play className="mr-2 inline h-4 w-4" />{event.status === 'live' ? 'Open event studio' : 'Start in broadcast setup'}
                  </button>
                )}
                {event.status === 'live' && (
                  <button disabled={busy} onClick={() => void performAction('stop')} className="rounded-xl border border-red-400/30 px-4 py-2 text-sm font-black text-red-200 disabled:opacity-50">
                    <Square className="mr-2 inline h-4 w-4" />End event
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {event.status === 'live' && (
          <section className="mb-6 grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-black"><Radio className="h-4 w-4 text-red-400" />Live room</h2>
                {!room.isConnected ? (
                  <button disabled={room.isJoining || busy} onClick={() => void joinRoom()} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50">
                    {room.isJoining ? 'Connecting…' : isHost ? 'Join as host' : approved ? 'Join as speaker' : 'Join as viewer'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    {role === 'publisher' && <><button onClick={() => void room.toggleCamera()} title="Toggle camera" className="rounded-lg border border-white/10 p-2"><Camera className="h-4 w-4" /></button><button onClick={() => void room.toggleMicrophone()} title="Toggle microphone" className="rounded-lg border border-white/10 p-2"><Mic className="h-4 w-4" /></button></>}
                    <button onClick={() => void leaveRoom()} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold">Leave</button>
                  </div>
                )}
              </div>
              {room.error && <p className="mb-3 rounded-lg bg-red-500/10 p-2 text-xs text-red-200">{room.error}</p>}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {room.localVideoTrack && room.isPublishing && <LocalVideo track={room.localVideoTrack} name={isHost ? 'Host' : 'You'} />}
                {room.remoteUsers.slice(0, 8).map((remote) => <RemoteVideo key={String(remote.uid)} user={remote} />)}
                {!joined && !room.remoteUsers.length && <div className="col-span-full rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">Join the room to watch the host and guest speakers.</div>}
              </div>
              {approved && <p className="mt-3 text-xs text-emerald-300"><Check className="mr-1 inline h-3.5 w-3.5" />Your guest seat is approved (slot {details?.myParticipant?.assigned_slot}).</p>}
            </div>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="mb-3 flex items-center gap-2 font-black"><Users className="h-4 w-4 text-cyan-300" />Guest seats ({approvedParticipants.length}/{event.max_guest_slots})</h2>
                {!approved && details?.myParticipant?.status !== 'requested' && event.official_host_id !== viewerId && (
                  <div className="mb-3 space-y-2">
                    <input value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={80} placeholder="Name shown to event staff" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
                    <button disabled={busy} onClick={() => void performAction('request', { display_name: guestName })} className="w-full rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-100 disabled:opacity-50">Request a guest seat</button>
                  </div>
                )}
                {details?.myParticipant?.status === 'requested' && <p className="mb-3 text-xs text-amber-200">Your guest-seat request is waiting for staff approval.</p>}
                <div className="space-y-2">
                  {approvedParticipants.map((participant) => (
                    <div key={participant.user_id} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
                      <span className="truncate">{participant.display_name}</span>
                      <span className="ml-2 text-[10px] text-slate-500">Slot {participant.assigned_slot}</span>
                      {approved && (details?.freeCoinBalance ?? 0) > 0 && participant.can_receive_gifts && participant.user_id !== viewerId && <button title="Send free-coin gift" onClick={() => setGiftRecipient(participant.user_id)} className="ml-2 text-amber-300"><Gift className="h-4 w-4" /></button>}
                    </div>
                  ))}
                  {approvedParticipants.length === 0 && <p className="text-xs text-slate-500">No approved guests yet.</p>}
                </div>
                {staff && requestedParticipants.length > 0 && (
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <p className="mb-2 text-xs font-bold uppercase text-slate-500">Pending requests</p>
                    {requestedParticipants.map((participant) => (
                      <div key={participant.user_id} className="mb-2 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{participant.display_name}</span>
                        <span className="flex shrink-0 gap-1">
                          <button disabled={busy} onClick={() => void performAction('approve', { user_id: participant.user_id })} className="rounded bg-emerald-500/20 p-1 text-emerald-200"><Check className="h-4 w-4" /></button>
                          <button disabled={busy} onClick={() => void performAction('reject', { user_id: participant.user_id })} className="rounded bg-red-500/20 p-1 text-red-200"><X className="h-4 w-4" /></button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {giftRecipient && (
                  <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
                    <p className="text-xs font-bold text-amber-100">Free coin balance: {details?.freeCoinBalance ?? 0}</p>
                    <div className="mt-2 flex gap-2">
                      <select value={giftAmount} onChange={(e) => setGiftAmount(Number(e.target.value))} className="min-w-0 flex-1 rounded bg-slate-950 px-2 py-2 text-xs text-white">
                        {[1, 5, 10, 25, 50, 100].map((amount) => <option key={amount} value={amount}>{amount} free coins</option>)}
                      </select>
                      <button disabled={busy || (details?.freeCoinBalance ?? 0) < giftAmount} onClick={() => void performAction('gift', { recipient_id: giftRecipient, amount: giftAmount, request_id: crypto.randomUUID() })} className="rounded bg-amber-500 px-3 text-xs font-black text-slate-950 disabled:opacity-50">Send</button>
                      <button onClick={() => setGiftRecipient('')} className="text-slate-400"><X className="h-4 w-4" /></button>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">Free coins only; these gifts do not credit cashout balances.</p>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="mb-3 flex items-center gap-2 font-black"><MessageCircle className="h-4 w-4 text-violet-300" />Event chat</h2>
                <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
                  {details?.messages.map((message) => (
                    <div key={message.id} className="flex items-start justify-between gap-2">
                      <p className="break-words text-xs"><strong className="text-cyan-200">{message.display_name}: </strong><span className="text-slate-300">{message.content}</span></p>
                      {staff && <button title="Remove message" disabled={busy} onClick={() => void performAction('moderate_chat', { message_id: message.id })} className="shrink-0 text-red-300"><X className="h-3.5 w-3.5" /></button>}
                    </div>
                  ))}
                  {!details?.messages.length && <p className="text-xs text-slate-500">No messages yet.</p>}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); if (chatText.trim()) void performAction('chat', { content: chatText.trim() }); }} className="flex gap-2">
                  <input value={chatText} onChange={(e) => setChatText(e.target.value)} maxLength={1000} placeholder="Write a message" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white" />
                  <button disabled={busy || !chatText.trim()} className="rounded-lg bg-violet-500 px-3 text-xs font-black disabled:opacity-50">Send</button>
                </form>
              </section>
            </aside>
          </section>
        )}

        {event.status !== 'live' && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <Shield className="mx-auto h-8 w-8 text-cyan-300" />
            <p className="mt-3 font-bold">{event.status === 'upcoming' ? 'This event has not started yet.' : `This event is ${event.status}.`}</p>
            {event.status === 'upcoming' && <p className="mt-1 text-sm text-slate-400">Come back when the host starts the live room.</p>}
          </section>
        )}
      </div>
    </main>
  );
}

function LocalVideo({ track, name }: { track: { play: (element: HTMLElement) => void; stop: () => void }; name: string }) {
  const videoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (videoRef.current) track.play(videoRef.current);
    return () => track.stop();
  }, [track]);
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-cyan-300/30 bg-slate-950">
      <div ref={videoRef} className="h-full w-full" />
      <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-white">{name}</span>
    </div>
  );
}
