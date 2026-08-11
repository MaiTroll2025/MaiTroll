import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Scale,
  AlertCircle,
  LogOut,
  Send,
  Gavel,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  Shield,
  Briefcase,
  UserCheck,
  UserX,
  ChevronDown,
} from "lucide-react";
import {
  Room,
  RoomEvent,
  Track,
  LocalVideoTrack,
  LocalAudioTrack,
  RemoteTrack,
  RemoteParticipant,
  createLocalAudioTrack,
  createLocalVideoTrack,
} from "livekit-client";
import { courtSystem, CourtSession } from "@/lib/courtSystem";
import { useAuthStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type CourtRole =
  | "admin"
  | "ceo"
  | "lead_troll_officer"
  | "troll_officer"
  | "secretary"
  | "prosecutor"
  | "judge"
  | "attorney"
  | "pastor"
  | "moderator"
  | "auctioneer"
  | "lead_officer"
  | "officer"
  | "user";

type CourtBoxRole =
  | "judge"
  | "prosecutor"
  | "attorney"
  | "witness"
  | "defendant"
  | "audience";

interface LiveCourtSessionRecord {
  id: string;
  status: string;
  judge_user_id: string | null;
  judge_joined_at: string | null;
  livekit_room_name: string | null;
  started_by: string | null;
  title?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface CourtParticipantRecord {
  id: string;
  court_session_id: string;
  user_id: string;
  box_role: CourtBoxRole;
  status: "joined" | "left" | "removed";
  joined_at: string;
  left_at: string | null;
}

interface CourtSummonsRecord {
  id: string;
  court_session_id: string | null;
  summoned_user_id: string;
  status: "summoned" | "appeared" | "absent_arrested" | "dismissed";
  appeared_at: string | null;
  arrested_at: string | null;
}

interface TrackBundle {
  videoTrack?: LocalVideoTrack | RemoteTrack | null;
  audioTrack?: LocalAudioTrack | RemoteTrack | null;
  isMicMuted?: boolean;
  isCameraOff?: boolean;
}

function normalizeCourtRole(profile: any): CourtRole {
  if (!profile) return "user";

  if (profile.role === "admin" || profile.is_admin) return "admin";
  if (profile.role === "ceo" || profile.is_ceo) return "ceo";

  if (
    profile.is_lead_officer ||
    profile.role === "lead_troll_officer" ||
    profile.role === "lead_officer"
  ) {
    return "lead_troll_officer";
  }

  if (
    profile.is_troll_officer ||
    profile.role === "troll_officer" ||
    profile.role === "officer"
  ) {
    return "troll_officer";
  }

  if (profile.role === "secretary" || profile.is_secretary) return "secretary";
  if (profile.role === "prosecutor" || profile.is_prosecutor) return "prosecutor";
  if (profile.role === "judge" || profile.is_judge) return "judge";
  if (profile.role === "attorney" || profile.is_attorney) return "attorney";
  if (profile.role === "pastor" || profile.is_pastor) return "pastor";
  if (profile.role === "moderator" || profile.is_moderator) return "moderator";
  if (profile.role === "auctioneer" || profile.is_auctioneer) return "auctioneer";

  return "user";
}

function canRoleEnterCourt(role: CourtRole) {
  return role !== "user";
}

function canRoleStartCourt(role: CourtRole) {
  return (
    role === "admin" ||
    role === "ceo" ||
    role === "lead_troll_officer" ||
    role === "judge"
  );
}

function canJoinBox(role: CourtRole, boxRole: CourtBoxRole) {
  if (boxRole === "audience") return true;
  if (boxRole === "judge") return canRoleStartCourt(role) || (role as any) === "judge";
  if (boxRole === "prosecutor") return canRoleStartCourt(role) || role === "prosecutor";
  if (boxRole === "attorney") return canRoleStartCourt(role) || role === "attorney";
  if (boxRole === "witness") return true;
  if (boxRole === "defendant") return true;
  return false;
}

function getBoxTitle(boxRole: CourtBoxRole) {
  switch (boxRole) {
    case "judge":
      return "Judge Box";
    case "prosecutor":
      return "Prosecutor Box";
    case "attorney":
      return "Attorney Box";
    case "witness":
      return "Witness Box";
    case "defendant":
      return "Defendant Box";
    case "audience":
      return "Audience";
    default:
      return "Court Box";
  }
}

function getBoxIcon(boxRole: CourtBoxRole) {
  switch (boxRole) {
    case "judge":
      return <Gavel size={15} />;
    case "prosecutor":
      return <Shield size={15} />;
    case "attorney":
      return <Briefcase size={15} />;
    case "witness":
      return <UserCheck size={15} />;
    case "defendant":
      return <UserX size={15} />;
    case "audience":
      return <Users size={15} />;
    default:
      return <Scale size={15} />;
  }
}

function normalizeCourtUuid(value?: string | null): string | null {
  if (!value) return null;

  return value
    .replace(/^court-/, "")
    .replace(/^troll-court-/, "");
}

function CourtBox({
  boxRole,
  occupantName,
  isCurrentUserBox,
  trackBundle,
  isJoined,
}: {
  boxRole: CourtBoxRole;
  occupantName?: string | null;
  isCurrentUserBox: boolean;
  trackBundle?: TrackBundle;
  isJoined: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const videoTrack = trackBundle?.videoTrack || null;
  const audioTrack = trackBundle?.audioTrack || null;
  const hasVideo = !!videoTrack && !trackBundle?.isCameraOff;

  useEffect(() => {
    const videoEl = videoRef.current;

    if (!videoEl || !videoTrack) return;

    try {
      videoTrack.attach(videoEl);
    } catch (error) {
      console.warn(`[TrollCourt] ${boxRole} video attach failed:`, error);
    }

    return () => {
      try {
        videoTrack.detach(videoEl);
        videoEl.srcObject = null;
      } catch {
        // no-op
      }
    };
  }, [videoTrack, boxRole]);

  useEffect(() => {
    const audioEl = audioRef.current;

    if (!audioEl || !audioTrack) return;

    try {
      audioTrack.attach(audioEl);
    } catch (error) {
      console.warn(`[TrollCourt] ${boxRole} audio attach failed:`, error);
    }

    return () => {
      try {
        audioTrack.detach(audioEl);
        audioEl.srcObject = null;
      } catch {
        // no-op
      }
    };
  }, [audioTrack, boxRole]);

  return (
    <div className="relative min-h-[190px] overflow-hidden rounded-2xl border border-purple-400/40 bg-gray-950/90 shadow-[0_0_22px_rgba(168,85,247,0.25)]">
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full border border-purple-300/40 bg-gray-950/90 px-3 py-1 text-[11px] font-black text-purple-100">
        {getBoxIcon(boxRole)}
        {getBoxTitle(boxRole)}
      </div>

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-full border border-purple-300/30 bg-gray-950/90 px-3 py-1 text-[11px] text-purple-100">
        {trackBundle?.isMicMuted ? <MicOff size={13} /> : <Mic size={13} />}
        {trackBundle?.isCameraOff ? <VideoOff size={13} /> : <Video size={13} />}
      </div>

      <div className="h-[190px] w-full bg-gray-900">
        {isJoined && hasVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isCurrentUserBox}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-purple-950/70 to-gray-950 text-center">
            <Scale size={38} className="mb-2 text-purple-300" />
            <p className="max-w-[80%] truncate text-sm font-black text-purple-100">
              {isJoined ? occupantName || getBoxTitle(boxRole) : "Empty"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {isJoined
                ? trackBundle?.isCameraOff
                  ? "Camera off"
                  : "Connecting video..."
                : `${getBoxTitle(boxRole)} open`}
            </p>
          </div>
        )}

        {isJoined && audioTrack ? <audio ref={audioRef} autoPlay /> : null}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gray-950/85 px-3 py-2 backdrop-blur">
        <p className="truncate text-sm font-black text-purple-100">
          {isJoined ? occupantName || "Court Member" : "No one joined"}
        </p>
        <p className="text-[11px] text-gray-300">
          {isJoined
            ? `${trackBundle?.isMicMuted ? "Mic Off" : "Mic On"} • ${
                trackBundle?.isCameraOff ? "Camera Off" : "Camera Live"
              }`
            : "Waiting"}
        </p>
      </div>
    </div>
  );
}

function RoleActionMenu({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-xl border border-purple-400/40 bg-gray-950/90 px-4 py-3 text-left text-sm font-black text-purple-100 hover:bg-purple-950/50"
      >
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <ChevronDown size={16} className={open ? "rotate-180 transition" : "transition"} />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-purple-400/40 bg-gray-950 p-3 shadow-[0_0_24px_rgba(168,85,247,0.35)]">
          <div className="space-y-2">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({
  onClick,
  disabled,
  children,
  danger = false,
}: {
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "w-full rounded-lg px-3 py-2 text-left text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40",
        danger
          ? "bg-red-700 hover:bg-red-800 text-white"
          : "bg-purple-700 hover:bg-purple-800 text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function TrollCourtSession() {
  const navigate = useNavigate();
  const params = useParams();
  const routeCourtId = normalizeCourtUuid(params.id);

  const { user, profile } = useAuthStore();

  const roomRef = useRef<Room | null>(null);

  const [activeSession, setActiveSession] = useState<CourtSession | null>(null);
  const [liveCourtSession, setLiveCourtSession] = useState<LiveCourtSessionRecord | null>(null);
  const [participants, setParticipants] = useState<CourtParticipantRecord[]>([]);
  const [summons, setSummons] = useState<CourtSummonsRecord[]>([]);

  const [chatMessages, setChatMessages] = useState<{ user: string; message: string }[]>([]);
  const [chatInput, setChatInput] = useState("");

  const [isInitializing, setIsInitializing] = useState(false);
  const [isJoiningBox, setIsJoiningBox] = useState(false);
  const [isLiveKitConnected, setIsLiveKitConnected] = useState(false);

  const [currentBoxRole, setCurrentBoxRole] = useState<CourtBoxRole | null>(null);

  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [remoteTracksByIdentity, setRemoteTracksByIdentity] = useState<Record<string, TrackBundle>>({});

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);

  const currentUser = useMemo(() => {
    const role = normalizeCourtRole(profile);

    return {
      id: user?.id || "",
      name: profile?.username || user?.email || "Court User",
      role,
    };
  }, [user?.id, user?.email, profile]);

  const canEnterCourt = canRoleEnterCourt(currentUser.role);
  const canStartCourt = canRoleStartCourt(currentUser.role);

  const activeCourtId = liveCourtSession?.id || routeCourtId || null;
  const roomName =
    liveCourtSession?.livekit_room_name ||
    (activeCourtId ? `troll-court-${activeCourtId}` : null);

  const currentUserParticipant = participants.find(
    (participant) => participant.user_id === user?.id && participant.status === "joined"
  );

  const isSummonedCurrentUser = summons.some(
    (item) =>
      item.summoned_user_id === user?.id &&
      item.status === "summoned"
  );

  const tracksByUserId = useMemo(() => {
    const map: Record<string, TrackBundle> = {};

    for (const participant of participants) {
      const possibleIdentities = [
        participant.user_id,
        `user-${participant.user_id}`,
        `court-${participant.user_id}`,
        `${participant.box_role}-${participant.user_id}`,
      ];

      for (const identity of possibleIdentities) {
        if (remoteTracksByIdentity[identity]) {
          map[participant.user_id] = remoteTracksByIdentity[identity];
          break;
        }
      }
    }

    if (user?.id && currentBoxRole) {
      map[user.id] = {
        videoTrack: localVideoTrack,
        audioTrack: localAudioTrack,
        isMicMuted: !micEnabled,
        isCameraOff: !cameraEnabled,
      };
    }

    return map;
  }, [
    participants,
    remoteTracksByIdentity,
    user?.id,
    currentBoxRole,
    localVideoTrack,
    localAudioTrack,
    micEnabled,
    cameraEnabled,
  ]);

  const getLiveKitToken = useCallback(
    async (targetRoomName: string, boxRole: CourtBoxRole) => {
      if (!user?.id) throw new Error("Missing user.");

      const { data, error } = await supabase.functions.invoke("livekit-token", {
        body: {
          roomName: targetRoomName,
          identity: user.id,
          name: currentUser.name,
          metadata: {
            role: boxRole,
            courtRole: currentUser.role,
            userId: user.id,
          },
        },
      });

      if (error) throw new Error(error.message || "Unable to get LiveKit token.");

      const token = data?.token;
      const wsUrl = data?.wsUrl || data?.url || import.meta.env.VITE_LIVEKIT_URL;

      if (!token) throw new Error("LiveKit token missing from livekit-token response.");
      if (!wsUrl) throw new Error("LiveKit URL missing. Check VITE_LIVEKIT_URL.");

      return { token, wsUrl };
    },
    [user?.id, currentUser.name, currentUser.role]
  );

  const loadLiveCourtSession = useCallback(async () => {
    const cleanCourtId = normalizeCourtUuid(routeCourtId);

    if (!cleanCourtId) {
      const { data, error } = await supabase
        .from("troll_court_sessions")
        .select("*")
        .in("status", ["live", "active", "in_session"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) setLiveCourtSession(data as LiveCourtSessionRecord);
      return;
    }

    const { data, error } = await supabase
      .from("troll_court_sessions")
      .select("*")
      .eq("id", cleanCourtId)
      .maybeSingle();

    if (error) {
      console.warn("[TrollCourt] Session load failed:", error);
      return;
    }

    if (data) setLiveCourtSession(data as LiveCourtSessionRecord);
  }, [routeCourtId]);

  const loadParticipants = useCallback(async () => {
    if (!activeCourtId) return;

    const { data, error } = await supabase
      .from("troll_court_participants")
      .select("*")
      .eq("court_session_id", activeCourtId);

    if (error) {
      console.warn("[TrollCourt] Participants load failed:", error);
      return;
    }

    setParticipants((data || []) as CourtParticipantRecord[]);
  }, [activeCourtId]);

  const loadSummons = useCallback(async () => {
    if (!activeCourtId) return;

    const { data, error } = await supabase
      .from("troll_court_summons")
      .select("*")
      .eq("court_session_id", activeCourtId);

    if (error) {
      console.warn("[TrollCourt] Summons load failed:", error);
      return;
    }

    setSummons((data || []) as CourtSummonsRecord[]);
  }, [activeCourtId]);

  useEffect(() => {
    loadLiveCourtSession();
  }, [loadLiveCourtSession]);

  useEffect(() => {
    loadParticipants();
    loadSummons();
  }, [loadParticipants, loadSummons]);

  useEffect(() => {
    if (!activeCourtId) return;

    const channel = supabase
      .channel(`troll-court:${activeCourtId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "troll_court_sessions",
          filter: `id=eq.${activeCourtId}`,
        },
        (payload) => {
          const next = payload.new as LiveCourtSessionRecord;
          if (next?.id) setLiveCourtSession(next);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "troll_court_participants",
          filter: `court_session_id=eq.${activeCourtId}`,
        },
        () => loadParticipants()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "troll_court_summons",
          filter: `court_session_id=eq.${activeCourtId}`,
        },
        () => loadSummons()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCourtId, loadParticipants, loadSummons]);

  const ensureCourtSession = useCallback(async () => {
    if (!user?.id) throw new Error("You must be signed in.");
    if (!canStartCourt) throw new Error("Only Admin, CEO, or Lead Troll Officer can start court.");

    if (liveCourtSession?.id) return liveCourtSession;

    const cleanCourtId = normalizeCourtUuid(routeCourtId) || crypto.randomUUID();
    const nextRoomName = `troll-court-${cleanCourtId}`;

    const { data, error } = await supabase
      .from("troll_court_sessions")
      .upsert(
        {
          id: cleanCourtId,
          status: "live",
          judge_user_id: null,
          livekit_room_name: nextRoomName,
          started_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    const session = data as LiveCourtSessionRecord;
    setLiveCourtSession(session);
    return session;
  }, [user?.id, canStartCourt, liveCourtSession, routeCourtId]);

  const connectToRoom = useCallback(
    async (targetRoomName: string, boxRole: CourtBoxRole) => {
      if (roomRef.current?.state === "connected") {
        setIsLiveKitConnected(true);
        return roomRef.current;
      }

      const { token, wsUrl } = await getLiveKitToken(targetRoomName, boxRole);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, publication, participant: RemoteParticipant) => {
          setRemoteTracksByIdentity((prev) => {
            const current = prev[participant.identity] || {};

            return {
              ...prev,
              [participant.identity]: {
                ...current,
                videoTrack: track.kind === Track.Kind.Video ? track : current.videoTrack,
                audioTrack: track.kind === Track.Kind.Audio ? track : current.audioTrack,
                isCameraOff:
                  track.kind === Track.Kind.Video ? publication.isMuted : current.isCameraOff,
                isMicMuted:
                  track.kind === Track.Kind.Audio ? publication.isMuted : current.isMicMuted,
              },
            };
          });
        }
      );

      room.on(
        RoomEvent.TrackUnsubscribed,
        (track: RemoteTrack, _publication, participant: RemoteParticipant) => {
          setRemoteTracksByIdentity((prev) => {
            const current = prev[participant.identity] || {};
            const next = { ...current };

            if (track.kind === Track.Kind.Video) {
              next.videoTrack = null;
              next.isCameraOff = true;
            }

            if (track.kind === Track.Kind.Audio) {
              next.audioTrack = null;
              next.isMicMuted = true;
            }

            return {
              ...prev,
              [participant.identity]: next,
            };
          });
        }
      );

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        setRemoteTracksByIdentity((prev) => {
          const next = { ...prev };
          delete next[participant.identity];
          return next;
        });
      });

      room.on(RoomEvent.Disconnected, () => {
        setIsLiveKitConnected(false);
        setRemoteTracksByIdentity({});
      });

      await room.connect(wsUrl, token);
      setIsLiveKitConnected(true);

      return room;
    },
    [getLiveKitToken]
  );

  const publishMicIfNeeded = useCallback(async () => {
    const room = roomRef.current;

    if (!room || room.state !== "connected") {
      throw new Error("Court room is not connected.");
    }

    const existingPublication = Array.from(
      room.localParticipant.audioTrackPublications.values()
    ).find((publication: any) => publication?.track);

    if (existingPublication?.track) {
      await existingPublication.track.unmute();
      setLocalAudioTrack(existingPublication.track as LocalAudioTrack);
      setMicEnabled(true);
      return existingPublication.track as LocalAudioTrack;
    }

    const audioTrack = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });

    await room.localParticipant.publishTrack(audioTrack);
    setLocalAudioTrack(audioTrack);
    setMicEnabled(true);

    return audioTrack;
  }, []);

  const publishCameraIfNeeded = useCallback(async () => {
    const room = roomRef.current;

    if (!room || room.state !== "connected") {
      throw new Error("Court room is not connected.");
    }

    const existingPublication = Array.from(
      room.localParticipant.videoTrackPublications.values()
    ).find((publication: any) => publication?.track);

    if (existingPublication?.track) {
      await existingPublication.track.unmute();
      setLocalVideoTrack(existingPublication.track as LocalVideoTrack);
      setCameraEnabled(true);
      return existingPublication.track as LocalVideoTrack;
    }

    const videoTrack = await createLocalVideoTrack({
      facingMode: "user",
      resolution: {
        width: 1280,
        height: 720,
        frameRate: 30,
      },
    });

    await room.localParticipant.publishTrack(videoTrack);
    setLocalVideoTrack(videoTrack);
    setCameraEnabled(true);

    return videoTrack;
  }, []);

  const unpublishLocalTracks = useCallback(async () => {
    const room = roomRef.current;

    try {
      if (room?.localParticipant) {
        for (const publication of room.localParticipant.videoTrackPublications.values()) {
          if (publication.track) {
            room.localParticipant.unpublishTrack(publication.track);
            publication.track.detach();
            publication.track.stop();
          }
        }

        for (const publication of room.localParticipant.audioTrackPublications.values()) {
          if (publication.track) {
            room.localParticipant.unpublishTrack(publication.track);
            publication.track.detach();
            publication.track.stop();
          }
        }
      }

      if (localVideoTrack) {
        localVideoTrack.detach();
        localVideoTrack.stop();
      }

      if (localAudioTrack) {
        localAudioTrack.detach();
        localAudioTrack.stop();
      }
    } catch (error) {
      console.warn("[TrollCourt] Local track cleanup failed:", error);
    } finally {
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setCameraEnabled(false);
      setMicEnabled(false);
    }
  }, [localVideoTrack, localAudioTrack]);

  const disconnectRoom = useCallback(async () => {
    await unpublishLocalTracks();

    try {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    } catch (error) {
      console.warn("[TrollCourt] Room disconnect failed:", error);
    } finally {
      setIsLiveKitConnected(false);
      setRemoteTracksByIdentity({});
      setCurrentBoxRole(null);
    }
  }, [unpublishLocalTracks]);

  useEffect(() => {
    return () => {
      disconnectRoom();
    };
  }, [disconnectRoom]);

  const markSummonedUserAppeared = useCallback(async () => {
    if (!activeCourtId || !user?.id) return;

    const { error } = await supabase
      .from("troll_court_summons")
      .update({
        status: "appeared",
        appeared_at: new Date().toISOString(),
      })
      .eq("court_session_id", activeCourtId)
      .eq("summoned_user_id", user.id)
      .eq("status", "summoned");

    if (error) {
      console.warn("[TrollCourt] Failed to mark summoned user appeared:", error);
    }
  }, [activeCourtId, user?.id]);

  const joinCourtBox = useCallback(
    async (boxRole: CourtBoxRole) => {
      if (!user?.id) {
        toast.error("You must be signed in.");
        return;
      }

      if (!canJoinBox(currentUser.role, boxRole)) {
        toast.error(`You cannot join the ${getBoxTitle(boxRole)}.`);
        return;
      }

      setIsJoiningBox(true);

      try {
        const session = await ensureCourtSession();
        const targetRoomName = session.livekit_room_name || `troll-court-${session.id}`;

        await connectToRoom(targetRoomName, boxRole);

        if (boxRole !== "audience") {
          await publishMicIfNeeded();
          await publishCameraIfNeeded();
        }

        if (boxRole === "audience") {
          await markSummonedUserAppeared();
        }

        if (boxRole === "judge") {
          const { error: judgeError } = await supabase
            .from("troll_court_sessions")
            .update({
              status: "live",
              judge_user_id: user.id,
              judge_joined_at: new Date().toISOString(),
              livekit_room_name: targetRoomName,
              updated_at: new Date().toISOString(),
            })
            .eq("id", session.id);

          if (judgeError) throw new Error(judgeError.message);
        }

        const { error } = await supabase
          .from("troll_court_participants")
          .upsert(
            {
              court_session_id: session.id,
              user_id: user.id,
              box_role: boxRole,
              status: "joined",
              joined_at: new Date().toISOString(),
              left_at: null,
            },
            { onConflict: "court_session_id,user_id" }
          );

        if (error) throw new Error(error.message);

        setCurrentBoxRole(boxRole);

        if (!activeSession && boxRole === "judge") {
          const localSession = courtSystem.startCourtSession(
            {
              id: currentUser.id,
              name: currentUser.name,
              role: currentUser.role as any,
            },
            []
          );

          setActiveSession(localSession);
        }

        setChatMessages((prev) => [
          ...prev,
          {
            user: "Court",
            message:
              boxRole === "audience" && isSummonedCurrentUser
                ? `⚖️ ${currentUser.name} appeared after being summoned.`
                : `⚖️ ${currentUser.name} joined the ${getBoxTitle(boxRole)}.`,
          },
        ]);

        toast.success(`Joined ${getBoxTitle(boxRole)}.`);
        await loadParticipants();
        await loadSummons();
      } catch (error: any) {
        console.error("[TrollCourt] Join box failed:", error);
        toast.error(error?.message || "Failed to join court box.");
        await unpublishLocalTracks();
      } finally {
        setIsJoiningBox(false);
      }
    },
    [
      user?.id,
      currentUser.role,
      currentUser.id,
      currentUser.name,
      ensureCourtSession,
      connectToRoom,
      publishMicIfNeeded,
      publishCameraIfNeeded,
      markSummonedUserAppeared,
      activeSession,
      isSummonedCurrentUser,
      loadParticipants,
      loadSummons,
      unpublishLocalTracks,
    ]
  );

  const leaveCurrentBox = useCallback(async () => {
    if (!user?.id || !activeCourtId) return;

    try {
      await unpublishLocalTracks();

      const { error } = await supabase
        .from("troll_court_participants")
        .update({
          status: "left",
          left_at: new Date().toISOString(),
        })
        .eq("court_session_id", activeCourtId)
        .eq("user_id", user.id);

      if (error) throw new Error(error.message);

      if (currentBoxRole === "judge") {
        await supabase
          .from("troll_court_sessions")
          .update({
            judge_user_id: null,
            judge_joined_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeCourtId);
      }

      setCurrentBoxRole(null);
      await loadParticipants();
      toast.success("Left court box.");
    } catch (error: any) {
      console.error("[TrollCourt] Leave box failed:", error);
      toast.error(error?.message || "Failed to leave court box.");
    }
  }, [
    user?.id,
    activeCourtId,
    currentBoxRole,
    unpublishLocalTracks,
    loadParticipants,
  ]);

  const handleToggleMic = useCallback(async () => {
    try {
      if (!currentBoxRole || currentBoxRole === "audience") {
        toast.error("Join a court box before using mic.");
        return;
      }

      const room = roomRef.current;

      if (!room || room.state !== "connected") {
        if (!roomName) throw new Error("Court room is missing.");
        await connectToRoom(roomName, currentBoxRole);
      }

      if (!localAudioTrack) {
        await publishMicIfNeeded();
        return;
      }

      if (micEnabled) {
        await localAudioTrack.mute();
        setMicEnabled(false);
      } else {
        await localAudioTrack.unmute();
        setMicEnabled(true);
      }
    } catch (error: any) {
      console.error("[TrollCourt] Mic toggle failed:", error);
      toast.error(error?.message || "Mic toggle failed.");
    }
  }, [
    currentBoxRole,
    roomName,
    connectToRoom,
    localAudioTrack,
    publishMicIfNeeded,
    micEnabled,
  ]);

  const handleToggleCamera = useCallback(async () => {
    try {
      if (!currentBoxRole || currentBoxRole === "audience") {
        toast.error("Join a court box before using camera.");
        return;
      }

      const room = roomRef.current;

      if (!room || room.state !== "connected") {
        if (!roomName) throw new Error("Court room is missing.");
        await connectToRoom(roomName, currentBoxRole);
      }

      if (!localVideoTrack) {
        await publishCameraIfNeeded();
        return;
      }

      if (cameraEnabled) {
        await localVideoTrack.mute();
        setCameraEnabled(false);
      } else {
        await localVideoTrack.unmute();
        setCameraEnabled(true);
      }
    } catch (error: any) {
      console.error("[TrollCourt] Camera toggle failed:", error);
      toast.error(error?.message || "Camera toggle failed.");
    }
  }, [
    currentBoxRole,
    roomName,
    connectToRoom,
    localVideoTrack,
    publishCameraIfNeeded,
    cameraEnabled,
  ]);

  const initializeCourtOnly = useCallback(async () => {
    if (isInitializing) return;

    setIsInitializing(true);

    try {
      const session = await ensureCourtSession();

      if (!activeSession) {
        const localSession = courtSystem.startCourtSession(
          {
            id: currentUser.id,
            name: currentUser.name,
            role: currentUser.role as any,
          },
          []
        );

        setActiveSession(localSession);
      }

      setChatMessages((prev) => [
        ...prev,
        {
          user: "Court",
          message: `🔨 Troll Court started by ${currentUser.name}. Waiting for judge to join the Judge Box.`,
        },
      ]);

      setLiveCourtSession(session);
      toast.success("Court started. Use Judge Options to join as judge.");
    } catch (error: any) {
      console.error("[TrollCourt] Start court failed:", error);
      toast.error(error?.message || "Failed to start court.");
    } finally {
      setIsInitializing(false);
    }
  }, [
    isInitializing,
    ensureCourtSession,
    activeSession,
    currentUser.id,
    currentUser.name,
    currentUser.role,
  ]);

  const handleSendChat = () => {
    if (chatInput.trim()) {
      setChatMessages((prev) => [
        ...prev,
        { user: currentUser.name, message: chatInput },
      ]);
      setChatInput("");
    }
  };

  const arrestAbsentSummonedUsers = useCallback(async () => {
    if (!activeCourtId) return 0;

    const { data, error } = await supabase.rpc("arrest_absent_summoned_users", {
      p_court_session_id: activeCourtId,
    });

    if (error) {
      console.error("[TrollCourt] Failed to arrest absent summoned users:", error);
      toast.error("Failed to process absent summoned users.");
      return 0;
    }

    return Number(data || 0);
  }, [activeCourtId]);

  const handleApplyGuiltyVerdict = async () => {
    if (!activeSession) return;

    try {
      for (const summoned of activeSession.summoned) {
        const defendantUserId = summoned.userId.replace("user-", "");
        const suspendedUntil = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString();

        await supabase
          .from("user_driver_licenses")
          .upsert(
            {
              user_id: defendantUserId,
              status: "suspended",
              suspended_until: suspendedUntil,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

        await supabase.from("notifications").insert({
          user_id: defendantUserId,
          type: "license_suspension_started",
          title: "License Suspended by Court",
          message:
            "Your driver's license has been suspended for 7 days as part of your court sentencing.",
          data: { reason: "Court sentencing", duration_hours: 168 },
        });
      }

      toast.success("License suspensions applied for guilty verdicts");
    } catch (error) {
      console.error("Error applying guilty verdict penalties:", error);
      toast.error("Failed to apply some penalties");
    }
  };

  const handleEndSession = useCallback(async () => {
    try {
      const absentCount = await arrestAbsentSummonedUsers();

      if (activeCourtId) {
        await supabase
          .from("troll_court_sessions")
          .update({
            status: "ended",
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeCourtId);
      }

      if (activeSession) {
        courtSystem.endCourtSession(activeSession.id);
      }

      await disconnectRoom();

      setActiveSession(null);
      setLiveCourtSession(null);
      setParticipants([]);
      setSummons([]);
      setChatMessages([]);

      toast.success(
        absentCount > 0
          ? `Court ended. ${absentCount} absent summoned user(s) were arrested.`
          : "Court ended."
      );

      navigate("/");
    } catch (error) {
      console.error("[TrollCourt] End session failed:", error);
      toast.error("Failed to fully end court session.");
    }
  }, [
    arrestAbsentSummonedUsers,
    activeCourtId,
    activeSession,
    disconnectRoom,
    navigate,
  ]);

  const handleGiveVerdict = async (v: "guilty" | "not_guilty") => {
    const message =
      v === "guilty"
        ? "The defendant is found GUILTY. Penalties will be applied."
        : "The defendant is found NOT GUILTY. All charges dismissed.";

    setChatMessages((prev) => [
      ...prev,
      {
        user: "Court",
        message: `🔨 ${message}`,
      },
    ]);

    if (v === "guilty") {
      await handleApplyGuiltyVerdict();
    }

    setTimeout(() => {
      handleEndSession();
    }, 1000);
  };

  const boxOccupant = useCallback(
    (boxRole: CourtBoxRole) => {
      return participants.find(
        (participant) => participant.box_role === boxRole && participant.status === "joined"
      );
    },
    [participants]
  );

  const renderBox = (boxRole: CourtBoxRole) => {
    const occupant = boxOccupant(boxRole);
    const isCurrentUserBox = !!occupant && occupant.user_id === user?.id;

    return (
      <CourtBox
        key={boxRole}
        boxRole={boxRole}
        occupantName={
          isCurrentUserBox
            ? currentUser.name
            : occupant
              ? `User ${occupant.user_id.slice(0, 6)}`
              : null
        }
        isCurrentUserBox={isCurrentUserBox}
        isJoined={!!occupant}
        trackBundle={occupant ? tracksByUserId[occupant.user_id] : undefined}
      />
    );
  };

  if (!canEnterCourt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Scale size={40} className="text-purple-400" />
            <h1 className="text-4xl font-black">Troll Court</h1>
          </div>

          <div className="bg-gray-900 rounded-lg p-8 purple-neon text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-gray-500" />
            <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
            <p className="text-gray-400 mb-6">
              Only judges and court officers can access the courtroom.
            </p>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition inline-flex items-center gap-2"
            >
              <LogOut size={18} />
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const courtIsStarted =
    !!liveCourtSession?.id &&
    ["live", "active", "in_session"].includes(liveCourtSession.status);

  return (
    <div className="h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 p-3 text-white">
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-400/30 bg-gray-950/80 px-4 py-3 shadow-[0_0_26px_rgba(168,85,247,0.25)]">
          <div className="flex items-center gap-3">
            <Scale size={34} className="text-purple-300" />
            <div>
              <h1 className="text-2xl font-black">Troll Court</h1>
              <p className="text-xs text-gray-400">
                {courtIsStarted ? "Live court session active" : "Court not started"}
                {isSummonedCurrentUser ? " • You were summoned" : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-purple-400/40 bg-gray-950/70 px-4 py-2 text-xs font-bold text-purple-100">
              {isLiveKitConnected ? "🟢 LIVEKIT CONNECTED" : "⚫ LIVEKIT OFF"}
            </div>

            <div className="rounded-full border border-purple-400/40 bg-gray-950/70 px-4 py-2 text-xs font-bold text-purple-100">
              Role: {currentUser.role}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
          <div className="grid min-h-0 grid-cols-2 gap-3 xl:grid-cols-3">
            {renderBox("judge")}
            {renderBox("prosecutor")}
            {renderBox("attorney")}
            {renderBox("witness")}
            {renderBox("defendant")}
            {renderBox("audience")}
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <div className="rounded-2xl border border-purple-400/30 bg-gray-950/85 p-3 shadow-[0_0_24px_rgba(168,85,247,0.25)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-black text-purple-100">
                  <Gavel size={16} />
                  Court Options
                </h2>
                <span className="text-[11px] text-gray-400">
                  {participants.filter((p) => p.status === "joined").length} joined
                </span>
              </div>

              <div className="space-y-2">
                {canStartCourt ? (
                  <RoleActionMenu label="Judge Options" icon={<Gavel size={16} />}>
                    <MenuButton
                      onClick={initializeCourtOnly}
                      disabled={isInitializing || courtIsStarted}
                    >
                      {isInitializing ? "Starting Court..." : "Start Court"}
                    </MenuButton>

                    <MenuButton
                      onClick={() => joinCourtBox("judge")}
                      disabled={isJoiningBox}
                    >
                      Join as Judge
                    </MenuButton>

                    <MenuButton
                      onClick={handleToggleMic}
                      disabled={!currentBoxRole || currentBoxRole === "audience"}
                    >
                      {micEnabled ? "Mute Mic" : "Unmute Mic"}
                    </MenuButton>

                    <MenuButton
                      onClick={handleToggleCamera}
                      disabled={!currentBoxRole || currentBoxRole === "audience"}
                    >
                      {cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
                    </MenuButton>

                    {(currentUser.role === "admin" ||
                      currentUser.role === "ceo" ||
                      currentUser.role === "lead_troll_officer") &&
                    courtIsStarted ? (
                      <>
                        <MenuButton
                          onClick={() => handleGiveVerdict("guilty")}
                          disabled={!courtIsStarted}
                          danger
                        >
                          Guilty Verdict
                        </MenuButton>

                        <MenuButton
                          onClick={() => handleGiveVerdict("not_guilty")}
                          disabled={!courtIsStarted}
                        >
                          Not Guilty Verdict
                        </MenuButton>

                        <MenuButton
                          onClick={handleEndSession}
                          disabled={!courtIsStarted}
                          danger
                        >
                          End Court
                        </MenuButton>
                      </>
                    ) : null}
                    </RoleActionMenu>
                ) : null}

                {currentUser.role === "judge" && !currentBoxRole ? (
                  <MenuButton
                    onClick={() => joinCourtBox("judge")}
                    disabled={isJoiningBox}
                  >
                    <span className="flex items-center gap-2">
                      <Gavel size={14} />
                      Join as Judge
                    </span>
                  </MenuButton>
                ) : null}

                <RoleActionMenu label="Prosecutor Options" icon={<Shield size={16} />}>
                  <MenuButton
                    onClick={() => joinCourtBox("prosecutor")}
                    disabled={isJoiningBox || !courtIsStarted}
                  >
                    Join Prosecutor Box
                  </MenuButton>
                  <MenuButton
                    onClick={handleToggleMic}
                    disabled={currentBoxRole !== "prosecutor"}
                  >
                    {micEnabled ? "Mute Mic" : "Unmute Mic"}
                  </MenuButton>
                  <MenuButton
                    onClick={handleToggleCamera}
                    disabled={currentBoxRole !== "prosecutor"}
                  >
                    {cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
                  </MenuButton>
                </RoleActionMenu>

                <RoleActionMenu label="Attorney Options" icon={<Briefcase size={16} />}>
                  <MenuButton
                    onClick={() => joinCourtBox("attorney")}
                    disabled={isJoiningBox || !courtIsStarted}
                  >
                    Join Attorney Box
                  </MenuButton>
                  <MenuButton
                    onClick={handleToggleMic}
                    disabled={currentBoxRole !== "attorney"}
                  >
                    {micEnabled ? "Mute Mic" : "Unmute Mic"}
                  </MenuButton>
                  <MenuButton
                    onClick={handleToggleCamera}
                    disabled={currentBoxRole !== "attorney"}
                  >
                    {cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
                  </MenuButton>
                </RoleActionMenu>

                <RoleActionMenu label="Witness / Defendant Options" icon={<Users size={16} />}>
                  <MenuButton
                    onClick={() => joinCourtBox("witness")}
                    disabled={isJoiningBox || !courtIsStarted}
                  >
                    Join Witness Box
                  </MenuButton>

                  <MenuButton
                    onClick={() => joinCourtBox("defendant")}
                    disabled={isJoiningBox || !courtIsStarted}
                  >
                    Join Defendant Box
                  </MenuButton>

                  {currentBoxRole !== "audience" && (
                    <>
                      <MenuButton
                        onClick={handleToggleMic}
                        disabled={
                          !currentBoxRole ||
                          currentBoxRole === "judge" ||
                          currentBoxRole === "prosecutor" ||
                          currentBoxRole === "attorney"
                        }
                      >
                        {micEnabled ? "Mute Mic" : "Unmute Mic"}
                      </MenuButton>

                      <MenuButton
                        onClick={handleToggleCamera}
                        disabled={
                          !currentBoxRole ||
                          currentBoxRole === "judge" ||
                          currentBoxRole === "prosecutor" ||
                          currentBoxRole === "attorney"
                        }
                      >
                        {cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
                      </MenuButton>
                    </>
                  )}
                </RoleActionMenu>

                <button
                  type="button"
                  onClick={leaveCurrentBox}
                  disabled={!currentUserParticipant}
                  className="w-full rounded-xl border border-red-400/40 bg-red-950/70 px-4 py-3 text-left text-sm font-black text-red-100 hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Leave Current Box
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-purple-400/30 bg-gray-950/85 p-3 shadow-[0_0_24px_rgba(168,85,247,0.25)]">
              <h3 className="mb-2 text-sm font-black text-purple-100">Court Notes</h3>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-gray-900/70 p-3">
                {chatMessages.length ? (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className="mb-2 text-xs">
                      <span className="font-black text-purple-300">{msg.user}:</span>{" "}
                      {msg.message}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">No court notes yet.</p>
                )}
              </div>

              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Court notes..."
                  className="min-w-0 flex-1 rounded-lg border border-purple-500/30 bg-gray-900 px-3 py-2 text-sm text-white"
                />
                <button
                  onClick={handleSendChat}
                  className="rounded-lg bg-purple-600 px-3 py-2 hover:bg-purple-700"
                >
                  <Send size={17} />
                </button>
              </div>
            </div>

            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center gap-2 rounded-xl border border-purple-400/30 bg-gray-950/85 px-4 py-3 text-sm font-bold text-purple-100 hover:bg-purple-950/50"
            >
              <LogOut size={16} />
              Exit Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}