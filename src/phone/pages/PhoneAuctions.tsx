import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Gavel, Sparkles } from 'lucide-react'

export default function PhoneAuctions() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#07051A] text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between border-b border-cyan-300/10 bg-[#07051A]/90 px-4 py-3 backdrop-blur-xl"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/15 bg-white/[0.04] text-white transition active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-cyan-300" />

          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">
            Auctions
          </h1>
        </div>

        <div className="h-10 w-10" />
      </header>

      {/* Content */}
      <main className="relative z-10 flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center px-6 pb-12 text-center">
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-0 rounded-[2rem] bg-cyan-400/10 blur-2xl" />

          <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 to-purple-500/10 shadow-[0_0_40px_rgba(34,211,238,0.12)]">
            <Gavel className="h-10 w-10 text-cyan-300" />

            <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-xl border border-purple-300/20 bg-purple-500/20">
              <Sparkles className="h-4 w-4 text-purple-200" />
            </div>
          </div>
        </div>

        {/* Badge */}
        <div className="mt-7 rounded-full border border-purple-300/20 bg-purple-400/10 px-4 py-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-purple-200">
            Coming Soon
          </span>
        </div>

        {/* Title */}
        <h2 className="mt-4 bg-gradient-to-r from-white via-cyan-100 to-purple-200 bg-clip-text text-2xl font-black text-transparent">
          Mai Troll Auctions
        </h2>

        {/* Description */}
        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
          The auction viewing experience is coming soon to phone.
          We’re building the mobile auction floor so you can watch
          live auction events from anywhere.
        </p>

        {/* Placeholder cards */}
        <div className="mt-8 grid w-full max-w-sm gap-3">
          <div className="rounded-2xl border border-cyan-300/10 bg-white/[0.035] p-4 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10">
                <Gavel className="h-5 w-5 text-cyan-300/70" />
              </div>

              <div>
                <p className="text-sm font-black text-white/80">
                  Live Auction Shows
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Coming to phone
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-purple-300/10 bg-white/[0.035] p-4 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-400/10">
                <Sparkles className="h-5 w-5 text-purple-300/70" />
              </div>

              <div>
                <p className="text-sm font-black text-white/80">
                  Auction Floor
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Viewing experience in development
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      />
    </div>
  )
}