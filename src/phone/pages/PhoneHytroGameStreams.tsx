import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Gamepad2 } from 'lucide-react'

export default function PhoneHytroGameStreams() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen w-full bg-[#0A0814] text-white">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#0A0814]/90 px-4 py-3 backdrop-blur-xl">
        <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-white/80">HytroGaming</h1>
        <div className="w-9" />
      </header>
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Gamepad2 size={28} className="text-zinc-600" />
        </div>
        <h2 className="mt-4 text-lg font-black text-white/90">HytroGaming Streams</h2>
        <p className="mt-2 max-w-xs text-xs text-zinc-500">Watch gaming streams and connect with players. Full HytroGaming experience coming to phone.</p>
      </main>
    </div>
  )
}
