import { useEffect, useState } from 'react'
import { Cat, Dog, Heart, Loader2, PawPrint, Utensils } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { petImage } from './PetPresence'

type Pet = {
  id: string
  pet_type: 'dog' | 'cat'
  name: string
  care_status: number
  needs: { hunger?: boolean; walk?: boolean; care?: boolean }
  pet_level: number
  training_xp: number
}

const agreementVersion = '2026-09-24'

export default function PetShelterPanel({ compact = false }: { compact?: boolean }) {
  const [pet, setPet] = useState<Pet | null>(null)
  const [loading, setLoading] = useState(true)
  const [adopting, setAdopting] = useState(false)
  const [petType, setPetType] = useState<'dog' | 'cat'>('dog')
  const [petName, setPetName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [interaction, setInteraction] = useState<string | null>(null)

  const loadPet = async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data } = await supabase
      .from('pets')
      .select('id, pet_type, name, care_status, needs, pet_level, training_xp')
      .eq('owner_id', userData.user.id)
      .eq('is_primary', true)
      .eq('is_active', true)
      .maybeSingle()
    setPet((data as Pet | null) || null)
  }

  useEffect(() => {
    void loadPet().finally(() => setLoading(false))
  }, [])

  const adopt = async () => {
    if (!petName.trim() || !agreed) return
    setAdopting(true)
    const { data, error } = await supabase.rpc('adopt_troll_pet', {
      p_pet_type: petType,
      p_name: petName.trim(),
      p_agreement_version: agreementVersion,
    })
    setAdopting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setPet(data as Pet)
    window.dispatchEvent(new Event('pet-updated'))
    toast.success(`${petName.trim()} joined your MaiTroll life`)
  }

  const care = async (type: 'feed' | 'walk' | 'care') => {
    if (!pet) return
    setInteraction(type)
    const { data, error } = await supabase.rpc('interact_with_troll_pet', {
      p_pet_id: pet.id,
      p_interaction_type: type,
    })
    setInteraction(null)
    if (error) {
      toast.error(error.message)
      return
    }
    setPet(data as Pet)
    window.dispatchEvent(new Event('pet-updated'))
  }

  if (loading) return <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 text-sm text-cyan-100/60">Loading Troll Animal Shelter...</div>

  if (pet) {
    const need = pet.needs?.hunger ? 'is hungry' : pet.needs?.walk ? 'needs a walk' : pet.needs?.care ? 'wants attention' : 'is feeling cared for'
    return (
      <section className={`rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 shadow-[0_0_34px_rgba(34,211,238,0.08)] backdrop-blur-xl ${compact ? '' : 'md:p-7'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10"><span role="img" aria-label={pet.pet_type} className="text-3xl">{petImage(pet.pet_type)}</span></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200/60">Your Troll Pet</p><h2 className="text-2xl font-black text-white">{pet.name}</h2></div></div>
          <div className="text-right"><p className="text-xs text-slate-400">Pet Status</p><p className={`text-2xl font-black ${pet.care_status < 80 ? 'text-amber-300' : 'text-emerald-300'}`}>{pet.care_status}%</p></div>
        </div>
        <p className="mt-4 text-sm text-slate-300">{pet.name} {need}.</p>
        <div className="mt-4 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300" style={{ width: `${pet.care_status}%` }} /></div>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void care('feed')} disabled={!!interaction} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-sm font-bold text-cyan-100"><Utensils className="h-4 w-4" /> Feed</button><button type="button" onClick={() => void care('walk')} disabled={!!interaction} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-100"><PawPrint className="h-4 w-4" /> Walk</button><button type="button" onClick={() => void care('care')} disabled={!!interaction} className="inline-flex items-center gap-2 rounded-xl border border-pink-300/25 bg-pink-400/10 px-3 py-2 text-sm font-bold text-pink-100"><Heart className="h-4 w-4" /> Play/Care</button>{interaction && <Loader2 className="h-5 w-5 animate-spin self-center text-cyan-200" />}</div>
        <p className="mt-4 text-xs text-slate-500">Pet level {pet.pet_level}. Raid eligibility unlocks at level 50 through the existing raid system.</p>
      </section>
    )
  }

  return (
    <section className={`rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 shadow-[0_0_34px_rgba(34,211,238,0.08)] backdrop-blur-xl ${compact ? '' : 'md:p-7'}`}>
      <div className="flex items-center gap-3"><PawPrint className="h-6 w-6 text-cyan-200" /><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200/60">Troll Animal Shelter</p><h2 className="text-2xl font-black text-white">Adopt your free pet</h2></div></div>
      <p className="mt-3 text-sm leading-6 text-slate-300">Choose a dog or cat, give them a name, and accept the pet-care agreement. Adoption is free and each Resident may have one primary pet.</p>
      <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => setPetType('dog')} className={`rounded-2xl border p-4 text-left ${petType === 'dog' ? 'border-cyan-300/50 bg-cyan-400/10' : 'border-white/10 bg-white/[0.03]'}`}><Dog className="h-7 w-7 text-cyan-200" /><p className="mt-2 font-black text-white">Dog</p></button><button type="button" onClick={() => setPetType('cat')} className={`rounded-2xl border p-4 text-left ${petType === 'cat' ? 'border-cyan-300/50 bg-cyan-400/10' : 'border-white/10 bg-white/[0.03]'}`}><Cat className="h-7 w-7 text-purple-200" /><p className="mt-2 font-black text-white">Cat</p></button></div>
      <input value={petName} onChange={(event) => setPetName(event.target.value)} maxLength={32} placeholder="Pet name" className="mt-4 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40" />
      <label className="mt-4 flex gap-3 text-xs leading-5 text-slate-400"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1" />I accept the pet-care agreement: I am responsible for care, neglect may reduce status, and repeated neglect may trigger MaiTroll enforcement rules.</label>
      <button type="button" onClick={() => void adopt()} disabled={adopting || !agreed || !petName.trim()} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100 disabled:opacity-50">{adopting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PawPrint className="h-4 w-4" />} Adopt Free Pet</button>
    </section>
  )
}
