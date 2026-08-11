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
  Receipt,
  Search,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react'

import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'

type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'auction'

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
  fulfillment_status?: FulfillmentStatus | null
  tracking_number?: string | null
  tracking_url?: string | null
  shipping_carrier?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  cancellation_requested_at?: string | null
  cancelled_at?: string | null
  refunded_at?: string | null
  shipping_name?: string | null
  shipping_address?: string | null
  shipping_city?: string | null
  shipping_state?: string | null
  shipping_zip?: string | null
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
  seller_profile?: {
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
  auction: { label: 'Auction', color: 'text-orange-400', bg: 'bg-orange-400/10' },
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

const APPEAL_CATEGORIES = [
  { id: 'non_delivery', label: 'Non-Delivery', description: 'Package never arrived' },
  { id: 'not_as_described', label: 'Not As Described', description: 'Item is different from listing' },
  { id: 'damaged_item', label: 'Damaged Item', description: 'Item arrived damaged' },
  { id: 'seller_issue', label: 'Seller Issue', description: 'Problem with seller behavior' },
  { id: 'payment_issue', label: 'Payment Issue', description: 'Problem with payment' },
  { id: 'other', label: 'Other', description: 'Other issue' },
]

const tcCard =
  'rounded-2xl border border-cyan-300/15 bg-slate-950/70 text-white shadow-[0_0_30px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const tcInput =
  'w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/20'
const tcButton =
  'rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white'
const tcPrimary =
  'rounded-lg border border-cyan-300/30 bg-cyan-300 px-4 py-2 font-bold text-slate-950 transition hover:bg-cyan-200'
const tcDanger = 'rounded-lg border border-red-300/25 bg-red-500/15 px-4 py-2 text-red-100 transition hover:bg-red-500/25'

function getShipment(order: MarketplacePurchase): Shipment | null {
  if (!order.shipment) return null
  return Array.isArray(order.shipment) ? order.shipment[0] || null : order.shipment
}

function getTrackingStatusLabel(status?: string | null): string {
  if (!status) return 'Unknown'
  return TRACKING_STATUS_CONFIG[status]?.label || status
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

export default function BuyerOrders() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [orders, setOrders] = useState<MarketplacePurchase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<MarketplacePurchase | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const [showAppealModal, setShowAppealModal] = useState(false)
  const [appealCategory, setAppealCategory] = useState('')
  const [appealDescription, setAppealDescription] = useState('')
  const [appealDesiredResolution, setAppealDesiredResolution] = useState('')
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false)

  const [showTrollCourtModal, setShowTrollCourtModal] = useState(false)
  const [trollCourtDescription, setTrollCourtDescription] = useState('')
  const [trollCourtClaimAmount, setTrollCourtClaimAmount] = useState(0)
  const [isFilingLawsuit, setIsFilingLawsuit] = useState(false)

  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receiptOrder, setReceiptOrder] = useState<MarketplacePurchase | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!user?.id) {
      setOrders([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      // Fetch marketplace purchases
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
          seller_profile:user_profiles!marketplace_purchases_seller_id_fkey(
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
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })

      // Also fetch auction orders for this buyer
      const { data: auctionOrders } = await supabase
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
          created_at,
          auction_lots(
            title,
            image_urls
          ),
          auction_shows(
            title,
            auctioneer_id,
            auctioneer:auctioneer_profiles(
              user_id,
              user_profiles!inner(
                id,
                username,
                avatar_url
              )
            )
          )
        `)
        .eq('winner_user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const marketplaceOrders = (data || []) as MarketplacePurchase[]
      const auctionOrderItems: MarketplacePurchase[] = (auctionOrders || [])
        .map((order: any) => {
          const auctioneerProfile = order.auction_shows?.auctioneer?.user_profiles
          return {
            id: order.id,
            buyer_id: user.id,
            seller_id: order.auction_shows?.auctioneer?.user_id || '',
            item_id: order.lot_id,
            price_paid: Number(order.sale_amount || 0),
            platform_fee: 0,
            seller_earnings: Number(order.sale_amount || 0),
            status: order.payment_status === 'held' ? 'pending' : (order.payment_status as OrderStatus),
            fulfillment_status: order.fulfillment_status as any,
            tracking_number: order.tracking_number,
            tracking_url: null,
            shipping_carrier: order.shipping_carrier,
            shipped_at: order.shipped_at,
            delivered_at: order.delivered_at,
            cancellation_requested_at: null,
            cancelled_at: null,
            refunded_at: null,
            shipping_name: order.shipping_name,
            shipping_address: order.shipping_line1,
            shipping_city: order.shipping_city,
            shipping_state: order.shipping_state,
            shipping_zip: order.shipping_zip,
            created_at: order.created_at,
            appeal_id: null,
            troll_court_case_id: null,
            source: 'auction',
            marketplace_item: {
              id: order.lot_id,
              title: order.auction_lots?.title || 'Auction Item',
              description: null,
              thumbnail_url: order.auction_lots?.image_urls?.[0] || null,
              type: 'auction',
            },
            seller_profile: auctioneerProfile
              ? {
                  id: auctioneerProfile.id,
                  username: auctioneerProfile.username || 'Auctioneer',
                  avatar_url: auctioneerProfile.avatar_url,
                }
              : null,
            shipment: null,
          } as unknown as MarketplacePurchase
        })

      // Combine and sort by date
      const allOrders = [...marketplaceOrders, ...auctionOrderItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setOrders(allOrders)
    } catch (err) {
      console.error('[BuyerOrders] Error fetching orders:', err)
      toast.error('Failed to load orders')
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders])

  const canCancel = (order: MarketplacePurchase): boolean => {
    if (order.status !== 'paid' && order.status !== 'pending') return false
    const minutesSincePurchase = (Date.now() - new Date(order.created_at).getTime()) / 60000
    return minutesSincePurchase <= 30
  }

  const canAppeal = (order: MarketplacePurchase): boolean => {
    if (order.status === 'cancelled' || order.status === 'refunded') return false
    if (order.appeal_id || order.troll_court_case_id) return false
    return true
  }

  const canEscalateToTrollCourt = (order: MarketplacePurchase): boolean => {
    if (order.status === 'cancelled' || order.status === 'refunded') return false
    if (order.troll_court_case_id) return false
    return true
  }

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return orders.filter((order) => {
      const isAuction = (order as any).source === 'auction'

      let matchesStatus: boolean
      if (filterStatus === 'all') {
        matchesStatus = true
      } else if (filterStatus === 'auction') {
        matchesStatus = isAuction
      } else {
        matchesStatus = order.status === filterStatus && !isAuction
      }

      const matchesSearch =
        !query ||
        order.marketplace_item?.title?.toLowerCase().includes(query) ||
        order.seller_profile?.username?.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query)

      return matchesStatus && matchesSearch
    })
  }, [filterStatus, orders, searchQuery])

  const getTimeRemaining = (order: MarketplacePurchase): string => {
    const minutesSincePurchase = (Date.now() - new Date(order.created_at).getTime()) / 60000
    const minutesRemaining = Math.max(0, 30 - minutesSincePurchase)
    if (minutesRemaining <= 0) return 'Expired'
    return `${Math.floor(minutesRemaining)} min`
  }

  const openCancelModal = (order: MarketplacePurchase) => {
    setSelectedOrder(order)
    setCancelReason('')
    setShowCancelModal(true)
  }

  const handleRequestCancellation = async () => {
    if (!selectedOrder || !cancelReason.trim()) return

    setIsCancelling(true)
    try {
      const { data, error } = await supabase.rpc('request_marketplace_cancellation', {
        p_order_id: selectedOrder.id,
        p_reason: cancelReason.trim(),
      })

      if (error) throw error

      if (typeof data === 'string' && !data.toLowerCase().includes('success')) {
        toast.error(data || 'Failed to request cancellation')
        return
      }

      toast.success('Cancellation requested')
      setShowCancelModal(false)
      setSelectedOrder(null)
      setCancelReason('')
      await fetchOrders()
    } catch (err: any) {
      console.error('[BuyerOrders] Error cancelling order:', err)
      toast.error(err?.message || 'Failed to request cancellation')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleContactSeller = (order: MarketplacePurchase) => {
    if (!order.seller_id || !order.marketplace_item) return
    const itemTitle = encodeURIComponent(order.marketplace_item.title || 'Marketplace Item')
    navigate(
      `/utromail/compose?recipientId=${order.seller_id}&subject=${itemTitle}`
    )
  }

  const handleOpenAppeal = (order: MarketplacePurchase) => {
    setSelectedOrder(order)
    setAppealCategory('')
    setAppealDescription('')
    setAppealDesiredResolution('')
    setShowAppealModal(true)
  }

  const handleSubmitAppeal = async () => {
    if (!selectedOrder || !appealCategory || !appealDescription.trim() || !user?.id) return

    setIsSubmittingAppeal(true)
    try {
      const { error } = await supabase.rpc('create_marketplace_appeal', {
        p_order_id: selectedOrder.id,
        p_user_id: user.id,
        p_category: appealCategory,
        p_description: appealDescription.trim(),
        p_desired_resolution: appealDesiredResolution.trim() || null,
      })

      if (error) throw error

      toast.success('Appeal submitted. A moderator will review your case.')
      setShowAppealModal(false)
      setAppealCategory('')
      setAppealDescription('')
      setAppealDesiredResolution('')
      await fetchOrders()
    } catch (err: any) {
      console.error('[BuyerOrders] Error submitting appeal:', err)
      toast.error(err?.message || 'Failed to submit appeal')
    } finally {
      setIsSubmittingAppeal(false)
    }
  }

  const handleOpenTrollCourt = (order: MarketplacePurchase) => {
    setSelectedOrder(order)
    setTrollCourtDescription('')
    setTrollCourtClaimAmount(Number(order.price_paid || 0))
    setShowTrollCourtModal(true)
  }

  const handleEscalateToTrollCourt = async () => {
    if (!selectedOrder || !trollCourtDescription.trim() || !user?.id) return

    setIsFilingLawsuit(true)
    try {
      const { error } = await supabase.rpc('escalate_to_troll_court', {
        p_order_id: selectedOrder.id,
        p_plaintiff_id: user.id,
        p_defendant_id: selectedOrder.seller_id,
        p_description: trollCourtDescription.trim(),
        p_claim_amount: trollCourtClaimAmount,
      })

      if (error) throw error

      toast.success('Lawsuit filed in Troll Court.')
      setShowTrollCourtModal(false)
      setTrollCourtDescription('')
      setTrollCourtClaimAmount(0)
      await fetchOrders()
    } catch (err: any) {
      console.error('[BuyerOrders] Error filing lawsuit:', err)
      toast.error(err?.message || 'Failed to file lawsuit')
    } finally {
      setIsFilingLawsuit(false)
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
            My Purchases
          </h1>
          <p className="mt-1 text-sm text-slate-400">Track your orders, contact sellers, and manage disputes.</p>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl p-6">
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
            {(['all', 'auction', 'paid', 'shipped', 'completed', 'cancelled'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-bold transition-colors',
                  filterStatus === status ? 'bg-cyan-300 text-slate-950' : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800'
                )}
              >
                {status === 'all' ? 'All' : status === 'auction' ? '🎯 Auction Wins' : STATUS_CONFIG[status]?.label || status}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <Card className={cn(tcCard, 'flex min-h-[260px] items-center justify-center p-8')}>
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card className={cn(tcCard, 'p-10 text-center')}>
            <Package className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <p className="text-slate-400">No orders found</p>
            <button onClick={() => navigate('/marketplace')} className={cn(tcPrimary, 'mt-4')}>
              Browse Marketplace
            </button>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const shipment = getShipment(order)
              const trackingStatus = shipment?.tracking_status || null
              const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending

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
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{order.marketplace_item?.title || 'Item'}</span>
                          {(order as any).source === 'auction' && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-purple-300/25 bg-purple-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-purple-100">
                              <Gavel className="h-2.5 w-2.5" />
                              Auction Win
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>by {order.seller_profile?.username || 'Unknown'}</span>
                          <span>•</span>
                          <Calendar className="h-3 w-3" />
                          {formatDate(order.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className={cn('rounded-full px-3 py-1 text-sm font-bold', statusConfig.bg, statusConfig.color)}>
                        {statusConfig.label}
                      </div>
                      <div className="flex items-center gap-1 font-black text-yellow-400">
                        <Coins className="h-4 w-4" />
                        {order.price_paid}
                      </div>
                      {expandedOrder === order.id ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                    </div>
                  </button>

                  {expandedOrder === order.id && (
                    <div className="border-t border-cyan-300/10 bg-slate-950/60 p-4">
                      {order.appeal_id && (
                        <AlertBox icon={<AlertCircle className="h-5 w-5" />} tone="orange" title="Appeal Open">
                          Your appeal is being reviewed by a moderator.
                        </AlertBox>
                      )}

                      {order.troll_court_case_id && (
                        <AlertBox icon={<Gavel className="h-5 w-5" />} tone="red" title="Lawsuit Filed in Troll Court">
                          Your case is now in the legal system. A judge will review the evidence.
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

                      {(order.tracking_number || shipment) && (
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
                                  {(order.shipping_carrier || shipment?.carrier || 'Carrier').toUpperCase()}:{' '}
                                  {order.tracking_number || shipment?.tracking_number || 'No tracking number'}
                                </p>
                                {(order.tracking_url || shipment?.tracking_url) && (
                                  <a
                                    href={order.tracking_url || shipment?.tracking_url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-cyan-400/15 px-3 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/25"
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
                              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto border-t border-slate-700 pt-3">
                                <p className="text-xs text-slate-500">Shipment Progress</p>
                                {shipment.tracking_events.map((event, idx) => (
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
                            )}

                            {shipment?.delivered_at && (
                              <div className="mt-3 rounded border border-green-500/30 bg-green-500/10 p-2">
                                <div className="flex items-center gap-2 text-green-400">
                                  <Check className="h-4 w-4" />
                                  <span className="text-sm font-bold">Delivered on {formatDate(shipment.delivered_at)}</span>
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
                        </div>
                      </InfoSection>

                      <div className="flex items-center justify-between gap-4 border-t border-cyan-300/10 pt-4">
                        <div className="flex items-center gap-3">
                          {canCancel(order) && (
                            <div className="flex items-center gap-2 text-sm text-yellow-400">
                              <Clock className="h-4 w-4" />
                              Cancel for {getTimeRemaining(order)}
                            </div>
                          )}
                          {order.fulfillment_status === 'issue_reported' && (
                            <div className="flex items-center gap-2 text-sm text-red-400">
                              <ShieldAlert className="h-4 w-4" />
                              Issue Reported
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={() => {
                              setReceiptOrder(order)
                              setShowReceiptModal(true)
                            }}
                            className={tcButton}
                          >
                            <Receipt className="mr-2 inline h-4 w-4" />
                            View Receipt
                          </button>
                          {order.seller_id !== user?.id && (
                            <button onClick={() => handleContactSeller(order)} className={tcButton}>
                              <MessageCircle className="mr-2 inline h-4 w-4" />
                              Contact Seller
                            </button>
                          )}
                          {canCancel(order) && (
                            <button onClick={() => openCancelModal(order)} className={tcDanger}>
                              <X className="mr-2 inline h-4 w-4" />
                              Cancel
                            </button>
                          )}
                          {canAppeal(order) && (
                            <button onClick={() => handleOpenAppeal(order)} className="rounded-lg bg-orange-600 px-4 py-2 text-white transition hover:bg-orange-700">
                              <AlertCircle className="mr-2 inline h-4 w-4" />
                              Report Issue
                            </button>
                          )}
                          {canEscalateToTrollCourt(order) && (
                            <button onClick={() => handleOpenTrollCourt(order)} className="rounded-lg bg-red-700 px-4 py-2 text-white transition hover:bg-red-800">
                              <Gavel className="mr-2 inline h-4 w-4" />
                              File Lawsuit
                            </button>
                          )}
                          {order.appeal_id && (
                            <button onClick={() => navigate('/city-registry?tab=history')} className="rounded-lg bg-orange-600/50 px-4 py-2 text-white transition hover:bg-orange-600">
                              View Appeal
                            </button>
                          )}
                          {order.troll_court_case_id && (
                            <button onClick={() => navigate('/troll-court')} className="rounded-lg bg-red-600/50 px-4 py-2 text-white transition hover:bg-red-600">
                              View Case
                            </button>
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

      {showCancelModal && (
        <ActionModal title="Request Cancellation" icon={<AlertCircle className="h-5 w-5 text-yellow-400" />} onClose={() => setShowCancelModal(false)}>
          <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
            <p className="flex items-center gap-2 text-sm text-yellow-400">
              <Clock className="h-4 w-4" />
              Cancellation must be requested within 30 minutes of purchase.
            </p>
          </div>

          <label className="mb-2 block text-sm text-slate-400">Reason for cancellation</label>
          <textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Please explain why you're requesting cancellation..."
            className={cn(tcInput, 'h-24 resize-none')}
          />

          <div className="mt-4 flex gap-3">
            <button onClick={() => setShowCancelModal(false)} className="flex-1 rounded-lg bg-slate-800 py-3 text-white">
              Keep Order
            </button>
            <button
              onClick={handleRequestCancellation}
              disabled={!cancelReason.trim() || isCancelling}
              className="flex-1 rounded-lg bg-red-600 py-3 text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {isCancelling ? 'Cancelling...' : 'Request Cancellation'}
            </button>
          </div>
        </ActionModal>
      )}

      {showAppealModal && (
        <ActionModal title="Report an Issue" icon={<AlertCircle className="h-5 w-5 text-orange-400" />} onClose={() => setShowAppealModal(false)}>
          <div className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
            <p className="flex items-center gap-2 text-sm text-orange-400">
              <ShieldAlert className="h-4 w-4" />
              Reporting an issue will hold the seller payout until resolved.
            </p>
          </div>

          <label className="mb-2 block text-sm text-slate-400">Issue Type</label>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {APPEAL_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setAppealCategory(category.id)}
                className={cn(
                  'rounded-lg p-2 text-left text-sm transition-colors',
                  appealCategory === category.id ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                )}
              >
                <div className="font-bold">{category.label}</div>
                <div className="text-xs opacity-70">{category.description}</div>
              </button>
            ))}
          </div>

          <label className="mb-2 block text-sm text-slate-400">Description</label>
          <textarea
            value={appealDescription}
            onChange={(event) => setAppealDescription(event.target.value)}
            placeholder="Describe the issue in detail..."
            className={cn(tcInput, 'mb-4 h-24 resize-none')}
          />

          <label className="mb-2 block text-sm text-slate-400">Desired Resolution</label>
          <input
            type="text"
            value={appealDesiredResolution}
            onChange={(event) => setAppealDesiredResolution(event.target.value)}
            placeholder="Refund, replacement, etc."
            className={tcInput}
          />

          <div className="mt-4 flex gap-3">
            <button onClick={() => setShowAppealModal(false)} className="flex-1 rounded-lg bg-slate-800 py-3 text-white">
              Cancel
            </button>
            <button
              onClick={handleSubmitAppeal}
              disabled={!appealCategory || !appealDescription.trim() || isSubmittingAppeal}
              className="flex-1 rounded-lg bg-orange-600 py-3 text-white transition hover:bg-orange-700 disabled:opacity-50"
            >
              {isSubmittingAppeal ? 'Submitting...' : 'Submit Appeal'}
            </button>
          </div>
        </ActionModal>
      )}

      {showTrollCourtModal && (
        <ActionModal title="File Lawsuit in Troll Court" icon={<Gavel className="h-5 w-5 text-red-400" />} onClose={() => setShowTrollCourtModal(false)}>
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="flex items-center gap-2 text-sm text-red-400">
              <Gavel className="h-4 w-4" />
              This will escalate your dispute to the legal system. Both parties will be summoned.
            </p>
          </div>

          {selectedOrder && (
            <div className="mb-4 rounded-lg bg-slate-800 p-3">
              <p className="text-sm text-slate-400">Disputing order:</p>
              <p className="font-bold text-white">{selectedOrder.marketplace_item?.title}</p>
              <p className="text-yellow-400">{selectedOrder.price_paid} coins</p>
            </div>
          )}

          <label className="mb-2 block text-sm text-slate-400">Claim Amount</label>
          <input
            type="number"
            value={trollCourtClaimAmount}
            onChange={(event) => setTrollCourtClaimAmount(Number.parseInt(event.target.value, 10) || 0)}
            className={cn(tcInput, 'mb-4')}
          />

          <label className="mb-2 block text-sm text-slate-400">Description of Claim</label>
          <textarea
            value={trollCourtDescription}
            onChange={(event) => setTrollCourtDescription(event.target.value)}
            placeholder="Explain your legal claim..."
            className={cn(tcInput, 'h-24 resize-none')}
          />

          <div className="mt-4 flex gap-3">
            <button onClick={() => setShowTrollCourtModal(false)} className="flex-1 rounded-lg bg-slate-800 py-3 text-white">
              Cancel
            </button>
            <button
              onClick={handleEscalateToTrollCourt}
              disabled={!trollCourtDescription.trim() || isFilingLawsuit}
              className="flex-1 rounded-lg bg-red-700 py-3 text-white transition hover:bg-red-800 disabled:opacity-50"
            >
              {isFilingLawsuit ? 'Filing...' : 'File Lawsuit'}
            </button>
          </div>
        </ActionModal>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && receiptOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a1628] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-black text-white">
                <Receipt className="h-5 w-5 text-emerald-400" />
                Order Receipt
              </h3>
              <button
                onClick={() => {
                  setShowReceiptModal(false)
                  setReceiptOrder(null)
                }}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Brand header */}
            <div className="mb-5 rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-4 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Mai Troll LLC</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Official Transaction Receipt</p>
            </div>

            {/* Item */}
            <div className="mb-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center gap-3">
                {receiptOrder.marketplace_item?.thumbnail_url && (
                  <img
                    src={receiptOrder.marketplace_item.thumbnail_url}
                    alt={receiptOrder.marketplace_item.title || ''}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-white">{receiptOrder.marketplace_item?.title || 'Item'}</p>
                  <p className="text-xs text-slate-500">
                    Seller: {receiptOrder.seller_profile?.username || 'Unknown'}
                  </p>
                  {(receiptOrder as any).source === 'auction' && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-purple-300/25 bg-purple-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-purple-100">
                      <Gavel className="h-2.5 w-2.5" />
                      Auction Win
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Transaction details */}
            <div className="mb-4 space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Item Price</span>
                <span className="font-bold text-yellow-400">{receiptOrder.price_paid.toLocaleString()} coins</span>
              </div>
              {(receiptOrder as any).shipping_cost > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Shipping</span>
                  <span className="font-bold text-cyan-300">{(receiptOrder as any).shipping_cost.toLocaleString()} coins</span>
                </div>
              )}
              <div className="flex justify-between border-t border-white/10 pt-2 font-bold">
                <span className="text-white">Total Paid</span>
                <span className="text-emerald-400">
                  {(Number(receiptOrder.price_paid) + Number((receiptOrder as any).shipping_cost || 0)).toLocaleString()} coins
                </span>
              </div>
            </div>

            {/* Order info */}
            <div className="mb-5 space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Order ID</span>
                <span className="font-mono text-slate-300">{receiptOrder.id.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="font-bold capitalize text-slate-300">{receiptOrder.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fulfillment</span>
                <span className="font-bold capitalize text-slate-300">{receiptOrder.fulfillment_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date</span>
                <span className="text-slate-300">{new Date(receiptOrder.created_at).toLocaleString()}</span>
              </div>
              {receiptOrder.shipping_name && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Ship To</span>
                  <span className="text-right text-slate-300">
                    {receiptOrder.shipping_name}
                    {receiptOrder.shipping_address && `, ${receiptOrder.shipping_address}`}
                    {receiptOrder.shipping_city && `, ${receiptOrder.shipping_city}`}
                    {receiptOrder.shipping_state && ` ${receiptOrder.shipping_state}`}
                    {receiptOrder.shipping_zip && ` ${receiptOrder.shipping_zip}`}
                  </span>
                </div>
              )}
              {receiptOrder.tracking_number && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Tracking</span>
                  <span className="font-mono text-cyan-300">
                    {receiptOrder.shipping_carrier ? `${receiptOrder.shipping_carrier.toUpperCase()} ` : ''}
                    {receiptOrder.tracking_number}
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mb-5 text-center">
              <p className="text-[10px] text-slate-600">
                This receipt is auto-generated by Mai Troll LLC.
              </p>
              <p className="text-[10px] text-slate-600">
                For disputes, file an appeal or escalate to Troll Court.
              </p>
            </div>

            <button
              onClick={() => {
                setShowReceiptModal(false)
                setReceiptOrder(null)
              }}
              className="w-full rounded-lg bg-cyan-600 py-3 font-bold text-white transition hover:bg-cyan-500"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>
}

function AlertBox({ icon, title, tone, children }: { icon: React.ReactNode; title: string; tone: 'orange' | 'red'; children: React.ReactNode }) {
  const styles =
    tone === 'orange'
      ? 'border-orange-500/30 bg-orange-500/10 text-orange-400'
      : 'border-red-500/30 bg-red-500/10 text-red-400'

  return (
    <div className={cn('mb-4 rounded-lg border p-4', styles)}>
      <div className="mb-2 flex items-center gap-2 font-bold">
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-sm text-slate-300">{children}</p>
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
