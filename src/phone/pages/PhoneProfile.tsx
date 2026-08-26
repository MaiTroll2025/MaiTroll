import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import LevelStatusCard from '../../components/home/LevelStatusCard'

import {
  ArrowLeft,
  Award,
  Ban,
  BatteryCharging,
  BookOpen,
  Boxes,
  ChevronRight,
  Coins,
  CreditCard,
  Crown,
  Gavel,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  Music,
  Save,
  Scale,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Trophy,
  UserRound,
  Video,
  Wallet,
} from 'lucide-react'

import { toast } from 'sonner'

import AvatarUpload from '../../components/profile/AvatarUpload'
import CoverPhotoUpload, {
  CoverPhotoUploadRef,
} from '../../components/profile/CoverPhotoUpload'

import FamilyMinorSettings from '../../components/profile/FamilyMinorSettings'
import BatterySaverToggle from '../../components/BatterySaverToggle'
import UserInventory from '../../pages/UserInventory'
import ProfileFeed from '../../components/profile/ProfileFeed'
import ProfileBroadcasts from '../../components/profile/ProfileBroadcasts'
import ProfileMarketplace from '../../components/profile/ProfileMarketplace'
import ProfileCourt from '../../components/profile/ProfileCourt'
import ProfileAgency from '../../components/profile/ProfileAgency'
import ProfileChurch from '../../components/profile/ProfileChurch'
import ProfilePurchases from '../../components/profile/ProfilePurchases'
import ProfileWatchlist from '../../components/profile/ProfileWatchlist'

type ProfileRow = {
  id: string
  troll_coins?: number | null
  level?: number | null
  xp?: number | null
  xp_to_next_level?: number | null
  total_xp?: number | null
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
  { id: 'broadcasts', label: 'Broadcasts', icon: Video },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  { id: 'auctions', label: 'Auctions', icon: Gavel },
  { id: 'court', label: 'Court', icon: Scale },
  { id: 'agency', label: 'Agency', icon: Shield },
  { id: 'church', label: 'Church', icon: BookOpen },
  { id: 'subscriptions', label: 'Subscriptions', icon: Crown },
  { id: 'badges', label: 'Badges', icon: Award },
  { id: 'keys', label: 'Keys', icon: KeyRound },
  { id: 'inventory', label: 'Inventory & Perks', icon: Boxes },
  { id: 'purchases', label: 'Purchase History', icon: Wallet },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'albums', label: 'Albums', icon: ImageIcon },
  { id: 'tracks', label: 'Tracks', icon: Store },
]

export default function PhoneProfile() {
  const navigate = useNavigate()

  const user = useAuthStore((state) => state.user)
  const storeProfile = useAuthStore((state) => state.profile)
  const refreshProfile = useAuthStore((state) => state.refreshProfile)

  const coverUploadRef = useRef<CoverPhotoUploadRef>(null)

  const [loading, setLoading] = useState(true)

  const [coins, setCoins] = useState(0)

  const [displayName, setDisplayName] = useState('Guest')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [role, setRole] = useState('')

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

  /*
   * Creator memberships
   */
  const [creatorSubscriptionEnabled, setCreatorSubscriptionEnabled] =
    useState(false)

  const [creatorSubscriptionPrice, setCreatorSubscriptionPrice] =
    useState(100)

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingSubscription, setSavingSubscription] = useState(false)

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

      setCreatorSubscriptionEnabled(
        fallback?.creator_subscription_enabled ?? false,
      )

      setCreatorSubscriptionPrice(
        Number(fallback?.creator_subscription_price_coins) || 100,
      )
    }

    const loadProfile = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          troll_coins,
          level,
          xp,
          xp_to_next_level,
          total_xp,
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
          creator_subscription_price_coins
        `)
        .eq('id', user.id)
        .maybeSingle()

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
      } else {
        applyFallback()
      }

      setLoading(false)
    }

    loadProfile()

    const channel = supabase
      .channel(`phone-profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`,
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
  }, [user?.id, user?.email, storeProfile])

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
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] active:scale-95"
          >
            <ArrowLeft size={19} />
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

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] py-3.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
              >
                <Save size={16} />

                {savingProfile
                  ? 'Saving...'
                  : 'Save Profile'}
              </button>
            </div>
          </section>

          {/* Photos */}
          {profileForUpload(storeProfile) &&
            user && (
              <section className="overflow-hidden rounded-[24px] border border-[#BF00FF]/20 bg-white/[0.025] p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/10">
                    <ImageIcon
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

              <button
                type="button"
                onClick={
                  handleSaveCreatorMemberships
                }
                disabled={savingSubscription}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#BF00FF]/25 bg-[#BF00FF]/10 py-3.5 text-xs font-black uppercase tracking-wider text-[#BF00FF] disabled:opacity-50"
              >
                <Save size={16} />

                {savingSubscription
                  ? 'Saving...'
                  : 'Save Memberships'}
              </button>
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

            <button
              type="button"
              onClick={() =>
                navigate('/blocked-users')
              }
              className="mt-3 flex w-full items-center justify-between rounded-2xl border border-amber-400/15 bg-amber-400/[0.03] p-3.5 text-left"
            >
              <div className="flex items-center gap-3">
                <Ban
                  size={17}
                  className="text-amber-400"
                />

                <div>
                  <p className="text-xs font-black">
                    Blocked Users
                  </p>

                  <p className="mt-1 text-[8px] text-white/25">
                    Review people you have blocked.
                  </p>
                </div>
              </div>

              <ChevronRight
                size={16}
                className="text-amber-400/50"
              />
            </button>
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

            <button
              type="button"
              onClick={() =>
                navigate('/profile/delete')
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-xs font-black uppercase tracking-wider text-white active:scale-[0.98]"
            >
              <Trash2 size={16} />
              Delete Account
            </button>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.04] py-3.5 text-xs font-black uppercase tracking-wider text-red-400 active:scale-[0.98]"
            >
              <LogOut size={17} />
              Sign Out
            </button>
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
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] transition active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft size={19} />
        </button>

        <div className="text-center">
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">
            Profile
          </h1>

          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/30">
            Mai Troll
          </p>
        </div>

        <button
          type="button"
          onClick={openSettings}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#BF00FF]/25 bg-[#BF00FF]/5 text-[#BF00FF] transition active:scale-95"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
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
              <button
                type="button"
                onClick={() =>
                  openSettings()
                }
                className="absolute bottom-4 right-4 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-[8px] font-black text-white backdrop-blur-md active:scale-95"
              >
                Change Cover
              </button>
            )}
          </div>

          {/* Identity area */}
          <div className="relative px-4 pb-4">
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

                <button
                  type="button"
                  onClick={openSettings}
                  className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#050914] bg-[#101523] text-[#00BFFF] shadow-lg"
                  aria-label="Edit profile photo"
                >
                  <ImageIcon size={14} />
                </button>
              </div>

              <div className="mb-1 flex gap-2">
                <button
                  type="button"
                  onClick={openSettings}
                  className="rounded-xl bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] px-3 py-2 text-[9px] font-black uppercase tracking-wider text-white shadow-[0_0_18px_rgba(191,0,255,0.18)]"
                >
                  Edit Profile
                </button>
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
              </div>

              {username && (
                <p className="mt-1 text-[11px] font-bold text-[#00BFFF]/75">
                  @{username}
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
              <LevelStatusCard />
            </div>

            {/* Coins */}
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
                  0
                </p>

                <p className="mt-1 text-[7px] font-black uppercase tracking-[0.15em] text-white/30">
                  Followers
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/following')}
                className="rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/[0.04] p-3 text-center active:scale-95 transition"
              >
                <p className="text-lg font-black text-[#00BFFF]">
                  0
                </p>

                <p className="mt-1 text-[7px] font-black uppercase tracking-[0.15em] text-[#00BFFF]/60">
                  Following
                </p>
              </button>

              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center">
                <p className="text-lg font-black">
                  0
                </p>

                <p className="mt-1 text-[7px] font-black uppercase tracking-[0.15em] text-white/30">
                  Actions
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
          {activeTab === 'social' && user?.id && (
            <ProfileFeed userId={user.id} />
          )}

          {activeTab === 'social' && !user?.id && (
            <div className="text-center py-10 text-gray-500">
              Please sign in to view posts.
            </div>
          )}

          {activeTab === 'broadcasts' && user?.id && (
            <ProfileBroadcasts userId={user.id} />
          )}

          {activeTab === 'marketplace' && user?.id && (
            <ProfileMarketplace userId={user.id} />
          )}

          {activeTab === 'auctions' && user?.id && (
            <ProfileWatchlist userId={user.id} />
          )}

          {activeTab === 'court' && user?.id && (
            <ProfileCourt userId={user.id} />
          )}

          {activeTab === 'agency' && user?.id && (
            <ProfileAgency userId={user.id} />
          )}

          {activeTab === 'church' && user?.id && (
            <ProfileChurch userId={user.id} />
          )}

          {activeTab === 'inventory' && (
            <UserInventory embedded />
          )}

          {activeTab === 'purchases' && user?.id && (
            <ProfilePurchases userId={user.id} />
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

          {activeTab === 'badges' && (
            <div className="text-center py-10 text-gray-500">
              <Award className="w-8 h-8 mx-auto mb-3 text-yellow-400" />
              <h3 className="text-sm font-black">Badges</h3>
              <p className="mt-1 text-[9px] text-white/30">
                Badge collection coming soon.
              </p>
            </div>
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

          {activeTab === 'music' && (
            <div className="text-center py-10 text-gray-500">
              <Music className="w-8 h-8 mx-auto mb-3 text-pink-400" />
              <h3 className="text-sm font-black">Music</h3>
              <p className="mt-1 text-[9px] text-white/30">
                Music library coming soon.
              </p>
            </div>
          )}

          {activeTab === 'albums' && (
            <div className="text-center py-10 text-gray-500">
              <ImageIcon className="w-8 h-8 mx-auto mb-3 text-purple-400" />
              <h3 className="text-sm font-black">Albums</h3>
              <p className="mt-1 text-[9px] text-white/30">
                Album collection coming soon.
              </p>
            </div>
          )}

          {activeTab === 'tracks' && (
            <div className="text-center py-10 text-gray-500">
              <Store className="w-8 h-8 mx-auto mb-3 text-green-400" />
              <h3 className="text-sm font-black">Tracks</h3>
              <p className="mt-1 text-[9px] text-white/30">
                Track list coming soon.
              </p>
            </div>
          )}

          {activeTab !== 'social' && activeTab !== 'broadcasts' && activeTab !== 'marketplace' && activeTab !== 'auctions' && activeTab !== 'court' && activeTab !== 'agency' && activeTab !== 'church' && activeTab !== 'inventory' && activeTab !== 'purchases' && activeTab !== 'subscriptions' && activeTab !== 'badges' && activeTab !== 'keys' && activeTab !== 'music' && activeTab !== 'albums' && activeTab !== 'tracks' && activeTab !== 'settings' && (
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