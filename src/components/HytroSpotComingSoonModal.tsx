import React, { useEffect, useRef } from 'react'
import { X, Mic, Zap, Trophy, Vote, Coins, Star } from 'lucide-react'
import { createPortal } from 'react-dom'

interface HytroSpotComingSoonModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function HytroSpotComingSoonModal({ isOpen, onClose }: HytroSpotComingSoonModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`
      modalRef.current?.focus()
      const buttons = document.querySelectorAll('[data-hytrospot-trigger]')
      if (buttons.length > 0) {
        triggerButtonRef.current = buttons[0] as HTMLButtonElement
      }
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      if (previousActiveElement.current) {
        previousActiveElement.current.focus()
      } else if (triggerButtonRef.current) {
        triggerButtonRef.current.focus()
      }
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hytrospot-title"
      aria-describedby="hytrospot-description"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-slate-950 via-purple-950/50 to-slate-950 shadow-[0_0_60px_rgba(34,211,238,0.25),0_30px_80px_rgba(0,0,0,0.6)] animate-in zoom-in-95 fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.15),transparent_50%),radial-gradient(ellipse_at_50%_100%,rgba(168,85,247,0.1),transparent_50%)] rounded-3xl pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-24 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 rounded-b-full opacity-60" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
          aria-label="Close HytroSpot preview"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative p-6 md:p-8 text-center">
          <div className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/30 via-purple-500/20 to-pink-400/30 blur-2xl animate-pulse" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900 border border-cyan-300/30 shadow-[0_0_40px_rgba(34,211,238,0.3),inset_0_0_40px_rgba(168,85,247,0.1)]">
              <Mic className="h-14 w-14 text-white drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]" aria-hidden="true" />
            </div>
            <div className="absolute -top-2 -right-2 h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
          </div>

          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-300 uppercase tracking-[0.1em] shadow-[0_0_15px_rgba(251,191,36,0.2)]">
              <Zap className="h-3 w-3" />
              COMING SOON
            </span>
          </div>

          <h1 id="hytrospot-title" className="mb-2 text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
            HYTROSPOT
          </h1>
          <p id="hytrospot-description" className="mb-6 text-lg font-bold text-cyan-200/90 uppercase tracking-[0.05em]">
            YOUR TALENT. YOUR MOMENT. YOUR SPOTLIGHT.
          </p>
          <p className="mb-2 text-sm font-bold text-amber-300/80 uppercase tracking-[0.1em]">
            COMING SOON TO MAI TROLL
          </p>

          <div className="mb-6 text-left">
            <p className="text-slate-300/80 leading-relaxed">
              Get ready for HytroSpot, Mai Troll&apos;s upcoming live talent-show experience where creators can showcase their talents, compete live, and earn recognition.
            </p>
          </div>

          <div className="mb-6 text-left space-y-3">
            <p className="text-sm font-black text-white uppercase tracking-[0.05em]">What&apos;s coming?</p>
            <div className="space-y-3">
              {[
                { icon: Mic, title: 'Live Talent Competitions', desc: 'Perform and showcase your skills.' },
                { icon: Trophy, title: 'Judges & Awards', desc: 'Compete for recognition and celebrate winners.' },
                { icon: Star, title: 'Discover Rising Stars', desc: 'Help talented creators get noticed.' },
                { icon: Vote, title: 'Audience Voting', desc: 'Support your favorite contestants.' },
                { icon: Coins, title: 'Troll Coin Integration', desc: 'Participate through Mai Troll&apos;s existing coin ecosystem, subject to applicable rules.' },
              ].map((feature, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-2xl border border-white/5 bg-white/[0.03] transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.04]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20">
                    <feature.icon className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{feature.title}</p>
                    <p className="text-xs text-slate-400">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6 p-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 text-left">
            <p className="text-cyan-100 font-bold leading-relaxed">
              Your talent deserves a spotlight. Get ready!
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 px-6 py-4 text-base font-black text-white shadow-[0_0_30px_rgba(34,211,238,0.4)] transition hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(34,211,238,0.5)] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Sounds Exciting!
            </button>
            <p className="text-xs text-slate-500">
              HytroSpot is currently in development. Stay tuned for updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}