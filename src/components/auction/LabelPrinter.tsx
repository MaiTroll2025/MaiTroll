import React, { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

interface LotStickerProps {
  lotNumber: string
  itemName: string
  barcode: string
  startingBid?: number
  qrValue?: string
  compact?: boolean
}

export function LotSticker({
  lotNumber,
  itemName,
  barcode,
  startingBid,
  qrValue,
  compact = false,
}: LotStickerProps) {
  const barcodeRef = useRef<HTMLCanvasElement>(null)
  const [qrUrl, setQrUrl] = React.useState('')

  useEffect(() => {
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, barcode, {
        format: 'CODE128',
        width: compact ? 1.5 : 2,
        height: compact ? 30 : 50,
        displayValue: true,
        fontSize: compact ? 10 : 13,
        margin: 4,
      })
    }
    if (qrValue) {
      QRCode.toDataURL(qrValue, { width: compact ? 60 : 100, margin: 1 }).then(setQrUrl)
    }
  }, [barcode, qrValue, compact])

  return (
    <div
      style={{
        width: compact ? '3in' : '4in',
        height: compact ? '2in' : '3in',
        border: '2px solid #1e293b',
        borderRadius: '8px',
        padding: compact ? '6px' : '10px',
        background: '#fff',
        color: '#000',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: compact ? '2px' : '4px',
      }}
    >
      <div style={{ fontSize: compact ? '8px' : '10px', fontWeight: 900, letterSpacing: '0.15em', color: '#0e7490' }}>
        Mai Troll
      </div>
      <div
        style={{
          fontSize: compact ? '9px' : '12px',
          fontWeight: 800,
          lineHeight: 1.2,
          maxWidth: '90%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {itemName}
      </div>
      <div style={{ fontSize: compact ? '7px' : '9px', fontWeight: 700, color: '#64748b' }}>
        {lotNumber}
      </div>
      {startingBid !== undefined && (
        <div style={{ fontSize: compact ? '7px' : '9px', fontWeight: 600 }}>
          Starting Bid: {startingBid.toLocaleString()} TC
        </div>
      )}
      <canvas ref={barcodeRef} style={{ maxWidth: '90%' }} />
      {qrUrl && <img src={qrUrl} alt="QR" style={{ width: compact ? '40px' : '60px', height: compact ? '40px' : '60px' }} />}
    </div>
  )
}

interface PackingSlipProps {
  orderNumber: string
  lotNumber: string
  itemName: string
  winnerName: string
  winnerUsername: string
  saleAmount: number
  shippingName?: string
  shippingLine1?: string
  shippingLine2?: string
  shippingCity?: string
  shippingState?: string
  shippingZip?: string
}

export function PackingSlip({
  orderNumber,
  lotNumber,
  itemName,
  winnerName,
  winnerUsername,
  saleAmount,
  shippingName,
  shippingLine1,
  shippingLine2,
  shippingCity,
  shippingState,
  shippingZip,
}: PackingSlipProps) {
  return (
    <div
      style={{
        width: '8.5in',
        padding: '0.5in',
        background: '#fff',
        color: '#000',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0e7490', paddingBottom: '12px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '0.1em', color: '#0e7490' }}>
            Mai Troll
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>AUCTION PACKING SLIP</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: 800 }}>Order: {orderNumber}</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Lot: {lotNumber}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            Ship To
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>{shippingName || winnerName || winnerUsername}</div>
          {shippingLine1 && <div style={{ fontSize: '12px' }}>{shippingLine1}</div>}
          {shippingLine2 && <div style={{ fontSize: '12px' }}>{shippingLine2}</div>}
          {(shippingCity || shippingState || shippingZip) && (
            <div style={{ fontSize: '12px' }}>
              {[shippingCity, shippingState, shippingZip].filter(Boolean).join(', ')}
            </div>
          )}
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>@{winnerUsername}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            Item Details
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>{itemName}</div>
          <div style={{ fontSize: '11px', marginTop: '4px' }}>Sale Amount: <strong>{saleAmount.toLocaleString()} TC</strong></div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', fontSize: '9px', color: '#94a3b8', textAlign: 'center' }}>
        Thank you for bidding on Mai Troll! Questions? Contact the auctioneer through the platform.
      </div>
    </div>
  )
}

interface ShippingLabelProps {
  orderNumber: string
  lotNumber: string
  shippingName: string
  shippingLine1: string
  shippingLine2?: string
  shippingCity: string
  shippingState: string
  shippingZip: string
  shippingCountry?: string
  trackingNumber?: string
  carrier?: string
  barcode: string
}

export function ShippingLabel({
  orderNumber,
  lotNumber,
  shippingName,
  shippingLine1,
  shippingLine2,
  shippingCity,
  shippingState,
  shippingZip,
  shippingCountry = 'US',
  trackingNumber,
  carrier,
  barcode,
}: ShippingLabelProps) {
  const barcodeRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (barcodeRef.current && trackingNumber) {
      JsBarcode(barcodeRef.current, trackingNumber, {
        format: 'CODE128',
        width: 2,
        height: 40,
        displayValue: true,
        fontSize: 11,
        margin: 5,
      })
    }
  }, [trackingNumber])

  return (
    <div
      style={{
        width: '4in',
        height: '6in',
        border: '1px solid #000',
        padding: '10px',
        background: '#fff',
        color: '#000',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ fontSize: '8px', fontWeight: 900, letterSpacing: '0.15em', color: '#0e7490', marginBottom: '4px' }}>
        Mai Troll AUCTIONS
      </div>
      <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '8px' }}>
        Order: {orderNumber} | Lot: {lotNumber}
      </div>

      {carrier && <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '2px' }}>{carrier}</div>}
      {trackingNumber && (
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '9px', fontWeight: 600, marginBottom: '2px' }}>Tracking: {trackingNumber}</div>
          <canvas ref={barcodeRef} />
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: '2px dashed #ccc', paddingTop: '8px' }}>
        <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
          Ship To
        </div>
        <div style={{ fontSize: '14px', fontWeight: 700 }}>{shippingName}</div>
        <div style={{ fontSize: '13px', marginTop: '2px' }}>{shippingLine1}</div>
        {shippingLine2 && <div style={{ fontSize: '13px' }}>{shippingLine2}</div>}
        <div style={{ fontSize: '13px' }}>{shippingCity}, {shippingState} {shippingZip}</div>
        <div style={{ fontSize: '12px' }}>{shippingCountry}</div>
      </div>
    </div>
  )
}

export function printElement(elementId: string) {
  const element = document.getElementById(elementId)
  if (!element) return

  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) return

  printWindow.document.write(`
    <html>
      <head>
        <title>Print Label</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            @page { margin: 0; size: auto; }
          }
          body { display: flex; justify-content: center; align-items: flex-start; padding: 10px; }
        </style>
      </head>
      <body>
        ${element.innerHTML}
      </body>
    </html>
  `)
  printWindow.document.close()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}
