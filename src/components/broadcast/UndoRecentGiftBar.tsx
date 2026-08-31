import React, { useCallback, useState } from 'react'
import { useGiftSystem } from '@/lib/hooks/useGiftSystem'
import { toast } from 'sonner'
import { Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function UndoRecentGiftBar() {
  const { undoRecentGift, lastSentGiftId } = useGiftSystem()
  const [isUndoing, setIsUndoing] = useState(false)

  const handleUndo = useCallback(async () => {
    if (!lastSentGiftId || isUndoing) return
    setIsUndoing(true)
    try {
      const result = await undoRecentGift(lastSentGiftId)
      if (result.success) {
        toast.success('Gift undone. Coins and XP restored.')
      } else {
        toast.error(result.message || 'Unable to undo gift')
      }
    } finally {
      setIsUndoing(false)
    }
  }, [lastSentGiftId, undoRecentGift, isUndoing])

  if (!lastSentGiftId) return null

  return (
    <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2">
      <button
        onClick={handleUndo}
        disabled={isUndoing}
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-lg transition',
          'border border-white/10 bg-black/80 text-slate-200 backdrop-blur-md',
          'hover:bg-white/10 hover:text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <Undo2 className="h-4 w-4" />
        {isUndoing ? 'Undoing...' : 'Undo Recent Gift'}
      </button>
    </div>
  )
}
