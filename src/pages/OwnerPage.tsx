import { Crown, Construction } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useCityStatus } from '../hooks/useCityStatus'
import { useAuthStore } from '../lib/store'

export default function OwnerPage() {
  const user = useAuthStore((state) => state.user)
  const { status, loading } = useCityStatus(user?.id)

  if (!loading && status && status.status_key !== 'owner' && status.status_key !== 'mayor') {
    return <Navigate to="/mai-life" replace />
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050714] px-4 pt-16 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-amber-300/20 bg-slate-950/75 p-8 text-center shadow-[0_0_55px_rgba(251,191,36,0.1)] backdrop-blur-2xl">
        <Crown className="mx-auto h-12 w-12 text-amber-300" />
        <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-amber-200/70">Owner</p>
        <h1 className="mt-2 text-3xl font-black">You have reached Owner status.</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-300">The Owner city system is being prepared. Your future responsibilities will include running your part of MaiTroll.</p>
        <Construction className="mx-auto mt-6 h-5 w-5 text-slate-500" />
      </section>
    </main>
  )
}
