import React from 'react'
import { useUserPromoCards, UserPromoCard } from '../hooks/useUserPromoCards'
import { Ticket, ExternalLink, Clock, Unlock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

import { validatePromoCardLocally } from '../lib/promoCodeValidate'

const REDEEM_BASE = 'https://maitalent.fun/redeem?code='
const PROMO_SECRET = import.meta.env.VITE_TROLL_CITY_PROMO_SECRET || 'gj3f29QZx4vHn6A8r5S2pL1u9Jd0Yc7F'

function StatusBadge({ status, expires_at }: { status: string; expires_at?: string | null }) {
  const isExpired = status === 'expired' || (!!expires_at && new Date(expires_at).getTime() <= Date.now())
  const isRedeemed = status === 'redeemed'

  if (isRedeemed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Redeemed
      </span>
    )
  }

  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-300">
        <XCircle className="h-3.5 w-3.5" />
        Expired
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-300">
      <Unlock className="h-3.5 w-3.5" />
      Available
    </span>
  )
}

function PromoCardGrid({ cards }: { cards: UserPromoCard[] }) {
  const sourceLabel: Record<string, string> = {
    broadcast_start: 'Broadcast Start',
    broadcast_watch: 'Watcher Reward',
    share_link: 'Share Link',
    broadcast_60m: '1 Hour Stream',
    broadcast_240m: '4 Hour Stream',
    viewer_reward: 'Viewer Reward',
    share_reward: 'Share Reward',
  }

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    toast.success('Promo code copied')

    try {
      const { data: cardData, error: cardError } = await supabase
        .from('promo_cards')
        .select('code, status, expires_at, token_amount, source_type')
        .eq('code', code)
        .maybeSingle()

      if (cardError || !cardData) {
        toast.error('Promo debug: code not found in Mai Troll DB')
        return
      }

      const validation = validatePromoCardLocally(cardData)
      if (!validation.valid) {
        toast.error(`Promo debug: ${validation.reason}`)
      } else {
        toast.success(`Promo debug: valid — ${cardData.token_amount} tokens (${cardData.source_type})`)
      }

      let reachable = false
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const { data, error: invokeError } = await supabase.functions.invoke('redeem-maitalent-promo', {
          body: { code, requestor: { platform: 'maitalent.fun', accountId: 'ui-debug' } },
          headers: {
            'X-Client-Platform': 'maitalent.fun',
            'x-api-key': PROMO_SECRET,
          },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        reachable = !invokeError || invokeError.status < 500
        toast.info(`Promo debug: API reachable (${invokeError ? invokeError.status || 0 : 200})`)
      } catch (err: any) {
        toast.error(`Promo debug: API unreachable — ${err?.message || 'network error'}`)
      }
    } catch (err) {
      console.error('[promo-debug] copy validation failed', err)
    }
  }

  const redeemCard = (code: string) => {
    window.open(`${REDEEM_BASE}${encodeURIComponent(code)}`, '_blank', 'noopener,noreferrer')
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isRedeemable = (card: UserPromoCard) => {
    if (card.status === 'redeemed' || card.status === 'expired') return false
    if (card.expires_at && new Date(card.expires_at).getTime() <= Date.now()) return false
    return true
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const redeemable = isRedeemable(card)
        return (
          <div
            key={card.id}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-purple-500/40 hover:bg-white/[0.06]"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-500/25 bg-purple-500/10 text-purple-300">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    {sourceLabel[card.source_type] || card.source_type}
                  </p>
                  <p className="text-lg font-black text-white">{card.token_amount} Tokens</p>
                </div>
              </div>
              <StatusBadge status={card.status} expires_at={card.expires_at} />
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Promo Code</p>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-sm font-bold text-white truncate">{card.code}</p>
                <button
                  onClick={() => copyCode(card.code)}
                  className="shrink-0 text-[11px] font-semibold text-purple-300 hover:text-purple-200"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-white/60 mb-4">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Issued {formatDate(card.issued_at)}
              </span>
              {card.expires_at && (
                <span className="inline-flex items-center gap-1.5">
                  Expires {formatDate(card.expires_at)}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => copyCode(card.code)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition"
              >
                Copy Code
              </button>
              {redeemable && (
                <button
                  onClick={() => redeemCard(card.code)}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-2.5 text-xs font-black text-white hover:from-purple-500 hover:to-pink-500 transition shadow-lg shadow-purple-500/25"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Redeem
                  </span>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ProfileMaitalentPromos() {
  const { cards, loading, error } = useUserPromoCards()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        <span className="ml-3 text-sm font-semibold text-white/70">Loading promo cards...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-950/20 p-6 text-center">
        <p className="text-sm font-semibold text-red-300">Failed to load promo cards</p>
        <p className="mt-1 text-xs text-red-400">{error}</p>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-300">
          <Ticket className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-black text-white">No Promo Cards Yet</h3>
        <p className="mt-2 text-sm text-white/60 max-w-md mx-auto">
          Start a broadcast, watch streams, or share maiMaiTroll.com / maitalent.fun links to earn MaiTalent promo cards.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-white">
          <Ticket className="inline h-5 w-5 text-purple-400 mr-2" />
          MaiTalent Promos ({cards.length})
        </h3>
      </div>
      <PromoCardGrid cards={cards} />
    </div>
  )
}
