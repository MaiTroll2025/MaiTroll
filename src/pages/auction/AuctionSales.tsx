import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, DollarSign, Loader2, Package, Scan, Search, Send, Truck, Users, X } from 'lucide-react';
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner'

import AuctionNav from './AuctionNav'

type ShippingCarrier = 'usps' | 'ups' | 'fedex' | 'dhl' | 'other'

interface SaleRecord {
  id: string
  order_number: string
  lot_id: string
  lot_title: string
  lot_image_url: string | null
  show_id: string
  show_title: string
  winner_user_id: string
  winner_username: string | null
  winner_avatar_url: string | null
  final_bid: number
  shipping_cost: number
  payment_status: 'pending' | 'held' | 'paid' | 'refunded' | 'failed' | 'disputed'
  fulfillment_status: 'pending' | 'packed' | 'ready_to_ship' | 'shipped' | 'delivered' | 'disputed' | 'awaiting_fulfillment' | 'cancelled'
  shipping_name: string | null
  shipping_address: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  shipping_carrier: string | null
  tracking_number: string | null
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
  batch_id: string | null
}

const CARRIERS: { id: ShippingCarrier; name: string }[] = [
  { id: 'usps', name: 'USPS' },
  { id: 'ups', name: 'UPS' },
  { id: 'fedex', name: 'FedEx' },
  { id: 'dhl', name: 'DHL' },
  { id: 'other', name: 'Other' },
]

const FULFILLMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'border-slate-400/30 bg-slate-500/10 text-slate-200' },
  packed: { label: 'Packed', color: 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100' },
  ready_to_ship: { label: 'Ready to Ship', color: 'border-amber-300/30 bg-amber-400/10 text-amber-100' },
  awaiting_fulfillment: { label: 'Awaiting Shipment', color: 'border-amber-300/30 bg-amber-400/10 text-amber-100' },
  shipped: { label: 'Shipped', color: 'border-purple-300/30 bg-purple-400/10 text-purple-100' },
  delivered: { label: 'Delivered', color: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' },
  disputed: { label: 'Disputed', color: 'border-orange-300/30 bg-orange-400/10 text-orange-100' },
  cancelled: { label: 'Cancelled', color: 'border-red-300/30 bg-red-500/10 text-red-100' },
}

const shell =
  'relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#07101f] px-3 pb-8 pt-20 text-white sm:px-4 md:px-6'
const panel =
  'rounded-[1.65rem] border border-cyan-300/15 bg-[#0b1628]/85 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const input =
  'w-full rounded-xl border border-cyan-300/20 bg-[#07101f]/85 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15'
const primary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.28)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/18 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'

function formatCoins(value: number | null | undefined) {
  return Number(value || 0).toLocaleString()
}

function formatDate(value: string | null | undefined) {
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

export default function AuctionSales() {
  const { user } = useAuthStore()

  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [scanInput, setScanInput] = useState('')
  const [scanResult, setScanResult] = useState<SaleRecord[] | null>(null)

  // Shipping modal
  const [shippingModal, setShippingModal] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState<ShippingCarrier>('usps')
  const [submittingShipping, setSubmittingShipping] = useState(false)

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return
    try {
      const { data, error } = await supabase.rpc('scan_lot_barcode', { p_barcode: barcode.trim() })
      if (error) throw error
      const result = data as any
      if (result?.found && result?.order) {
        const matched = sales.filter((s) => s.winner_user_id === result.order.winner_user_id)
        setScanResult(matched.length > 0 ? matched : [sales.find((s) => s.lot_id === result.lot.id)].filter(Boolean) as SaleRecord[])
        setSearchQuery(result.order.winner_username || '')
        toast.success(`Found orders for @${result.order.winner_username || 'user'}`)
      } else {
        toast.error('Lot not found')
        setScanResult(null)
      }
    } catch (error: any) {
      toast.error(error?.message || 'Scan failed')
      setScanResult(null)
    }
  }, [sales, supabase])

  useBarcodeScanner({
    minLength: 3,
    onScan: handleBarcodeScan,
  })

  const submitScan = () => {
    if (scanInput.trim()) handleBarcodeScan(scanInput.trim())
  }

  const fetchSales = useCallback(async () => {
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
        setLoading(false)
        return
      }

      // Get all shows
      const { data: shows } = await supabase
        .from('auction_shows')
        .select('id, title')
        .eq('auctioneer_id', auctioneer.id)

      const showIds = (shows || []).map((s) => s.id)
      if (showIds.length === 0) {
        setSales([])
        setLoading(false)
        return
      }

      // Get all sold lots
      const { data: orders } = await supabase
        .from('auction_orders')
        .select(`
          id,
          order_number,
          auction_show_id,
          lot_id,
          winner_user_id,
          sale_amount,
          shipping_cost,
          payment_status,
          fulfillment_status,
          shipping_name,
          shipping_line1,
          shipping_line2,
          shipping_city,
          shipping_state,
          shipping_zip,
          shipping_carrier,
          tracking_number,
          shipped_at,
          delivered_at,
          batch_id,
          created_at,
          auction_lots (
            title,
            image_urls
          ),
          auction_shows (
            title
          )
        `)
        .in('auction_show_id', showIds)
        .order('created_at', { ascending: false })

      if (!orders || orders.length === 0) {
        setSales([])
        setLoading(false)
        return
      }

      const winnerIds = [...new Set(orders.map((o) => o.winner_user_id).filter(Boolean))] as string[]

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .in('id', winnerIds)

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]))

      const saleRecords: SaleRecord[] = (orders || []).map((order: any) => {
        const profile = profileMap.get(order.winner_user_id)
        return {
          id: order.id,
          order_number: order.order_number,
          lot_id: order.lot_id,
          lot_title: order.auction_lots?.title || 'Unknown Item',
          lot_image_url: order.auction_lots?.image_urls?.[0] || null,
          show_id: order.auction_show_id,
          show_title: order.auction_shows?.title || 'Unknown',
          winner_user_id: order.winner_user_id,
          winner_username: profile?.username || 'Unknown',
          winner_avatar_url: profile?.avatar_url || null,
          final_bid: Number(order.sale_amount || 0),
          shipping_cost: Number(order.shipping_cost || 0),
          payment_status: order.payment_status,
          fulfillment_status: order.fulfillment_status || 'pending',
          shipping_name: order.shipping_name,
          shipping_address: order.shipping_line1,
          shipping_city: order.shipping_city,
          shipping_state: order.shipping_state,
          shipping_zip: order.shipping_zip,
          shipping_carrier: order.shipping_carrier,
          tracking_number: order.tracking_number,
          shipped_at: order.shipped_at,
          delivered_at: order.delivered_at,
          created_at: order.created_at,
          batch_id: order.batch_id,
        }
      })

      setSales(saleRecords)
    } catch (error: any) {
      console.error('[AuctionSales] Error:', error)
      toast.error('Failed to load sales data')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchSales()
  }, [fetchSales])

  const groupedSales = useMemo(() => {
    let base = sales

    if (filterStatus !== 'all') {
      base = base.filter((s) => s.fulfillment_status === filterStatus)
    }

    const query = searchQuery.trim().toLowerCase()
    if (query) {
      base = base.filter(
        (s) =>
          s.lot_title.toLowerCase().includes(query) ||
          s.winner_username?.toLowerCase().includes(query) ||
          s.winner_user_id.toLowerCase().includes(query)
      )
    }

    if (scanResult) {
      base = scanResult
    }

    const groups = new Map<string, SaleRecord[]>()
    for (const sale of base) {
      const key = sale.winner_user_id || 'unknown'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(sale)
    }
    return Array.from(groups.entries()).map(([userId, sales]) => ({
      userId,
      username: sales[0]?.winner_username || 'Unknown',
      sales: sales.sort((a, b) => {
        const statusOrder: Record<string, number> = {
          pending: 0, awaiting_fulfillment: 1, ready_to_ship: 1, packed: 1, shipped: 2, delivered: 3, disputed: 4, cancelled: 5,
        }
        return (statusOrder[a.fulfillment_status] || 0) - (statusOrder[b.fulfillment_status] || 0)
      }),
    }))
  }, [sales, filterStatus, searchQuery, scanResult])

  const stats = useMemo(() => {
    return {
      total: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + s.final_bid + s.shipping_cost, 0),
      pending: sales.filter((s) => s.fulfillment_status === 'pending').length,
      awaiting: sales.filter((s) => s.fulfillment_status === 'awaiting_fulfillment' || s.fulfillment_status === 'ready_to_ship').length,
      shipped: sales.filter((s) => s.fulfillment_status === 'shipped').length,
      delivered: sales.filter((s) => s.fulfillment_status === 'delivered').length,
    }
  }, [sales])

  const openShippingModal = (sale: SaleRecord) => {
    setSelectedSale(sale)
    setTrackingNumber(sale.tracking_number || '')
    setCarrier((sale.shipping_carrier as ShippingCarrier) || 'usps')
    setShippingModal(true)
  }

  const submitShipping = async () => {
    if (!selectedSale || !trackingNumber.trim()) {
      toast.error('Tracking number is required')
      return
    }

    setSubmittingShipping(true)
    try {
      const { error } = await supabase.rpc('update_order_fulfillment', {
        p_order_id: selectedSale.id,
        p_status: 'shipped',
        p_tracking_number: trackingNumber.trim(),
        p_carrier: carrier,
      })

      if (error) throw error

      toast.success('Shipping info saved! Buyer can now track their order.')
      setShippingModal(false)
      await fetchSales()
    } catch (error: any) {
      console.error('[AuctionSales] Shipping error:', error)
      toast.error('Failed to save shipping info')
    } finally {
      setSubmittingShipping(false)
    }
  }

  const markDelivered = async (sale: SaleRecord) => {
    try {
      const { error } = await supabase.rpc('update_order_fulfillment', {
        p_order_id: sale.id,
        p_status: 'delivered',
      })

      if (error) throw error

      toast.success('Marked as delivered')
      await fetchSales()
    } catch (_error: any) {
      toast.error('Failed to update status')
    }
  }

  return (
    <div className={shell}>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_32%),radial-gradient(circle_at_75%_20%,rgba(59,130,246,0.12),transparent_26%)]" />

      <main className="relative z-10 mx-auto max-w-[1400px] space-y-4">
        <AuctionNav active="sales" />

        {/* Header */}
        <header className={cn(panel, 'overflow-hidden p-5')}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-black text-white md:text-4xl">Sales & Fulfillment</h1>
              <p className="mt-1 text-sm text-slate-400">
                Track all auction sales, provide tracking info, and manage order fulfillment.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Sales</p>
                <p className="text-2xl font-black text-cyan-100">{stats.total}</p>
              </div>
              <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/5 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Revenue</p>
                <p className="text-2xl font-black text-emerald-200">{formatCoins(stats.totalRevenue)}</p>
              </div>
              <div className="rounded-xl border border-amber-300/15 bg-amber-400/5 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">To Ship</p>
                <p className="text-2xl font-black text-amber-200">{stats.awaiting + stats.pending}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Status filter tabs */}
        <div className={cn(panel, 'p-4')}>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'all', label: 'All Sales', count: stats.total },
              { key: 'pending', label: 'Pending', count: stats.pending },
              { key: 'awaiting_fulfillment', label: 'Awaiting Shipment', count: stats.awaiting },
              { key: 'fulfilled', label: 'Shipped', count: stats.shipped },
              { key: 'delivered', label: 'Delivered', count: stats.delivered },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition',
                  filterStatus === tab.key
                    ? 'border-cyan-300/30 bg-cyan-400/12 text-cyan-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-cyan-300/20 hover:text-slate-200'
                )}
              >
                {tab.label}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{tab.count}</span>
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sales..."
                  className={cn(input, 'w-64 pl-10')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sales list */}
        <div className={cn(panel, 'p-4')}>
          {/* Barcode scanner */}
          <div className="mb-4 rounded-xl border border-cyan-300/10 bg-cyan-400/5 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-cyan-100">
              <Scan className="h-4 w-4" />
              Scan Barcode to Find Orders
            </div>
            <p className="mt-1 text-xs text-slate-400">Scan an item barcode to look up the winner&apos;s orders.</p>
            <div className="mt-2 flex gap-2">
              <input
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitScan()}
                placeholder="Scan or enter barcode..."
                className={cn(input, 'flex-1')}
              />
              <button onClick={submitScan} disabled={!scanInput.trim()} className={secondary}>
                <Search className="h-4 w-4" /> Find
              </button>
              {scanResult && (
                <button onClick={() => { setScanResult(null); setSearchQuery('') }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-cyan-100">Clear</button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-cyan-300" />
                <p className="text-sm text-slate-500">Loading sales...</p>
              </div>
            </div>
          ) : groupedSales.length === 0 ? (
            <div className="flex min-h-[300px] items-center justify-center text-center">
              <div>
                <DollarSign className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                <p className="font-black text-white">No sales found</p>
                <p className="mt-2 text-sm text-slate-500">
                  Sales will appear here when lots are marked as sold.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedSales.map((group) => (
                <div key={group.userId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10">
                        <Users className="h-4 w-4 text-cyan-300" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">@{group.username}</p>
                        <p className="text-[10px] text-slate-500">{group.sales.length} item(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">
                        Total: {formatCoins(group.sales.reduce((sum, s) => sum + s.final_bid + s.shipping_cost, 0))} TC
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {group.sales.map((sale) => (
                      <SaleCard
                        key={sale.id}
                        sale={sale}
                        onOpenShipping={() => openShippingModal(sale)}
                        onMarkDelivered={() => markDelivered(sale)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Shipping Modal */}
      {shippingModal && selectedSale && (
        <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className={cn(panel, 'w-full max-w-lg p-6')}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Add Tracking</p>
                <h2 className="mt-1 text-xl font-black text-white">{selectedSale.lot_title} · {selectedSale.order_number}</h2>
              </div>
              <button
                onClick={() => setShippingModal(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-bold text-slate-400">Winner</p>
              <p className="text-sm font-black text-white">{selectedSale.winner_username}</p>
              <p className="mt-2 text-xs font-bold text-slate-400">Amount</p>
              <p className="text-lg font-black text-cyan-100">{formatCoins(selectedSale.final_bid)} coins</p>
              <p className="text-xs text-slate-500">Shipping {formatCoins(selectedSale.shipping_cost)} TC</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-cyan-100">Shipping Carrier</label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value as ShippingCarrier)}
                  className={input}
                >
                  {CARRIERS.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-950">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-cyan-100">Tracking Number</label>
                <input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number..."
                  className={input}
                />
              </div>

              <button
                onClick={submitShipping}
                disabled={submittingShipping || !trackingNumber.trim()}
                className={cn(primary, 'w-full')}
              >
                {submittingShipping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Save & Notify Buyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SaleCard({
  sale,
  onOpenShipping,
  onMarkDelivered,
}: {
  sale: SaleRecord
  onOpenShipping: () => void
  onMarkDelivered: () => void
}) {
  const statusConfig = FULFILLMENT_STATUS_CONFIG[sale.fulfillment_status] || FULFILLMENT_STATUS_CONFIG.pending

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-300/15">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Item image */}
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#07101f]">
          {sale.lot_image_url ? (
            <img src={sale.lot_image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-6 w-6 text-slate-600" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-black text-white">{sale.lot_title}</h3>
            {sale.batch_id && (
              <span className="rounded-full border border-purple-300/25 bg-purple-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-purple-100">
                Batched
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Winner: <span className="font-bold text-slate-300">{sale.winner_username}</span> · {sale.show_title}
          </p>
          {sale.tracking_number && (
            <p className="mt-1 text-xs text-slate-500">
              Tracking: <span className="font-bold text-cyan-300">{sale.tracking_number}</span>
              {sale.shipping_carrier && (
                <span className="ml-1 text-slate-400">({sale.shipping_carrier.toUpperCase()})</span>
              )}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-slate-500">Sale Price</p>
          <p className="text-lg font-black text-cyan-100">{formatCoins(sale.final_bid)}</p>
          <p className="text-xs text-slate-500">Shipping {formatCoins(sale.shipping_cost)} TC</p>
          <div className="text-right mt-2">
            <span className={cn('inline-block rounded-full border px-3 py-1 text-[10px] font-black uppercase', statusConfig.color)}>
              {statusConfig.label}
            </span>
          </div>
        </div>

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
        {(sale.fulfillment_status === 'pending' || sale.fulfillment_status === 'awaiting_fulfillment' || sale.fulfillment_status === 'ready_to_ship' || sale.fulfillment_status === 'packed') && (
          <button onClick={onOpenShipping} className={cn(primary, 'text-sm')}>
            <Truck className="h-4 w-4" />
            Add Tracking & Ship
          </button>
        )}

        {sale.fulfillment_status === 'shipped' && (
          <button onClick={onMarkDelivered} className={cn(secondary, 'text-sm')}>
            <CheckCircle2 className="h-4 w-4" />
            Mark Delivered
          </button>
        )}

        {sale.fulfillment_status === 'delivered' && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
            <Check className="h-3.5 w-3.5" />
            Completed
          </span>
        )}

        <div className="flex-1" />

        <span className="text-xs text-slate-500">
          {sale.shipped_at ? `Shipped ${formatDate(sale.shipped_at)}` : formatDate(sale.created_at)}
        </span>
      </div>
      </div>
    </div>
  )
}
