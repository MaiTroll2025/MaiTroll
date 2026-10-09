import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Clock, Coins, Package, RefreshCw, Search, ShoppingBag, Truck } from 'lucide-react';
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'

type PaymentStatus = 'pending' | 'held' | 'paid' | 'refunded' | 'failed' | 'disputed'
type FulfillmentStatus = 'pending' | 'packed' | 'ready_to_ship' | 'shipped' | 'delivered' | 'disputed'

interface Order {
  id: string
  order_number: string
  auction_show_id: string
  lot_id: string
  lot_title: string
  lot_number: string | null
  lot_image_url: string | null
  show_title: string
  winner_user_id: string
  winner_username: string | null
  winner_avatar_url: string | null
  sale_amount: number
  payment_status: PaymentStatus
  fulfillment_status: FulfillmentStatus
  shipping_name: string | null
  shipping_line1: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  shipping_carrier: string | null
  tracking_number: string | null
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
}

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'border-slate-400/30 bg-slate-500/10 text-slate-200' },
  held: { label: 'Held in Escrow', color: 'border-amber-300/30 bg-amber-400/10 text-amber-100' },
  paid: { label: 'Paid', color: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' },
  refunded: { label: 'Refunded', color: 'border-red-300/30 bg-red-400/10 text-red-100' },
  failed: { label: 'Failed', color: 'border-red-300/30 bg-red-400/10 text-red-100' },
  disputed: { label: 'Disputed', color: 'border-orange-300/30 bg-orange-400/10 text-orange-100' },
}

const FULFILLMENT_STATUS_CONFIG: Record<FulfillmentStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'border-slate-400/30 bg-slate-500/10 text-slate-200' },
  packed: { label: 'Packed', color: 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100' },
  ready_to_ship: { label: 'Ready to Ship', color: 'border-blue-300/30 bg-blue-400/10 text-blue-100' },
  shipped: { label: 'Shipped', color: 'border-purple-300/30 bg-purple-400/10 text-purple-100' },
  delivered: { label: 'Delivered', color: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' },
  disputed: { label: 'Disputed', color: 'border-orange-300/30 bg-orange-400/10 text-orange-100' },
}

const TABS = [
  { id: 'all', label: 'All Orders' },
  { id: 'pending_payment', label: 'Pending Payment' },
  { id: 'paid', label: 'Paid' },
  { id: 'packed', label: 'Packed' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'disputed', label: 'Disputed' },
] as const

const shell =
  'relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#07101f] px-3 pb-8 pt-20 text-white sm:px-4 md:px-6'
const panel =
  'rounded-[1.65rem] border border-cyan-300/15 bg-[#0b1628]/85 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const input =
  'w-full rounded-xl border border-cyan-300/20 bg-[#07101f]/85 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15'
const _primary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.28)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'
const _secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/18 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
const ghost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50'
const _danger =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-100 transition hover:bg-red-500/20'

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

export default function AuctionOrders() {
  const { user } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<string>('all')
  const [_auctioneerId, setAuctioneerId] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }

    setLoading(true)
    try {
      const { data: auctioneer } = await supabase
        .from('auctioneer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!auctioneer?.id) { setLoading(false); return }
      setAuctioneerId(auctioneer.id)

      const { data } = await supabase
        .from('auction_orders')
        .select(`
          *,
          auction_lots (
            title,
            lot_number,
            image_urls
          ),
          auction_shows (
            title
          )
        `)
        .eq('auctioneer_id', auctioneer.id)
        .order('created_at', { ascending: false })

      const mapped: Order[] = (data || []).map((row: any) => ({
        id: row.id,
        order_number: row.order_number,
        auction_show_id: row.auction_show_id,
        lot_id: row.lot_id,
        lot_title: row.auction_lots?.title || 'Unknown Item',
        lot_number: row.auction_lots?.lot_number || null,
        lot_image_url: row.auction_lots?.image_urls?.[0] || null,
        show_title: row.auction_shows?.title || 'Unknown Show',
        winner_user_id: row.winner_user_id,
        winner_username: null,
        winner_avatar_url: null,
        sale_amount: Number(row.sale_amount || 0),
        payment_status: row.payment_status,
        fulfillment_status: row.fulfillment_status,
        shipping_name: row.shipping_name,
        shipping_line1: row.shipping_line1,
        shipping_city: row.shipping_city,
        shipping_state: row.shipping_state,
        shipping_zip: row.shipping_zip,
        shipping_carrier: row.shipping_carrier,
        tracking_number: row.tracking_number,
        shipped_at: row.shipped_at,
        delivered_at: row.delivered_at,
        created_at: row.created_at,
      }))

      // Fetch winner profiles
      const winnerIds = [...new Set(mapped.map(o => o.winner_user_id).filter(Boolean))]
      if (winnerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', winnerIds)

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
        mapped.forEach(o => {
          const p = profileMap.get(o.winner_user_id) as any
          if (p) {
            o.winner_username = p.username
            o.winner_avatar_url = p.avatar_url
          }
        })
      }

      setOrders(mapped)
    } catch (error: any) {
      console.error('[AuctionOrders] fetch error:', error)
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { void fetchOrders() }, [fetchOrders])

  const filteredOrders = useMemo(() => {
    let result = orders

    // Tab filter
    if (activeTab === 'pending_payment') result = result.filter(o => o.payment_status === 'pending' || o.payment_status === 'held')
    else if (activeTab === 'paid') result = result.filter(o => o.payment_status === 'paid')
    else if (activeTab === 'packed') result = result.filter(o => o.fulfillment_status === 'packed')
    else if (activeTab === 'shipped') result = result.filter(o => o.fulfillment_status === 'shipped')
    else if (activeTab === 'delivered') result = result.filter(o => o.fulfillment_status === 'delivered')
    else if (activeTab === 'disputed') result = result.filter(o => o.payment_status === 'disputed' || o.fulfillment_status === 'disputed')

    // Search
    const q = query.trim().toLowerCase()
    if (q) {
      result = result.filter(o =>
        o.order_number?.toLowerCase().includes(q) ||
        o.lot_title?.toLowerCase().includes(q) ||
        o.winner_username?.toLowerCase().includes(q) ||
        o.lot_number?.toLowerCase().includes(q)
      )
    }

    return result
  }, [orders, activeTab, query])

  const stats = useMemo(() => ({
    total: orders.length,
    pending_payment: orders.filter(o => o.payment_status === 'pending' || o.payment_status === 'held').length,
    packed: orders.filter(o => o.fulfillment_status === 'packed').length,
    shipped: orders.filter(o => o.fulfillment_status === 'shipped').length,
    delivered: orders.filter(o => o.fulfillment_status === 'delivered').length,
    total_revenue: orders.reduce((s, o) => s + Number(o.sale_amount || 0), 0),
  }), [orders])

  const updateFulfillmentStatus = async (orderId: string, status: FulfillmentStatus) => {
    try {
      const { error } = await supabase.rpc('update_order_fulfillment', {
        p_order_id: orderId,
        p_status: status,
      })
      if (error) throw error
      toast.success(`Order marked as ${status}`)
      await fetchOrders()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update order')
    }
  }

  return (
    <div className={shell}>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_32%)]" />

      <main className="relative z-10 mx-auto max-w-[1400px] space-y-4">
        <header className={cn(panel, 'p-5')}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">Order Management</h1>
              <p className="mt-1 text-sm text-slate-400">Track all auction orders, payments, and fulfillment.</p>
            </div>
            <button onClick={() => fetchOrders()} className={ghost}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat icon={<ShoppingBag className="h-5 w-5" />} label="Total Orders" value={stats.total} />
            <Stat icon={<Clock className="h-5 w-5" />} label="Pending" value={stats.pending_payment} />
            <Stat icon={<Package className="h-5 w-5" />} label="Packed" value={stats.packed} />
            <Stat icon={<Truck className="h-5 w-5" />} label="Shipped" value={stats.shipped} />
            <Stat icon={<Coins className="h-5 w-5" />} label="Revenue" value={`${formatCoins(stats.total_revenue)} TC`} />
          </div>
        </header>

        <section className={cn(panel, 'p-4')}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-xs font-bold transition',
                    activeTab === tab.id
                      ? 'border border-cyan-300/30 bg-cyan-400/12 text-cyan-100'
                      : 'border border-white/10 bg-white/[0.035] text-slate-400 hover:text-cyan-100'
                  )}
                >
                  {tab.label}
                  {tab.id === 'all' && orders.length > 0 && (
                    <span className="ml-1 text-slate-500">({orders.length})</span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-3.4 h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search orders..."
                className={cn(input, 'pl-10')}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-cyan-300" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-20 text-center">
              <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <p className="text-lg font-bold text-slate-400">No orders found</p>
              <p className="mt-1 text-sm text-slate-600">Orders are created when lots are sold.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  expanded={expandedOrder === order.id}
                  onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  onUpdateStatus={updateFulfillmentStatus}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function OrderCard({
  order,
  expanded,
  onToggle,
  onUpdateStatus,
}: {
  order: Order
  expanded: boolean
  onToggle: () => void
  onUpdateStatus: (orderId: string, status: FulfillmentStatus) => void
}) {
  const payCfg = PAYMENT_STATUS_CONFIG[order.payment_status] || PAYMENT_STATUS_CONFIG.pending
  const fulfillCfg = FULFILLMENT_STATUS_CONFIG[order.fulfillment_status] || FULFILLMENT_STATUS_CONFIG.pending

  return (
    <div className="rounded-2xl border border-cyan-300/10 bg-[#0a1425]/80 p-4 transition hover:border-cyan-300/20">
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#07101f]">
            {order.lot_image_url ? (
              <img src={order.lot_image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-6 w-6 text-slate-600" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-white">{order.order_number}</span>
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', payCfg.color)}>
                {payCfg.label}
              </span>
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', fulfillCfg.color)}>
                {fulfillCfg.label}
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm text-slate-300">{order.lot_title}</p>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
              <span>{order.lot_number}</span>
              <span>→ @{order.winner_username || order.winner_user_id}</span>
              <span>{formatCoins(order.sale_amount)} TC</span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-lg font-black text-cyan-100">{formatCoins(order.sale_amount)}</p>
            <p className="text-[10px] text-slate-500">{formatDate(order.created_at)}</p>
          </div>

          <ChevronDown className={cn('h-5 w-5 text-slate-500 transition', expanded && 'rotate-180')} />
        </div>
      </button>

      {expanded && (
        <div className="mt-4 grid gap-4 border-t border-cyan-300/10 pt-4 md:grid-cols-3">
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Item</h4>
            <p className="text-sm font-bold text-white">{order.lot_title}</p>
            <p className="text-xs text-slate-500">{order.lot_number} | {order.show_title}</p>
          </div>
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Winner</h4>
            <p className="text-sm font-bold text-white">@{order.winner_username || 'Unknown'}</p>
            {order.shipping_name && <p className="text-xs text-slate-400">{order.shipping_name}</p>}
            {order.shipping_line1 && (
              <p className="text-xs text-slate-500">
                {[order.shipping_line1, order.shipping_city, order.shipping_state, order.shipping_zip].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Fulfillment</h4>
            {order.tracking_number && (
              <p className="text-xs text-slate-400">
                Tracking: <span className="font-bold text-slate-200">{order.tracking_number}</span>
                {order.shipping_carrier && <span> ({order.shipping_carrier})</span>}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              <button onClick={() => onUpdateStatus(order.id, 'packed')} className={cn(ghost, 'text-xs')}>
                <Package className="h-3 w-3" /> Pack
              </button>
              <button onClick={() => onUpdateStatus(order.id, 'shipped')} className={cn(ghost, 'text-xs')}>
                <Truck className="h-3 w-3" /> Ship
              </button>
              <button onClick={() => onUpdateStatus(order.id, 'delivered')} className={cn(ghost, 'text-xs')}>
                <CheckCircle2 className="h-3 w-3" /> Deliver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-cyan-300/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-cyan-200 mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      </div>
      <p className="text-lg font-black text-white">{value}</p>
    </div>
  )
}
