import { Gift, X } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useSingOffStore } from '../store/useSingOffStore'
import { useSingOffActions } from '../hooks/useSingOffActions'
import { useShallow } from 'zustand/react/shallow'

interface GiftPanelProps {
  open: boolean
  recipientUserId: string | null
  recipientName: string
  onClose: () => void
}

export function GiftPanel({ open, recipientUserId, recipientName, onClose }: GiftPanelProps) {
  const { user } = useAuthStore()
  const actions = useSingOffActions()
  const giftCatalog = actions.giftCatalog
  const balance = useSingOffStore(useShallow((s) => s.participants.find((p) => p.user_id === user?.id)?.troll_coins ?? 0))

  if (!open) return null

  const affordable = giftCatalog.filter((g) => g.cost <= balance)

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70" onClick={onClose}>
      <div
        className="relative h-[40vh] w-full max-w-3xl rounded-t-2xl border-t-2 border-pink-500 bg-zinc-900 p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-white">
            Send a gift to <span className="text-pink-400">{recipientName}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-2 overflow-y-auto pr-1 max-h-[28vh]">
          {affordable.map((gift) => (
            <button
              key={gift.id}
              onClick={() => {
                if (!recipientUserId) return
                actions.sendGift(recipientUserId, gift, 1)
              }}
              className="flex flex-col items-center gap-1 rounded-md bg-zinc-800 p-2 text-center text-xs hover:bg-zinc-700"
              title={gift.name}
            >
              <span className="text-xl">{gift.icon}</span>
              <span className="font-medium text-white">{gift.name}</span>
              <span className="text-pink-300">{gift.cost} 🪙</span>
            </button>
          ))}
          {affordable.length === 0 && (
            <div className="col-span-5 text-center text-sm text-zinc-400 py-4">
              <Gift className="w-6 h-6 mx-auto mb-1" /> Not enough coins. Tap the Coins button first.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
