import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'

export default function PhoneAdminUsers() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen w-full bg-[#05010f] text-white">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#00BFFF]/20 bg-[#05010f]/90 px-4 py-3 backdrop-blur-2xl">
        <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>
        <h1 className={`text-sm font-black uppercase tracking-widest ${neonTextGradient}`}>Manage Users</h1>
        <div className="w-9" />
      </header>
      <main className="p-4">
        <section className={`${neonCard} p-5 text-center`}>
          <Users className="mx-auto h-10 w-10 text-[#00BFFF]" />
          <h2 className="mt-3 text-lg font-black text-white">Manage Users</h2>
          <p className="mt-2 text-xs text-zinc-400">Admin user management tools.</p>
        </section>
      </main>
    </div>
  )
}
