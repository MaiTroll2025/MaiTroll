/**
 * ADMIN — FEE POOL
 *
 * Single place where every platform fee collected anywhere in Troll City lands.
 * Fees are written to `platform_fee_pool` by `record_platform_fee()` and are
 * always credited to the platform admin account.
 *
 * Valuation: coin store base ratio BEFORE the 10% pack bonus => 100 coins = $1.00
 *
 * Admin only.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ChevronDown,
  Coins,
  DollarSign,
  Layers,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { supabase, hasRole } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

/** Coin store base ratio, before the 10% purchase bonus. 100 coins = $1.00 */
const COINS_PER_USD_BASE = 100

const RANGES = [
  { id: 'all', label: 'All Time', hours: null as number | null },
  { id: '24h', label: 'Last 24h', hours: 24 },
  { id: '7d', label: 'Last 7 Days', hours: 24 * 7 },
  { id: '30d', label: 'Last 30 Days', hours: 24 * 30 },
] as const

type RangeId = (typeof RANGES)[number]['id']

/** Friendly names for known fee types (falls back to a humanised fee_type). */
const FEE_TYPE_LABELS: Record<string, string> = {
  maipiks_story_tip: 'MAI Piks Story Tips (20%)',
  marketplace_sale: 'Marketplace Sales (3%)',
  gift_platform_share: 'Gift Platform Share',
  cashout_processing: 'Cashout Processing Fees',
  treelz_tip: 'Treelz Tips',
  epaper_tip: 'ePaper Tips',
  agency_split: 'Agency Splits',
  kick_ban_revenue: 'Kick / Ban Revenue',
  broadcast_stream_fee: 'Broadcast Stream Fees',
}

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface FeeBreakdownRow {
  fee_type: string
  fee_label: string | null
  coins: number
  entries: number
  usd_value: number
  gross_coins: number
  first_collected_at: string | null
  last_collected_at: string | null
}

interface FeePoolSummary {
  coins_per_usd: number
  total_coins: number
  total_usd: number
  total_entries: number
  breakdown: FeeBreakdownRow[]
  generated_at: string
}

interface FeeEntry {
  id: string
  fee_type: string
  fee_label: string | null
  coins: number
  usd_value: number
  gross_coins: number | null
  fee_percent: number | null
  created_at: string
  reference_table: string | null
  reference_id: string | null
  payer_username: string | null
  earner_username: string | null
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function coinsToUsd(coins: number): number {
  return Math.round((Number(coins || 0) / COINS_PER_USD_BASE) * 100) / 100
}

function formatUsd(value: number): string {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatCoins(value: number): string {
  return Number(value || 0).toLocaleString()
}

function humaniseFeeType(feeType: string): string {
  return feeType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function feeTypeLabel(row: { fee_type: string; fee_label?: string | null }): string {
  return FEE_TYPE_LABELS[row.fee_type] || row.fee_label || humaniseFeeType(row.fee_type)
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function FeePool() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const allowed = useMemo(() => hasRole(profile, ['admin', 'ceo'] as any), [profile])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [range, setRange] = useState<RangeId>('all')
  const [summary, setSummary] = useState<FeePoolSummary | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [entries, setEntries] = useState<Record<string, FeeEntry[]>>({})
  const [entriesLoading, setEntriesLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed) {
      toast.error('Admin access only')
      navigate('/', { replace: true })
    }
  }, [allowed, navigate])

  const loadSummary = useCallback(
    async (rangeId: RangeId) => {
      if (!allowed) return

      const selected = RANGES.find((r) => r.id === rangeId)
      const from = selected?.hours
        ? new Date(Date.now() - selected.hours * 60 * 60 * 1000).toISOString()
        : null

      const { data, error } = await supabase.rpc('admin_get_fee_pool_summary', {
        p_from: from,
        p_to: null,
      })

      if (error) {
        console.error('[FeePool] summary error:', error)
        toast.error(error.message || 'Failed to load the fee pool')
        setSummary(null)
        return
      }

      const payload = (data || {}) as Partial<FeePoolSummary>

      setSummary({
        coins_per_usd: Number(payload.coins_per_usd ?? COINS_PER_USD_BASE),
        total_coins: Number(payload.total_coins ?? 0),
        total_usd: Number(payload.total_usd ?? 0),
        total_entries: Number(payload.total_entries ?? 0),
        breakdown: Array.isArray(payload.breakdown) ? payload.breakdown : [],
        generated_at: payload.generated_at || new Date().toISOString(),
      })
    },
    [allowed]
  )

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      await loadSummary(range)
      if (!cancelled) setLoading(false)
    }

    run()

    return () => {
      cancelled = true
    }
  }, [loadSummary, range])

  const handleRefresh = async () => {
    setRefreshing(true)
    setEntries({})
    await loadSummary(range)
    setRefreshing(false)
    toast.success('Fee pool refreshed')
  }

  const loadEntries = useCallback(
    async (feeType: string) => {
      if (entries[feeType]) return

      setEntriesLoading(feeType)

      const { data, error } = await supabase.rpc('admin_get_fee_pool_entries', {
        p_fee_type: feeType,
        p_limit: 100,
        p_offset: 0,
      })

      setEntriesLoading(null)

      if (error) {
        console.error('[FeePool] entries error:', error)
        toast.error(error.message || 'Failed to load fee entries')
        return
      }

      setEntries((prev) => ({ ...prev, [feeType]: (data || []) as FeeEntry[] }))
    },
    [entries]
  )

  const toggleFeeType = async (feeType: string) => {
    if (expanded === feeType) {
      setExpanded(null)
      return
    }

    setExpanded(feeType)
    await loadEntries(feeType)
  }

  const largestFee = useMemo(() => {
    if (!summary?.breakdown?.length) return null
    return summary.breakdown.reduce((best, row) => (row.coins > best.coins ? row : best), summary.breakdown[0])
  }, [summary])

  if (!allowed) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050A14] via-[#08101F] to-[#0A0514] p-4 text-white md:p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">

        {/* ---------------------------------------------------------------- */}
        {/* HEADER                                                          */}
        {/* ---------------------------------------------------------------- */}

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-purple-300 bg-clip-text text-2xl font-black text-transparent md:text-3xl">
              Fee Pool
            </h1>
            <p className="text-sm text-slate-400">
              Every platform fee collected across Troll City lands here.{' '}
              <span className="font-bold text-cyan-300">
                Valued at {COINS_PER_USD_BASE} coins = $1.00
              </span>{' '}
              <span className="text-slate-500">(coin store base ratio, before the 10% pack bonus)</span>
            </p>
            <p className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin only — read-only reporting
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
              {RANGES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setRange(option.id)
                    setEntries({})
                    setExpanded(null)
                  }}
                  className={`px-3 py-2 text-xs font-bold transition ${
                    range === option.id
                      ? 'bg-cyan-500/20 text-cyan-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* TOTALS                                                          */}
        {/* ---------------------------------------------------------------- */}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              icon={<DollarSign className="h-5 w-5 text-emerald-300" />}
              label="Total Fee Pool (USD)"
              value={formatUsd(summary?.total_usd ?? 0)}
              sub={`${formatCoins(summary?.total_coins ?? 0)} coins`}
              accent="emerald"
              highlight
            />
            <StatCard
              icon={<Coins className="h-5 w-5 text-amber-300" />}
              label="Total Fee Coins"
              value={formatCoins(summary?.total_coins ?? 0)}
              sub={`${COINS_PER_USD_BASE} coins = $1.00`}
              accent="amber"
            />
            <StatCard
              icon={<Layers className="h-5 w-5 text-cyan-300" />}
              label="Fee Types"
              value={String(summary?.breakdown?.length ?? 0)}
              sub={`${formatCoins(summary?.total_entries ?? 0)} total entries`}
              accent="cyan"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5 text-purple-300" />}
              label="Largest Source"
              value={largestFee ? feeTypeLabel(largestFee) : '—'}
              sub={largestFee ? formatUsd(largestFee.usd_value ?? coinsToUsd(largestFee.coins)) : 'No fees collected yet'}
              accent="purple"
            />
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* BREAKDOWN — one dropdown per fee type                           */}
        {/* ---------------------------------------------------------------- */}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">Fee Breakdown</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Open a fee type to see what it is worth and where it came from
              </p>
            </div>
            <div className="hidden text-right md:block">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pool Total</p>
              <p className="text-lg font-black text-emerald-300">{formatUsd(summary?.total_usd ?? 0)}</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
              ))}
            </div>
          ) : !summary?.breakdown?.length ? (
            <div className="px-5 py-16 text-center">
              <Wallet className="mx-auto h-10 w-10 text-slate-700" />
              <p className="mt-4 text-sm font-bold text-slate-400">No platform fees collected in this period</p>
              <p className="mt-1 text-xs text-slate-600">
                Fees appear here automatically as soon as they are taken anywhere in the platform.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {summary.breakdown.map((row) => {
                const isOpen = expanded === row.fee_type
                const usd = row.usd_value ?? coinsToUsd(row.coins)
                const share = summary.total_coins > 0 ? (row.coins / summary.total_coins) * 100 : 0
                const rows = entries[row.fee_type]

                return (
                  <div key={row.fee_type}>
                    {/* Dropdown header */}
                    <button
                      type="button"
                      onClick={() => toggleFeeType(row.fee_type)}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03]"
                    >
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-100">{feeTypeLabel(row)}</p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-600">{row.fee_type}</p>
                      </div>

                      <div className="hidden w-32 shrink-0 md:block">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                            style={{ width: `${Math.min(share, 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] font-bold text-slate-500">{share.toFixed(1)}% of pool</p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black text-amber-300">{formatCoins(row.coins)} coins</p>
                        <p className="text-[11px] font-bold text-emerald-300">{formatUsd(usd)}</p>
                      </div>
                    </button>

                    {/* Dropdown body */}
                    {isOpen && (
                      <div className="border-t border-white/5 bg-black/30 px-5 py-4">
                        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <MiniStat label="Fee Coins" value={`${formatCoins(row.coins)} coins`} accent="amber" />
                          <MiniStat
                            label={`Worth (${COINS_PER_USD_BASE} coins = $1)`}
                            value={formatUsd(usd)}
                            accent="emerald"
                          />
                          <MiniStat label="Entries" value={formatCoins(row.entries)} accent="cyan" />
                          <MiniStat
                            label="Volume Fee Taken From"
                            value={
                              row.gross_coins
                                ? `${formatCoins(row.gross_coins)} coins · ${formatUsd(coinsToUsd(row.gross_coins))}`
                                : '—'
                            }
                            accent="purple"
                          />
                        </div>

                        <div className="mb-4 flex flex-wrap gap-4 text-[11px] text-slate-500">
                          <span>
                            First collected:{' '}
                            <span className="font-bold text-slate-300">{formatDate(row.first_collected_at)}</span>
                          </span>
                          <span>
                            Last collected:{' '}
                            <span className="font-bold text-slate-300">{formatDate(row.last_collected_at)}</span>
                          </span>
                        </div>

                        {entriesLoading === row.fee_type ? (
                          <div className="space-y-2">
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="h-9 animate-pulse rounded-lg bg-white/[0.04]" />
                            ))}
                          </div>
                        ) : !rows?.length ? (
                          <p className="py-4 text-center text-xs text-slate-600">No individual entries to show</p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-white/10">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wider text-slate-500">
                                <tr>
                                  <th className="px-3 py-2 font-black">When</th>
                                  <th className="px-3 py-2 font-black">Paid By</th>
                                  <th className="px-3 py-2 font-black">Earner</th>
                                  <th className="px-3 py-2 text-right font-black">Gross</th>
                                  <th className="px-3 py-2 text-right font-black">Fee %</th>
                                  <th className="px-3 py-2 text-right font-black">Fee Coins</th>
                                  <th className="px-3 py-2 text-right font-black">Fee USD</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {rows.map((entry) => (
                                  <tr key={entry.id} className="hover:bg-white/[0.02]">
                                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                                      {formatDate(entry.created_at)}
                                    </td>
                                    <td className="px-3 py-2 text-slate-300">
                                      {entry.payer_username ? `@${entry.payer_username}` : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-slate-300">
                                      {entry.earner_username ? `@${entry.earner_username}` : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-400">
                                      {entry.gross_coins ? formatCoins(entry.gross_coins) : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-400">
                                      {entry.fee_percent != null ? `${Number(entry.fee_percent)}%` : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-amber-300">
                                      {formatCoins(entry.coins)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-emerald-300">
                                      {formatUsd(entry.usd_value ?? coinsToUsd(entry.coins))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {rows && rows.length >= 100 && (
                          <p className="mt-2 text-[10px] text-slate-600">Showing the 100 most recent entries.</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Grand total row */}
              <div className="flex items-center justify-between bg-emerald-500/[0.06] px-5 py-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-wider text-emerald-200">Total Fees In Pool</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatCoins(summary.total_entries)} fee entries across {summary.breakdown.length} fee types
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-amber-300">{formatCoins(summary.total_coins)} coins</p>
                  <p className="text-sm font-black text-emerald-300">{formatUsd(summary.total_usd)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {summary?.generated_at && (
          <p className="text-center text-[10px] text-slate-700">
            Generated {formatDate(summary.generated_at)}
          </p>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* CARDS                                                                      */
/* -------------------------------------------------------------------------- */

const ACCENTS: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/[0.07]',
  amber: 'border-amber-500/30 bg-amber-500/[0.07]',
  cyan: 'border-cyan-500/30 bg-cyan-500/[0.07]',
  purple: 'border-purple-500/30 bg-purple-500/[0.07]',
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  highlight = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent: keyof typeof ACCENTS | string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 ${ACCENTS[accent] || ACCENTS.cyan}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      </div>
      <p className={`mt-3 truncate font-black ${highlight ? 'text-2xl text-white' : 'text-xl text-slate-100'}`}>
        {value}
      </p>
      {sub && <p className="mt-1 truncate text-[11px] text-slate-500">{sub}</p>}
    </div>
  )
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: keyof typeof ACCENTS | string
}) {
  return (
    <div className={`rounded-xl border p-3 ${ACCENTS[accent] || ACCENTS.cyan}`}>
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1.5 truncate text-sm font-black text-slate-100">{value}</p>
    </div>
  )
}
