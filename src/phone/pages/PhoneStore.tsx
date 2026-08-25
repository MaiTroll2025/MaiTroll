import React, { Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Coins,
  Loader2,
  Store,
} from 'lucide-react'

const CoinStore = React.lazy(
  () => import('../../pages/CoinStore.jsx')
)

export default function PhoneStore() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen w-full bg-[#07020F] text-white">
      {/* Neon background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-fuchsia-600/10 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-cyan-400/10 bg-[#07020F]/90 px-4 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft size={19} />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-gradient-to-br from-cyan-400/20 to-fuchsia-500/20 shadow-[0_0_18px_rgba(34,211,238,.12)]">
            <Store
              size={16}
              className="text-cyan-300"
            />
          </div>

          <div className="leading-none">
            <h1 className="text-xs font-black uppercase tracking-[0.18em]">
              Coin Store
            </h1>

            <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-zinc-600">
              Troll City Store
            </p>
          </div>
        </div>

        <div className="flex h-10 w-10 items-center justify-center">
          <Coins
            size={18}
            className="text-fuchsia-400"
          />
        </div>
      </header>

      {/* Store */}
      <main className="relative z-10 w-full">
        <Suspense
          fallback={
            <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/5 shadow-[0_0_30px_rgba(34,211,238,.08)]">
                <Loader2
                  size={28}
                  className="animate-spin text-cyan-300"
                />
              </div>

              <h2 className="mt-5 text-sm font-black uppercase tracking-widest">
                Loading Store
              </h2>

              <p className="mt-2 text-xs text-zinc-500">
                Loading the Troll City Coin Store...
              </p>
            </div>
          }
        >
          <CoinStore />
        </Suspense>
      </main>
    </div>
  )
}