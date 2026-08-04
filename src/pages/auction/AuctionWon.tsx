import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { useIsMobile } from '@/hooks/useIsMobile'
import { supabase } from '@/lib/supabase'
import useSEO from '@/hooks/useSEO'
import {
  ArrowRight,
  Home,
  Loader2,
  Package,
  Trophy,
} from 'lucide-react'

interface WonLot {
  id: string
  title: string
  image_url: string | null
  current_highest_bid: number
  quantity: number
  description: string | null
}

interface WonShow {
  id: string
  title: string
}

function formatCoins(value: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(value || 0))
}

export default function AuctionWon() {
  const { showId } = useParams<{ showId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const isLoadingAuth = useAuthStore((state) => state.isLoading)
  const { isMobile } = useIsMobile()

  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState<WonShow | null>(null)
  const [wonLots, setWonLots] = useState<WonLot[]>([])

  useSEO({
    title: 'Items You Won | Mai Troll Auctions',
    description: 'View the items you won in this Mai Troll live auction.',
  })

  useEffect(() => {
    if (isLoadingAuth) return
    if (!user?.id || !showId) {
      navigate('/', { replace: true })
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        const [{ data: showData }, { data: lotsData }] = await Promise.all([
          supabase.from('auction_shows').select('id, title').eq('id', showId).single(),
          supabase
            .from('auction_lots')
            .select('id, title, image_url, current_highest_bid, quantity, description')
            .eq('auction_show_id', showId)
            .eq('winner_user_id', user.id)
            .eq('status', 'sold'),
        ])

        if (cancelled) return

        if (!showData) {
          navigate('/', { replace: true })
          return
        }

        setShow(showData as WonShow)

        const lots = (lotsData || []) as WonLot[]
        if (lots.length === 0) {
          navigate('/', { replace: true })
          return
        }

        setWonLots(lots)
      } catch (err) {
        console.warn('[AuctionWon] Failed to load won items:', err)
        if (!cancelled) navigate('/', { replace: true })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [user?.id, showId, isLoadingAuth, navigate])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050715] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
          <p className="text-sm font-bold text-slate-300">Loading your wins...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full bg-[#050715] px-3 pb-10 pt-4 text-white md:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="overflow-hidden rounded-3xl border border-yellow-400/30 bg-gradient-to-br from-[#0c1a32] to-[#0a1628] shadow-[0_0_60px_rgba(250,204,21,0.15)]">
          <div className="h-1.5 bg-gradient-to-r from-yellow-400 via-emerald-400 to-cyan-400" />
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-yellow-300/30 bg-yellow-400/10">
              <Trophy className="h-10 w-10 text-yellow-300" />
            </div>
            <h1 className="text-2xl font-black text-white">🎉 You Won!</h1>
            <p className="mt-2 text-sm text-slate-300">
              {wonLots.length} item{wonLots.length > 1 ? 's' : ''} won
              {show ? ` in ${show.title}` : ''}.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {wonLots.map((lot) => (
            <div
              key={lot.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                {lot.image_url ? (
                  <img src={lot.image_url} alt={lot.title} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-400/10">
                    <Package className="h-6 w-6 text-cyan-300" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{lot.title}</p>
                  <p className="text-xs text-slate-400">
                    Qty {lot.quantity || 1} • {formatCoins(lot.current_highest_bid)} TC
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={`mt-6 flex gap-3 ${isMobile ? 'flex-col' : ''}`}>
          <button
            onClick={() => navigate('/')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/10"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </button>
          <button
            onClick={() => navigate('/marketplace?tab=orders&filter=auction')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_20px_rgba(250,204,21,0.25)] hover:from-yellow-300 hover:to-amber-400"
          >
            View / Checkout Orders
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
