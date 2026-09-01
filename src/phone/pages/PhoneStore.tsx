import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Coins,
  Store,
} from 'lucide-react'
import CoinStore from '../../pages/CoinStore.jsx'

export default function PhoneStore() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#03030a] text-white">
      {/* ------------------------------------------------------------------ */}
      {/* Premium MaiTroll Neon Background                                   */}
      {/* ------------------------------------------------------------------ */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Cyan ambient glow */}
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#00BFFF]/10 blur-[110px]" />

        {/* Purple ambient glow */}
        <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-[#BF00FF]/10 blur-[110px]" />

        {/* Subtle center glow */}
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-[#00BFFF]/[0.025] blur-[120px]" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                             */}
      {/* ------------------------------------------------------------------ */}

      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-[#00BFFF]/10 bg-[#03030a]/90 px-4 backdrop-blur-2xl">
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="
            flex h-10 w-10 items-center justify-center
            rounded-xl
            border border-white/[0.08]
            bg-[#070711]/80
            text-zinc-300
            shadow-[0_8px_25px_rgba(0,0,0,0.25)]
            transition-all duration-200
            active:scale-95
          "
          aria-label="Go back"
        >
          <ArrowLeft size={19} />
        </button>

        {/* Store identity */}
        <div className="flex items-center gap-2">
          <div
            className="
              flex h-8 w-8 items-center justify-center
              rounded-lg
              border border-[#00BFFF]/20
              bg-gradient-to-br
              from-[#00BFFF]/15
              to-[#BF00FF]/15
              shadow-[0_0_18px_rgba(0,191,255,0.12)]
            "
          >
            <Store
              size={16}
              className="text-[#00BFFF]"
            />
          </div>

          <div className="leading-none">
            <h1 className="text-xs font-black uppercase tracking-[0.18em] text-white">
              Coin Store
            </h1>

            <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-zinc-600">
              Troll City Store
            </p>
          </div>
        </div>

        {/* Coins */}
        <div
          className="
            flex h-10 w-10 items-center justify-center
            rounded-xl
            border border-[#BF00FF]/10
            bg-[#070711]/60
          "
        >
          <Coins
            size={18}
            className="text-[#BF00FF]"
          />
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Store Content                                                      */}
      {/* ------------------------------------------------------------------ */}

      <main className="relative z-10 w-full pb-24">
        <CoinStore />
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Shared Homepage Theme Effects                                      */}
      {/* ------------------------------------------------------------------ */}

      <style>{`
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(0,191,255,0.25) transparent;
        }

        *::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }

        *::-webkit-scrollbar-track {
          background: transparent;
        }

        *::-webkit-scrollbar-thumb {
          background: linear-gradient(
            180deg,
            rgba(0,191,255,0.35),
            rgba(191,0,255,0.35)
          );
          border-radius: 999px;
        }
      `}</style>
    </div>
  )
}
