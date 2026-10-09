import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ClipboardList, Loader2, Package, Search, ShoppingBag, User, Users, X } from 'lucide-react';
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'

import AuctionNav from './AuctionNav'

interface AuctionWinner {
  user_id: string
  username: string | null
  avatar_url: string | null
  email: string | null
  wins: AuctionWin[]
  total_owed: number
  total_items: number
  batch_status: 'none' | 'batched' | 'shipped'
  batch_id: string | null
}

interface AuctionWin {
  lot_id: string
  lot_title: string
  lot_image_url: string | null
  final_bid: number
  show_id: string
  show_title: string
  won_at: string
  payment_status: 'pending' | 'held' | 'paid' | 'refunded'
  fulfillment_status: string | null
  shipping_cost: number
  shipping_name: string | null
  shipping_address: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  shipping_carrier: string | null
  tracking_number: string | null
  shipped_at: string | null
  delivered_at: string | null
  batch_id: string | null
}

const shell =
  'relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#07101f] px-3 pb-8 pt-20 text-white sm:px-4 md:px-6'
const panel =
  'rounded-[1.65rem] border border-cyan-300/15 bg-[#0b1628]/85 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const _panelSoft =
  'rounded-[1.4rem] border border-cyan-300/12 bg-[#0d1a2f]/78 shadow-[0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const input =
  'w-full rounded-xl border border-cyan-300/20 bg-[#07101f]/85 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15'
const primary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.28)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/18 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'

function formatCoins(value: number | null | undefined) {
  return Number(value || 0).toLocaleString()
}

function _formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return '—'
  }
}

export default function AuctionBidders() {
  const { user } = useAuthStore()

  const [auctioneerId, setAuctioneerId] = useState<string | null>(null)
  const [_showIds, setShowIds] = useState<string[]>([])
  const [winners, setWinners] = useState<AuctionWinner[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [batching, setBatching] = useState(false)
  const [filterMulti, setFilterMulti] = useState(false)

  const fetchWinners = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // Get auctioneer profile
      const { data: auctioneer } = await supabase
        .from('auctioneer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!auctioneer?.id) {
        toast.error('You must be an approved auctioneer')
        setLoading(false)
        return
      }

      setAuctioneerId(auctioneer.id)

      // Get all shows for this auctioneer
      const { data: shows } = await supabase
        .from('auction_shows')
        .select('id, title')
        .eq('auctioneer_id', auctioneer.id)

      const sIds = (shows || []).map((s) => s.id)
      setShowIds(sIds)

      if (sIds.length === 0) {
        setWinners([])
        setLoading(false)
        return
      }

      // Get all sold lots with winner info
      const { data: soldLots } = await supabase
        .from('auction_lots')
        .select(`
          id,
          title,
          image_url,
          starting_bid,
          current_highest_bid,
          winner_user_id,
          auction_show_id,
          condition,
          shipping_base_price
        `)
        .in('auction_show_id', sIds)
        .eq('status', 'sold')
        .not('winner_user_id', 'is', null)
        .order('queue_position', { ascending: true })

      if (!soldLots || soldLots.length === 0) {
        setWinners([])
        setLoading(false)
        return
      }

      // Get unique winner user IDs
      const winnerIds = [...new Set(soldLots.map((l) => l.winner_user_id).filter(Boolean))] as string[]

      // Fetch user profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, email')
        .in('id', winnerIds)

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]))

      const lotIds = soldLots.map((lot) => lot.id)
      const { data: existingOrders } = await supabase
        .from('auction_orders')
        .select('id, lot_id, batch_id, payment_status, fulfillment_status, shipping_cost')
        .in('lot_id', lotIds)

      const orderMap = new Map((existingOrders || []).map((o: any) => [o.lot_id, o]))

      // Group wins by user
      const winnerMap = new Map<string, AuctionWinner>()

      for (const lot of soldLots) {
        const uid = lot.winner_user_id!
        const profile = profileMap.get(uid)
        const show = shows?.find((s) => s.id === lot.auction_show_id)
        const existingOrder = orderMap.get(lot.id)

        const win: AuctionWin = {
          lot_id: lot.id,
          lot_title: lot.title,
          lot_image_url: lot.image_url,
          final_bid: Number(existingOrder?.sale_amount ?? lot.current_highest_bid ?? lot.starting_bid ?? 0),
          show_id: lot.auction_show_id,
          show_title: show?.title || 'Unknown Show',
          won_at: new Date().toISOString(),
          payment_status: (existingOrder?.payment_status as AuctionWin['payment_status']) || 'pending',
          fulfillment_status: existingOrder?.fulfillment_status || null,
          shipping_cost: Number(existingOrder?.shipping_cost ?? lot.shipping_base_price ?? 0),
          shipping_name: null,
          shipping_address: null,
          shipping_city: null,
          shipping_state: null,
          shipping_zip: null,
          shipping_carrier: null,
          tracking_number: null,
          shipped_at: null,
          delivered_at: null,
          batch_id: existingOrder?.batch_id || null,
        }

        if (winnerMap.has(uid)) {
          const existing = winnerMap.get(uid)!
          existing.wins.push(win)
          existing.total_owed += win.final_bid
          existing.total_items += 1
        } else {
          winnerMap.set(uid, {
            user_id: uid,
            username: profile?.username || 'Unknown User',
            avatar_url: profile?.avatar_url || null,
            email: profile?.email || null,
            wins: [win],
            total_owed: win.final_bid,
            total_items: 1,
            batch_status: win.batch_id ? 'batched' : 'none',
            batch_id: win.batch_id,
          })
        }
      }

      setWinners(Array.from(winnerMap.values()))
    } catch (error: any) {
      console.error('[AuctionBidders] Error:', error)
      toast.error('Failed to load bidder data')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchWinners()
  }, [fetchWinners])

  const filteredWinners = useMemo(() => {
    let result = winners

    if (filterMulti) {
      result = result.filter((w) => w.total_items > 1)
    }

    const query = searchQuery.trim().toLowerCase()
    if (query) {
      result = result.filter(
        (w) =>
          w.username?.toLowerCase().includes(query) ||
          w.user_id.toLowerCase().includes(query) ||
          w.email?.toLowerCase().includes(query)
      )
    }

    return result.sort((a, b) => b.total_items - a.total_items)
  }, [winners, filterMulti, searchQuery])

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const selectAllMulti = () => {
    const multiUserIds = filteredWinners.filter((w) => w.total_items > 1).map((w) => w.user_id)
    setSelectedUsers(new Set(multiUserIds))
  }

  const clearSelection = () => {
    setSelectedUsers(new Set())
  }

  const batchOrders = async () => {
    if (selectedUsers.size === 0) {
      toast.error('Select at least one bidder to batch')
      return
    }

    setBatching(true)
    try {
      // Create batch orders for each selected user
      for (const userId of selectedUsers) {
        const winner = winners.find((w) => w.user_id === userId)
        if (!winner || winner.wins.length <= 1) continue

        const batchId = crypto.randomUUID()

        for (const win of winner.wins) {
          const { error: updateError, count } = await supabase
            .from('auction_orders')
            .update({
              batch_id: batchId,
              fulfillment_status: 'pending',
            })
            .eq('lot_id', win.lot_id)

          if (updateError) {
            console.error('[AuctionBidders] Batch update error:', updateError)
          }

          if (count === 0) {
            const { error: insertError } = await supabase.from('auction_orders').insert({
              auction_show_id: win.show_id,
              lot_id: win.lot_id,
              winner_user_id: userId,
              auctioneer_id: auctioneerId,
              sale_amount: win.final_bid,
              shipping_cost: win.shipping_cost || 0,
              batch_id: batchId,
              payment_status: 'held',
              fulfillment_status: 'pending',
            })

            if (insertError) {
              console.error('[AuctionBidders] Batch insert error:', insertError)
            }
          }
        }
      }

      toast.success(`Batched orders for ${selectedUsers.size} bidder(s)`)
      clearSelection()
      await fetchWinners()
    } catch (error: any) {
      console.error('[AuctionBidders] Batch error:', error)
      toast.error('Failed to batch orders')
    } finally {
      setBatching(false)
    }
  }

  const multiWinnersCount = useMemo(() => winners.filter((w) => w.total_items > 1).length, [winners])
  const totalOwed = useMemo(() => winners.reduce((sum, w) => sum + w.total_owed, 0), [winners])

  return (
    <div className={shell}>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_32%),radial-gradient(circle_at_75%_20%,rgba(59,130,246,0.12),transparent_26%)]" />

      <main className="relative z-10 mx-auto max-w-[1400px] space-y-4">
        <AuctionNav active="bidders" />

        {/* Header */}
        <header className={cn(panel, 'overflow-hidden p-5')}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-black text-white md:text-4xl">Bidders & Winners</h1>
              <p className="mt-1 text-sm text-slate-400">
                View all winning bidders, batch multi-item orders, and manage fulfillment.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Winners</p>
                <p className="text-2xl font-black text-cyan-100">{winners.length}</p>
              </div>
              <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Multi-Wins</p>
                <p className="text-2xl font-black text-amber-200">{multiWinnersCount}</p>
              </div>
              <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Owed</p>
                <p className="text-2xl font-black text-emerald-200">{formatCoins(totalOwed)}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Toolbar */}
        <div className={cn(panel, 'p-4')}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username, email, or user ID..."
                  className={cn(input, 'pl-10')}
                />
              </div>
              <button
                onClick={() => setFilterMulti(!filterMulti)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition',
                  filterMulti
                    ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
                    : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-400/10'
                )}
              >
                <Users className="h-4 w-4" />
                Multi-Wins Only
              </button>
            </div>

            {selectedUsers.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-300">
                  {selectedUsers.size} selected
                </span>
                <button
                  onClick={batchOrders}
                  disabled={batching}
                  className={cn(primary, 'text-sm')}
                >
                  {batching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingBag className="h-4 w-4" />
                  )}
                  Batch {selectedUsers.size} Order{selectedUsers.size > 1 ? 's' : ''}
                </button>
                <button onClick={clearSelection} className={secondary}>
                  <X className="h-4 w-4" />
                  Clear
                </button>
              </div>
            )}
          </div>

          {multiWinnersCount > 0 && selectedUsers.size === 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-400/5 px-4 py-2">
              <ShoppingBag className="h-4 w-4 text-amber-300" />
              <span className="text-sm text-amber-200">
                <strong>{multiWinnersCount}</strong> bidder{multiWinnersCount > 1 ? 's' : ''} won multiple items.
                Select them to batch into a single order for easier shipping.
              </span>
              <button onClick={selectAllMulti} className="ml-auto text-sm font-bold text-amber-300 underline">
                Select All Multi-Winners
              </button>
            </div>
          )}
        </div>

        {/* Winners list */}
        <div className={cn(panel, 'p-4')}>
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-cyan-300" />
                <p className="text-sm text-slate-500">Loading winners...</p>
              </div>
            </div>
          ) : filteredWinners.length === 0 ? (
            <div className="flex min-h-[300px] items-center justify-center text-center">
              <div>
                <Users className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                <p className="font-black text-white">No winners yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  Winners will appear here when lots are marked as sold.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWinners.map((winner) => (
                <WinnerCard
                  key={winner.user_id}
                  winner={winner}
                  isExpanded={expandedUser === winner.user_id}
                  isSelected={selectedUsers.has(winner.user_id)}
                  onToggleExpand={() =>
                    setExpandedUser((prev) => (prev === winner.user_id ? null : winner.user_id))
                  }
                  onToggleSelect={() => toggleSelectUser(winner.user_id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function WinnerCard({
  winner,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
}: {
  winner: AuctionWinner
  isExpanded: boolean
  isSelected: boolean
  onToggleExpand: () => void
  onToggleSelect: () => void
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border transition',
        isSelected
          ? 'border-cyan-300/40 bg-cyan-400/8'
          : 'border-white/10 bg-white/[0.03] hover:border-cyan-300/15'
      )}
    >
      {/* Summary row */}
      <div className="flex cursor-pointer items-center gap-4 p-4" onClick={onToggleExpand}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect()}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-cyan-300/30 accent-cyan-400"
        />

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#07101f]">
          {winner.avatar_url ? (
            <img src={winner.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <User className="h-5 w-5 text-slate-500" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-white">{winner.username || 'Unknown User'}</h3>
            {winner.total_items > 1 && (
              <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-100">
                {winner.total_items} items — batchable
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">{winner.user_id}</p>
        </div>

        <div className="hidden text-right sm:block">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Items Won</p>
          <p className="text-lg font-black text-white">{winner.total_items}</p>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Owed</p>
          <p className="text-lg font-black text-cyan-100">{formatCoins(winner.total_owed)}</p>
        </div>

        {isExpanded ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
        )}
      </div>

      {/* Expanded: show each won item */}
      {isExpanded && (
        <div className="border-t border-white/8 px-4 pb-4 pt-3">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-300">
            <ClipboardList className="h-4 w-4" />
            Won Items ({winner.wins.length})
          </h4>
          <div className="space-y-2">
            {winner.wins.map((win, idx) => (
              <div
                key={win.lot_id}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#07101f] text-xs font-bold text-slate-400">
                  {idx + 1}
                </div>

                <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#07101f]">
                  {win.lot_image_url ? (
                    <img src={win.lot_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-5 w-5 text-slate-600" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{win.lot_title}</p>
                  <p className="text-xs text-slate-500">{win.show_title}</p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Winning Bid</p>
                  <p className="text-sm font-black text-cyan-100">{formatCoins(win.final_bid)}</p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Status</p>
                  <span
                    className={cn(
                      'inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                      win.payment_status === 'paid'
                        ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
                        : 'border-amber-300/25 bg-amber-400/10 text-amber-100'
                    )}
                  >
                    {win.payment_status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {winner.total_items > 1 && (
            <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-400/5 p-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-amber-300" />
                <span className="text-sm font-bold text-amber-200">
                  This bidder won {winner.total_items} items totaling {formatCoins(winner.total_owed)} coins.
                </span>
              </div>
              <p className="mt-1 text-xs text-amber-300/70">
                Select this bidder above to batch all items into a single order for combined shipping.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
