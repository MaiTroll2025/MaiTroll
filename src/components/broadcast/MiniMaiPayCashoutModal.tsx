import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  X,
  DollarSign,
  Coins,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle,
  Building,
  Wallet,
  User,
  CreditCard,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { CASHOUT_TIERS, type CashoutTier } from '@/config/coinConfig'
import type { PayoutMethod } from '@/types/cashout'

interface MiniMaiPayCashoutModalProps {
  isOpen: boolean
  onClose: () => void
  currentBalance: number
  onSuccess?: () => void
  isMobile?: boolean
}

interface PayoutProvider {
  value: PayoutMethod
  label: string
  icon: React.ReactNode
  placeholder: string
}

const PAYOUT_PROVIDERS: PayoutProvider[] = [
  { value: 'cash_app', label: 'Cash App', icon: <Building className="w-4 h-4" />, placeholder: '$Cashtag' },
  { value: 'paypal', label: 'PayPal', icon: <Wallet className="w-4 h-4" />, placeholder: 'email@example.com' },
  { value: 'venmo', label: 'Venmo', icon: <User className="w-4 h-4" />, placeholder: '@username' },
]

export default function MiniMaiPayCashoutModal({
  isOpen,
  onClose,
  currentBalance,
  onSuccess,
  isMobile = false,
}: MiniMaiPayCashoutModalProps) {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)

  const [selectedTier, setSelectedTier] = useState<CashoutTier | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<PayoutMethod>('paypal')
  const [providerUsername, setProviderUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showTierSelector, setShowTierSelector] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setSelectedTier(null)
      setSelectedProvider('paypal')
      setProviderUsername('')
      setSubmitting(false)
      setError(null)
      setSuccess(false)
      setShowConfirm(false)
      setShowTierSelector(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && profile) {
      if (profile.paypal_email && !providerUsername) setProviderUsername(profile.paypal_email)
      else if (profile.cashapp_handle && !providerUsername) setProviderUsername(profile.cashapp_handle)
      else if (profile.venmo_handle && !providerUsername) setProviderUsername(profile.venmo_handle)
      if (profile.preferred_payout_method && selectedProvider === 'paypal') {
        setSelectedProvider(profile.preferred_payout_method as PayoutMethod)
      }
    }
  }, [isOpen, profile, providerUsername, selectedProvider])

  const eligibleTiers = useMemo(
    () => CASHOUT_TIERS.filter((tier) => currentBalance >= tier.coins),
    [currentBalance],
  )

  const hasFeeProvider = selectedProvider === 'venmo' || selectedProvider === 'cash_app'
  const isPayPalProvider = selectedProvider === 'paypal'
  const feeCoins = selectedTier
    ? hasFeeProvider
      ? Math.round(selectedTier.coins * 0.05)
      : isPayPalProvider
        ? 50
        : 0
    : 0
  const totalCoinsNeeded = selectedTier ? selectedTier.coins + feeCoins : 0
  const canRequestCashout =
    !!selectedTier &&
    !submitting &&
    currentBalance >= totalCoinsNeeded &&
    providerUsername.trim().length > 0

  const handleConfirmCashout = useCallback(async () => {
    if (!selectedTier || !canRequestCashout || !user?.id) return

    setSubmitting(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('request_cashout', {
        p_user_id: user.id,
        p_coins_to_redeem: selectedTier.coins,
        p_provider_type: selectedProvider,
        p_provider_username: providerUsername.trim(),
        p_user_tag: null,
        p_id_verification_url: null,
      })

      if (rpcError) throw rpcError
      if (data?.success === false) throw new Error(data?.error || 'Cashout request failed')

      setSuccess(true)
      toast.success(`Cashout requested for $${selectedTier.usd.toFixed(2)}`)
      await refreshProfile()
      onSuccess?.()
    } catch (err: any) {
      const message = err?.message || 'Failed to submit cashout request'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }, [selectedTier, canRequestCashout, user?.id, selectedProvider, providerUsername, refreshProfile, onSuccess])

  const handleClose = useCallback(() => {
    if (submitting) return
    onClose()
  }, [submitting, onClose])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) handleClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, submitting, handleClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`relative w-full max-w-md overflow-hidden rounded-3xl border border-purple-500/20 bg-[#0A0814] shadow-[0_0_40px_rgba(168,85,247,0.15)] ${
              isMobile ? 'max-h-[90vh] overflow-y-auto' : ''
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-cyan-900/10 pointer-events-none" />

            <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">Mai Pay Cashout</h2>
                  <p className="text-[11px] text-gray-400">Cash out your earned coins</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={submitting}
                className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative px-5 py-4 space-y-4">
              {!success ? (
                <>
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <p className="text-[11px] font-semibold text-cyan-300/80 uppercase tracking-wider">Available Balance</p>
                    <p className="mt-1 text-2xl font-black text-cyan-300">
                      ${(currentBalance / 100).toFixed(2)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {currentBalance.toLocaleString()} Troll Coins
                    </p>
                  </div>

                  {!selectedTier ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-300">Choose Cashout Amount</p>
                      <div className="grid grid-cols-2 gap-2">
                        {eligibleTiers.map((tier) => (
                          <button
                            key={tier.coins}
                            onClick={() => setSelectedTier(tier)}
                            className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 text-left hover:border-purple-500/40 hover:bg-purple-500/10 transition-colors"
                          >
                            <p className="text-sm font-black text-white">${tier.usd.toFixed(2)}</p>
                            <p className="text-[11px] text-gray-400">{tier.coins.toLocaleString()} coins</p>
                          </button>
                        ))}
                      </div>
                      {eligibleTiers.length === 0 && (
                        <p className="text-center text-xs text-gray-500 py-4">
                          Not enough coins for any cashout tier yet.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-gray-400">Selected Amount</p>
                          <p className="text-lg font-black text-white">
                            ${selectedTier.usd.toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTier(null)
                            setShowConfirm(false)
                          }}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-gray-300 hover:bg-white/5 transition-colors"
                        >
                          Change
                        </button>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Cashout Amount</span>
                          <span className="font-mono text-white">{selectedTier.coins.toLocaleString()} coins</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Processing Fee</span>
                          <span className="font-mono text-red-400">
                            {hasFeeProvider
                              ? `${feeCoins.toLocaleString()} coins (5%)`
                              : isPayPalProvider
                                ? `50 coins ($0.25)`
                                : '$0.00'}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-2 text-xs">
                          <span className="font-bold text-white">Total Charged</span>
                          <span className="font-mono text-white">
                            {totalCoinsNeeded.toLocaleString()} coins
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">You&apos;ll Receive</span>
                          <span className="font-bold text-green-400">${selectedTier.usd.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-300">Payout Provider</p>
                        <div className="grid grid-cols-3 gap-2">
                          {PAYOUT_PROVIDERS.map((provider) => (
                            <button
                              key={provider.value}
                              onClick={() => setSelectedProvider(provider.value)}
                              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 transition-all ${
                                selectedProvider === provider.value
                                  ? 'border-purple-500 bg-purple-500/10'
                                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                              }`}
                            >
                              <div className={selectedProvider === provider.value ? 'text-purple-300' : 'text-gray-400'}>
                                {provider.icon}
                              </div>
                              <span
                                className={`text-[11px] font-semibold ${
                                  selectedProvider === provider.value ? 'text-white' : 'text-gray-400'
                                }`}
                              >
                                {provider.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-300">
                          {PAYOUT_PROVIDERS.find((p) => p.value === selectedProvider)?.label} Details
                        </label>
                        <input
                          type="text"
                          value={providerUsername}
                          onChange={(e) => setProviderUsername(e.target.value)}
                          placeholder={
                            selectedProvider === 'cash_app'
                              ? '$Cashtag'
                              : selectedProvider === 'paypal'
                                ? 'email@example.com'
                                : '@username'
                          }
                          className="w-full rounded-xl border border-purple-500/20 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                        />
                      </div>

                      {!showConfirm ? (
                        <button
                          onClick={() => setShowConfirm(true)}
                          disabled={!canRequestCashout}
                          className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${
                            canRequestCashout
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-green-500/25'
                              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Review Cashout
                        </button>
                      ) : (
                        <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                          <p className="text-sm font-black text-amber-300">Confirm Cashout</p>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Cashout Amount</span>
                              <span className="font-bold text-white">${selectedTier.usd.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Payout Fee</span>
                              <span className="font-mono text-red-400">
                                {hasFeeProvider
                                  ? `${feeCoins.toLocaleString()} coins (5%)`
                                  : isPayPalProvider
                                    ? `50 coins`
                                    : '$0.00'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">You&apos;ll Receive</span>
                              <span className="font-bold text-green-400">${selectedTier.usd.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Troll Coins Deducted</span>
                              <span className="font-mono text-white">{totalCoinsNeeded.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Payout Method</span>
                              <span className="font-semibold text-white">
                                {PAYOUT_PROVIDERS.find((p) => p.value === selectedProvider)?.label}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => setShowConfirm(false)}
                              disabled={submitting}
                              className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs font-bold text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                              CANCEL
                            </button>
                            <button
                              onClick={handleConfirmCashout}
                              disabled={submitting}
                              className="flex-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 py-2.5 text-xs font-bold text-white hover:shadow-lg hover:shadow-green-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {submitting ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                'CONFIRM CASHOUT'
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {error && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                          <p className="text-xs text-red-300">{error}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-6 text-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-green-300 mb-4">
                    <CheckCircle className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-black text-white">Cashout Requested!</h3>
                  <p className="mt-1 text-2xl font-black text-green-400">
                    ${selectedTier?.usd.toFixed(2) ?? '0.00'}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    Your payout request has been submitted through Mai Pay.
                  </p>
                  <button
                    onClick={handleClose}
                    className="mt-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-2.5 text-sm font-bold text-white hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                  >
                    DONE
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
