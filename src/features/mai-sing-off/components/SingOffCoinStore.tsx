import { useRef, useState } from 'react'
import { Coins, ShoppingCart, X } from 'lucide-react'
import { toast } from 'sonner'
import { COINS_PER_USD } from '@/config/coinConfig'
import { useAuthStore } from '@/lib/store'
import PayPalPaymentModal from '@/components/broadcast/PayPalPaymentModal'

interface CoinStoreProps {
  open: boolean
  onClose: () => void
}

const MIN_PURCHASE_USD = 2

export function SingOffCoinStore({ open, onClose }: CoinStoreProps) {
  const { user, profile } = useAuthStore()
  const [selectedPack, setSelectedPack] = useState<Record<string, unknown> | null>(null)
  const [showPay, setShowPay] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const payProgressRef = useRef(false)

  if (!open) return null

  const handleSubmit = () => {
    if (!user?.id) {
      toast.error('Sign in to purchase coins.')
      return
    }

    const parsedAmount = Number(customAmount)
    if (!Number.isFinite(parsedAmount) || parsedAmount < MIN_PURCHASE_USD) {
      toast.error('The minimum coin purchase is $2.00.')
      return
    }

    const amountUsd = Math.round(parsedAmount * 100) / 100
    const coins = Math.round(amountUsd * COINS_PER_USD)
    setSelectedPack({
      id: 'mai-singoff-custom',
      coins,
      price: `$${amountUsd.toFixed(2)}`,
      name: `${coins.toLocaleString()} Mai Talent Show Coins`,
      purchaseType: 'coins',
      metadata: { source: 'mai_singoff' },
    })
    payProgressRef.current = true
    setShowPay(true)
  }

  const resetPayment = () => {
    payProgressRef.current = false
    setShowPay(false)
    setSelectedPack(null)
  }

  const onSuccess = () => {
    resetPayment()
    setCustomAmount('')
    toast.success('Coins added to your account!')
  }

  const safeClose = () => {
    if (payProgressRef.current) {
      toast.info('Please wait for the payment to complete.')
      return
    }
    resetPayment()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="singoff-coin-store-title"
          className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5"
        >
          <div className="flex items-center justify-between">
            <h2 id="singoff-coin-store-title" className="flex items-center gap-2 text-xl font-bold text-white">
              <Coins className="h-5 w-5 text-yellow-400" />
              Mai Talent Show Coins
            </h2>
            <button
              type="button"
              onClick={safeClose}
              className="rounded p-1 hover:bg-zinc-800"
              aria-label="Close coin purchase"
              disabled={payProgressRef.current}
            >
              <X className="h-5 w-5 text-zinc-400" />
            </button>
          </div>

          <form
            className="mt-5 rounded-md border border-zinc-700 bg-zinc-800/50 p-4"
            onSubmit={(event) => {
              event.preventDefault()
              handleSubmit()
            }}
          >
            <label htmlFor="singoff-custom-coin-amount" className="mb-2 block text-sm font-semibold text-white">
              Enter purchase amount (USD)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-zinc-300">$</span>
              <input
                id="singoff-custom-coin-amount"
                type="number"
                min={MIN_PURCHASE_USD}
                step="0.01"
                inputMode="decimal"
                required
                value={customAmount}
                onChange={(event) => setCustomAmount(event.target.value)}
                placeholder="2.00 minimum"
                className="min-w-0 flex-1 rounded-md bg-zinc-900 px-3 py-2 text-white outline-none focus:ring-1 focus:ring-yellow-500"
              />
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Minimum $2.00. 1 USD = {COINS_PER_USD.toLocaleString()} coins.
            </p>
            <button
              type="submit"
              disabled={!customAmount || Number(customAmount) < MIN_PURCHASE_USD}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-yellow-400 to-amber-500 py-2.5 text-sm font-bold text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart className="h-4 w-4" />
              Submit and continue to PayPal
            </button>
          </form>

          <p className="mt-3 text-center text-[10px] text-zinc-500">
            Secure PayPal checkout
          </p>
        </section>
      </div>

      <PayPalPaymentModal
        isOpen={showPay}
        onClose={resetPayment}
        pkg={selectedPack}
        userId={user?.id || ''}
        profile={profile}
        onPaymentSuccess={onSuccess}
      />
    </>
  )
}
