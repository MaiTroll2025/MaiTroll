import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Crown,
  Coins,
  Gem,
  Shield,
  Wallet,
  Trophy,
  Star,
  Zap,
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import { useXPStore } from '@/stores/useXPStore'
import { useCoins } from '@/lib/hooks/useCoins'
import { useHypeCoins } from '@/lib/hooks/useHypeCoins'
import { getRoleDisplayName, supabase } from '@/lib/supabase'
import { getGlowingTextStyle } from '@/lib/perkEffects'
import CashoutDepositModal from '../modals/CashoutDepositModal'
import ConvertHypeCoinsModal from '../modals/ConvertHypeCoinsModal'

type OrganizationBadge = {
  name: string
  role: string
}

function formatNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

function WalletRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'gold' | 'purple' | 'silver' | 'emerald'
}) {
  const tones = {
    gold: 'text-yellow-300 border-yellow-400/15 bg-yellow-400/5',
    purple: 'text-purple-300 border-purple-400/15 bg-purple-400/5',
    silver: 'text-slate-200 border-slate-300/15 bg-slate-300/5',
    emerald: 'text-emerald-300 border-emerald-400/15 bg-emerald-400/5',
  }

  return (
    <div className={`flex items-center justify-between rounded-xl border px-2.5 py-2 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-mono text-[11px] font-black">{value}</span>
    </div>
  )
}

export default function UserProfileWidget() {
  const { profile } = useAuthStore()
  const { level, progress, xpTotal, fetchXP, subscribeToXP, unsubscribe } = useXPStore()

  const {
    troll_coins,
    crowns,
    cashout_coins,
    cashout_reserved_coins,
    loading: coinsLoading,
  } = useCoins()

  const { hypeCoins } = useHypeCoins()

  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [organization, setOrganization] = useState<OrganizationBadge | null>(null)
  const prevXPData = useRef({ level: 0, xpTotal: 0, progress: 0 })

  const now = new Date()
  const hasRgbUsername =
    Boolean(profile?.rgb_username_expires_at) &&
    new Date(profile!.rgb_username_expires_at) > now

  const hasGlowingUsername = Boolean(profile?.glowing_username_color)
  const glowingStyle = hasGlowingUsername
    ? getGlowingTextStyle(profile!.glowing_username_color)
    : undefined

  const displayTrollmonds = profile?.trollmonds ?? 0
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0))

  const roleName = useMemo(() => {
    if (!profile) return 'Citizen'
    return getRoleDisplayName(profile.role, profile.is_admin)
  }, [profile])

  const isRoyal =
    profile?.role === 'admin' ||
    profile?.is_admin ||
    profile?.badge === 'CEO' ||
    profile?.username_style === 'gold'

  const auraClass = isRoyal
    ? 'from-yellow-300/35 via-orange-500/20 to-red-500/25'
    : profile?.role === 'troll_officer'
      ? 'from-cyan-400/35 via-blue-500/20 to-purple-500/25'
      : 'from-purple-400/25 via-cyan-400/15 to-emerald-400/20'

  useEffect(() => {
    let cancelled = false

    async function fetchOrganizationData() {
      if (!profile?.organization_id || !profile?.id) {
        setOrganization(null)
        return
      }

      try {
        const [{ data: adminData }, { data: orgData }] = await Promise.all([
          supabase
            .from('organization_admins')
            .select('id')
            .eq('user_id', profile.id)
            .eq('organization_id', profile.organization_id)
            .maybeSingle(),
          supabase
            .from('organizations')
            .select('name')
            .eq('id', profile.organization_id)
            .maybeSingle(),
        ])

        if (!cancelled && orgData?.name) {
          setOrganization({
            name: orgData.name,
            role: adminData ? 'Admin' : 'Member',
          })
        }
      } catch (error) {
        console.error('[UserProfileWidget] Error fetching organization data:', error)
        if (!cancelled) setOrganization(null)
      }
    }

    fetchOrganizationData()

    return () => {
      cancelled = true
    }
  }, [profile?.organization_id, profile?.id])

  useEffect(() => {
    if (!profile?.id) return

    fetchXP(profile.id)
    subscribeToXP(profile.id)

    return () => {
      unsubscribe()
    }
  }, [profile?.id, fetchXP, subscribeToXP, unsubscribe])

  useEffect(() => {
    if (
      prevXPData.current.level !== level ||
      prevXPData.current.xpTotal !== xpTotal ||
      prevXPData.current.progress !== progress
    ) {
      prevXPData.current = { level, xpTotal, progress }
    }
  }, [level, xpTotal, progress])

  if (!profile) return null

  const avatarUrl =
    profile.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      profile.username || 'TC'
    )}`

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#050816]/95 p-3 shadow-[0_0_35px_rgba(34,211,238,0.14)]">
        <div className={`absolute inset-0 bg-gradient-to-br ${auraClass}`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.16),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.35),rgba(2,6,23,0.98))]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-cyan-400 via-purple-500 to-yellow-300 opacity-80 blur-sm" />
              <img
                src={avatarUrl}
                alt={profile.username || 'User avatar'}
                className="relative h-12 w-12 rounded-2xl border border-white/20 object-cover shadow-xl"
              />

              {isRoyal && (
                <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-black shadow-lg shadow-yellow-400/30">
                  <Crown size={12} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3
                className={`truncate text-sm font-black text-white ${
                  hasRgbUsername ? 'rgb-username' : ''
                }`}
                style={glowingStyle}
              >
                {profile.username || 'Citizen'}
              </h3>

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-yellow-300/20 bg-yellow-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-yellow-200">
                  <Shield size={10} />
                  {organization ? `${organization.name} ${organization.role}` : roleName}
                </span>

                {profile.badge && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-300/20 bg-purple-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-purple-200">
                    <Star size={10} />
                    {profile.badge}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 font-black text-emerald-300">
                <Trophy size={11} />
                City Rank Lvl {level}
              </span>
              <span className="font-black text-slate-300">{Math.round(safeProgress)}%</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-red-500 shadow-[0_0_12px_rgba(234,179,8,0.35)] transition-all duration-500"
                style={{ width: `${safeProgress}%` }}
              />
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {/* Combined COINS panel (Troll + Hype) */}
            <button
              type="button"
              onClick={() => setShowConvertModal(true)}
              className="group w-full rounded-xl border border-yellow-400/25 bg-gradient-to-r from-yellow-500/10 to-purple-500/10 p-3 text-left transition hover:border-yellow-400/40 hover:from-yellow-500/15 hover:to-purple-500/15"
              title="Click to convert Hype Coins to Troll Coins"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-wider text-yellow-200">🪙 COINS</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Coins size={12} className="text-yellow-300" />
                  <div>
                    <span className="text-[9px] font-bold text-yellow-200">Troll</span>
                    <div className="font-mono text-[11px] font-black text-yellow-300">
                      {coinsLoading ? '...' : formatNumber(troll_coins ?? 0)}
                    </div>
                  </div>
                </div>
                <div className="w-px h-8 bg-slate-600" />
                <div className="flex items-center gap-2">
                  <Zap size={12} className="text-purple-300" />
                  <div>
                    <span className="text-[9px] font-bold text-purple-200">Hype</span>
                    <div className="font-mono text-[11px] font-black text-purple-300">
                      {hypeCoins ?? 0}
                    </div>
                  </div>
                </div>
              </div>
            </button>

            {/* Combined Trollmonds + Crowns panel */}
            <div className="flex gap-1.5">
              <div className="flex-1 rounded-xl border border-purple-400/25 bg-purple-500/10 p-2.5">
                <div className="flex items-center gap-1.5">
                  <Gem size={10} className="text-purple-300" />
                  <div>
                    <span className="text-[9px] font-bold text-purple-200">Trollmonds</span>
                    <div className="font-mono text-[10px] font-black text-purple-300">
                      {coinsLoading ? '...' : formatNumber(displayTrollmonds)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 rounded-xl border border-slate-400/25 bg-slate-500/10 p-2.5">
                <div className="flex items-center gap-1.5">
                  <Crown size={10} className="text-slate-200" />
                  <div>
                    <span className="text-[9px] font-bold text-slate-200">Crowns</span>
                    <div className="font-mono text-[10px] font-black text-slate-300">
                      {coinsLoading ? '...' : formatNumber(crowns ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Jail Free Card — green pass */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-gradient-to-r from-emerald-500/12 to-green-600/10 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">🔓</span>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wide text-emerald-300/90 block leading-tight">Get Out of Jail Free</span>
                  <span className="text-[9px] font-bold text-emerald-400/70 block">Troll Economy Pass</span>
                </div>
              </div>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-300 whitespace-nowrap">
                1×
              </span>
            </div>

            {/* Cashout Coins */}
            <button
              type="button"
              onClick={() => setShowDepositModal(true)}
              className="group flex w-full items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-2 text-left transition hover:border-emerald-300/40 hover:bg-emerald-400/15"
              title="Click to deposit gifted coins into non-reversible cashout escrow"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-300">
                <Wallet size={12} />
                Cashout Coins
              </span>

              <span className="text-right font-mono text-[11px] font-black text-emerald-300">
               {coinsLoading ? '...' : formatNumber(troll_coins ?? 0)}
               {(cashout_reserved_coins ?? 0) > 0 && (
                 <span className="block text-[9px] text-emerald-400/80">
                   +{formatNumber(cashout_reserved_coins)} reserved
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <>
            <CashoutDepositModal
              isOpen={showDepositModal}
              onClose={() => setShowDepositModal(false)}
            />
            <ConvertHypeCoinsModal
              isOpen={showConvertModal}
              onClose={() => setShowConvertModal(false)}
            />
          </>,
          document.body
        )}
    </>
  )
}