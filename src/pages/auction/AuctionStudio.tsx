import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  Gavel,
  ImagePlus,
  Layers,
  Loader2,
  Mic2,
  Package,
  Play,
  Plus,
  Printer,
  Radio,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { validateFile, FILE_VALIDATION } from '../../lib/fileValidation'
import { cn } from '../../lib/utils'
import { generateBarcodeDataURL } from '../../lib/barcode'

interface AuctionShow {
  id: string
  title: string
  description: string | null
  category: string | null
  thumbnail_url: string | null
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
  scheduled_for: string | null
  live_started_at: string | null
  livekit_room_name: string | null
  created_at: string
  lot_count?: number
}

interface AuctionLot {
  id: string
  auction_show_id: string
  title: string
  description: string | null
  image_url: string | null
  starting_bid: number
  reserve_price: number | null
  bid_increment: number
  buy_now_price: number | null
  quantity: number
  condition: string
  status: 'draft' | 'queued' | 'live' | 'sold' | 'pass' | 'removed'
  queue_position: number
  created_at: string
  show_title?: string | null
  barcode?: string | null
}

const CATEGORIES = [
  'Electronics',
  'Pro Audio',
  'Smart Home',
  'Gaming',
  'Computers',
  'Cameras',
  'Collectibles',
  'Art',
  'Home & Garden',
  'Sports',
  'Toys & Games',
  'Vehicles',
  'Books',
  'Other',
]

const CONDITIONS = ['New', 'Like New', 'Excellent', 'Good', 'Fair', 'Used', 'For Parts']

const shell =
  'relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#07101f] px-3 pb-8 pt-20 text-white sm:px-4 md:px-6'
const panel =
  'rounded-[1.65rem] border border-cyan-300/15 bg-[#0b1628]/85 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const panelSoft =
  'rounded-[1.4rem] border border-cyan-300/12 bg-[#0d1a2f]/78 shadow-[0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const card =
  'rounded-2xl border border-cyan-300/14 bg-[#0a1425]/80 shadow-[0_0_22px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const input =
  'w-full rounded-xl border border-cyan-300/20 bg-[#07101f]/85 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15'
const primary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.28)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/18 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
const ghost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50'
const danger =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-100 transition hover:bg-red-500/20'
const iconButton =
  'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/15 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40'

function getErrorMessage(error: any, fallback: string) {
  return error?.message || error?.details || error?.hint || fallback
}

function logStudioError(scope: string, error: any, fallback: string) {
  const message = getErrorMessage(error, fallback)

  console.error(`[AuctionStudio] ${scope}:`, {
    message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    stack: error?.stack,
  })

  return message
}

function getAgoraChannelName(showId: string) {
  return `auction-${showId}`
}

function formatCoins(value: number | null | undefined) {
  return Number(value || 0).toLocaleString()
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not scheduled'

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return 'Not scheduled'
  }
}

export default function AuctionStudio() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [activeTab, setActiveTab] = useState('shows')

  const [auctioneerId, setAuctioneerId] = useState<string | null>(null)
  const [shows, setShows] = useState<AuctionShow[]>([])
  const [selectedShow, setSelectedShow] = useState<AuctionShow | null>(null)
  const [lots, setLots] = useState<AuctionLot[]>([])
  const [loading, setLoading] = useState(true)
  const [lotsLoading, setLotsLoading] = useState(false)

  const [showCreator, setShowCreator] = useState(false)
  const [lotCreator, setLotCreator] = useState(false)
  const [inventoryPicker, setInventoryPicker] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [query, setQuery] = useState('')
  const [testScanPopup, setTestScanPopup] = useState<{
    barcode: string
    title: string | null
    lot_number: string | null
    found: boolean
    timestamp: string
  } | null>(null)

  const [showForm, setShowForm] = useState({
    title: '',
    description: '',
    category: 'Electronics',
    thumbnail_url: '',
    scheduled_for: '',
  })

  const [lotForm, setLotForm] = useState({
    title: '',
    description: '',
    image_url: '',
    starting_bid: 100,
    reserve_price: 0,
    bid_increment: 500,
    buy_now_price: 0,
    quantity: 1,
    condition: 'Good',
  })

  const activeLot = useMemo(() => lots.find((lot) => lot.status === 'live') || null, [lots])

  const queuedLots = useMemo(
    () => lots.filter((lot) => lot.status === 'queued').sort((a, b) => a.queue_position - b.queue_position),
    [lots]
  )

  const soldLots = useMemo(() => lots.filter((lot) => lot.status === 'sold'), [lots])
  const nextLot = queuedLots[0] || null

  const queueValue = useMemo(() => {
    return queuedLots.reduce((sum, lot) => sum + Number(lot.starting_bid || 0), 0)
  }, [queuedLots])

  const totalLotValue = useMemo(() => {
    return lots.reduce((sum, lot) => sum + Number(lot.starting_bid || 0), 0)
  }, [lots])

  const liveShows = useMemo(() => shows.filter((show) => show.status === 'live'), [shows])

  const filteredShows = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return shows

    return shows.filter((show) => {
      return (
        show.title?.toLowerCase().includes(value) ||
        show.category?.toLowerCase().includes(value) ||
        show.status?.toLowerCase().includes(value)
      )
    })
  }, [shows, query])

  const fetchMyShows = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data: auctioneer, error: auctioneerError } = await supabase
        .from('auctioneer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (auctioneerError) throw auctioneerError

      if (!auctioneer?.id) {
        toast.error('You must be an approved auctioneer to use the studio')
        navigate('/auctions')
        return
      }

      setAuctioneerId(auctioneer.id)

      const { data, error } = await supabase
        .from('auction_shows')
        .select('*')
        .eq('auctioneer_id', auctioneer.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const showsWithCounts = await Promise.all(
        (data || []).map(async (show) => {
          const { count, error: countError } = await supabase
            .from('auction_lots')
            .select('*', { count: 'exact', head: true })
            .eq('auction_show_id', show.id)
            .neq('status', 'removed')

          if (countError) {
            console.warn('[AuctionStudio] lot count failed:', countError)
          }

          return { ...show, lot_count: count || 0 }
        })
      )

      setShows(showsWithCounts)

      setSelectedShow((current) => {
        if (!showsWithCounts.length) return null
        if (!current) return showsWithCounts[0]

        const freshSelected = showsWithCounts.find((show) => show.id === current.id)
        return freshSelected || showsWithCounts[0]
      })
    } catch (error) {
      const message = logStudioError('fetchMyShows', error, 'Failed to load auction studio')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user?.id, navigate])

  const fetchLots = useCallback(async (showId: string) => {
    setLotsLoading(true)

    try {
      const { data, error } = await supabase
        .from('auction_lots')
        .select('*')
        .eq('auction_show_id', showId)
        .neq('status', 'removed')
        .order('queue_position', { ascending: true })

      if (error) throw error
      setLots(data || [])
    } catch (error) {
      const message = logStudioError('fetchLots', error, 'Failed to load auction items')
      toast.error(message)
    } finally {
      setLotsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMyShows()
  }, [fetchMyShows])

  // Listen for test-scan broadcasts from the Auction App's "Test Barcode Scanner"
  // so the auctioneer gets a popup confirming the scanner is linked and the
  // barcode matches an item.
  useEffect(() => {
    if (!auctioneerId) return
    const channel = supabase
      .channel(`auctioneer_test_scan:${auctioneerId}`)
      .on('broadcast', { event: 'test_scan' }, ({ payload }) => {
        setTestScanPopup({
          barcode: payload.barcode,
          title: payload.title || null,
          lot_number: payload.lot_number || null,
          found: !!payload.found,
          timestamp: payload.timestamp,
        })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [auctioneerId])

  // Inventory pulled from every show (auction_lots with qty > 0), used to add
  // to the queue and deduct stock as lots are queued.
  const [inventory, setInventory] = useState<AuctionLot[]>([])

  const fetchInventory = useCallback(async () => {
    if (!auctioneerId) return
    try {
      const { data: showsData } = await supabase
        .from('auction_shows')
        .select('id, title')
        .eq('auctioneer_id', auctioneerId)
      const showIds = (showsData || []).map((s) => s.id)
      const showMap = new Map((showsData || []).map((s) => [s.id, s.title]))
      if (showIds.length === 0) {
        setInventory([])
        return
      }
      const { data } = await supabase
        .from('auction_lots')
        .select('*')
        .in('auction_show_id', showIds)
        .neq('status', 'removed')
        .gt('quantity', 0)
        .order('created_at', { ascending: false })
      const rows = (data || []) as AuctionLot[]
      setInventory(
        rows.map((row) => ({ ...row, show_title: showMap.get(row.auction_show_id) || null }) as any),
      )
    } catch (error) {
      logStudioError('fetchInventory', error, 'Failed to load inventory')
    }
  }, [auctioneerId])

  useEffect(() => {
    void fetchInventory()
  }, [fetchInventory])

  const addFromInventory = async (sourceLotId: string, qty: number) => {
    if (!selectedShow) return toast.error('Select a show first')
    if (!qty || qty < 1) return toast.error('Choose at least 1 item')
    const source = inventory.find((i) => i.id === sourceLotId)
    if (!source) return toast.error('Inventory item not found')
    // Validate against authoritative available quantity (not just legacy `quantity`).
    const available = Number((source as any).quantity_available ?? source.quantity ?? 0)
    if (qty > available) return toast.error('Not enough available stock in inventory')

    try {
      const maxPosition = lots.reduce((max, lot) => Math.max(max, Number(lot.queue_position || 0)), 0)
      const { data: inserted, error: insertError } = await supabase
        .from('auction_lots')
        .insert({
          auction_show_id: selectedShow.id,
          title: source.title,
          description: source.description,
          image_url: source.image_url,
          starting_bid: Number(source.starting_bid || 100),
          reserve_price: Number(source.reserve_price || 0) > 0 ? Number(source.reserve_price) : null,
          bid_increment: Number(source.bid_increment || 500),
          buy_now_price: Number(source.buy_now_price || 0) > 0 ? Number(source.buy_now_price) : null,
          quantity: qty,
          quantity_total: qty,
          quantity_available: qty,
          condition: source.condition,
          status: 'queued',
          queue_position: maxPosition + 1,
        })
        .select('id')
        .single()
      if (insertError) throw insertError

      // Atomically reserve the units on the source inventory. This prevents the
      // same units from being reserved for two shows and updates availability
      // immediately. The DB is the source of truth.
      const { data: reserveResult, error: reserveError } = await supabase.rpc(
        'reserve_auction_inventory',
        {
          p_source_lot_id: sourceLotId,
          p_dest_lot_id: inserted.id,
          p_show_id: selectedShow.id,
          p_qty: qty,
        }
      )
      if (reserveError) throw reserveError
      if ((reserveResult as any)?.success === false) {
        // Reservation failed (e.g. race with another reservation). Roll back the
        // just-inserted lot so the queue stays consistent.
        await supabase.from('auction_lots').delete().eq('id', inserted.id)
        throw new Error((reserveResult as any)?.error || 'Reservation failed')
      }

      toast.success(`Added ${qty} × ${source.title} to queue`)
      await fetchInventory()
      await fetchLots(selectedShow.id)
      await fetchMyShows()
    } catch (error: any) {
      const message = logStudioError('addFromInventory', error, 'Failed to add from inventory')
      toast.error(message)
    }
  }

  useEffect(() => {
    if (selectedShow?.id) {
      void fetchLots(selectedShow.id)
    } else {
      setLots([])
    }
  }, [selectedShow?.id, fetchLots])

  const createShow = async () => {
    if (!showForm.title.trim()) {
      toast.error('Show title is required')
      return
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_auction_show', {
        p_title: showForm.title.trim(),
        p_description: showForm.description.trim() || null,
        p_category: showForm.category || null,
        p_thumbnail_url: showForm.thumbnail_url.trim() || null,
        p_scheduled_for: showForm.scheduled_for ? new Date(showForm.scheduled_for).toISOString() : null,
      })

      if (rpcError) throw rpcError

      const result = rpcData as any
      if (result && result.success === false) {
        toast.error(result.error || 'Failed to create show')
        return
      }

      toast.success('Auction show created')
      setShowCreator(false)
      setShowForm({
        title: '',
        description: '',
        category: 'Electronics',
        thumbnail_url: '',
        scheduled_for: '',
      })

      await fetchMyShows()
    } catch (error: any) {
      const message = logStudioError('createShow', error, 'Failed to create show')
      toast.error(message)
    }
  }

  const deleteShow = async (showId: string) => {
    try {
      const { error } = await supabase.from('auction_shows').delete().eq('id', showId)
      if (error) throw error

      toast.success('Show deleted')
      setSelectedShow((current) => (current?.id === showId ? null : current))
      await fetchMyShows()
    } catch (error) {
      const message = logStudioError('deleteShow', error, 'Failed to delete show')
      toast.error(message)
    }
  }

  const uploadLotImage = async (file: File) => {
    if (!user?.id) return

    const validation = validateFile(file, FILE_VALIDATION.image.types, FILE_VALIDATION.image.maxSize, 'Image')
    if (!validation.valid) {
      toast.error(validation.error!)
      return
    }

    setUploadingImage(true)

    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

      const { error } = await supabase.storage.from('auction-items').upload(path, file, {
        upsert: false,
        contentType: file.type,
      })

      if (error) throw error

      const { data } = supabase.storage.from('auction-items').getPublicUrl(path)

      setLotForm((prev) => ({ ...prev, image_url: data.publicUrl }))
      toast.success('Item image uploaded')
    } catch (error: any) {
      const message = logStudioError('uploadLotImage', error, 'Image upload failed')
      toast.error(message)
    } finally {
      setUploadingImage(false)
    }
  }

  const createLot = async () => {
    if (!selectedShow) return toast.error('Select a show first')
    if (!lotForm.title.trim()) return toast.error('Item title is required')
    if (Number(lotForm.starting_bid) < 100) return toast.error('Starting bid must be at least 100 coins')

    try {
      const maxPosition = lots.reduce((max, lot) => Math.max(max, Number(lot.queue_position || 0)), 0)

      const payload = {
        auction_show_id: selectedShow.id,
        title: lotForm.title.trim(),
        description: lotForm.description.trim() || null,
        image_url: lotForm.image_url.trim() || null,
        starting_bid: Number(lotForm.starting_bid),
        reserve_price: Number(lotForm.reserve_price) > 0 ? Number(lotForm.reserve_price) : null,
        bid_increment: Number(lotForm.bid_increment || 500),
        buy_now_price: Number(lotForm.buy_now_price) > 0 ? Number(lotForm.buy_now_price) : null,
        quantity: Number(lotForm.quantity || 1),
        condition: lotForm.condition,
        status: 'queued',
        queue_position: maxPosition + 1,
      }

      const { error } = await supabase.from('auction_lots').insert(payload)

      if (error) throw error

      toast.success('Item added to auction queue')
      setLotCreator(false)
      setLotForm({
        title: '',
        description: '',
        image_url: '',
        starting_bid: 100,
        reserve_price: 0,
        bid_increment: 500,
        buy_now_price: 0,
        quantity: 1,
        condition: 'Good',
      })

      await fetchLots(selectedShow.id)
      await fetchMyShows()
    } catch (error: any) {
      const message = logStudioError('createLot', error, 'Failed to add auction item')
      toast.error(message)
    }
  }

  const updateLotStatus = async (lotId: string, status: AuctionLot['status']) => {
    if (!selectedShow) return

    try {
      const { error } = await supabase.from('auction_lots').update({ status }).eq('id', lotId)
      if (error) throw error

      await fetchLots(selectedShow.id)
      toast.success(`Lot marked ${status}`)
    } catch (error: any) {
      const message = logStudioError('updateLotStatus', error, 'Failed to update lot')
      toast.error(message)
    }
  }

  const sendLotToStage = async (lotId: string) => {
    if (!selectedShow) return

    try {
      if (activeLot && activeLot.id !== lotId) {
        const { error: activeError } = await supabase
          .from('auction_lots')
          .update({ status: 'pass' })
          .eq('id', activeLot.id)

        if (activeError) throw activeError
      }

      const { error } = await supabase.from('auction_lots').update({ status: 'live' }).eq('id', lotId)
      if (error) throw error

      await fetchLots(selectedShow.id)
      toast.success('Lot is now showing on stage')
    } catch (error: any) {
      const message = logStudioError('sendLotToStage', error, 'Failed to send lot to stage')
      toast.error(message)
    }
  }

  const reorderLot = async (lot: AuctionLot, direction: 'up' | 'down') => {
    if (!selectedShow) return

    const sorted = [...queuedLots]
    const index = sorted.findIndex((item) => item.id === lot.id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1

    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return

    const other = sorted[swapIndex]

    try {
      const [first, second] = await Promise.all([
        supabase.from('auction_lots').update({ queue_position: other.queue_position }).eq('id', lot.id),
        supabase.from('auction_lots').update({ queue_position: lot.queue_position }).eq('id', other.id),
      ])

      if (first.error) throw first.error
      if (second.error) throw second.error

      await fetchLots(selectedShow.id)
    } catch (error) {
      const message = logStudioError('reorderLot', error, 'Failed to reorder queue')
      toast.error(message)
    }
  }

  const printBarcodeLabel = useCallback(async (lotId: string) => {
    try {
      const start = Date.now()
      const wait = async () => {
        const { data: lot } = await supabase
          .from('auction_lots')
          .select('*')
          .eq('id', lotId)
          .single()
        if (lot?.barcode && lot?.lot_number) {
          const dataURL = generateBarcodeDataURL(lot.barcode)
          const printWindow = window.open('', '_blank', 'width=400,height=600')
          if (!printWindow) {
            toast.error('Pop-up blocked. Allow pop-ups to print labels.')
            return
          }
          printWindow.document.write(`
            <html>
              <head>
                <title>Print Label</title>
                <style>
                  @page { size: 2.4in 1in; margin: 0; }
                  body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; font-family: Arial, sans-serif; }
                  .label { width: 2.4in; height: 1in; border: 2px solid #000; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                  .label img { max-width: 90%; max-height: 55%; }
                  .label p { margin: 2px 0; font-size: 14px; font-weight: bold; text-align: center; }
                  .label .meta { font-size: 10px; color: #333; }
                </style>
              </head>
              <body>
                <div class="label">
                  <img src="${dataURL}" alt="${lot.barcode}" />
                  <p>${lot.barcode}</p>
                  <p class="meta">${lot.title} · ${selectedShow?.title || ''}</p>
                </div>
              </body>
            </html>
          `)
          printWindow.document.close()
          printWindow.focus()
          setTimeout(() => {
            printWindow.print()
          }, 300)
        } else if (Date.now() - start < 3000) {
          setTimeout(wait, 200)
        } else {
          toast.error('Barcode not ready yet')
        }
      }
      void wait()
    } catch {
      toast.error('Failed to print label')
    }
  }, [selectedShow?.title])

  const goLive = async (show: AuctionShow) => {
    const showLotCount = show.lot_count || lots.length

    if (showLotCount <= 0) {
      toast.error('Add at least one item before going live')
      return
    }

    try {
      const { error } = await supabase
        .from('auction_shows')
        .update({
          status: 'live',
          live_started_at: new Date().toISOString(),
          // Auctions are Agora-only. This legacy column stores the Agora channel name.
          livekit_room_name: show.livekit_room_name || getAgoraChannelName(show.id),
        })
        .eq('id', show.id)

      if (error) throw error

      toast.success('Auction show is live')
      navigate(`/auctions/studio/${show.id}/live`)
    } catch (error: any) {
      const message = logStudioError('goLive', error, 'Failed to go live')
      toast.error(message)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'border-slate-400/30 bg-slate-500/10 text-slate-200',
      scheduled: 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100',
      live: 'border-red-300/35 bg-red-500/13 text-red-100 shadow-[0_0_18px_rgba(248,113,113,0.14)]',
      ended: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
      cancelled: 'border-red-300/30 bg-red-900/20 text-red-200',
    }

    return styles[status] || styles.draft
  }

  return (
    <div className={shell}>
      <BackgroundFX />

      <main className="relative z-10 mx-auto max-w-[1720px] space-y-4">
        <header className={cn(panel, 'overflow-hidden p-4 md:p-5')}>
          <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.5rem] border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_32px_rgba(34,211,238,0.2)]">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Gavel className="h-10 w-10 text-cyan-100 drop-shadow-[0_0_14px_rgba(34,211,238,0.55)]" />
                )}
                <div className="absolute -bottom-2 rounded-full border border-cyan-300/20 bg-[#081222] px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200">
                  Mai Troll
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                    Auctioneer Control Room
                  </span>
                  {selectedShow?.status === 'live' && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-red-100">
                      <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]" />
                      Live Now
                    </span>
                  )}
                </div>

                <h1 className="bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-5xl">
                  Auctioneer Studio
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  Create shows, upload auction items, queue lots, and control exactly what appears on stage for
                  viewers.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <TopStat
                icon={<Calendar className="h-5 w-5" />}
                label="Shows"
                value={shows.length}
                helper={`${liveShows.length} live now`}
              />
              <TopStat
                icon={<Box className="h-5 w-5" />}
                label="Lots"
                value={lots.length}
                helper={`${soldLots.length} sold`}
              />
              <TopStat
                icon={<Layers className="h-5 w-5" />}
                label="Queued"
                value={queuedLots.length}
                helper={`${formatCoins(queueValue)} est. coins`}
              />
              <TopStat
                icon={<Mic2 className="h-5 w-5" />}
                label="On Stage"
                value={activeLot ? '1' : '0'}
                helper={activeLot ? `${formatCoins(activeLot.starting_bid)} current` : 'Nothing live'}
              />
            </div>
          </div>
        </header>

        <section className="grid gap-4 2xl:grid-cols-[220px_280px_minmax(0,1fr)_380px]">
          <NavigationRail activeTab={activeTab} onTabChange={setActiveTab} />

          <aside className={cn(panel, 'min-h-[760px] overflow-hidden p-4')}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">My Shows</h2>
                <p className="text-xs text-slate-500">Select a show to manage the queue.</p>
              </div>

              <button onClick={() => void fetchMyShows()} className={ghost} title="Refresh shows">
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search shows..."
                  className={cn(input, 'pl-10')}
                />
              </div>
              <button className={ghost} title="Filter">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </button>
            </div>

            <div className="h-[620px] overflow-y-auto pr-1">
              {loading ? (
                <Loading label="Loading shows..." />
              ) : filteredShows.length === 0 ? (
                <Empty
                  title="No auction shows yet"
                  subtitle="Create your first electronics auction show."
                  button={
                    <button onClick={() => setShowCreator(true)} className={primary}>
                      <Plus className="h-4 w-4" />
                      Create Show
                    </button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filteredShows.map((show) => (
                    <ShowCard
                      key={show.id}
                      show={show}
                      selected={selectedShow?.id === show.id}
                      statusClass={getStatusBadge(show.status)}
                      onClick={() => setSelectedShow(show)}
                    />
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setShowCreator(true)} className={cn(secondary, 'mt-4 w-full')}>
              <Plus className="h-4 w-4" />
              Create New Show
            </button>
          </aside>

          <section className={cn(panel, 'min-h-[760px] overflow-hidden p-4 md:p-5')}>
            {activeTab === 'shows' || activeTab === 'dashboard' ? (
              !selectedShow ? (
                <Empty
                  title="Select a show to manage auction items"
                  subtitle="Your show details, queue, and stage controls will appear here."
                />
              ) : (
                <div className="space-y-4">
                  <ShowHero
                    show={selectedShow}
                    statusClass={getStatusBadge(selectedShow.status)}
                    lotCount={selectedShow.lot_count || lots.length}
                    onPreview={() => navigate(`/auctions/${selectedShow.id}`)}
                    onAddItem={() => setLotCreator(true)}
                    onAddFromInventory={() => setInventoryPicker(true)}
                    onGoLive={() => void goLive(selectedShow)}
                    onDelete={() => void deleteShow(selectedShow.id)}
                  />

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_210px]">
                    <div className={cn(panelSoft, 'p-4')}>
                      <div className="mb-4 flex flex-col gap-3 border-b border-cyan-300/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="flex items-center gap-2 text-xl font-black">
                            <Layers className="h-5 w-5 text-cyan-300" />
                            Auction Queue
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Items in line to be shown. Use <strong className="text-slate-300">Up/Down</strong> to reorder, <strong className="text-slate-300">Show on Stage</strong> to display to bidders, <strong className="text-emerald-300">Mark Sold</strong> or <strong className="text-amber-300">Pass Lot</strong> when done.
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-2 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                              Queued
                            </p>
                            <p className="text-lg font-black text-cyan-100">{queuedLots.length}</p>
                          </div>
                          <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-2 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                              Est. Value
                            </p>
                            <p className="text-lg font-black text-cyan-100">{formatCoins(queueValue)}</p>
                          </div>
                        </div>
                      </div>

                      {lotsLoading ? (
                        <Loading label="Loading lots..." />
                      ) : lots.length === 0 ? (
                        <Empty
                          title="No items uploaded yet"
                          subtitle="Upload electronics, collectibles, or other approved lots to start the show."
                          button={
                            <button onClick={() => setLotCreator(true)} className={primary}>
                              <Package className="h-4 w-4" />
                              Upload First Item
                            </button>
                          }
                        />
                      ) : (
                        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                          {lots.map((lot, index) => (
                            <LotRow
                              key={lot.id}
                              lot={lot}
                              index={index + 1}
                              isActive={activeLot?.id === lot.id}
                              onStage={() => void sendLotToStage(lot.id)}
                              onUp={() => void reorderLot(lot, 'up')}
                              onDown={() => void reorderLot(lot, 'down')}
                              onSold={() => void updateLotStatus(lot.id, 'sold')}
                              onPass={() => void updateLotStatus(lot.id, 'pass')}
                              onRemove={() => void updateLotStatus(lot.id, 'removed')}
                              onPrint={() => void printBarcodeLabel(lot.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <MiniMetric
                        icon={<Zap className="h-5 w-5" />}
                        label="Total Value"
                        value={`${formatCoins(totalLotValue)} coins`}
                      />
                      <MiniMetric icon={<Users className="h-5 w-5" />} label="Bidders" value="Live room" />
                      <MiniMetric icon={<Radio className="h-5 w-5" />} label="Channel" value={getAgoraChannelName(selectedShow.id)} />
                      <MiniMetric
                        icon={<ShieldCheck className="h-5 w-5" />}
                        label="Studio Health"
                        value={auctioneerId ? 'Ready' : 'Checking'}
                      />
                    </div>
                  </div>
                </div>
              )
            ) : activeTab === 'lots' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white">All Lots</h2>
                    <p className="text-xs text-slate-500">Every item across all your shows.</p>
                  </div>
                  <button onClick={() => setLotCreator(true)} className={primary}>
                    <Plus className="h-4 w-4" />
                    Add New Lot
                  </button>
                </div>
                {lotsLoading ? (
                  <Loading label="Loading lots..." />
                ) : lots.length === 0 ? (
                  <Empty
                    title="No lots yet"
                    subtitle="Add items to your shows to see them here."
                    button={
                      <button onClick={() => setLotCreator(true)} className={primary}>
                        <Package className="h-4 w-4" />
                        Upload First Item
                      </button>
                    }
                  />
                ) : (
                  <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                    {lots.map((lot, index) => (
                      <LotRow
                        key={lot.id}
                        lot={lot}
                        index={index + 1}
                        isActive={activeLot?.id === lot.id}
                        onStage={() => void sendLotToStage(lot.id)}
                        onUp={() => void reorderLot(lot, 'up')}
                        onDown={() => void reorderLot(lot, 'down')}
                        onSold={() => void updateLotStatus(lot.id, 'sold')}
                        onPass={() => void updateLotStatus(lot.id, 'pass')}
                        onRemove={() => void updateLotStatus(lot.id, 'removed')}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <TabPlaceholder tab={activeTab} />
            )}
          </section>

          <aside className="space-y-4">
            <StageCard
              title="On Stage"
              tone="active"
              lot={activeLot}
              emptyText="No item is currently showing."
              footer={
                activeLot ? (
                  <button className={cn(primary, 'w-full')}>
                    <Mic2 className="h-4 w-4" />
                    Take Bid
                  </button>
                ) : undefined
              }
            />

            <StageCard
              title="Next Item"
              tone="next"
              lot={nextLot}
              emptyText="No queued item waiting."
              footer={
                nextLot ? (
                  <button onClick={() => void sendLotToStage(nextLot.id)} className={cn(primary, 'w-full')}>
                    <Play className="h-4 w-4" />
                    Show Next Lot
                  </button>
                ) : undefined
              }
            />

            <div className={cn(panelSoft, 'p-4')}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-black">Studio Status</h3>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-100">
                  Excellent
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <StatusLine label="Shows" value={shows.length} />
                <StatusLine label="Queued Items" value={queuedLots.length} />
                <StatusLine label="Sold Items" value={soldLots.length} />
                <StatusLine label="Auction Channel" value={selectedShow ? 'Agora ready' : 'Select show'} />
              </div>
            </div>
          </aside>
        </section>
      </main>

      {showCreator && (
        <Modal title="Create Auction Show" onClose={() => setShowCreator(false)}>
          <Field label="Show Title">
            <input
              className={input}
              value={showForm.title}
              onChange={(e) => setShowForm({ ...showForm, title: e.target.value })}
              placeholder="Saturday Night Tech Deals"
            />
          </Field>

          <Field label="Category">
            <select
              className={input}
              value={showForm.category}
              onChange={(e) => setShowForm({ ...showForm, category: e.target.value })}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-slate-950">
                  {cat}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description">
            <textarea
              className={cn(input, 'h-24 resize-none')}
              value={showForm.description}
              onChange={(e) => setShowForm({ ...showForm, description: e.target.value })}
              placeholder="The best tech, gadgets, and live deals for Mai Troll viewers."
            />
          </Field>

          <Field label="Thumbnail URL">
            <input
              className={input}
              value={showForm.thumbnail_url}
              onChange={(e) => setShowForm({ ...showForm, thumbnail_url: e.target.value })}
              placeholder="https://..."
            />
          </Field>

          <Field label="Schedule">
            <input
              type="datetime-local"
              className={input}
              value={showForm.scheduled_for}
              onChange={(e) => setShowForm({ ...showForm, scheduled_for: e.target.value })}
            />
          </Field>

          <button onClick={() => void createShow()} className={cn(primary, 'w-full')}>
            <Save className="h-4 w-4" />
            Create Show
          </button>
        </Modal>
      )}

      {lotCreator && (
        <Modal title="Upload Auction Item" onClose={() => setLotCreator(false)}>
          <Field label="Item Image">
            <div className="rounded-2xl border border-cyan-300/15 bg-[#07101f]/75 p-4">
              {lotForm.image_url ? (
                <img src={lotForm.image_url} alt="Lot preview" className="mb-3 h-44 w-full rounded-xl object-cover" />
              ) : (
                <div className="mb-3 flex h-44 items-center justify-center rounded-xl border border-dashed border-cyan-300/25 bg-cyan-400/5">
                  <div className="text-center">
                    <ImagePlus className="mx-auto mb-2 h-10 w-10 text-cyan-300/50" />
                    <p className="text-xs font-bold text-slate-500">Upload a clean product image</p>
                  </div>
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadLotImage(file)
                }}
                className="hidden"
                id="auction-item-upload"
              />

              <label htmlFor="auction-item-upload" className={cn(secondary, 'w-full cursor-pointer')}>
                {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploadingImage ? 'Uploading...' : 'Upload Image'}
              </label>
            </div>
          </Field>

          <Field label="Item Title">
            <input
              className={input}
              value={lotForm.title}
              onChange={(e) => setLotForm({ ...lotForm, title: e.target.value })}
              placeholder="ASUS gaming laptop, Sony camera, smart speaker..."
            />
          </Field>

          <Field label="Description">
            <textarea
              className={cn(input, 'h-24 resize-none')}
              value={lotForm.description}
              onChange={(e) => setLotForm({ ...lotForm, description: e.target.value })}
              placeholder="Add specs, condition details, model number, and what is included."
            />
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Starting Bid">
              <input
                type="number"
                className={input}
                value={lotForm.starting_bid}
                onChange={(e) => setLotForm({ ...lotForm, starting_bid: Number(e.target.value) })}
              />
            </Field>

            <Field label="Bid Increment">
              <input
                type="number"
                className={input}
                value={lotForm.bid_increment}
                onChange={(e) => setLotForm({ ...lotForm, bid_increment: Number(e.target.value) })}
              />
            </Field>

            <Field label="Reserve Price">
              <input
                type="number"
                className={input}
                value={lotForm.reserve_price}
                onChange={(e) => setLotForm({ ...lotForm, reserve_price: Number(e.target.value) })}
              />
            </Field>

            <Field label="Buy Now Price">
              <input
                type="number"
                className={input}
                value={lotForm.buy_now_price}
                onChange={(e) => setLotForm({ ...lotForm, buy_now_price: Number(e.target.value) })}
              />
            </Field>

            <Field label="Quantity">
              <input
                type="number"
                className={input}
                value={lotForm.quantity}
                onChange={(e) => setLotForm({ ...lotForm, quantity: Number(e.target.value) })}
              />
            </Field>

            <Field label="Condition">
              <select
                className={input}
                value={lotForm.condition}
                onChange={(e) => setLotForm({ ...lotForm, condition: e.target.value })}
              >
                {CONDITIONS.map((condition) => (
                  <option key={condition} value={condition} className="bg-slate-950">
                    {condition}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button onClick={() => void createLot()} className={cn(primary, 'w-full')}>
            <Package className="h-4 w-4" />
            Add Item to Queue
          </button>
        </Modal>
      )}

      {inventoryPicker && (
        <InventoryPickerModal
          inventory={inventory}
          onClose={() => setInventoryPicker(false)}
          onAdd={async (id, qty) => {
            await addFromInventory(id, qty)
          }}
        />
      )}

      {testScanPopup && (
        <TestScanPopup
          data={testScanPopup}
          onClose={() => setTestScanPopup(null)}
        />
      )}
    </div>
  )
}

function TestScanPopup({
  data,
  onClose,
}: {
  data: { barcode: string; title: string | null; lot_number: string | null; found: boolean; timestamp: string }
  onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[99995] flex items-start justify-center bg-black/70 p-4 pt-28 backdrop-blur-md">
      <div className={cn(panel, 'w-full max-w-md overflow-hidden p-6 text-center')}>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-emerald-300/30 bg-emerald-400/10">
          <CheckCircle2 className="h-7 w-7 text-emerald-300" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Scanner Connected</p>
        <h2 className="mt-1 text-xl font-black text-white">Test Scan Received</h2>

        <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-white/[0.03] p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Barcode</p>
          <p className="break-all font-mono text-sm font-bold text-cyan-200">{data.barcode}</p>

          {data.title ? (
            <>
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">Item</p>
              <p className="font-black text-white">{data.title}</p>
              {data.lot_number && (
                <p className="text-xs text-slate-400">Lot #{data.lot_number}</p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm font-bold text-amber-300">
              Barcode received, but no matching item was found. The scanner link works.
            </p>
          )}
        </div>

        <p className="mt-3 text-[10px] text-slate-500">
          {new Date(data.timestamp).toLocaleTimeString()} · Auction App → Auction Studio
        </p>

        <button onClick={onClose} className={cn(primary, 'mt-4 w-full')}>
          <Check className="h-4 w-4" />
          Got it
        </button>
      </div>
    </div>
  )
}

function InventoryPickerModal({
  inventory,
  onClose,
  onAdd,
}: {
  inventory: AuctionLot[]
  onClose: () => void
  onAdd: (lotId: string, qty: number) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string>('')
  const [qty, setQty] = useState<number>(1)
  const [busy, setBusy] = useState(false)

  const selected = inventory.find((i) => i.id === selectedId) || null
  const max = selected ? (selected.quantity || 0) : 0

  const handleAdd = async () => {
    if (!selectedId) return toast.error('Select an inventory item')
    if (qty < 1) return toast.error('Choose at least 1 item')
    setBusy(true)
    try {
      await onAdd(selectedId, qty)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add from Inventory" onClose={onClose}>
      <Field label="Inventory Item">
        <select
          className={input}
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value)
            setQty(1)
          }}
        >
          <option value="" className="bg-slate-950">Select an item…</option>
          {inventory.map((item) => (
            <option key={item.id} value={item.id} className="bg-slate-950">
              {item.title} — {item.quantity} in stock{(item.show_title && item.show_title !== '') ? ` (${item.show_title})` : ''}
            </option>
          ))}
        </select>
      </Field>

      {inventory.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-slate-500">
          No inventory items with stock available. Add items to a show first.
        </div>
      )}

      {selected && (
        <div className="rounded-2xl border border-cyan-300/15 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#07101f]">
              {selected.image_url ? (
                <img src={selected.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-7 w-7 text-slate-600" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-black text-white">{selected.title}</p>
              <p className="text-xs text-slate-400">In stock: <span className="text-amber-300">{selected.quantity}</span></p>
              {selected.barcode && (
                <p className="text-[10px] font-mono text-slate-500">{selected.barcode}</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <Field label={`How many to add? (max ${max})`}>
              <input
                type="number"
                min={1}
                max={max}
                className={input}
                value={qty}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(max, Number(e.target.value) || 1))
                  setQty(v)
                }}
              />
            </Field>
            <p className="mt-2 text-xs text-slate-500">
              Adding <span className="font-bold text-cyan-200">{qty}</span> will deduct that many from your inventory stock.
            </p>
          </div>
        </div>
      )}

      <button onClick={handleAdd} disabled={!selectedId || busy} className={cn(primary, 'w-full')}>
        <Box className="h-4 w-4" />
        {busy ? 'Adding…' : 'Add to Queue'}
      </button>
    </Modal>
  )
}

function TabPlaceholder({ tab }: { tab: string }) {
  const labels: Record<string, { title: string; desc: string }> = {
    inventory: { title: 'Inventory', desc: 'View and manage all your auction items across every show.' },
    bidders: { title: 'Bidders & Winners', desc: 'See who won bids and batch multi-item orders for shipping.' },
    sales: { title: 'Sales & Fulfillment', desc: 'Track sales, add tracking numbers, and manage order delivery.' },
    analytics: { title: 'Analytics', desc: 'Performance overview across all your auction shows.' },
    settings: { title: 'Settings', desc: 'Configure your auctioneer defaults and preferences.' },
    orders: { title: 'Orders', desc: 'Track all auction orders, payments, and fulfillment status.' },
    packing: { title: 'Packing Station', desc: 'Scan lot barcodes to auto-load winner and order info for packing.' },
    devices: { title: 'Devices', desc: 'Manage scanners, printers, and hardware integrations.' },
  }
  const info = labels[tab] || { title: tab, desc: 'This section is coming soon.' }

  return (
    <div className="flex min-h-[400px] items-center justify-center text-center">
      <div className="max-w-md">
        <Gavel className="mx-auto mb-4 h-12 w-12 text-slate-600" />
        <p className="text-xl font-black text-white">{info.title}</p>
        <p className="mt-2 text-sm text-slate-500">{info.desc}</p>
        <p className="mt-4 text-xs text-slate-600">This page is available as a separate tab in the auctioneer studio.</p>
      </div>
    </div>
  )
}

function BackgroundFX() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_32%),radial-gradient(circle_at_75%_20%,rgba(59,130,246,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_34%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />
    </>
  )
}

function NavigationRail({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const items = [
    { label: 'Dashboard', icon: BarChart3, tab: 'dashboard', route: '/auctions/studio' },
    { label: 'My Shows', icon: Calendar, tab: 'shows', route: '/auctions/studio' },
    { label: 'Lots', icon: Box, tab: 'lots', route: '/auctions/studio' },
    { label: 'Inventory', icon: Package, tab: 'inventory', route: '/auctions/inventory' },
    { label: 'Orders', icon: ShoppingBag, tab: 'orders', route: '/auctions/orders' },
    { label: 'Packing', icon: Layers, tab: 'packing', route: '/auctions/packing' },
    { label: 'Bidders', icon: Users, tab: 'bidders', route: '/auctions/bidders' },
    { label: 'Sales', icon: CheckCircle2, tab: 'sales', route: '/auctions/sales' },
    { label: 'Devices', icon: Settings, tab: 'devices', route: '/auctions/devices' },
    { label: 'Analytics', icon: BarChart3, tab: 'analytics', route: '/auctions/analytics' },
    { label: 'Settings', icon: Settings, tab: 'settings', route: '/auctions/settings' },
  ]

  const handleClick = (item: typeof items[number]) => {
    onTabChange(item.tab)
    navigate(item.route)
  }

  return (
    <aside className={cn(panel, 'hidden min-h-[760px] p-4 2xl:block')}>
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_35px_rgba(34,211,238,0.16)]">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Gavel className="h-12 w-12 text-cyan-100" />
          )}
        </div>
        <p className="text-lg font-black uppercase tracking-[0.18em] text-white">Auctioneer</p>
        <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">Studio</p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Mai Troll</p>
      </div>

      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.label}
              onClick={() => handleClick(item)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-bold transition',
                activeTab === item.tab
                  ? 'border-cyan-300/25 bg-cyan-400/12 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)]'
                  : 'border-transparent text-slate-400 hover:border-cyan-300/15 hover:bg-cyan-400/8 hover:text-cyan-100'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-12 rounded-[1.5rem] border border-cyan-300/15 bg-cyan-400/8 p-4 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Stream Health</p>
        <p className="mt-2 text-sm font-black text-emerald-300">Excellent</p>
      </div>
    </aside>
  )
}

function TopStat({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  helper: string
}) {
  return (
    <div className="min-w-[175px] rounded-2xl border border-cyan-300/14 bg-[#0d1a2f]/88 p-4 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/16 bg-cyan-400/10 text-cyan-200">
          {icon}
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400">{label}</p>
          <p className="text-2xl font-black text-white">{value}</p>
        </div>
      </div>
      <div className="mt-3 border-t border-white/8 pt-2 text-xs font-bold text-slate-500">{helper}</div>
    </div>
  )
}

function ShowCard({
  show,
  selected,
  statusClass,
  onClick,
}: {
  show: AuctionShow
  selected: boolean
  statusClass: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border p-3 text-left transition',
        selected
          ? 'border-cyan-300/50 bg-cyan-400/12 shadow-[0_0_28px_rgba(34,211,238,0.18)]'
          : 'border-white/10 bg-white/[0.035] hover:border-cyan-300/25 hover:bg-cyan-400/8'
      )}
    >
      <div className="flex gap-3">
        <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#07101f]">
          {show.thumbnail_url ? (
            <img src={show.thumbnail_url} alt={show.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-cyan-400/5">
              <Gavel className="h-7 w-7 text-cyan-300/35" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-black text-white">{show.title}</h3>
            {show.status === 'live' && (
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-red-100">
                Live
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-1">
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-black uppercase', statusClass)}>
              {show.status}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
              {show.lot_count || 0} lots
            </span>
          </div>

          <p className="mt-1 truncate text-xs text-slate-500">{show.category || 'Uncategorized'}</p>
        </div>
      </div>
    </button>
  )
}

function ShowHero({
  show,
  statusClass,
  lotCount,
  onPreview,
  onAddItem,
  onAddFromInventory,
  onGoLive,
  onDelete,
}: {
  show: AuctionShow
  statusClass: string
  lotCount: number
  onPreview: () => void
  onAddItem: () => void
  onAddFromInventory: () => void
  onGoLive: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const canGoLive = show.status === 'draft' || show.status === 'scheduled'
  const canDelete = show.status === 'draft'

  return (
    <section className="rounded-[1.5rem] border border-cyan-300/14 bg-[#081425]/85 p-4 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="h-40 overflow-hidden rounded-2xl border border-cyan-300/15 bg-cyan-400/6 xl:w-64 xl:shrink-0">
          {show.thumbnail_url ? (
            <img src={show.thumbnail_url} alt={show.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle,rgba(34,211,238,0.18),transparent_60%)] text-center">
              <Gavel className="mb-3 h-12 w-12 text-cyan-200/70" />
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Auction Show</p>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-100">
                  {show.category || 'Auction'}
                </span>
                <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase', statusClass)}>
                  {show.status}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-slate-400">
                  <Clock3 className="h-3 w-3" />
                  {show.status === 'live' ? `Started ${formatDateTime(show.live_started_at)}` : formatDateTime(show.scheduled_for)}
                </span>
              </div>

              <h2 className="truncate text-2xl font-black text-white md:text-3xl">{show.title}</h2>
              <p className="mt-2 line-clamp-2 max-w-4xl text-sm leading-6 text-slate-300">
                {show.description || 'No description yet. Add a clean show description before launch.'}
              </p>
            </div>

            <div className="text-left lg:text-right">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Lots</p>
              <p className="text-3xl font-black text-cyan-100">{lotCount}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={onPreview} className={secondary}>
              <Eye className="h-4 w-4" />
              Preview
            </button>

            <button onClick={onAddItem} className={secondary}>
              <Plus className="h-4 w-4" />
              Add Item
            </button>

            <button onClick={onAddFromInventory} className={secondary}>
              <Box className="h-4 w-4" />
              Add from Inventory
            </button>

            {canGoLive && (
              <button onClick={onGoLive} className={primary}>
                <Radio className="h-4 w-4" />
                Go Live
              </button>
            )}

            {show.status === 'live' && (
              <button onClick={() => navigate(`/auctions/studio/${show.id}/live`)} className={primary}>
                <Radio className="h-4 w-4" />
                Live Control
              </button>
            )}

            {canDelete && (
              <button onClick={onDelete} className={danger}>
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function LotRow({
  lot,
  index,
  isActive,
  onStage,
  onUp,
  onDown,
  onSold,
  onPass,
  onRemove,
  onPrint,
}: {
  lot: AuctionLot
  index: number
  isActive: boolean
  onStage: () => void
  onUp: () => void
  onDown: () => void
  onSold: () => void
  onPass: () => void
  onRemove: () => void
  onPrint?: () => void
}) {
  return (
    <article
      className={cn(
        'rounded-2xl border p-4 transition',
        isActive
          ? 'border-cyan-300/45 bg-cyan-400/12 shadow-[0_0_26px_rgba(34,211,238,0.16)]'
          : 'border-white/10 bg-white/[0.035] hover:border-cyan-300/18'
      )}
    >
      {/* Top row: number, image, info, price */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Left: position number */}
        <div className="flex shrink-0 items-center gap-3 sm:flex-col">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#07101f] text-sm font-black text-slate-300">
            {index}
          </div>
          {isActive && (
            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black uppercase text-cyan-100">
              Live
            </span>
          )}
        </div>

        {/* Image */}
        <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#07101f]">
          {lot.image_url ? (
            <img src={lot.image_url} className="h-full w-full object-cover" alt={lot.title} />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-8 w-8 text-slate-600" />
            </div>
          )}
        </div>

        {/* Info block */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-black text-white">{lot.title}</h4>
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-black uppercase',
                lot.status === 'sold'
                  ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
                  : lot.status === 'pass'
                  ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
                  : 'border-white/10 bg-slate-950/60 text-slate-300'
              )}
            >
              {lot.status}
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{lot.description || 'No description'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-slate-400">
              Start: <span className="text-cyan-200">{formatCoins(lot.starting_bid)}</span>
            </span>
            <span className="font-bold text-slate-400">
              Increment: <span className="text-white">{formatCoins(lot.bid_increment)}</span>
            </span>
            <span className="font-bold text-slate-400">
              Condition: <span className="text-emerald-300">{lot.condition}</span>
            </span>
            {lot.buy_now_price && lot.buy_now_price > 0 && (
              <span className="font-bold text-slate-400">
                Buy Now: <span className="text-amber-300">{formatCoins(lot.buy_now_price)}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: action buttons — always visible, clear labels, no icons-only buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
        <button
          onClick={onStage}
          disabled={isActive}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition',
            isActive
              ? 'cursor-not-allowed border-cyan-300/20 bg-cyan-400/5 text-cyan-300/50'
              : 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20'
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          {isActive ? 'On Stage' : 'Show on Stage'}
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onUp}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-cyan-100"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            Up
          </button>
          <button
            onClick={onDown}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-cyan-100"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Down
          </button>
        </div>

        <div className="mx-1 h-6 w-px bg-white/10" />

        <button
          onClick={onSold}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-100 transition hover:bg-emerald-400/20"
        >
          <Check className="h-3.5 w-3.5" />
          Mark Sold
        </button>

        <button
          onClick={onPass}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-400/20"
        >
          <X className="h-3.5 w-3.5" />
          Pass Lot
        </button>

        {onPrint && (
          <button
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/20"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Barcode
          </button>
        )}

        <div className="flex-1" />

        <button
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-500/8 px-3 py-2 text-xs font-bold text-red-200 transition hover:border-red-300/35 hover:bg-red-500/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </button>
      </div>
    </article>
  )
}

function StageCard({
  title,
  tone,
  lot,
  emptyText,
  footer,
}: {
  title: string
  tone: 'active' | 'next'
  lot: AuctionLot | null
  emptyText: string
  footer?: React.ReactNode
}) {
  const isActive = tone === 'active'

  return (
    <div
      className={cn(
        'rounded-[1.5rem] border bg-[#081425]/88 p-4 shadow-[0_0_30px_rgba(34,211,238,0.1)] backdrop-blur-xl',
        isActive ? 'border-cyan-300/45 shadow-[0_0_35px_rgba(34,211,238,0.16)]' : 'border-purple-300/25'
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-slate-200">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              isActive
                ? 'bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)]'
                : 'bg-purple-300 shadow-[0_0_14px_rgba(168,85,247,0.75)]'
            )}
          />
          {title}
        </h3>
        <BarChart3 className={cn('h-4 w-4', isActive ? 'text-cyan-300' : 'text-purple-300')} />
      </div>

      {lot ? (
        <div>
          <div className="mb-4 h-48 overflow-hidden rounded-2xl border border-white/10 bg-[#07101f]">
            {lot.image_url ? (
              <img src={lot.image_url} className="h-full w-full object-cover" alt={lot.title} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle,rgba(34,211,238,0.15),transparent_65%)]">
                <Package className="h-16 w-16 text-cyan-300/35" />
              </div>
            )}
          </div>

          <h4 className="line-clamp-2 text-lg font-black text-white">{lot.title}</h4>
          <p className="mt-1 text-sm text-slate-500">
            Condition: <span className="font-bold text-emerald-300">{lot.condition}</span>
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                {isActive ? 'Current Bid' : 'Start Bid'}
              </p>
              <p className="text-2xl font-black text-cyan-100">{formatCoins(lot.starting_bid)}</p>
            </div>
            <div className="border-l border-white/10 pl-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Increment</p>
              <p className="text-2xl font-black text-white">{formatCoins(lot.bid_increment)}</p>
            </div>
          </div>

          {footer && <div className="mt-4">{footer}</div>}
        </div>
      ) : (
        <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-6 text-center">
          <div>
            <Gavel className="mx-auto mb-3 h-10 w-10 text-slate-600" />
            <p className="text-sm font-bold text-slate-500">{emptyText}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className={cn(card, 'p-4')}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-200">
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white">{value}</p>
    </div>
  )
}

function StatusLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="truncate font-black text-slate-100">{value}</span>
    </div>
  )
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-cyan-300" />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )
}

function Empty({
  title,
  subtitle,
  button,
}: {
  title: string
  subtitle?: string
  button?: React.ReactNode
}) {
  return (
    <div className="flex min-h-[260px] items-center justify-center text-center">
      <div className="max-w-sm">
        <Gavel className="mx-auto mb-4 h-12 w-12 text-slate-600" />
        <p className="font-black text-white">{title}</p>
        {subtitle && <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>}
        {button && <div className="mt-4">{button}</div>}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-black text-cyan-100">{label}</span>
      {children}
    </label>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className={cn(panel, 'max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6')}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Auctioneer Studio</p>
            <h2 className="mt-1 text-2xl font-black">{title}</h2>
          </div>

          <button onClick={onClose} className={danger}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
}