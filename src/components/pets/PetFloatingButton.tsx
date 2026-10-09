import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PawPrint } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { petImage } from './petImage'
import PetShelterModal from './PetShelterModal'

type PetSummary = { id: string; pet_type: 'dog' | 'cat'; name: string; care_status: number; hunger_status: number; walk_status: number; attention_status: number }
type FloatingPosition = { top: number; left: number }

const PET_BUTTON_POSITION_KEY = 'pet-floating-button-position'

function isFloatingPosition(value: unknown): value is FloatingPosition {
  if (!value || typeof value !== 'object' || !('top' in value) || !('left' in value)) return false
  return typeof value.top === 'number' && Number.isFinite(value.top) &&
    typeof value.left === 'number' && Number.isFinite(value.left)
}

function clampPosition(position: FloatingPosition, width: number, height: number): FloatingPosition {
  return {
    top: Math.max(0, Math.min(window.innerHeight - height, position.top)),
    left: Math.max(0, Math.min(window.innerWidth - width, position.left)),
  }
}

export default function PetFloatingButton() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const location = useLocation()
  const [pet, setPet] = useState<PetSummary | null>(null)
  const [isShelterOpen, setIsShelterOpen] = useState(false)
  const [position, setPosition] = useState<FloatingPosition | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<{
    pointerId: number
    offsetX: number
    offsetY: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const suppressClickRef = useRef(false)

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
    const loadPet = async () => {
      const { data } = await supabase.from('pets').select('id, pet_type, name, care_status, hunger_status, walk_status, attention_status').eq('owner_id', user.id).eq('is_primary', true).eq('is_active', true).maybeSingle()
      if (active) setPet((data as PetSummary | null) || null)
    }
    void loadPet()
    const channel = supabase.channel(`pet-button:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pets', filter: `owner_id=eq.${user.id}` }, () => { void loadPet() })
      .subscribe()
    const handlePetUpdated = () => { void loadPet() }
    window.addEventListener('pet-updated', handlePetUpdated)
    return () => {
      active = false
      window.removeEventListener('pet-updated', handlePetUpdated)
      void supabase.removeChannel(channel)
    }
  }, [user?.id])

  useEffect(() => {
    const openShelter = () => setIsShelterOpen(true)
    window.addEventListener('open-pet-shelter', openShelter)
    return () => window.removeEventListener('open-pet-shelter', openShelter)
  }, [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PET_BUTTON_POSITION_KEY)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (isFloatingPosition(parsed)) {
        const button = buttonRef.current
        setPosition(clampPosition(parsed, button?.offsetWidth ?? 140, button?.offsetHeight ?? 44))
      }
    } catch (error) {
      console.warn('[PetFloatingButton] Could not load saved position', error)
    }
  }, [])

  useEffect(() => {
    if (!position) return
    const clampToViewport = () => {
      const button = buttonRef.current
      setPosition((current) =>
        current
          ? clampPosition(current, button?.offsetWidth ?? 140, button?.offsetHeight ?? 44)
          : null,
      )
    }
    window.addEventListener('resize', clampToViewport)
    return () => window.removeEventListener('resize', clampToViewport)
  }, [position])

  const finishDrag = useCallback((pointerId: number) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== pointerId) return
    dragRef.current = null
    setIsDragging(false)
    if (drag.moved) {
      suppressClickRef.current = true
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
      const button = buttonRef.current
      setPosition((current) => {
        if (!current) return current
        const next = clampPosition(current, button?.offsetWidth ?? 140, button?.offsetHeight ?? 44)
        try {
          window.localStorage.setItem(PET_BUTTON_POSITION_KEY, JSON.stringify(next))
        } catch (error) {
          console.warn('[PetFloatingButton] Could not save position', error)
        }
        return next
      })
    }
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return

      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return
      drag.moved = true
      setIsDragging(true)
      event.preventDefault()

      const button = buttonRef.current
      const next = clampPosition(
        { top: event.clientY - drag.offsetY, left: event.clientX - drag.offsetX },
        button?.offsetWidth ?? 140,
        button?.offsetHeight ?? 44,
      )
      setPosition(next)
    }

    const handlePointerUp = (event: PointerEvent) => finishDrag(event.pointerId)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [finishDrag])

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
  }

  if (!user) return null
  const needsCare = pet ? Math.min(pet.hunger_status, pet.walk_status, pet.attention_status) < 80 : false

  const button = (
    <button
      ref={buttonRef}
      type="button"
      onPointerDown={startDrag}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (suppressClickRef.current) return
        if (isBroadcastSurface) {
          setIsShelterOpen(true)
        } else {
          void navigate('/troll-animal-shelter')
        }
      }}
      aria-label={pet ? `Open ${pet.name} pet care` : 'Open Troll Animal Shelter'}
      title="Drag to move"
      className={`fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-[9999] flex touch-none items-center gap-2 rounded-full border border-cyan-300/35 bg-slate-950/90 px-3 py-2 text-xs font-black text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.22)] backdrop-blur-xl pointer-events-auto md:bottom-6 md:right-6 ${isDragging ? 'cursor-grabbing' : 'cursor-grab transition hover:scale-105'}`}
      style={position ? { top: position.top, left: position.left, bottom: 'auto', right: 'auto' } : undefined}
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
