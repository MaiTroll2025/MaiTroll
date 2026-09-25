import PetShelterPanel from '../components/pets/PetShelterPanel'

export default function TrollAnimalShelterPage() {
  return (
    <main className="min-h-screen bg-[#050714] px-4 pb-12 pt-24 text-white md:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-6 shadow-[0_0_55px_rgba(34,211,238,0.12)] backdrop-blur-2xl md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200/70">MaiLife</p>
          <h1 className="mt-2 text-3xl font-black md:text-5xl">Troll Animal Shelter</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">A free companion for your life in MaiTroll. Care for your pet, build trust, and grow together.</p>
        </header>
        <PetShelterPanel />
      </div>
    </main>
  )
}
