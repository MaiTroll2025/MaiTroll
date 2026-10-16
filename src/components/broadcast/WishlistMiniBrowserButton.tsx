// src/components/broadcast/WishlistMiniBrowserButton.tsx
// Floating button that opens the broadcaster's wishlist in the MiniPopupBrowser.
// Renders a gift/wishlist icon button that viewers can click to open the
// mini browser without leaving the broadcast.

import React, { useState } from 'react'
import { Gift } from 'lucide-react'
import { cn } from '../../lib/utils'
import MiniPopupBrowser from './MiniPopupBrowser'

interface WishlistMiniBrowserButtonProps {
  wishlistUrl: string | null
  broadcasterDisplayName?: string
  className?: string
  /**
   * When true, the button is only visible to the broadcaster (for editing).
   */
  isBroadcaster?: boolean
  onEdit?: () => void
}

export function WishlistMiniBrowserButton({
  wishlistUrl,
  broadcasterDisplayName = 'Broadcaster',
  className = '',
  isBroadcaster = false,
  onEdit,
}: WishlistMiniBrowserButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!wishlistUrl) {
    if (!isBroadcaster || !onEdit) return null
    return (
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition',
          'bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 border border-amber-400/20',
          className
        )}
      >
        <Gift size={12} />
        Set Wishlist
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition',
          'bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 border border-amber-400/20',
          className
        )}
        title={`Open ${broadcasterDisplayName}'s wishlist`}
      >
        <Gift size={12} />
        Wishlist
      </button>

      <MiniPopupBrowser
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        url={wishlistUrl}
        title={`${broadcasterDisplayName}'s Wishlist`}
      />
    </>
  )
}

export default WishlistMiniBrowserButton