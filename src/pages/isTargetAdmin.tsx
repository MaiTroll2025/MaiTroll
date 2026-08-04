import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { usePresenceStore } from '@/lib/presenceStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useStaffWalkieTalkieContext } from '@/components/StaffWalkieTalkieProvider';
import { toast } from 'sonner';
import {
  Activity, BarChart3, Bug, Clock, Coins, Mail, Monitor, MoreVertical,
  Radio, RefreshCw, Send, Pause, Search, Shield, ShieldAlert, TrendingUp,
  UserPlus, Users, X, Stamp, FileText,
} from 'lucide-react';
import BugCenterPanel from '../components/admin/BugCenterPanel';
import StaffWalkieTalkieButton from '@/components/StaffWalkieTalkieButton';
import NotaryDashboard from './NotaryDashboard';

interface LiveStream {
  id: string;
  broadcaster_id: string;
  user_id: string;
  title: string | null;
  is_live: boolean | null;
  status: string | null;
  started_at: string | null;
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
    user_id: string; username?: string | null 
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

type MainTab = 'rtc' | 'mod_actions' | 'signups' | 'analytics' | 'cashout' | 'bug_center' | 'tromail' | 'walkie_talkie' | 'notary';

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

  const [stats, setStats] = useState<RTCStats>({
    totalMinutes: 0,
    activeSessions: 0,
    liveStreams: 0,
    liveStreamDetails: [],
    totalUsers: 0,
  });

  const [userListType, setUserListType] = useState<UserListType>(null);
  const [userList, setUserList] = useState<UserListItem[]>([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // State to track if we should show a flashing notification for new signups
  const [showSignupFlash, setShowSignupFlash] = useState(false);
  const prevTotalUsersRef = useRef<number | null>(null);

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
  const totalMinutes = useMemo(() => Math.floor(streamDetailsWithDuration.reduce((sum, s) => sum + (s.duration || 0), 0) / 60), [streamDetailsWithDuration]);

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
      const { data: streams, error: streamsError } = await supabase
        .from('streams')
        .select('id, broadcaster_id, user_id, title, is_live, status, started_at, category, agora_channel')
        .or('is_live.eq.true,status.eq.live')
        .order('started_at', { ascending: false });

      if (streamsError) throw streamsError;

      const currentTime = Date.now();
      const liveStreams = ((streams || []) as LiveStream[]).slice(0, 10);

      const streamDetails = await Promise.all(
        liveStreams.map(async (stream) => {
          const { count } = await supabase
            .from('stream_seat_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('stream_id', stream.id)
            .eq('status', 'active');

          const startedAt = stream.started_at ? new Date(stream.started_at).getTime() : currentTime;
          return {
            id: stream.id,
            title: stream.title || 'Untitled',
            startedAt: stream.started_at || new Date().toISOString(),
            viewers: count || 0,
            duration: Math.floor((currentTime - startedAt) / 1000),
            isLive: Boolean(stream.is_live || stream.status === 'live'),
            broadcasterId: stream.broadcaster_id,
            userId: stream.user_id,
          };
        }),
      );

      const { data: sessions } = await supabase
        .from('rtc_sessions')
        .select('id, user_id, room_name, started_at, ended_at, duration_seconds, is_active');

      const rtcSessions = (sessions || []) as RTSSession[];
      const totalSeconds = rtcSessions.reduce((sum, session) => {
        if (session.is_active && session.started_at) {
          return sum + Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
        }
        return sum + Number(session.duration_seconds || 0);
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
    } catch (err) {
      console.error('[RTC Monitor] Error:', err);
      toast.error('Failed to refresh RTC monitor');
    } finally {
      setIsLoading(false);
    }
  }, [isStaff]);

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
        const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
        const { data } = await supabase
            .from('user_presence')
            .select('user_id, last_seen_at, user_profiles!inner(id, username, avatar_url, role, is_admin, walkie_talkie_page)')
            .gt('last_seen_at', twoMinutesAgo)
            .order('last_seen_at', { ascending: false })
            .limit(200);

         setUserList((data || []).map((row: any) => ({
           id: row.user_profiles.id,
           username: row.user_profiles.username || 'unknown',
           avatar_url: row.user_profiles.avatar_url,
           role: row.user_profiles.role || 'user',
           is_admin: row.user_profiles.is_admin || false,
           last_seen_at: row.last_seen_at,
         })));
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
             const { error } = await supabase.rpc('mute_user', {
                 target: actionTarget.id,
                 minutes,
                 reason: actionReason || 'Admin mute via RTC Monitor',
             });
             if (error) throw error;
             await supabase.from('moderation_actions').insert({
               actor_id: profile?.id,
               officer_id: profile?.id,
               target_user_id: actionTarget.id,
               action: 'mute',
               action_type: 'mute',
               reason: actionReason || 'Admin mute via RTC Monitor',
               details: `duration_minutes:${minutes}`,
               status: 'active',
             }).then(() => undefined, () => undefined);
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
 }, [actionAmount, actionDuration, actionReason, actionTarget, activeAction, arrestReason, arrestSeverity, arrestBailAmount, closeAction, fetchModActionLogs, isFullAdmin, profile?.id, isTargetAdmin]);

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
      const interval = window.setInterval(fetchTromailInbox, 30000)
      return () => window.clearInterval(interval)
    }
  }, [isOpen, isStaff, activeMainTab, fetchTromailInbox])

  const handleTromailMessageClick = (messageId: string) => {
    navigate(`/tromail?messageId=${messageId}`)
    if (isOpen) {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (!isStaff) return;

    if (activeMainTab === 'rtc') {
      fetchRTCStats();
      const interval = window.setInterval(fetchRTCStats, 30000);
      return () => window.clearInterval(interval);
    }

    if (activeMainTab === 'signups') {
      fetchSignupData();
      const interval = window.setInterval(fetchSignupData, 30000);
      return () => window.clearInterval(interval);
    }

    if (activeMainTab === 'analytics') {
      fetchStreamAnalytics();
      fetchClickStats();
      const interval = window.setInterval(() => {
        fetchStreamAnalytics();
        fetchClickStats();
      }, 30000);
      return () => window.clearInterval(interval);
    }

    if (activeMainTab === 'cashout') {
      fetchCashoutBonusData();
      const interval = window.setInterval(fetchCashoutBonusData, 30000);
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
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isStaff]);

  // Realtime broadcast-end handling: combine postgres_changes and the explicit
  // broadcast_ended event so the active list drops the broadcaster immediately.
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

    if (!isStaff) return null;

const renderFloatingButton = () => {
      if (isMobileWidth) return null;
      
      // Only render on web (not mobile)
      if (isMobileWidth) return null;

      const buttonSize = isOpen ? 'h-10 min-w-[2.5rem]' : 'h-20 min-w-[5rem]';
      const iconSize = isOpen ? 'h-4 w-4' : 'h-8 w-8';
      const badgePx = isOpen ? 'px-1.5' : 'px-3';
      const badgePy = isOpen ? 'py-0.5' : 'py-1';
      const badgeTextSize = isOpen ? 'text-[9px]' : 'text-[18px]';

       return (
         <div className="fixed bottom-[160px] right-4 z-[100] flex flex-col gap-2 md:bottom-[200px]">
           <button
             type="button"
             onClick={() => setIsOpen((open) => !open)}
             className={`flex ${buttonSize} items-center justify-center gap-1.5 rounded-full px-2.5 shadow-lg transition-all hover:scale-105 ${
               showSignupFlash ? 'ring-4 ring-blue-500 ring-offset-2 animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.6)]' : ''
             }`}
             style={{
               backgroundColor: stats.liveStreams > 0 ? '#22c55e' : '#3b82f6',
               boxShadow: `0 4px 18px ${stats.liveStreams > 0 ? 'rgba(34,197,94,0.35)' : 'rgba(59,130,246,0.35)'}`,
             }}
             title={`RTC Monitor - ${stats.liveStreams} live streams`}
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard label="Streams" value={stats.liveStreams} tone="border-red-500/20 bg-red-500/10 text-red-400" icon={<Radio className="h-3 w-3" />} />
        <StatCard label="Viewers" value={totalViewers} tone="border-cyan-500/20 bg-cyan-500/10 text-cyan-400" icon={<Users className="h-3 w-3" />} />
        <StatCard label="Sessions" value={stats.activeSessions} tone="border-yellow-500/20 bg-yellow-500/10 text-yellow-400" icon={<Clock className="h-3 w-3" />} />
        <StatCard label="Online" value={onlineCount} tone="border-green-500/20 bg-green-500/10 text-green-400" icon={<Activity className="h-3 w-3" />} />
        <StatCard label="Users" value={stats.totalUsers} tone="border-purple-500/20 bg-purple-500/10 text-purple-400" icon={<Users className="h-3 w-3" />} />
        <StatCard label="Minutes" value={totalMinutes.toLocaleString()} tone="border-blue-500/20 bg-blue-500/10 text-blue-400" icon={<Clock className="h-3 w-3" />} />
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
            streamDetailsWithDuration.map((stream) => (
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
              </button>
            ))
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
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-cyan-300">Recent User Mod Actions</span>
            <button
              type="button"
              onClick={fetchModActionLogs}
              disabled={modLogsLoading}
              className="rounded bg-cyan-600/30 px-2 py-1 text-[11px] font-medium text-cyan-100 hover:bg-cyan-600/45 disabled:opacity-50"
            >
              {modLogsLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <div className="max-h-44 space-y-1 overflow-y-auto">
            {modActionLogs.length === 0 ? (
              <div className="rounded bg-black/20 px-3 py-3 text-center text-xs text-cyan-100/55">
                No actions loaded yet.
              </div>
            ) : (
              modActionLogs.map((log) => {
                const actorIsAdmin = log.actor?.is_admin || log.actor?.role === 'admin' || log.details?.includes('admin_locked:true');
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => log.target_user_id && navigate(`/profile/id/${log.target_user_id}`)}
                    className="w-full rounded border border-white/10 bg-black/20 px-3 py-2 text-left hover:bg-white/5"
                  >
                     <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-white cursor-pointer hover:text-blue-300" onClick={() => log.target?.user_id && navigate(`/profile/id/${log.target?.user_id}`)}>
                         @{log.target?.username || log.target_user_id || 'unknown'}
                       </span>
                       <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase text-cyan-200">
                         {log.action_type || log.action || 'action'}
                       </span>
                     </div>
                    <div className="mt-1 text-[11px] text-gray-400">
                      by @{log.actor?.username || 'staff'} • {new Date(log.created_at).toLocaleString()}
                    </div>
                    {(log.reason || log.details) && (
                      <div className="mt-1 line-clamp-2 text-[11px] text-gray-300">
                        {log.reason || log.details}
                      </div>
                    )}
                    {actorIsAdmin && (
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-red-300">
                        Admin locked: staff cannot undo this action
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

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
                   <div key={user.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
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
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
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

    return (
      <div
        className="fixed inset-0 z-[9999] flex items-end justify-end bg-black/35 p-3 backdrop-blur-[1px] animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsOpen(false);
        }}
      >
        <div className="flex h-[min(86vh,720px)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0A0814] shadow-2xl shadow-black/60">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-blue-900/45 to-purple-900/45 px-3 py-2">
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
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              title="Close (Esc)"
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

    return (
      <>
        {renderFloatingButton()}

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

function renderNotaryTab() {
  return <NotaryDashboard />;
}
