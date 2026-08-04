import React, { useState } from 'react'
import { Barcode as BarcodeIcon, Printer, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { generateBarcodeDataURL } from '../../lib/barcode'
import { maskBidderId } from '../../lib/auctionFees'

export interface ItemBarcodeLabelProps {
  lot: {
    id: string
    barcode?: string | null
    lot_number?: string | null
    title?: string | null
    sku?: string | null
    item_number?: string | null
    image_url?: string | null
    image_urls?: string[] | null
    created_at?: string
    shipping_base_price?: number | null
    shipping_method?: string | null
  }
  showName?: string
  auctioneerUsername?: string
  /** Optional sold/order data for the post-sale packing label. */
  sale?: {
    order_number?: string
    winner_username?: string | null
    winner_user_id?: string | null
    winning_bid?: number
    shipping_fee?: number
    carrier_code?: string | null
    carrier_name?: string | null
    tracking_number?: string | null
    batch_id?: string | null
    sold_at?: string
    local_pickup?: boolean
  } | null
}

function BarcodeImage({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  React.useEffect(() => {
    try {
      setSrc(generateBarcodeDataURL(value))
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [value])
  if (failed) return <div className="font-mono text-xs text-red-400">barcode render failed</div>
  if (!src) return <div className="h-12 w-40 animate-pulse rounded bg-white/20" />
  return <img src={src} alt={value} className="mx-auto max-w-full" />
}

function GoldBadge({ lot, onOpen }: { lot: ItemBarcodeLabelProps['lot']; onOpen: () => void }) {
  const generated = !!lot.barcode && !!lot.lot_number
  if (!generated) {
    return (
      <button
        onClick={onOpen}
        title="Barcode missing — tap to retry"
        className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-200"
      >
        <AlertTriangle className="h-3 w-3" /> No Barcode
      </button>
    )
  }
  return (
    <button
      onClick={onOpen}
      title="Barcode Generated — tap to preview & print"
      className="inline-flex items-center gap-1 rounded-full border border-yellow-300/50 bg-gradient-to-br from-yellow-300 to-amber-400 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-black shadow-[0_0_14px_rgba(250,204,21,0.35)]"
    >
      <BarcodeIcon className="h-3 w-3" /> Barcode
    </button>
  )
}

function LabelBody({ lot, showName, auctioneerUsername, sale }: ItemBarcodeLabelProps) {
  const thumb = lot.image_url || lot.image_urls?.[0] || null
  const total = sale ? (sale.winning_bid || 0) + (sale.shipping_fee || 0) : null
  return (
    <div className="auction-label-print mx-auto w-full max-w-[360px] rounded-xl border border-black/20 bg-white p-4 text-black">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded bg-gradient-to-br from-yellow-300 to-amber-500 text-black">
            <BarcodeIcon className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600">Mai Troll Auction</span>
        </div>
        {sale && (
          <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">SOLD</span>
        )}
      </div>

      {thumb && <img src={thumb} alt="" className="mx-auto my-2 h-24 w-24 rounded object-cover" />}

      <div className="text-center">
        <BarcodeImage value={lot.barcode || lot.lot_number || lot.id} />
        <p className="mt-1 font-mono text-sm font-bold">{lot.barcode || lot.lot_number}</p>
      </div>

      <div className="mt-2 space-y-0.5 text-[12px]">
        <p className="font-black">{lot.title}</p>
        <p><span className="font-bold">Lot:</span> {lot.lot_number}</p>
        {lot.sku && <p><span className="font-bold">SKU:</span> {lot.sku}</p>}
        {lot.item_number && <p><span className="font-bold">Item #:</span> {lot.item_number}</p>}
        {showName && <p><span className="font-bold">Show:</span> {showName}</p>}
        {auctioneerUsername && <p><span className="font-bold">Auctioneer:</span> @{auctioneerUsername}</p>}
        {lot.created_at && <p><span className="font-bold">Added:</span> {new Date(lot.created_at).toLocaleDateString()}</p>}

        {sale && (
          <div className="mt-2 border-t border-black/20 pt-2">
            <p><span className="font-bold">Order:</span> {sale.order_number}</p>
            {sale.winner_username && <p><span className="font-bold">Winner:</span> @{sale.winner_username}</p>}
            <p><span className="font-bold">Bidder:</span> …{maskBidderId(sale.winner_user_id)}</p>
            <p><span className="font-bold">Winning Bid:</span> {sale.winning_bid?.toLocaleString()} TC</p>
            <p><span className="font-bold">Shipping Fee:</span> {sale.shipping_fee?.toLocaleString()} TC</p>
            <p><span className="font-bold">Total Paid:</span> {total?.toLocaleString()} TC</p>
            {sale.local_pickup
              ? <p className="font-bold text-green-700">Local Pickup</p>
              : <>
                  <p><span className="font-bold">Carrier:</span> {sale.carrier_name || sale.carrier_code || '—'}</p>
                  {sale.tracking_number && <p><span className="font-bold">Tracking:</span> {sale.tracking_number}</p>}
                </>}
            {sale.batch_id && <p><span className="font-bold">Batch:</span> {sale.batch_id}</p>}
            {sale.sold_at && <p><span className="font-bold">Sold:</span> {new Date(sale.sold_at).toLocaleString()}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ItemBarcodeLabel(props: ItemBarcodeLabelProps) {
  const [open, setOpen] = useState(false)
  const generated = !!props.lot.barcode && !!props.lot.lot_number

  const doPrint = () => {
    try {
      window.print()
    } catch {
      toast.error('Print blocked by browser. Use the manual Print button.')
    }
  }

  return (
    <>
      <GoldBadge lot={props.lot} onOpen={() => setOpen(true)} />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-[400px] overflow-y-auto rounded-2xl border border-cyan-300/20 bg-[#0b1628] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {generated ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-yellow-300/50 bg-gradient-to-br from-yellow-300 to-amber-400 px-2 py-1 text-[10px] font-black uppercase text-black">
                    <CheckCircle2 className="h-3 w-3" /> Barcode Generated
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase text-red-200">
                    <AlertTriangle className="h-3 w-3" /> Not Generated
                  </span>
                )}
                <h3 className="text-sm font-black text-white">Label Preview</h3>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <LabelBody {...props} />

            <div className="mt-4 flex gap-2">
              <button
                onClick={doPrint}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                onClick={doPrint}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200"
              >
                Reprint
              </button>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Printing does not change item or order state. The barcode encodes only a stable item id.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
