import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { toast } from "sonner";

import {
  StreamCall,
  StreamVideo,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import type { StreamVideoParticipant } from "@stream-io/video-client";

import { useAuthStore } from "@/lib/store";

import { supabase } from "@/supabaseClient";
import { useGetStreamRoom } from "@/hooks/useGetStreamRoom";
import UserMiniProfile from "@/components/user/UserMiniProfile";

type OfficialRole =
  | "ceo"
  | "admin"
  | "lead_troll"
  | "troll_officer"
  | "pastor"
  | "president"
  | "vice_president"
  | "official";

type MeetingStatus = "scheduled" | "active" | "ended";
type TownMeetingType =
  | "general"
  | "emergency"
  | "budget"
  | "public_safety"
  | "platform_update"
  | "election"
  | "community"
  | "court_review";

const TOWN_MEETING_TYPES: TownMeetingType[] = [
  "general",
  "emergency",
  "budget",
  "public_safety",
  "platform_update",
  "election",
  "community",
  "court_review",
];

function isTownMeetingType(value: string): value is TownMeetingType {
  return TOWN_MEETING_TYPES.includes(value as TownMeetingType);
}

type Meeting = {
  id: string;

  title: string;

  topic: string | null;

  agenda: string | null;

  meeting_type: string | null;

  status?: MeetingStatus;

  is_active?: boolean;

  started_at: string | null;

  ended_at?: string | null;

  rtc_provider?: string | null;
  room_name?: string | null;
  livekit_room_name?: string | null;

  created_by?: string | null;
};

type MeetingSeat = {
  id: string;

  meeting_id: string;

  seat_number: number;

  side: "top" | "right" | "bottom" | "left";

  position: number;

  user_id: string | null;

  joined_at?: string | null;

  left_at?: string | null;

  role: OfficialRole | null;

  display_name: string | null;

  status: "empty" | "invited" | "joined" | "left";
};

type GovernmentLaw = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  effect_type: string | null;
  effect_value: unknown;
  status: string | null;
  created_at: string | null;
  voting_starts_at: string | null;
  voting_ends_at: string | null;
  activated_at: string | null;
  expires_at: string | null;
  required_votes: number | null;
  yes_votes: number | null;
  no_votes: number | null;
  is_emergency: boolean | null;
};

type Official = {
  id: string;

  username: string;

  display_name?: string | null;

  avatar_url?: string | null;

  role: OfficialRole;
};

const MAX_SEATS = 8;

function getSeatStatus(
  seat: Pick<MeetingSeat, "user_id" | "left_at">,
): MeetingSeat["status"] {
  if (!seat.user_id) return "empty";
  return seat.left_at ? "left" : "joined";
}

const OFFICIAL_ROLES: {
  role: OfficialRole;

  label: string;
}[] = [
  { role: "ceo", label: "CEO" },

  { role: "admin", label: "Admin" },

  { role: "lead_troll", label: "Lead Troll" },

  { role: "troll_officer", label: "Troll Officer" },

  { role: "pastor", label: "Pastor" },

  { role: "president", label: "President" },

  { role: "vice_president", label: "Vice President" },

  { role: "official", label: "Official" },
];

function normalizeRole(role?: string | null): OfficialRole {
  const value = String(role || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    value === "ceo" ||
    value === "admin" ||
    value === "lead_troll" ||
    value === "troll_officer" ||
    value === "pastor" ||
    value === "president" ||
    value === "vice_president"
  ) {
    return value;
  }

  return "official";
}

function getDisplayName(user: any) {
  return (
    user?.user_metadata?.display_name ||
    user?.user_metadata?.username ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "Official"
  );
}

type MeetingChamberProps = {
  seats: MeetingSeat[];
  officials: Official[];
  participants: StreamVideoParticipant[];
  currentUserId: string | null;
  selectedSeatNumber: number | null;
  canSelectSeat: boolean;
  muted: boolean;
  speakerMuted: boolean;
  onSelectSeat: (seatNumber: number) => void;
  onOpenProfile: (userId: string, username: string, avatarUrl?: string) => void;
};

function MeetingSeatMedia({
  participant,
  local,
  speakerMuted,
}: {
  participant?: StreamVideoParticipant;
  local: boolean;
  speakerMuted: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    const audioElement = audioRef.current;

    if (videoElement) videoElement.srcObject = participant?.videoStream || null;
    if (audioElement) audioElement.srcObject = participant?.audioStream || null;

    return () => {
      if (videoElement) videoElement.srcObject = null;
      if (audioElement) audioElement.srcObject = null;
    };
  }, [participant?.videoStream, participant?.audioStream]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />
      <audio ref={audioRef} autoPlay muted={local || speakerMuted} />
    </>
  );
}

function MeetingSeatCard({
  seat,
  official,
  participant,
  local,
  muted,
  speakerMuted,
  canSelectSeat,
  isSelected,
  onSelectSeat,
  onOpenProfile,
}: {
  seat: MeetingSeat;
  official?: Official;
  participant?: StreamVideoParticipant;
  local: boolean;
  muted: boolean;
  speakerMuted: boolean;
  canSelectSeat: boolean;
  isSelected: boolean;
  onSelectSeat: (seatNumber: number) => void;
  onOpenProfile: MeetingChamberProps["onOpenProfile"];
}) {
  const username =
    official?.username || seat.display_name || participant?.name || "Official";
  const displayName = official?.display_name || seat.display_name || username;
  const status = participant
    ? "In meeting"
    : seat.status === "invited"
      ? "Invited"
      : "Awaiting official";

  return (
    <article
      className={`relative isolate h-[158px] min-w-0 overflow-hidden rounded-2xl border bg-slate-950 shadow-lg ${
        local ? "border-cyan-300/60" : "border-white/10"
      }`}
    >
      {participant ? (
        <MeetingSeatMedia
          participant={participant}
          local={local}
          speakerMuted={speakerMuted}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
          {official?.avatar_url ? (
            <img
              src={official.avatar_url}
              alt=""
              className="h-14 w-14 rounded-full object-cover opacity-80"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-lg font-black text-cyan-100">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-3 pb-2 pt-8">
        <div className="flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-wider text-cyan-100/80">
          <span className="truncate">
            Seat {seat.seat_number}
          </span>
          <span className="shrink-0">{status}</span>
        </div>
        {seat.user_id ? (
          <button
            type="button"
            onClick={() =>
              onOpenProfile(
                seat.user_id!,
                username,
                official?.avatar_url || undefined,
              )
            }
            className="mt-1 block max-w-full truncate text-left text-xs font-black text-white underline decoration-cyan-300/40 underline-offset-2 hover:text-cyan-200"
            aria-label={`Open ${username}'s mini profile`}
          >
            @{username}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelectSeat(seat.seat_number)}
            disabled={!canSelectSeat}
            className={`mt-1 rounded-md px-2 py-1 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isSelected
                ? "bg-cyan-300 text-slate-950"
                : "bg-white/10 text-cyan-100 hover:bg-white/20"
            }`}
          >
            {isSelected ? "Selected seat" : "Select this seat"}
          </button>
        )}
        {local && muted && (
          <span className="text-[9px] font-bold text-red-300">
            Microphone muted
          </span>
        )}
      </div>
      {!participant && (
        <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-300">
          {status}
        </div>
      )}
    </article>
  );
}

function TownMeetingChamber({
  seats,
  officials,
  participants,
  currentUserId,
  muted,
  speakerMuted,
  selectedSeatNumber,
  canSelectSeat,
  onSelectSeat,
  onOpenProfile,
}: MeetingChamberProps) {
  const orderedSeats = Array.from({ length: MAX_SEATS }, (_, index) =>
    seats.find((seat) => seat.seat_number === index + 1),
  );
  const seatCard = (seat: MeetingSeat | undefined, index: number) => {
    if (!seat) {
      return (
        <button
          type="button"
          key={`empty-${index}`}
          onClick={() => onSelectSeat(index + 1)}
          disabled={!canSelectSeat}
          className={`flex h-[158px] flex-col items-center justify-center rounded-2xl border border-dashed text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
            selectedSeatNumber === index + 1
              ? "border-cyan-300 bg-cyan-300/10 text-cyan-100"
              : "border-cyan-300/20 bg-slate-900/60 text-slate-500 hover:border-cyan-300/50 hover:text-cyan-100"
          }`}
        >
          <span>Seat {index + 1} · Open</span>
          <span className="mt-2 font-bold">
            {selectedSeatNumber === index + 1 ? "Selected" : "Select this seat"}
          </span>
        </button>
      );
    }
    const official = officials.find((item) => item.id === seat.user_id);
    const participant = participants.find(
      (item) => item.userId === seat.user_id,
    );
    return (
      <MeetingSeatCard
        key={seat.id}
        seat={seat}
        official={official}
        participant={participant}
        local={seat.user_id === currentUserId}
        muted={muted}
        speakerMuted={speakerMuted}
        canSelectSeat={canSelectSeat && (!seat.user_id || seat.user_id === currentUserId)}
        isSelected={selectedSeatNumber === seat.seat_number}
        onSelectSeat={onSelectSeat}
        onOpenProfile={onOpenProfile}
      />
    );
  };

  return (
    <section className="relative grid min-h-[720px] grid-cols-1 gap-4 overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_50%_45%,rgba(0,229,255,0.12),rgba(168,85,247,0.08)_32%,#101c2b_72%,#071426_100%)] p-4 shadow-[0_0_55px_rgba(34,211,238,0.08)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,1.2fr)_minmax(0,1fr)] lg:grid-rows-[minmax(170px,1fr)_minmax(330px,auto)_minmax(170px,1fr)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="relative z-10 grid grid-cols-2 gap-3 lg:col-start-2 lg:row-start-1">
        {orderedSeats.slice(0, 2).map(seatCard)}
      </div>
      <div className="relative z-10 grid grid-cols-2 gap-3 lg:col-start-1 lg:row-start-2 lg:grid-cols-1">
        {orderedSeats.slice(2, 4).map(seatCard)}
      </div>
      <div className="relative z-10 flex items-center justify-center lg:col-start-2 lg:row-start-2">
        <div className="flex h-[190px] w-full max-w-[440px] flex-col items-center justify-center rounded-[2.5rem] border-[7px] border-[#754525] bg-gradient-to-br from-[#9a5b32] via-[#63371f] to-[#3a2114] px-6 text-center shadow-[inset_0_0_30px_rgba(0,0,0,0.45),0_15px_40px_rgba(0,0,0,0.35)]">
          <div className="text-center text-base font-black uppercase tracking-[0.2em] text-amber-200">
            Town Meeting
          </div>
          <div className="my-3 h-px w-24 bg-amber-200/25" />
          <div className="text-center text-[10px] uppercase tracking-[0.15em] text-amber-100/60">
            Official Meeting · GetStream
          </div>
        </div>
      </div>
      <div className="relative z-10 grid grid-cols-2 gap-3 lg:col-start-3 lg:row-start-2 lg:grid-cols-1">
        {orderedSeats.slice(4, 6).map(seatCard)}
      </div>
      <div className="relative z-10 grid grid-cols-2 gap-3 lg:col-start-2 lg:row-start-3">
        {orderedSeats.slice(6, 8).map(seatCard)}
      </div>
    </section>
  );
}

function ConnectedTownMeetingChamber(
  props: Omit<MeetingChamberProps, "participants">,
) {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  return <TownMeetingChamber {...props} participants={participants} />;
}
export default function TownMeetingPage() {
  const { user } = useAuthStore();

  const currentUserId = user?.id || null;

  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const [meeting, setMeeting] = useState<Meeting | null>(null);

  const [seats, setSeats] = useState<MeetingSeat[]>([]);

  const [officials, setOfficials] = useState<Official[]>([]);
  const [laws, setLaws] = useState<GovernmentLaw[]>([]);

  const [title, setTitle] = useState("Mai Troll Town Meeting");

  const [topic, setTopic] = useState("");

  const [agenda, setAgenda] = useState("");

  const [meetingType, setMeetingType] = useState<TownMeetingType>("general");

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);

  const [showOfficials, setShowOfficials] = useState(false);

  const [showInviteAll, setShowInviteAll] = useState(false);

  const [meetingNotes, setMeetingNotes] = useState("");

  const [officialRecord, setOfficialRecord] = useState("");

  const [joined, setJoined] = useState(false);

  const [muted, setMuted] = useState(false);

  const [cameraOff, setCameraOff] = useState(false);

  const [speakerMuted, setSpeakerMuted] = useState(false);

  const [localSeat, setLocalSeat] = useState<MeetingSeat | null>(null);

  const [selectedSeatNumber, setSelectedSeatNumber] = useState<number | null>(
    null,
  );

  const [miniProfile, setMiniProfile] = useState<{
    userId: string;
    username: string;
    avatarUrl?: string;
  } | null>(null);

  const currentRole = normalizeRole(
    (user as any)?.trollRole ||
      (user as any)?.role ||
      (user as any)?.user_metadata?.trollRole ||
      (user as any)?.user_metadata?.role,
  );

  const isAuthorizedOfficial = useMemo(
    () =>
      Boolean(
        currentUserId &&
          [
            "ceo",

            "admin",

            "lead_troll",

            "troll_officer",

            "pastor",

            "president",

            "vice_president",

            "official",
          ].includes(currentRole),
      ),

    [currentUserId, currentRole],
  );

  const canManageMeeting = useMemo(
    () => ["ceo", "admin", "lead_troll", "president"].includes(currentRole),

    [currentRole],
  );

  const meetingRoomName = meeting?.id ? `town-meeting-${meeting.id}` : "";
  const getStreamRoom = useGetStreamRoom({
    roomId: meetingRoomName,
    roomType: "town_meeting",
    role: "publisher",
    publish: true,
    userName: getDisplayName(user),
    identity: currentUserId || "",
    initialAudioEnabled: true,
    onError: (error) => {
      console.error("[TownMeeting:GetStream] Room error:", error);
    },
  });

  /*

   * ------------------------------------------------------------

   * LOAD MEETINGS

   * ------------------------------------------------------------

   */

  const loadMeetings = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase

        .from("town_meetings")

        .select("*")

        .order("started_at", {
          ascending: false,

          nullsFirst: false,
        })

        .limit(25);

      if (error) throw error;

      setMeetings((data || []) as Meeting[]);
    } catch (error: any) {
      console.error("[TownMeeting] load meetings:", error);

      toast.error(error?.message || "Unable to load town meetings");
    } finally {
      setLoading(false);
    }
  }, []);

  /*

   * ------------------------------------------------------------

   * LOAD SEATS

   * ------------------------------------------------------------

   */

  const loadSeats = useCallback(async (meetingId: string) => {
    const { data, error } = await supabase

      .from("town_meeting_seats")

      .select("*")

      .eq("meeting_id", meetingId)

      .order("seat_number", { ascending: true });

    if (error) {
      console.error("[TownMeeting] load seats:", error);

      return;
    }

    setSeats(
      (data || []).map((seat) => ({
        ...seat,
        status: getSeatStatus(seat),
      })) as MeetingSeat[],
    );
  }, []);

  /*

   * ------------------------------------------------------------

   * LOAD OFFICIALS

   * ------------------------------------------------------------

   */

  const loadOfficials = useCallback(async () => {
    try {
      const { data, error } = await supabase

        .from("user_profiles")

        .select("id, username, display_name, avatar_url, role, trollRole")

        .limit(500);

      if (error) throw error;

      const mapped: Official[] = (data || [])

        .map((profile: any) => ({
          id: profile.id,

          username: profile.username || profile.display_name || "Official",

          display_name: profile.display_name,

          avatar_url: profile.avatar_url,

          role: normalizeRole(profile.trollRole || profile.role),
        }))

        .filter((profile) =>
          [
            "ceo",

            "admin",

            "lead_troll",

            "troll_officer",

            "pastor",

            "president",

            "vice_president",

            "official",
          ].includes(profile.role),
        );

      setOfficials(mapped);
    } catch (error: any) {
      console.error("[TownMeeting] load officials:", error);
    }
  }, []);

  /*

   * ------------------------------------------------------------

   * FIND LOCAL SEAT

   * ------------------------------------------------------------

   */

  useEffect(() => {
    if (!currentUserId) {
      setLocalSeat(null);

      return;
    }

    const ownedSeat =
      seats.find((seat) => seat.user_id === currentUserId) || null;
    setLocalSeat(ownedSeat);
    if (ownedSeat) setSelectedSeatNumber(ownedSeat.seat_number);
  }, [seats, currentUserId]);

  /*

   * ------------------------------------------------------------

   * INITIAL LOAD

   * ------------------------------------------------------------

   */

  const loadLaws = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("government_laws")
        .select(
          "id, title, description, category, effect_type, effect_value, status, created_at, voting_starts_at, voting_ends_at, activated_at, expires_at, required_votes, yes_votes, no_votes, is_emergency",
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLaws((data || []) as GovernmentLaw[]);
    } catch (error: any) {
      console.error("[TownMeeting] load laws:", error);
      setLaws([]);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
    loadOfficials();
    loadLaws();
  }, [loadMeetings, loadOfficials, loadLaws]);

  /*

   * ------------------------------------------------------------

   * REALTIME MEETING UPDATES

   * ------------------------------------------------------------

   */

  useEffect(() => {
    if (!meeting?.id) return;

    const channel = supabase

      .channel(`town-meeting-${meeting.id}`)

      .on(
        "postgres_changes",

        {
          event: "*",

          schema: "public",

          table: "town_meeting_seats",

          filter: `meeting_id=eq.${meeting.id}`,
        },

        () => {
          loadSeats(meeting.id);
        },
      )

      .on(
        "postgres_changes",

        {
          event: "*",

          schema: "public",

          table: "town_meetings",

          filter: `id=eq.${meeting.id}`,
        },

        (payload) => {
          if (payload.new) {
            setMeeting(payload.new as Meeting);
          }
        },
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meeting?.id, loadSeats]);

  /*

   * ------------------------------------------------------------

   * CREATE MEETING

   * ------------------------------------------------------------

   */

  const openCreateMeeting = () => {
    setMeetingType("general");
    setShowCreate(true);
  };

  const handleCreateMeeting = async () => {
    if (!currentUserId) {
      toast.error("You must be signed in.");

      return;
    }

    if (!isAuthorizedOfficial) {
      toast.error("Only Mai Troll officials can create a town meeting.");

      return;
    }

    if (!isTownMeetingType(meetingType)) {
      toast.error("That meeting type is no longer supported. Choose a valid type and try again.");
      return;
    }

    try {
      setBusy(true);

      /*

       * The existing start_town_meeting RPC is retained as the

       * server-side authorization boundary.

       *

       * The database function should create:

       * - town_meetings

       * - 8 town_meeting_seats

       * - a GetStream room derived from the meeting ID

       *

       * GetStream credentials remain server-side.

       */

      const { data, error } = await supabase.rpc("start_town_meeting", {
        p_title: title.trim() || "Mai Troll Town Meeting",

        p_topic: topic.trim(),

        p_agenda: agenda.trim(),

        p_meeting_type: meetingType,

        p_scheduled_duration_minutes: 120,

        p_seat_roles: {
          seat_1: "CEO",

          seat_2: "Admin",

          seat_3: "Lead Troll",

          seat_4: "Troll Officer",

          seat_5: "Pastor",

          seat_6: "President",

          seat_7: "Vice President",

          seat_8: "Official",
        },
      });

      if (error) throw error;

      if (!data?.success && !data?.id && !data?.meeting_id) {
        throw new Error(
          data?.reason || "The town meeting could not be created.",
        );
      }

      const meetingId = data?.meeting_id || data?.id;

      toast.success("Mai Troll Town Meeting created.");

      setShowCreate(false);

      await loadMeetings();

      if (meetingId) {
        const { data: createdMeeting, error: meetingError } = await supabase

          .from("town_meetings")

          .select("*")

          .eq("id", meetingId)

          .single();

        if (!meetingError && createdMeeting) {
          setMeeting(createdMeeting as Meeting);

          await loadSeats(createdMeeting.id);
        }
      }
    } catch (error: any) {
      console.error("[TownMeeting] create:", error);

      toast.error(error?.message || "Unable to create town meeting.");
    } finally {
      setBusy(false);
    }
  };

  /*

   * ------------------------------------------------------------

   * SELECT MEETING

   * ------------------------------------------------------------

   */

  const openMeeting = async (selectedMeeting: Meeting) => {
    try {
      setBusy(true);

      setMeeting(selectedMeeting);
      setSeats([]);
      setLocalSeat(null);
      setSelectedSeatNumber(null);

      await loadSeats(selectedMeeting.id);

      toast.success("Meeting room loaded.");
    } catch (error: any) {
      toast.error(error?.message || "Unable to open meeting.");
    } finally {
      setBusy(false);
    }
  };

  const selectMeetingSeat = (seatNumber: number) => {
    if (localSeat && localSeat.seat_number !== seatNumber) {
      toast.error("Your seat is reserved for you. You cannot switch seats.");
      return;
    }

    const existingSeat = seats.find(
      (seat) => seat.seat_number === seatNumber,
    );
    if (existingSeat?.user_id && existingSeat.user_id !== currentUserId) {
      toast.error("That seat is already taken. Choose an open seat.");
      return;
    }

    setSelectedSeatNumber(seatNumber);
  };

  /*

   * ------------------------------------------------------------

   * REQUEST GETSTREAM TOKEN

   * ------------------------------------------------------------

   *

   * SECURITY:

   * GetStream API credentials MUST remain server-side.

   *

   * Expected Edge Function:

   *

   * getstream-token

   *

   * It should validate:

   * - authenticated user

   * - official role

   * - meeting membership

   * - active meeting

   *

   * Then return:

   *

   * {

   *   appId,

   *   token,

   *   channel,

   *   uid

   * }

   *

   */

  const joinGetStreamMeeting = async (
    requestedSeatNumber = localSeat?.seat_number ?? selectedSeatNumber ?? null,
  ) => {
    if (!meeting?.id || !currentUserId) {
      toast.error("Select a meeting and sign in first.");
      return;
    }
    if (!isAuthorizedOfficial) {
      toast.error("Only Mai Troll officials can join this meeting.");
      return;
    }

    let seat =
      seats.find((item) => item.user_id === currentUserId) || null;
    if (seat && requestedSeatNumber !== seat.seat_number) {
      toast.error("You already have a seat in this meeting. Rejoin your assigned seat.");
      setSelectedSeatNumber(seat.seat_number);
      return;
    }
    if (!seat && requestedSeatNumber === null) {
      toast.error("Select any open seat in the chamber to join.");
      return;
    }

    try {
      setBusy(true);

      if (!seat) {
        const { data: claimResult, error: claimError } = await supabase.rpc(
          "join_town_meeting_seat",
          {
            p_meeting_id: meeting.id,
            p_seat_number: requestedSeatNumber!,
            p_display_role: currentRole,
            p_participant_identity: currentUserId,
          },
        );
        if (claimError?.code === "23505") {
          const { data: existingSeat, error: existingSeatError } =
            await supabase
              .from("town_meeting_seats")
              .select("*")
              .eq("meeting_id", meeting.id)
              .eq("user_id", currentUserId)
              .maybeSingle();
          if (existingSeatError) throw existingSeatError;
          if (existingSeat) {
            const ownedSeat = {
              ...existingSeat,
              status: getSeatStatus(existingSeat),
            } as MeetingSeat;
            setLocalSeat(ownedSeat);
            setSelectedSeatNumber(ownedSeat.seat_number);
            throw new Error(
              `You already have Seat ${ownedSeat.seat_number}. Rejoin your assigned seat.`,
            );
          }
          throw new Error("That seat was just taken. Select another open seat.");
        }
        if (claimError) throw claimError;
        if (claimResult?.success === false) {
          throw new Error(
            claimResult.reason === "already_assigned"
              ? "You already have a seat in this meeting."
              : claimResult.reason === "seat_taken"
                ? "That seat was just taken. Select another open seat."
                : claimResult.reason || "Unable to claim that seat.",
          );
        }

        const { data: claimedSeat, error: seatLoadError } = await supabase
          .from("town_meeting_seats")
          .select("*")
          .eq("meeting_id", meeting.id)
          .eq("user_id", currentUserId)
          .single();
        if (seatLoadError) throw seatLoadError;
        if (!claimedSeat) throw new Error("Your seat assignment could not be loaded.");
        seat = {
          ...claimedSeat,
          status: getSeatStatus(claimedSeat),
        } as MeetingSeat;
        setLocalSeat(seat);
        setSelectedSeatNumber(seat.seat_number);
        setSeats((previous) => [
          ...previous.filter((item) => item.id !== seat!.id),
          seat!,
        ].sort((left, right) => left.seat_number - right.seat_number));
      }

      const call = await getStreamRoom.joinAsAudience({
        userId: currentUserId,
        roomName: `town-meeting-${meeting.id}`,
        publishCapable: true,
      });
      if (typeof call === "string") throw new Error(call);
      if (!call) throw new Error("GetStream did not return a meeting call.");

      const { error } = await supabase
        .from("town_meeting_seats")
        .update({ joined_at: new Date().toISOString(), left_at: null })
        .eq("id", seat.id);
      if (error) {
        await getStreamRoom.leaveRoom();
        throw error;
      }

      setJoined(true);
      setLocalSeat({ ...seat, status: "joined" });
      setMuted(false);
      setCameraOff(false);
      await loadSeats(meeting.id);
      toast.success("You joined the Mai Troll Town Meeting.");
    } catch (error) {
      console.error("[TownMeeting:GetStream] Join failed:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to join the GetStream town meeting.",
      );
    } finally {
      setBusy(false);
    }
  };

  const leaveMeeting = async () => {
    try {
      await getStreamRoom.leaveRoom();
      setJoined(false);
      if (localSeat) {
        const { error } = await supabase
          .from("town_meeting_seats")
          .update({ left_at: new Date().toISOString() })
          .eq("id", localSeat.id);
        if (error) throw error;
        setLocalSeat((previous) =>
          previous ? { ...previous, status: "left" } : previous,
        );
        setSeats((previous) =>
          previous.map((seat) =>
            seat.id === localSeat.id ? { ...seat, status: "left" } : seat,
          ),
        );
      }
      toast.success("You left the meeting.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to leave meeting.",
      );
    }
  };

  const toggleMute = async () => {
    const nextMuted = !muted;
    const updated = await getStreamRoom.setMicrophoneEnabled(!nextMuted);
    if (!updated) {
      toast.error("Unable to update microphone.");
      return;
    }
    setMuted(nextMuted);
  };

  const toggleCamera = async () => {
    const nextCameraOff = !cameraOff;
    const updated = await getStreamRoom.setCameraEnabled(!nextCameraOff);
    if (!updated) {
      toast.error("Unable to update camera.");
      return;
    }
    setCameraOff(nextCameraOff);
  };

  const toggleSpeaker = () => setSpeakerMuted((previous) => !previous);

  const inviteOfficial = async (official: Official) => {
    if (!meeting?.id) {
      toast.error("Open a meeting first.");

      return;
    }

    if (!canManageMeeting) {
      toast.error("You do not have permission to invite officials.");

      return;
    }

    try {
      setBusy(true);

      const { data, error } = await supabase.rpc(
        "invite_town_meeting_official",

        {
          p_meeting_id: meeting.id,

          p_user_id: official.id,
        },
      );

      if (error) throw error;

      if (data?.success === false) {
        throw new Error(data.reason || "Unable to invite official.");
      }

      toast.success(
        `${official.display_name || official.username} was invited.`,
      );

      await loadSeats(meeting.id);
    } catch (error: any) {
      console.error("[TownMeeting] invite official:", error);

      toast.error(error?.message || "Unable to send official invitation.");
    } finally {
      setBusy(false);
    }
  };

  /*

   * ------------------------------------------------------------

   * INVITE ALL OFFICIALS

   * ------------------------------------------------------------

   */

  const inviteAllOfficials = async () => {
    if (!meeting?.id) {
      toast.error("Open a meeting first.");

      return;
    }

    if (!canManageMeeting) {
      toast.error("You do not have permission to invite all officials.");

      return;
    }

    try {
      setBusy(true);

      const { data, error } = await supabase.rpc(
        "invite_all_town_meeting_officials",

        {
          p_meeting_id: meeting.id,
        },
      );

      if (error) throw error;

      if (data?.success === false) {
        throw new Error(data.reason || "Unable to invite officials.");
      }

      toast.success("Town Meeting invitations sent to all eligible officials.");

      setShowInviteAll(false);

      await loadSeats(meeting.id);
    } catch (error: any) {
      console.error(
        "[TownMeeting] invite all:",

        error,
      );

      toast.error(error?.message || "Unable to invite all officials.");
    } finally {
      setBusy(false);
    }
  };

  /*

   * ------------------------------------------------------------

   * END MEETING

   * ------------------------------------------------------------

   */

  const endMeeting = async () => {
    if (!meeting?.id) return;

    if (!canManageMeeting) {
      toast.error(
        "Only authorized meeting administrators can end this meeting.",
      );

      return;
    }

    if (
      !window.confirm(
        "End this Mai Troll Town Meeting? All officials will be disconnected.",
      )
    ) {
      return;
    }

    try {
      setBusy(true);

      await getStreamRoom.leaveRoom();
      setJoined(false);

      const { data, error } = await supabase.rpc(
        "end_town_meeting",

        {
          p_meeting_id: meeting.id,

          p_notes: meetingNotes,

          p_official_record: officialRecord,
        },
      );

      if (error) throw error;

      if (data?.success === false) {
        throw new Error(data.reason || "Unable to end meeting.");
      }

      toast.success("Town Meeting ended.");

      setMeeting(null);

      setSeats([]);

      setLocalSeat(null);

      setMeetingNotes("");

      setOfficialRecord("");

      await loadMeetings();
    } catch (error: any) {
      console.error("[TownMeeting] end meeting:", error);

      toast.error(error?.message || "Unable to end town meeting.");
    } finally {
      setBusy(false);
    }
  };

  /*

   * ------------------------------------------------------------

   * EXACT 8-SEAT TABLE

   * ------------------------------------------------------------

   *

   * 2 seats per side:

   *

   *              TOP

   *          [1]       [2]

   *

   * [3]                         [5]

   * [4]       BROWN TABLE       [6]

   *

   *          [7]       [8]

   *             BOTTOM

   *

   * ------------------------------------------------------------

   */

  const arrangedSeats = useMemo(() => {
    const fallback: MeetingSeat[] = [
      {
        id: "seat-1",

        meeting_id: meeting?.id || "",

        seat_number: 1,

        side: "top",

        position: 1,

        user_id: null,

        role: null,

        display_name: null,

        status: "empty",
      },

      {
        id: "seat-2",

        meeting_id: meeting?.id || "",

        seat_number: 2,

        side: "top",

        position: 2,

        user_id: null,

        role: null,

        display_name: null,

        status: "empty",
      },

      {
        id: "seat-3",

        meeting_id: meeting?.id || "",

        seat_number: 3,

        side: "left",

        position: 1,

        user_id: null,

        role: null,

        display_name: null,

        status: "empty",
      },

      {
        id: "seat-4",

        meeting_id: meeting?.id || "",

        seat_number: 4,

        side: "left",

        position: 2,

        user_id: null,

        role: null,

        display_name: null,

        status: "empty",
      },

      {
        id: "seat-5",

        meeting_id: meeting?.id || "",

        seat_number: 5,

        side: "right",

        position: 1,

        user_id: null,

        role: null,

        display_name: null,

        status: "empty",
      },

      {
        id: "seat-6",

        meeting_id: meeting?.id || "",

        seat_number: 6,

        side: "right",

        position: 2,

        user_id: null,

        role: null,

        display_name: null,

        status: "empty",
      },

      {
        id: "seat-7",

        meeting_id: meeting?.id || "",

        seat_number: 7,

        side: "bottom",

        position: 1,

        user_id: null,

        role: null,

        display_name: null,

        status: "empty",
      },

      {
        id: "seat-8",

        meeting_id: meeting?.id || "",

        seat_number: 8,

        side: "bottom",

        position: 2,

        user_id: null,

        role: null,

        display_name: null,

        status: "empty",
      },
    ];

    return fallback.map((fallbackSeat) => {
      const actual = seats.find(
        (seat) => seat.seat_number === fallbackSeat.seat_number,
      );

      return actual || fallbackSeat;
    });
  }, [seats, meeting?.id]);

  /*

   * ------------------------------------------------------------

   * RENDER

   * ------------------------------------------------------------

   */

  if (!isAuthorizedOfficial) {
    return (
      <div className="min-h-screen bg-[#071426] px-4 py-24 text-white">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-red-400/20 bg-slate-950/80 p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-red-400/20 bg-red-400/10 text-2xl">
            🔒
          </div>

          <h1 className="mt-5 text-3xl font-black">Officials Only</h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Mai Troll Town Meeting is a private official meeting room. Your
            account does not currently have an authorized Mai Troll official
            role.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071426] px-3 pb-28 pt-20 text-white md:px-6">
      <div className="mx-auto max-w-[1500px]">
        {/* HEADER */}

        <div className="mb-5 rounded-[2rem] border border-cyan-300/25 bg-gradient-to-r from-[#071b2a] via-[#11102d] to-[#102617] p-5 shadow-[0_0_60px_rgba(34,211,238,0.12)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-amber-200">
                  Official Chamber
                </span>

                {meeting?.id && (
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">
                    {getStreamRoom.isConnected
                      ? "GetStream Live"
                      : "Meeting Ready"}
                  </span>
                )}
              </div>

              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
                MAI TROLL TOWN MEETING
              </h1>

              <p className="mt-1 text-sm text-slate-400">
                Private official meeting chamber • choose any open seat once;
                your seat stays yours for this meeting • GetStream video
                conference
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!meeting && isAuthorizedOfficial && (
                <button
                  onClick={openCreateMeeting}
                  className="rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                >
                  + Start Town Meeting
                </button>
              )}

              {meeting && canManageMeeting && (
                <>
                  <button
                    onClick={() => setShowOfficials(true)}
                    className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-black text-cyan-100 hover:bg-cyan-300/20"
                  >
                    Invite Official
                  </button>

                  <button
                    onClick={() => setShowInviteAll(true)}
                    className="rounded-xl border border-purple-300/20 bg-purple-300/10 px-4 py-2.5 text-sm font-black text-purple-100 hover:bg-purple-300/20"
                  >
                    Invite All Officials
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ACTIVE MEETING */}

        {meeting ? (
          <>
            <div className="mb-5 rounded-2xl border border-cyan-300/10 bg-slate-950/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-lg font-black text-white">
                    {meeting.title}
                  </div>

                  {meeting.topic && (
                    <div className="mt-1 text-sm text-slate-400">
                      {meeting.topic}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-amber-200">
                      {meeting.meeting_type || "General"}
                    </span>

                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                      8 Seats
                    </span>

                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-200">
                      GetStream
                    </span>
                  </div>
                </div>

                {!joined ? (
                  <button
                    onClick={() =>
                      joinGetStreamMeeting(
                        localSeat?.seat_number ?? selectedSeatNumber,
                      )
                    }
                    disabled={busy || (!localSeat && selectedSeatNumber === null)}
                    className="rounded-xl border border-cyan-300/30 bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.15)] hover:bg-cyan-200 disabled:opacity-60"
                  >
                    {busy
                      ? "Connecting…"
                      : localSeat
                        ? `Join Your Seat · ${localSeat.seat_number}`
                        : selectedSeatNumber
                          ? `Join Seat · ${selectedSeatNumber}`
                          : "Select an Open Seat"}
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={toggleMute}
                      className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-black"
                    >
                      {muted ? "Unmute" : "Mute"}
                    </button>

                    <button
                      onClick={toggleCamera}
                      className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-black"
                    >
                      {cameraOff ? "Camera On" : "Camera Off"}
                    </button>

                    <button
                      onClick={toggleSpeaker}
                      className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-black"
                    >
                      {speakerMuted ? "Speaker On" : "Speaker Off"}
                    </button>

                    <button
                      onClick={leaveMeeting}
                      className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-black text-red-200"
                    >
                      Leave
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* CHAMBER */}
            <div className="mb-5">
              {getStreamRoom.client && getStreamRoom.call ? (
                <StreamVideo client={getStreamRoom.client}>
                  <StreamCall call={getStreamRoom.call}>
                    <ConnectedTownMeetingChamber
                      seats={arrangedSeats}
                      officials={officials}
                      currentUserId={currentUserId}
                      selectedSeatNumber={localSeat?.seat_number ?? selectedSeatNumber}
                      canSelectSeat={!joined && !busy && !localSeat}
                      muted={muted}
                      speakerMuted={speakerMuted}
                      onSelectSeat={selectMeetingSeat}
                      onOpenProfile={(userId, username, avatarUrl) =>
                        setMiniProfile({ userId, username, avatarUrl })
                      }
                    />
                  </StreamCall>
                </StreamVideo>
              ) : (
                <TownMeetingChamber
                  seats={arrangedSeats}
                  officials={officials}
                  participants={[]}
                  currentUserId={currentUserId}
                  selectedSeatNumber={localSeat?.seat_number ?? selectedSeatNumber}
                  canSelectSeat={!joined && !busy && !localSeat}
                  muted={muted}
                  speakerMuted={speakerMuted}
                  onSelectSeat={selectMeetingSeat}
                  onOpenProfile={(userId, username, avatarUrl) =>
                    setMiniProfile({ userId, username, avatarUrl })
                  }
                />
              )}
            </div>
            {/* MEETING DOCUMENTS */}

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-cyan-300/10 bg-slate-950/70 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-black">Meeting Notes</h2>

                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    Official
                  </span>
                </div>

                <textarea
                  value={meetingNotes}
                  onChange={(event) => setMeetingNotes(event.target.value)}
                  className="mt-4 min-h-[150px] w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/30"
                  placeholder="Record official meeting notes..."
                />
              </div>

              <div className="rounded-[2rem] border border-purple-300/15 bg-slate-950/75 p-5 shadow-[0_0_35px_rgba(168,85,247,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-300">
                      Laws • Ordinances • Resolutions
                    </div>
                    <h2 className="mt-1 text-xl font-black text-white">
                      Official Record
                    </h2>
                  </div>
                  <span className="rounded-full border border-purple-300/20 bg-purple-300/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-purple-200">
                    {laws.length} Legislative Items
                  </span>
                </div>

                <div className="mt-4 max-h-[330px] space-y-3 overflow-y-auto pr-1">
                  {laws.length === 0 ? (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-5 text-center">
                      <div className="text-2xl">📜</div>
                      <div className="mt-2 text-sm font-black text-white">
                        No laws or legislative items are currently on file
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Laws, ordinances, resolutions, voting status, and
                        effective dates will appear here when they exist in Mai
                        Troll Government.
                      </p>
                    </div>
                  ) : (
                    laws.map((law) => {
                      const yes = law.yes_votes ?? 0;
                      const no = law.no_votes ?? 0;
                      const required = law.required_votes ?? 0;
                      const total = yes + no;

                      return (
                        <div
                          key={law.id}
                          className="rounded-2xl border border-purple-300/10 bg-gradient-to-br from-purple-300/[0.06] via-cyan-300/[0.025] to-transparent p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-black text-white">
                                  {law.title}
                                </h3>
                                {law.is_emergency && (
                                  <span className="rounded-full border border-red-300/20 bg-red-300/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-red-200">
                                    Emergency
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-cyan-300">
                                {law.category || "Government Law"} •{" "}
                                {law.status || "pending"}
                              </div>
                            </div>
                            <div className="rounded-full border border-green-300/20 bg-green-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-green-200">
                              {yes} Yes / {no} No
                            </div>
                          </div>

                          {law.description && (
                            <p className="mt-3 text-xs leading-5 text-slate-400">
                              {law.description}
                            </p>
                          )}

                          <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500 sm:grid-cols-4">
                            <div className="rounded-xl border border-white/5 bg-black/20 p-2">
                              Votes <span className="text-white">{total}</span>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-black/20 p-2">
                              Required{" "}
                              <span className="text-white">{required}</span>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-black/20 p-2">
                              Effect{" "}
                              <span className="text-white">
                                {law.effect_type || "—"}
                              </span>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-black/20 p-2">
                              Active{" "}
                              <span className="text-white">
                                {law.activated_at ? "Yes" : "No"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-5 border-t border-white/5 pt-4">
                  <div className="text-[9px] font-black uppercase tracking-widest text-amber-200">
                    Meeting Actions / Official Proceedings
                  </div>
                  <textarea
                    value={officialRecord}
                    onChange={(event) => setOfficialRecord(event.target.value)}
                    className="mt-3 min-h-[170px] w-full rounded-2xl border border-amber-300/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-300/30"
                    placeholder="Record motions, votes, laws discussed, ordinances, resolutions, approvals, rulings, appointments, and other official actions taken during this meeting..."
                  />
                </div>
              </div>
            </div>

            {/* END MEETING */}

            {canManageMeeting && (
              <div className="mt-5 flex justify-end">
                <button
                  onClick={endMeeting}
                  disabled={busy}
                  className="rounded-xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-black text-red-200 hover:bg-red-400/20 disabled:opacity-50"
                >
                  End Town Meeting
                </button>
              </div>
            )}
          </>
        ) : (
          /* NO ACTIVE MEETING */

          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <div className="flex min-h-[560px] flex-col items-center justify-center rounded-[3rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_center,rgba(0,229,255,0.12),rgba(168,85,247,0.08)_35%,#102033_70%)] p-8 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-amber-300/20 bg-amber-300/5 text-4xl shadow-[0_0_60px_rgba(245,158,11,0.08)]">
                🏛️
              </div>

              <h2 className="mt-7 text-3xl font-black">
                Mai Troll Town Meeting
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                The official meeting chamber is currently inactive. Authorized
                Mai Troll officials can create a meeting and invite the other
                officials.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
                {OFFICIAL_ROLES.map((item) => (
                  <div
                    key={item.role}
                    className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400"
                  >
                    {item.label}
                  </div>
                ))}
              </div>

              {isAuthorizedOfficial && (
                <button
                  onClick={openCreateMeeting}
                  className="mt-8 rounded-xl border border-cyan-300/30 bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200"
                >
                  Start Official Meeting
                </button>
              )}
            </div>

            <div className="rounded-[2rem] border border-cyan-300/10 bg-slate-950/70 p-5">
              <h2 className="text-xl font-black">Meeting History</h2>

              {loading ? (
                <div className="mt-5 text-sm text-slate-500">
                  Loading meetings…
                </div>
              ) : meetings.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                  No town meetings have been recorded yet.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {meetings.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openMeeting(item)}
                      className="w-full rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.03]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-black text-white">
                          {item.title}
                        </span>

                        <span className="rounded-full border border-white/10 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-500">
                          {item.is_active ? "Live" : "Archived"}
                        </span>
                      </div>

                      {item.topic && (
                        <p className="mt-2 text-xs text-slate-500">
                          {item.topic}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-[2rem] border border-cyan-300/20 bg-[#080b14] p-6 shadow-[0_0_80px_rgba(34,211,238,0.12)]">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">
                  Official Chamber
                </div>

                <h2 className="mt-2 text-2xl font-black">
                  Create Town Meeting
                </h2>
              </div>

              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg px-3 py-2 text-slate-500 hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/30"
                placeholder="Meeting title"
              />

              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/30"
                placeholder="Meeting topic"
              />

              <textarea
                value={agenda}
                onChange={(event) => setAgenda(event.target.value)}
                className="min-h-[140px] w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/30"
                placeholder="Official meeting agenda"
              />

              <select
                value={meetingType}
                onChange={(event) => {
                  if (isTownMeetingType(event.target.value)) {
                    setMeetingType(event.target.value);
                  }
                }}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="general">General</option>

                <option value="emergency">Emergency</option>

                <option value="budget">Budget</option>

                <option value="public_safety">Public Safety</option>

                <option value="platform_update">Platform Update</option>

                <option value="election">Election</option>

                <option value="community">Community</option>

                <option value="court_review">Court Review</option>
              </select>

              <div className="rounded-2xl border border-amber-300/10 bg-amber-300/[0.03] p-4">
                <div className="text-xs font-black uppercase tracking-widest text-amber-200">
                  Chamber Configuration
                </div>

                <div className="mt-2 text-xs leading-5 text-slate-500">
                  8 official seats will be created automatically: 2 seats on
                  each side of the council table. Meetings use GetStream video
                  calling.
                </div>
              </div>

              <button
                onClick={handleCreateMeeting}
                disabled={busy}
                className="w-full rounded-xl border border-cyan-300/30 bg-cyan-300 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
              >
                {busy ? "Creating Meeting…" : "Create Official Meeting"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVITE OFFICIAL MODAL */}

      {showOfficials && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[#080b14] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 p-5">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
                  Town Meeting
                </div>

                <h2 className="mt-1 text-xl font-black">Invite Official</h2>
              </div>

              <button
                onClick={() => setShowOfficials(false)}
                className="rounded-lg px-3 py-2 text-slate-500 hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {officials.map((official) => (
                  <button
                    key={official.id}
                    onClick={() => inviteOfficial(official)}
                    disabled={busy}
                    className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left hover:border-cyan-300/20 hover:bg-cyan-300/[0.03] disabled:opacity-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 font-black text-cyan-200">
                      {(official.display_name || official.username || "O")

                        .slice(0, 1)

                        .toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white">
                        {official.display_name || official.username}
                      </div>

                      <div className="text-[9px] font-black uppercase tracking-widest text-cyan-300">
                        {official.role.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INVITE ALL MODAL */}

      {showInviteAll && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[2rem] border border-purple-300/20 bg-[#080b14] p-6 shadow-2xl">
            <div className="text-[10px] font-black uppercase tracking-widest text-purple-300">
              Official Notification
            </div>

            <h2 className="mt-2 text-2xl font-black">Invite All Officials?</h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              This will send a Mai Troll Town Meeting notification to all
              eligible officials and invite them to the current meeting.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowInviteAll(false)}
                className="flex-1 rounded-xl border border-white/10 bg-slate-900 py-3 text-sm font-black"
              >
                Cancel
              </button>

              <button
                onClick={inviteAllOfficials}
                disabled={busy}
                className="flex-1 rounded-xl border border-purple-300/30 bg-purple-300 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Invite Everyone"}
              </button>
            </div>
          </div>
        </div>
      )}

      {miniProfile && (
        <UserMiniProfile
          userId={miniProfile.userId}
          username={miniProfile.username}
          avatarUrl={miniProfile.avatarUrl}
          onClose={() => setMiniProfile(null)}
        />
      )}
    </div>
  );
}
