import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'

import { ArrowLeft, Award, Ban, BatteryCharging, BookOpen, Boxes, ChevronRight, Coins, CreditCard, Crown, Gavel, Image, KeyRound, LogOut, Save, Scale, Settings, Shield, ShoppingBag, Star, UserPlus, UserRound, Video, Wallet, ShieldCheck, AlertCircle, FileText, Upload, Eye, Trash2 } from 'lucide-react';

import { toast } from 'sonner'

import { usePhoneXP } from '../../hooks/usePhoneXP';
import { getLevelName } from '../../lib/xp'
import { useCityStatus } from '../../hooks/useCityStatus'
import { PhoneButton } from '../components/PhoneButton'
import { PhoneBadgeDisplay } from '../components/PhoneBadgeDisplay'
import { PhoneBadgeList } from '../components/PhoneBadgeDisplay'

import AvatarUpload from '../../components/profile/AvatarUpload'
import CoverPhotoUpload, {
  CoverPhotoUploadRef,
} from '../../components/profile/CoverPhotoUpload'

import FamilyMinorSettings from '../../components/profile/FamilyMinorSettings'
import BatterySaverToggle from '../../components/BatterySaverToggle'
import UserInventory from '../../pages/UserInventory'
import ProfileFeed from '../../components/profile/ProfileFeed'
import ProfileMaiPiks from '../../components/profile/ProfileMaiPiks'
import ProfileBroadcasts from '../../components/profile/ProfileBroadcasts'
import ProfileMarketplace from '../../components/profile/ProfileMarketplace'
import ProfileCourt from '../../components/profile/ProfileCourt'
import ProfileAgency from '../../components/profile/ProfileAgency'
import ProfileChurch from '../../components/profile/ProfileChurch'
import ProfilePurchases from '../../components/profile/ProfilePurchases'
import ProfileWatchlist from '../../components/profile/ProfileWatchlist'
import MaiSubPanel from '../../components/profile/MaiSubPanel'
import CityIdentityPanel from '../../components/profile/CityIdentityPanel'
import AccessPurchasePanel from '../../components/profile/AccessPurchasePanel'
import FounderBadge from '../../components/founder/FounderBadge'
import FounderScheduledBroadcastBanner from '../../components/founder/FounderScheduledBroadcastBanner'
import { useFounderIdentity } from '../../hooks/useFounderProgram'

type ProfileRow = {
  id: string
  troll_coins?: number | null
  display_name?: string | null
  full_name?: string | null
  username?: string | null
  avatar_url?: string | null
  cover_url?: string | null
  role?: string | null
  tier?: string | null
  bio?: string | null
  platform?: string | null
  banner_notifications_enabled?: boolean | null
  is_minor?: boolean | null
  creator_subscription_enabled?: boolean | null
  creator_subscription_price_coins?: number | null
  maipiks_story_visibility?: string | null
  maipiks_story_duration_hours?: number | null
  maipiks_story_monetization?: string | null
  maipiks_story_base_price_coins?: number | null
  maipiks_story_subscriber_discount_mode?: string | null
  maipiks_story_paid_access_duration?: string | null
}

const PLATFORM_OPTIONS = [
  { value: '', label: 'Select platform' },
  { value: 'Mai Troll', label: 'Mai Troll' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'liveme', label: 'LiveMe' },
  { value: 'bigo', label: 'Bigo Live' },
  { value: 'favortied', label: 'Favortied' },
]

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked
          ? 'bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] shadow-[0_0_16px_rgba(191,0,255,0.35)]'
          : 'bg-white/10'
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

type ProfileTab = {
  id: string
  label: string
  icon: any
}

const PROFILE_TABS: ProfileTab[] = [
  { id: 'social', label: 'Social', icon: UserRound },
  { id: 'maipiks', label: 'Mai Piks', icon: Image },
  { id: 'broadcasts', label: 'Broadcasts', icon: Video },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  { id: 'auctions', label: 'Auctions', icon: Gavel },
  { id: 'court', label: 'Court', icon: Scale },
  { id: 'agency', label: 'Agency', icon: Shield },
  { id: 'church', label: 'Church', icon: BookOpen },
  { id: 'subscriptions', label: 'Subscriptions', icon: Crown },
  { id: 'maisub', label: 'MaiSub', icon: Coins },
  { id: 'badges', label: 'Badges', icon: Award },
  { id: 'keys', label: 'Keys', icon: KeyRound },
  { id: 'inventory', label: 'Inventory & Perks', icon: Boxes },
  { id: 'purchases', label: 'Purchase History', icon: Wallet },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function PhoneProfile() {
  const navigate = useNavigate()
  const { username: usernameParam } = useParams<{ username?: string }>()

  const user = useAuthStore((state) => state.user)
  const storeProfile = useAuthStore((state) => state.profile)
  const refreshProfile = useAuthStore((state) => state.refreshProfile)

  const coverUploadRef = useRef<CoverPhotoUploadRef>(null)

  const [loading, setLoading] = useState(true)

  const [coins, setCoins] = useState(0)

  const [displayName, setDisplayName] = useState('Guest')
  const [username, setUsername] = useState(usernameParam || '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [_role, setRole] = useState('')
  // Id of the profile being viewed (own profile or someone else's).
  const [profileId, setProfileId] = useState<string | null>(null)

  // ⭐ Founder Program — gold username + Founder badge, same shared store the
  // web profile and username components use. Admins are excluded.
  const { showFounderBadge: isProfileFounder } = useFounderIdentity(profileId)

  const [activeTab, setActiveTab] = useState('social')

  /*
   * Settings
   */
  const [showSettings, setShowSettings] = useState(false)

  const [settingsUsername, setSettingsUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [platform, setPlatform] = useState('')
  const [bannerNotifications, setBannerNotifications] = useState(true)
  const [isMinor, setIsMinor] = useState(false)
  const [gender, setGender] = useState<'male' | 'female' | 'nonbinary' | ''>('')

  /*
   * ID Verification
   */
  const [idVerificationStatus, setIdVerificationStatus] = useState<'not_submitted' | 'pending' | 'approved' | 'rejected'>('not_submitted')
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | null>(null)
  const [idUploading, setIdUploading] = useState(false)
  const [idUploadProgress, setIdUploadProgress] = useState(0)

  /*
   * MAI Piks Story Defaults
   */
  const [maipiksStoryVisibility, setMaipiksStoryVisibility] = useState<'everyone' | 'followers' | 'private'>('everyone')
  const [maipiksStoryDurationHours, setMaipiksStoryDurationHours] = useState(24)
  const [maipiksStoryMonetization, setMaipiksStoryMonetization] = useState<'free' | 'paid' | 'subscribers_only' | 'free_for_subscribers'>('free')
  const [maipiksStoryBasePriceCoins, setMaipiksStoryBasePriceCoins] = useState(100)
  const [maipiksStorySubscriberDiscountMode, setMaipiksStorySubscriberDiscountMode] = useState<'platform' | 'none'>('platform')
  const [maipiksStoryPaidAccessDuration, setMaipiksStoryPaidAccessDuration] = useState('until_story_expiry')
  const [savingMaipiksSettings, setSavingMaipiksSettings] = useState(false)

  /*
   * Creator memberships
   */
  const [creatorSubscriptionEnabled, setCreatorSubscriptionEnabled] =
    useState(false)

  const [creatorSubscriptionPrice, setCreatorSubscriptionPrice] =
    useState(100)

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingSubscription, setSavingSubscription] = useState(false)

  const [profileTargetId, setProfileTargetId] = useState<string | null>(null)
  const { status: cityStatus, loading: cityStatusLoading } = useCityStatus(profileTargetId)

  // XP from usePhoneXP hook (mirrors web useXPStore logic)
  const xpData = usePhoneXP(profileId || user?.id)
  const level = xpData.level
  const _xp = xpData.totalXp
  const xpToNextLevel = xpData.xpToNext
  const _totalXp = xpData.totalXp

  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [postsCount, setPostsCount] = useState(0)

  const isViewingOwnProfile = !usernameParam || usernameParam === (user as any)?.username

  /*
   * Load profile
   */
  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    let cancelled = false

    const applyProfile = (row: ProfileRow) => {
      setCoins(Math.max(0, Number(row.troll_coins) || 0))

      setDisplayName(
        row.display_name ||
          row.full_name ||
          row.username ||
          user.email?.split('@')[0] ||
          'User',
      )

      setUsername(row.username || '')
      setAvatarUrl(row.avatar_url || null)
      setCoverUrl(row.cover_url || null)
      setRole(row.role || '')

      setSettingsUsername(row.username || '')
      setFullName(row.full_name || '')
      setBio(row.bio || '')
      setPlatform(row.platform || '')

      setBannerNotifications(
        row.banner_notifications_enabled ?? true,
      )

      setIsMinor(row.is_minor ?? false)

      setCreatorSubscriptionEnabled(
        row.creator_subscription_enabled ?? false,
      )

      setCreatorSubscriptionPrice(
        Number(row.creator_subscription_price_coins) || 100,
      )

      setMaipiksStoryVisibility((row.maipiks_story_visibility as 'everyone' | 'followers' | 'private') ?? 'everyone')
      setMaipiksStoryDurationHours(Number(row.maipiks_story_duration_hours ?? 24))
      setMaipiksStoryMonetization((row.maipiks_story_monetization as 'free' | 'paid' | 'subscribers_only' | 'free_for_subscribers') ?? 'free')
      setMaipiksStoryBasePriceCoins(Number(row.maipiks_story_base_price_coins ?? 100))
      setMaipiksStorySubscriberDiscountMode((row.maipiks_story_subscriber_discount_mode as 'platform' | 'none') ?? 'platform')
      setMaipiksStoryPaidAccessDuration(row.maipiks_story_paid_access_duration ?? 'until_story_expiry')

      setGender(((row as any).gender as 'male' | 'female' | 'nonbinary' | '') ?? '')

      // ID Verification
      setIdVerificationStatus(((row as any).id_verification_status as 'not_submitted' | 'pending' | 'approved' | 'rejected') ?? 'not_submitted')
      setIdDocumentUrl((row as any).id_document_url || null)

      if (row.id) {
        setProfileTargetId(row.id)
      }
    }

    const applyFallback = () => {
      const fallback = storeProfile as any

      setCoins(Number(fallback?.troll_coins) || 0)

      setDisplayName(
        fallback?.display_name ||
          fallback?.full_name ||
          fallback?.username ||
          user.email?.split('@')[0] ||
          'User',
      )

      setUsername(fallback?.username || '')
      setAvatarUrl(fallback?.avatar_url || null)
      setCoverUrl(fallback?.cover_url || null)
      setRole(fallback?.role || '')

      setSettingsUsername(fallback?.username || '')
      setFullName(fallback?.full_name || '')
      setBio(fallback?.bio || '')
      setPlatform(fallback?.platform || '')

      setBannerNotifications(
        fallback?.banner_notifications_enabled ?? true,
      )

      setIsMinor(fallback?.is_minor ?? false)

      setGender((fallback?.gender as 'male' | 'female' | 'nonbinary' | '') ?? '')

      // ID Verification
      setIdVerificationStatus((fallback?.id_verification_status as 'not_submitted' | 'pending' | 'approved' | 'rejected') ?? 'not_submitted')
      setIdDocumentUrl(fallback?.id_document_url || null)

      setCreatorSubscriptionEnabled(
        fallback?.creator_subscription_enabled ?? false,
      )

      setCreatorSubscriptionPrice(
        Number(fallback?.creator_subscription_price_coins) || 100,
      )

      setMaipiksStoryVisibility((fallback?.maipiks_story_visibility as 'everyone' | 'followers' | 'private') ?? 'everyone')
      setMaipiksStoryDurationHours(Number(fallback?.maipiks_story_duration_hours ?? 24))
      setMaipiksStoryMonetization((fallback?.maipiks_story_monetization as 'free' | 'paid' | 'subscribers_only' | 'free_for_subscribers') ?? 'free')
      setMaipiksStoryBasePriceCoins(Number(fallback?.maipiks_story_base_price_coins ?? 100))
      setMaipiksStorySubscriberDiscountMode((fallback?.maipiks_story_subscriber_discount_mode as 'platform' | 'none') ?? 'platform')
      setMaipiksStoryPaidAccessDuration(fallback?.maipiks_story_paid_access_duration ?? 'until_story_expiry')

      if (fallback?.id) {
        setProfileTargetId(fallback.id)
      }
    }

    const loadProfile = async () => {
      setLoading(true)

      const targetId = usernameParam ? null : user.id
      let query = supabase
        .from('user_profiles')
        .select(`
          id,
          troll_coins,
          display_name,
          full_name,
          username,
          avatar_url,
          cover_url,
          role,
          tier,
          bio,
          platform,
          banner_notifications_enabled,
          is_minor,
          creator_subscription_enabled,
          creator_subscription_price_coins,
          maipiks_story_visibility,
          maipiks_story_duration_hours,
          maipiks_story_monetization,
          maipiks_story_base_price_coins,
          maipiks_story_subscriber_discount_mode,
          maipiks_story_paid_access_duration,
          gender,
          id_verification_status,
          id_document_url,
          id_uploaded_at
        `)

      if (usernameParam) {
        query = query.eq('username', usernameParam)
      } else if (targetId) {
        query = query.eq('id', targetId)
      }

      const { data, error } = await query.maybeSingle()

      if (cancelled) return

      if (error) {
        console.error(
          'PhoneProfile: failed to load profile:',
          error,
        )

        applyFallback()
        setLoading(false)
        return
      }

      if (data) {
        applyProfile(data as ProfileRow)
        setProfileId((data as ProfileRow).id)
        setUsername(data.username || usernameParam || '')
      } else {
        applyFallback()
      }

      setLoading(false)
    }

    loadProfile()

    const channel = supabase
      .channel(`phone-profile-${usernameParam ? usernameParam : user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
          filter: usernameParam ? `username=eq.${usernameParam}` : `id=eq.${user.id}`,
        },
        (payload) => {
          if (cancelled) return

          const row = payload.new as ProfileRow

          if (!row) return

          applyProfile(row)
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user?.id, user?.email, storeProfile, usernameParam])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function loadCounts() {
      try {
        const targetId = profileTargetId || (async () => {
          if (!usernameParam) return user.id
          const { data } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('username', usernameParam)
            .maybeSingle()
          return data?.id || user.id
        })()

        const resolvedTargetId = typeof targetId === 'string' ? targetId : await targetId

        const [followersRes, followingRes, postsRes] = await Promise.all([
          supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', resolvedTargetId),
          supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', resolvedTargetId),
          supabase.from('troll_posts').select('id', { count: 'exact', head: true }).eq('user_id', resolvedTargetId),
        ])

        if (!cancelled) {
          setFollowersCount(followersRes.count || 0)
          setFollowingCount(followingRes.count || 0)
          setPostsCount(postsRes.count || 0)
        }
      } catch (err) {
        console.error('PhoneProfile: failed to load counts:', err)
      }
    }

    loadCounts()

    return () => {
      cancelled = true
    }
  }, [profileTargetId, user.id, usernameParam])

  const initials = useMemo(() => {
    const source = displayName.trim()

    if (!source) return 'U'

    const parts = source.split(/\s+/)

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[
        parts.length - 1
      ][0]}`.toUpperCase()
    }

    return source.charAt(0).toUpperCase()
  }, [displayName])

  const xpProgress = xpData.progress

  /*
   * Settings
   */
  const handleSaveProfile = async () => {
    if (!user) return

    const cleanUsername =
      settingsUsername.trim().toLowerCase()

    const cleanFullName = fullName.trim()
    const cleanBio = bio.trim()

    if (!/^[a-zA-Z0-9_]{2,20}$/.test(cleanUsername)) {
      toast.error(
        'Username must be 2–20 characters using letters, numbers, or underscores.',
      )
      return
    }

    if (cleanBio.length > 500) {
      toast.error(
        'Bio must be 500 characters or fewer.',
      )
      return
    }

    setSavingProfile(true)

    try {
      if (
        username.toLowerCase() !== cleanUsername
      ) {
        const { data: existing, error } =
          await supabase
            .from('user_profiles')
            .select('id')
            .eq('username', cleanUsername)
            .neq('id', user.id)
            .maybeSingle()

        if (error) throw error

        if (existing) {
          toast.error(
            'That username is already taken.',
          )
          return
        }
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          username: cleanUsername,
          full_name: cleanFullName || null,
          bio: cleanBio,
          platform: platform || null,
          banner_notifications_enabled:
            bannerNotifications,
          is_minor: isMinor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile(true)

      setUsername(cleanUsername)
      setSettingsUsername(cleanUsername)

      setDisplayName(
        cleanFullName ||
          cleanUsername ||
          'User',
      )

      toast.success('Profile settings saved.')
    } catch (error) {
      console.error(
        '[PhoneProfile] Failed to save profile:',
        error,
      )

      toast.error(
        'Failed to save profile settings.',
      )
    } finally {
      setSavingProfile(false)
    }
  }

  const handleIdUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload JPG, PNG, WebP, or PDF.')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.')
      return
    }

    setIdUploading(true)
    setIdUploadProgress(0)

    try {
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `id-documents/${fileName}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('verification_docs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Simulate progress
      for (let i = 10; i <= 90; i += 10) {
        setIdUploadProgress(i)
        await new Promise(r => setTimeout(r, 50))
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('verification_docs')
        .getPublicUrl(filePath)

      // Update profile with ID verification info
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          id_document_url: urlData.publicUrl,
          id_verification_status: 'pending',
          id_uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Insert into applications table for admin review
      try {
        await supabase.from('applications').insert({
          user_id: user.id,
          type: 'id_verification',
          status: 'pending',
          reason: 'ID verification submitted',
          data: {
            id_document_url: urlData.publicUrl,
            verification_status: 'pending'
          }
        })
      } catch (appErr) {
        console.warn('Failed to insert id_verification application:', appErr)
      }

      setIdUploadProgress(100)
      setIdDocumentUrl(urlData.publicUrl)
      setIdVerificationStatus('pending')

      toast.success('ID uploaded successfully! Your account will be verified by an admin within 24 hours.')
    } catch (err: any) {
      console.error('ID upload error:', err)
      toast.error(err?.message || 'Failed to upload ID. Please try again.')
    } finally {
      setIdUploading(false)
      setIdUploadProgress(0)
      // Reset file input
      const input = document.getElementById('id-verification-upload') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const handleSaveCreatorMemberships =
    async () => {
      if (!user) return

      const normalizedPrice = Math.max(
        10,
        Math.min(
          10000,
          creatorSubscriptionPrice || 100,
        ),
      )

      setCreatorSubscriptionPrice(
        normalizedPrice,
      )

      setSavingSubscription(true)

      try {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            creator_subscription_enabled:
              creatorSubscriptionEnabled,
            creator_subscription_price_coins:
              normalizedPrice,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', user.id)

        if (error) throw error

        await refreshProfile(true)

        toast.success(
          'Creator memberships updated.',
        )
      } catch (error) {
        console.error(
          '[PhoneProfile] Failed to save creator memberships:',
          error,
        )

        toast.error(
          'Failed to update creator memberships.',
        )
      } finally {
        setSavingSubscription(false)
      }
    }

  const handleSaveMaipiksSettings = async () => {
    if (!user) return

    setSavingMaipiksSettings(true)

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          maipiks_story_visibility: maipiksStoryVisibility,
          maipiks_story_duration_hours: maipiksStoryDurationHours,
          maipiks_story_monetization: maipiksStoryMonetization,
          maipiks_story_base_price_coins: maipiksStoryBasePriceCoins,
          maipiks_story_subscriber_discount_mode: maipiksStorySubscriberDiscountMode,
          maipiks_story_paid_access_duration: maipiksStoryPaidAccessDuration,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile(true)

      toast.success('MAI Piks story defaults saved.')
    } catch (error) {
      console.error(
        '[PhoneProfile] Failed to save MAI Piks settings:',
        error,
      )

      toast.error(
        'Failed to save MAI Piks story defaults.',
      )
    } finally {
      setSavingMaipiksSettings(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error(
        'Sign out error:',
        error,
      )
    } finally {
      useAuthStore.getState().logout()
      navigate('/')
    }
  }

  const openSettings = () => {
    setActiveTab('settings')
    setShowSettings(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const closeSettings = () => {
    setShowSettings(false)
    setActiveTab('social')

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const handleTabClick = (tabId: string) => {
    if (tabId === 'settings') {
      openSettings()
      return
    }

    setActiveTab(tabId)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  /*
   * SETTINGS SCREEN
   */
  if (showSettings) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05030B] text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#00BFFF]/10 blur-[100px]" />
          <div className="absolute -right-32 top-40 h-80 w-80 rounded-full bg-[#BF00FF]/10 blur-[110px]" />
        </div>

        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#05030B]/95 px-4 py-3 backdrop-blur-2xl">
          <button
            type="button"
            onClick={closeSettings}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white active:scale-95"
          >
            <ArrowLeft size={28} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
          </button>

          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-[0.18em]">
              Settings
            </h1>

            <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/30">
              Account & Controls
            </p>
          </div>

          <div className="h-10 w-10" />
        </header>

        <main className="relative z-10 space-y-4 px-4 pb-10 pt-4">
          {/* Profile */}
          <section className="overflow-hidden rounded-[24px] border border-[#00BFFF]/20 bg-gradient-to-br from-[#071722] via-[#090712] to-[#17071d] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
                <UserRound
                  size={18}
                  className="text-[#00BFFF]"
                />
              </div>

              <div>
                <h2 className="text-base font-black">
                  Profile
                </h2>

                <p className="text-[9px] text-white/35">
                  Update your public information.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-white/40">
                  Full Name
                </span>

                <input
                  type="text"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  maxLength={80}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#00BFFF]/40"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-white/40">
                  Username
                </span>

                <input
                  type="text"
                  value={settingsUsername}
                  onChange={(event) =>
                    setSettingsUsername(
                      event.target.value.replace(
                        /[^a-zA-Z0-9_]/g,
                        '',
                      ),
                    )
                  }
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="username"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#BF00FF]/40"
                />

                <span className="mt-1.5 block text-[8px] text-white/25">
                  2–20 characters. Letters, numbers,
                  and underscores only.
                </span>
              </label>

              <label className="block">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider text-white/40">
                    Bio
                  </span>

                  <span className="text-[8px] text-white/25">
                    {bio.length}/500
                  </span>
                </div>

                <textarea
                  value={bio}
                  onChange={(event) =>
                    setBio(event.target.value)
                  }
                  maxLength={500}
                  rows={4}
                  placeholder="Tell Mai Troll who you are."
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#00BFFF]/40"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-white/40">
                  Platform You Represent
                </span>

                <select
                  value={platform}
                  onChange={(event) =>
                    setPlatform(event.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0b0812] px-3.5 py-3 text-sm text-white outline-none focus:border-[#BF00FF]/40"
                >
                  {PLATFORM_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="bg-[#0b0812]"
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <PhoneButton
                variant="primary"
                size="lg"
                icon={<Save size={16} />}
                onClick={handleSaveProfile}
                disabled={savingProfile}
                fullWidth
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </PhoneButton>
            </div>
          </section>

          {/* Photos */}
          {profileForUpload(storeProfile) &&
            user && (
              <section className="overflow-hidden rounded-[24px] border border-[#BF00FF]/20 bg-white/[0.025] p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/10">
                    <Image
                      size={18}
                      className="text-[#BF00FF]"
                    />
                  </div>

                  <div>
                    <h2 className="text-base font-black">
                      Profile Photos
                    </h2>

                    <p className="text-[9px] text-white/35">
                      Update your avatar and cover.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-[9px] font-black uppercase tracking-wider text-white/35">
                      Profile Picture
                    </p>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                      <AvatarUpload
                        currentUrl={avatarUrl}
                        onUploadComplete={async () => {
                          await refreshProfile(true)
                        }}
                        size="lg"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[9px] font-black uppercase tracking-wider text-white/35">
                      Cover Photo
                    </p>

                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                      <CoverPhotoUpload
                        ref={coverUploadRef}
                        currentCoverUrl={coverUrl}
                        onUploadComplete={async () => {
                          await refreshProfile(true)
                        }}
                        userId={user.id}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

          {/* Creator Memberships */}
          <section className="rounded-[24px] border border-[#00BFFF]/20 bg-white/[0.025] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
                <CreditCard
                  size={18}
                  className="text-[#00BFFF]"
                />
              </div>

              <div>
                <h2 className="text-base font-black">
                  Creator Memberships
                </h2>

                <p className="text-[9px] text-white/35">
                  Let supporters subscribe to you.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                <div className="min-w-0">
                  <p className="text-xs font-black">
                    Enable memberships
                  </p>

                  <p className="mt-1 text-[8px] leading-4 text-white/30">
                    Supporters can subscribe for
                    recurring Troll Coin access.
                  </p>
                </div>

                <Toggle
                  checked={
                    creatorSubscriptionEnabled
                  }
                  onChange={() =>
                    setCreatorSubscriptionEnabled(
                      (current) => !current,
                    )
                  }
                  label="Enable creator memberships"
                />
              </div>

              <label className="block">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-white/40">
                  Membership Price
                </span>

                <div className="relative">
                  <Coins
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00BFFF]"
                  />

                  <input
                    type="number"
                    min={10}
                    max={10000}
                    value={creatorSubscriptionPrice}
                    onChange={(event) =>
                      setCreatorSubscriptionPrice(
                        Math.max(
                          10,
                          Math.min(
                            10000,
                            Number.parseInt(
                              event.target.value,
                              10,
                            ) || 100,
                          ),
                        ),
                      )
                    }
                    disabled={
                      !creatorSubscriptionEnabled
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-9 pr-3 text-sm text-white outline-none disabled:opacity-40"
                  />
                </div>
              </label>

              <PhoneButton
                variant="secondary"
                size="lg"
                icon={<Save size={16} />}
                onClick={handleSaveCreatorMemberships}
                disabled={savingSubscription}
                fullWidth
              >
                {savingSubscription ? 'Saving...' : 'Save Memberships'}
              </PhoneButton>
            </div>
          </section>

          {/* Preferences */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/10">
                <Settings
                  size={18}
                  className="text-[#BF00FF]"
                />
              </div>

              <div>
                <h2 className="text-base font-black">
                  Preferences
                </h2>

                <p className="text-[9px] text-white/35">
                  Control your Mai Troll experience.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                <div className="min-w-0">
                  <p className="text-xs font-black">
                    Global Pod Notifications
                  </p>

                  <p className="mt-1 text-[8px] leading-4 text-white/30">
                    Receive a banner when a Pod goes
                    live.
                  </p>
                </div>

                <Toggle
                  checked={bannerNotifications}
                  onChange={() =>
                    setBannerNotifications(
                      (current) => !current,
                    )
                  }
                  label="Global Pod notifications"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                <div className="mb-3 flex items-center gap-3">
                  <BatteryCharging
                    size={17}
                    className="text-[#00BFFF]"
                  />

                  <div>
                    <p className="text-xs font-black">
                      Battery Saver
                    </p>

                    <p className="text-[8px] text-white/25">
                      Reduce mobile resource usage.
                    </p>
                  </div>
                </div>

                <BatterySaverToggle />
              </div>
            </div>
          </section>

          {/* MAI Piks Story Defaults */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
                <Image
                  size={18}
                  className="text-[#00BFFF]"
                />
              </div>

              <div>
                <h2 className="text-base font-black">
                  MAI Piks Story Defaults
                </h2>

                <p className="text-[9px] text-white/35">
                  Configure default settings for your stories.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-white/40">
                  Story Visibility
                </span>
                <select
                  value={maipiksStoryVisibility}
                  onChange={(event) => setMaipiksStoryVisibility(event.target.value as 'everyone' | 'followers' | 'private')}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white outline-none focus:border-[#00BFFF]/40"
                >
                  <option value="everyone" className="bg-[#0b0812]">Everyone</option>
                  <option value="followers" className="bg-[#0b0812]">Followers Only</option>
                  <option value="private" className="bg-[#0b0812]">Subscribers Only</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-white/40">
                  Story Duration
                </span>
                <select
                  value={maipiksStoryDurationHours}
                  onChange={(event) => setMaipiksStoryDurationHours(Number(event.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white outline-none focus:border-[#00BFFF]/40"
                >
                  <option value={1} className="bg-[#0b0812]">1 hour</option>
                  <option value={6} className="bg-[#0b0812]">6 hours</option>
                  <option value={12} className="bg-[#0b0812]">12 hours</option>
                  <option value={24} className="bg-[#0b0812]">24 hours</option>
                  <option value={48} className="bg-[#0b0812]">48 hours</option>
                  <option value={168} className="bg-[#0b0812]">7 days</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-white/40">
                  Story Access
                </span>
                <select
                  value={maipiksStoryMonetization}
                  onChange={(event) => setMaipiksStoryMonetization(event.target.value as 'free' | 'paid' | 'subscribers_only' | 'free_for_subscribers')}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white outline-none focus:border-[#00BFFF]/40"
                >
                  <option value="free" className="bg-[#0b0812]">Everyone can view</option>
                  <option value="paid" className="bg-[#0b0812]">Paid access</option>
                  <option value="subscribers_only" className="bg-[#0b0812]">Subscribers only</option>
                  <option value="free_for_subscribers" className="bg-[#0b0812]">Free for subscribers</option>
                </select>
              </label>

              {(maipiksStoryMonetization === 'paid' || maipiksStoryMonetization === 'free_for_subscribers') && (
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-white/40">
                      Base Price (Troll Coins)
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={1000000}
                      step={1}
                      value={maipiksStoryBasePriceCoins}
                      onChange={(event) => setMaipiksStoryBasePriceCoins(Number(event.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white outline-none focus:border-[#00BFFF]/40"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-white/40">
                      Subscriber Discount
                    </span>
                    <select
                      value={maipiksStorySubscriberDiscountMode}
                      onChange={(event) => setMaipiksStorySubscriberDiscountMode(event.target.value as 'platform' | 'none')}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white outline-none focus:border-[#00BFFF]/40"
                    >
                      <option value="platform" className="bg-[#0b0812]">Tier rate</option>
                      <option value="none" className="bg-[#0b0812]">No discount</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-white/40">
                      Buyer Access Duration
                    </span>
                    <select
                      value={maipiksStoryPaidAccessDuration}
                      onChange={(event) => setMaipiksStoryPaidAccessDuration(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white outline-none focus:border-[#00BFFF]/40"
                    >
                      <option value="until_story_expiry" className="bg-[#0b0812]">Until story expires</option>
                      <option value="1h" className="bg-[#0b0812]">1 hour</option>
                      <option value="6h" className="bg-[#0b0812]">6 hours</option>
                      <option value="24h" className="bg-[#0b0812]">24 hours</option>
                      <option value="7d" className="bg-[#0b0812]">7 days</option>
                      <option value="permanent" className="bg-[#0b0812]">Permanent</option>
                    </select>
                  </label>
                </div>
              )}

              <PhoneButton
                variant="primary"
                size="lg"
                icon={<Save size={16} />}
                onClick={handleSaveMaipiksSettings}
                disabled={savingMaipiksSettings}
                fullWidth
              >
                {savingMaipiksSettings ? 'Saving...' : 'Save Story Defaults'}
              </PhoneButton>
            </div>
          </section>

          {/* Identity & Gender */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#EC4899]/20 bg-[#EC4899]/10">
                <UserPlus size={18} className="text-[#EC4899]" />
              </div>

              <div>
                <h2 className="text-base font-black">
                  Identity & Gender
                </h2>

                <p className="text-[9px] text-white/35">
                  Manage your gender identity, ID verification, and badge display.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-white/40">
                  Gender Identity
                </span>
                <select
                  value={gender}
                  onChange={(event) => setGender(event.target.value as 'male' | 'female' | 'nonbinary' | '')}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white outline-none focus:border-[#EC4899]/40"
                >
                  <option value="" className="bg-[#0b0812]">Not specified</option>
                  <option value="male" className="bg-[#0b0812]">Male ♂</option>
                  <option value="female" className="bg-[#0b0812]">Female ♀</option>
                  <option value="nonbinary" className="bg-[#0b0812]">Non-Binary ⚧</option>
                </select>
              </label>

              {/* ID Verification */}
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className={cn(
                      idVerificationStatus === 'approved' && 'text-green-400',
                      idVerificationStatus === 'pending' && 'text-yellow-400 animate-pulse',
                      idVerificationStatus === 'rejected' && 'text-red-400',
                      idVerificationStatus === 'not_submitted' && 'text-zinc-500'
                    )} />
                    <div>
                      <p className="text-xs font-black text-white">ID Verification</p>
                      <p className="text-[8px] text-zinc-400">
                        Required for cashout and full platform access
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full',
                    idVerificationStatus === 'approved' && 'text-green-400 bg-green-500/10 border border-green-500/20',
                    idVerificationStatus === 'pending' && 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20',
                    idVerificationStatus === 'rejected' && 'text-red-400 bg-red-500/10 border border-red-500/20',
                    idVerificationStatus === 'not_submitted' && 'text-zinc-500 bg-zinc-500/10 border border-zinc-500/20'
                  )}>
                    {idVerificationStatus === 'approved' && 'Verified'}
                    {idVerificationStatus === 'pending' && 'Pending Review'}
                    {idVerificationStatus === 'rejected' && 'Rejected - Re-upload Required'}
                    {idVerificationStatus === 'not_submitted' && 'Not Submitted'}
                  </span>
                </div>

                {idDocumentUrl && (
                  <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <FileText size={20} className="text-cyan-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white truncate">Government ID Document</p>
                      <p className="text-[8px] text-zinc-400">Uploaded and ready for review</p>
                    </div>
                    <PhoneButton
                      variant="ghost"
                      size="sm"
                      icon={<Eye size={14} />}
                      onClick={() => window.open(idDocumentUrl, '_blank')}
                    >
                      View
                    </PhoneButton>
                  </div>
                )}

{(idVerificationStatus === 'rejected' || idVerificationStatus === 'not_submitted' || idVerificationStatus === 'pending') && (
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleIdUpload}
                        disabled={idUploading}
                        className="hidden"
                        id="id-verification-upload"
                      />
                      <label
                        htmlFor="id-verification-upload"
                        className={cn(
                          'flex items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed',
                          'bg-white/[0.02] px-4 py-4 text-sm font-black text-white/70 transition-all',
                          'hover:bg-white/[0.05] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                          idVerificationStatus === 'rejected' && 'border-red-500/50 bg-red-500/5',
                          idVerificationStatus !== 'rejected' && 'border-cyan-500/50 bg-cyan-500/5'
                        )}
                      >
                        <Upload size={18} className={cn(
                          idVerificationStatus === 'rejected' && 'text-red-400',
                          idVerificationStatus !== 'rejected' && 'text-cyan-400'
                        )} />
                        <span className={cn(
                          idVerificationStatus === 'rejected' && 'text-red-300',
                          idVerificationStatus !== 'rejected' && 'text-cyan-300'
                        )}>
                          {idUploading ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-transparent mr-1" />
                              Uploading... {idUploadProgress}%
                            </>
                          ) : idVerificationStatus === 'rejected' ? (
                            'Re-upload ID (Previous was rejected)'
                          ) : idVerificationStatus === 'pending' ? (
                            'Replace ID (Under review)'
                          ) : (
                            'Upload Government ID'
                          )}
                        </span>
                      </label>
                      {idVerificationStatus === 'rejected' && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                          <div className="flex items-center gap-2 text-red-300">
                            <AlertCircle size={14} />
                            <p className="text-xs font-black">Your ID was rejected. Please upload a clear, valid government-issued ID.</p>
                          </div>
                          <p className="mt-1 text-[9px] text-red-400/70">
                            Common reasons: blurry image, expired document, mismatched info, or unsupported file type.
                          </p>
                        </div>
                      )}
                      {idVerificationStatus === 'pending' && (
                        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                          <div className="flex items-center gap-2 text-yellow-300">
                            <AlertCircle size={14} />
                            <p className="text-xs font-black">Your ID is under review. This typically takes 24 hours.</p>
                          </div>
                        </div>
                      )}
                      <p className="text-[8px] text-zinc-500 text-center">
                        Accepted: JPG, PNG, PDF (max 10MB). Your ID is securely stored and only used for verification.
                      </p>
                    </div>
                  )}
                </div>

              <PhoneButton
                variant="primary"
                size="lg"
                icon={<Save size={16} />}
                onClick={handleSaveProfile}
                disabled={savingProfile}
                fullWidth
              >
                {savingProfile ? 'Saving...' : 'Save Identity'}
              </PhoneButton>
            </div>
          </section>

          {/* Family */}
          {storeProfile && (
            <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4">
              <FamilyMinorSettings
                profile={storeProfile as any}
                onUpdate={() =>
                  refreshProfile(true)
                }
              />
            </section>
          )}

          {/* Inventory */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/10">
                <Boxes
                  size={18}
                  className="text-[#BF00FF]"
                />
              </div>

              <div>
                <h2 className="text-base font-black">
                  Inventory
                </h2>

                <p className="text-[9px] text-white/30">
                  Your Mai Troll items.
                </p>
              </div>
            </div>

            <UserInventory embedded />
          </section>

          {/* Security */}
          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
                <KeyRound
                  size={18}
                  className="text-emerald-400"
                />
              </div>

              <div>
                <h2 className="text-base font-black">
                  Security
                </h2>

                <p className="text-[9px] text-white/30">
                  Account security controls.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <p className="text-xs font-black">
                Password Reset
              </p>

              <p className="mt-1 text-[9px] leading-4 text-white/30">
                Use the Forgot Password link on the
                sign-in page to reset your password
                by email.
              </p>
            </div>

            <PhoneButton
              variant="outline"
              size="md"
              icon={<Ban size={17} />}
              onClick={() => navigate('/blocked-users')}
              className="justify-start gap-3 border-amber-400/15 bg-amber-400/[0.03] text-left"
            >
              <div className="flex flex-col">
                <p className="text-xs font-black">Blocked Users</p>
                <p className="mt-1 text-[8px] text-white/25">Review people you have blocked.</p>
              </div>
              <ChevronRight size={16} className="text-amber-400/50" />
            </PhoneButton>
          </section>

          {/* Danger */}
          <section className="rounded-[24px] border border-red-500/25 bg-red-500/[0.025] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
                <Trash2
                  size={18}
                  className="text-red-400"
                />
              </div>

              <div>
                <h2 className="text-base font-black text-red-400">
                  Danger Zone
                </h2>

                <p className="text-[9px] text-white/30">
                  Permanent account actions.
                </p>
              </div>
            </div>

            <PhoneButton
              variant="danger"
              size="lg"
              icon={<Trash2 size={16} />}
              onClick={() => navigate('/profile/delete')}
              fullWidth
            >
              Delete Account
            </PhoneButton>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-3">
            <PhoneButton
              variant="outline"
              size="lg"
              icon={<LogOut size={17} />}
              onClick={handleSignOut}
              fullWidth
            >
              Sign Out
            </PhoneButton>
          </section>
        </main>
      </div>
    )
  }

  /*
   * PROFILE SCREEN
   *
   * This intentionally follows the WEB profile structure:
   *
   * Cover
   * Avatar
   * Identity
   * Role / Level / Coins
   * XP
   * Stats
   * Profile navigation tabs
   *
   * NO QUICK ACCESS.
   */
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#03050B] text-white">
      {/* Neon atmosphere */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-80 w-80 rounded-full bg-[#00BFFF]/10 blur-[110px]" />

        <div className="absolute -right-40 top-80 h-96 w-96 rounded-full bg-[#BF00FF]/10 blur-[120px]" />

        <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#00BFFF]/5 blur-[120px]" />
      </div>

      {/* Mobile header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#03050B]/90 px-4 py-3 backdrop-blur-2xl">
        <PhoneButton
          variant="icon-only"
          size="lg"
          icon={<ArrowLeft size={28} />}
          onClick={() => navigate(-1)}
          aria-label="Go back"
        />

        <div className="text-center">
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">
            Profile
          </h1>

          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/30">
            Mai Troll
          </p>
        </div>

        <PhoneButton
          variant="icon-only"
          size="lg"
          icon={<Settings size={28} />}
          onClick={openSettings}
          aria-label="Settings"
        />
      </header>

      <main className="relative z-10 pb-8">
        {/* =========================================================
            WEB-STYLE PROFILE HERO
        ========================================================= */}
        <section className="mx-3 mt-3 overflow-hidden rounded-[24px] border border-white/10 bg-[#050914] shadow-[0_0_45px_rgba(0,0,0,0.45)]">
          {/* Cover */}
          <div className="relative h-[190px] overflow-hidden">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#06131d] via-[#14051e] to-[#02040b]">
                <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#BF00FF]/25 blur-[80px]" />

                <div className="absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-[#00BFFF]/20 blur-[75px]" />
              </div>
            )}

            {/* Cover darkening */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/20 to-[#050914]" />

            {/* Cover title treatment */}
            <div className="absolute left-4 top-4">
              <div className="rounded-full border border-white/20 bg-black/35 px-3 py-1 backdrop-blur-md">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/80">
                  MAI TROLL PROFILE
                </span>
              </div>
            </div>

            {/* Change cover */}
            {user && (
              <PhoneButton
                variant="secondary"
                size="sm"
                onClick={() => openSettings()}
                className="rounded-full border-white/20 bg-black/45 px-3 py-2 text-[8px]"
              >
                Change Cover
              </PhoneButton>
            )}
          </div>

          {/* Identity area */}
          <div className="relative px-4 pb-4">
            {/* 🔴 Scheduled Founder Broadcast banner (web parity) */}
            <div className="pt-3">
              <FounderScheduledBroadcastBanner
                userId={profileId}
                variant="phone"
                onClick={() => navigate('/live')}
              />
            </div>

            {/* Avatar */}
            <div className="-mt-14 flex items-end justify-between">
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-28 w-28 rounded-full border-[3px] border-[#050914] object-cover shadow-[0_0_0_2px_rgba(0,191,255,0.65),0_0_30px_rgba(0,191,255,0.25)]"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border-[3px] border-[#050914] bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] text-3xl font-black shadow-[0_0_0_2px_rgba(0,191,255,0.65),0_0_30px_rgba(0,191,255,0.25)]">
                    {initials}
                  </div>
                )}

                <PhoneButton
                  variant="icon-only"
                  size="sm"
                  icon={<Image size={14} />}
                  onClick={openSettings}
                  aria-label="Edit profile photo"
                  className="bg-[#101523] border-[#050914] text-[#00BFFF]"
                />
              </div>

              <div className="mb-1 flex gap-2">
                <PhoneButton
                variant="primary"
                size="sm"
                onClick={openSettings}
              >
                Edit Profile
              </PhoneButton>
              </div>
            </div>

            {/* Name */}
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight">
                  {displayName}
                </h2>

                <span className="rounded-full border border-[#00BFFF]/30 bg-[#00BFFF]/10 px-2 py-1 text-[8px] font-black text-[#00BFFF]">
                  ✓ VERIFIED
                </span>

                {/* Badges next to username */}
                {profileId && (
                  <PhoneBadgeDisplay userId={profileId} maxVisible={4} size="sm" />
                )}
              </div>

              {username && (
                <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-[#00BFFF]/75">
                  <span className={isProfileFounder ? 'founder-username' : undefined}>
                    @{username}
                  </span>
                  <FounderBadge userId={profileId} compact />
                </p>
              )}

              {bio && (
                <p className="mt-2 text-[11px] leading-5 text-white/45">
                  {bio}
                </p>
              )}
            </div>

            {/* Level System */}
            <div className="mt-4">
              <div className="overflow-hidden rounded-xl border border-cyan-400/20 bg-gradient-to-br from-[#071020] via-[#090712] to-[#17071d] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-black text-white">
                      <Star size={14} className="text-yellow-300" />
                      Level System
                    </p>
                  </div>
                  <Crown size={20} className="text-yellow-300 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]" />
                </div>
                <div className="mt-2 rounded-lg border border-fuchsia-400/30 bg-gradient-to-r from-amber-500 via-fuchsia-500 to-purple-600 px-2 py-1.5 text-center text-[10px] font-black text-white">
                  {getLevelName(level)}
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-300">
                  <span>XP Progress</span>
                  <span>{xpProgress.toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-pink-500 via-yellow-300 to-cyan-300"
                    style={{ width: `${Math.min(xpProgress, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[9px] text-slate-400">
                  <span className="font-black text-fuchsia-300">
                    {xpToNextLevel.toLocaleString()} XP
                  </span>{' '}
                  to next level
                  <span className="float-right font-black text-cyan-300">
                    +{Math.ceil(xpToNextLevel * 0.1).toLocaleString()} bonus coins
                  </span>
                </p>
              </div>
            </div>

            {/* City Status */}
            {cityStatusLoading ? (
              <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-3 text-[10px] font-bold text-cyan-100/60">
                Loading city status...
              </div>
            ) : cityStatus ? (
              <div className="mt-3 rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/[0.08] to-purple-500/[0.08] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.16em] text-cyan-200/60">City Status</p>
                    <p className="mt-1 text-lg font-black text-white">{cityStatus.display_name}</p>
                  </div>
                  <p className="text-sm font-black text-cyan-200">{cityStatus.xp_total.toLocaleString()} XP</p>
                </div>
                {cityStatus.next_display_name && cityStatus.next_min_level ? (
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-[9px] font-bold text-slate-400">
                      <span>Next: {cityStatus.next_display_name}</span>
                      <span>Level {cityStatus.next_min_level}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-cyan-300 to-purple-400"
                        style={{ width: `${Math.min(100, Math.max(0, (cityStatus.level / cityStatus.next_min_level) * 100))}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[9px] font-bold text-emerald-300">Highest city status reached.</p>
                )}
              </div>
            ) : null}

            {/* Coins */}
            {isViewingOwnProfile && (
              <div className="mt-3">
                <CityIdentityPanel />
              </div>
            )}
            {!isViewingOwnProfile && profileTargetId && (
              <div className="mt-3">
                <AccessPurchasePanel recipientId={profileTargetId} />
              </div>
            )}

            <div className="mt-3 flex items-center justify-between rounded-xl border border-[#00BFFF]/20 bg-gradient-to-r from-[#00BFFF]/[0.06] to-[#BF00FF]/[0.05] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00BFFF]/25 bg-[#00BFFF]/10">
                  <Coins
                    size={19}
                    className="text-[#00BFFF]"
                  />
                </div>

                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/35">
                    Troll Coin Balance
                  </p>

                  <p className="mt-0.5 text-lg font-black">
                    {loading
                      ? '...'
                      : coins.toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate('/store')
                }
                className="rounded-lg border border-[#00BFFF]/20 bg-[#00BFFF]/10 px-3 py-2 text-[8px] font-black uppercase tracking-wider text-[#00BFFF]"
              >
                Buy Coins
              </button>
            </div>

            {/* Profile stats */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center">
                <p className="text-lg font-black">
                  {followersCount}
                </p>

                <p className="mt-1 text-[7px] font-black uppercase tracking-[0.15em] text-white/30">
                  Followers
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(isViewingOwnProfile ? '/following' : `/following/${usernameParam}`)}
                className="rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/[0.04] p-3 text-center active:scale-95 transition"
              >
                <p className="text-lg font-black text-[#00BFFF]">
                  {followingCount}
                </p>

                <p className="mt-1 text-[7px] font-black uppercase tracking-[0.15em] text-[#00BFFF]/60">
                  Following
                </p>
              </button>

              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center">
                <p className="text-lg font-black">
                  {postsCount}
                </p>

                <p className="mt-1 text-[7px] font-black uppercase tracking-[0.15em] text-white/30">
                  Posts
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            PROFILE TABS
        ========================================================= */}
        <section className="mx-3 mt-3 overflow-hidden rounded-[20px] border border-white/10 bg-[#060913]/95">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex min-w-max gap-1 p-2">
              {PROFILE_TABS.map((tab) => {
                const Icon = tab.icon
                const active =
                  activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      handleTabClick(tab.id)
                    }
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-[8px] font-black uppercase tracking-wider transition ${
                      active
                        ? 'border-[#BF00FF]/30 bg-gradient-to-r from-[#00BFFF]/20 to-[#BF00FF]/20 text-white shadow-[0_0_15px_rgba(191,0,255,0.12)]'
                        : 'border-white/5 bg-white/[0.025] text-white/35'
                    }`}
                  >
                    <Icon
                      size={12}
                      className={
                        active
                          ? 'text-[#00BFFF]'
                          : 'text-white/30'
                      }
                    />

                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* =========================================================
            ACTIVE PROFILE AREA
        ========================================================= */}
        <section className="mx-3 mt-3 rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
          {activeTab === 'social' && profileTargetId && (
            <ProfileFeed userId={profileTargetId} />
          )}

          {activeTab === 'social' && !profileTargetId && (
            <div className="text-center py-10 text-gray-500">
              Please sign in to view posts.
            </div>
          )}

          {activeTab === 'maipiks' && profileTargetId && (
            <ProfileMaiPiks userId={profileTargetId} username={username} />
          )}

          {activeTab === 'broadcasts' && profileTargetId && (
            <ProfileBroadcasts userId={profileTargetId} />
          )}

          {activeTab === 'marketplace' && profileTargetId && (
            <ProfileMarketplace userId={profileTargetId} />
          )}

          {activeTab === 'auctions' && profileTargetId && (
            <ProfileWatchlist userId={profileTargetId} />
          )}

          {activeTab === 'court' && profileTargetId && (
            <ProfileCourt userId={profileTargetId} />
          )}

          {activeTab === 'agency' && profileTargetId && (
            <ProfileAgency userId={profileTargetId} />
          )}

          {activeTab === 'church' && profileTargetId && (
            <ProfileChurch userId={profileTargetId} />
          )}

          {activeTab === 'inventory' && (
            <UserInventory embedded />
          )}

          {activeTab === 'purchases' && profileTargetId && (
            <ProfilePurchases userId={profileTargetId} />
          )}

          {activeTab === 'subscriptions' && (
            <div className="text-center py-10 text-gray-500">
              <Crown className="w-8 h-8 mx-auto mb-3 text-purple-400" />
              <h3 className="text-sm font-black">Subscriptions</h3>
              <p className="mt-1 text-[9px] text-white/30">
                Subscription features coming soon.
              </p>
            </div>
          )}

          {activeTab === 'maisub' && isViewingOwnProfile && (
            <MaiSubPanel />
          )}

          {activeTab === 'badges' && profileTargetId && (
            <PhoneBadgeList userId={profileTargetId} />
          )}

          {activeTab === 'keys' && user?.id && (
            <div className="text-center py-10 text-gray-500">
              <KeyRound className="w-8 h-8 mx-auto mb-3 text-cyan-400" />
              <h3 className="text-sm font-black">Keys</h3>
              <p className="mt-1 text-[9px] text-white/30">
                Key management coming soon.
              </p>
            </div>
          )}

          {activeTab !== 'social' && activeTab !== 'maipiks' && activeTab !== 'broadcasts' && activeTab !== 'marketplace' && activeTab !== 'auctions' && activeTab !== 'court' && activeTab !== 'agency' && activeTab !== 'church' && activeTab !== 'inventory' && activeTab !== 'purchases' && activeTab !== 'subscriptions' && activeTab !== 'badges' && activeTab !== 'keys' && activeTab !== 'settings' && (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
                {(() => {
                  const current =
                    PROFILE_TABS.find(
                      (tab) =>
                        tab.id === activeTab,
                    )

                  const Icon =
                    current?.icon || UserRound

                  return (
                    <Icon
                      size={20}
                      className="text-[#00BFFF]"
                    />
                  )
                })()}
              </div>

              <h3 className="mt-3 text-sm font-black">
                {
                  PROFILE_TABS.find(
                    (tab) =>
                      tab.id === activeTab,
                  )?.label
                }
              </h3>

              <p className="mx-auto mt-1 max-w-xs text-[9px] leading-4 text-white/30">
                This profile section is connected to
                the web-style profile navigation.
              </p>
            </div>
          )}
        </section>

        {/* Account */}
        <section className="mx-3 mt-4 rounded-[20px] border border-white/10 bg-white/[0.025] p-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.04] py-3.5 text-xs font-black uppercase tracking-wider text-red-400 transition active:scale-[0.98]"
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </section>

        <p className="pb-4 pt-5 text-center text-[7px] font-bold uppercase tracking-[0.25em] text-white/15">
          Mai Troll • Profile
        </p>
      </main>
    </div>
  )
}

function profileForUpload(profile: unknown) {
  return Boolean(profile)
}
