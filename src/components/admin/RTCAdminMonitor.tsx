import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { usePresenceStore } from '@/lib/presenceStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useStaffWalkieTalkieContext } from '../StaffWalkieTalkieProvider';
import { toast } from 'sonner';
import {
  Activity, BarChart3, Bug, Clock, Coins, Mail, Monitor, MoreVertical,
  Radio, RefreshCw, Send, Pause, Search, Shield, ShieldAlert, TrendingUp,
  UserPlus, Users, X, Stamp, FileText, AlertTriangle, Gavel, Lock,
} from 'lucide-react';
import BugCenterPanel from './BugCenterPanel';
import StaffWalkieTalkieButton from '../StaffWalkieTalkieButton';

interface LiveStream {
  id: string;
  broadcaster_id: string;
  user_id: string;
  title: string | null;
  is_live: boolean | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  category: string | null;
  agora_channel: string | null;
}

interface RTSSession {
  id: string;
  user_id: string;
  room_name: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  is_active: boolean | null;
}

interface StreamDetail {
  id: string;
  title: string;
  startedAt: string;
  viewers: number;
  duration: number;
  isLive: boolean;
  broadcasterId: string;
  userId: string;
  totalMinutesAllowed?: number;
  minutesUsed?: number;
  minutesRemaining?: number;
  giftExtensionMinutes?: number;
}

 interface StreamViewer {
   user_id: string;
   username: string;
   avatar_url: string | null;
   is_admin?: boolean | null;
   role?: string | null;
 }

interface UserListItem {
    id: string;
    username: string;
    avatar_url: string | null;
    role: string | null;
    is_admin?: boolean | null;
    last_seen_at?: string;
    created_at?: string;
    referrer_username?: string | null;
    referred_by_username?: string | null;
    walkie_talkie_page?: number | null;
}

interface RTCStats {
  totalMinutes: number;
  activeSessions: number;
  liveStreams: number;
  liveStreamDetails: StreamDetail[];
  totalUsers: number;
}

interface SignupStats {
  today: number;
  week: number;
  month: number;
  total: number;
}

interface ClickStats {
  total: number;
  maiMaiTroll: number;
  googlePlay: number;
  topUrls: { url: string; count: number }[];
}

interface ModerationActionLog {
  id: string;
  target_user_id: string | null;
  actor_id: string | null;
  officer_id: string | null;
  action: string | null;
  action_type: string | null;
  reason: string | null;
  details: string | null;
  status: string | null;
  created_at: string;
  target?: {
    user_id: void; username?: string | null 
} | null;
  actor?: { username?: string | null; role?: string | null; is_admin?: boolean | null } | null;
}

interface StreamAnalyticsDaily {
  date: string;
  total_viewer_minutes: number;
  total_stream_minutes: number;
  total_gifts_count: number;
  total_gift_coins: number;
  unique_viewers: number;
  unique_streams: number;
  avg_watch_time_per_user: number;
  avg_stream_duration: number;
  avg_gifts_per_user: number;
  peak_concurrent_viewers: number;
}

type MainTab = 'rtc' | 'mod_actions' | 'signups' | 'analytics' | 'cashout' | 'bug_center' | 'tromail' | 'walkie_talkie' | 'notary' | 'arrest';

interface TromailInboxItem {
  id: string;
  message_id: string;
  sender_user_id: string;
  sender_role: string;
  sender_tromail_address: string;
  sender_username?: string;
  subject: string;
  body: string;
  read_at: string | null;
  is_important: boolean;
  created_at: string;
}
type UserListType = 'online' | 'all' | null;

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Number(seconds || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}:${secs.toString().padStart(2, '0')}`;
}

function StatCard({ label, value, tone, icon }: { label: string; value: React.ReactNode; tone: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-md border p-2 ${tone}`}>
      <div className="mb-0.5 flex items-center gap-1 text-[9px] uppercase leading-none opacity-90">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-base font-bold leading-tight text-white">{value}</div>
    </div>
  );
}

export default function RTCAdminMonitor() {
const { profile } = useAuthStore();
  const navigate = useNavigate();
  const onlineCount = usePresenceStore((state) => state.onlineCount);
  
  const {
    isConnected,
    isSpeaking,
    isJoining,
    remoteUsers,
    error,
    joinWalkieTalkie,
    leaveWalkieTalkie,
    toggleSpeaking,
    canAccessWalkieTalkie: contextCanAccessWalkieTalkie,
  } = useStaffWalkieTalkieContext();

const staffRoles = ['admin', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary', 'officer', 'hr_admin', 'agency_hr_manager', 'ceo', 'superadmin', 'empire_partner', 'auctioneer', 'attorney', 'prosecutor', 'pastor', 'journalist', 'tcnn_news_caster', 'tcnn_chief_news_caster', 'agency_hr', 'agency_leader', 'ceo_assistant', 'noah_assistant', 'academy_teacher', 'academy_director', 'admissions_officer'];
   const isStaff = profile?.is_admin === true || staffRoles.includes(profile?.role || '');
  const isFullAdmin = profile?.is_admin === true || ['admin', 'ceo', 'superadmin'].includes(profile?.role || '');
  const canUseWalkieTalkie = contextCanAccessWalkieTalkie;

  const isTargetAdmin = (target: UserListItem | StreamViewer | any): boolean => {
    return target.role === 'admin' || target.role === 'superadmin' || target.role === 'ceo' || target.is_admin === true;
  };

  const [isOpen, setIsOpen] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('rtc');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<number | null>(null);
  const { isMobileWidth } = useIsMobile();

  // Draggable panel state
  const [isManuallyClosed, setIsManuallyClosed] = useState(false);
  const [monitorPos, setMonitorPos] = useState<{ top: number; left: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const dragMovedRef = useRef(false);
  const monitorPosLoadedRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Floating button drag state
  const [floatBtnPos, setFloatBtnPos] = useState<{ top: number; left: number } | null>(null);
  const [isFloatBtnDragging, setIsFloatBtnDragging] = useState(false);
  const floatBtnDragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const floatBtnDragMovedRef = useRef(false);
  const floatBtnPosLoadedRef = useRef(false);
  const floatBtnRef = useRef<HTMLDivElement>(null);

  // Mobile mini bubble state
  const [mobileMiniOpen, setMobileMiniOpen] = useState(false);
  const [mobileMiniPos, setMobileMiniPos] = useState<{ top: number; left: number } | null>(null);
  const [isMobileDragging, setIsMobileDragging] = useState(false);
  const mobileDragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const mobileDragMovedRef = useRef(false);
  const mobilePosLoadedRef = useRef(false);

  const [stats, setStats] = useState<RTCStats>({
    totalMinutes: 0,
    activeSessions: 0,
    liveStreams: 0,
    liveStreamDetails: [],
    totalUsers: 0,
  });

  // RTC minutes reset state — manual restart only, never auto-resets on live creation
  const [rtcMinutesResetAt, setRtcMinutesResetAt] = useState<Date | null>(null);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  // Track the last fetch time so live-creation events don't trigger a full counter reset
  const lastRtcFetchRef = useRef<number>(0);

  const [userListType, setUserListType] = useState<UserListType>(null);
  const [userList, setUserList] = useState<UserListItem[]>([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // State to track if we should show a flashing notification for new signups
  const [showSignupFlash, setShowSignupFlash] = useState(false);
  const prevTotalUsersRef = useRef<number | null>(null);

  // State to track error flash (red)
  const [showErrorFlash, setShowErrorFlash] = useState(false);

  // State to track new non-admin user coming online (white flash)
  const [showOnlineFlash, setShowOnlineFlash] = useState(false);
  const prevOnlineUserIdsRef = useRef<Set<string>>(new Set());
  const isFirstOnlineCheckRef = useRef(true);

  // State to track new live stream (black ring flash)
  const [showLiveFlash, setShowLiveFlash] = useState(false);

  // State to track new report (purple flash)
  const [showReportFlash, setShowReportFlash] = useState(false);

  const [actionTarget, setActionTarget] = useState<UserListItem | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionDuration, setActionDuration] = useState('');
  const [actionAmount, setActionAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [modActionLogs, setModActionLogs] = useState<ModerationActionLog[]>([]);
  const [modLogsLoading, setModLogsLoading] = useState(false);

  // Username editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsernameValue, setEditUsernameValue] = useState('');
  const [usernameEditLoading, setUsernameEditLoading] = useState(false);

  // Arrest-specific state
  const [arrestReason, setArrestReason] = useState('');
  const [arrestSeverity, setArrestSeverity] = useState('moderate');
  const [arrestBailAmount, setArrestBailAmount] = useState(100);

  // Arrest tab state
  const [arrestSearchUsername, setArrestSearchUsername] = useState('');
  const [arrestSearchResults, setArrestSearchResults] = useState<any[]>([]);
  const [arrestSearchLoading, setArrestSearchLoading] = useState(false);
  const [arrestTabReason, setArrestTabReason] = useState('');
  const [arrestTabSeverity, setArrestTabSeverity] = useState('moderate');
  const [arrestTabLoading, setArrestTabLoading] = useState(false);
  const [arrestLogs, setArrestLogs] = useState<any[]>([]);
  const [arrestLogsLoading, setArrestLogsLoading] = useState(false);
  const [arrestCurrentInmates, setArrestCurrentInmates] = useState<any[]>([]);
  const [arrestInmatesLoading, setArrestInmatesLoading] = useState(false);
  const [arrestReleaseLoading, setArrestReleaseLoading] = useState<string | null>(null);

  const [selectedStream, setSelectedStream] = useState<StreamDetail | null>(null);
  const [selectedStreamBroadcaster, setSelectedStreamBroadcaster] = useState('');
  const [streamViewers, setStreamViewers] = useState<StreamViewer[]>([]);
  const [streamModalLoading, setStreamModalLoading] = useState(false);
  const [streamActionReason, setStreamActionReason] = useState('');
  const [streamActionLoading, setStreamActionLoading] = useState(false);

  const [signupStats, setSignupStats] = useState<SignupStats>({ today: 0, week: 0, month: 0, total: 0 });
  const [recentSignups, setRecentSignups] = useState<UserListItem[]>([]);
  const [signupLoading, setSignupLoading] = useState(false);

  const [clickStats, setClickStats] = useState<ClickStats>({ total: 0, maiMaiTroll: 0, googlePlay: 0, topUrls: [] });
  const [clickLoading, setClickLoading] = useState(false);

  const [cashoutBonusData, setCashoutBonusData] = useState<any[]>([]);
  const [cashoutLoading, setCashoutLoading] = useState(false);

const [analyticsRange, setAnalyticsRange] = useState<1 | 7 | 30>(7);
   const [streamAnalyticsRows, setStreamAnalyticsRows] = useState<StreamAnalyticsDaily[]>([]);
   const [analyticsLoading, setAnalyticsLoading] = useState(false);

    // Dropdown state for user action menus
   const [openDropdownUserId, setOpenDropdownUserId] = useState<string | null>(null);
   const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number } | null>(null);

    // Tromail inbox state
   const [tromailInbox, setTromailInbox] = useState<TromailInboxItem[]>([]);
   const [tromailUnreadCount, setTromailUnreadCount] = useState(0);
    const [tromailLoading, setTromailLoading] = useState(false);
    const [lastTromailFetch, setLastTromailFetch] = useState<Date>(new Date());

    // Notary state
    const [notarySubTab, setNotarySubTab] = useState<'pending' | 'approved' | 'rejected' | 'logs'>('pending');
    const [notaryDocuments, setNotaryDocuments] = useState<any[]>([]);
    const [notaryLoading, setNotaryLoading] = useState(false);

    // Walkie-talkie state for LiveKit mic muting coordination
   const [walkieTalkieMutedLiveKit, setWalkieTalkieMutedLiveKit] = useState(false);

// Walkie-talkie allowed roles (same as in StaffWalkieTalkieProvider)
    const WALKIE_TALKIE_ALLOWED_ROLES = [
      'admin', 'ceo', 'staff', 'officer', 'broadofficer',
      'troll_officer', 'lead_troll_officer', 'secretary', 'president',
      'agency_hr', 'agency_hr_manager', 'agency_leader', 'attorney',
      'prosecutor', 'journalist', 'tcnn_news_caster', 'tcnn_chief_news_caster',
      'auctioneer', 'pastor', 'org_admin', 'empire_partner',
      'ceo_assistant', 'noah_assistant',
    ];
  

   const streamDetailsWithDuration = useMemo(() => {
    return stats.liveStreamDetails.map((stream) => {
      const startedAt = stream.startedAt ? new Date(stream.startedAt).getTime() : now;
      return {
        ...stream,
        duration: Math.floor((now - startedAt) / 1000),
      };
    });
  }, [now, stats.liveStreamDetails]);

  const totalViewers = useMemo(() => streamDetailsWithDuration.reduce((sum, s) => sum + s.viewers, 0), [streamDetailsWithDuration]);

  const analyticsSummary = useMemo(() => {
    const base = streamAnalyticsRows.reduce(
      (sum, row) => {
        sum.totalViewerMinutes += Number(row.total_viewer_minutes || 0);
        sum.totalStreamMinutes += Number(row.total_stream_minutes || 0);
        sum.totalGiftsCount += Number(row.total_gifts_count || 0);
        sum.totalGiftCoins += Number(row.total_gift_coins || 0);
        sum.uniqueViewers += Number(row.unique_viewers || 0);
        sum.uniqueStreams += Number(row.unique_streams || 0);
        sum.peakConcurrentViewers = Math.max(sum.peakConcurrentViewers, Number(row.peak_concurrent_viewers || 0));
        return sum;
      },
      {
        totalViewerMinutes: 0,
        totalStreamMinutes: 0,
        totalGiftsCount: 0,
        totalGiftCoins: 0,
        uniqueViewers: 0,
        uniqueStreams: 0,
        peakConcurrentViewers: 0,
      },
    );

    const giftRevenueUsd = base.totalGiftCoins / 100;
    return {
      ...base,
      avgWatchTimePerUser: base.uniqueViewers > 0 ? base.totalViewerMinutes / base.uniqueViewers : 0,
      avgStreamDuration: base.uniqueStreams > 0 ? base.totalStreamMinutes / base.uniqueStreams : 0,
      revenuePer1000ViewerMinutes: base.totalViewerMinutes > 0 ? (giftRevenueUsd / base.totalViewerMinutes) * 1000 : 0,
    };
  }, [streamAnalyticsRows]);

const fetchRTCStats = useCallback(async () => {
     if (!isStaff) return;
     setIsLoading(true);
     try {
        const { data: allStreamsData, error: streamsError } = await supabase
          .from('streams')
          .select('id, broadcaster_id, user_id, title, is_live, status, started_at, ended_at, category, agora_channel')
          .order('started_at', { ascending: false });

        if (streamsError) throw streamsError;

        const currentTime = Date.now();
        const allStreams = ((allStreamsData || []) as LiveStream[]);
        const liveStreams = allStreams
          .filter(s => s.is_live || s.status === 'live')
          .slice(0, 10);

       const streamDetails = await Promise.all(
         liveStreams.map(async (stream) => {
           const { count } = await supabase
             .from('stream_seat_sessions')
             .select('id', { count: 'exact', head: true })
             .eq('stream_id', stream.id)
             .eq('status', 'active');

           const startedAt = stream.started_at ? new Date(stream.started_at).getTime() : currentTime;

           // Fetch minute tracking data from streams table
           const { data: streamData } = await supabase
             .from('streams')
             .select('total_minutes_allowed, minutes_used, minutes_remaining, gift_extension_minutes')
             .eq('id', stream.id)
             .maybeSingle();

           return {
             id: stream.id,
             title: stream.title || 'Untitled',
             startedAt: stream.started_at || new Date().toISOString(),
             viewers: count || 0,
             duration: Math.floor((currentTime - startedAt) / 1000),
             isLive: Boolean(stream.is_live || stream.status === 'live'),
             broadcasterId: stream.broadcaster_id,
             userId: stream.user_id,
             totalMinutesAllowed: Number(streamData?.total_minutes_allowed) || 360,
             minutesUsed: Number(streamData?.minutes_used) || 0,
             minutesRemaining: streamData?.minutes_remaining !== null ? Number(streamData?.minutes_remaining) : undefined,
             giftExtensionMinutes: Number(streamData?.gift_extension_minutes) || 0,
           };
         }),
       );

       const { data: sessions } = await supabase
         .from('rtc_sessions')
         .select('id, user_id, room_name, started_at, ended_at, duration_seconds, is_active');

       const rtcSessions = (sessions || []) as RTSSession[];
       const resetTime = rtcMinutesResetAt ? rtcMinutesResetAt.getTime() : 0;

        const totalSeconds = allStreams.reduce((sum, stream) => {
          const streamStart = stream.started_at ? new Date(stream.started_at).getTime() : 0;
          if (streamStart < resetTime || streamStart <= 0) return sum;

          const streamEnd = stream.ended_at ? new Date(stream.ended_at).getTime() : currentTime;
          const durationMs = streamEnd - streamStart;
          if (durationMs <= 0) return sum;

          return sum + Math.floor(durationMs / 1000);
        }, 0);

       const { count: totalUsers } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true });

       setStats({
         totalMinutes: Math.floor(totalSeconds / 60),
         activeSessions: rtcSessions.filter((s) => s.is_active).length,
         liveStreams: streamDetails.length,
         liveStreamDetails: streamDetails,
         totalUsers: totalUsers || 0,
       });
       setLastRefresh(new Date());
       setNow(Date.now());
       lastRtcFetchRef.current = Date.now();
     } catch (err: any) {
       if (err?.name === 'AbortError' || err?.message?.includes('steal')) {
         console.warn('[RTC Monitor] Realtime lock contention (non-fatal):', err?.message);
       } else {
         console.error('[RTC Monitor] Error:', err);
         toast.error('Failed to refresh RTC monitor');
         setShowErrorFlash(true);
         setTimeout(() => setShowErrorFlash(false), 5000);
       }
     } finally {
       setIsLoading(false);
     }
   }, [isStaff, rtcMinutesResetAt]);

  const fetchSignupData = useCallback(async () => {
    if (!isStaff) return;
    setSignupLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [{ count: total }, { count: today }, { count: week }, { count: month }] = await Promise.all([
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo.toISOString()),
      ]);

      setSignupStats({ today: today || 0, week: week || 0, month: month || 0, total: total || 0 });

      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, role, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      setRecentSignups((data || []) as UserListItem[]);
    } catch (err) {
      console.error('[RTC Monitor] Error fetching signups:', err);
    } finally {
      setSignupLoading(false);
    }
  }, [isStaff]);

  const fetchClickStats = useCallback(async () => {
    if (!isStaff) return;
    setClickLoading(true);
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [{ count: total }, { count: maiMaiTroll }, { count: googlePlay }, { data: topUrlsData }] = await Promise.all([
        supabase.from('outbound_clicks').select('id', { count: 'exact', head: true }),
        supabase.from('outbound_clicks').select('id', { count: 'exact', head: true }).ilike('url', '%maiMaiTroll.com%'),
        supabase.from('outbound_clicks').select('id', { count: 'exact', head: true }).ilike('url', '%play.google.com/store/apps/details?id=com.Mai Troll.twa%'),
        supabase.from('outbound_clicks').select('url, created_at').gte('created_at', sevenDaysAgo),
      ]);

      const counts: Record<string, number> = {};
      (topUrlsData || []).forEach((click: any) => {
        counts[String(click.url || 'unknown')] = (counts[String(click.url || 'unknown')] || 0) + 1;
      });

      setClickStats({
        total: total || 0,
        maiMaiTroll: maiMaiTroll || 0,
        googlePlay: googlePlay || 0,
        topUrls: Object.entries(counts).map(([url, count]) => ({ url, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      });
    } catch (err) {
      console.error('[RTC Monitor] Error fetching click stats:', err);
    } finally {
      setClickLoading(false);
    }
  }, [isStaff]);

  const fetchStreamAnalytics = useCallback(async () => {
    if (!isStaff) return;
    setAnalyticsLoading(true);
    try {
      await supabase.rpc('aggregate_stream_analytics');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (analyticsRange - 1));
      const { data, error } = await supabase
        .from('stream_analytics_daily')
        .select('*')
        .gte('date', startDate.toISOString().slice(0, 10))
        .order('date', { ascending: true });
      if (error) throw error;
      setStreamAnalyticsRows((data || []) as StreamAnalyticsDaily[]);
    } catch (err) {
      console.error('[RTC Monitor] Error fetching stream analytics:', err);
      setStreamAnalyticsRows([]);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsRange, isStaff]);

  const fetchCashoutBonusData = useCallback(async () => {
    if (!isStaff) return;
    setCashoutLoading(true);
    try {
      const promoStart = '2026-05-01T21:00:00.000Z';
      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, created_at, troll_coins, reserved_troll_coins, total_earned_coins')
        .gte('created_at', promoStart)
        .order('created_at', { ascending: true })
        .limit(200);

      const rows = (data || []).map((user: any, index: number) => {
        const availableCoins = Math.max(0, Number(user.troll_coins || 0) - Number(user.reserved_troll_coins || 0));
        return {
          id: user.id,
          username: user.username || 'unknown',
          avatar_url: user.avatar_url,
          created_at: user.created_at,
          signupRank: index + 1,
          paidCoinsReceived: availableCoins,
          qualifies: availableCoins >= 5000,
          bonusAmount: availableCoins >= 5000 ? 1000 : 0,
          totalEarned: user.total_earned_coins || 0,
        };
      });
      setCashoutBonusData(rows);
    } catch (err) {
      console.error('[RTC Monitor] Error fetching cashout bonus data:', err);
    } finally {
      setCashoutLoading(false);
    }
  }, [isStaff]);

  const openUserList = useCallback(async (type: 'online' | 'all') => {
    setUserListType(type);
    setUserList([]);
    setUserListLoading(true);
    setEditingUserId(null); // Clear any active edit
    setEditUsernameValue('');
    try {
      if (type === 'online') {
        // Use onlineUserIds from the presence store (populated by GlobalPresenceTracker
        // via Supabase Realtime Presence) instead of querying the user_presence DB table.
        // The DB table is no longer written to by the presence tracker, so querying it
        // returns stale/empty data even though onlineCount is correct.
        const onlineUserIds = usePresenceStore.getState().onlineUserIds;
        const userIds = Array.from(onlineUserIds);
        if (userIds.length === 0) {
          setUserList([]);
          return;
        }
        const { data } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url, role, is_admin, walkie_talkie_page')
            .in('id', userIds)
            .limit(200);

        setUserList((data || []) as UserListItem[]);
      } else {
        const { data } = await supabase.from('user_profiles').select('id, username, avatar_url, role, is_admin, walkie_talkie_page').order('created_at', { ascending: false }).limit(200);
        setUserList((data || []) as UserListItem[]);
      }
    } catch (err) {
      console.error('[RTC Monitor] Error fetching user list:', err);
    } finally {
      setUserListLoading(false);
    }
  }, []);

  const closeUserList = useCallback(() => {
    setUserListType(null);
    setUserList([]);
    setUserSearch('');
    setActionTarget(null);
    setActiveAction(null);
    setEditingUserId(null);
    setEditUsernameValue('');
  }, []);

  const handleUsernameSave = useCallback(async (userId: string, newUsername: string) => {
    if (!newUsername.trim()) {
      toast.error('Username cannot be empty');
      return;
    }

    setUsernameEditLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ username: newUsername.trim() })
        .eq('id', userId);

      if (error) throw error;

      // Update local userList state to reflect change immediately
      setUserList(prev => prev.map(u =>
        u.id === userId ? { ...u, username: newUsername.trim() } : u
      ));

      toast.success(`Username changed to @${newUsername.trim()}`);
      setEditingUserId(null);
      setEditUsernameValue('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update username');
      console.error('[RTC Monitor] Username update error:', err);
    } finally {
      setUsernameEditLoading(false);
    }
  }, []);

const openAction = useCallback((user: UserListItem, action: string) => {
    setActionTarget(user);
    setActiveAction(action);
    setActionReason('');
    setActionDuration('');
    setActionAmount('');
    if (action === 'arrest') {
        setArrestReason('');
        setArrestSeverity('moderate');
        setArrestBailAmount(100);
    }
}, []);

  const closeAction = useCallback(() => {
    setActionTarget(null);
    setActiveAction(null);
    setActionReason('');
    setActionDuration('');
    setActionAmount('');
  }, []);

  const fetchModActionLogs = useCallback(async () => {
    if (!isStaff) return;
    setModLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('moderation_actions')
        .select('id, target_user_id, actor_id, officer_id, action, action_type, reason, details, status, created_at')
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) throw error;

      const ids = Array.from(
        new Set(
          (data || [])
            .flatMap((row: any) => [row.target_user_id, row.actor_id || row.officer_id])
            .filter(Boolean)
        )
      );
      const { data: profiles } = ids.length
        ? await supabase.from('user_profiles').select('id, username, role, is_admin').in('id', ids)
        : { data: [] as any[] };
      const profileMap = new Map((profiles || []).map((row: any) => [row.id, row]));

      setModActionLogs(
        ((data || []) as any[]).map((row) => ({
          ...row,
          target: profileMap.get(row.target_user_id) || null,
          actor: profileMap.get(row.actor_id || row.officer_id) || null,
        }))
      );
    } catch (err) {
      console.warn('[RTC Monitor] Could not load moderation action feed:', err);
      setModActionLogs([]);
    } finally {
      setModLogsLoading(false);
    }
  }, [isStaff]);

  useEffect(() => {
    if (isOpen && activeMainTab === 'mod_actions' && modActionLogs.length === 0) {
      fetchModActionLogs();
    }
  }, [activeMainTab, fetchModActionLogs, isOpen, modActionLogs.length]);

 const executeAction = useCallback(async () => {
     if (!actionTarget || !activeAction) return;

     // No one can act on themselves
     if (actionTarget.id === profile?.id) {
         toast.error(`Cannot ${activeAction} yourself`);
         return;
     }

     // Staff cannot arrest/kick/mute/ban admins unless they are full admins
     if (!isFullAdmin && isTargetAdmin(actionTarget) && ['arrest', 'kick', 'mute', 'ban'].includes(activeAction)) {
         toast.error(`Cannot ${activeAction} an administrator`);
         return;
     }

     setActionLoading(true);
     try {
         if (activeAction === 'warn') {
             const adminUsername = profile?.username || 'Admin';
             const warningMessage = actionReason || `You have been warned by @${adminUsername}.`;
             const { error } = await supabase.from('notifications').insert({
                 user_id: actionTarget.id,
                 type: 'moderation_alert',
                 title: `⚠️ Warning from @${adminUsername}`,
                 message: warningMessage,
                 metadata: { action_url: '/profile', warned_by: profile?.id, warned_by_username: adminUsername },
             });
             if (error) throw error;
             toast.success(`@${actionTarget.username} warned`);
             await supabase.from('moderation_actions').insert({
               actor_id: profile?.id,
               officer_id: profile?.id,
               target_user_id: actionTarget.id,
               action: 'warn',
               action_type: 'warn',
               reason: warningMessage,
               details: 'rtc_monitor',
               status: 'active',
             }).then(() => undefined, () => undefined);
         }

          if (activeAction === 'mute') {
              const minutes = actionDuration ? parseInt(actionDuration, 10) : 60;
              if (!selectedStream) {
                  toast.error('Open the stream first to mute a viewer');
                  return;
              }
              const { error } = await supabase.rpc('moderator_mute_user', {
                p_stream_id: selectedStream.id,
                p_target_user_id: actionTarget.id,
                p_duration_minutes: minutes,
                p_reason: actionReason || 'Admin mute via RTC Monitor',
              });
              if (error) throw error;
              toast.success(`@${actionTarget.username} muted`);
          }

         if (activeAction === 'kick' || activeAction === 'ban') {
             const minutes = activeAction === 'kick' ? 10 : actionDuration ? parseInt(actionDuration, 10) * 1440 : 525600;
             const { error } = await supabase.rpc('ban_user', {
                 target: actionTarget.id,
                 minutes,
                 reason: actionReason || `Admin ${activeAction} via RTC Monitor`,
                 acting_admin_id: profile?.id,
             });
             if (error) throw error;
             await supabase.from('moderation_actions').insert({
               actor_id: profile?.id,
               officer_id: profile?.id,
               target_user_id: actionTarget.id,
               action: activeAction,
               action_type: activeAction,
               reason: actionReason || `Admin ${activeAction} via RTC Monitor`,
               details: `duration_minutes:${minutes}`,
               status: 'active',
             }).then(() => undefined, () => undefined);
             toast.success(`@${actionTarget.username} ${activeAction === 'kick' ? 'kicked' : 'banned'}`);
         }

         if (activeAction === 'grant') {
             const amount = parseInt(actionAmount, 10);
             if (!amount || amount <= 0) throw new Error('Enter a valid amount');
             const { error } = await supabase.rpc('admin_grant_coins', {
                 p_user_id: actionTarget.id,
                 p_amount: amount,
                 p_reason: actionReason || 'Admin grant via RTC Monitor',
             });
             if (error) throw error;
             toast.success(`Granted ${amount.toLocaleString()} coins`);
         }

         if (activeAction === 'arrest') {
             // Additional protected roles check (for non-admin officers)
             const protectedRoles = ['admin', 'ceo', 'secretary', 'pastor', 'lead_troll_officer', 'troll_officer'];
             if (protectedRoles.includes(actionTarget.role || '')) {
                 toast.error(`Cannot arrest a user with role: ${actionTarget.role}`);
                 return;
             }

             // Calculate bail amount based on severity
             const SEVERITY_LEVELS = [
                 { id: 'minor', bailMultiplier: 1 },
                 { id: 'moderate', bailMultiplier: 2 },
                 { id: 'serious', bailMultiplier: 5 }
             ];
             
             const severity = SEVERITY_LEVELS.find(s => s.id === arrestSeverity);
             const bail = severity ? severity.bailMultiplier * 100 : 100;

             // Get next court date (Tue or Thu)
             const today = new Date();
             const dow = today.getDay();
             let nextCourtDate: Date;
             if (dow === 0 || dow === 1) nextCourtDate = new Date(today.setDate(today.getDate() + (2 - dow))); // Sun/Mon -> Tue
             else if (dow === 2 || dow === 3) nextCourtDate = new Date(today.setDate(today.getDate() + (4 - dow))); // Tue/Wed -> Thu
             else if (dow === 4) nextCourtDate = today; // Thu -> today
             else nextCourtDate = new Date(today.setDate(today.getDate() + (2 + 7 - dow) % 7)); // Fri/Sat -> Tue
             
             const courtDateStr = nextCourtDate.toISOString().split('T')[0];

              // 1. Create jail record
              const arrestDate = new Date().toISOString();

              // Look up arrested user's IP geolocation for geofence device tracking
              const { data: userIpRecords } = await supabase
                .from('user_ip_tracking')
                .select('latitude, longitude, ip_address')
                .eq('user_id', actionTarget.id)
                .order('created_at', { ascending: false })
                .limit(1);

              const { error: jailError } = await supabase.from('jail').insert({
                  user_id: actionTarget.id,
                  release_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day default
                  reason: arrestReason,
                  sentence_days: 1,
                  arrested_by: profile?.id,
                  court_date: courtDateStr,
                  status: 'jailed',
                  severity: arrestSeverity,
                  bond_amount: bail,
                  arrest_latitude: userIpRecords?.[0]?.latitude ?? null,
                  arrest_longitude: userIpRecords?.[0]?.longitude ?? null,
              });
             
             if (jailError) throw jailError;

             // 2. Find or create court docket for next Tue/Thu
             const { data: docket, error: docketError } = await supabase
                 .from('court_dockets')
                 .select('id, cases_count')
                 .eq('court_date', courtDateStr)
                 .maybeSingle();
                 
             if (docketError) throw docketError;

             let docketId: string;

             if (docket && docket.cases_count < 20) {
                 docketId = docket.id;
                 const { error: updateError } = await supabase
                     .from('court_dockets')
                     .update({ cases_count: (docket.cases_count || 0) + 1 })
                     .eq('id', docketId);
                     
                 if (updateError) throw updateError;
             } else {
                 const { data: newDocket, error: insertError } = await supabase
                     .from('court_dockets')
                     .insert({
                         court_date: courtDateStr,
                         max_cases: 20,
                         cases_count: 1,
                         status: 'open',
                     })
                     .select()
                     .single();
                     
                 if (insertError) throw insertError;
                 docketId = newDocket?.id;
                 
                 if (!docketId) throw new Error('Failed to create court docket');
             }

             // 3. Create court case
             const { error: caseError } = await supabase.from('court_cases').insert({
                 docket_id: docketId,
                 defendant_id: actionTarget.id,
                 plaintiff_id: profile?.id,
                 reason: arrestReason,
                 status: 'pending',
                 case_type: 'criminal'
             });
             
             if (caseError) throw caseError;

             await supabase.from('moderation_actions').insert({
                 actor_id: profile?.id,
                 officer_id: profile?.id,
                 target_user_id: actionTarget.id,
                 action: 'arrest',
                 action_type: 'arrest',
                 reason: arrestReason,
                 details: `court_date:${courtDateStr}; bail:${bail}; admin_locked:${isFullAdmin}`,
                 status: 'active',
             }).then(() => undefined, () => undefined);

             toast.success(`@${actionTarget.username} arrested - Court: ${new Date(courtDateStr).toLocaleDateString()}`);
         }

         fetchModActionLogs();
         closeAction();
     } catch (err: any) {
         console.error('[RTC Monitor] Action error:', err);
         toast.error(err?.message || 'Action failed');
     } finally {
         setActionLoading(false);
     }
  }, [actionAmount, actionDuration, actionReason, actionTarget, activeAction, arrestReason, arrestSeverity, arrestBailAmount, closeAction, fetchModActionLogs, isFullAdmin, profile?.id, isTargetAdmin, selectedStream]);

  const openStreamModal = useCallback(async (stream: StreamDetail) => {
    setSelectedStream(stream);
    setSelectedStreamBroadcaster('');
    setStreamViewers([]);
    setStreamActionReason('');
    setStreamModalLoading(true);
    try {
       const [{ data: viewers }, { data: broadcasterProfile }] = await Promise.all([
         supabase
           .from('stream_seat_sessions')
           .select('user_id, user_profiles!inner(id, username, avatar_url, role, is_admin)')
           .eq('stream_id', stream.id)
           .eq('status', 'active')
           .limit(100),
         supabase.from('user_profiles').select('username').eq('id', stream.broadcasterId).maybeSingle(),
       ]);

       setStreamViewers((viewers || []).map((row: any) => ({
         user_id: row.user_id,
         username: row.user_profiles.username || 'unknown',
         avatar_url: row.user_profiles.avatar_url,
         is_admin: row.user_profiles.is_admin || false,
         role: row.user_profiles.role || null,
       })));
      setSelectedStreamBroadcaster(broadcasterProfile?.username || 'unknown');
    } catch (err) {
      console.error('[RTC Monitor] Error fetching stream viewers:', err);
    } finally {
      setStreamModalLoading(false);
    }
  }, []);

  const closeStreamModal = useCallback(() => {
    setSelectedStream(null);
    setStreamViewers([]);
    setStreamActionReason('');
    setSelectedStreamBroadcaster('');
  }, []);

  const endStream = useCallback(async () => {
    if (!selectedStream) return;
    setStreamActionLoading(true);
    try {
      const { error } = await supabase
        .from('streams')
        .update({ is_live: false, status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', selectedStream.id);
      if (error) throw error;
      toast.success('Stream ended');
      closeStreamModal();
      fetchRTCStats();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to end stream');
    } finally {
      setStreamActionLoading(false);
    }
  }, [closeStreamModal, fetchRTCStats, selectedStream]);

   const kickUserFromStream = useCallback(async (userId: string, username: string) => {
     try {
       // Staff cannot kick admins unless they are full admins
       if (!isFullAdmin) {
         const viewer = streamViewers.find(v => v.user_id === userId);
         const targetIsAdmin = viewer?.is_admin === true || viewer?.role === 'admin' || viewer?.role === 'superadmin' || viewer?.role === 'ceo';
         if (targetIsAdmin) {
           toast.error('Cannot kick an administrator');
           return;
         }
       }

       const { error } = await supabase.rpc('ban_user', {
         target: userId,
         minutes: 30,
         reason: streamActionReason || 'Kicked from stream via RTC Monitor',
         acting_admin_id: profile?.id,
       });
       if (error) throw error;
       setStreamViewers((prev) => prev.filter((viewer) => viewer.user_id !== userId));
       toast.success(`@${username} kicked`);
     } catch (err: any) {
       toast.error(err?.message || 'Failed to kick user');
     }
   }, [profile?.id, streamActionReason, isFullAdmin, streamViewers]);

  const summonFromStream = useCallback(async (userId: string, username: string) => {
    try {
      const { error } = await supabase.rpc('summon_user_to_court', {
        p_defendant_id: userId,
        p_reason: streamActionReason || 'Summoned from stream via RTC Monitor',
        p_users_involved: [],
      });
      if (error) throw error;
      toast.success(`@${username} summoned to court`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to summon user');
    }
  }, [streamActionReason]);

  const fetchTromailInbox = useCallback(async () => {
    if (!profile?.id) return
    
    setTromailLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_tromail_inbox', { p_user_id: profile.id })
      if (error) throw error
      
      const messages = (data || []) as TromailInboxItem[]
      setTromailInbox(messages.slice(0, 10))
      
      const unread = messages.filter(m => !m.read_at)
      setTromailUnreadCount(unread.length)
      setLastTromailFetch(new Date())
    } catch (err) {
      console.error('[RTCAdminMonitor] Tromail fetch error:', err)
    } finally {
      setTromailLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    if (isOpen && isStaff && activeMainTab === 'tromail') {
      fetchTromailInbox()
      // OPTIMIZED: visibility check
      const interval = window.setInterval(() => {
        if (document.visibilityState === 'visible') fetchTromailInbox()
      }, 30000)
      return () => window.clearInterval(interval)
    }
  }, [isOpen, isStaff, activeMainTab, fetchTromailInbox])

   useEffect(() => {
     if (!isStaff || !profile?.id) return

     const channelName = `tromail-inbox:${profile?.id}:admin-monitor`
     const channel = supabase
       .channel(channelName)
       .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tromail_recipients',
          filter: `recipient_user_id=eq.${profile?.id}`,
        },
        (payload) => {
          const newRecipient = payload.new as any
          if (newRecipient) {
            supabase
              .from('tromail_messages')
              .select('id, sender_user_id, sender_role, sender_tromail_address, subject, body, is_important, created_at')
              .eq('id', newRecipient.message_id)
              .single()
              .then(({ data: msg }) => {
                if (msg) {
                  const fullMessage: TromailInboxItem = {
                    id: newRecipient.id,
                    message_id: msg.id,
                    sender_user_id: msg.sender_user_id,
                    sender_role: msg.sender_role,
                    sender_tromail_address: msg.sender_tromail_address,
                    subject: msg.subject,
                    body: msg.body,
                    read_at: newRecipient.read_at,
                    is_important: msg.is_important,
                    created_at: msg.created_at,
                  }
                  
                  setTromailInbox(prev => [fullMessage, ...prev].slice(0, 10))
                  if (!newRecipient.read_at) {
                    setTromailUnreadCount(prev => prev + 1)
                  }
                  
                  toast.info(`New Tromail: ${msg.subject}`, {
                    action: {
                      label: 'View',
                      onClick: () => navigate(`/tromail?messageId=${msg.id}`),
                    },
                  })
                }
              })
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIPTION_ERROR') {
          console.warn('[RTCAdminMonitor] Tromail subscription error (lock contention) — will retry');
        }
      })

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [isStaff, profile?.id])

  const handleTromailMessageClick = (messageId: string) => {
    navigate(`/tromail?messageId=${messageId}`)
    if (isOpen) {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (!isStaff) return;

    // OPTIMIZED: All admin polling uses visibility check
    const visCheck = (fn: () => void) => () => {
      if (document.visibilityState === 'visible') fn();
    };

    if (activeMainTab === 'rtc') {
      fetchRTCStats();
      const interval = window.setInterval(visCheck(fetchRTCStats), 30000);
      return () => window.clearInterval(interval);
    }

    if (activeMainTab === 'signups') {
      fetchSignupData();
      const interval = window.setInterval(visCheck(fetchSignupData), 30000);
      return () => window.clearInterval(interval);
    }

    if (activeMainTab === 'analytics') {
      fetchStreamAnalytics();
      fetchClickStats();
      const interval = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchStreamAnalytics();
          fetchClickStats();
        }
      }, 30000);
      return () => window.clearInterval(interval);
    }

    if (activeMainTab === 'cashout') {
      fetchCashoutBonusData();
      const interval = window.setInterval(visCheck(fetchCashoutBonusData), 30000);
      return () => window.clearInterval(interval);
    }

    if (activeMainTab === 'notary') {
      const fetchNotaryDocs = async () => {
        setNotaryLoading(true);
        try {
          const { data } = await supabase
            .from('documents')
            .select('id, title, document_type_slug, status, submitted_by, created_at, version')
            .order('created_at', { ascending: false })
            .limit(50);
          setNotaryDocuments(data || []);
        } catch (err) {
          console.error('Notary fetch error:', err);
        } finally {
          setNotaryLoading(false);
        }
      };
      fetchNotaryDocs();
      const interval = window.setInterval(fetchNotaryDocs, 30000);
      return () => window.clearInterval(interval);
    }
  }, [activeMainTab, fetchCashoutBonusData, fetchClickStats, fetchRTCStats, fetchSignupData, fetchStreamAnalytics, isStaff]);

  // Monitor for new user signups via realtime instead of polling
  useEffect(() => {
    if (!isStaff) return;

    const channel = supabase
      .channel('admin-signup-monitor')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_profiles',
      }, () => {
        setShowSignupFlash(true);
        setTimeout(() => setShowSignupFlash(false), 15000);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIPTION_ERROR') {
          console.warn('[RTCAdminMonitor] Live stream subscription error (lock contention) — will retry');
        }
      });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };

    checkNewOnlineUsers();
    const interval = setInterval(checkNewOnlineUsers, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [isStaff]);

  // Realtime broadcast-end handling: combine the database (postgres_changes) and
  // the explicit broadcast_ended event so the active list drops the broadcaster
  // the instant the shutdown sequence fires — no polling delay.
  useEffect(() => {
    if (!isStaff) return;

    const removeStreamFromActive = (streamId: string) => {
      setStats((prev) => {
        const nextDetails = prev.liveStreamDetails.filter((s) => s.id !== streamId);
        if (nextDetails.length === prev.liveStreamDetails.length) return prev;
        return {
          ...prev,
          liveStreamDetails: nextDetails,
          liveStreams: nextDetails.length,
        };
      });
    };

    const channel = supabase
      .channel('rtc-admin-monitor')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
        },
        ({ new: updatedStream }: { new: any }) => {
          if (
            updatedStream.status === 'ended' ||
            updatedStream.is_live === false ||
            updatedStream.rtc_connected === false
          ) {
            removeStreamFromActive(updatedStream.id);
            return;
          }

          setStats((prev) => ({
            ...prev,
            liveStreamDetails: prev.liveStreamDetails.map((s) =>
              s.id === updatedStream.id ? { ...s, isLive: Boolean(updatedStream.is_live || updatedStream.status === 'live') } : s,
            ),
          }));
        },
      )
      .on('broadcast', { event: 'broadcast_ended' }, ({ payload }: { payload: any }) => {
        if (payload?.stream_id) {
          removeStreamFromActive(payload.stream_id);
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isStaff]);

  // Monitor for new live streams to trigger black ring flash
  useEffect(() => {
    if (!isStaff) return;

    const channel = supabase
      .channel('admin-live-stream-monitor')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'streams',
      }, (payload) => {
        const newStream = payload.new as any;
        if (newStream.is_live === true || newStream.status === 'live') {
          setShowLiveFlash(true);
          setTimeout(() => setShowLiveFlash(false), 4000);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'streams',
      }, (payload) => {
        const updatedStream = payload.new as any;
        const prevStream = payload.old as any;
        if (
          (updatedStream.is_live === true || updatedStream.status === 'live') &&
          !(prevStream.is_live === true || prevStream.status === 'live')
        ) {
          setShowLiveFlash(true);
          setTimeout(() => setShowLiveFlash(false), 4000);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIPTION_ERROR') {
          console.warn('[RTCAdminMonitor] Signup subscription error (lock contention) — will retry');
        }
      });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isStaff]);

  // Monitor for new moderation reports to trigger purple flash
  useEffect(() => {
    if (!isStaff) return;

    const channel = supabase
      .channel('admin-report-monitor')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'moderation_reports',
      }, () => {
        setShowReportFlash(true);
        setTimeout(() => setShowReportFlash(false), 5000);
      })
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isStaff]);

   useEffect(() => {
     if (isOpen && isStaff) {
       timerRef.current = window.setInterval(() => setNow(Date.now()), 1000);
     }
     return () => {
       if (timerRef.current) window.clearInterval(timerRef.current);
     };
   }, [isOpen, isStaff]);

   // Escape key to close modal
   useEffect(() => {
     if (!isOpen) return;

     const handleEscape = (e: KeyboardEvent) => {
       if (e.key === 'Escape') {
         if (activeAction) {
           closeAction();
         } else if (selectedStream) {
           closeStreamModal();
         } else {
           setIsOpen(false);
         }
       }
     };

     window.addEventListener('keydown', handleEscape);
     return () => window.removeEventListener('keydown', handleEscape);
     }, [isOpen, activeAction, selectedStream, closeAction, closeStreamModal, setIsOpen]);

    // Load saved monitor position from sessionStorage when it first opens
    useEffect(() => {
      if (!isOpen || monitorPosLoadedRef.current) return
      monitorPosLoadedRef.current = true

      try {
        const saved = sessionStorage.getItem('rtc-monitor-pos')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed && typeof parsed.top === 'number' && typeof parsed.left === 'number') {
            setMonitorPos({ top: parsed.top, left: parsed.left })
          }
        }
      } catch {
        // use default position
      }
    }, [isOpen])

    // Reset position-loaded flag when monitor closes so we reload next time
    useEffect(() => {
      if (!isOpen) {
        monitorPosLoadedRef.current = false
      }
    }, [isOpen])

    // Drag handlers
    const getEventCoords = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e && e.touches.length > 0) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
      }
      if ('changedTouches' in e && e.changedTouches.length > 0) {
        return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY }
      }
      return { clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY }
    }

    const handleMonitorDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if ((e.target as HTMLElement).closest('button, [role="button"], input, select, textarea')) return
      const panel = panelRef.current
      if (!panel) return
      const rect = panel.getBoundingClientRect()
      const coords = 'touches' in e ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } : { clientX: e.clientX, clientY: e.clientY }
      dragOffsetRef.current = {
        dx: coords.clientX - rect.left,
        dy: coords.clientY - rect.top,
      }
      dragMovedRef.current = false
      setIsDragging(true)
      e.preventDefault()
    }, [])

    const handleMonitorDragMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isDragging) return
      dragMovedRef.current = true
      const { clientX, clientY } = getEventCoords(e)
      const { dx, dy } = dragOffsetRef.current
      setMonitorPos({
        top: Math.max(0, clientY - dy),
        left: Math.max(0, Math.min(window.innerWidth - 320, clientX - dx)),
      })
    }, [isDragging])

    const handleMonitorDragEnd = useCallback(() => {
      if (!isDragging) return
      setIsDragging(false)
      if (monitorPos) {
        try {
          sessionStorage.setItem('rtc-monitor-pos', JSON.stringify(monitorPos))
        } catch {
          // silent
        }
      }
    }, [isDragging, monitorPos])

    useEffect(() => {
      if (!isDragging) return
      const onMove = (e: MouseEvent | TouchEvent) => handleMonitorDragMove(e)
      const onEnd = () => handleMonitorDragEnd()
      window.addEventListener('mousemove', onMove)
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('mouseup', onEnd)
      window.addEventListener('touchend', onEnd)
      return () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('mouseup', onEnd)
        window.removeEventListener('touchend', onEnd)
      }
    }, [isDragging, handleMonitorDragMove, handleMonitorDragEnd])

    // Mobile mini bubble drag handlers
    const handleMobileDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      const bubble = (e.currentTarget as HTMLElement).closest('[data-mobile-mini-bubble]') as HTMLElement | null
      if (!bubble) return
      const rect = bubble.getBoundingClientRect()
      const coords = 'touches' in e ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } : { clientX: e.clientX, clientY: e.clientY }
      mobileDragOffsetRef.current = {
        dx: coords.clientX - rect.left,
        dy: coords.clientY - rect.top,
      }
      mobileDragMovedRef.current = false
      setIsMobileDragging(true)
    }, [])

    const handleMobileDragMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isMobileDragging) return
      mobileDragMovedRef.current = true
      const { clientX, clientY } = getEventCoords(e)
      const { dx, dy } = mobileDragOffsetRef.current
      setMobileMiniPos({
        top: Math.max(0, Math.min(window.innerHeight - 60, clientY - dy)),
        left: Math.max(0, Math.min(window.innerWidth - 60, clientX - dx)),
      })
    }, [isMobileDragging])

    const handleMobileDragEnd = useCallback(() => {
      if (!isMobileDragging) return
      setIsMobileDragging(false)
      if (mobileMiniPos) {
        try {
          sessionStorage.setItem('rtc-mobile-mini-pos', JSON.stringify(mobileMiniPos))
        } catch {
          // silent
        }
      }
    }, [isMobileDragging, mobileMiniPos])

    useEffect(() => {
      if (!isMobileDragging) return
      const onMove = (e: MouseEvent | TouchEvent) => handleMobileDragMove(e)
      const onEnd = () => handleMobileDragEnd()
      window.addEventListener('mousemove', onMove)
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('mouseup', onEnd)
      window.addEventListener('touchend', onEnd)
      return () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('mouseup', onEnd)
        window.removeEventListener('touchend', onEnd)
      }
    }, [isMobileDragging, handleMobileDragMove, handleMobileDragEnd])

    // Floating button drag handlers
    const handleFloatBtnDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      const btn = floatBtnRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const coords = 'touches' in e ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } : { clientX: e.clientX, clientY: e.clientY }
      floatBtnDragOffsetRef.current = {
        dx: coords.clientX - rect.left,
        dy: coords.clientY - rect.top,
      }
      floatBtnDragMovedRef.current = false
      setIsFloatBtnDragging(true)
    }, [])

    const handleFloatBtnDragMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isFloatBtnDragging) return
      floatBtnDragMovedRef.current = true
      const { clientX, clientY } = getEventCoords(e)
      const { dx, dy } = floatBtnDragOffsetRef.current
      const btnW = floatBtnRef.current?.offsetWidth || 80
      const btnH = floatBtnRef.current?.offsetHeight || 80
      setFloatBtnPos({
        top: Math.max(0, Math.min(window.innerHeight - btnH, clientY - dy)),
        left: Math.max(0, Math.min(window.innerWidth - btnW, clientX - dx)),
      })
    }, [isFloatBtnDragging])

    const handleFloatBtnDragEnd = useCallback(() => {
      if (!isFloatBtnDragging) return
      setIsFloatBtnDragging(false)
      if (floatBtnPos) {
        try {
          sessionStorage.setItem('rtc-float-btn-pos', JSON.stringify(floatBtnPos))
        } catch {
          // silent
        }
      }
    }, [isFloatBtnDragging, floatBtnPos])

    useEffect(() => {
      if (!isFloatBtnDragging) return
      const onMove = (e: MouseEvent | TouchEvent) => handleFloatBtnDragMove(e)
      const onEnd = () => handleFloatBtnDragEnd()
      window.addEventListener('mousemove', onMove)
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('mouseup', onEnd)
      window.addEventListener('touchend', onEnd)
      return () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('mouseup', onEnd)
        window.removeEventListener('touchend', onEnd)
      }
    }, [isFloatBtnDragging, handleFloatBtnDragMove, handleFloatBtnDragEnd])

    // Load saved floating button position
    useEffect(() => {
      if (!floatBtnPosLoadedRef.current) {
        floatBtnPosLoadedRef.current = true
        try {
          const saved = sessionStorage.getItem('rtc-float-btn-pos')
          if (saved) {
            const parsed = JSON.parse(saved)
            if (parsed && typeof parsed.top === 'number' && typeof parsed.left === 'number') {
              setFloatBtnPos({ top: parsed.top, left: parsed.left })
            }
          }
        } catch {
          // use default position
        }
      }
    }, [])

    // Load saved mobile mini position
    useEffect(() => {
      if (!mobilePosLoadedRef.current) {
        mobilePosLoadedRef.current = true
        try {
          const saved = sessionStorage.getItem('rtc-mobile-mini-pos')
          if (saved) {
            const parsed = JSON.parse(saved)
            if (parsed && typeof parsed.top === 'number' && typeof parsed.left === 'number') {
              setMobileMiniPos({ top: parsed.top, left: parsed.left })
            }
          }
        } catch {
          // use default position
        }
      }
    }, [])

    // Auto-open monitor on first security-relevant event (channel/session changes)
    // Does not re-open if user manually closed the panel
    const autoOpenIfNeeded = useCallback(() => {
      if (isOpen || isManuallyClosed) return
      setIsOpen(true)
      setIsManuallyClosed(false)
    }, [isOpen, isManuallyClosed])

    // Track last auto-open time to prevent spam
    const lastAutoOpenRef = useRef<number>(0)
    const throttledAutoOpen = useCallback(() => {
      const now = Date.now()
      if (now - lastAutoOpenRef.current < 5000) return
      lastAutoOpenRef.current = now
      autoOpenIfNeeded()
    }, [autoOpenIfNeeded])

    // Monitor rtc_sessions for new channel opened
    useEffect(() => {
      if (!isStaff) return

      const channel = supabase
        .channel('admin-rtc-session-monitor')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'rtc_sessions',
        }, () => {
          throttledAutoOpen()
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIPTION_ERROR') {
            console.warn('[RTCAdminMonitor] Session subscription error (lock contention) — will retry')
          }
        })

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
    }, [isStaff, throttledAutoOpen])

    // Auto-close when clicking the floating monitor button while already open
    const handleFloatingButtonClick = useCallback(() => {
      if (isOpen) {
        setIsManuallyClosed(true)
        setIsOpen(false)
      } else {
        setIsManuallyClosed(false)
        setIsOpen(true)
      }
    }, [isOpen])

    const handleFloatBtnClick = useCallback(() => {
      if (!floatBtnDragMovedRef.current) {
        handleFloatingButtonClick()
      }
    }, [handleFloatingButtonClick])

    // Close dropdown when clicking outside or scrolling/resizing
    useEffect(() => {
      if (!openDropdownUserId) return;

      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.dropdown-trigger-btn') && !target.closest('.dropdown-menu-content')) {
          setOpenDropdownUserId(null);
          setDropdownRect(null);
        }
      };

      const handleScrollOrResize = () => {
        setOpenDropdownUserId(null);
        setDropdownRect(null);
      };

      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScrollOrResize, { passive: true });
      window.addEventListener('resize', handleScrollOrResize);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScrollOrResize);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }, [openDropdownUserId]);

    // Clear position when dropdown closes
    useEffect(() => {
      if (openDropdownUserId === null) {
        setDropdownRect(null);
      }
    }, [openDropdownUserId]);

const renderFloatingButton = () => {
      if (isMobileWidth) return null;
      
      // Only render on web (not mobile)
      if (isMobileWidth) return null;

      const buttonSize = isOpen ? 'h-10 min-w-[2.5rem]' : 'h-20 min-w-[5rem]';
      const iconSize = isOpen ? 'h-4 w-4' : 'h-8 w-8';
      const badgePx = isOpen ? 'px-1.5' : 'px-3';
      const badgePy = isOpen ? 'py-0.5' : 'py-1';
      const badgeTextSize = isOpen ? 'text-[9px]' : 'text-[18px]';

      // Determine flash styling — priority: error (red) > report (purple) > live (black) > signup (dark blue) > online (white)
      const flashClass = showErrorFlash
        ? 'ring-4 ring-red-500 ring-offset-2 animate-pulse shadow-[0_0_24px_rgba(239,68,68,0.7)]'
        : showReportFlash
          ? 'ring-4 ring-purple-500 ring-offset-2 animate-pulse shadow-[0_0_24px_rgba(168,85,247,0.7)]'
          : showLiveFlash
            ? 'ring-4 ring-black ring-offset-2 animate-pulse shadow-[0_0_24px_rgba(0,0,0,0.9)]'
            : showSignupFlash
              ? 'ring-4 ring-blue-800 ring-offset-2 animate-pulse shadow-[0_0_24px_rgba(30,58,138,0.7)]'
              : showOnlineFlash
                ? 'ring-4 ring-white ring-offset-2 animate-pulse shadow-[0_0_20px_rgba(255,255,255,0.5)]'
                : '';

      return (
         <div
           ref={floatBtnRef}
           onMouseDown={handleFloatBtnDragStart}
           onTouchStart={handleFloatBtnDragStart}
           style={{
             position: 'fixed',
             top: floatBtnPos?.top ?? 'auto',
             left: floatBtnPos?.left ?? 'auto',
             bottom: floatBtnPos ? 'auto' : '160px',
             right: floatBtnPos ? 'auto' : '16px',
             zIndex: 100,
             cursor: isFloatBtnDragging ? 'grabbing' : 'pointer',
             userSelect: isFloatBtnDragging ? 'none' : 'auto',
           }}
           className="flex flex-col gap-2 md:bottom-[200px]"
         >
             <button
               type="button"
               onClick={handleFloatBtnClick}
             className={`flex ${buttonSize} items-center justify-center gap-1.5 rounded-full px-2.5 shadow-lg transition-all hover:scale-105 ${flashClass}`}
              style={{
                backgroundColor: showErrorFlash
                  ? '#ef4444'
                  : showReportFlash
                    ? '#a855f7'
                    : showLiveFlash
                      ? '#000000'
                      : stats.liveStreams > 0 ? '#22c55e' : '#3b82f6',
                boxShadow: showErrorFlash
                  ? '0 4px 24px rgba(239,68,68,0.5)'
                  : showReportFlash
                    ? '0 4px 24px rgba(168,85,247,0.5)'
                    : showLiveFlash
                      ? '0 4px 24px rgba(0,0,0,0.7)'
                      : `0 4px 18px ${stats.liveStreams > 0 ? 'rgba(34,197,94,0.35)' : 'rgba(59,130,246,0.35)'}`,
              }}
              title={`RTC Monitor - ${stats.liveStreams} live streams${showErrorFlash ? ' ⚠ ERROR' : ''}${showReportFlash ? ' 📋 NEW REPORT' : ''}${showLiveFlash ? ' 🔴 NEW LIVE' : ''}`}
           >
             <Monitor className={`${iconSize} text-white`} />
             <span className={`inline-flex items-center justify-center rounded-full bg-emerald-300 ${badgePx} ${badgePy} ${badgeTextSize} font-bold leading-none text-black`}>
               {onlineCount}
             </span>
           </button>
           {canUseWalkieTalkie && (
             <div className="hidden group-hover:flex">
               <StaffWalkieTalkieButton />
             </div>
           )}
         </div>
       );
    };

   const monitorTabs: Array<{ id: MainTab; label: string; icon: React.ReactNode; adminOnly?: boolean; staffOnly?: boolean }> = [
     { id: 'rtc', label: 'RTC Monitor', icon: <Radio className="h-3 w-3" /> },
     { id: 'walkie_talkie', label: 'Walkie Talkie', icon: <Radio className="h-3 w-3" /> },
     { id: 'mod_actions', label: 'Mod Actions', icon: <Shield className="h-3 w-3" /> },
     { id: 'signups', label: 'Signups', icon: <UserPlus className="h-3 w-3" />, adminOnly: true },
     { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-3 w-3" />, adminOnly: true },
      { id: 'cashout', label: 'Cashout Bonus', icon: <Coins className="h-3 w-3" />, adminOnly: true },
      { id: 'bug_center', label: 'Bug Center', icon: <Bug className="h-3 w-3" />, adminOnly: true },
      { id: 'tromail', label: 'Tromail', icon: <Mail className="h-3 w-3" /> },
      { id: 'notary', label: 'Notary', icon: <Stamp className="h-3 w-3" /> },
      { id: 'arrest', label: 'Arrest', icon: <Lock className="h-3 w-3" /> },
   ];

   const visibleMonitorTabs = monitorTabs.filter((tab) => {
     if (tab.adminOnly) return isFullAdmin;
     if (tab.staffOnly) return isStaff;
     if (tab.id === 'walkie_talkie') return canUseWalkieTalkie;
     return true;
   });
  const activeMonitorTab = visibleMonitorTabs.find((tab) => tab.id === activeMainTab) || visibleMonitorTabs[0];

  const renderTabNavigation = () => (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
          {activeMonitorTab?.icon}
          <span>{activeMonitorTab?.label || 'Monitor'}</span>
        </div>
        <span className="text-[9px] text-gray-500">{visibleMonitorTabs.length} tabs</span>
      </div>
      <select
        value={activeMainTab}
        onChange={(event) => setActiveMainTab(event.target.value as MainTab)}
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
      >
        {visibleMonitorTabs.map((tab) => (
          <option key={tab.id} value={tab.id}>
            {tab.label}
          </option>
        ))}
      </select>
    </div>
  );

const renderRtcTab = () => (
     <div className="space-y-3">
       <div className="flex items-center gap-2">
         <button
           type="button"
           onClick={() => {
             setNow(Date.now());
             fetchRTCStats();
           }}
           disabled={isLoading}
           className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600/20 px-3 py-2 text-xs text-blue-400 transition-colors hover:bg-blue-600/30 disabled:opacity-50"
         >
           <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
           {isLoading ? 'Refreshing...' : 'Refresh'}
         </button>

         <button
           type="button"
           onClick={() => {
             if (showRestartConfirm) {
               setRtcMinutesResetAt(new Date());
               setShowRestartConfirm(false);
               toast.success('RTC minutes counter restarted');
               fetchRTCStats();
             } else {
               setShowRestartConfirm(true);
               setTimeout(() => setShowRestartConfirm(false), 5000);
             }
           }}
           className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600/20 px-3 py-2 text-xs text-amber-400 transition-colors hover:bg-amber-600/30"
           title="Manually restart the RTC minutes counter. Use this when upgrading your LiveKit plan."
         >
           <RefreshCw className="h-3 w-3" />
           {showRestartConfirm ? 'Confirm Restart?' : 'Restart RTC Minutes'}
         </button>
       </div>

       {rtcMinutesResetAt && (
         <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-400">
           RTC minutes counter reset at {rtcMinutesResetAt.toLocaleTimeString()}. Only minutes after this reset are counted.
         </div>
       )}

       <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
         <StatCard label="Streams" value={stats.liveStreams} tone="border-red-500/20 bg-red-500/10 text-red-400" icon={<Radio className="h-3 w-3" />} />
         <StatCard label="Viewers" value={totalViewers} tone="border-cyan-500/20 bg-cyan-500/10 text-cyan-400" icon={<Users className="h-3 w-3" />} />
         <StatCard label="Sessions" value={stats.activeSessions} tone="border-yellow-500/20 bg-yellow-500/10 text-yellow-400" icon={<Clock className="h-3 w-3" />} />
         <StatCard label="Online" value={onlineCount} tone="border-green-500/20 bg-green-500/10 text-green-400" icon={<Activity className="h-3 w-3" />} />
         <StatCard label="Users" value={stats.totalUsers} tone="border-purple-500/20 bg-purple-500/10 text-purple-400" icon={<Users className="h-3 w-3" />} />
          <StatCard label="Minutes" value={stats.totalMinutes.toLocaleString()} tone="border-blue-500/20 bg-blue-500/10 text-blue-400" icon={<Clock className="h-3 w-3" />} />
       </div>

      <div className="border-t border-white/10 pt-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">Live Streams</span>
          <span className="text-[10px] text-gray-600">Last refresh {lastRefresh.toLocaleTimeString()}</span>
        </div>
<div className="max-h-[190px] space-y-2 overflow-y-auto">
           {streamDetailsWithDuration.length === 0 ? (
             <div className="rounded-lg bg-white/5 p-4 text-center text-xs text-gray-500">No active streams</div>
           ) : (
             streamDetailsWithDuration.map((stream) => {
               const totalAllowed = stream.totalMinutesAllowed || 360;
               const minutesUsed = stream.minutesUsed || 0;
               const minutesRemaining = stream.minutesRemaining ?? totalAllowed;
               const giftExtension = stream.giftExtensionMinutes || 0;
               const pctRemaining = totalAllowed > 0 ? (minutesRemaining / totalAllowed) * 100 : 100;
               const isLow = minutesRemaining <= 30 && minutesRemaining > 0;
               const isCritical = minutesRemaining <= 0;

               return (
                 <button
                   key={stream.id}
                   type="button"
                   onClick={() => openStreamModal(stream)}
                   className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-colors hover:bg-white/10"
                 >
                   <div className="flex items-center justify-between gap-2">
                     <span className="truncate text-sm font-semibold text-white">{stream.title}</span>
                     <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">LIVE</span>
                   </div>
                   <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-400">
                     <span>{stream.viewers} viewers</span>
                     <span>{formatDuration(stream.duration)}</span>
                   </div>
                   <div className="mt-2 flex items-center gap-2">
                     <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                       <div
                         className={`h-full rounded-full transition-all ${isCritical ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-green-500'}`}
                         style={{ width: `${Math.min(100, pctRemaining)}%` }}
                       />
                     </div>
                     <span className={`text-[10px] font-bold ${isCritical ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-green-400'}`}>
                       {minutesRemaining}m remaining
                     </span>
                   </div>
                   {giftExtension > 0 && (
                     <div className="mt-1 text-[10px] text-cyan-400">
                       +{giftExtension}m from gifts
                     </div>
                   )}
                 </button>
               );
             })
           )}
         </div>
      </div>
    </div>
  );

  const renderModActionsTab = () => {
    const filteredUsers = userSearch.trim()
      ? userList.filter((user) => user.username.toLowerCase().includes(userSearch.trim().toLowerCase()))
      : userList;

return (
       <div className="space-y-3">
         <div className="flex gap-2">
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search loaded users..."
            className="flex-1 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
          />
          <button type="button" onClick={() => openUserList('online')} className="rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500">
            <Search className="h-4 w-4" />
          </button>
        </div>

        {!userListType ? (
          <button type="button" onClick={() => openUserList('online')} className="w-full rounded-lg bg-white/5 p-4 text-center text-xs text-gray-400 hover:bg-white/10">
            Load active users
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Active Users ({filteredUsers.length})</span>
              <button type="button" onClick={closeUserList} className="text-gray-500 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {userListLoading ? (
                <div className="py-4 text-center text-gray-500">Loading...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-4 text-center text-gray-500">No users found</div>
               ) : (
                 filteredUsers.map((user) => (
                    <div key={user.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 hover:bg-white/5 cursor-pointer" onClick={() => navigate(`/profile/id/${user.id}`)}>
                     <div className="flex items-center justify-between gap-2">
                       <div className="min-w-0 flex-1">
                          {editingUserId === user.id ? (
                            <div className="flex items-center gap-2">
                               <input
                                 type="text"
                                 value={editUsernameValue}
                                 onChange={(e) => setEditUsernameValue(e.target.value)}
                                 onKeyDown={(e) => {
                                   if (e.key === 'Enter') void handleUsernameSave(user.id, editUsernameValue);
                                   if (e.key === 'Escape') setEditingUserId(null);
                                 }}
                                 autoFocus
                                 className="flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
                                 placeholder="Enter new username"
                               />
                               <button
                                 type="button"
                                 onClick={() => void handleUsernameSave(user.id, editUsernameValue)}
                                 disabled={usernameEditLoading || !editUsernameValue.trim()}
                                 className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500 disabled:opacity-50"
                               >
                                 {usernameEditLoading ? 'Saving...' : 'Save'}
                               </button>
                              <button
                                type="button"
                                onClick={() => setEditingUserId(null)}
                                className="rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-500"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="truncate font-medium text-white">@{user.username}</div>
                              <div className="text-xs capitalize text-gray-400">{user.role || 'user'}</div>
                              {user.walkie_talkie_page !== null && user.walkie_talkie_page !== undefined && user.walkie_talkie_page > 0 && (
                                <div className="text-xs text-blue-400">WP#{user.walkie_talkie_page}</div>
                              )}
                            </>
                          )}
                        </div>
                        <div className="relative flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAction(user, 'warn');
                            }}
                            className="rounded bg-slate-600 p-1.5 text-yellow-400 hover:bg-slate-500 hover:text-yellow-300"
                            title="Mod Actions"
                          >
                            <Shield className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuWidth = 144;
                              const menuHeight = 260;
                              const pad = 4;
                              let top = rect.bottom;
                              let left = rect.left;
                              if (top + menuHeight + pad > window.innerHeight) {
                                top = rect.top - menuHeight;
                              }
                              if (top < pad) {
                                top = pad;
                              }
                              if (left + menuWidth + pad > window.innerWidth) {
                                left = rect.right - menuWidth;
                              }
                              if (left < pad) {
                                left = pad;
                              }
                              setDropdownRect({ top, left });
                              setOpenDropdownUserId(openDropdownUserId === user.id ? null : user.id);
                            }}
                            className="dropdown-trigger-btn rounded bg-slate-600 p-1.5 text-white hover:bg-slate-500"
                            title="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openDropdownUserId === user.id && dropdownRect && createPortal(
                            <div
                              className="dropdown-menu-content fixed w-36 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-[10000] overflow-hidden"
                              style={{ top: dropdownRect.top, left: dropdownRect.left }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {editingUserId !== user.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUserId(user.id);
                                    setEditUsernameValue(user.username);
                                    setOpenDropdownUserId(null);
                                    setDropdownRect(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <span className="text-[10px]">✏️</span> Edit
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => { openAction(user, 'warn'); setOpenDropdownUserId(null); setDropdownRect(null); }}
                                className="w-full px-3 py-2 text-left text-xs text-yellow-300 hover:bg-yellow-900/30 flex items-center gap-2"
                              >
                                <span className="text-[10px]">⚠️</span> Warn
                              </button>
                              <button
                                type="button"
                                onClick={() => { openAction(user, 'mute'); setOpenDropdownUserId(null); setDropdownRect(null); }}
                                className="w-full px-3 py-2 text-left text-xs text-orange-300 hover:bg-orange-900/30 flex items-center gap-2"
                              >
                                <span className="text-[10px]">🔇</span> Mute
                              </button>
                              <button
                                type="button"
                                onClick={() => { openAction(user, 'kick'); setOpenDropdownUserId(null); setDropdownRect(null); }}
                                className="w-full px-3 py-2 text-left text-xs text-red-300 hover:bg-red-900/30 flex items-center gap-2"
                              >
                                <span className="text-[10px]">🚪</span> Kick
                              </button>
                              <button
                                type="button"
                                onClick={() => { openAction(user, 'ban'); setOpenDropdownUserId(null); setDropdownRect(null); }}
                                className="w-full px-3 py-2 text-left text-xs text-purple-300 hover:bg-purple-900/30 flex items-center gap-2"
                              >
                                <span className="text-[10px]">🔨</span> Ban
                              </button>
                              <button
                                type="button"
                                onClick={() => { openAction(user, 'arrest'); setOpenDropdownUserId(null); setDropdownRect(null); }}
                                className="w-full px-3 py-2 text-left text-xs text-orange-300 hover:bg-orange-900/30 flex items-center gap-2"
                              >
                                <span className="text-[10px]">👮</span> Arrest
                              </button>
                            </div>,
                            document.body
                          )}
                        </div>
                      </div>
                    </div>
                 ))
               )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSignupsTab = () => (
    <div className="space-y-3">
      <button type="button" onClick={fetchSignupData} disabled={signupLoading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600/20 px-3 py-2 text-xs text-green-400 hover:bg-green-600/30 disabled:opacity-50">
        <RefreshCw className={`h-3 w-3 ${signupLoading ? 'animate-spin' : ''}`} />
        {signupLoading ? 'Loading...' : 'Refresh'}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Today" value={signupStats.today} tone="border-green-500/20 bg-green-500/10 text-green-400" icon={<Activity className="h-3 w-3" />} />
        <StatCard label="Week" value={signupStats.week} tone="border-green-500/20 bg-green-500/10 text-green-400" icon={<TrendingUp className="h-3 w-3" />} />
        <StatCard label="Month" value={signupStats.month} tone="border-green-500/20 bg-green-500/10 text-green-400" icon={<UserPlus className="h-3 w-3" />} />
        <StatCard label="Total" value={signupStats.total} tone="border-green-500/20 bg-green-500/10 text-green-400" icon={<Users className="h-3 w-3" />} />
      </div>
      <div className="border-t border-white/10 pt-2">
        <span className="text-xs text-gray-500">Recent Signups</span>
        <div className="mt-2 max-h-[150px] space-y-1 overflow-y-auto">
          {recentSignups.length === 0 ? <div className="py-4 text-center text-xs text-gray-500">No recent signups</div> : recentSignups.map((user) => (
            <div key={user.id} className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5">
              <span className="truncate text-xs text-gray-300">@{user.username}</span>
              <span className="text-xs text-gray-500">{user.created_at ? new Date(user.created_at).toLocaleDateString() : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCashoutTab = () => (
    <div className="space-y-3">
      <button type="button" onClick={fetchCashoutBonusData} disabled={cashoutLoading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-600/20 px-3 py-2 text-xs text-yellow-400 hover:bg-yellow-600/30 disabled:opacity-50">
        <RefreshCw className={`h-3 w-3 ${cashoutLoading ? 'animate-spin' : ''}`} />
        {cashoutLoading ? 'Loading...' : 'Refresh'} ({cashoutBonusData.filter((u) => u.qualifies).length} eligible)
      </button>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total Early" value={cashoutBonusData.length} tone="border-yellow-500/20 bg-yellow-500/10 text-yellow-400" icon={<Coins className="h-3 w-3" />} />
        <StatCard label="Eligible" value={cashoutBonusData.filter((u) => u.qualifies).length} tone="border-green-500/20 bg-green-500/10 text-green-400" icon={<ShieldAlert className="h-3 w-3" />} />
        <StatCard label="Pending" value={cashoutBonusData.filter((u) => !u.qualifies).length} tone="border-purple-500/20 bg-purple-500/10 text-purple-400" icon={<TrendingUp className="h-3 w-3" />} />
      </div>
      <div className="max-h-[190px] space-y-1 overflow-y-auto border-t border-white/10 pt-2">
       {cashoutBonusData.length === 0 ? <div className="py-4 text-center text-xs text-gray-500">No early signup data</div> : cashoutBonusData.map((user) => (
            <div key={user.id} className={`flex items-center justify-between rounded border px-2 py-1.5 ${user.qualifies ? 'border-green-500/20 bg-green-500/10' : 'border-white/5 bg-white/5'}`}>
              <span className="truncate text-xs text-gray-300">#{user.signupRank} @{user.username}</span>
              <div className="flex items-center gap-2">
                <span className={user.qualifies ? 'text-xs font-bold text-green-400' : 'text-xs text-white'}>
                  {Number(user.paidCoinsReceived || 0).toLocaleString()}c
                </span>
                {user.walkie_talkie_page !== null && user.walkie_talkie_page !== undefined && user.walkie_talkie_page > 0 && (
                  <span className="text-xs text-blue-400">WP#{user.walkie_talkie_page}</span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );

  const renderAnalyticsTab = () => (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { fetchStreamAnalytics(); fetchClickStats(); }} disabled={analyticsLoading || clickLoading} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600/20 px-3 py-2 text-xs text-purple-400 hover:bg-purple-600/30 disabled:opacity-50">
          <RefreshCw className={`h-3 w-3 ${analyticsLoading || clickLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        {[1, 7, 30].map((days) => (
          <button key={days} type="button" onClick={() => setAnalyticsRange(days as 1 | 7 | 30)} className={`rounded-lg px-2.5 py-2 text-xs font-medium ${analyticsRange === days ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>
            {days === 1 ? 'Today' : `${days}d`}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
        <div className="mb-1 text-[10px] uppercase text-emerald-300">Revenue Per 1000 Viewer Minutes</div>
        <div className="text-2xl font-bold text-white">${analyticsSummary.revenuePer1000ViewerMinutes.toFixed(2)}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Viewer Min" value={analyticsSummary.totalViewerMinutes.toLocaleString()} tone="border-purple-500/20 bg-purple-500/10 text-purple-400" icon={<BarChart3 className="h-3 w-3" />} />
        <StatCard label="Avg Watch" value={`${analyticsSummary.avgWatchTimePerUser.toFixed(1)}m`} tone="border-purple-500/20 bg-purple-500/10 text-purple-400" icon={<Clock className="h-3 w-3" />} />
        <StatCard label="Gift Coins" value={analyticsSummary.totalGiftCoins.toLocaleString()} tone="border-yellow-500/20 bg-yellow-500/10 text-yellow-400" icon={<Coins className="h-3 w-3" />} />
        <StatCard label="Clicks" value={clickStats.total.toLocaleString()} tone="border-cyan-500/20 bg-cyan-500/10 text-cyan-400" icon={<TrendingUp className="h-3 w-3" />} />
      </div>
      <div className="border-t border-white/10 pt-2">
        <span className="text-xs text-gray-500">Top URLs</span>
        <div className="mt-2 space-y-1">
          {clickStats.topUrls.length === 0 ? <div className="text-xs text-gray-500">No click data</div> : clickStats.topUrls.map((item) => (
            <div key={item.url} className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5 text-xs">
              <span className="truncate text-gray-300">{item.url}</span>
              <span className="ml-2 text-white">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTromailTab = () => (
    <div className="space-y-3">
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
        <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
               <span className="font-medium text-white">Status:</span>
               <span className="text-gray-400">
                 {canUseWalkieTalkie ? 'Available' : 'Not Available'}
               </span>
             </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">{lastTromailFetch.toLocaleTimeString()}</span>
            <button
              type="button"
              onClick={fetchTromailInbox}
              disabled={tromailLoading}
              className="rounded bg-white/5 p-1 text-gray-300 hover:bg-white/10"
            >
              <RefreshCw className={`h-3 w-3 ${tromailLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {tromailUnreadCount > 0 ? `${tromailUnreadCount} unread` : 'All caught up'}
          </span>
          <button
            type="button"
            onClick={() => navigate('/tromail')}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Open Full Tromail
          </button>
        </div>

        {tromailLoading ? (
          <div className="py-4 text-center text-xs text-gray-400">Loading...</div>
        ) : tromailInbox.length === 0 ? (
          <div className="py-4 text-center text-xs text-gray-500">No messages in inbox</div>
        ) : (
          <div className="space-y-2">
            {tromailInbox.map((msg) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => handleTromailMessageClick(msg.message_id)}
                className={`w-full rounded-lg border border-white/10 bg-white/5 p-2 text-left hover:bg-white/10 ${
                  !msg.read_at ? 'border-cyan-500/30 bg-cyan-500/10' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-white">
                        {msg.subject}
                      </span>
                      {!msg.read_at && (
                        <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      From: {msg.sender_role} • {new Date(msg.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

    const renderNotaryTab = () => (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stamp className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wide text-amber-300">Notary Documents</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                setNotaryLoading(true);
                try {
                  const { data } = await supabase
                    .from('documents')
                    .select('id, title, document_type_slug, status, submitted_by, created_at, version')
                    .order('created_at', { ascending: false })
                    .limit(50);
                  setNotaryDocuments(data || []);
                } catch (err) {
                  console.error('Notary refresh error:', err);
                } finally {
                  setNotaryLoading(false);
                }
              }}
              disabled={notaryLoading}
              className="rounded bg-amber-600/30 px-2 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-600/45 disabled:opacity-50"
            >
              {notaryLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Sub-tabs */}
          <div className="mb-3 flex gap-1">
            {(['pending', 'approved', 'rejected', 'logs'] as const).map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setNotarySubTab(sub)}
                className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider capitalize ${
                  notarySubTab === sub
                    ? 'bg-amber-600 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          {notarySubTab === 'logs' ? (
            <div className="space-y-1">
              <div className="rounded bg-black/20 px-3 py-3 text-center text-xs text-amber-100/55">
                Document audit logs will appear here.
              </div>
            </div>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {notaryDocuments.length === 0 ? (
                <div className="rounded bg-black/20 px-3 py-3 text-center text-xs text-amber-100/55">
                  No documents found.
                </div>
              ) : (
                notaryDocuments
                  .filter((doc) => {
                    if (notarySubTab === 'pending') return doc.status === 'pending' || doc.status === 'submitted';
                    if (notarySubTab === 'approved') return doc.status === 'approved' || doc.status === 'notarized';
                    if (notarySubTab === 'rejected') return doc.status === 'rejected';
                    return true;
                  })
                  .map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded border border-white/10 bg-black/20 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-white">{doc.title || 'Untitled'}</span>
                        <span className="shrink-0 rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase text-amber-200">
                          {doc.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-white/40">
                        <span>Type: {doc.document_type_slug || 'unknown'}</span>
                        <span>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}</span>
                      </div>
                      <div className="mt-2 flex gap-1">
                        {(doc.status === 'pending' || doc.status === 'submitted') && (
                          <>
                            <button
                              type="button"
                              className="rounded bg-green-600/30 px-2 py-1 text-[10px] font-bold text-green-200 hover:bg-green-600/50"
                              onClick={async () => {
                                try {
                                  await supabase.from('documents').update({ status: 'approved' }).eq('id', doc.id);
                                  setNotaryDocuments((prev) =>
                                    prev.map((d) => (d.id === doc.id ? { ...d, status: 'approved' } : d))
                                  );
                                  toast.success(`Document "${doc.title}" approved`);
                                } catch (err) {
                                  toast.error('Failed to approve document');
                                }
                              }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="rounded bg-red-600/30 px-2 py-1 text-[10px] font-bold text-red-200 hover:bg-red-600/50"
                              onClick={async () => {
                                try {
                                  await supabase.from('documents').update({ status: 'rejected' }).eq('id', doc.id);
                                  setNotaryDocuments((prev) =>
                                    prev.map((d) => (d.id === doc.id ? { ...d, status: 'rejected' } : d))
                                  );
                                  toast.success(`Document "${doc.title}" rejected`);
                                } catch (err) {
                                  toast.error('Failed to reject document');
                                }
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="rounded bg-white/5 px-2 py-1 text-[10px] font-bold text-white/50 hover:bg-white/10"
                          onClick={() => navigate(`/notary?doc=${doc.id}`)}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      </div>
     );

    const fetchArrestSearch = useCallback(async () => {
      if (!arrestSearchUsername.trim()) { setArrestSearchResults([]); return; }
      setArrestSearchLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, role, is_admin, is_troll_officer, is_lead_officer')
          .ilike('username', `%${arrestSearchUsername.trim()}%`)
          .limit(10);
        if (error) throw error;
        setArrestSearchResults(data || []);
      } catch (err: any) {
        toast.error(err?.message || 'Search failed');
      } finally {
        setArrestSearchLoading(false);
      }
    }, [arrestSearchUsername]);

    const fetchArrestLogs = useCallback(async () => {
      setArrestLogsLoading(true);
      try {
        const { data, error } = await supabase
          .from('moderation_actions')
          .select('id, created_at, target_user_id, reason, details, status, user_profiles!moderation_actions_target_user_id_fkey(username, avatar_url, role)')
          .eq('action_type', 'arrest')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setArrestLogs(data || []);
      } catch {
        try {
          const { data, error: err2 } = await supabase
            .from('moderation_actions')
            .select('id, created_at, target_user_id, reason, details, status')
            .eq('action_type', 'arrest')
            .order('created_at', { ascending: false })
            .limit(50);
          if (err2) throw err2;
          setArrestLogs(data || []);
        } catch {
          setArrestLogs([]);
        }
      } finally {
        setArrestLogsLoading(false);
      }
    }, []);

    const fetchCurrentInmates = useCallback(async () => {
      setArrestInmatesLoading(true);
      try {
        const { data, error } = await supabase
          .from('jail')
          .select('id, user_id, reason, severity, bond_amount, status, created_at, release_time, user_profiles!jail_user_id_fkey(username, avatar_url, role)')
          .in('status', ['jailed', 'released_pending_trial'])
          .order('created_at', { ascending: false });
        if (error) throw error;
        setArrestCurrentInmates(data || []);
      } catch {
        try {
          const { data, error: err2 } = await supabase
            .from('jail')
            .select('id, user_id, reason, severity, bond_amount, status, created_at, release_time')
            .in('status', ['jailed', 'released_pending_trial'])
            .order('created_at', { ascending: false });
          if (err2) throw err2;
          const userIds = [...new Set((data || []).map((j: any) => j.user_id).filter(Boolean))];
          const { data: profiles } = await supabase.from('user_profiles').select('id, username, avatar_url, role').in('id', userIds);
          const profileMap: Record<string, any> = {};
          (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
          setArrestCurrentInmates((data || []).map((j: any) => ({ ...j, user_profiles: profileMap[j.user_id] || null })));
        } catch {
          setArrestCurrentInmates([]);
        }
      } finally {
        setArrestInmatesLoading(false);
      }
    }, []);

    const releaseInmate = useCallback(async (jailId: string, userId: string, username: string) => {
      if (!window.confirm(`Release ${username} from jail?`)) return;
      setArrestReleaseLoading(jailId);
      try {
        const now = new Date().toISOString();
        const { error: jailError } = await supabase
          .from('jail')
          .update({ status: 'released', release_time: now })
          .eq('id', jailId);
        if (jailError) throw jailError;

        await supabase
          .from('user_profiles')
          .update({ is_jailed: false })
          .eq('id', userId)
          .then(() => undefined, () => undefined);

        await supabase.from('moderation_actions').insert({
          actor_id: profile?.id,
          officer_id: profile?.id,
          target_user_id: userId,
          action: 'release',
          action_type: 'release',
          reason: 'Released by staff from Arrest tab',
          details: `jail_id:${jailId}; released_at:${now}`,
          status: 'revoked',
        }).then(() => undefined, () => undefined);

        toast.success(`Released ${username} from jail`);
        fetchCurrentInmates();
        fetchArrestLogs();
      } catch (err: any) {
        toast.error(err?.message || 'Release failed');
      } finally {
        setArrestReleaseLoading(null);
      }
    }, [profile?.id, fetchCurrentInmates, fetchArrestLogs]);

    const executeArrestTab = useCallback(async (targetUser: any) => {
      if (!profile?.id) return;
      const protectedRoles = ['admin', 'ceo', 'secretary', 'pastor', 'lead_troll_officer', 'troll_officer'];
      if (protectedRoles.includes(targetUser.role || '') || targetUser.is_admin) {
        toast.error(`Cannot arrest a user with protected role: ${targetUser.role || 'admin'}`);
        return;
      }
      if (!arrestTabReason.trim()) {
        toast.error('Arrest reason is required');
        return;
      }
      setArrestTabLoading(true);
      try {
        const SEVERITY_LEVELS = [
          { id: 'minor', bailMultiplier: 1 },
          { id: 'moderate', bailMultiplier: 2 },
          { id: 'serious', bailMultiplier: 5 },
          { id: 'severe', bailMultiplier: 10 }
        ];
        const severity = SEVERITY_LEVELS.find(s => s.id === arrestTabSeverity);
        const bail = severity ? severity.bailMultiplier * 100 : 100;

        const today = new Date();
        const dow = today.getDay();
        let nextCourtDate: Date;
        if (dow === 0 || dow === 1) nextCourtDate = new Date(today.getTime() + ((2 - dow) * 86400000));
        else if (dow === 2 || dow === 3) nextCourtDate = new Date(today.getTime() + ((4 - dow) * 86400000));
        else if (dow === 4) nextCourtDate = today;
        else nextCourtDate = new Date(today.getTime() + (((2 + 7 - dow) % 7) * 86400000));
        const courtDateStr = nextCourtDate.toISOString().split('T')[0];

        const { data: userIpRecords } = await supabase
          .from('user_ip_tracking')
          .select('latitude, longitude, ip_address')
          .eq('user_id', targetUser.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const { error: jailError } = await supabase.from('jail').insert({
          user_id: targetUser.id,
          release_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          reason: arrestTabReason,
          sentence_days: 1,
          arrested_by: profile.id,
          court_date: courtDateStr,
          status: 'jailed',
          severity: arrestTabSeverity,
          bond_amount: bail,
          arrest_latitude: userIpRecords?.[0]?.latitude ?? null,
          arrest_longitude: userIpRecords?.[0]?.longitude ?? null,
        });
        if (jailError) throw jailError;

        const { data: docket } = await supabase
          .from('court_dockets')
          .select('id, cases_count')
          .eq('court_date', courtDateStr)
          .maybeSingle();

        let docketId: string;
        if (docket && docket.cases_count < 20) {
          docketId = docket.id;
          await supabase.from('court_dockets').update({ cases_count: (docket.cases_count || 0) + 1 }).eq('id', docketId);
        } else {
          const { data: newDocket, error: insertError } = await supabase.from('court_dockets').insert({
            court_date: courtDateStr, max_cases: 20, cases_count: 1, status: 'open',
          }).select().single();
          if (insertError) throw insertError;
          docketId = newDocket?.id;
          if (!docketId) throw new Error('Failed to create court docket');
        }

        await supabase.from('court_cases').insert({
          docket_id: docketId,
          defendant_id: targetUser.id,
          plaintiff_id: profile.id,
          reason: arrestTabReason,
          status: 'pending',
          case_type: 'criminal'
        });

        await supabase.from('moderation_actions').insert({
          actor_id: profile.id,
          officer_id: profile.id,
          target_user_id: targetUser.id,
          action: 'arrest',
          action_type: 'arrest',
          reason: arrestTabReason,
          details: `court_date:${courtDateStr}; bail:${bail}; severity:${arrestTabSeverity}`,
          status: 'active',
        }).then(() => undefined, () => undefined);

        toast.success(`Arrested ${targetUser.username} — ${arrestTabSeverity} severity, ${bail} coin bail`);
        setArrestTabReason('');
        setArrestTabSeverity('moderate');
        setArrestSearchUsername('');
        setArrestSearchResults([]);
        fetchArrestLogs();
      } catch (err: any) {
        toast.error(err?.message || 'Arrest failed');
      } finally {
        setArrestTabLoading(false);
      }
    }, [profile?.id, arrestTabReason, arrestTabSeverity, fetchArrestLogs]);

    useEffect(() => {
      if (isOpen && isStaff && activeMainTab === 'arrest') {
        fetchArrestLogs();
        fetchCurrentInmates();
      }
    }, [isOpen, isStaff, activeMainTab, fetchArrestLogs, fetchCurrentInmates]);

    const renderArrestTab = () => {
      const SEVERITY_OPTIONS = [
        { id: 'minor', label: 'Minor', color: 'text-yellow-400', bail: 100 },
        { id: 'moderate', label: 'Moderate', color: 'text-orange-400', bail: 200 },
        { id: 'serious', label: 'Serious', color: 'text-red-400', bail: 500 },
        { id: 'severe', label: 'Severe', color: 'text-red-600', bail: 1000 },
      ];
      const selectedSeverity = SEVERITY_OPTIONS.find(s => s.id === arrestTabSeverity);

      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-400">
            <Lock className="h-4 w-4" />
            <span>Arrest a User</span>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={arrestSearchUsername}
                  onChange={(e) => setArrestSearchUsername(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchArrestSearch(); }}
                  placeholder="Search username..."
                  className="w-full rounded-md border border-slate-700 bg-slate-950 py-1.5 pl-7 pr-2 text-xs text-white placeholder:text-gray-600 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <button
                onClick={fetchArrestSearch}
                disabled={arrestSearchLoading}
                className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {arrestSearchLoading ? '...' : 'Search'}
              </button>
            </div>

            {arrestSearchResults.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{arrestSearchResults.length} result(s)</div>
                {arrestSearchResults.map((user) => {
                  const isProtected = ['admin', 'ceo', 'secretary', 'pastor', 'lead_troll_officer', 'troll_officer'].includes(user.role || '') || user.is_admin;
                  return (
                    <div key={user.id} className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <img src={user.avatar_url || '/default-avatar.png'} alt="" className="h-6 w-6 rounded-full object-cover" />
                        <div>
                          <span className="text-xs font-semibold text-white">{user.username}</span>
                          <span className="ml-1.5 text-[10px] text-gray-500">{user.role || 'user'}</span>
                        </div>
                      </div>
                      {isProtected ? (
                        <span className="text-[10px] text-yellow-500">Protected</span>
                      ) : (
                        <button
                          onClick={() => { setActionTarget(user); }}
                          className="rounded bg-red-600/80 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-red-500"
                        >
                          Select
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(actionTarget && activeMainTab === 'arrest') && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <img src={actionTarget.avatar_url || '/default-avatar.png'} alt="" className="h-8 w-8 rounded-full object-cover" />
                <div>
                  <div className="text-sm font-bold text-white">{actionTarget.username}</div>
                  <div className="text-[10px] text-gray-400">{actionTarget.role || 'user'}</div>
                </div>
                <button onClick={() => setActionTarget(null as any)} className="ml-auto text-gray-500 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">Reason</label>
                <input
                  type="text"
                  value={arrestTabReason}
                  onChange={(e) => setArrestTabReason(e.target.value)}
                  placeholder="Enter arrest reason..."
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-red-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">Severity</label>
                <div className="flex gap-1.5">
                  {SEVERITY_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setArrestTabSeverity(s.id)}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase transition-colors ${
                        arrestTabSeverity === s.id
                          ? `border-red-500/50 bg-red-500/20 ${s.color}`
                          : 'border-white/10 bg-white/[0.02] text-gray-500 hover:border-white/20'
                      }`}
                    >
                      {s.label}
                      <div className="text-[9px] opacity-70">{s.bail} bail</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md bg-white/[0.03] px-2.5 py-1.5 text-[10px]">
                <span className="text-gray-400">Bail: <span className="font-bold text-white">{selectedSeverity?.bail || 100} coins</span></span>
                <span className="text-gray-400">Court: <span className="font-bold text-white">Next Tue/Thu</span></span>
              </div>

              <button
                onClick={() => executeArrestTab(actionTarget)}
                disabled={arrestTabLoading || !arrestTabReason.trim()}
                className="w-full rounded-md bg-red-600 py-2 text-xs font-bold uppercase text-white hover:bg-red-500 disabled:opacity-50"
              >
                {arrestTabLoading ? (
                  <span className="flex items-center justify-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Arresting...</span>
                ) : (
                  <span className="flex items-center justify-center gap-1"><Lock className="h-3 w-3" /> Arrest {actionTarget.username}</span>
                )}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              <span>Current Inmates</span>
              <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[9px] text-yellow-300">{arrestCurrentInmates.length}</span>
            </div>
            <button
              onClick={fetchCurrentInmates}
              disabled={arrestInmatesLoading}
              className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-gray-400 hover:border-white/20 hover:text-white disabled:opacity-50"
            >
              {arrestInmatesLoading ? '...' : 'Refresh'}
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-lg border border-yellow-500/20 bg-white/[0.02]">
            {arrestCurrentInmates.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-600">No inmates currently jailed</div>
            ) : (
              <div className="divide-y divide-white/5">
                {arrestCurrentInmates.map((inmate: any) => (
                  <div key={inmate.id} className="flex items-center justify-between px-2.5 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={inmate.user_profiles?.avatar_url || '/default-avatar.png'}
                        alt=""
                        className="h-6 w-6 shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-white truncate">
                          {inmate.user_profiles?.username || 'Unknown'}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {inmate.reason || 'No reason'} — {inmate.severity || 'N/A'}
                          {inmate.bond_amount ? ` • ${inmate.bond_amount} bail` : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => releaseInmate(inmate.id, inmate.user_id, inmate.user_profiles?.username || 'Unknown')}
                      disabled={arrestReleaseLoading === inmate.id}
                      className="ml-2 shrink-0 rounded bg-green-600/80 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      {arrestReleaseLoading === inmate.id ? '...' : 'Release'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-orange-400">
              <Gavel className="h-4 w-4" />
              <span>Arrest Logs</span>
            </div>
            <button
              onClick={fetchArrestLogs}
              disabled={arrestLogsLoading}
              className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-gray-400 hover:border-white/20 hover:text-white disabled:opacity-50"
            >
              {arrestLogsLoading ? '...' : 'Refresh'}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-white/5 bg-white/[0.02]">
            {arrestLogs.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-600">No arrest logs</div>
            ) : (
              <div className="divide-y divide-white/5">
                {arrestLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20">
                        <Lock className="h-3 w-3 text-red-400" />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-white">
                          {log.user_profiles?.username || log.target_user_id?.slice(0, 8) || 'Unknown'}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate max-w-[200px]">{log.reason || 'No reason'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400">
                        {log.created_at ? new Date(log.created_at).toLocaleDateString() : ''}
                      </div>
                      <div className="text-[9px] text-gray-600">
                        {log.created_at ? new Date(log.created_at).toLocaleTimeString() : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    };

    const renderActiveTab = () => {
     if (activeMainTab === 'rtc') return renderRtcTab();
     if (activeMainTab === 'walkie_talkie') return <WalkieTalkieTab />;
     if (activeMainTab === 'mod_actions') return renderModActionsTab();
     if (isFullAdmin && activeMainTab === 'signups') return renderSignupsTab();
      if (isFullAdmin && activeMainTab === 'cashout') return renderCashoutTab();
       if (isFullAdmin && activeMainTab === 'bug_center') return <BugCenterPanel />;
      if (isFullAdmin && activeMainTab === 'analytics') return renderAnalyticsTab();
       if (activeMainTab === 'tromail') return renderTromailTab();
       if (activeMainTab === 'notary') return renderNotaryTab();
       if (activeMainTab === 'arrest') return renderArrestTab();
      return <div className="rounded-lg bg-white/5 p-4 text-center text-xs text-gray-500">No access to this tab.</div>;
   };

   const renderActionModal = () => {
     if (!activeAction || !actionTarget) return null;
     return (
       <div
         className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
         onClick={(e) => {
           if (e.target === e.currentTarget) closeAction();
         }}
       >
         <div className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 p-4 shadow-2xl">
           <div className="mb-4 flex items-center justify-between">
             <h3 className="font-semibold capitalize text-white">{activeAction} @{actionTarget.username}</h3>
             <button type="button" onClick={closeAction} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
           </div>
          <div className="space-y-3">
            {(activeAction === 'ban' || activeAction === 'mute') && (
              <div>
                <label className="mb-1 block text-sm text-gray-400">Duration {activeAction === 'ban' ? '(days)' : '(minutes)'}</label>
                <input type="number" value={actionDuration} onChange={(e) => setActionDuration(e.target.value)} className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
              </div>
            )}
            {activeAction === 'grant' && (
              <div>
                <label className="mb-1 block text-sm text-gray-400">Coin Amount</label>
                <input type="number" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm text-gray-400">Reason</label>
              <input type="text" value={actionReason} onChange={(e) => setActionReason(e.target.value)} className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={closeAction} className="flex-1 rounded bg-slate-600 py-2 text-sm text-white hover:bg-slate-500">Cancel</button>
              <button type="button" onClick={executeAction} disabled={actionLoading} className="flex-1 rounded bg-red-600 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50">
                {actionLoading ? 'Executing...' : 'Execute'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

   const renderStreamModal = () => {
     if (!selectedStream) return null;
     return (
       <div
         className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
         onClick={(e) => {
           if (e.target === e.currentTarget) closeStreamModal();
         }}
       >
         <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/10 bg-[#111] shadow-2xl">
           <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
             <div>
               <h3 className="font-bold text-white">{selectedStream.title}</h3>
               <p className="text-xs text-gray-400">Broadcaster: @{selectedStreamBroadcaster || 'loading...'}</p>
             </div>
             <button type="button" onClick={closeStreamModal} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
           </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Viewers" value={selectedStream.viewers} tone="border-cyan-500/20 bg-cyan-500/10 text-cyan-400" icon={<Users className="h-3 w-3" />} />
              <StatCard label="Duration" value={formatDuration(selectedStream.duration)} tone="border-yellow-500/20 bg-yellow-500/10 text-yellow-400" icon={<Clock className="h-3 w-3" />} />
              <StatCard label="Status" value="Live" tone="border-red-500/20 bg-red-500/10 text-red-400" icon={<Radio className="h-3 w-3" />} />
            </div>
            <textarea
              value={streamActionReason}
              onChange={(e) => setStreamActionReason(e.target.value)}
              placeholder="Reason for stream action..."
              className="min-h-[70px] w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
            />
            <button type="button" onClick={endStream} disabled={streamActionLoading} className="w-full rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">
              {streamActionLoading ? 'Ending...' : 'End Stream'}
            </button>
            <div className="border-t border-white/10 pt-3">
              <div className="mb-2 text-xs text-gray-500">Active Seats / Viewers</div>
              {streamModalLoading ? (
                <div className="py-4 text-center text-xs text-gray-500">Loading viewers...</div>
              ) : streamViewers.length === 0 ? (
                <div className="py-4 text-center text-xs text-gray-500">No active seat users found</div>
              ) : (
                 <div className="space-y-2">
                   {streamViewers.map((viewer) => (
                     <div key={viewer.user_id} className="flex items-center justify-between rounded bg-white/5 px-3 py-2">
                        <span className="truncate text-sm text-white cursor-pointer hover:text-blue-300" onClick={() => navigate(`/profile/id/${viewer.user_id}`)}>@{viewer.username}</span>
                       <div className="flex gap-1">
                         <button type="button" onClick={() => kickUserFromStream(viewer.user_id, viewer.username)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Kick</button>
                         <button type="button" onClick={() => summonFromStream(viewer.user_id, viewer.username)} className="rounded bg-purple-600 px-2 py-1 text-xs text-white">Court</button>
                       </div>
                     </div>
                   ))}
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
   };

  const renderFullPageModal = () => {
    if (!isOpen) return null;

    const panelStyle: React.CSSProperties = monitorPos
      ? { top: monitorPos.top, left: monitorPos.left, bottom: 'auto', right: 'auto' }
      : { bottom: '80px', right: '16px', top: 'auto', left: 'auto' }

    // Early return after all hooks — non-staff users see nothing
    if (!isStaff) return null;

    return (
      <div
        className="fixed inset-0 z-[9999] flex items-end justify-end bg-transparent p-0 animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsManuallyClosed(true)
            setIsOpen(false)
          }
        }}
      >
        <div
          ref={panelRef}
          onMouseDown={handleMonitorDragStart}
          onTouchStart={handleMonitorDragStart}
          style={{
            ...panelStyle,
            position: 'fixed',
            height: 'min(86vh,720px)',
            width: '100%',
            maxWidth: '420px',
            cursor: isDragging ? 'grabbing' : 'default',
            userSelect: isDragging ? 'none' : 'auto',
          }}
          className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0A0814] shadow-2xl shadow-black/60"
        >
          {/* Header — drag handle */}
          <div
            className="flex cursor-grab items-center justify-between border-b border-white/10 bg-gradient-to-r from-blue-900/45 to-purple-900/45 px-3 py-2 select-none"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Radio className="h-4 w-4 text-blue-400" />
                <span className="truncate text-sm font-bold text-white">RTC Monitor</span>
              </div>
              <div className="mt-0.5 text-[10px] text-gray-400">
                {stats.liveStreams} live • {onlineCount} online
              </div>
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                setIsManuallyClosed(true)
                setIsOpen(false)
              }}
              className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content - compact scrollable panel */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-2 p-2.5">
              {renderTabNavigation()}
              <div className="rounded-xl border border-white/5 bg-black/10 p-2">
                {renderActiveTab()}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMobileMiniBubble = () => {
    if (!isMobileWidth || !isStaff) return null;

    const bubbleSize = mobileMiniOpen ? 'h-10 w-10' : 'h-12 w-12';

    return (
      <div
        data-mobile-mini-bubble
        onMouseDown={handleMobileDragStart}
        onTouchStart={handleMobileDragStart}
        style={{
          position: 'fixed',
          top: mobileMiniPos?.top ?? 'auto',
          left: mobileMiniPos?.left ?? 'auto',
          bottom: mobileMiniPos ? 'auto' : '20px',
          right: mobileMiniPos ? 'auto' : '16px',
          zIndex: 100,
        }}
        className="flex flex-col items-center"
      >
        {mobileMiniOpen && (
          <div className="mb-2 w-64 rounded-xl border border-white/10 bg-[#0A0814] p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Radio className="h-3 w-3 text-blue-400" />
                <span className="text-xs font-bold text-white">RTC Monitor</span>
              </div>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={() => setMobileMiniOpen(false)}
                className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                title="Close"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded bg-white/5 p-2 text-center">
                <div className="text-lg font-bold text-red-400">{stats.liveStreams}</div>
                <div className="text-[10px] text-gray-400">Live</div>
              </div>
              <div className="rounded bg-white/5 p-2 text-center">
                <div className="text-lg font-bold text-cyan-400">{onlineCount}</div>
                <div className="text-[10px] text-gray-400">Online</div>
              </div>
              <div className="rounded bg-white/5 p-2 text-center">
                <div className="text-lg font-bold text-yellow-400">{stats.activeSessions}</div>
                <div className="text-[10px] text-gray-400">Sessions</div>
              </div>
              <div className="rounded bg-white/5 p-2 text-center">
                <div className="text-lg font-bold text-blue-400">{stats.totalMinutes}</div>
                <div className="text-[10px] text-gray-400">Minutes</div>
              </div>
            </div>
            {stats.liveStreamDetails.length > 0 && (
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {stats.liveStreamDetails.slice(0, 3).map(stream => (
                  <div key={stream.id} className="flex items-center justify-between rounded bg-white/5 px-2 py-1">
                    <span className="truncate text-[11px] text-white">{stream.title}</span>
                    <span className="text-[10px] text-gray-400">{stream.viewers} viewers</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            if (!mobileDragMovedRef.current) {
              setMobileMiniOpen(prev => !prev);
            }
          }}
          className={`flex ${bubbleSize} items-center justify-center rounded-full bg-blue-600 shadow-lg`}
          style={{ cursor: isMobileDragging ? 'grabbing' : 'pointer' }}
        >
          <Monitor className="h-5 w-5 text-white" />
          {stats.liveStreams > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {stats.liveStreams}
            </span>
          )}
        </button>
      </div>
    );
  };

    return (
      <>
        {renderFloatingButton()}

        {renderMobileMiniBubble()}

        {isOpen && renderFullPageModal()}

        {isOpen && renderActionModal()}
        {isOpen && renderStreamModal()}
      </>
    );
}




function WalkieTalkieTab() {
  const {
    isConnected,
    isSpeaking,
    isJoining,
    remoteUsers,
    error,
    joinWalkieTalkie,
    leaveWalkieTalkie,
    toggleSpeaking,
    canAccessWalkieTalkie,
  } = useStaffWalkieTalkieContext();

  if (error) {
    return (
      <div className="rounded-lg bg-white/5 p-4 text-center text-xs text-red-400">
        Walkie Talkie Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-cyan-300">
            Staff Walkie Talkie
          </span>
          {canAccessWalkieTalkie && (
            <button
              type="button"
              onClick={isConnected || isJoining ? leaveWalkieTalkie : joinWalkieTalkie}
              disabled={isJoining}
              className="rounded bg-cyan-600/30 px-2 py-1 text-[11px] font-medium text-cyan-100 hover:bg-cyan-600/45 disabled:opacity-50"
            >
              {isJoining ? 'Joining...' : isConnected ? 'Leave' : 'Join'}
            </button>
          )}
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex w-3 h-3">
              {isConnected ? (
                <Radio className="h-3 w-3 text-green-400" />
              ) : isJoining ? (
                <Radio className="h-3 w-3 animate-pulse text-yellow-400" />
              ) : (
                <Radio className="h-3 w-3 text-gray-400" />
              )}
            </span>
            <span>{isConnected ? 'Connected' : isJoining ? 'Joining...' : 'Disconnected'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex w-3 h-3">
              {isSpeaking ? (
                <Send className="h-3 w-3 text-green-400" />
              ) : (
                <Pause className="h-3 w-3 text-gray-400" />
              )}
            </span>
            <span>{isSpeaking ? 'Speaking' : 'Muted'}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-white">
            Remote Users ({remoteUsers.length})
          </span>
        </div>
        {remoteUsers.length === 0 ? (
          <div className="rounded bg-black/20 px-3 py-3 text-center text-xs text-gray-400">
            No other users in walkie talkie
          </div>
        ) : (
          <div className="space-y-1 text-xs">
            {remoteUsers.map((user, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="flex h-3 w-3">
                  <Radio className="h-3 w-3 text-blue-300" />
                </span>
                <span className="truncate">{user.username || `User ${user.id}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-white">
            Controls
          </span>
        </div>
        {!canAccessWalkieTalkie ? (
          <div className="text-xs text-gray-400">
            You do not have access to walkie talkie.
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={isConnected || isJoining ? leaveWalkieTalkie : joinWalkieTalkie}
              disabled={isJoining}
              className={`w-full rounded bg-${isConnected || isJoining ? 'red-600' : 'cyan-600'}/30 px-3 py-2 text-sm font-medium text-${isConnected || isJoining ? 'red-100' : 'cyan-100'} hover:bg-${isConnected || isJoining ? 'red-600' : 'cyan-600'}/45 disabled:opacity-50`}
            >
              {isJoining ? 'Joining...' : isConnected ? 'Leave Walkie' : 'Join Walkie'}
            </button>
            <button
              type="button"
              onClick={() => toggleSpeaking(!isSpeaking)}
              disabled={!isConnected}
              className={`w-full rounded bg-${isSpeaking ? 'green-600' : 'white/10'} px-3 py-2 text-sm font-medium text-${isSpeaking ? 'white' : 'gray-300'} hover:bg-${isSpeaking ? 'green-600' : 'white/20'} disabled:opacity-50`}
            >
              {isSpeaking ? 'Mute Mic' : 'Unmute Mic'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}