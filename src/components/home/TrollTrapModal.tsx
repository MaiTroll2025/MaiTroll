import React, { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { X, Gamepad2 } from 'lucide-react'

interface TrollTrapModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function TrollTrapModal({ isOpen, onClose }: TrollTrapModalProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousActiveRef = useRef<HTMLElement | null>(null)
  const xpAwardedRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return

    previousActiveRef.current = document.activeElement as HTMLElement | null

    const dialog = dialogRef.current
    if (!dialog) return

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length > 0) {
      focusable[0].focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key !== 'Tab' || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      previousActiveRef.current?.focus()
    }
  }, [isOpen, onClose])

  const awardTrollXP = useCallback(async () => {
    if (!user?.id || xpAwardedRef.current) return
    xpAwardedRef.current = true

    try {
      await supabase.rpc('grant_xp', {
        p_user_id: user.id,
        p_amount: 10,
        p_source: 'troll_trap',
        p_source_id: `troll_trap_${Date.now()}`,
      })
      toast.success('+10 XP for falling for the troll trap!')
    } catch {
      // silent
    }
  }, [user?.id])

  useEffect(() => {
    if (isOpen && user?.id) {
      awardTrollXP()
    }
  }, [isOpen, user?.id, awardTrollXP])

  const handleGoLive = useCallback(() => {
    onClose()
    navigate('/broadcast/setup')
  }, [navigate, onClose])

  const handleBrowse = useCallback(() => {
    onClose()
  }, [onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)', paddingTop: 'env(safe-area-inset-top, 16px)' }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="troll-modal-title"
        aria-describedby="troll-modal-desc"
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#070b19]/95 shadow-[0_0_60px_rgba(168,85,247,0.15)]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-[#070b19] to-cyan-900/30" />

        <button
          ref={closeButtonRef}
          onClick={handleBrowse}
          type="button"
          aria-label="Close troll trap modal"
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex flex-col items-center p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-pink-400/30 bg-pink-500/10 shadow-[0_0_24px_rgba(236,72,153,0.35)]">
            <Gamepad2 className="h-8 w-8 text-pink-300" />
          </div>

          <h2 id="troll-modal-title" className="mt-4 text-xl font-black text-white">
            You got trolled 😈
          </h2>
          <p id="troll-modal-desc" className="mt-2 text-xs font-bold text-white/60">
            Nobody is live right now. Be the first broadcaster to wake up Troll City.
          </p>

          <div className="mt-6 flex w-full flex-col gap-2.5">
            <button
              onClick={handleGoLive}
              type="button"
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-4 py-3 text-sm font-black text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]"
            >
              Go Live Now
            </button>
            <button
              onClick={handleBrowse}
              type="button"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Browse Troll City
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
