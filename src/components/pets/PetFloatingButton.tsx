import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PawPrint } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { petImage } from './PetPresence'
import PetShelterModal from './PetShelterModal'

type PetSummary = { id: string; pet_type: 'dog' | 'cat'; name: string; care_status: number }

export default function PetFloatingButton() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const location = useLocation()
  const [pet, setPet] = useState<PetSummary | null>(null)
  const [isShelterOpen, setIsShelterOpen] = useState(false)

  const isBroadcastSurface =
    location.pathname.startsWith('/broadcast/') ||
    location.pathname.startsWith('/live/') ||
    location.pathname.startsWith('/watch/') ||
    location.pathname.startsWith('/stream/')

  useEffect(() => {
    let active = true
    if (!user?.id) {
      setPet(null)
      return () => { active = false }
    }
    void supabase.from('pets').select('id, pet_type, name, care_status').eq('owner_id', user.id).eq('is_primary', true).eq('is_active', true).maybeSingle().then(({ data }) => {
      if (active) setPet((data as PetSummary | null) || null)
    })
    return () => { active = false }
  }, [user?.id])

  useEffect(() => {
    const openShelter = () => setIsShelterOpen(true)
    window.addEventListener('open-pet-shelter', openShelter)
    return () => window.removeEventListener('open-pet-shelter', openShelter)
  }, [])

  if (!user) return null
  const needsCare = (pet?.care_status ?? 100) < 80

  const button = (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (isBroadcastSurface) {
          setIsShelterOpen(true)
        } else {
          void navigate('/troll-animal-shelter')
        }
      }}
      aria-label={pet ? `Open ${pet.name} pet care` : 'Open Troll Animal Shelter'}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-[9999] flex cursor-pointer items-center gap-2 rounded-full border border-cyan-300/35 bg-slate-950/90 px-3 py-2 text-xs font-black text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.22)] backdrop-blur-xl transition hover:scale-105 md:bottom-6 md:right-6 pointer-events-auto"
    >
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/15">{pet ? <span role="img" aria-label={pet.pet_type} className="text-xl">{petImage(pet.pet_type)}</span> : <PawPrint className="h-5 w-5" />}{needsCare && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-300 ring-2 ring-slate-950" />}</span>
      <span className="hidden sm:inline">{pet ? `${pet.name} ${pet.care_status}%` : 'Shelter'}</span>
    </button>
  )

  const content = (
    <>
      {button}
      {isShelterOpen && isBroadcastSurface && (
        <PetShelterModal onClose={() => setIsShelterOpen(false)} />
      )}
    </>
  )

  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}
