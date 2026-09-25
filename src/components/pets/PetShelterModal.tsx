import { X } from 'lucide-react'
import PetShelterPanel from './PetShelterPanel'

interface PetShelterModalProps {
  onClose: () => void
}

export default function PetShelterModal({ onClose }: PetShelterModalProps) {
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Troll Animal Shelter"
      onClick={onClose}
    >
      <div
        className="relative max-h-[min(90dvh,760px)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-cyan-300/20 bg-[#050714] shadow-[0_0_60px_rgba(34,211,238,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Close Troll Animal Shelter"
        >
          <X className="h-5 w-5" />
        </button>
        <PetShelterPanel compact />
      </div>
    </div>
  )
}
