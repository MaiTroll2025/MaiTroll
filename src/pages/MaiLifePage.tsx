import { Building2, Crown, MapPin, Sparkles } from 'lucide-react'
import CityIdentityPanel from '../components/profile/CityIdentityPanel'
import MaiSubPanel from '../components/profile/MaiSubPanel'
import PetShelterPanel from '../components/pets/PetShelterPanel'
import { useCityStatus } from '../hooks/useCityStatus'
import { useAuthStore } from '../lib/store'

export default function MaiLifePage() {
  const user = useAuthStore((state) => state.user)
  const { status, loading } = useCityStatus(user?.id)

  return (
    <main className="min-h-screen bg-[#050714] px-4 pb-12 pt-24 text-white md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-6 shadow-[0_0_55px_rgba(34,211,238,0.12)] backdrop-blur-2xl md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" /> MaiLife
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">Your life in MaiTroll</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Your city identity, progression, access, and everyday place in the city.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <Crown className="h-5 w-5 text-amber-300" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">City Status</p>
                <p className="font-black text-cyan-100">{loading ? 'Loading...' : status?.display_name || 'Resident'}</p>
              </div>
            </div>
          </div>
          {status && (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-white/45">XP</p><p className="mt-1 text-2xl font-black text-cyan-200">{status.xp_total.toLocaleString()}</p></div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-white/45">Level</p><p className="mt-1 text-2xl font-black text-white">{status.level}</p></div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-white/45">Next Status</p><p className="mt-1 text-2xl font-black text-emerald-300">{status.next_display_name || 'Complete'}</p></div>
            </div>
          )}
        </header>
        <div className="grid gap-6 lg:grid-cols-2">
          <CityIdentityPanel />
          <section className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 shadow-[0_0_34px_rgba(34,211,238,0.08)] backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3"><MapPin className="h-5 w-5 text-cyan-200" /><div><h2 className="text-xl font-black">Your Place</h2><p className="text-sm text-slate-400">Your street and city presence grow from real activity.</p></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><Building2 className="h-5 w-5 text-cyan-200" /><p className="mt-3 text-sm font-bold text-white">City identity</p><p className="mt-1 text-xs text-slate-400">Set your street, ZIP, and neighborhood.</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><Crown className="h-5 w-5 text-amber-300" /><p className="mt-3 text-sm font-bold text-white">Progression</p><p className="mt-1 text-xs text-slate-400">Status is calculated from profile XP.</p></div></div>
          </section>
        </div>
        <PetShelterPanel compact />
        <MaiSubPanel />
      </div>
    </main>
  )
}
