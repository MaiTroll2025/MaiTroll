import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Box, Camera, ChevronRight, Coins, Package, Printer, RefreshCw, Scan, Settings as SettingsIcon, Smartphone, Truck, Wifi, Zap } from 'lucide-react';
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner'
import { useLotSelection } from '../../hooks/useLotSelection'
import { useZxingScanner } from '../../hooks/useZxingScanner'
import { CARRIERS } from '../../lib/auctionFees'
import { generateBarcodeDataURL } from '../../lib/barcode'
import ItemBarcodeLabel from '../../components/auction/ItemBarcodeLabel'

type Tab = 'live' | 'items' | 'scanner' | 'orders' | 'shipping' | 'sales' | 'devices' | 'settings'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'live', label: 'Live', icon: <Zap className="h-4 w-4" /> },
  { id: 'items', label: 'Items', icon: <Box className="h-4 w-4" /> },
  { id: 'scanner', label: 'Scanner', icon: <Scan className="h-4 w-4" /> },
  { id: 'orders', label: 'Orders', icon: <Package className="h-4 w-4" /> },
  { id: 'shipping', label: 'Shipping', icon: <Truck className="h-4 w-4" /> },
  { id: 'sales', label: 'Sales', icon: <Coins className="h-4 w-4" /> },
  { id: 'devices', label: 'Devices', icon: <Smartphone className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon className="h-4 w-4" /> },
]

function formatCoins(v?: number | null) {
  return Number(v || 0).toLocaleString()
}

interface LotRow {
  id: string
  auction_show_id: string
  title: string
  description?: string | null
  barcode?: string | null
  lot_number?: string | null
  sku?: string | null
  item_number?: string | null
  status: string
  starting_bid: number
  current_highest_bid?: number | null
  current_highest_bidder_id?: string | null
  image_url?: string | null
  image_urls?: string[] | null
  shipping_base_price?: number | null
  shipping_method?: string | null
  created_at?: string
  queue_position?: number | null
  order_index?: number | null
}

interface ShowRow {
  id: string
  title: string
  status: string
  auctioneer_id: string
}

export default function AuctionApp() {
  const { showId: routeShowId } = useParams<{ showId: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [auctioneerId, setAuctioneerId] = useState<string | null>(null)
  const [shows, setShows] = useState<ShowRow[]>([])
  const [show, setShow] = useState<ShowRow | null>(null)
  const [lots, setLots] = useState<LotRow[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('live')
  const [synced, setSynced] = useState(false)
  const [loading, setLoading] = useState(true)

  const isAuctioneer = useMemo(
    () => (profile?.role as string) === 'auctioneer' || profile?.is_admin === true,
    [profile],
  )

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('auctioneer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => setAuctioneerId(data?.id ?? null))
  }, [user?.id])

  const loadShows = useCallback(async () => {
    if (!auctioneerId) return
    const { data } = await supabase
      .from('auction_shows')
      .select('*')
      .eq('auctioneer_id', auctioneerId)
      .order('created_at', { ascending: false })
    setShows((data as ShowRow[]) || [])
  }, [auctioneerId])

  useEffect(() => { void loadShows() }, [loadShows])

  // Resolve selected show.
  useEffect(() => {
    if (!shows.length) return
    const picked = shows.find((s) => s.id === routeShowId) || (shows.length === 1 ? shows[0] : null)
    setShow(picked || null)
  }, [shows, routeShowId])

  const loadLots = useCallback(async () => {
    if (!show?.id) return
    const { data } = await supabase
      .from('auction_lots')
      .select('*')
      .eq('auction_show_id', show.id)
      .neq('status', 'removed')
      .order('queue_position', { ascending: true })
    setLots((data as LotRow[]) || [])
  }, [show?.id])

  const loadOrders = useCallback(async () => {
    if (!auctioneerId) return
    const { data } = await supabase
      .from('auction_orders')
      .select('*, auction_lots (title, lot_number, image_urls)')
      .eq('auctioneer_id', auctioneerId)
      .order('created_at', { ascending: false })
    setOrders((data as any[]) || [])
  }, [auctioneerId])

  useEffect(() => { void loadLots() }, [loadLots])
  useEffect(() => { void loadOrders() }, [loadOrders])

  // Realtime: canonical show channel + db change subscriptions.
  useEffect(() => {
    if (!show?.id) { setLoading(false); return }
    setLoading(false)
    setSynced(true)
    const channel = supabase
      .channel(`auction:${show.id}`)
      .on('broadcast', { event: 'lot_sold' }, () => { void loadLots(); void loadOrders() })
      .on('broadcast', { event: 'lot_started' }, () => { void loadLots() })
      .subscribe()
    const lotCh = supabase
      .channel(`auction-lots:${show.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_lots', filter: `auction_show_id=eq.${show.id}` },
        () => { void loadLots() })
      .subscribe()
    const ordCh = supabase
      .channel(`auction-orders:${auctioneerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_orders', filter: `auctioneer_id=eq.${auctioneerId}` },
        () => { void loadOrders() })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(lotCh)
      supabase.removeChannel(ordCh)
    }
  }, [show?.id, auctioneerId, loadLots, loadOrders])

  if (!isAuctioneer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07101f] text-white">
        <div className="text-center">
          <Smartphone className="mx-auto h-16 w-16 text-slate-600" />
          <h1 className="mt-4 text-xl font-black">Access Denied</h1>
          <p className="mt-2 text-sm text-slate-400">Only authorized auctioneers can use the Auction App.</p>
        </div>
      </div>
    )
  }

  if (loading && !show) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07101f] text-white">
        <RefreshCw className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    )
  }

  if (!show) {
    return (
      <div className="min-h-screen bg-[#07101f] p-4 text-white">
        <Header onBack={() => navigate('/auctions/studio')} synced={false} />
        <div className="mx-auto max-w-3xl space-y-3 pt-6">
          <h2 className="text-lg font-black">Select a Show</h2>
          {shows.length === 0 && <p className="text-sm text-slate-400">No shows yet. Create one in Auction Studio.</p>}
          {shows.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/auction-app/${s.id}`)}
              className="flex w-full items-center justify-between rounded-2xl border border-cyan-300/20 bg-white/5 p-4 text-left hover:bg-cyan-400/10"
            >
              <div>
                <p className="font-black">{s.title}</p>
                <p className="text-xs text-slate-400">{s.status}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07101f] text-white">
      <Header onBack={() => navigate('/auctions/studio')} synced={synced} showTitle={show.title} showStatus={show.status} />
      <div className="mx-auto max-w-5xl px-3 pb-28 pt-3">
        {activeTab === 'live' && (
          <LiveControl
            show={show}
            lots={lots}
            orders={orders}
            onChanged={() => { void loadLots(); void loadOrders() }}
            auctioneerUsername={profile?.username || profile?.display_name || 'auctioneer'}
          />
        )}
        {activeTab === 'items' && (
          <ItemsPanel show={show} lots={lots} onChanged={() => void loadLots()} />
        )}
        {activeTab === 'scanner' && <ScannerPanel show={show} lots={lots} onSelectLot={() => void loadLots()} auctioneerId={auctioneerId} onStartLot={(id) => {
          supabase.rpc('auction_lot_action', { p_show_id: show.id, p_lot_id: id, p_action: 'start' }).then(({ error }) => {
            if (error) return toast.error(error.message)
            toast.success('Auction started')
            void loadLots()
          })
        }} />}
        {activeTab === 'orders' && <OrdersPanel orders={orders} />}
        {activeTab === 'shipping' && <ShippingPanel orders={orders} onChanged={() => void loadOrders()} />}
        {activeTab === 'sales' && <SalesPanel orders={orders} lots={lots} />}
        {activeTab === 'devices' && <DevicesPanel auctioneerId={auctioneerId} />}
        {activeTab === 'settings' && <SettingsPanel show={show} />}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 gap-1 border-t border-cyan-300/15 bg-[#0b1628]/95 px-1 py-1 backdrop-blur-xl sm:grid-cols-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-bold transition ${
              activeTab === t.id ? 'bg-cyan-400/15 text-cyan-200' : 'text-slate-400'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Header({ onBack, synced, showTitle, showStatus }: { onBack: () => void; synced: boolean; showTitle?: string; showStatus?: string }) {
  return (
    <header className="flex items-center justify-between border-b border-cyan-300/15 bg-[#0b1628]/90 px-3 py-3 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-sm font-black">Auction App</p>
          {showTitle && <p className="text-[10px] text-slate-400">{showTitle} · {showStatus}</p>}
        </div>
      </div>
      <span className="hidden">
        <Wifi className="h-3 w-3" />
        {synced ? 'Synced' : 'Offline'}
      </span>
    </header>
  )
}

// ---------------------------------------------------------------- LIVE CONTROL
function LiveControl({ show, lots, orders, onChanged, auctioneerUsername }: {
  show: ShowRow; lots: LotRow[]; orders: any[]; onChanged: () => void; auctioneerUsername: string
}) {
  const current = lots.find((l) => l.status === 'live') || null
  const queue = lots.filter((l) => ['queued', 'draft'].includes(l.status)).sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0))
  const prevLot = lots.filter((l) => ['sold', 'passed', 'unsold', 'held'].includes(l.status)).slice(-1)[0] || null
  const nextLot = queue[0] || null

  const [busy, setBusy] = useState(false)

  const act = useCallback(async (fn: () => any, ok: string) => {
    setBusy(true)
    try { const { error } = await fn(); if (error) throw error; toast.success(ok) ; onChanged() }
    catch (e: any) { toast.error(e?.message || 'Action failed') }
    finally { setBusy(false) }
  }, [onChanged])

  const startLot = (id: string) => act(() => supabase.rpc('auction_lot_action', { p_show_id: show.id, p_lot_id: id, p_action: 'start' }), 'Item started')
  const sold = (id: string) => act(() => supabase.rpc('mark_lot_sold', { p_lot_id: id }), 'Marked sold')
  const generic = (id: string, action: string, msg: string) => act(() => supabase.rpc('auction_lot_action', { p_show_id: show.id, p_lot_id: id, p_action: action }), msg)

  const orderFor = (lotId: string) => orders.find((o) => o.lot_id === lotId)

  return (
    <div className="space-y-4">
      {current ? (
        <div className="rounded-3xl border border-cyan-400/25 bg-white/[0.04] p-5 shadow-[0_0_35px_rgba(34,211,238,0.1)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Live · {current.lot_number}</p>
              <h2 className="mt-1 text-2xl font-black">{current.title}</h2>
            </div>
            <ItemBarcodeLabel lot={current} showName={show.title} auctioneerUsername={auctioneerUsername}
              sale={orderFor(current.id) ? {
                order_number: orderFor(current.id).order_number,
                winner_username: orderFor(current.id).winner_username,
                winning_bid: orderFor(current.id).sale_amount,
                shipping_fee: orderFor(current.id).shipping_cost,
                carrier_code: orderFor(current.id).carrier_code,
                carrier_name: orderFor(current.id).carrier_name,
                tracking_number: orderFor(current.id).tracking_number,
                sold_at: orderFor(current.id).created_at,
                local_pickup: orderFor(current.id).carrier_code === 'local_pickup',
              } : null}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Start" value={`${formatCoins(current.starting_bid)} TC`} />
            <Stat label="Current" value={`${formatCoins(current.current_highest_bid || current.starting_bid)} TC`} />
            <Stat label="Bidder" value={current.current_highest_bidder_id ? `…${current.current_highest_bidder_id.slice(-6)}` : '—'} />
            <Stat label="Status" value={current.status} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Btn onClick={() => sold(current.id)} busy={busy} tone="emerald">Sold</Btn>
            <Btn onClick={() => generic(current.id, 'hold', 'Held')} busy={busy} tone="amber">Hold</Btn>
            <Btn onClick={() => generic(current.id, 'pass', 'Passed')} busy={busy} tone="slate">Pass</Btn>
            <Btn onClick={() => generic(current.id, 'unsold', 'Unsold')} busy={busy} tone="red">Unsold</Btn>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Btn onClick={() => generic(current.id, 'pause', 'Paused')} busy={busy}>Pause</Btn>
            <Btn onClick={() => generic(current.id, 'resume', 'Resumed')} busy={busy}>Resume</Btn>
            <Btn onClick={() => nextLot && startLot(nextLot.id)} busy={busy} disabled={!nextLot}>Next</Btn>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <p className="text-slate-400">No item is live. Start the next queued item.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <QueueCard title="Previous" lot={prevLot} />
        <QueueCard title="Next" lot={nextLot} onStart={nextLot ? () => startLot(nextLot.id) : undefined} />
      </div>
    </div>
  )
}

function QueueCard({ title, lot, onStart }: { title: string; lot: LotRow | null; onStart?: () => void }) {
  if (!lot) return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-slate-500">{title}: —</div>
  )
  return (
    <div className="rounded-2xl border border-cyan-300/15 bg-white/[0.04] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-1 font-black">{lot.title}</p>
      <p className="text-xs text-slate-400">{lot.lot_number}</p>
      {onStart && <button onClick={onStart} className="mt-2 w-full rounded-xl border border-green-300/30 bg-green-500/20 py-2 text-sm font-bold text-green-100">Start</button>}
    </div>
  )
}

// ---------------------------------------------------------------- ITEMS
function ItemsPanel({ show, lots, onChanged }: { show: ShowRow; lots: LotRow[]; onChanged: () => void }) {
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', sku: '', starting_bid: 100, bid_increment: 500, shipping_base_price: 0, shipping_method: 'shipping' })

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
                  <p class="meta">${lot.title} · ${show.title}</p>
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
  }, [show.title])

  const create = async () => {
    if (!form.title.trim()) return toast.error('Title required')
    const { data, error } = await supabase.from('auction_lots').insert({
      auction_show_id: show.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      sku: form.sku.trim() || null,
      starting_bid: Number(form.starting_bid),
      bid_increment: Number(form.bid_increment),
      shipping_base_price: Number(form.shipping_base_price),
      shipping_method: form.shipping_method,
      status: 'queued',
    }).select('id').single()
    if (error) return toast.error(error.message)
    toast.success('Item added — barcode generated automatically')
    setCreating(false)
    setForm({ title: '', description: '', sku: '', starting_bid: 100, bid_increment: 500, shipping_base_price: 0, shipping_method: 'shipping' })
    onChanged()
    if (data?.id) {
      void printBarcodeLabel(data.id)
    }
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setCreating((v) => !v)} className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-400/10 py-3 font-bold text-cyan-100">
        + Add Item
      </button>
      {creating && (
        <div className="space-y-2 rounded-2xl border border-cyan-300/15 bg-white/[0.03] p-4">
          <input className="w-full rounded-xl border border-cyan-300/20 bg-black/40 px-3 py-2 text-sm" placeholder="Title"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="w-full rounded-xl border border-cyan-300/20 bg-black/40 px-3 py-2 text-sm" placeholder="SKU / item number"
            value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <textarea className="w-full rounded-xl border border-cyan-300/20 bg-black/40 px-3 py-2 text-sm" placeholder="Description"
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" className="rounded-xl border border-cyan-300/20 bg-black/40 px-3 py-2 text-sm" placeholder="Start bid"
              value={form.starting_bid} onChange={(e) => setForm({ ...form, starting_bid: Number(e.target.value) })} />
            <input type="number" className="rounded-xl border border-cyan-300/20 bg-black/40 px-3 py-2 text-sm" placeholder="Increment"
              value={form.bid_increment} onChange={(e) => setForm({ ...form, bid_increment: Number(e.target.value) })} />
            <input type="number" className="rounded-xl border border-cyan-300/20 bg-black/40 px-3 py-2 text-sm" placeholder="Shipping base"
              value={form.shipping_base_price} onChange={(e) => setForm({ ...form, shipping_base_price: Number(e.target.value) })} />
            <select className="rounded-xl border border-cyan-300/20 bg-black/40 px-3 py-2 text-sm"
              value={form.shipping_method} onChange={(e) => setForm({ ...form, shipping_method: e.target.value })}>
              <option value="shipping">Shipping</option>
              <option value="local_pickup">Local Pickup</option>
              <option value="both">Both</option>
            </select>
          </div>
          <button onClick={create} className="w-full rounded-xl border border-cyan-200/40 bg-cyan-300 py-2.5 font-black text-slate-950">Save Item</button>
        </div>
      )}
      <div className="space-y-2">
        {lots.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="min-w-0">
              <p className="truncate font-bold">{l.title}</p>
              <p className="text-xs text-slate-400">{l.lot_number} · {l.status}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void printBarcodeLabel(l.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1.5 text-[10px] font-bold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/20"
                title="Print barcode label"
              >
                <Printer className="h-3 w-3" /> Print
              </button>
              <ItemBarcodeLabel lot={l} showName={show.title} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- SCANNER
function ScannerPanel({ show, lots, onSelectLot, onStartLot, auctioneerId }: { show: ShowRow; lots: LotRow[]; onSelectLot: () => void; onStartLot?: (id: string) => void; auctioneerId: string | null }) {
  const navigate = useNavigate()
  const [manual, setManual] = useState('')
  const [last, setLast] = useState<{ code: string; ok: boolean; msg: string } | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [testScanMode, setTestScanMode] = useState(false)
  const [testScanStatus, setTestScanStatus] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const barcodeDetectorRef = useRef<any>(null)
  const [barcodeSupported, setBarcodeSupported] = useState(true)
  const lastScanTimeRef = useRef(0)
  const selection = useLotSelection({
    showId: show.id,
    onSelect: (lot) => {
      setLast({ code: lot.barcode || lot.lot_number || lot.id, ok: true, msg: `Loaded: ${lot.title}` })
      toast.success(`Loaded ${lot.title}`)
      if (onStartLot && (lot.status === 'queued' || lot.status === 'draft')) {
        onStartLot(lot.id)
      }
    },
  })

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Camera access is not supported in this browser.')
      return
    }
    try {
      setCameraReady(false)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        videoRef.current.muted = true
        await videoRef.current.play()
      }
      setCameraActive(true)
      setCameraReady(true)
    } catch (err: any) {
      console.error('[Scanner] Camera error:', err)
      toast.error(err?.message || 'Camera access denied.')
      setCameraActive(false)
      setCameraReady(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setCameraReady(false)
  }, [])

  useEffect(() => {
    if ('BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
        })
        setBarcodeSupported(true)
      } catch (err) {
        console.warn('[Scanner] BarcodeDetector init failed:', err)
        setBarcodeSupported(false)
      }
    } else {
      console.warn('[Scanner] BarcodeDetector API not available — using ZXing fallback')
      setBarcodeSupported(false)
    }
  }, [])

  useEffect(() => {
    if (!cameraActive || !cameraReady || !barcodeDetectorRef.current) return
    let animFrame: number
    const detectFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrame = requestAnimationFrame(detectFrame)
        return
      }
      try {
        const barcodes = await barcodeDetectorRef.current.detect(videoRef.current)
        if (barcodes && barcodes.length > 0) {
          const now = Date.now()
          if (now - lastScanTimeRef.current < 2000) {
            animFrame = requestAnimationFrame(detectFrame)
            return
          }
          lastScanTimeRef.current = now
          const barcode = barcodes[0]
          const code = barcode.rawValue || ''
          if (code) {
            setLast({ code, ok: true, msg: `Scanned: ${code}` })
            void selection.resolve(code)
            onSelectLot()
          }
        }
      } catch {
        // detection failed silently
      }
      animFrame = requestAnimationFrame(detectFrame)
    }
    animFrame = requestAnimationFrame(detectFrame)
    return () => cancelAnimationFrame(animFrame)
  }, [cameraActive, cameraReady, selection, onSelectLot])

  // ZXing fallback decoder when the native BarcodeDetector is unavailable
  // (e.g. iOS Safari) so the camera scanner still reads CODE_128/CODE_39/EAN/UPC.
  useZxingScanner({
    enabled: cameraActive && cameraReady && !barcodeSupported,
    videoRef,
    onDetect: (code) => {
      const now = Date.now()
      if (now - lastScanTimeRef.current < 2000) return
      lastScanTimeRef.current = now
      setLast({ code, ok: true, msg: `Scanned: ${code}` })
      void selection.resolve(code)
      onSelectLot()
    },
  })

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // HID keyboard scanner (USB/Bluetooth) — global capture, ignores focused inputs.
  const { scannedValue } = useBarcodeScanner({ onScan: (v) => { void selection.resolve(v); onSelectLot() } })

  useEffect(() => { if (scannedValue) setLast({ code: scannedValue, ok: true, msg: 'Scanned' }) }, [scannedValue])

  const submitManual = () => { if (manual.trim()) { void selection.resolve(manual); onSelectLot() } }

  // Test-scan mode: scan a barcode, resolve the matching item, and broadcast a
  // connection-confirmation alert to the auctioneer's Auction Studio so they
  // can verify the scanner is linked and the barcode is accurate.
  const emitTestScan = useCallback(
    async (code: string) => {
      if (!auctioneerId) return
      setTestScanStatus('Looking up item…')
      const _lot = await selection.resolve(code)
      const matched = selection.selected
      try {
        await supabase
          .channel(`auctioneer_test_scan:${auctioneerId}`)
          .send({
            type: 'broadcast',
            event: 'test_scan',
            payload: {
              barcode: code,
              title: matched?.title || null,
              lot_number: matched?.lot_number || null,
              found: !!matched,
              timestamp: new Date().toISOString(),
            },
          })
      } catch (err) {
        console.warn('[Scanner] test scan broadcast failed:', err)
      }
      setTestScanStatus(
        matched
          ? `Sent "${matched.title}" to Auction Studio — check the popup there.`
          : 'Barcode not matched to an item. Still sent to Auction Studio to confirm the link.',
      )
    },
    [auctioneerId, selection],
  )

  // Dedicated detection loop for test-scan mode.
  useEffect(() => {
    if (!testScanMode || !cameraActive || !cameraReady || !barcodeDetectorRef.current) return
    let animFrame: number
    const detectFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrame = requestAnimationFrame(detectFrame)
        return
      }
      try {
        const barcodes = await barcodeDetectorRef.current.detect(videoRef.current)
        if (barcodes && barcodes.length > 0) {
          const now = Date.now()
          if (now - lastScanTimeRef.current < 2000) {
            animFrame = requestAnimationFrame(detectFrame)
            return
          }
          lastScanTimeRef.current = now
          const code = barcodes[0].rawValue || ''
          if (code) {
            setTestScanStatus('Scanned — sending to Auction Studio…')
            await emitTestScan(code)
            stopCamera()
            setTestScanMode(false)
            return
          }
        }
      } catch {
        // detection failed silently
      }
      animFrame = requestAnimationFrame(detectFrame)
    }
    animFrame = requestAnimationFrame(detectFrame)
    return () => cancelAnimationFrame(animFrame)
  }, [testScanMode, cameraActive, cameraReady, emitTestScan, stopCamera])

  // ZXing fallback decoder for test-scan mode (when native BarcodeDetector is absent).
  useZxingScanner({
    enabled: testScanMode && cameraActive && cameraReady && !barcodeSupported,
    videoRef,
    onDetect: async (code) => {
      const now = Date.now()
      if (now - lastScanTimeRef.current < 2000) return
      lastScanTimeRef.current = now
      if (!code) return
      setTestScanStatus('Scanned — sending to Auction Studio…')
      await emitTestScan(code)
      stopCamera()
      setTestScanMode(false)
    },
  })

  const isDraft = show.status === 'draft'

  return (
    <div className="space-y-4">
      {/* Test Scanner Connection — opens camera, scans, confirms link in Studio */}
      <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] p-5">
        <h3 className="flex items-center gap-2 text-lg font-black"><Scan className="h-5 w-5 text-cyan-300" /> Test Barcode Scanner</h3>
        <p className="mt-1 text-xs text-slate-500">
          Open your camera and scan any item barcode. A popup appears in your Auctioneer Studio confirming the scanner is connected and the barcode matches the item.
        </p>
        <div className="mt-3">
          {!testScanMode ? (
            <button
              onClick={() => { setTestScanStatus(''); setTestScanMode(true); void startCamera() }}
              className="rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.28)]"
            >
              <Camera className="mr-1 inline h-4 w-4" /> Start Test Scan
            </button>
          ) : (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
                <video ref={videoRef} className="h-64 w-full object-cover" playsInline muted autoPlay />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-[64px] w-[80%] rounded-lg border-2 border-cyan-400/90 shadow-[0_0_24px_rgba(34,211,238,0.35)]">
                    <span className="absolute left-1 top-1 h-4 w-4 rounded-tl-md border-l-2 border-t-2 border-cyan-400" />
                    <span className="absolute right-1 top-1 h-4 w-4 rounded-tr-md border-r-2 border-t-2 border-cyan-400" />
                    <span className="absolute bottom-1 left-1 h-4 w-4 rounded-bl-md border-b-2 border-l-2 border-cyan-400" />
                    <span className="absolute bottom-1 right-1 h-4 w-4 rounded-br-md border-b-2 border-r-2 border-cyan-400" />
                    <span className="barcode-scanner-line absolute left-1 right-1 top-0 h-0.5 rounded-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
                  </div>
                </div>
              </div>
              <button onClick={() => { stopCamera(); setTestScanMode(false) }} className="rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-2.5 font-bold text-red-100">Cancel</button>
            </div>
          )}
          {testScanStatus && <p className="mt-2 text-xs font-bold text-cyan-200">{testScanStatus}</p>}
        </div>
      </div>

      {isDraft && (
        <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] p-5">
          <h3 className="flex items-center gap-2 text-lg font-black"><Camera className="h-5 w-5 text-cyan-300" /> Camera Barcode Scanner</h3>
          <p className="mt-1 text-xs text-slate-500">Use your device camera to scan item barcodes while the show is in draft mode.</p>
          <div className="mt-3">
            {!cameraActive ? (
              <button onClick={startCamera} className="rounded-xl border border-cyan-300/30 bg-cyan-500/20 px-4 py-2.5 font-bold text-cyan-100">Open Camera</button>
            ) : (
              <div className="space-y-2">
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
                  <video ref={videoRef} className="h-64 w-full object-cover" playsInline muted />
                </div>
                <button onClick={stopCamera} className="rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-2.5 font-bold text-red-100">Stop Camera</button>
              </div>
            )}
          </div>
          {last && <p className="mt-2 text-xs font-bold text-emerald-300">{last.msg}</p>}
        </div>
      )}

      <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] p-5">
        <h3 className="flex items-center gap-2 text-lg font-black"><Scan className="h-5 w-5 text-cyan-300" /> Scan / Enter Item</h3>
        <p className="mt-1 text-xs text-slate-500">USB/Bluetooth HID scanners work automatically. Or enter a barcode, lot #, SKU, or title.</p>
        <div className="mt-3 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-cyan-300/20 bg-black/35 px-4 py-2.5 text-sm"
            placeholder="Scan or type code…"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitManual()}
          />
          <button onClick={submitManual} disabled={!manual.trim()} className="rounded-xl border border-cyan-300/30 bg-cyan-500/20 px-4 py-2.5 font-bold text-cyan-100 disabled:opacity-50">Go</button>
        </div>
        {selection.error && <p className="mt-2 text-xs font-bold text-red-300">{selection.error}</p>}
        {last && <p className="mt-2 text-xs font-bold text-emerald-300">{last.msg}</p>}
      </div>

      {!isDraft && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-black"><Camera className="h-4 w-4" /> Phone Camera</div>
          <p className="text-xs text-slate-400">
            Open <span className="font-mono text-cyan-300">/auctioneer/scanner</span> on your phone, pair it, and scan. The same server logic resolves the lot.
          </p>
          <button onClick={() => navigate('/auctioneer/scanner')} className="mt-3 rounded-xl border border-cyan-300/20 bg-white/5 px-4 py-2 text-sm font-bold">Open Phone Scanner</button>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Recent queue</p>
        <div className="space-y-2">
          {lots.slice(0, 8).map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <span className="truncate text-sm">{l.title}</span>
              <span className="font-mono text-xs text-slate-400">{l.lot_number}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- ORDERS
function OrdersPanel({ orders }: { orders: any[] }) {
  return (
    <div className="space-y-2">
      {orders.length === 0 && <p className="text-center text-sm text-slate-500">No orders yet.</p>}
      {orders.map((o) => (
        <div key={o.id} className="rounded-2xl border border-cyan-300/15 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <p className="font-black">{o.order_number}</p>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase">{o.shipping_information_status || o.fulfillment_status}</span>
          </div>
          <p className="text-sm text-slate-300">{(o.auction_lots as any)?.title || 'Item'}</p>
          <p className="text-xs text-slate-500">{formatCoins(o.sale_amount)} TC · {o.winner_username ? `@${o.winner_username}` : '—'}</p>
          {o.cancellation_fee_coins ? (
            <p className="mt-1 text-xs font-bold text-red-300">Cancellation fee: {o.cancellation_fee_coins} TC ({o.cancellation_fee_status})</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- SHIPPING
function ShippingPanel({ orders, onChanged }: { orders: any[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const ship = async (o: any) => {
    setBusy(o.id)
    try {
      const carrier = (document.getElementById(`carrier-${o.id}`) as HTMLSelectElement)?.value
      const tracking = (document.getElementById(`track-${o.id}`) as HTMLInputElement)?.value
      const note = (document.getElementById(`note-${o.id}`) as HTMLInputElement)?.value
      const { error } = await supabase.rpc('mark_order_shipped', {
        p_order_id: o.id, p_carrier_code: carrier, p_tracking_number: tracking, p_note: note,
      })
      if (error) throw error
      toast.success('Order marked shipped')
      onChanged()
    } catch (e: any) { toast.error(e?.message || 'Failed') }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-3">
      {orders.filter((o) => !['cancelled_timeout', 'completed'].includes(o.shipping_information_status || '')).map((o) => (
        <div key={o.id} className="rounded-2xl border border-cyan-300/15 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <p className="font-black">{o.order_number}</p>
            <span className="text-[10px] uppercase text-slate-400">{o.shipping_information_status}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select id={`carrier-${o.id}`} defaultValue={o.carrier_code || 'usps'} className="rounded-xl border border-cyan-300/20 bg-black/40 px-3 py-2 text-sm">
              {CARRIERS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            <input id={`track-${o.id}`} defaultValue={o.tracking_number || ''} placeholder="Tracking # (not needed for pickup)"
              className="rounded-xl border border-cyan-300/20 bg-black/40 px-3 py-2 text-sm" />
          </div>
          <input id={`note-${o.id}`} placeholder="Fulfillment note (optional)" className="mt-2 w-full rounded-xl border border-cyan-300/20 bg-black/40 px-3 py-2 text-sm" />
          <button onClick={() => ship(o)} disabled={busy === o.id}
            className="mt-2 w-full rounded-xl border border-cyan-200/40 bg-cyan-300 py-2 font-black text-slate-950 disabled:opacity-50">
            <Truck className="mr-1 inline h-4 w-4" /> Mark Shipped
          </button>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- SALES
function SalesPanel({ orders, lots }: { orders: any[]; lots: LotRow[] }) {
  const gross = orders.reduce((s, o) => s + Number(o.sale_amount || 0), 0)
  const sold = lots.filter((l) => l.status === 'sold').length
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat label="Gross Sales" value={`${formatCoins(gross)} TC`} />
      <Stat label="Items Sold" value={sold} />
      <Stat label="Orders" value={orders.length} />
      <Stat label="Pending Ship" value={orders.filter((o) => ['awaiting_shipping_information', 'shipping_information_received', 'preparing_shipment', 'ready_to_ship'].includes(o.shipping_information_status)).length} />
    </div>
  )
}

// ---------------------------------------------------------------- DEVICES
function DevicesPanel({ auctioneerId }: { auctioneerId: string | null }) {
  const [sessions, setSessions] = useState<any[]>([])
  const [code, setCode] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!auctioneerId) return
    const { data } = await supabase.from('auction_device_sessions').select('*').eq('auctioneer_id', auctioneerId).order('last_seen_at', { ascending: false })
    setSessions((data as any[]) || [])
  }, [auctioneerId])
  useEffect(() => { void load() }, [load])

  const genCode = async () => {
    const c = String(Math.floor(100000 + Math.random() * 900000))
    const { error } = await supabase.from('auction_device_sessions').insert({ auctioneer_id: auctioneerId, pairing_code: c, status: 'pending' }).select().single()
    if (error) return toast.error(error.message)
    setCode(c)
    void load()
  }
  const revoke = async (id: string) => { await supabase.from('auction_device_sessions').delete().eq('id', id); void load() }

  return (
    <div className="space-y-3">
      <button onClick={genCode} className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-400/10 py-3 font-bold text-cyan-100">Generate Pairing Code</button>
      {code && <p className="rounded-xl border border-yellow-300/40 bg-yellow-400/10 p-3 text-center text-lg font-black text-yellow-200">Code: {code}</p>}
      <p className="text-xs text-slate-500">HID scanners need no pairing — they act as a keyboard. Phone pairing uses the 6-digit code in /auctioneer/scanner.</p>
      <div className="space-y-2">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div>
              <p className="text-sm font-bold">{s.device_name || 'Device'}</p>
              <p className="text-xs text-slate-500">{s.status} · {s.last_seen_at ? new Date(s.last_seen_at).toLocaleTimeString() : '—'}</p>
            </div>
            <button onClick={() => revoke(s.id)} className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200">Revoke</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- SETTINGS
function SettingsPanel({ show }: { show: ShowRow }) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
      <p className="font-black">Auction App Settings</p>
      <p className="text-slate-400">Show: <span className="text-white">{show.title}</span> ({show.status})</p>
      <p className="text-xs text-slate-500">Shipping deadline: 10 min after sale · Cancellation at 11 min · 10% fee on timeout. All enforced server-side.</p>
    </div>
  )
}

// ---------------------------------------------------------------- small UI
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-black text-white">{value}</p>
    </div>
  )
}

function Btn({ children, onClick, busy, tone, disabled }: { children: React.ReactNode; onClick: () => void; busy?: boolean; tone?: 'emerald' | 'amber' | 'red' | 'slate'; disabled?: boolean }) {
  const tones: Record<string, string> = {
    emerald: 'border-emerald-300/30 bg-emerald-500/20 text-emerald-100',
    amber: 'border-amber-300/30 bg-amber-500/15 text-amber-100',
    red: 'border-red-300/30 bg-red-500/15 text-red-100',
    slate: 'border-white/10 bg-white/5 text-slate-200',
  }
  return (
    <button onClick={onClick} disabled={busy || disabled}
      className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition disabled:opacity-50 ${tones[tone || 'slate']}`}>
      {children}
    </button>
  )
}
