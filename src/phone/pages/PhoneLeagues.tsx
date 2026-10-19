import LeagueProgressPanel from '@/components/broadcast/LeagueProgressPanel'

export default function PhoneLeagues() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-24 pt-6 text-white">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="mb-4 text-xl font-black">T League</h1>
        <LeagueProgressPanel />
      </div>
    </main>
  )
}
