import { ArrowLeft, Car, Construction, Home } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function CarDealership() {
  const navigate = useNavigate()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(168,85,247,0.2),transparent_55%)]" />
      <section className="relative w-full max-w-xl rounded-3xl border border-fuchsia-300/20 bg-slate-900/80 p-8 text-center shadow-[0_0_60px_rgba(168,85,247,0.12)] backdrop-blur-xl sm:p-12">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl border border-fuchsia-300/25 bg-fuchsia-400/10">
          <Car className="h-10 w-10 text-fuchsia-200" aria-hidden="true" />
        </div>
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
          <Construction className="h-4 w-4" aria-hidden="true" />
          Under Construction
        </p>
        <h1 className="text-3xl font-black sm:text-4xl">Mai Troll Auto Mall</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-300 sm:text-base">
          Dealership services are temporarily unavailable while we prepare an improved experience.
          No purchases, reservations, or coin transactions can be made here.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-5 font-bold text-cyan-100 transition hover:bg-cyan-400/20"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to the City
        </button>
      </section>
    </main>
  )
}
