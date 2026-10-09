import React, { useCallback, useState } from 'react';
import { CheckCircle2, Loader2, Package, Printer, Scan, Search, Truck } from 'lucide-react';
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner'
import { PackingSlip } from '../../components/auction/LabelPrinter';

interface ScannedLotData {
  found: boolean
  lot: {
    id: string
    lot_number: string
    title: string
    description: string | null
    image_url: string | null
    status: string
    sale_amount: number
    barcode: string
  }
  order: {
    id: string
    order_number: string
    payment_status: string
    fulfillment_status: string
    tracking_number: string | null
    shipping_carrier: string | null
    shipping_name: string | null
    shipping_line1: string | null
    shipping_city: string | null
    shipping_state: string | null
    shipping_zip: string | null
  } | null
  receipt: {
    id: string
    receipt_number: string
    order_number: string
    sale_amount: number
    shipping_cost: number
    total_amount: number
    payment_status: string
    fulfillment_status: string
    shipping_name: string | null
    shipping_line1: string | null
    shipping_city: string | null
    shipping_state: string | null
    shipping_zip: string | null
    shipping_country: string | null
    tracking_number: string | null
    shipping_carrier: string | null
    shipped_at: string | null
    delivered_at: string | null
    created_at: string
  } | null
  winner: {
    id: string
    username: string | null
    display_name: string | null
  } | null
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
const ghost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50'

function formatCoins(value: number | null | undefined) {
  return Number(value || 0).toLocaleString()
}

export default function PackingStation() {
  const { user: _user } = useAuthStore()
  const [scanInput, setScanInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scannedData, setScannedData] = useState<ScannedLotData | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('usps')

  const handleScan = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return
    setScanning(true)
    try {
      const result = await supabase.rpc('scan_lot_barcode', { p_barcode: barcode.trim() })
      const data = result.data as ScannedLotData
      if (data?.found) {
        setScannedData(data)
        setTrackingNumber('')
      } else {
        toast.error('Lot not found')
        setScannedData(null)
      }
    } catch (error: any) {
      toast.error(error?.message || 'Scan failed')
      setScannedData(null)
    } finally {
      setScanning(false)
    }
  }, [])

  // Listen for barcode scanner input
  useBarcodeScanner({
    minLength: 3,
    onScan: handleScan,
  })

  const submitScan = () => {
    if (scanInput.trim()) handleScan(scanInput.trim())
  }

  const updateStatus = async (status: string) => {
    if (!scannedData?.order) return
    setStatusLoading(true)
    try {
      const { error } = await supabase.rpc('update_order_fulfillment', {
        p_order_id: scannedData.order.id,
        p_status: status,
        p_tracking_number: trackingNumber || null,
        p_carrier: carrier || null,
      })
      if (error) throw error
      toast.success(`Order marked as ${status}`)
      // Refresh
      handleScan(scannedData.lot.barcode)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update')
    } finally {
      setStatusLoading(false)
    }
  }

  return (
    <div className={shell}>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_32%)]" />

      <main className="relative z-10 mx-auto max-w-[1200px] space-y-4">
        <header className={cn(panel, 'p-5')}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10">
              <Package className="h-6 w-6 text-cyan-200" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Packing Station</h1>
              <p className="text-sm text-slate-400">Scan a lot barcode to auto-load winner & order info.</p>
            </div>
          </div>
        </header>

        {/* Scan Input */}
        <section className={cn(panel, 'p-5')}>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
            <Scan className="h-5 w-5 text-cyan-300" />
            Scan Lot Barcode
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Use a barcode scanner or type the lot number (e.g. TC-LOT-000001)
          </p>
          <div className="flex gap-2">
            <input
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitScan() }}
              placeholder="Scan or type barcode..."
              className={cn(input, 'flex-1')}
              autoFocus
            />
            <button onClick={submitScan} disabled={scanning || !scanInput.trim()} className={cn(primary, 'shrink-0')}>
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>Scan</span>
            </button>
          </div>
        </section>

        {/* Scanned Result */}
        {scannedData?.found && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Item Info */}
            <section className={cn(panel, 'p-5')}>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.15em] text-cyan-300">Item Details</h3>
              <div className="flex gap-4">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#07101f]">
                  {scannedData.lot.image_url ? (
                    <img src={scannedData.lot.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-8 w-8 text-slate-600" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-cyan-300">{scannedData.lot.lot_number}</p>
                  <p className="text-lg font-black text-white">{scannedData.lot.title}</p>
                  <p className="mt-1 text-2xl font-black text-cyan-100">{formatCoins(scannedData.lot.sale_amount)} TC</p>
                </div>
              </div>
            </section>

            {/* Winner & Order Info */}
            <section className={cn(panel, 'p-5')}>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.15em] text-cyan-300">Winner & Order</h3>
              {scannedData.winner ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-sm font-black">
                      {scannedData.winner.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-bold text-white">@{scannedData.winner.username || scannedData.winner.display_name}</p>
                      {scannedData.order && (
                        <p className="text-xs text-slate-500">Order: {scannedData.order.order_number}</p>
                      )}
                    </div>
                  </div>

                  {scannedData.order && (
                    <div className="rounded-xl border border-cyan-300/10 bg-black/30 p-3 space-y-1 text-sm">
                      <p><span className="text-slate-500">Payment:</span> <span className="font-bold text-white">{scannedData.order.payment_status}</span></p>
                      <p><span className="text-slate-500">Fulfillment:</span> <span className="font-bold text-white">{scannedData.order.fulfillment_status}</span></p>
                      {scannedData.order.shipping_name && (
                        <p><span className="text-slate-500">Ship to:</span> <span className="font-bold text-white">{scannedData.order.shipping_name}</span></p>
                      )}
                      {scannedData.order.shipping_line1 && (
                        <p className="text-slate-400">{scannedData.order.shipping_line1}</p>
                      )}
                      {(scannedData.order.shipping_city || scannedData.order.shipping_state) && (
                        <p className="text-slate-400">
                          {[scannedData.order.shipping_city, scannedData.order.shipping_state, scannedData.order.shipping_zip].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No winner assigned</p>
              )}
            </section>

            {/* Action Buttons */}
            <section className={cn(panel, 'p-5')}>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.15em] text-cyan-300">Actions</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => window.open(`data:text/html,${encodeURIComponent('')}`, '_blank')} className={cn(ghost, 'text-sm')}>
                  <Printer className="h-4 w-4" /> Print Lot Sticker
                </button>
                <button className={cn(ghost, 'text-sm')}>
                  <Printer className="h-4 w-4" /> Print Packing Slip
                </button>
                <button className={cn(ghost, 'text-sm')}>
                  <Printer className="h-4 w-4" /> Print Shipping Label
                </button>
              </div>
            </section>

            {/* Fulfillment Controls */}
            <section className={cn(panel, 'p-5')}>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.15em] text-cyan-300">Fulfillment</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Tracking Number</label>
                  <input
                    value={trackingNumber}
                    onChange={e => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number..."
                    className={input}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Carrier</label>
                  <select value={carrier} onChange={e => setCarrier(e.target.value)} className={input}>
                    <option value="usps" className="bg-slate-950">USPS</option>
                    <option value="ups" className="bg-slate-950">UPS</option>
                    <option value="fedex" className="bg-slate-950">FedEx</option>
                    <option value="dhl" className="bg-slate-950">DHL</option>
                    <option value="other" className="bg-slate-950">Other</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => updateStatus('packed')} disabled={statusLoading} className={cn(secondary, 'text-sm')}>
                    <Package className="h-4 w-4" /> Mark Packed
                  </button>
                  <button onClick={() => updateStatus('shipped')} disabled={statusLoading} className={cn(primary, 'text-sm')}>
                    <Truck className="h-4 w-4" /> Mark Shipped
                  </button>
                  <button onClick={() => updateStatus('delivered')} disabled={statusLoading} className={cn('inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200/40 bg-emerald-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-200', '')}>
                    <CheckCircle2 className="h-4 w-4" /> Mark Delivered
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {!scannedData && !scanning && (
          <div className="py-20 text-center">
            <Scan className="mx-auto mb-4 h-16 w-16 text-slate-700" />
            <p className="text-lg font-bold text-slate-500">Scan a barcode to get started</p>
          </div>
        )}

        {/* Hidden print container */}
        <div id="label-print-container" style={{ display: 'none' }}>
          {scannedData?.found && scannedData.order && (
            <PackingSlip
              orderNumber={scannedData.order.order_number}
              lotNumber={scannedData.lot.lot_number}
              itemName={scannedData.lot.title}
              winnerName={scannedData.winner?.display_name || scannedData.winner?.username || ''}
              winnerUsername={scannedData.winner?.username || ''}
              saleAmount={scannedData.lot.sale_amount}
              shippingName={scannedData.order.shipping_name}
              shippingLine1={scannedData.order.shipping_line1}
              shippingCity={scannedData.order.shipping_city}
              shippingState={scannedData.order.shipping_state}
              shippingZip={scannedData.order.shipping_zip}
            />
          )}
        </div>
      </main>
    </div>
  )
}
