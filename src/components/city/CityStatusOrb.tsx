import React, { useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck,
  ShieldX,
  Car,
  Home,
  Star,
  Zap,
  MessageSquare,
  UserPlus,
  Gift,
  Hammer,
  AlertTriangle,
  Check,
  ChevronRight,
  Key,
  Lock,
  Sparkles,
  Trophy,
  Crown,
  Flame,
  CircleDollarSign,
  BadgeCheck,
  X,
  Coins,
} from 'lucide-react'

import {
  CityStatusOrbData,
  CityStatusOrbOptions,
} from '../../lib/hooks/useCityStatusOrb'
import { cn } from '../../lib/utils'

import {
  getUserKeysPublic,
  getUserKeysPrivate,
} from '../../services/keyService'

import type { KeyInstance } from '../../types/keys'

interface CityStatusOrbProps {
  data: CityStatusOrbData

  permissions: {
    isSelf: boolean
    canCheckLicense: boolean
    canRaid: boolean
    canRepair: boolean
    canEnforce: boolean
    canRemoveFromSeat: boolean
    canAccessAll: boolean
  }

  onHouseClick?: () => void
  onRaid?: () => void
  onFollow?: () => void
  onGift?: () => void
  onMessage?: () => void

  /**
   * Compact mode for broadcast / inline HUD use.
   */
  compact?: boolean

  /**
   * Hide the username / identity block.
   *
   * Useful when the broadcast tile already renders the
   * broadcaster's username elsewhere.
   */
  showIdentity?: boolean
}

function getLicenseStatusDisplay(
  status: string | null,
  expiry: string | null,
) {
  if (!status || status === 'none') {
    return {
      label: 'No License',
      color: 'text-zinc-500',
      icon: ShieldX,
    }
  }

  if (status === 'suspended') {
    return {
      label: 'Suspended',
      color: 'text-red-400',
      icon: ShieldX,
    }
  }

  if (status === 'active') {
    if (expiry && new Date(expiry) <= new Date()) {
      return {
        label: 'Expired',
        color: 'text-amber-400',
        icon: AlertTriangle,
      }
    }

    return {
      label: 'Active',
      color: 'text-emerald-400',
      icon: ShieldCheck,
    }
  }

  return {
    label: status,
    color: 'text-zinc-400',
    icon: ShieldX,
  }
}

function getInsuranceStatusDisplay(expiry: string | null) {
  if (!expiry) {
    return {
      label: 'No Insurance',
      color: 'text-red-400',
      icon: ShieldX,
    }
  }

  if (new Date(expiry) <= new Date()) {
    return {
      label: 'Expired',
      color: 'text-amber-400',
      icon: AlertTriangle,
    }
  }

  return {
    label: 'Active',
    color: 'text-emerald-400',
    icon: ShieldCheck,
  }
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`
  }

  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }

  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }

  return num.toLocaleString()
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value))
}

function getInitial(username?: string | null) {
  return (username || '?')[0].toUpperCase()
}

function StatusDot({
  active,
  color = 'emerald',
}: {
  active: boolean
  color?: 'emerald' | 'red' | 'amber'
}) {
  const colorClass = {
    emerald: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.95)]',
    red: 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.95)]',
    amber: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.95)]',
  }[color]

  return (
    <span
      className={[
        'h-1.5 w-1.5 rounded-full',
        active ? colorClass : 'bg-zinc-700',
      ].join(' ')}
    />
  )
}

export default function CityStatusOrb({
  data,
  permissions,
  onHouseClick,
  onRaid,
  onFollow,
  onGift,
  onMessage,
  compact = false,
  showIdentity = true,
}: CityStatusOrbProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'keys'>(
    'overview',
  )

  const [publicKeys, setPublicKeys] = useState<KeyInstance[]>([])
  const [privateKeys, setPrivateKeys] = useState<KeyInstance[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [showSafe, setShowSafe] = useState(false)

  const licenseDisplay = getLicenseStatusDisplay(
    data.license_status,
    data.drivers_license_expiry,
  )

  const insuranceDisplay = getInsuranceStatusDisplay(
    data.homeowners_insurance_expiry,
  )

  const LicenseIcon = licenseDisplay.icon

  const xpProgress = useMemo(() => {
    if (!data.next_level_xp || data.next_level_xp <= 0) return 0

    return clampPercent((data.xp / data.next_level_xp) * 100)
  }, [data.xp, data.next_level_xp])

  const leagueProgress = clampPercent(data.leagueProgress || 0)

  useEffect(() => {
    if (compact || activeTab !== 'keys') return

    let cancelled = false

    setKeysLoading(true)

    getUserKeysPublic(data.id)
      .then((keys) => {
        if (!cancelled) {
          setPublicKeys(keys as any)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPublicKeys([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setKeysLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, data.id, compact])

  const openSafe = async () => {
    setShowSafe(true)
    setKeysLoading(true)

    try {
      const keys = await getUserKeysPrivate(data.id)
      setPrivateKeys(keys)
    } catch {
      setPrivateKeys([])
    } finally {
      setKeysLoading(false)
    }
  }

  /*
   * ================================================================
   * COMPACT / BROADCAST HUD
   * ================================================================
   */

  if (compact) {
    const raidBorderClass = data.recentlyRaided
      ? 'border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
      : 'border-white/10';

    const handleClick = (event: React.MouseEvent) => {
      event.stopPropagation()
      if (permissions.isSelf && onHouseClick) {
        onHouseClick()
      } else if (permissions.canRaid && !permissions.isSelf && onRaid) {
        onRaid()
      } else if (permissions.canRepair && onRaid) {
        onRaid()
      } else if (onHouseClick) {
        onHouseClick()
      }
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        className={[
          'group relative flex items-center gap-2 overflow-hidden',
          'rounded-full border',
          'bg-[#080b18]/90 px-2 py-1.5',
          'shadow-[0_8px_30px_rgba(0,0,0,0.45)]',
          'backdrop-blur-xl',
          'transition-all duration-200',
          data.recentlyRaided
            ? 'animate-pulse border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
            : 'hover:border-cyan-400/40 hover:bg-[#0b1020]',
          'active:scale-[0.97]',
        ].join(' ')}
      >
        {/* Energy glow */}
        <div className={[
          'pointer-events-none absolute -left-5 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full blur-xl',
          data.recentlyRaided ? 'bg-red-500/30' : 'bg-cyan-400/20',
        ].join(' ')} />

        {/* Avatar / level orb */}
        <div className="relative z-10">
          <div
            className={[
              'h-7 w-7 rounded-full p-[1.5px]',
              data.recentlyRaided
                ? 'bg-gradient-to-br from-red-400 via-orange-500 to-red-600 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                : 'bg-gradient-to-br from-cyan-300 via-violet-500 to-fuchsia-500 shadow-[0_0_12px_rgba(34,211,238,0.28)]',
            ].join(' ')}
          >
            <div className="h-full w-full overflow-hidden rounded-full bg-[#080b18]">
              {data.avatar_url ? (
                <img
                  src={data.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className={[
                  'flex h-full w-full items-center justify-center',
                  data.recentlyRaided
                    ? 'bg-gradient-to-br from-red-700 to-orange-700'
                    : 'bg-gradient-to-br from-violet-700 to-cyan-700',
                ].join(' ')}>
                  <span className="text-[10px] font-black text-white">
                    {getInitial(data.username)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <span className="absolute -bottom-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-[#080b18] bg-black px-1 text-[7px] font-black text-white">
            {data.level}
          </span>
        </div>

        {/* Identity only when requested */}
        {showIdentity && (
          <div className="relative z-10 min-w-0 max-w-[100px] text-left">
            <div className="truncate text-[10px] font-black text-white">
              {data.display_name || data.username}
            </div>

            <div className="flex items-center gap-1">
              <StatusDot active={!data.recentlyRaided} color={data.recentlyRaided ? 'red' : 'emerald'} />

              <span className="truncate text-[8px] font-bold uppercase tracking-wider text-zinc-500">
                {data.tLeagueTier.label}
              </span>
            </div>
          </div>
        )}

        {/* League + blockers */}
        <div
          className={[
            'relative z-10 flex items-center gap-1 rounded-full',
            'border border-white/10 bg-white/[0.06]',
            'px-2 py-1',
          ].join(' ')}
        >
          {data.blockers > 0 && (
            <ShieldCheck size={10} className="text-cyan-300" />
          )}
          <span
            className={`bg-gradient-to-r ${
              data.subTierColor || data.tLeagueTier.color
            } bg-clip-text text-[10px] font-black text-transparent`}
          >
            {data.league_tier}
            {data.league_sub_tier || ''}
          </span>
        </div>

        {/* XP energy */}
        <div className="relative z-10 hidden w-12 sm:block">
          <div className="mb-0.5 flex items-center justify-between">
            <span className="text-[6px] font-black uppercase text-zinc-600">
              XP
            </span>

            <span className="text-[6px] font-black text-cyan-300">
              {Math.round(xpProgress)}%
            </span>
          </div>

          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={[
                'h-full rounded-full shadow-[0_0_8px_rgba(34,211,238,0.7)]',
                data.recentlyRaided
                  ? 'bg-gradient-to-r from-red-400 to-orange-500'
                  : 'bg-gradient-to-r from-cyan-400 to-violet-500',
              ].join(' ')}
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </div>

        <ChevronRight
          size={13}
          className={[
            'relative z-10 shrink-0 transition-transform',
            data.recentlyRaided ? 'text-red-300' : 'text-white/20 group-hover:translate-x-0.5 group-hover:text-cyan-300',
          ].join(' ')}
        />
      </button>
    )
  }

  /*
   * ================================================================
   * FULL PREMIUM ORB
   * ================================================================
   */

  return (
    <div
      className={[
        'relative w-full max-w-sm overflow-hidden rounded-[1.5rem]',
        'border bg-[#070a14]/95',
        'shadow-[0_20px_70px_rgba(0,0,0,0.55)]',
        'backdrop-blur-2xl',
        data.recentlyRaided
          ? 'border-red-500/70 shadow-red-500/20'
          : 'border-white/[0.09]',
      ].join(' ')}
    >
      {/* ============================================================
          AMBIENT ORB LIGHTING
         ============================================================ */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-56 w-56 rounded-full bg-cyan-500/10 blur-[80px]" />
        <div className="absolute -right-24 top-10 h-64 w-64 rounded-full bg-violet-600/10 blur-[90px]" />
        <div className="absolute bottom-0 left-1/2 h-40 w-[80%] -translate-x-1/2 rounded-full bg-fuchsia-500/[0.04] blur-[80px]" />
      </div>

      {/* ============================================================
          TOP STATUS BAR
         ============================================================ */}

      <div className="relative flex items-center justify-between border-b border-white/[0.06] bg-white/[0.025] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>

          <span className="text-[8px] font-black uppercase tracking-[0.22em] text-zinc-500">
            City Status
          </span>
        </div>

        <div className="flex items-center gap-2">
          {data.recentlyRaided && (
            <div className="flex items-center gap-1 rounded-full border border-red-400/20 bg-red-400/10 px-2 py-1">
              <Flame size={10} className="text-red-300" />

              <span className="text-[7px] font-black uppercase tracking-wider text-red-300">
                Raided
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
            <Sparkles size={9} className="text-cyan-300" />

            <span className="text-[7px] font-black uppercase tracking-wider text-zinc-500">
              Online
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================
          PLAYER HERO
         ============================================================ */}

      <div className="relative px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          {/* Premium avatar ring */}
          <div className="relative shrink-0">
            <div
              className={[
                'absolute -inset-1 rounded-full opacity-70 blur-md',
                'bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500',
              ].join(' ')}
            />

            <div
              className={[
                'relative h-[4.4rem] w-[4.4rem] rounded-full p-[2px]',
                'bg-gradient-to-br from-cyan-300 via-violet-500 to-fuchsia-500',
                'shadow-[0_0_25px_rgba(139,92,246,0.35)]',
              ].join(' ')}
            >
              <div className="h-full w-full overflow-hidden rounded-full border border-black/60 bg-[#090c18]">
                {data.avatar_url ? (
                  <img
                    src={data.avatar_url}
                    alt={data.display_name || data.username || ''}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-700 via-purple-700 to-cyan-700">
                    <span className="text-2xl font-black text-white">
                      {getInitial(data.username)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Level badge */}
            <div className="absolute -bottom-1 -right-2 flex items-center gap-0.5 rounded-full border border-violet-300/20 bg-[#080b18] px-2 py-1 shadow-xl">
              <Star size={8} className="fill-amber-300 text-amber-300" />

              <span className="text-[8px] font-black text-white">
                LV {data.level}
              </span>
            </div>
          </div>

          {/* Identity */}
          {showIdentity && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-base font-black text-white">
                  {data.display_name || data.username}
                </h3>

                <BadgeCheck
                  size={14}
                  className="shrink-0 text-cyan-300"
                />
              </div>

              <p className="mt-0.5 truncate text-[10px] font-medium text-zinc-500">
                @{data.username}
              </p>

              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-xs">
                  {data.tLeagueTier.icon}
                </span>

                <span
                  className={`text-[9px] font-black uppercase tracking-wider ${data.tLeagueTier.textColor}`}
                >
                  {data.tLeagueTier.label}
                </span>
              </div>
            </div>
          )}

          {/* League crest */}
          <div
            className={[
              'relative flex h-14 w-14 shrink-0 flex-col items-center justify-center',
              'overflow-hidden rounded-2xl border border-white/10',
              'bg-gradient-to-br',
              data.subTierColor || data.tLeagueTier.color,
              'shadow-lg',
            ].join(' ')}
          >
            <div className="absolute inset-0 bg-black/30" />

            <Crown
              size={13}
              className="relative z-10 mb-0.5 text-white/80"
            />

            <span className="relative z-10 text-sm font-black text-white">
              {data.league_tier}
              {data.league_sub_tier || ''}
            </span>

            <span className="relative z-10 text-[6px] font-black uppercase tracking-widest text-white/60">
              T-LEAGUE
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================
          XP / LEVEL BAR
         ============================================================ */}

      <div className="relative px-4 pb-3">
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap size={11} className="text-cyan-300" />

              <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-500">
                Level Progress
              </span>
            </div>

            <span className="text-[9px] font-black text-cyan-300">
              {Math.round(xpProgress)}%
            </span>
          </div>

          <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 shadow-[0_0_12px_rgba(34,211,238,0.55)] transition-all duration-700"
              style={{ width: `${xpProgress}%` }}
            />

            <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-transparent" />
          </div>

          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[8px] font-bold text-zinc-600">
              {formatNumber(data.xp)} XP
            </span>

            {data.next_level_xp && (
              <span className="text-[8px] font-bold text-zinc-600">
                {formatNumber(data.next_level_xp)} XP
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================
          LEAGUE PROGRESS
         ============================================================ */}

      <div className="relative px-4 pb-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Trophy size={11} className="text-amber-300" />

              <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-500">
                League Rank
              </span>
            </div>

            <span
              className={`text-[9px] font-black ${data.tLeagueTier.textColor}`}
            >
              {formatNumber(data.league_score)} PTS
            </span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${
                data.subTierColor || data.tLeagueTier.color
              } shadow-[0_0_10px_rgba(139,92,246,0.45)] transition-all duration-700`}
              style={{ width: `${leagueProgress}%` }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[8px] text-zinc-600">
              {data.league_tier}
              {data.league_sub_tier || ''}
            </span>

            <span className="text-[8px] font-black text-violet-300">
              {Math.round(leagueProgress)}%
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================
          STAT GRID
         ============================================================ */}

      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <PremiumStat
          icon={Zap}
          label="Hype"
          value={formatNumber(data.hype_coins)}
          accent="yellow"
        />

        <PremiumStat
          icon={Car}
          label="Plate"
          value={data.license_plate || '—'}
          accent="cyan"
          mono
        />

        {(permissions.canCheckLicense || permissions.isSelf) && (
          <PremiumStat
            icon={LicenseIcon}
            label="License"
            value={licenseDisplay.label}
            accent={
              licenseDisplay.color.includes('red')
                ? 'red'
                : licenseDisplay.color.includes('amber')
                  ? 'yellow'
                  : 'green'
            }
          />
        )}

        {(permissions.canCheckLicense || permissions.isSelf) && (
          <PremiumStat
            icon={Home}
            label="Home Insurance"
            value={insuranceDisplay.label}
            accent={
              insuranceDisplay.color.includes('red')
                ? 'red'
                : insuranceDisplay.color.includes('amber')
                  ? 'yellow'
                  : 'green'
            }
          />
        )}

        {data.vehicle_id &&
          (permissions.canCheckLicense || permissions.isSelf) && (
            <PremiumStat
              icon={Car}
              label="Car Insurance"
              value={
                getInsuranceStatusDisplay(
                  data.car_insurance_expiry,
                ).label
              }
              accent={
                getInsuranceStatusDisplay(
                  data.car_insurance_expiry,
                ).color.includes('red')
                  ? 'red'
                  : getInsuranceStatusDisplay(
                        data.car_insurance_expiry,
                      ).color.includes('amber')
                    ? 'yellow'
                    : 'green'
              }
            />
          )}

        <PremiumStat
          icon={CircleDollarSign}
          label="League Coins"
          value={formatNumber(data.league_score)}
          accent="purple"
        />

        <PremiumStat
          icon={ShieldCheck}
          label="Blockers"
          value={String(data.blockers)}
          accent="cyan"
        />
      </div>

      {/* ============================================================
          NEXT LEAGUE
         ============================================================ */}

      {data.nextTier && (
        <div className="px-4 pb-4">
          <div className="relative overflow-hidden rounded-2xl border border-amber-400/10 bg-gradient-to-br from-amber-400/[0.07] via-white/[0.025] to-violet-500/[0.05] p-3">
            <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-amber-400/10 blur-2xl" />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/10">
                  <Trophy size={14} className="text-amber-300" />
                </div>

                <div>
                  <p className="text-[7px] font-black uppercase tracking-[0.18em] text-zinc-600">
                    Next Destination
                  </p>

                  <p
                    className={`mt-0.5 text-xs font-black ${data.nextTier.textColor}`}
                  >
                    {data.nextTier.icon} {data.nextTier.tier}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[7px] font-black uppercase tracking-wider text-zinc-600">
                  Remaining
                </p>

                <p className="text-[10px] font-black text-amber-300">
                  {formatNumber(data.coinsToNextLeague)}
                </p>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/30">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${data.tLeagueTier.color}`}
                style={{ width: `${leagueProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MISSIONS
         ============================================================ */}

      {data.activeMissions && data.activeMissions.length > 0 && (
        <div className="px-4 pb-4">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={11} className="text-emerald-300" />

              <span className="text-[8px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Active Missions
              </span>
            </div>

            <span className="text-[8px] font-black text-emerald-300">
              {data.activeMissions.length} ACTIVE
            </span>
          </div>

          <div className="space-y-2">
            {data.activeMissions.map((mission) => {
              const pct = clampPercent(
                (mission.progress / mission.goal) * 100,
              )

              return (
                <div
                  key={mission.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10">
                        <Check
                          size={12}
                          className="text-emerald-300"
                        />
                      </div>

                      <span className="truncate text-[10px] font-black text-white">
                        {mission.title}
                      </span>
                    </div>

                    <span className="shrink-0 text-[8px] font-black text-emerald-300">
                      +{formatNumber(mission.reward)}
                    </span>
                  </div>

                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[7px] font-bold text-zinc-600">
                      {formatNumber(mission.progress)} /{' '}
                      {formatNumber(mission.goal)}
                    </span>

                    <span className="text-[7px] font-black text-emerald-300">
                      {Math.round(pct)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ============================================================
          HOUSE
         ============================================================ */}

      {data.house_id && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (
                permissions.canRaid &&
                !permissions.isSelf &&
                onRaid
              ) {
                onRaid()
              } else if (onHouseClick) {
                onHouseClick()
              }
            }}
            className={[
              'group flex w-full items-center justify-between',
              'rounded-xl border border-white/[0.07]',
              'bg-white/[0.025] px-3 py-2.5',
              'transition-all duration-200',
              'hover:border-emerald-400/20',
              'hover:bg-emerald-400/[0.04]',
            ].join(' ')}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/10 bg-emerald-400/10">
                <Home size={14} className="text-emerald-300" />
              </div>

              <div className="text-left">
                <p className="text-[7px] font-black uppercase tracking-wider text-zinc-600">
                  City Residence
                </p>

                <p className="mt-0.5 text-[10px] font-black text-white">
                  House #{data.house_id.slice(0, 8)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {permissions.canRaid &&
                !permissions.isSelf && (
                  <span className="flex items-center gap-1 rounded-full bg-red-400/10 px-2 py-1 text-[7px] font-black uppercase text-red-300">
                    <Hammer size={9} />
                    Raid
                  </span>
                )}

              {permissions.canRepair && (
                <span className="text-[7px] font-black uppercase text-cyan-300">
                  Repair
                </span>
              )}

              <ChevronRight
                size={13}
                className="text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
              />
            </div>
          </button>
        </div>
      )}

      {/* ============================================================
          BROADCAST RAID / REPAIR
         ============================================================ */}

      {permissions.canRaid && !permissions.isSelf && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onRaid?.()
            }}
            className={cn(
              'group flex w-full items-center justify-between rounded-xl border px-3 py-2.5 transition-all duration-200',
              data.recentlyRaided
                ? 'border-cyan-400/20 bg-cyan-400/[0.04] hover:border-cyan-400/30'
                : 'border-red-400/10 bg-red-400/[0.03] hover:border-red-400/20'
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg border',
                data.recentlyRaided
                  ? 'border-cyan-400/10 bg-cyan-400/10'
                  : 'border-red-400/10 bg-red-400/10'
              )}>
                {data.recentlyRaided ? (
                  <Hammer size={14} className="text-cyan-300" />
                ) : (
                  <Hammer size={14} className="text-red-300" />
                )}
              </div>

              <div className="text-left">
                <p className="text-[7px] font-black uppercase tracking-wider text-zinc-600">
                  Broadcast
                </p>

                <p className={cn(
                  'mt-0.5 text-[10px] font-black',
                  data.recentlyRaided ? 'text-cyan-300' : 'text-red-300'
                )}>
                  {data.recentlyRaided ? 'Repair Property' : 'Raid Property'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {data.recentlyRaided && (
                <span className="text-[7px] font-black uppercase text-cyan-300">
                  +10 coins
                </span>
              )}

              {!data.recentlyRaided && (
                <span className="flex items-center gap-1 rounded-full bg-red-400/10 px-2 py-1 text-[7px] font-black uppercase text-red-300">
                  <Coins size={9} />
                  25
                </span>
              )}

              <ChevronRight
                size={13}
                className={cn(
                  'transition-transform',
                  data.recentlyRaided ? 'text-cyan-300' : 'text-zinc-600'
                )}
              />
            </div>
          </button>
        </div>
      )}

      {/* ============================================================
          TABS
         ============================================================ */}

      <div className="px-4">
        <div className="flex rounded-xl border border-white/[0.06] bg-black/20 p-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setActiveTab('overview')
            }}
            className={[
              'flex-1 rounded-lg py-2 text-[8px] font-black uppercase tracking-[0.16em]',
              'transition-all duration-200',
              activeTab === 'overview'
                ? 'bg-white/[0.08] text-white shadow-lg'
                : 'text-zinc-600 hover:text-zinc-300',
            ].join(' ')}
          >
            Overview
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setActiveTab('keys')
            }}
            className={[
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2',
              'text-[8px] font-black uppercase tracking-[0.16em]',
              'transition-all duration-200',
              activeTab === 'keys'
                ? 'bg-violet-500/10 text-violet-300 shadow-lg'
                : 'text-zinc-600 hover:text-zinc-300',
            ].join(' ')}
          >
            <Key size={10} />
            Keys
          </button>
        </div>
      </div>

      {/* ============================================================
          KEYS
         ============================================================ */}

      {activeTab === 'keys' && (
        <div className="px-4 pb-4 pt-3">
          {keysLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-400/20 border-t-violet-400" />
            </div>
          ) : publicKeys.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] py-6 text-center">
              <Key
                size={20}
                className="mx-auto text-zinc-700"
              />

              <p className="mt-2 text-[9px] font-bold text-zinc-600">
                No keys collected yet.
              </p>
            </div>
          ) : (
            <div className="max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
              {publicKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                      <span className="text-sm font-black text-white">
                        {key.key_letter}
                      </span>
                    </div>

                    <div>
                      <p className="text-[9px] font-black uppercase text-white">
                        {key.rarity.replace('_', ' ')}
                      </p>

                      <p className="mt-0.5 text-[7px] text-zinc-600">
                        Key inventory
                      </p>
                    </div>
                  </div>

                  {key.is_key_to_city && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[7px] font-black text-amber-300">
                      <Crown size={8} />
                      CITY KEY
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {permissions.isSelf && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                openSafe()
              }}
              className={[
                'mt-2.5 flex w-full items-center justify-center gap-2',
                'rounded-xl border border-amber-400/20',
                'bg-gradient-to-r from-amber-500/15 to-orange-500/10',
                'px-3 py-2.5',
                'text-[9px] font-black uppercase tracking-[0.15em] text-amber-200',
                'shadow-[0_0_20px_rgba(245,158,11,0.08)]',
                'transition-all hover:border-amber-300/40 hover:from-amber-500/20 hover:to-orange-500/15',
              ].join(' ')}
            >
              <Lock size={11} />
              Open City Safe
            </button>
          )}
        </div>
      )}

      {/* ============================================================
          ACTIONS
         ============================================================ */}

      <div className="flex flex-wrap gap-1.5 px-4 pb-4 pt-3">
        {!permissions.isSelf && (
          <>
            {onFollow && (
              <OrbAction
                icon={UserPlus}
                label="Follow"
                onClick={onFollow}
              />
            )}

            {onGift && (
              <OrbAction
                icon={Gift}
                label="Gift"
                onClick={onGift}
              />
            )}

            {onMessage && (
              <OrbAction
                icon={MessageSquare}
                label="Message"
                onClick={onMessage}
              />
            )}
          </>
        )}

        {permissions.canEnforce &&
          !permissions.isSelf && (
            <OrbAction
              icon={ShieldCheck}
              label="Enforce"
              danger
            />
          )}
      </div>

      {/* ============================================================
          SAFE MODAL
         ============================================================ */}

      {showSafe && (
        <SafeBoxModal
          keys={privateKeys}
          loading={keysLoading}
          onClose={() => setShowSafe(false)}
        />
      )}
    </div>
  )
}

/* =====================================================================
   PREMIUM STAT
   ===================================================================== */

function PremiumStat({
  icon: Icon,
  label,
  value,
  accent,
  mono = false,
}: {
  icon: React.ComponentType<{
    size?: number | string
    className?: string
  }>
  label: string
  value: string
  accent: 'yellow' | 'cyan' | 'green' | 'red' | 'purple'
  mono?: boolean
}) {
  const styles = {
    yellow: {
      icon: 'text-amber-300',
      bg: 'bg-amber-400/10',
      border: 'border-amber-400/10',
    },
    cyan: {
      icon: 'text-cyan-300',
      bg: 'bg-cyan-400/10',
      border: 'border-cyan-400/10',
    },
    green: {
      icon: 'text-emerald-300',
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/10',
    },
    red: {
      icon: 'text-red-300',
      bg: 'bg-red-400/10',
      border: 'border-red-400/10',
    },
    purple: {
      icon: 'text-violet-300',
      bg: 'bg-violet-400/10',
      border: 'border-violet-400/10',
    },
  }[accent]

  return (
    <div
      className={[
        'flex min-w-0 items-center gap-2.5 rounded-xl',
        'border bg-white/[0.025] p-2.5',
        styles.border,
      ].join(' ')}
    >
      <div
        className={[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          styles.bg,
        ].join(' ')}
      >
        <Icon size={13} className={styles.icon} />
      </div>

      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.15em] text-zinc-600">
          {label}
        </p>

        <p
          className={[
            'mt-0.5 truncate text-[10px] font-black text-white',
            mono ? 'font-mono' : '',
          ].join(' ')}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

/* =====================================================================
   ACTION BUTTON
   ===================================================================== */

function OrbAction({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ComponentType<{
    size?: number | string
    className?: string
  }>
  label: string
  onClick?: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      className={[
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5',
        'text-[8px] font-black uppercase tracking-wider',
        'transition-all active:scale-[0.96]',
        danger
          ? 'border-red-400/15 bg-red-400/10 text-red-300 hover:border-red-400/30 hover:bg-red-400/15'
          : 'border-white/[0.07] bg-white/[0.035] text-zinc-400 hover:border-cyan-400/20 hover:bg-cyan-400/[0.05] hover:text-white',
      ].join(' ')}
    >
      <Icon size={11} />
      {label}
    </button>
  )
}

/* =====================================================================
   SAFE BOX
   ===================================================================== */

function SafeBoxModal({
  keys,
  loading,
  onClose,
}: {
  keys: KeyInstance[]
  loading: boolean
  onClose: () => void
}) {
  const totalValue = keys.reduce(
    (sum, key) => sum + key.value,
    0,
  )

  const activeKeys = keys.filter(
    (key) => key.status === 'active',
  )

  const lockedKeys = activeKeys.filter(
    (key) =>
      new Date(key.cashout_available_at) > new Date(),
  )

  const availableKeys = activeKeys.filter(
    (key) =>
      new Date(key.cashout_available_at) <= new Date(),
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[1.5rem] border border-amber-400/20 bg-[#080b14] shadow-[0_25px_100px_rgba(245,158,11,0.12)]">
        {/* Glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-amber-400/10 blur-[80px]" />

        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-white/[0.07] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
              <Lock size={17} className="text-amber-300" />
            </div>

            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.2em] text-amber-300/60">
                Private Vault
              </p>

              <h3 className="mt-0.5 text-sm font-black text-white">
                MaiTroll City Safe
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onClose()
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-500 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        <div className="relative space-y-4 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-amber-400/20 border-t-amber-400" />
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] p-3">
                  <p className="text-[7px] font-black uppercase tracking-wider text-zinc-600">
                    Total Value
                  </p>

                  <p className="mt-1 text-lg font-black text-amber-300">
                    {totalValue.toLocaleString()} TC
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <p className="text-[7px] font-black uppercase tracking-wider text-zinc-600">
                    Active Keys
                  </p>

                  <p className="mt-1 text-lg font-black text-white">
                    {activeKeys.length}
                  </p>
                </div>
              </div>

              {/* Available */}
              <SafeSection
                title="Cashout Available"
                count={availableKeys.length}
                color="green"
              >
                {availableKeys.length === 0 ? (
                  <EmptySafeState text="Nothing available yet." />
                ) : (
                  availableKeys.map((key) => (
                    <SafeKeyRow
                      key={key.id}
                      keyData={key}
                      available
                    />
                  ))
                )}
              </SafeSection>

              {/* Locked */}
              <SafeSection
                title="Locked"
                count={lockedKeys.length}
                color="yellow"
              >
                {lockedKeys.length === 0 ? (
                  <EmptySafeState text="No locked keys." />
                ) : (
                  lockedKeys.map((key) => {
                    const daysLeft = Math.max(
                      0,
                      Math.ceil(
                        (new Date(
                          key.cashout_available_at,
                        ).getTime() -
                          Date.now()) /
                          (1000 * 60 * 60 * 24),
                      ),
                    )

                    return (
                      <SafeKeyRow
                        key={key.id}
                        keyData={key}
                        daysLeft={daysLeft}
                      />
                    )
                  })
                )}
              </SafeSection>
            </>
          )}
        </div>

        <div className="border-t border-white/[0.07] px-4 py-3">
          <p className="text-center text-[7px] leading-4 text-zinc-600">
            Private values are visible only to you.
          </p>
        </div>
      </div>
    </div>
  )
}

/* =====================================================================
   SAFE SECTION
   ===================================================================== */

function SafeSection({
  title,
  count,
  color,
  children,
}: {
  title: string
  count: number
  color: 'green' | 'yellow'
  children: React.ReactNode
}) {
  const classes =
    color === 'green'
      ? 'text-emerald-300'
      : 'text-amber-300'

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p
          className={`text-[8px] font-black uppercase tracking-[0.15em] ${classes}`}
        >
          {title}
        </p>

        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[7px] font-black text-zinc-600">
          {count}
        </span>
      </div>

      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

/* =====================================================================
   SAFE KEY ROW
   ===================================================================== */

function SafeKeyRow({
  keyData,
  available = false,
  daysLeft,
}: {
  keyData: KeyInstance
  available?: boolean
  daysLeft?: number
}) {
  return (
    <div
      className={[
        'flex items-center justify-between rounded-xl border px-3 py-2.5',
        available
          ? 'border-emerald-400/10 bg-emerald-400/[0.04]'
          : 'border-amber-400/10 bg-amber-400/[0.04]',
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/20">
          <span className="text-sm font-black text-white">
            {keyData.key_letter}
          </span>
        </div>

        <div>
          <p className="text-[9px] font-black text-white">
            {keyData.rarity.replace('_', ' ')}
          </p>

          {!available && (
            <p className="mt-0.5 flex items-center gap-1 text-[7px] font-bold text-zinc-600">
              <Lock size={8} />
              {daysLeft}d remaining
            </p>
          )}
        </div>
      </div>

      <span
        className={[
          'text-[9px] font-black',
          available
            ? 'text-emerald-300'
            : 'text-amber-300',
        ].join(' ')}
      >
        {keyData.value.toLocaleString()} TC
      </span>
    </div>
  )
}

/* =====================================================================
   EMPTY STATE
   ===================================================================== */

function EmptySafeState({
  text,
}: {
  text: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3">
      <p className="text-[8px] text-zinc-600">{text}</p>
    </div>
  )
}