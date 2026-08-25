import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Mic, Play } from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'

export default function PhonePodcast() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen w-full bg-[#05010f] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#00BFFF]/15 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-[#BF00FF]/15 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-[#00BFFF]/20 bg-[#05010f]/90 backdrop-blur-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 active:scale-95"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-[0.18em]">
              Podcast
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              Listen & Create
            </p>
          </div>

          <div className="w-10" />
        </div>
      </header>

      <main className="relative z-10 px-4 py-6">
        <section className={`relative overflow-hidden rounded-3xl p-6 ${neonCard}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/10 via-transparent to-[#BF00FF]/10" />
          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-[0_0_25px_rgba(236,72,153,0.3)]">
              <Mic size={32} className="text-white" />
            </div>
            <h2 className={`mt-4 text-xl font-black ${neonTextGradient}`}>
              Podcasts
            </h2>
            <p className="mt-2 text-xs text-zinc-400">
              Discover and listen to the latest podcasts from creators.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
