import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SafeLink } from '@/hooks/useSafeNavigate'
import {
  Home,
  MessageSquare,
  Video,
  Shield,
  Gavel,
  LogOut,
  FileText,
  ShoppingBag,
  Banknote,
  Menu,
  X,
  LogIn,
  UserPlus,
  Trash2,
  Building2,
  Landmark,
  Warehouse,
  Package,
  Store,
  Coins,
  TrendingUp,
  Shuffle,
  Scale,
  Crown,
  LifeBuoy,
  Waves,
  Gamepad2,
  Lock,
  BookOpen,
  Mic,
  Radio,
  LayoutDashboard,
  Newspaper,
  DollarSign,
  Users,
  AlertTriangle,
  Settings,
  Star,
  Eye,
  Siren,
  ClipboardList,
  BarChart3,
  MonitorDot,
  ScrollText,
  Calendar,
  Wallet,
  Trophy,
  Bell,
  Megaphone,
  Database,
  Heart,
  User,
  Search,
  Compass,
  Mail,
  Briefcase,
  Sparkles,
  Zap,
  Smartphone,
  Wrench,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

import { useAuthStore } from '../lib/store'
import { useBroadcastLockdown } from '@/hooks/useBroadcastLockdown'
import { usePresidentSystem } from '@/hooks/usePresidentSystem'
import { useCoins } from '@/lib/hooks/useCoins'
import { supabase, UserRole } from '@/lib/supabase'
import { canAccessTromail } from '@/lib/tromail'
import { List } from '@radix-ui/react-tabs'

interface RecentMessage {
  id: string
  sender_id: string
  sender_username: string
  sender_avatar_url: string | null
  content: string
  conversation_id: string
  created_at: string
}

type MenuOption = {
  category: string
  label: string
  icon: React.ElementType
  path: string
  badge?: number
  onClick?: () => void | Promise<void>
  show?: boolean
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function sortAlpha<T extends { label: string }>(items: T[]) {
  return [...items].sort((a, b) => a.label.localeCompare(b.label))
}

export default function BottomNavigation() {
  const { user, profile, logout } = useAuthStore()
  const { balances } = useCoins()
  const { isLocked: isBroadcastLockedDown } = useBroadcastLockdown()
  const { currentElection, finalizeElection, loading } = usePresidentSystem()

  const location = useLocation()
  const navigate = useNavigate()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [notificationCount, setNotificationCount] = useState(0)

  const [isBubbleVisible, setIsBubbleVisible] = useState(true)
  const [showHighlight, setShowHighlight] = useState(false)

  const [showRemoveZone, setShowRemoveZone] = useState(false)
  const [isOverRemoveZone, setIsOverRemoveZone] = useState(false)

  const [recentMessage, setRecentMessage] = useState<RecentMessage | null>(null)
  const [showMessageBubble, setShowMessageBubble] = useState(false)
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [pageSearch, setPageSearch] = useState('')

  const navButtonLastClick = useRef<number>(0)
  const profileRole = String(profile?.role || '')
  const profileTrollRole = String(profile?.troll_role || '')

  const isAdmin =
    profileRole === UserRole.ADMIN ||
    profileRole === UserRole.HR_ADMIN ||
    profileRole === UserRole.AGENCY_HR_MANAGER ||
    profileRole === 'admin' ||
    profileRole === 'superadmin' ||
    profileRole === 'ceo' ||
    profileTrollRole === UserRole.ADMIN ||
    profileTrollRole === 'admin' ||
    profileTrollRole === 'superadmin' ||
    profileTrollRole === 'ceo' ||
    !!(profile as any)?.is_admin ||
    !!(profile as any)?.is_superadmin

  const isSecretary =
    profileRole === UserRole.SECRETARY ||
    profileRole === 'secretary' ||
    profileTrollRole === UserRole.SECRETARY ||
    profileTrollRole === 'secretary' ||
    !!(profile as any)?.is_secretary ||
    isAdmin

  const isLead =
    profileRole === UserRole.LEAD_TROLL_OFFICER ||
    profileRole === 'lead_troll_officer' ||
    profileTrollRole === UserRole.LEAD_TROLL_OFFICER ||
    profileTrollRole === 'lead_troll_officer' ||
    !!(profile as any)?.is_lead_officer ||
    !!(profile as any)?.is_lead_troll_officer ||
    isAdmin

  const isOfficer =
    profileRole === UserRole.TROLL_OFFICER ||
    profileRole === 'troll_officer' ||
    profileTrollRole === UserRole.TROLL_OFFICER ||
    profileTrollRole === 'troll_officer' ||
    !!(profile as any)?.is_troll_officer ||
    isLead ||
    isAdmin

  const isPresident =
    profileRole === UserRole.PRESIDENT ||
    profileRole === 'president' ||
    profileTrollRole === UserRole.PRESIDENT ||
    profileTrollRole === 'president' ||
    !!(profile as any)?.is_president

  const isBroadcaster =
    profileRole === 'broadcaster' ||
    profileTrollRole === 'broadcaster' ||
    !!(profile as any)?.is_broadcaster

  const isAttorney =
    profileRole === 'attorney' ||
    profileTrollRole === 'attorney' ||
    !!(profile as any)?.is_attorney

  const isProsecutor =
    profileRole === 'prosecutor' ||
    profileTrollRole === 'prosecutor' ||
    !!(profile as any)?.is_prosecutor

  const isAuctioneer =
    profileRole === 'auctioneer' ||
    profileTrollRole === 'auctioneer' ||
    !!(profile as any)?.is_auctioneer

  const isAgencyHR =
    profileRole === 'agency_hr' ||
    profileRole === String(UserRole.AGENCY_HR_MANAGER) ||
    profileTrollRole === 'agency_hr' ||
    profileTrollRole === 'agency_hr_manager' ||
    !!(profile as any)?.is_agency_hr ||
    !!(profile as any)?.is_agency_hr_manager

  const isAgencyLeader =
    profileRole === 'agency_leader' ||
    profileTrollRole === 'agency_leader' ||
    !!(profile as any)?.is_agency_leader ||
    isAgencyHR ||
    isAdmin

  const isCEOAssistant =
    profileRole === 'ceo_assistant' ||
    profileTrollRole === 'ceo_assistant' ||
    !!(profile as any)?.is_ceo_assistant

  const isNoahAssistant =
    profileRole === 'noah_assistant' ||
    profileTrollRole === 'noah_assistant' ||
    !!(profile as any)?.is_noah_assistant

  const isJournalist =
    profileRole === 'journalist' ||
    profileTrollRole === 'journalist' ||
    !!(profile as any)?.is_journalist

  const isNewsCaster =
    profileRole === 'tcnn_news_caster' ||
    profileTrollRole === 'tcnn_news_caster' ||
    !!(profile as any)?.is_news_caster

  const isChiefNewsCaster =
    profileRole === 'tcnn_chief_news_caster' ||
    profileTrollRole === 'tcnn_chief_news_caster' ||
    !!(profile as any)?.is_chief_news_caster

  const isPastorCheck =
    profileRole === 'pastor' ||
    profileTrollRole === 'pastor' ||
    !!(profile as any)?.is_pastor

  const canSeeCourt = !!user && !!profile

  const canBroadcast = () => {
    const licenseStatus = String(
      (profile as any)?.license_status ||
        (profile as any)?.drivers_license_status ||
        ''
    ).toLowerCase()

    const licenseExpiry = (profile as any)?.drivers_license_expiry
    const insuranceExpiry = (profile as any)?.car_insurance_expiry

    const hasActiveLicense =
      licenseStatus === 'active' &&
      (!licenseExpiry || new Date(licenseExpiry) > new Date())

    const hasInsurance =
      !!insuranceExpiry && new Date(insuranceExpiry) > new Date()

    const hasVehicle = !!(profile as any)?.vehicle_id
    const hasPlate = !!(profile as any)?.license_plate

    const isBlocked =
      isBroadcastLockedDown ||
      licenseStatus === 'suspended' ||
      licenseStatus === 'revoked'

    return !isBlocked && hasActiveLicense && hasInsurance && hasVehicle && hasPlate
  }

  const trollCoins = Number(
    (balances as any)?.troll_coins ??
      (balances as any)?.balance ??
      (balances as any)?.coins ??
      (profile as any)?.troll_coins ??
      0,
  )

  const hypeCoins = Number(
    (balances as any)?.hype_coins ??
      (balances as any)?.hypeCoins ??
      (balances as any)?.broadcast_hype_coins ??
      (profile as any)?.hype_coins ??
      0,
  )

  const roleInfo = useMemo(() => {
    if (isAdmin) return { label: 'Admin', icon: Shield, color: 'from-cyan-400 via-purple-500 to-pink-500' }
    if (isLead) return { label: 'Lead Officer', icon: Star, color: 'from-yellow-400 via-cyan-500 to-purple-500' }
    if (isOfficer) return { label: 'Officer', icon: Gavel, color: 'from-blue-500 via-cyan-500 to-purple-500' }
    if (isSecretary) return { label: 'Secretary', icon: ScrollText, color: 'from-pink-500 via-purple-500 to-cyan-500' }
    if (isBroadcaster) return { label: 'Broadcaster', icon: Video, color: 'from-purple-500 via-cyan-500 to-blue-500' }

    return { label: 'Menu', icon: Menu, color: 'from-purple-600 via-cyan-500 to-blue-600' }
  }, [isAdmin, isLead, isOfficer, isSecretary, isBroadcaster])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const hasSeenNavHighlight = localStorage.getItem('has_seen_nav_highlight')
    if (!hasSeenNavHighlight) setShowHighlight(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key === 'b' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        setIsBubbleVisible(true)
        toast.success('Navigation bubble restored', { duration: 2000 })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (isMenuOpen) document.body.classList.add('no-scroll')
    else document.body.classList.remove('no-scroll')

    return () => document.body.classList.remove('no-scroll')
  }, [isMenuOpen])

  useEffect(() => {
    setIsMenuOpen(false)
    setPageSearch('')
  }, [location.pathname])

  const handleNavButtonClick = useCallback(() => {
    const now = Date.now()

    if (now - navButtonLastClick.current < 300) {
      navigate('/home', { replace: true })
      setIsMenuOpen(false)
      navButtonLastClick.current = 0
      return
    }

    navButtonLastClick.current = now

    if (showHighlight) {
      localStorage.setItem('has_seen_nav_highlight', 'true')
      setShowHighlight(false)
    }

    setIsMenuOpen(true)
  }, [navigate, showHighlight])

  // ─── Utromail unread count ─────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id || isMobile) return

    let isMounted = true

    const fetchUnreadCount = async () => {
      if (!isMounted) return
      // Use Utromail's getUnreadCount from the service
      try {
        const { getUnreadCount } = await import('../services/utromailService')
        const count = await getUnreadCount(user.id)
        if (isMounted) setNotificationCount(prev => {
          // Merge: notification count already has notifications, add utromail unread
          // We store utromail unread separately in the total
          return (count || 0) + (prev || 0)
        })
      } catch { /* ignore */ }
    }

    fetchUnreadCount()

    // Subscribe to new utromail messages for unread count updates
    // Note: No recipient_id filter — realtime publication doesn't include that column.
    // We fetch the full message in the callback and filter in application code.
    const channel = supabase
      .channel(`nav-utromail-unread:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'utromail_messages',
        },
        async (payload) => {
          const newMsg = payload.new as any;
          if (!newMsg) return;
          // Fetch full message to check recipient_id (not in realtime payload)
          const { data: fullMsg } = await supabase
            .from('utromail_messages')
            .select('recipient_id')
            .eq('id', newMsg.id)
            .maybeSingle();
          if (fullMsg?.recipient_id === user.id) {
            fetchUnreadCount();
          }
        },
      )
      .subscribe()

    return () => {
      isMounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    const fetchNotificationCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .is('is_dismissed', null)

      setNotificationCount(count || 0)
    }

    fetchNotificationCount()

    const channel = supabase
      .channel(`nav-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchNotificationCount(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchNotificationCount(),
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user?.id])

  // ─── Utromail message bubble popup ─────────────────────────────────────────

  useEffect(() => {
    if (!user?.id || isMobile) return

    const channel = supabase
      .channel(`mobile-utromail-bubble:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'utromail_messages',
        },
        async (payload) => {
          const newMsg = payload.new as any
          if (!newMsg) return
          // Fetch full message to check recipient_id (not in realtime payload)
          const { data: fullMsg } = await supabase
            .from('utromail_messages')
            .select('recipient_id, sender_id')
            .eq('id', newMsg.id)
            .maybeSingle()
          if (!fullMsg || fullMsg.recipient_id !== user.id) return
          if (fullMsg.sender_id === user.id) return

          const { data: sender } = await supabase
            .from('user_profiles')
            .select('username, avatar_url')
            .eq('id', newMsg.sender_id)
            .maybeSingle()

          if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current)

          setRecentMessage({
            id: newMsg.id,
            sender_id: newMsg.sender_id,
            sender_username: sender?.username || 'Unknown',
            sender_avatar_url: sender?.avatar_url || null,
            content: newMsg.body,
            conversation_id: newMsg.thread_id,
            created_at: newMsg.sent_at,
          })

          setShowMessageBubble(true)

          messageTimeoutRef.current = setTimeout(() => {
            setShowMessageBubble(false)
          }, 8000)
        },
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current)
    }
  }, [user?.id, isMobile])

  const handleMessagesClick = async () => {
    if (user?.id && notificationCount > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false)
    }

    setNotificationCount(0)
    setIsMenuOpen(false)
  }

  const handleLogout = async () => {
    try {
      sessionStorage.setItem('logout_requested', 'true')

      try {
        const { error } = await supabase.auth.signOut()
        if (error) console.warn('supabase.signOut returned error:', error)
      } catch (e) {
        console.warn('Error signing out session:', e)
      }

      await logout()

      try {
        const introSeen = sessionStorage.getItem('trollIntroSeen')
        localStorage.clear()
        sessionStorage.clear()
        if (introSeen) sessionStorage.setItem('trollIntroSeen', introSeen)
      } catch (e) {
        console.error('Error clearing storage:', e)
      }

      toast.success('Logged out successfully')
      setIsMenuOpen(false)

      setTimeout(() => {
        navigate('/exit', { replace: true })
      }, 100)
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Error logging out')
      navigate('/exit', { replace: true })
    }
  }

  const handleDrag = useCallback((_: any, info: any) => {
    const windowHeight = window.innerHeight
    const bubbleY = info.point.y

    if (bubbleY > windowHeight - 150) {
      setShowRemoveZone(true)

      const windowWidth = window.innerWidth
      const bubbleX = info.point.x
      const isInCenter = bubbleX > windowWidth * 0.3 && bubbleX < windowWidth * 0.7

      setIsOverRemoveZone(isInCenter)
    } else {
      setShowRemoveZone(false)
      setIsOverRemoveZone(false)
    }
  }, [])

  const handleDragEnd = useCallback(
    (_: any, info: any) => {
      setIsDragging(false)
      setShowRemoveZone(false)

      if (isOverRemoveZone) {
        setIsBubbleVisible(false)
        toast.success('Navigation hidden. Press "B" to restore', { duration: 3000 })
        setIsOverRemoveZone(false)
        return
      }

      setBubblePosition({
        x: info.point.x - window.innerWidth + 70,
        y: info.point.y - window.innerHeight + 70,
      })
    },
    [isOverRemoveZone],
  )

  const handleMessageBubbleClick = () => {
    if (!recentMessage) return

    navigate(`/utromail?user=${recentMessage.sender_id}`)
    setShowMessageBubble(false)
  }

  const dismissMessageBubble = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMessageBubble(false)

    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current)
  }

  const basePages: MenuOption[] = useMemo(
    () => [
      { category: 'Broadcasting', label: 'Go Live', icon: Video, path: '/broadcast/setup', show: !!user && canBroadcast() },

      { category: 'Careers + Work', label: 'Jobs', icon: FileText, path: '/jobs' },
      { category: 'Careers + Work', label: 'Mai Class', icon: BookOpen, path: '/mai-class' },
      { category: 'Careers + Work', label: 'My Earnings', icon: DollarSign, path: '/my-earnings' },
      { category: 'Careers + Work', label: 'My Orders', icon: ClipboardList, path: '/my-orders' },
      { category: 'Careers + Work', label: 'Hytro Gaming', icon: Gamepad2, path: '/hytrogaming' },
      { category: 'Careers + Work', label: 'Academy', icon: BookOpen, path: '/academy' },
      { category: 'Careers + Work', label: 'Shop', icon: Store, path: '/shop' },

      { category: 'City Center', label: 'Appeals', icon: Scale, path: '/city-registry' },
      { category: 'City Center', label: 'City Laws & Fees', icon: FileText, path: '/city-laws-fees' },
      { category: 'City Center', label: 'Coin Store', icon: Coins, path: '/store' },
      { category: 'City Center', label: 'Insurance', icon: Shield, path: '/insurance' },
      { category: 'City Center', label: 'Credit Scores', icon: TrendingUp, path: '/credit-scores' },
      { category: 'City Center', label: 'Home', icon: Home, path: '/home' },
      { category: 'City Center', label: 'Leaderboard', icon: Trophy, path: '/leaderboard' },
      { category: 'City Center', label: 'Live Auctions', icon: Gavel, path: '/auctions' },
      { category: 'City Center', label: 'Marketplace', icon: Store, path: '/marketplace' },
      { category: 'City Center', label: 'Crown Redemption', icon: Crown, path: '/crowns/redeem' },
      { category: 'City Center', label: 'Troll Court', icon: Scale, path: '/troll-court' },
      { category: 'City Center', label: 'Wallet', icon: Banknote, path: '/wallet' },

      { category: 'Community', label: 'Agencies', icon: Building2, path: '/agencies' },
      { category: 'Community', label: 'Inventory', icon: Package, path: '/inventory' },
      { category: 'Community', label: 'Living', icon: Warehouse, path: '/living' },
      { category: 'Community', label: 'My Agency', icon: Users, path: '/agency-dashboard' },
      { category: 'Community', label: 'My Family', icon: Users, path: '/family/home' },
      { category: 'Community', label: 'Pool', icon: Waves, path: '/pool' },
      { category: 'Community', label: 'Troll Church', icon: BookOpen, path: '/church' },
      { category: 'Community', label: 'Troll Match', icon: Heart, path: '/match' },
      { category: 'Community', label: 'Troll Wheel', icon: Gamepad2, path: '/troll-wheel' },

      { category: 'News + Ads', label: 'Advertise', icon: Megaphone, path: '/city-registry/advertise' },
      { category: 'News + Ads', label: 'Trollified', icon: ShoppingBag, path: '/trollifieds' },

      { category: 'Podcast', label: 'Podcast Central', icon: Mic, path: '/podcast' },

      { category: 'Social', label: 'Search', icon: Search, path: '/search' },
      { category: 'Social', label: 'Notifications', icon: Bell, path: '/notifications', badge: notificationCount, onClick: handleMessagesClick },
      { category: 'Social', label: 'Mail', icon: MessageSquare, path: '/utromail', badge: notificationCount, onClick: handleMessagesClick },
      { category: 'Social', label: 'Profile', icon: User, path: profile?.username ? `/profile/${profile.username}` : '/profile/setup' },

      { category: 'Support', label: 'Safety', icon: Shield, path: '/safety' },
      { category: 'Support', label: 'Policies', icon: FileText, path: '/legal' },
      { category: 'Support', label: 'Support', icon: LifeBuoy, path: '/support' },
    ],
    [user, profile, notificationCount, isBroadcastLockedDown],
  )

  const governmentPages: MenuOption[] = useMemo(() => {
    const pages: MenuOption[] = []

    if (isOfficer || isSecretary || isAdmin) {
      pages.push(
        { category: 'Government', label: 'City Government', icon: Landmark, path: '/government' },
        { category: 'Government', label: 'Streams', icon: Radio, path: '/government/streams' },
      )
    }

    if (canSeeCourt) {
      pages.push({ category: 'Government', label: 'Court Dockets', icon: Gavel, path: '/admin/court-dockets' })
    }

    if (isOfficer) {
      pages.push(
        { category: 'Government', label: 'Department Tools', icon: Wrench, path: '/department-tools' },
        { category: 'Government', label: 'Officer Scheduling', icon: Calendar, path: '/officer/scheduling' },
        { category: 'Government', label: 'OWC Dashboard', icon: LayoutDashboard, path: '/officer/owc' },
      )
    }

    if (isOfficer || isAdmin || isLead || isSecretary) {
      pages.push(
        { category: 'Government', label: 'Night Watch', icon: Eye, path: '/admin/night-watch' },
      )
    }

    if (isLead) {
      pages.push(
        { category: 'Government', label: 'Creator Approvals', icon: ClipboardList, path: '/admin/creator-approvals' },
        { category: 'Government', label: 'Lead HQ', icon: Star, path: '/department-tools' },
        { category: 'Government', label: 'Weekly Reports', icon: BarChart3, path: '/admin/reports/weekly' },
      )
    }

    if (isSecretary || isAdmin) {
      pages.push(
        { category: 'Government', label: 'Admin Appeals', icon: ScrollText, path: '/admin/appeals' },
        { category: 'Government', label: 'Manual Orders', icon: FileText, path: '/admin/manual-orders' },
        { category: 'Government', label: 'Secretary Console', icon: LayoutDashboard, path: '/secretary' },
      )
    }

    if (isOfficer || isLead || isSecretary || isAdmin || profile?.role === 'ceo_assistant' || profile?.role === 'noah_assistant' || profile?.role === 'hr_admin' || profile?.role === 'hr_manager') {
      pages.push({ category: 'Government', label: 'Employees', icon: Briefcase, path: '/Employees' })
    }

    if (isPresident || isAdmin) {
      pages.push(
        { category: 'Government', label: 'President', icon: Crown, path: '/president' },
        { category: 'Government', label: 'Treasury', icon: Wallet, path: '/president/treasury' },
      )
    }

    if (isAttorney || isProsecutor || isAdmin) {
      if (isAttorney || isAdmin) {
        pages.push({ category: 'Government', label: 'Attorney Dashboard', icon: Scale, path: '/attorney' })
      }
      if (isProsecutor || isAdmin) {
        pages.push({ category: 'Government', label: 'Prosecutor Dashboard', icon: Gavel, path: '/prosecutor' })
      }
    }

    if (isAdmin && isPastorCheck) {
      pages.push({ category: 'Government', label: 'Pastor Dashboard', icon: Users, path: '/church/pastor' })
    }

    if (!!profile && canAccessTromail(profile)) {
      pages.push({ category: 'Government', label: 'Tromail', icon: Mail, path: '/tromail' })
    }

    return pages
  }, [isOfficer, isSecretary, isAdmin, isLead, isPresident, isAttorney, isProsecutor, canSeeCourt, profile])

  const auctioneerPages: MenuOption[] = useMemo(() => {
    if (!isAuctioneer && !isAdmin) return []
    return [
      { category: 'Auctioneer', label: 'Auction Dashboard', icon: LayoutDashboard, path: '/auctions/studio' },
      { category: 'Auctioneer', label: 'Auction App', icon: Scan, path: '/auction-app' },
      { category: 'Auctioneer', label: 'Auction Studio', icon: Video, path: '/auctions/studio' },
      { category: 'Auctioneer', label: 'My Shows', icon: Radio, path: '/auctions/my-shows' },
      { category: 'Auctioneer', label: 'Scanner', icon: Scan, path: '/auctioneer/scanner' },
      { category: 'Auctioneer', label: 'Lots', icon: Package, path: '/auctions/studio/lots' },
      { category: 'Auctioneer', label: 'Bidders', icon: Users, path: '/auctions/bidders' },
      { category: 'Auctioneer', label: 'Sales', icon: DollarSign, path: '/auctions/sales' },
      { category: 'Auctioneer', label: 'Reports', icon: BarChart3, path: '/auctions/reports' },
      { category: 'Auctioneer', label: 'Analytics', icon: TrendingUp, path: '/auctions/analytics' },
      { category: 'Auctioneer', label: 'Settings', icon: Settings, path: '/auctions/settings' },
      { category: 'Auctioneer', label: 'Inventory', icon: Warehouse, path: '/auctions/inventory' },
      { category: 'Auctioneer', label: 'Orders', icon: ClipboardList, path: '/auctions/orders' },
      { category: 'Auctioneer', label: 'Packing', icon: Package, path: '/auctions/packing' },
      { category: 'Auctioneer', label: 'Devices', icon: Smartphone, path: '/auctions/devices' },
    ]
  }, [isAuctioneer, isAdmin])

  const attorneyPages: MenuOption[] = useMemo(() => {
    if (!isAttorney && !isProsecutor && !isAdmin) return []
    const pages: MenuOption[] = []
    if (isAttorney || isAdmin) {
      pages.push({ category: 'Legal Career', label: 'Attorney Dashboard', icon: Scale, path: '/attorney' })
    }
    if (isProsecutor || isAdmin) {
      pages.push({ category: 'Legal Career', label: 'Prosecutor Dashboard', icon: Gavel, path: '/prosecutor' })
    }
    return pages
  }, [isAttorney, isProsecutor, isAdmin])

  const broadcasterPages: MenuOption[] = useMemo(() => {
    if (!isBroadcaster && !isAdmin) return []
    return [
      { category: 'Broadcaster', label: 'Creator Dashboard', icon: LayoutDashboard, path: '/creator/dashboard' },
      { category: 'Broadcaster', label: 'Creator Onboarding', icon: Sparkles, path: '/creator/onboarding' },
      { category: 'Broadcaster', label: 'My Earnings', icon: DollarSign, path: '/creator/earnings' },
    ]
  }, [isBroadcaster, isAdmin])

  const agencyHRPages: MenuOption[] = useMemo(() => {
    if (!isAgencyHR && !isAgencyLeader && !isAdmin) return []
    return [
      { category: 'Agency HR', label: 'HR Dashboard', icon: Users, path: '/agency-hr-dashboard' },
      { category: 'Agency HR', label: 'My Agency', icon: Building2, path: '/agency-dashboard' },
    ]
  }, [isAgencyHR, isAgencyLeader, isAdmin])

  const ceoAssistantPages: MenuOption[] = useMemo(() => {
    const pages: MenuOption[] = []
    if (isCEOAssistant || isAdmin) {
      pages.push({ category: 'Executive', label: 'CEO Assistant', icon: Briefcase, path: '/ceo-assistant-dashboard' })
    }
    if (isNoahAssistant || isAdmin) {
      pages.push({ category: 'Executive', label: 'Noah Assistant', icon: Briefcase, path: '/noah-assistant-dashboard' })
    }
    return pages
  }, [isCEOAssistant, isNoahAssistant, isAdmin])

  const journalistPages: MenuOption[] = useMemo(() => {
    if (!isJournalist && !isNewsCaster && !isChiefNewsCaster && !isAdmin) return []
    const pages: MenuOption[] = []
    if (isJournalist || isAdmin) {
      pages.push({ category: 'News', label: 'Journalist', icon: Newspaper, path: '/tcnn' })
    }
    if (isNewsCaster || isAdmin) {
      pages.push({ category: 'News', label: 'News Caster', icon: Radio, path: '/tcnn/broadcaster' })
    }
    if (isChiefNewsCaster || isAdmin) {
      pages.push({ category: 'News', label: 'Chief Caster', icon: Star, path: '/tcnn/dashboard' })
    }
    return pages
  }, [isJournalist, isNewsCaster, isChiefNewsCaster, isAdmin])

  const adminPages: MenuOption[] = useMemo(() => {
    if (!isAdmin) return []

    return [
      { category: 'Admin - City', label: 'City Control', icon: MonitorDot, path: '/admin/system/health' },
      { category: 'Admin - City', label: 'Control Panel', icon: Settings, path: '/admin/control-panel' },
      { category: 'Admin - City', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
      { category: 'Admin - City', label: 'Role Management', icon: Shield, path: '/admin/role-management' },
      { category: 'Admin - City', label: 'User Search', icon: Users, path: '/admin/user-search' },
      { category: 'Admin - City', label: 'Verified Users', icon: Eye, path: '/admin/verified-users' },

      { category: 'Admin - Content', label: 'Announcements', icon: Megaphone, path: '/admin/announcements' },
      { category: 'Admin - Content', label: 'Applications', icon: FileText, path: '/admin/applications' },
      { category: 'Admin - Content', label: 'Marketplace Admin', icon: Store, path: '/admin/marketplace' },
      { category: 'Admin - Content', label: 'Media Library', icon: Eye, path: '/admin/media-library' },
      { category: 'Admin - Content', label: 'Send Notifications', icon: Bell, path: '/admin/send-notifications' },

      { category: 'Admin - Finance', label: 'Cashout Manager', icon: DollarSign, path: '/admin/cashout-manager' },
      { category: 'Admin - Finance', label: 'Coin Purchase Ledger', icon: Coins, path: '/admin/coinpurchase-ledger' },
      { category: 'Admin - Finance', label: 'Earnings', icon: BarChart3, path: '/admin/earnings' },
      { category: 'Admin - Finance', label: 'Finance', icon: DollarSign, path: '/admin/finance' },
      { category: 'Admin - Finance', label: 'Grant Coins', icon: Coins, path: '/admin/grant-coins' },
      { category: 'Admin - Finance', label: 'Payment Logs', icon: FileText, path: '/admin/payment-logs' },
      { category: 'Admin - Finance', label: 'Payments', icon: Banknote, path: '/admin/payments' },
      { category: 'Admin - Finance', label: 'Payouts', icon: Wallet, path: '/admin/payouts' },
      { category: 'Admin - Finance', label: 'Startup Expense Tracker', icon: TrendingUp, path: '/admin/startup-expense-tracker' },

      { category: 'Admin - Moderation', label: 'Chat Moderation', icon: MessageSquare, path: '/admin/chat-moderation' },
      { category: 'Admin - Moderation', label: 'Critical Alerts', icon: Siren, path: '/admin/critical-alerts' },
      { category: 'Admin - Moderation', label: 'Jail Management', icon: Lock, path: '/admin/jail-management' },
      { category: 'Admin - Moderation', label: 'Reports Queue', icon: FileText, path: '/admin/reports-queue' },
      { category: 'Admin - Moderation', label: 'Stream Monitor', icon: MonitorDot, path: '/admin/stream-monitor' },

      { category: 'Admin - Officers', label: 'Live Officers', icon: MonitorDot, path: '/admin/officers-live' },
      { category: 'Admin - Officers', label: 'Officer Management', icon: Gavel, path: '/admin/officer-management' },
      { category: 'Admin - Officers', label: 'Officer Ops', icon: ClipboardList, path: '/admin/officer-operations' },
      { category: 'Admin - Officers', label: 'Officer Reports', icon: FileText, path: '/admin/officer-reports' },
      { category: 'Admin - Officers', label: 'Officer Shifts', icon: Calendar, path: '/admin/officer-shifts' },

      { category: 'Admin - System', label: 'Buckets', icon: Database, path: '/admin/buckets' },
      { category: 'Admin - System', label: 'Changelog', icon: ScrollText, path: '/changelog' },
      { category: 'Admin - System', label: 'Errors', icon: AlertTriangle, path: '/admin/errors' },
      { category: 'Admin - System', label: 'Export Data', icon: FileText, path: '/admin/export-data' },
      { category: 'Admin - System', label: 'Policies', icon: FileText, path: '/admin/docs/policies' },
    ]
  }, [isAdmin])

  const menuOptions = useMemo(() => {
    const seen = new Set<string>()

    return [...basePages, ...governmentPages, ...auctioneerPages, ...attorneyPages, ...broadcasterPages, ...agencyHRPages, ...ceoAssistantPages, ...journalistPages, ...adminPages]
      .filter((item) => item.show !== false)
      .filter((item) => {
        const key = `${item.category}:${item.label}:${item.path}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }, [basePages, governmentPages, auctioneerPages, attorneyPages, broadcasterPages, agencyHRPages, ceoAssistantPages, journalistPages, adminPages])

  const groupedOptions = useMemo(() => {
    const normalizedSearch = pageSearch.trim().toLowerCase()

    const groups = menuOptions.reduce<Record<string, MenuOption[]>>((acc, item) => {
      if (normalizedSearch && !item.label.toLowerCase().includes(normalizedSearch)) return acc

      if (!acc[item.category]) acc[item.category] = []
      acc[item.category].push(item)

      return acc
    }, {})

    return Object.entries(groups)
      .map(([category, items]) => [category, sortAlpha(items)] as const)
      .sort(([a], [b]) => a.localeCompare(b))
  }, [menuOptions, pageSearch])

  if (!isMobile) return null

  const RoleIcon = roleInfo.icon

  return (
    <>
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-black"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRemoveZone && isDragging && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className={cx(
              'fixed bottom-0 left-0 right-0 z-[90] flex h-32 items-center justify-center transition-colors',
              isOverRemoveZone ? 'bg-red-500/40' : 'bg-red-500/20',
            )}
          >
            <div className={cx('flex flex-col items-center gap-2 transition-transform', isOverRemoveZone ? 'scale-110' : 'scale-100')}>
              <Trash2 size={32} className={isOverRemoveZone ? 'text-red-300' : 'text-red-400'} />
              <span className={cx('text-sm font-bold', isOverRemoveZone ? 'text-red-200' : 'text-red-300')}>
                {isOverRemoveZone ? 'Release to Remove' : 'Drag here to hide'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBubbleVisible && (
          <motion.div
            initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
            animate={{ scale: 1, opacity: 1, x: bubblePosition.x, y: bubblePosition.y }}
            exit={{ scale: 0, opacity: 0 }}
            drag
            dragMomentum={false}
            dragConstraints={{
              left: -window.innerWidth + 80,
              right: 0,
              top: -window.innerHeight + 150,
              bottom: 0,
            }}
            onDragStart={() => setIsDragging(true)}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            className="fixed bottom-20 right-4 z-[100]"
            style={{ touchAction: 'none' }}
          >

            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              onClick={handleNavButtonClick}
              className={`relative h-14 w-14 rounded-full bg-gradient-to-tr ${roleInfo.color} p-[2px] shadow-[0_0_25px_rgba(34,211,238,0.40)] transition-shadow duration-300 hover:shadow-[0_0_35px_rgba(236,72,153,0.45)]`}
            >
              {showHighlight && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.4, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full border-2 border-yellow-400"
                />
              )}

              <div className="flex h-full w-full items-center justify-center rounded-full border border-white/[0.08] bg-[#0D0D0D]">
                <RoleIcon size={24} className="text-white" />
              </div>
            </motion.button>

            {showHighlight && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <div className="rounded-lg bg-yellow-500/90 px-3 py-1.5 text-xs font-bold text-black shadow-lg">
                  Tap to explore!
                </div>
              </div>
            )}

            {totalUnreadCount > 0 && (
              <div className="absolute -right-1 -top-1 flex h-6 w-6 animate-pulse items-center justify-center rounded-full border-2 border-[#0D0D0D] bg-red-500 text-xs font-bold text-white">
                {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
              </div>
            )}

            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-gray-500 opacity-60">
              Drag to move
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-[70] overflow-y-auto bg-gradient-to-br from-[#050814] via-[#09111f] to-[#070712]"
            >
              {isPresident && (
                <div className="p-4">
                  <div className="mb-6 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white">
                      <Crown className="h-5 w-5 text-yellow-300" />
                      President Tools
                    </h3>

                    {currentElection && currentElection.status !== 'finalized' ? (
                      <>
                        <p className="mb-4 text-sm text-slate-300">
                          Current election: {currentElection.title || 'Untitled'} — Status: {currentElection.status.toUpperCase()}
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            finalizeElection(currentElection.id)
                            setIsMenuOpen(false)
                          }}
                          disabled={loading}
                          className="rounded-xl bg-cyan-600 px-4 py-2 font-bold text-white transition-colors hover:bg-cyan-500 disabled:bg-cyan-900"
                        >
                          End Election & Appoint President
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-slate-300">
                        No active election. Your dashboard is accessible at /president.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#07101d]/85 p-4 backdrop-blur-2xl">
                <div className="mx-auto flex max-w-4xl items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-11 w-11 rounded-2xl bg-gradient-to-tr ${roleInfo.color} p-[2px] shadow-[0_0_18px_rgba(34,211,238,0.25)]`}>
                      <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#0D0D0D]">
                        <RoleIcon size={22} className="text-white" />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-white">{roleInfo.label}</h3>
                      <p className="text-xs text-cyan-100/50">Mai Troll quick navigation</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {user && (
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="rounded-xl p-2.5 text-red-400/80 transition-colors hover:bg-red-500/[0.08] hover:text-red-300"
                        title="Logout"
                      >
                        <LogOut size={20} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsMenuOpen(false)}
                      className="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <X size={22} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mx-auto max-w-4xl space-y-6 p-4">
                {!user ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <SafeLink
                        to="/auth"
                        onClick={() => setIsMenuOpen(false)}
                        className="group flex items-center gap-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5 transition hover:bg-cyan-500/15"
                      >
                        <LogIn size={24} className="text-cyan-300" />
                        <div>
                          <span className="block text-base font-black text-white">Sign In</span>
                          <span className="text-xs text-slate-400">Already have an account?</span>
                        </div>
                      </SafeLink>

                      <SafeLink
                        to="/auth?tab=signup"
                        onClick={() => setIsMenuOpen(false)}
                        className="group flex items-center gap-4 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5 transition hover:bg-purple-500/15"
                      >
                        <UserPlus size={24} className="text-purple-300" />
                        <div>
                          <span className="block text-base font-black text-white">Sign Up</span>
                          <span className="text-xs text-slate-400">Create a new account</span>
                        </div>
                      </SafeLink>
                    </div>

<div className="grid grid-cols-2 gap-3">
                      <SafeLink to="/home" onClick={() => setIsMenuOpen(false)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center text-sm font-bold text-white">
                        Home
                      </SafeLink>
                    </div>
                  </div>
                ) : (
                  <>
                    <SafeLink
                      to="/broadcast/setup"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 p-4 text-base font-black text-white shadow-lg transition hover:scale-[1.02]"
                    >
                      <Video size={22} />
                      Go Live
                    </SafeLink>

                    <div className="rounded-2xl border border-cyan-300/15 bg-slate-950/70 p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-black text-cyan-100">
                        <Wallet size={16} />
                        Your Balances
                      </h4>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                          <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Troll Coins</div>
                          <div className="text-lg font-black text-yellow-300">{trollCoins.toLocaleString()}</div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                          <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Hype Coins</div>
                          <div className="text-lg font-black text-cyan-300">{hypeCoins.toLocaleString()}</div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                          <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Level</div>
                          <div className="text-lg font-black text-purple-300">{(profile as any)?.level || 1}</div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                          <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">XP</div>
                          <div className="text-lg font-black text-green-300">{Number((profile as any)?.xp || 0).toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="mt-3 border-t border-white/10 pt-3 text-center">
                        <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Role</div>
                        <div className="text-sm font-black capitalize text-white">
                          {String(profile?.role || profile?.troll_role || 'citizen').replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>

                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-200/50" />
                      <input
                        value={pageSearch}
                        onChange={(event) => setPageSearch(event.target.value)}
                        placeholder="Search pages..."
                        className="w-full rounded-2xl border border-white/10 bg-black/35 py-3 pl-12 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
                      />
                    </label>

                    <div className="grid grid-cols-3 gap-3">
                      <SafeLink to="/home" onClick={() => setIsMenuOpen(false)} className="flex flex-col items-center gap-2 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4 text-white">
                        <Home size={24} className="text-blue-300" />
                        <span className="text-sm font-black">Home</span>
                      </SafeLink>

                      <SafeLink to="/search" onClick={() => setIsMenuOpen(false)} className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-white">
                        <Search size={24} className="text-emerald-300" />
                        <span className="text-sm font-black">Search</span>
                      </SafeLink>

                      <SafeLink to="/store" onClick={() => setIsMenuOpen(false)} className="flex flex-col items-center gap-2 rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-4 text-white">
                        <Coins size={24} className="text-yellow-300" />
                        <span className="text-sm font-black">Coins</span>
                      </SafeLink>
                    </div>

                    {groupedOptions.map(([category, options]) => (
                      <div key={category}>
                        <h4 className="mb-3 px-1 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100/60">
                          {category}
                        </h4>

<div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                           {options
                             .filter((opt) => !['Home', 'Coin Store', 'Search'].includes(opt.label))
                             .map((opt) => {
                               const active = location.pathname === opt.path

                               return (
                                 <SafeLink
                                   key={`${category}-${opt.label}-${opt.path}`}
                                   to={opt.path}
                                   onClick={() => {
                                     if (opt.onClick) opt.onClick()
                                     else setIsMenuOpen(false)
                                   }}
                                   className={cx(
                                     'relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-200',
                                     active
                                       ? 'border-cyan-300/60 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                                       : 'border-white/[0.06] bg-white/[0.035] text-white hover:border-cyan-300/25 hover:bg-white/[0.06]',
                                   )}
                                 >
                                   <span className={cx(
                                     'text-sm font-black',
                                     active ? 'text-cyan-300' : 'text-white',
                                   )}>
                                     {opt.label}
                                   </span>

                                   {!!opt.badge && opt.badge > 0 && (
                                     <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                                       {opt.badge > 9 ? '9+' : opt.badge}
                                     </span>
                                   )}
                                 </SafeLink>
                               )
                             })}
                         </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="sticky bottom-0 p-4 text-center">
                <p className="text-xs text-gray-600">
                  Press <kbd className="rounded bg-white/10 px-2 py-1 text-gray-400">B</kbd> to restore navigation bubble
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMessageBubble && recentMessage && (
          <motion.div
            initial={{ x: 300, opacity: 0, scale: 0.8 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 300, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-4 right-4 top-20 z-[80] cursor-pointer rounded-2xl border border-purple-500/30 bg-[#1A1A2E] p-4 shadow-2xl md:left-auto md:w-80"
            onClick={handleMessageBubbleClick}
          >
            <div className="flex items-start gap-3">
              <div className="relative shrink-0 h-12 w-12">
                <ProfileFrame
                  frame={null}
                  avatarUrl={recentMessage.sender_avatar_url || `https://ui-avatars.com/api/?name=${recentMessage.sender_username}&background=random`}
                  username={recentMessage.sender_username}
                  size="sm"
                />
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#1A1A2E] bg-green-500 z-10" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate text-sm font-bold text-white">
                    {recentMessage.sender_username}
                  </h4>

                  <button
                    type="button"
                    onClick={dismissMessageBubble}
                    className="-mr-1 -mt-1 rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <p className="mt-1 line-clamp-2 text-sm text-gray-300">
                  {recentMessage.content}
                </p>

                <p className="mt-2 text-xs text-gray-500">Tap to reply</p>
              </div>
            </div>

            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 8, ease: 'linear' }}
              className="absolute bottom-0 left-0 right-0 h-1 origin-left rounded-b-2xl bg-gradient-to-r from-purple-500 to-blue-500"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}