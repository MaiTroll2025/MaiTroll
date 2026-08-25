import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import {
  getLeagueTier,
  getLevelProgress,
  getXpRequiredForNextLevel,
} from '../../lib/leagueHelpers'

import {
  ArrowLeft,
  Ban,
  BatteryCharging,
  Boxes,
  ChevronRight,
  Coins,
  CreditCard,
  Gavel,
  Gamepad2,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  Save,
  Scale,
  Settings,
  Sparkles,
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

type ProfileRow = {
  id: string
  troll_coins?: number | null
  level?: number | null
  xp?: number | null
  xp_to_next_level?: number | null
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

export default function PhoneProfile() {
  const navigate = useNavigate()

  const user = useAuthStore((state) => state.user)
  const storeProfile = useAuthStore((state) => state.profile)
  const refreshProfile = useAuthStore((state) => state.refreshProfile)

  const coverUploadRef = useRef<CoverPhotoUploadRef>(null)

  const [loading, setLoading] = useState(true)

  const [coins, setCoins] = useState(0)
  const [level, setLevel] = useState(1)
  const [xp, setXp] = useState(0)
  const [xpNext, setXpNext] = useState(0)

  const [displayName, setDisplayName] = useState('Guest')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [tier, setTier] = useState('')

  /*
   * Mobile view state.
   *
   * The settings screen lives INSIDE PhoneProfile.
   */
  const [showSettings, setShowSettings] = useState(false)

  /*
   * Profile settings
   */
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
      const nextLevel = Math.max(1, Number(row.level) || 1)
      const nextXp = Math.max(0, Number(row.xp) || 0)

      const calculatedNextXp =
        getXpRequiredForNextLevel(nextLevel)

      const nextLevelXp =
        Number(row.xp_to_next_level) > 0
          ? Number(row.xp_to_next_level)
          : calculatedNextXp

      setCoins(Math.max(0, Number(row.troll_coins) || 0))
      setLevel(nextLevel)
      setXp(nextXp)
      setXpNext(nextLevelXp)

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
      setTier(row.tier || '')

      /*
       * Settings values
       */
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

      const fallbackLevel =
        Number(fallback?.level) || 1

      const fallbackXp =
        Number(fallback?.xp) || 0

      const fallbackNext =
        Number(fallback?.xp_to_next_level) ||
        getXpRequiredForNextLevel(fallbackLevel)

      setCoins(Number(fallback?.troll_coins) || 0)
      setLevel(fallbackLevel)
      setXp(fallbackXp)
      setXpNext(fallbackNext)

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
      setTier(fallback?.tier || '')

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
  }, [user?.id, storeProfile])

  const league = useMemo(() => {
    return getLeagueTier(level)
  }, [level])

  const progress = useMemo(() => {
    if (xpNext <= 0) return 0

    try {
      const result = getLevelProgress(xp, level)

      return Math.min(
        100,
        Math.max(0, Number(result.progress) || 0),
      )
    } catch {
      return Math.min(
        100,
        Math.max(0, (xp / xpNext) * 100),
      )
    }
  }, [xp, xpNext, level])

  const initials = useMemo(() => {
    const source = displayName.trim()

    if (!source) return 'U'

    const parts = source.split(/\s+/)

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }

    return source.charAt(0).toUpperCase()
  }, [displayName])

  /*
   * Save profile settings
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

  /*
   * Save creator memberships
   */
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
    setShowSettings(true)
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const closeSettings = () => {
    setShowSettings(false)
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  /*
   * Quick access tabs
   */
  const tabs = [
    {
      label: 'Coin Store',
      description: 'Buy Troll Coins',
      path: '/store',
      icon: Coins,
      color: 'blue',
    },
    {
      label: 'Mai Pay',
      description: 'Wallet & payments',
      path: '/wallet',
      icon: Wallet,
      color: 'purple',
    },
    {
      label: 'Mai Piks',
      description: 'Photos & posts',
      path: '/mai-piks',
      icon: ImageIcon,
      color: 'blue',
    },
    {
      label: 'Troll Court',
      description: 'Cases & votes',
      path: '/troll-court',
      icon: Scale,
      color: 'purple',
    },
    {
      label: 'Treelz',
      description: 'Players & comments',
      path: '/treelz',
      icon: Video,
      color: 'blue',
    },
    {
      label: 'Auctions',
      description: 'Live auctions',
      path: '/auctions',
      icon: Gavel,
      color: 'purple',
    },
    {
      label: 'Hytro',
      description: 'Live streams',
      path: '/hytro',
      icon: Gamepad2,
      color: 'blue',
    },
  ]

  /*
   * SETTINGS SCREEN
   */
  if (showSettings) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05030B] text-white">
        {/* Neon background */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#00BFFF]/10 blur-[100px]" />
          <div className="absolute -right-32 top-40 h-80 w-80 rounded-full bg-[#BF00FF]/10 blur-[110px]" />
          <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#00BFFF]/5 blur-[100px]" />
        </div>

        {/* Settings header */}
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#05030B]/95 px-4 py-3 backdrop-blur-2xl">
          <button
            type="button"
            onClick={closeSettings}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white active:scale-95"
            aria-label="Back to profile"
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
              {/* Full Name */}
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

              {/* Username */}
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

              {/* Bio */}
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

              {/* Platform */}
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(0,191,255,0.15)] disabled:opacity-50"
              >
                <Save size={16} />

                {savingProfile
                  ? 'Saving...'
                  : 'Save Profile'}
              </button>
            </div>
          </section>

          {/* Profile Photos */}
          {profileForUpload(storeProfile) && user && (
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

                <span className="mt-1.5 block text-[8px] text-white/25">
                  Troll Coins • 10–10,000
                </span>
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

          {/* Family / Minor */}
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

          {/* Danger Zone */}
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

          {/* Sign Out */}
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

          <p className="pb-3 text-center text-[8px] font-bold uppercase tracking-[0.25em] text-white/15">
            Troll City • Mobile Settings
          </p>
        </main>
      </div>
    )
  }

  /*
   * PROFILE SCREEN
   */
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05030B] text-white">
      {/* Ambient neon background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#00BFFF]/10 blur-[100px]" />
        <div className="absolute -right-32 top-64 h-80 w-80 rounded-full bg-[#BF00FF]/10 blur-[110px]" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#00BFFF]/5 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#05030B]/90 px-4 py-3 backdrop-blur-2xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft size={19} />
        </button>

        <div className="text-center">
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">
            Profile
          </h1>

          <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/30">
            Troll City
          </p>
        </div>

        <button
          type="button"
          onClick={openSettings}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/5 text-[#BF00FF] transition active:scale-95"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </header>

      <main className="relative z-10 space-y-5 px-4 pb-8 pt-4">
        {/* Profile Card */}
        <section className="relative overflow-hidden rounded-[28px] border border-[#00BFFF]/20 bg-gradient-to-br from-[#071722] via-[#090712] to-[#17071d] p-5 shadow-[0_0_40px_rgba(0,191,255,0.05)]">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#BF00FF]/20 blur-[70px]" />

          <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-[#00BFFF]/10 blur-[70px]" />

          <div className="relative flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-16 w-16 rounded-full border-2 border-[#00BFFF]/40 object-cover shadow-[0_0_25px_rgba(0,191,255,0.18)]"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-[#00BFFF]/30 bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] text-lg font-black text-white shadow-[0_0_25px_rgba(0,191,255,0.2)]">
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-white">
                {displayName}
              </p>

              {username && (
                <p className="mt-0.5 truncate text-[11px] font-bold text-white/40">
                  @{username}
                </p>
              )}

              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#00BFFF]/20 bg-[#00BFFF]/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#00BFFF]">
                  Level {level}
                </span>

                {league && (
                  <span className="rounded-full border border-[#BF00FF]/20 bg-[#BF00FF]/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#BF00FF]">
                    {league}
                  </span>
                )}
              </div>
            </div>
          </div>

          {(role || tier) && (
            <div className="relative mt-4 flex gap-2">
              {role && (
                <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <p className="text-[8px] font-black uppercase tracking-wider text-white/30">
                    Role
                  </p>

                  <p className="mt-0.5 truncate text-xs font-black text-white">
                    {role}
                  </p>
                </div>
              )}

              {tier && (
                <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <p className="text-[8px] font-black uppercase tracking-wider text-white/30">
                    Tier
                  </p>

                  <p className="mt-0.5 truncate text-xs font-black text-white">
                    {tier}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Coins */}
          <div className="relative mt-4 flex items-center justify-between rounded-2xl border border-[#00BFFF]/15 bg-[#00BFFF]/[0.04] p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
                <Coins
                  size={18}
                  className="text-[#00BFFF]"
                />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-white/40">
                  Troll Coins
                </p>

                <p className="text-sm font-black text-white">
                  {loading
                    ? 'Loading...'
                    : coins.toLocaleString()}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate('/store')
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00BFFF]/20 bg-[#00BFFF]/5 text-[#00BFFF]"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* XP */}
          <div className="relative mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy
                  size={15}
                  className="text-[#BF00FF]"
                />

                <span className="text-xs font-black text-white">
                  Level {level}
                </span>
              </div>

              <span className="text-[9px] font-bold text-white/35">
                {xp.toLocaleString()} /{' '}
                {xpNext.toLocaleString()} XP
              </span>
            </div>

            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00BFFF] via-[#8B00FF] to-[#BF00FF] shadow-[0_0_12px_rgba(0,191,255,0.35)] transition-all duration-500"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-[8px] font-bold uppercase tracking-wider text-white/25">
                Progress
              </span>

              <span className="text-[9px] font-black text-[#BF00FF]">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        </section>

        {/* Quick Access */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles
                size={16}
                className="text-[#BF00FF]"
              />

              <h2 className="text-sm font-black tracking-[0.1em] text-white/85">
                QUICK ACCESS
              </h2>
            </div>

            <span className="text-[8px] font-black uppercase tracking-wider text-white/25">
              {tabs.length + 1} Apps
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isBlue =
                tab.color === 'blue'

              return (
                <button
                  key={tab.path}
                  type="button"
                  onClick={() =>
                    navigate(tab.path)
                  }
                  className={`group relative overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 active:scale-[0.97] ${
                    isBlue
                      ? 'border-[#00BFFF]/15 bg-[#06121a]/90'
                      : 'border-[#BF00FF]/15 bg-[#11061a]/90'
                  }`}
                >
                  <div
                    className={`absolute -right-5 -top-5 h-16 w-16 rounded-full blur-[25px] ${
                      isBlue
                        ? 'bg-[#00BFFF]/10'
                        : 'bg-[#BF00FF]/10'
                    }`}
                  />

                  <div className="relative flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                        isBlue
                          ? 'border-[#00BFFF]/25 bg-[#00BFFF]/10 text-[#00BFFF]'
                          : 'border-[#BF00FF]/25 bg-[#BF00FF]/10 text-[#BF00FF]'
                      }`}
                    >
                      <Icon size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-white">
                        {tab.label}
                      </p>

                      <p className="mt-0.5 truncate text-[9px] font-bold text-white/30">
                        {tab.description}
                      </p>
                    </div>

                    <ChevronRight
                      size={14}
                      className={
                        isBlue
                          ? 'text-[#00BFFF]/30'
                          : 'text-[#BF00FF]/30'
                      }
                    />
                  </div>
                </button>
              )
            })}

            {/* Settings is now INTERNAL */}
            <button
              type="button"
              onClick={openSettings}
              className="group relative overflow-hidden rounded-2xl border border-[#BF00FF]/20 bg-[#11061a]/90 p-3.5 text-left transition-all duration-200 active:scale-[0.97]"
            >
              <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-[#BF00FF]/10 blur-[25px]" />

              <div className="relative flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#BF00FF]/25 bg-[#BF00FF]/10 text-[#BF00FF]">
                  <Settings size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-white">
                    Settings
                  </p>

                  <p className="mt-0.5 truncate text-[9px] font-bold text-white/30">
                    Account settings
                  </p>
                </div>

                <ChevronRight
                  size={14}
                  className="text-[#BF00FF]/30"
                />
              </div>
            </button>
          </div>
        </section>

        {/* Account */}
        <section className="rounded-[24px] border border-white/10 bg-white/[0.025] p-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.04] py-3.5 text-xs font-black uppercase tracking-wider text-red-400 transition active:scale-[0.98]"
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </section>

        <p className="pb-3 text-center text-[8px] font-bold uppercase tracking-[0.25em] text-white/15">
          Troll City • Mobile
        </p>
      </main>
    </div>
  )
}

/*
 * Small helper used only to determine whether the
 * auth-store currently has a profile available for
 * the photo settings section.
 */
function profileForUpload(profile: unknown) {
  return Boolean(profile)
}