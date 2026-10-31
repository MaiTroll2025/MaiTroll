import { useNavigate } from 'react-router-dom'
import { closePurchaseGate, usePurchaseGateStore } from '../lib/purchaseGate'

export default function PurchaseRequiredModal() {
  const { isOpen, reason } = usePurchaseGateStore()
  const navigate = useNavigate()

  if (!isOpen) return null

  const handleBuy = () => {
    closePurchaseGate()
    navigate('/store')
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/85 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-br from-purple-900/90 to-[#0e0b1a] p-6 text-left shadow-2xl">
        <h3 className="text-xl font-semibold text-white">Buy coins to unlock features</h3>
        <p className="mt-2 text-sm text-white/80">
          Buy coins to unlock chat, seats, court actions, and payouts.
        </p>
        {reason && (
          <p className="mt-2 text-xs text-white/60">
            {reason}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleBuy}
            className="w-full rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-pink-500/40"
          >
            Explore coin bundles
          </button>
          <button
            type="button"
            onClick={closePurchaseGate}
            className="w-full rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white/80 hover:text-white"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
