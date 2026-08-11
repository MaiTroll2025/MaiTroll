import { useState, useRef } from 'react'
import { X, Coins, ShoppingCart, Plus, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { COIN_PACKAGES, COINS_PER_USD } from '@/config/coinConfig'
import PayPalPaymentModal from '@/components/broadcast/PayPalPaymentModal'

interface CoinStoreProps {
  open: boolean
  onClose: () => void
}

export function SingOffCoinStore({ open, onClose }: CoinStoreProps) {
  const { user, profile } = useAuthStore()
  const [selectedPack, setSelectedPack] = useState<any>(null)
  const [showPay, setShowPay] = useState(false)
  const [showCard, setShowCard] = useState(false)
  const [customCoins, setCustomCoins] = useState('')
  const payProgressRef = useRef(false)

  if (!open) return null

  const packages = COIN_PACKAGES.map((pkg) => ({
    id: pkg.id,
    coins: pkg.coins,
    price: `$${pkg.usdPrice.toFixed(2)}`,
    popular: pkg.id === 'pkg-1000',
  }))

  const handleSelect = (pkg: (typeof packages)[number]) => {
    if (!user?.id) {
      toast.error('Sign in to use the coin store.')
      return
    }
    setSelectedPack({ ...pkg, purchaseType: 'coins', metadata: { source: 'mai_singoff' } })
    payProgressRef.current = true
    setShowPay(true)
  }

  const handleCustom = () => {
    if (!user?.id) {
      toast.error('Sign in to use the coin store.')
      return
    }
    const amount = parseFloat(customCoins)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    const coins = Math.round(amount * (COINS_PER_USD || 100))
    setSelectedPack({
      id: 'mai-singoff-custom',
      coins,
      price: `$${amount.toFixed(2)}`,
      name: `${coins.toLocaleString()} Coins`,
      purchaseType: 'coins',
      metadata: { source: 'mai_singoff' },
    })
    payProgressRef.current = true
    setShowPay(true)
  }

  const onSuccess = () => {
    payProgressRef.current = false
    setShowPay(false)
    setShowCard(false)
    setSelectedPack(null)
    toast.success('Coins added to your account!')
  }

  const safeClose = () => {
    if (payProgressRef.current) {
      toast.info('Please wait for the payment to complete.')
      return
    }
    setShowPay(false)
    setShowCard(false)
    setSelectedPack(null)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
        <div className="relative w-full max-w-lg rounded-xl bg-zinc-900 border border-zinc-800 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-400" /> Mai Sing Off Coins
            </h2>
            <button onClick={safeClose} className="p-1 hover:bg-zinc-800 rounded" disabled={payProgressRef.current}>
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 max-h-[52vh] overflow-y-auto">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handleSelect(pkg)}
                className="flex flex-col items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 p-3 hover:border-yellow-500 text-center"
              >
                <span className="font-bold text-white">{pkg.coins.toLocaleString()} 🪙</span>
                <span className="text-sm text-zinc-300">{pkg.price}</span>
                {pkg.popular && <span className="text-[10px] font-bold text-yellow-400">BEST VALUE</span>}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-md border border-zinc-700 bg-zinc-800/50 p-3">
            <div className="text-xs text-zinc-400 mb-1">Custom amount</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCustomCoins(String(Math.max(1, parseInt(customCoins || '1') - 1)))} className="rounded bg-zinc-700 px-2 py-1 text-xs">
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="number"
                min={1}
                step={5}
                value={customCoins}
                onChange={(e) => setCustomCoins(e.target.value)}
                placeholder="e.g. 25"
                className="w-24 rounded-md bg-zinc-900 px-2 py-1 text-center text-white focus:outline-none focus:ring-1 focus:ring-yellow-500"
              />
              <span className="text-xs text-zinc-400">USD</span>
              <button onClick={() => setCustomCoins(String(parseInt(customCoins || '1') + 1))} className="rounded bg-zinc-700 px-2 py-1 text-xs">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <button
              onClick={handleCustom}
              className="mt-2 w-full rounded-md bg-gradient-to-r from-yellow-400 to-amber-500 py-1.5 text-xs font-bold text-black hover:brightness-110"
              disabled={!customCoins}
            >
              <ShoppingCart className="w-3 h-3 inline mr-1" /> Buy {customCoins ? `${Math.round(parseFloat(customCoins || '0') * (COINS_PER_USD || 100))} coins` : ''}
            </button>
          </div>

          <div className="mt-3 text-center text-[10px] text-zinc-500">
            1 USD = {COINS_PER_USD ?? 100} 🪙 • Secure PayPal / card payments
          </div>
        </div>
      </div>

<PayPalPaymentModal
        isOpen={showPay}
        onClose={() => {
          payProgressRef.current = false
          setShowPay(false)
          setShowCard(false)
          setSelectedPack(null)
        }}
        pkg={selectedPack}
        userId={user?.id || ''}
        profile={profile}
        onPaymentSuccess={onSuccess}
      />
    </>
  )
}
