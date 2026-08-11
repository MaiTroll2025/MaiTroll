import React, { useEffect, useMemo, useState } from 'react'
import { useCoins } from '@/lib/hooks/useCoins'
import { toast } from 'sonner'
import { X, AlertTriangle, Coins, Trophy } from 'lucide-react'
import { STORE_USD_PER_COIN } from '@/lib/coinMath'
import { TIERS } from '@/config/coinConfig'

interface CashoutDepositModalProps {
  isOpen: boolean
  onClose: () => void
  autoTierPrompt?: boolean
}

const CASHOUT_TIERS = TIERS.map((tier) => ({
  coins: tier.coins,
  label: `$${tier.usd} Cashout Tier`,
}))

export default function CashoutDepositModal({
  isOpen,
  onClose,
  autoTierPrompt = false,
}: CashoutDepositModalProps) {
  const {
    depositToCashout,
    loading,
    totalEarned,
    cashout_reserved_coins,
    cashout_coins,
  } = useCoins()

  const [amount, setAmount] = useState('')

  const earnedCoins = Number(totalEarned || 0)
  const reservedCoins = Number(cashout_reserved_coins || cashout_coins || 0)
  const availableEarnedCoins = Math.max(0, earnedCoins - reservedCoins)

  const unlockedTier = useMemo(() => {
    return [...CASHOUT_TIERS]
      .reverse()
      .find((tier) => availableEarnedCoins >= tier.coins)
  }, [availableEarnedCoins])

  const nextTier = useMemo(() => {
    return CASHOUT_TIERS.find((tier) => availableEarnedCoins < tier.coins)
  }, [availableEarnedCoins])

  const maxCashoutValue = availableEarnedCoins * STORE_USD_PER_COIN

  const handleAmountChange = (value: string) => {
    const numValue = parseInt(value, 10)

    if (!value) {
      setAmount('')
      return
    }

    if (Number.isNaN(numValue) || numValue < 0) return

    if (numValue > availableEarnedCoins) {
      toast.error(`Maximum earned coins available: ${availableEarnedCoins.toLocaleString()}`)
      setAmount(String(availableEarnedCoins))
      return
    }

    setAmount(value)
  }

  const setTierAmount = (coins: number) => {
    if (coins > availableEarnedCoins) {
      toast.error('You do not have enough earned coins for this tier yet.')
      return
    }

    setAmount(String(coins))
  }

  const handleDeposit = async () => {
    const numAmount = parseInt(amount, 10)

    if (Number.isNaN(numAmount) || numAmount <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    if (numAmount > availableEarnedCoins) {
      toast.error(`You only have ${availableEarnedCoins.toLocaleString()} earned coins available.`)
      return
    }

    if (numAmount < 2000) {
      toast.error('Minimum 2,000 earned coins required for cashout.')
      return
    }

    const result = await depositToCashout(numAmount)

    if (result.success) {
      toast.success(`${numAmount.toLocaleString()} earned coins added to cashout.`)
      setAmount('')
      onClose()
    } else {
      toast.error(result.error || 'Failed to deposit earned coins.')
    }
  }

  useEffect(() => {
    if (!isOpen) setAmount('')
  }, [isOpen])

  useEffect(() => {
    if (isOpen && autoTierPrompt && unlockedTier) {
      setAmount(String(unlockedTier.coins))
    }
  }, [isOpen, autoTierPrompt, unlockedTier])

  if (!isOpen) return null

return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl"
        onClick={onClose}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(147,51,234,0.16),rgba(2,6,23,0.98))]" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-green-400/25 bg-zinc-950 p-6 shadow-[0_0_40px_rgba(34,197,94,0.18)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/15 text-green-300">
            {autoTierPrompt && unlockedTier ? <Trophy /> : <Coins />}
          </div>

          <div>
            <h2 className="text-xl font-black text-white">
              {autoTierPrompt && unlockedTier ? 'New Cashout Tier Unlocked' : 'Add Earned Coins to Cashout'}
            </h2>
            <p className="text-xs text-zinc-400">
              Only coins earned from gifts and creator activity can be cashed out. Add enough coins so your chosen payout tier meets the cashout minimum.
            </p>
          </div>
        </div>

        {autoTierPrompt && unlockedTier && (
          <div className="mb-4 rounded-xl border border-yellow-400/25 bg-yellow-500/10 p-4">
            <p className="text-sm font-bold text-yellow-200">
              You earned enough for {unlockedTier.label}.
            </p>
            <p className="mt-1 text-xs text-yellow-100/70">
              Add {unlockedTier.coins.toLocaleString()} earned coins to your cashout balance for your next payout?
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Earned Coins Available</span>
              <span className="font-mono font-bold text-green-300">
                {availableEarnedCoins.toLocaleString()}
              </span>
            </div>

            <div className="mt-2 flex justify-between text-sm">
              <span className="text-zinc-400">Already Reserved</span>
              <span className="font-mono text-yellow-300">
                {reservedCoins.toLocaleString()}
              </span>
            </div>

            <div className="mt-2 flex justify-between text-sm">
              <span className="text-zinc-400">Max Estimated Value</span>
              <span className="font-mono font-bold text-emerald-300">
                ${maxCashoutValue.toFixed(2)}
              </span>
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              Purchased coins cannot be deposited to cashout. Cashouts have no platform fees.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {CASHOUT_TIERS.map((tier) => (
              <button
                key={tier.coins}
                type="button"
                onClick={() => setTierAmount(tier.coins)}
                disabled={tier.coins > availableEarnedCoins}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-bold text-white hover:border-green-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tier.coins.toLocaleString()} coins
                <div className="text-[10px] text-zinc-400">{tier.label}</div>
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">
              Amount of Earned Coins to Add
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="Minimum 2,000"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-green-400"
              max={availableEarnedCoins}
            />
          </div>

          {availableEarnedCoins < 2000 && (
            <div className="flex items-start gap-2 text-sm text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                You need at least 2,000 earned coins to start a cashout. Keep earning gifts.
              </span>
            </div>
          )}

          {nextTier && availableEarnedCoins >= 2000 && (
            <p className="text-center text-xs text-zinc-500">
              Next tier: {nextTier.coins.toLocaleString()} earned coins.
            </p>
          )}

          <button
            onClick={handleDeposit}
            disabled={loading || !amount || availableEarnedCoins < 2000}
            className="w-full rounded-xl bg-green-600 py-3 font-black text-white hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {loading ? 'Adding...' : 'Add to Cashout Coins'}
          </button>
        </div>
      </div>
    </div>
  )
}