import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Pet = { id: string; pet_type: 'dog' | 'cat'; name: string; care_status: number }

export function petImage(type: 'dog' | 'cat') {
  return type === 'dog' ? '🐕' : '🐈'
}

export default function PetPresence({ ownerId, streamId, className = '' }: { ownerId?: string; streamId?: string; className?: string }) {
  const [pet, setPet] = useState<Pet | null>(null)
  const [reaction, setReaction] = useState(false)

  useEffect(() => {
    if (!ownerId) return
    let active = true
    const loadPet = async () => {
      const { data } = await supabase
        .from('pets')
        .select('id, pet_type, name, care_status')
        .eq('owner_id', ownerId)
        .eq('is_primary', true)
        .eq('is_active', true)
        .maybeSingle()
      if (active) setPet((data as Pet | null) || null)
    }
    const channel = supabase.channel(`pet-gift-reaction:${streamId || ownerId}:${ownerId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gifts', filter: `receiver_id=eq.${ownerId}` }, () => {
      setReaction(true)
      window.setTimeout(() => setReaction(false), 1800)
    }).subscribe()
    const handlePetUpdated = () => { void loadPet() }
    window.addEventListener('pet-updated', handlePetUpdated)
    void loadPet()
    return () => {
      active = false
      window.removeEventListener('pet-updated', handlePetUpdated)
      void supabase.removeChannel(channel)
    }
  }, [ownerId, streamId])

  if (!pet) return null
  return (
    <div className={`pointer-events-none absolute bottom-2 right-2 z-20 flex items-end gap-1 ${className}`} aria-label={`${pet.name}, pet status ${pet.care_status}%`}>
      <div className={`relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-slate-950/80 p-1 shadow-[0_0_18px_rgba(34,211,238,0.3)] ${reaction ? 'animate-bounce' : 'animate-[pet-float_3s_ease-in-out_infinite]'}`}>
        <span role="img" aria-label={pet.pet_type} className="text-[26px] leading-none">{petImage(pet.pet_type)}</span>
        <span className={`absolute -bottom-1 -left-1 rounded-full px-1 text-[8px] font-black text-white ${pet.care_status < 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}>{pet.care_status}%</span>
      </div>
      {reaction && <span className="mb-7 rounded-full border border-amber-300/40 bg-slate-950/90 px-2 py-1 text-[9px] font-black text-amber-200 shadow-lg">{pet.name} is excited! 🎁</span>}
    </div>
  )
}
