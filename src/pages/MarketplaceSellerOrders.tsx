import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  ExternalLink,
  Gavel,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  Unlock,
  X,
} from 'lucide-react'

import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { type ShippingCarrier } from '../lib/trackingUtils'

const SHIPPING_CARRIERS = [
  { id: 'usps' as ShippingCarrier, name: 'USPS' },
  { id: 'ups' as ShippingCarrier, name: 'UPS' },
  { id: 'fedex' as ShippingCarrier, name: 'FedEx' },
  { id: 'dhl' as ShippingCarrier, name: 'DHL' },
  { id: 'other' as ShippingCarrier, name: 'Other' },
]

type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded'

type FulfillmentStatus =
  | 'pending'
  | 'awaiting_fulfillment'
  | 'fulfilled'
  | 'delivered'
  | 'issue_reported'
  | 'appeal_open'
  | 'resolved'
  | 'lawsuit_filed'
  | 'cancelled'
  | 'refunded'

type PayoutStatus = 'held' | 'released' | 'on_hold' | 'refunded' | 'cancelled'
type FilterStatus = 'all' | OrderStatus

interface TrackingEvent {
  id: string
  status: string
  description: string | null
  location: string | null
  event_time: string
}

interface Shipment {
  id: string
  carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
  tracking_status: string | null
  shipped_date: string | null
  delivered_at: string | null
  tracking_events?: TrackingEvent[]
}

interface MarketplacePurchase {
  id: string
  buyer_id: string
  seller_id: string
  item_id: string
  price_paid: number
  platform_fee: number | null
  seller_earnings: number | null
  status: OrderStatus
  fulfillment_status: FulfillmentStatus | null
  payout_status: PayoutStatus | null
  payout_released_at?: string | null
  tracking_number?: string | null
  tracking_url?: string | null
  shipping_carrier?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  cancellation_requested_at?: string | null
  cancellation_reason?: string | null
  cancelled_at?: string | null
  refunded_at?: string | null
  shipping_name?: string | null
  shipping_address?: string | null
  shipping_city?: string | null
  shipping_state?: string | null
  shipping_zip?: string | null
  carrier_tracking_status?: string | null
  created_at: string
  appeal_id?: string | null
  troll_court_case_id?: string | null
  marketplace_item?: {
    id: string
    title: string
    description: string | null
    thumbnail_url?: string | null
    type: string | null
  } | null
  buyer_profile?: {
    id: string
    username: string | null
    avatar_url?: string | null
  } | null
  shipment?: Shipment | Shipment[] | null
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  paid: { label: 'Paid', color: 'text-green-400', bg: 'bg-green-400/10' },
  processing: { label: 'Processing', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  shipped: { label: 'Shipped', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  delivered: { label: 'Delivered', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-400/10' },
  refunded: { label: 'Refunded', color: 'text-gray-400', bg: 'bg-gray-400/10' },
}

const FULFILLMENT_CONFIG: Record<FulfillmentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  awaiting_fulfillment: { label: 'Awaiting Fulfillment', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  fulfilled: { label: 'Fulfilled', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  delivered: { label: 'Delivered', color: 'text-green-400', bg: 'bg-green-400/10' },
  issue_reported: { label: 'Issue Reported', color: 'text-red-400', bg: 'bg-red-400/10' },
  appeal_open: { label: 'Appeal Open', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  resolved: { label: 'Resolved', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  lawsuit_filed: { label: 'Lawsuit Filed', color: 'text-red-500', bg: 'bg-red-500/10' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  refunded: { label: 'Refunded', color: 'text-gray-400', bg: 'bg-gray-400/10' },
}

const PAYOUT_CONFIG: Record<PayoutStatus, { label: string; color: string; bg: string }> = {
  held: { label: 'Held Escrow', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  released: { label: 'Released', color: 'text-green-400', bg: 'bg-green-400/10' },
  on_hold: { label: 'On Hold', color: 'text-red-400', bg: 'bg-red-400/10' },
  refunded: { label: 'Refunded', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400', bg: 'bg-gray-400/10' },
}

const TRACKING_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  label_created: { label: 'Label Created', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  accepted: { label: 'Accepted', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  in_transit: { label: 'In Transit', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  out_for_delivery: { label: 'Out for Delivery', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  delivered: { label: 'Delivered', color: 'text-green-400', bg: 'bg-green-400/10' },
  exception: { label: 'Exception', color: 'text-red-400', bg: 'bg-red-400/10' },
  returned: { label: 'Returned', color: 'text-gray-400', bg: 'bg-gray-400/10' },
}

const tcCard =
  'rounded-2xl border border-cyan-300/15 bg-slate-950/70 text-white shadow-[0_0_30px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const tcInput =
  'w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/20'
const tcButton =
  'rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white'
const _tcPrimary = 'rounded-lg bg-cyan-300 px-4 py-2 font-bold text-slate-950 transition hover:bg-cyan-200'
const tcDanger = 'rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700'

function getShipment(order: MarketplacePurchase): Shipment | null {
  if (!order.shipment) return null
  return Array.isArray(order.shipment) ? order.shipment[0] || null : order.shipment
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString()
}

function formatDateTime(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString()
}

function getTrackingStatusLabel(status?: string | null): string {
  if (!status) return 'Unknown'
  return TRACKING_STATUS_CONFIG[status]?.label || status
}

function getCarrierTrackingUrl(carrierStr: string, trackingNum: string): string {
  const carrierLower = carrierStr?.toLowerCase()
  const num = trackingNum?.trim() || ''
  if (!num) return '#'

  switch (carrierLower) {
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(num)}`
    case 'ups':
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(num)}`
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(num)}`
    case 'dhl':
      return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(num)}`
    default:
      return '#'
  }
}

export default function MarketplaceSellerOrders() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [orders, setOrders] = useState<MarketplacePurchase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const [showShippingModal, setShowShippingModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<MarketplacePurchase | null>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState<ShippingCarrier>('usps')
  const [shippedDate, setShippedDate] = useState('')
  const [isShipping, setIsShipping] = useState(false)
  const [confirmTrackingChecked, setConfirmTrackingChecked] = useState(false)

  const [showRefundModal, setShowRefundModal] = useState(false)
  const [isRefunding, setIsRefunding] = useState(false)

  const [showReleaseRequestModal, setShowReleaseRequestModal] = useState(false)
  const [releaseRequestOrder, setReleaseRequestOrder] = useState<MarketplacePurchase | null>(null)
  const [releaseNotes, setReleaseNotes] = useState('')
  const [isRequestingRelease, setIsRequestingRelease] = useState(false)

  const fetchOrders = useCallback(async () => {
    if (!user?.id) {
      setOrders([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await supabase
        .from('marketplace_purchases')
        .select(`
          *,
          marketplace_item:marketplace_items!marketplace_purchases_item_id_fkey(
            id,
            title,
            description,
            thumbnail_url,
            type
          ),
          buyer_profile:user_profiles!marketplace_purchases_buyer_id_fkey(
            id,
            username,
            avatar_url
          ),
          shipment:order_shipments(
            id,
            carrier,
            tracking_number,
            tracking_url,
            tracking_status,
            shipped_date,
            delivered_at,
            tracking_events(
              id,
              status,
              description,
              location,
              event_time
            )
          )
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders((data || []) as MarketplacePurchase[])
    } catch (err) {
      console.error('[MarketplaceSellerOrders] Error fetching orders:', err)
      toast.error('Failed to load orders')
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders])

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return orders.filter((order) => {
      const matchesStatus = filterStatus === 'all' || order.status === filterStatus
      const matchesSearch =
        !query ||
        order.marketplace_item?.title?.toLowerCase().includes(query) ||
        order.buyer_profile?.username?.toLowerCase().includes(query) ||
        order.shipping_city?.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query)

      return matchesStatus && matchesSearch
    })
  }, [filterStatus, orders, searchQuery])

  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter((order) => order.status === 'paid' || order.status === 'pending').length,
      shipped: orders.filter((order) => order.status === 'shipped').length,
      delivered: orders.filter((order) => order.status === 'delivered').length,
      payoutHeld: orders.filter((order) => order.payout_status === 'held').length,
      payoutReleased: orders.filter((order) => order.payout_status === 'released').length,
      refundIssues: orders.filter(
        (order) => order.fulfillment_status === 'appeal_open' || order.fulfillment_status === 'lawsuit_filed'
      ).length,
    }
  }, [orders])

  const openShippingModal = (order: MarketplacePurchase) => {
    const shipment = getShipment(order)
    setSelectedOrder(order)
    setCarrier((order.shipping_carrier || shipment?.carrier || 'usps') as ShippingCarrier)
    setTrackingNumber(order.tracking_number || shipment?.tracking_number || '')
    setShippedDate('')
    setConfirmTrackingChecked(false)
    setShowShippingModal(true)
  }

  const openRefundModal = (order: MarketplacePurchase) => {
    setSelectedOrder(order)
    setShowRefundModal(true)
  }

  const handleContactBuyer = (order: MarketplacePurchase) => {
    if (!order.buyer_id || !order.marketplace_item) return
    const itemTitle = encodeURIComponent(order.marketplace_item.title || 'Marketplace Item')
    navigate(
      `/utromail/compose?recipientId=${order.buyer_id}&subject=${itemTitle}`
    )
  }

  const handleShipOrder = async () => {
    if (!selectedOrder || !trackingNumber.trim()) return

    setIsShipping(true)
    try {
      const shipDate = shippedDate ? new Date(shippedDate).toISOString() : new Date().toISOString()

      const { data, error } = await supabase.rpc('fulfill_marketplace_order', {
        p_order_id: selectedOrder.id,
        p_tracking_number: trackingNumber.trim(),
        p_carrier: carrier,
        p_shipped_date: shipDate,
      })

      if (error) throw error

      if (typeof data === 'string' && !data.toLowerCase().includes('success')) {
        toast.error(data || 'Failed to ship order')
        return
      }

      const isTrackingUpdate = selectedOrder.status === 'delivered' || selectedOrder.status === 'completed'
      toast.success(isTrackingUpdate ? 'Tracking updated successfully.' : 'Order shipped successfully. Payout is now in escrow.')
      setShowShippingModal(false)
      setSelectedOrder(null)
      setTrackingNumber('')
      setShippedDate('')
      setConfirmTrackingChecked(false)
      await fetchOrders()
    } catch (err: any) {
      console.error('[MarketplaceSellerOrders] Error shipping order:', err)
      toast.error(err?.message || 'Failed to ship order')
    } finally {
      setIsShipping(false)
    }
  }

  const handleRefund = async () => {
    if (!selectedOrder) return

    setIsRefunding(true)
    try {
      const { data, error } = await supabase.rpc('refund_marketplace_order', {
        p_order_id: selectedOrder.id,
      })

      if (error) throw error

      if (typeof data === 'string' && !data.toLowerCase().includes('success')) {
        toast.error(data || 'Failed to refund order')
        return
      }

      toast.success('Order refunded successfully.')
      setShowRefundModal(false)
      setSelectedOrder(null)
      await fetchOrders()
    } catch (err: any) {
      console.error('[MarketplaceSellerOrders] Error refunding order:', err)
      toast.error(err?.message || 'Failed to refund order')
    } finally {
      setIsRefunding(false)
    }
  }

  const handleRefreshTracking = async (order: MarketplacePurchase) => {
    const shipment = getShipment(order)
    const currentTrackingNumber = order.tracking_number || shipment?.tracking_number
    const currentCarrier = order.shipping_carrier || shipment?.carrier

    if (!currentTrackingNumber || !currentCarrier) {
      toast.error('No tracking information available')
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('tracking-refresh', {
        body: { order_id: order.id },
      })

      if (error) throw error

      if (data?.success) {
        toast.success('Tracking refreshed successfully')
        await fetchOrders()
      } else {
        toast.error(data?.message || 'Failed to refresh tracking')
      }
    } catch (err: any) {
      console.error('[MarketplaceSellerOrders] Error refreshing tracking:', err)
      toast.error(err?.message || 'Failed to refresh tracking')
    }
  }

  const handleOpenReleaseRequest = (order: MarketplacePurchase) => {
    setReleaseRequestOrder(order)
    setReleaseNotes('')
    setShowReleaseRequestModal(true)
  }

  const handleSubmitReleaseRequest = async () => {
    if (!releaseRequestOrder || !user?.id) return

    const shipment = getShipment(releaseRequestOrder)
    const trackingNumber = releaseRequestOrder.tracking_number || shipment?.tracking_number
    const carrier = releaseRequestOrder.shipping_carrier || shipment?.carrier

    if (!trackingNumber) {
      toast.error('Tracking number is required before requesting payout release')
      return
    }

    setIsRequestingRelease(true)
    try {
      const { data, error } = await supabase.rpc('request_marketplace_payout_release', {
        p_order_id: releaseRequestOrder.id,
        p_seller_id: user.id,
        p_tracking_number: trackingNumber,
        p_carrier: carrier || 'usps',
        p_seller_notes: releaseNotes || null,
      })

      if (error) throw error

      const result = data as any
      if (result?.success) {
        toast.success('Payout release request submitted! An admin will review your tracking. You need at least 10 completed sales with no open appeals.')
      } else {
        toast.error(result?.error || 'Failed to submit release request')
      }

      setShowReleaseRequestModal(false)
      setReleaseRequestOrder(null)
      setReleaseNotes('')
      await fetchOrders()
    } catch (err: any) {
      console.error('[MarketplaceSellerOrders] Error requesting release:', err)
      toast.error(err?.message || 'Failed to request payout release')
    } finally {
      setIsRequestingRelease(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#050714] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.14),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />

      <div className="relative z-10 border-b border-cyan-300/15 bg-slate-950/70 p-6 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl">
        <div className="mx-auto max-w-6xl">
          <h1 className="flex items-center gap-3 bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-cyan-300 bg-clip-text text-3xl font-black text-transparent">
            <Package className="h-8 w-8 text-cyan-200" />
            Marketplace Orders
          </h1>
          <p className="mt-1 text-sm text-slate-400">Manage shipments, tracking, refunds, and marketplace escrow.</p>
          <p className="mt-2 text-xs text-slate-500">
            Seller earnings are held in escrow until delivery is confirmed. Buyers track packages on carrier websites.
          </p>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl p-6">
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pending" value={stats.pending} className="text-yellow-400" />
          <StatCard label="Shipped" value={stats.shipped} className="text-purple-400" />
          <StatCard label="Delivered" value={stats.delivered} className="text-green-400" />
          <StatCard label="Escrow" value={stats.payoutHeld} className="text-orange-400" />
          <StatCard label="Released" value={stats.payoutReleased} className="text-emerald-400" />
          <StatCard label="Issues" value={stats.refundIssues} className="text-red-400" />
        </div>

        <div className="mb-6 flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className={cn(tcInput, 'pl-10')}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', 'paid', 'shipped', 'completed', 'cancelled', 'refunded'] as FilterStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-bold transition-colors',
                  filterStatus === status ? 'bg-cyan-300 text-slate-950' : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800'
                )}
              >
                {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className={cn(tcCard, 'flex min-h-[260px] items-center justify-center p-8')}>
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className={cn(tcCard, 'p-10 text-center')}>
            <Package className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <p className="text-slate-400">No orders found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const shipment = getShipment(order)
              const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
              const payoutConfig = PAYOUT_CONFIG[order.payout_status || 'held'] || PAYOUT_CONFIG.held
              const trackingStatus = shipment?.tracking_status || order.carrier_tracking_status
              const trackingNumberValue = order.tracking_number || shipment?.tracking_number || ''
              const carrierValue = order.shipping_carrier || shipment?.carrier || ''

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(tcCard, 'overflow-hidden')}
                >
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between p-4 text-left transition hover:bg-white/5"
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    <div className="flex items-center gap-4">
                      {order.marketplace_item?.thumbnail_url ? (
                        <img
                          src={order.marketplace_item.thumbnail_url}
                          alt={order.marketplace_item.title || 'Marketplace item'}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900">
                          <Package className="h-6 w-6 text-slate-500" />
                        </div>
                      )}

                      <div>
                        <div className="font-bold text-white">{order.marketplace_item?.title || 'Item'}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>Buyer: {order.buyer_profile?.username || 'Unknown'}</span>
                          <span>•</span>
                          <Calendar className="h-3 w-3" />
                          {formatDate(order.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className={cn('rounded px-2 py-1 text-xs font-bold', payoutConfig.bg, payoutConfig.color)}>
                        {payoutConfig.label}
                      </span>
                      <div className="text-right">
                        <div className="flex items-center gap-1 font-black text-yellow-400">
                          <Coins className="h-4 w-4" />
                          {order.seller_earnings || 0}
                        </div>
                        {order.payout_released_at && (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <ShieldCheck className="h-3 w-3" />
                            Paid {formatDate(order.payout_released_at)}
                          </span>
                        )}
                        {order.cancellation_requested_at && (
                          <span className="flex items-center gap-1 text-xs text-yellow-400">
                            <AlertCircle className="h-3 w-3" />
                            Cancellation requested
                          </span>
                        )}
                      </div>
                      <span className={cn('rounded-full px-3 py-1 text-sm font-bold', statusConfig.bg, statusConfig.color)}>
                        {statusConfig.label}
                      </span>
                      {expandedOrder === order.id ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                    </div>
                  </button>

                  {expandedOrder === order.id && (
                    <div className="border-t border-cyan-300/10 bg-slate-950/60 p-4">
                      {order.cancellation_requested_at && (
                        <AlertBox tone="yellow" icon={<AlertCircle className="h-5 w-5" />} title="Cancellation Requested">
                          <p>{order.cancellation_reason || 'Buyer requested cancellation.'}</p>
                          <p className="mt-2 text-xs text-slate-500">Requested: {formatDateTime(order.cancellation_requested_at)}</p>
                        </AlertBox>
                      )}

                      {order.shipping_address && (
                        <InfoSection title="Shipping Address" icon={<MapPin className="h-4 w-4" />}>
                          <div className="rounded-lg bg-slate-900/80 p-3">
                            <p className="text-white">{order.shipping_name}</p>
                            <p className="text-sm text-slate-400">
                              {order.shipping_address}, {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                            </p>
                          </div>
                        </InfoSection>
                      )}

                      <InfoSection title="Item Details" icon={<Package className="h-4 w-4" />}>
                        <div className="rounded-lg bg-slate-900/80 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {order.marketplace_item?.thumbnail_url ? (
                                <img src={order.marketplace_item.thumbnail_url} alt="" className="h-10 w-10 rounded object-cover" />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-800">
                                  <Package className="h-5 w-5 text-slate-500" />
                                </div>
                              )}
                              <div>
                                <p className="text-sm text-white">{order.marketplace_item?.title || 'Product'}</p>
                                <p className="text-xs text-slate-500">Type: {order.marketplace_item?.type || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-yellow-400">{order.price_paid} coins</div>
                              <div className="text-xs text-slate-500">Your earnings: {order.seller_earnings || 0} coins</div>
                            </div>
                          </div>
                        </div>
                      </InfoSection>

                      {(trackingNumberValue || shipment) && (
                        <InfoSection
                          title="Tracking"
                          icon={<Truck className="h-4 w-4" />}
                          right={
                            trackingStatus ? (
                              <span
                                className={cn(
                                  'rounded px-2 py-0.5 text-xs font-bold',
                                  TRACKING_STATUS_CONFIG[trackingStatus]?.bg,
                                  TRACKING_STATUS_CONFIG[trackingStatus]?.color
                                )}
                              >
                                {getTrackingStatusLabel(trackingStatus)}
                              </span>
                            ) : null
                          }
                        >
                          <div className="rounded-lg bg-slate-900/80 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm text-white">
                                  {(carrierValue || 'Carrier').toUpperCase()}: {trackingNumberValue || 'No tracking number'}
                                </p>
                                {(order.tracking_url || shipment?.tracking_url || trackingNumberValue) && (
                                  <a
                                    href={order.tracking_url || shipment?.tracking_url || getCarrierTrackingUrl(carrierValue, trackingNumberValue)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
                                  >
                                    Track Package <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                              {(order.shipped_at || shipment?.shipped_date) && (
                                <span className="text-xs text-slate-500">Shipped {formatDate(order.shipped_at || shipment?.shipped_date)}</span>
                              )}
                            </div>

                            {shipment?.tracking_events && shipment.tracking_events.length > 0 && (
                              <div className="mt-3 border-t border-slate-700 pt-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <p className="text-xs text-slate-500">Tracking History</p>
                                  <button
                                    onClick={() => handleRefreshTracking(order)}
                                    className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                    Refresh
                                  </button>
                                </div>
                                <div className="max-h-32 space-y-2 overflow-y-auto">
                                  {shipment.tracking_events.slice(0, 5).map((event, idx) => (
                                    <div key={event.id || idx} className="flex items-start gap-2 text-xs">
                                      <div
                                        className={cn(
                                          'mt-1 h-2 w-2 rounded-full',
                                          event.status === 'delivered'
                                            ? 'bg-green-400'
                                            : event.status === 'exception'
                                              ? 'bg-red-400'
                                              : event.status === 'out_for_delivery'
                                                ? 'bg-orange-400'
                                                : 'bg-cyan-400'
                                        )}
                                      />
                                      <div className="flex-1">
                                        <p className="text-slate-300">{event.description || event.status}</p>
                                        {event.location && <p className="text-slate-500">{event.location}</p>}
                                      </div>
                                      <span className="text-slate-500">{formatDate(event.event_time)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </InfoSection>
                      )}

                      <InfoSection title="Order Timeline" icon={<Clock className="h-4 w-4" />}>
                        <div className="space-y-2 rounded-lg bg-slate-900/80 p-3 text-sm">
                          <TimelineRow icon={<Check className="h-4 w-4 text-green-400" />} text={`Purchased: ${formatDateTime(order.created_at)}`} />
                          {order.shipped_at && <TimelineRow icon={<Truck className="h-4 w-4 text-purple-400" />} text={`Shipped: ${formatDateTime(order.shipped_at)}`} />}
                          {order.delivered_at && <TimelineRow icon={<Package className="h-4 w-4 text-cyan-400" />} text={`Delivered: ${formatDateTime(order.delivered_at)}`} />}
                          {order.cancelled_at && <TimelineRow icon={<X className="h-4 w-4 text-red-400" />} text={`Cancelled: ${formatDateTime(order.cancelled_at)}`} />}
                          {order.refunded_at && <TimelineRow icon={<RefreshCw className="h-4 w-4 text-slate-400" />} text={`Refunded: ${formatDateTime(order.refunded_at)}`} />}
                        </div>
                      </InfoSection>

                      <div className="mb-4 flex flex-wrap items-center gap-4">
                        <StatusBadge label="Fulfillment" value={order.fulfillment_status || 'pending'} config={FULFILLMENT_CONFIG as any} />
                        <StatusBadge label="Payout" value={order.payout_status || 'held'} config={PAYOUT_CONFIG as any} />
                        {order.appeal_id && (
                          <div className="flex items-center gap-1 text-orange-400">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs">Appeal Open</span>
                          </div>
                        )}
                        {order.troll_court_case_id && (
                          <div className="flex items-center gap-1 text-red-400">
                            <Gavel className="h-4 w-4" />
                            <span className="text-xs">In Court</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-4 border-t border-cyan-300/10 pt-4">
                        <button onClick={() => handleContactBuyer(order)} className={tcButton}>
                          <MessageCircle className="mr-2 inline h-4 w-4" />
                          Contact Buyer
                        </button>

                        <div className="flex flex-wrap justify-end gap-3">
                          {order.status !== 'cancelled' && order.status !== 'refunded' && (
                            <button onClick={() => openShippingModal(order)} className="rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700">
                              <Truck className="mr-2 inline h-4 w-4" />
                              {trackingNumberValue ? 'Update Tracking' : 'Add Tracking'}
                            </button>
                          )}

                          {order.status !== 'cancelled' && order.status !== 'refunded' && (
                            <button onClick={() => openShippingModal(order)} className={tcButton}>
                              <Package className="mr-2 inline h-4 w-4" />
                              Update Order
                            </button>
                          )}

                          {order.status === 'paid' && (
                            <button onClick={() => openRefundModal(order)} className={tcDanger}>
                              <RefreshCw className="mr-2 inline h-4 w-4" />
                              Refund
                            </button>
                          )}

                          {trackingNumberValue && order.status !== 'cancelled' && order.status !== 'refunded' && (
                            <button onClick={() => handleRefreshTracking(order)} className="rounded-lg bg-cyan-600 px-4 py-2 text-white transition hover:bg-cyan-700">
                              <RefreshCw className="mr-2 inline h-4 w-4" />
                              Refresh
                            </button>
                          )}

                          {order.payout_status === 'held' && (
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-400">
                                <ShieldCheck className="h-4 w-4" />
                                Coins held until delivery
                              </div>
                              {(order.tracking_number || getShipment(order)?.tracking_number) && (
                                <button
                                  onClick={() => handleOpenReleaseRequest(order)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-400 transition-colors"
                                >
                                  <Unlock className="h-3.5 w-3.5" />
                                  Request Release
                                </button>
                              )}
                            </div>
                          )}
                          {order.payout_status === 'released' && (
                            <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-400">
                              <ShieldCheck className="h-4 w-4" />
                              Paid to wallet
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {showShippingModal && (
        <ActionModal
          title={selectedOrder?.tracking_number || getShipment(selectedOrder as MarketplacePurchase)?.tracking_number ? 'Update Tracking' : 'Ship Order'}
          icon={<Truck className="h-5 w-5 text-purple-400" />}
          onClose={() => {
            setShowShippingModal(false)
            setTrackingNumber('')
            setShippedDate('')
            setConfirmTrackingChecked(false)
          }}
        >
          <div className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
            <div className="flex items-center gap-2 text-sm text-orange-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Coins are held in escrow until delivery is confirmed by the carrier.</span>
            </div>
            <p className="mt-1 text-xs text-orange-400/80">
              Buyers can track their package on the carrier website after you submit tracking.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-slate-400">Carrier</label>
              <select value={carrier} onChange={(event) => setCarrier(event.target.value as ShippingCarrier)} className={tcInput}>
                {SHIPPING_CARRIERS.map((shippingCarrier) => (
                  <option key={shippingCarrier.id} value={shippingCarrier.id}>
                    {shippingCarrier.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">Tracking Number</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="Enter tracking number"
                className={tcInput}
              />

              {trackingNumber.trim() && (
                <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900/70 p-2">
                  <div className="text-xs text-slate-400">
                    Preview: {carrier.toUpperCase()} - {trackingNumber.trim()}
                  </div>
                  <a
                    href={getCarrierTrackingUrl(carrier, trackingNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
                  >
                    Check on {carrier.toUpperCase()} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">Shipped Date</label>
              <input
                type="datetime-local"
                value={shippedDate}
                onChange={(event) => setShippedDate(event.target.value)}
                className={tcInput}
              />
            </div>

            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={confirmTrackingChecked}
                  onChange={(event) => setConfirmTrackingChecked(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500"
                />
                <div className="text-sm">
                  <span className="font-bold text-yellow-400">Verify tracking number before submitting</span>
                  <p className="mt-1 text-xs text-slate-400">
                    I confirm this tracking number is correct and matches the package I am shipping.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => {
                setShowShippingModal(false)
                setTrackingNumber('')
                setShippedDate('')
                setConfirmTrackingChecked(false)
              }}
              className="flex-1 rounded-lg bg-slate-800 py-3 text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleShipOrder}
              disabled={!trackingNumber.trim() || !confirmTrackingChecked || isShipping}
              className="flex-1 rounded-lg bg-purple-600 py-3 text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isShipping ? 'Shipping...' : selectedOrder?.tracking_number || getShipment(selectedOrder as MarketplacePurchase)?.tracking_number ? 'Update' : 'Confirm Ship'}
            </button>
          </div>
        </ActionModal>
      )}

      {showRefundModal && (
        <ActionModal title="Refund Order" icon={<RefreshCw className="h-5 w-5 text-red-400" />} onClose={() => setShowRefundModal(false)}>
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-400">
              This will refund {selectedOrder?.price_paid || 0} coins to the buyer. This action cannot be undone.
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowRefundModal(false)} className="flex-1 rounded-lg bg-slate-800 py-3 text-white">
              Cancel
            </button>
            <button
              onClick={handleRefund}
              disabled={isRefunding}
              className="flex-1 rounded-lg bg-red-600 py-3 text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {isRefunding ? 'Refunding...' : 'Confirm Refund'}
            </button>
          </div>
        </ActionModal>
      )}

      {showReleaseRequestModal && releaseRequestOrder && (
        <ActionModal
          title="Request Payout Release"
          icon={<Unlock className="h-5 w-5 text-amber-400" />}
          onClose={() => {
            setShowReleaseRequestModal(false)
            setReleaseRequestOrder(null)
            setReleaseNotes('')
          }}
        >
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-sm text-amber-400">
              Request admin release of <strong>{(releaseRequestOrder.seller_earnings || 0).toLocaleString()} coins</strong> from escrow.
              Tracking: <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-white">{releaseRequestOrder.tracking_number || (getShipment(releaseRequestOrder)?.tracking_number)}</code> ({releaseRequestOrder.shipping_carrier || getShipment(releaseRequestOrder)?.carrier})
            </p>
            <p className="mt-2 text-xs text-amber-400/80">
              Your order must have tracking and item delivered. Admins will verify tracking before approving. You need at least 10 completed sales with no open appeals to be eligible.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-slate-400">Notes for Admin (optional)</label>
              <textarea
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="e.g. Buyer confirmed receipt, package in good condition..."
                rows={3}
                className={cn(tcInput, 'h-20 resize-none')}
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => {
                setShowReleaseRequestModal(false)
                setReleaseRequestOrder(null)
                setReleaseNotes('')
              }}
              className="flex-1 rounded-lg bg-slate-800 py-3 text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitReleaseRequest}
              disabled={isRequestingRelease}
              className="flex-1 rounded-lg bg-amber-600 py-3 text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRequestingRelease ? 'Submitting...' : 'Submit Release Request'}
            </button>
          </div>
        </ActionModal>
      )}
    </div>
  )
}

function StatCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-xl border border-cyan-300/10 bg-slate-950/70 p-3 shadow-[0_0_20px_rgba(34,211,238,0.06)]">
      <div className={cn('text-xs text-slate-400', className)}>{label}</div>
      <div className={cn('text-2xl font-black text-white', className)}>{value}</div>
    </div>
  )
}

function AlertBox({ icon, title, tone: _tone, children }: { icon: React.ReactNode; title: string; tone: 'yellow'; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-400">
      <div className="mb-2 flex items-center gap-2 font-bold">
        {icon}
        <span>{title}</span>
      </div>
      <div className="text-sm text-slate-300">{children}</div>
    </div>
  )
}

function InfoSection({ title, icon, right, children }: { title: string; icon: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="mb-2 flex items-center gap-2 text-sm text-slate-400">
        {icon}
        {title}
        {right}
      </h4>
      {children}
    </div>
  )
}

function TimelineRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-slate-300">{text}</span>
    </div>
  )
}

function StatusBadge({ label, value, config }: { label: string; value: string; config: Record<string, { label: string; color: string; bg: string }> }) {
  const item = config[value]

  return (
    <div>
      <h4 className="mb-1 text-xs text-slate-400">{label}</h4>
      <span className={cn('rounded px-2 py-1 text-xs font-bold', item?.bg || 'bg-slate-700', item?.color || 'text-slate-300')}>
        {item?.label || value}
      </span>
    </div>
  )
}

function ActionModal({ title, icon, children, onClose }: { title: string; icon: React.ReactNode; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-cyan-300/15 bg-slate-950 p-6 text-white shadow-[0_0_50px_rgba(34,211,238,0.18)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xl font-black text-white">
            {icon}
            {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
