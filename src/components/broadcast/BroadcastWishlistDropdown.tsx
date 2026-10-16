// src/components/broadcast/BroadcastWishlistDropdown.tsx
// Clickable wishlist dropdown shown inside the per-broadcast ticker.
// Renders the broadcaster's validated HTTPS URL as a button that opens
// the URL in a new tab. Double-tap / double-click on the ticker opens
// the edit flow (handled by the parent BroadcastTicker component).

import React, { useState } from 'react'
import { ExternalLink, Link2, Pencil, Copy, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { copyToClipboard } from '../../lib/broadcastClipboard'

interface BroadcastWishlistDropdownProps {
  wishlistUrl: string | null
  isBroadcaster?: boolean
  onEdit?: () => void
  className?: string
}

export function BroadcastWishlistDropdown({
  wishlistUrl,
  isBroadcaster = false,
  onEdit,
  className = '',
}: BroadcastWishlistDropdownProps) {
  const [copied, setCopied] = useState(false)

  if (!wishlistUrl) {
    if (!isBroadcaster || !onEdit) return null

    return (
      <div className={cn('flex items-center gap-2 px-3 py-1.5 text-[11px]', className)}>
        <span className="text-white/40">No wishlist link set</span>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 transition"
        >
          <Pencil size={10} />
          Set URL
        </button>
      </div>
    )
  }

  const handleCopy = async () => {
    const ok = await copyToClipboard(wishlistUrl)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  const handleOpen = () => {
    // Open in a new tab with security attributes.
    window.open(wishlistUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 text-[11px]', className)}>
      <Link2 size={11} className="text-amber-300 shrink-0" />
      <button
        type="button"
        onClick={handleOpen}
        className="max-w-[220px] truncate text-amber-100 hover:text-amber-50 underline-offset-2 hover:underline transition"
        title={wishlistUrl}
      >
        {wishlistUrl}
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 rounded-md hover:bg-white/10 transition"
        title="Copy link"
      >
        {copied ? <Check size={11} className="text-green-300" /> : <Copy size={11} className="text-white/50" />}
      </button>
      {isBroadcaster && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="p-1 rounded-md hover:bg-white/10 transition"
          title="Edit URL"
        >
          <Pencil size={11} className="text-white/50" />
        </button>
      )}
      <ExternalLink size={10} className="text-white/30 shrink-0" />
    </div>
  )
}

export default BroadcastWishlistDropdown