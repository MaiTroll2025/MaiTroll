import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyRound, Minus, Plus, Loader2, Users, ArrowLeft, Radio, Coins } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../../../lib/utils'
import { useMKeyWallet } from '../../../hooks/useMKeyWallet'
import { useCoins } from '../../../lib/hooks/useCoins'
import {
  MKEY_QUICK_AMOUNTS,
  MKEY_COIN_PRICE_PER_KEY,
  describeMKeyPurchaseError,
  describeMKeySendError,
  fetchEligibleRecipientCount,
  fetchMKeyBoostSummary,
  purchaseMKeysWithCoins,
  sendMKeys,
  type MKeyBoostSummary,
} from '../../../lib/mkeys'

interface MKeySendPanelProps {
  broadcastId: string
  /** Optional back affordance when hosted inside a tabbed tray. */
  onBack?: () => void
  onSent?: (boostId: string) => void
  className?: string
  /** Rendered at the bottom of the scrollable body (e.g. MKey traffic stats). */
  children?: React.ReactNode
}

/**
 * The MKey send interface.
 *
 * Rule 21: the line "If they don't join, your MKey comes back" is critical to
 * the UX and is always visible before the user commits.
 *
 * Rule 24: this panel asserts nothing. It asks the server to hold MKeys and
 * reports back what the server decided.
 */
export default function MKeySendPanel({ broadcastId, onBack, onSent, className, children }: MKeySendPanelProps) {
  const { wallet, refresh: refreshWallet } = useMKeyWallet()
  const { troll_coins: coinBalance, refreshCoins } = useCoins()
  const [amount, setAmount] = useState(10)
  const [sending, setSending] = useState(false)
  const [eligible, setEligible] = useState<number | null>(null)
  const [receipt, setReceipt] = useState<MKeyBoostSummary | null>(null)
  const mountedRef = useRef(true)

  // Buy-with-coins flow.
  const [buyAmount, setBuyAmount] = useState(10)
  const [buying, setBuying] = useState(false)
  const buyCost = useMemo(
    () => Math.max(0, Math.floor(buyAmount) * MKEY_COIN_PRICE_PER_KEY),
    [buyAmount]
  )
  const canAfford = coinBalance >= buyCost

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // How many active users could actually be reached right now.
  useEffect(() => {
    if (!broadcastId) return
    let cancelled = false
    const load = async () => {
      const count = await fetchEligibleRecipientCount(broadcastId)
      if (!cancelled) setEligible(count)
    }
    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void load()
    }, 20_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [broadcastId])

  const maxSendable = useMemo(
    () => Math.max(0, Math.min(wallet.available, wallet.maxAmountPerSend)),
    [wallet.available, wallet.maxAmountPerSend]
  )

  const clamp = useCallback(
    (next: number) => {
      if (maxSendable <= 0) return 0
      return Math.max(1, Math.min(Math.floor(next), maxSendable))
    },
    [maxSendable]
  )

  // Keep the chosen amount inside what the server would actually accept.
  useEffect(() => {
    setAmount((prev) => {
      if (maxSendable <= 0) return 0
      return Math.max(1, Math.min(prev || 10, maxSendable))
    })
  }, [maxSendable])

  // Live receipt: watch the campaign settle as people join or invites lapse.
  useEffect(() => {
    if (!receipt || receipt.status !== 'active') return
    const boostId = receipt.boostId
    let cancelled = false
    const timer = window.setInterval(async () => {
      const next = await fetchMKeyBoostSummary(boostId)
      if (cancelled || !next) return
      setReceipt(next)
      void refreshWallet()
      if (next.status !== 'active') window.clearInterval(timer)
    }, 10_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [receipt, refreshWallet])

  const handleSend = async () => {
    if (sending) return
    if (amount < 1) {
      toast.error('Send at least 1 MKey.')
      return
    }

    setSending(true)
    const result = await sendMKeys(broadcastId, amount)
    if (!mountedRef.current) return
    setSending(false)

    await refreshWallet()

    if (!result.success) {
      toast.error(describeMKeySendError(result))
      return
    }

    if (result.invitesCreated === 0) {
      toast.info('No active users were available to invite — your MKeys came back.')
    } else {
      toast.success(
        `🔑 ${result.invitesCreated} MKey invite${result.invitesCreated === 1 ? '' : 's'} sent` +
          (result.returnedImmediately ? ` • ${result.returnedImmediately} returned` : '')
      )
    }

    if (result.boostId) {
      const summary = await fetchMKeyBoostSummary(result.boostId)
      if (mountedRef.current && summary) setReceipt(summary)
      onSent?.(result.boostId)
    }

    const count = await fetchEligibleRecipientCount(broadcastId)
    if (mountedRef.current) setEligible(count)
  }

  const handleBuyWithCoins = async () => {
    if (buying) return
    if (buyAmount < 1) {
      toast.error('Choose at least 1 MKey to buy.')
      return
    }
    if (!canAfford) {
      toast.error('You do not have enough coins to buy that many MKeys.')
      return
    }

    setBuying(true)
    const result = await purchaseMKeysWithCoins(buyAmount)
    if (!mountedRef.current) return
    setBuying(false)

    await refreshWallet()
    await refreshCoins()

    if (!result.success) {
      toast.error(describeMKeyPurchaseError(result))
      return
    }

    toast.success(
      `🔑 Bought ${result.mkeysPurchased} MKey${result.mkeysPurchased === 1 ? '' : 's'} for ${buyCost.toLocaleString()} coins`
    )
  }

  const noneLeft = maxSendable <= 0

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Back to gifts"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <span className="text-xl" aria-hidden="true">
          🔑
        </span>
        <h3 className="text-base font-black tracking-tight text-white sm:text-lg">Send MKeys</h3>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {/* The promise, stated up front (rule 3 + rule 21) */}
        <p className="text-sm font-semibold leading-snug text-cyan-100">
          You&apos;re helping bring more viewers into this broadcast.
        </p>

        <div className="mt-3 rounded-2xl border border-purple-400/25 bg-purple-500/10 p-3 text-[11px] leading-relaxed text-purple-100 shadow-[0_0_18px_rgba(168,85,247,0.18)]">
          Each MKey invites <span className="font-bold text-white">one currently active MaiTroll user</span> who is
          watching or seated in another live broadcast.
          <br />
          <span className="font-bold text-cyan-200">If they don&apos;t join, your MKey comes back.</span>
        </div>

        {/* Balance */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 shadow-[0_0_18px_rgba(45,212,191,0.20)]">
            <KeyRound size={14} className="text-cyan-300" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">Available</span>
            <span className="font-mono text-sm font-black text-white">{wallet.available.toLocaleString()}</span>
          </div>
          {wallet.held > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">Pending</span>
              <span className="font-mono text-sm font-black text-amber-100">{wallet.held.toLocaleString()}</span>
            </div>
          )}
        </div>

        {eligible !== null && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Users size={12} className="text-cyan-400/70" />
            <span>
              <span className="font-bold text-cyan-200">{eligible.toLocaleString()}</span> active user
              {eligible === 1 ? '' : 's'} can be invited right now
            </span>
          </div>
        )}

        {/* Buy with coins (broadcaster OR viewer, anyone holding coins) */}
        <div className="mt-4 rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-3 shadow-[0_0_18px_rgba(217,70,239,0.18)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-fuchsia-200">
              <Coins size={13} />
              Buy with coins
            </div>
            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] text-amber-200">
              {coinBalance.toLocaleString()} coins
            </span>
          </div>

          <p className="mt-1.5 text-[10px] leading-relaxed text-fuchsia-100/80">
            1 MKey = {MKEY_COIN_PRICE_PER_KEY.toLocaleString()} coins. Buy MKeys with your coins, then send them to bring viewers in.
          </p>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBuyAmount((prev) => Math.max(1, prev - 1))}
              disabled={buying}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-white transition-colors hover:border-fuchsia-300/40 hover:bg-white/[0.1] disabled:opacity-40"
              aria-label="Decrease MKeys to buy"
            >
              <Minus size={16} />
            </button>

            <input
              type="number"
              inputMode="numeric"
              value={buyAmount}
              min={1}
              disabled={buying}
              onChange={(e) => setBuyAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="h-11 w-24 rounded-xl border border-fuchsia-400/30 bg-slate-950/80 text-center font-mono text-xl font-black text-white outline-none focus:border-fuchsia-300/70 disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="MKeys to buy"
            />

            <button
              type="button"
              onClick={() => setBuyAmount((prev) => prev + 1)}
              disabled={buying}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-white transition-colors hover:border-fuchsia-300/40 hover:bg-white/[0.1] disabled:opacity-40"
              aria-label="Increase MKeys to buy"
            >
              <Plus size={16} />
            </button>

            <div className="ml-auto text-right">
              <div className="font-mono text-sm font-black text-white">{buyCost.toLocaleString()}</div>
              <div className="text-[9px] uppercase tracking-wider text-fuchsia-200/70">coins</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBuyWithCoins}
            disabled={buying || !canAfford}
            className={cn(
              'mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition-all',
              !canAfford
                ? 'cursor-not-allowed border border-white/10 bg-white/[0.04] text-slate-500'
                : 'bg-gradient-to-r from-fuchsia-700 via-pink-500 to-purple-600 text-white shadow-[0_0_26px_rgba(217,70,239,0.35)] hover:from-fuchsia-600 hover:to-purple-500'
            )}
          >
            {buying ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Buying…
              </>
            ) : !canAfford ? (
              'Not enough coins'
            ) : (
              <>
                <Coins size={16} />
                Buy {buyAmount} MKey{buyAmount === 1 ? '' : 's'}
              </>
            )}
          </button>
        </div>

        {/* Amount */}
        <div className="mt-5">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Amount</div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAmount((prev) => clamp(prev - 1))}
              disabled={noneLeft || sending || amount <= 1}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-white transition-colors hover:border-cyan-300/40 hover:bg-white/[0.1] disabled:opacity-40"
              aria-label="Decrease MKeys"
            >
              <Minus size={16} />
            </button>

            <input
              type="number"
              inputMode="numeric"
              value={noneLeft ? 0 : amount}
              min={1}
              max={maxSendable || 1}
              disabled={noneLeft || sending}
              onChange={(e) => setAmount(clamp(Number(e.target.value)))}
              className="h-11 w-24 rounded-xl border border-cyan-400/30 bg-slate-950/80 text-center font-mono text-xl font-black text-white outline-none focus:border-cyan-300/70 focus:shadow-[0_0_18px_rgba(45,212,191,0.25)] disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="MKeys to send"
            />

            <button
              type="button"
              onClick={() => setAmount((prev) => clamp(prev + 1))}
              disabled={noneLeft || sending || amount >= maxSendable}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-white transition-colors hover:border-cyan-300/40 hover:bg-white/[0.1] disabled:opacity-40"
              aria-label="Increase MKeys"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Quick amounts (rule 21) */}
          <div className="mt-3 flex flex-wrap gap-2">
            {MKEY_QUICK_AMOUNTS.map((quick) => {
              const affordable = quick <= maxSendable
              return (
                <button
                  key={quick}
                  type="button"
                  disabled={!affordable || sending}
                  onClick={() => setAmount(clamp(quick))}
                  className={cn(
                    'min-w-[54px] rounded-xl border px-3 py-2 font-mono text-sm font-black transition-all',
                    amount === quick && affordable
                      ? 'border-cyan-300/70 bg-cyan-400/15 text-white shadow-[0_0_18px_rgba(45,212,191,0.30)]'
                      : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35 hover:bg-white/[0.08] hover:text-white',
                    !affordable && 'cursor-not-allowed opacity-35'
                  )}
                >
                  {quick}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sender analytics (rule 20) */}
        {receipt && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              <Radio size={11} className="text-cyan-400" />
              Your MKey Send
              {receipt.status === 'active' && (
                <span className="ml-auto rounded-full bg-cyan-500/15 px-2 py-0.5 text-[9px] normal-case tracking-normal text-cyan-200">
                  in progress
                </span>
              )}
            </div>

            <div className="mt-2 text-sm font-black text-white">{receipt.amount.toLocaleString()} MKeys sent</div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-2 py-1.5 text-center">
                <div className="font-mono text-base font-black text-emerald-300">{receipt.joined}</div>
                <div className="text-[9px] uppercase tracking-wider text-emerald-200/70">joined</div>
              </div>
              <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-2 py-1.5 text-center">
                <div className="font-mono text-base font-black text-amber-300">{receipt.pending}</div>
                <div className="text-[9px] uppercase tracking-wider text-amber-200/70">pending</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center">
                <div className="font-mono text-base font-black text-slate-200">{receipt.returned}</div>
                <div className="text-[9px] uppercase tracking-wider text-slate-400">returned</div>
              </div>
            </div>

            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              Pending MKeys return to your balance automatically if those users don&apos;t join before the invite
              expires.
            </p>
          </div>
        )}

        {children}
      </div>

      {/* Send */}
      <div className="border-t border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={handleSend}
          disabled={noneLeft || sending || amount < 1}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-black uppercase tracking-[0.12em] transition-all',
            noneLeft || amount < 1
              ? 'cursor-not-allowed border border-white/10 bg-white/[0.04] text-slate-500'
              : 'bg-gradient-to-r from-purple-700 via-cyan-500 to-pink-500 text-white shadow-[0_0_26px_rgba(45,212,191,0.35)] hover:from-purple-600 hover:via-cyan-400 hover:to-pink-500'
          )}
        >
          {sending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Sending…
            </>
          ) : noneLeft ? (
            'No MKeys available'
          ) : (
            <>
              <span aria-hidden="true">🔑</span>
              Send {amount} MKey{amount === 1 ? '' : 's'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
