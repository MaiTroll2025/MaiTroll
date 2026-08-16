import React, { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, SkipForward } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBroadcastTutorial, BROADCAST_TUTORIAL_STEPS, TutorialStep } from '../../hooks/useBroadcastTutorial'

interface SpotlightOverlayProps {
  targetId: string | null
  onTargetClick: () => void
  pulse?: boolean
}

function SpotlightOverlay({ targetId, onTargetClick, pulse }: SpotlightOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!targetId) {
      setRect(null)
      return
    }
    const el = document.querySelector(`[data-tutorial-id="${targetId}"]`)
    if (!el) {
      setRect(null)
      return
    }
    const update = () => {
      const r = el.getBoundingClientRect()
      setRect(r)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [targetId])

  if (!rect) return null

  const padding = 8
  const top = rect.top - padding
  const left = rect.left - padding
  const width = rect.width + padding * 2
  const height = rect.height + padding * 2

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute bg-black/70"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={(e) => {
          e.stopPropagation()
        }}
      />
      <div
        className={cn(
          'absolute rounded-2xl border-2 border-white/40 shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all duration-300',
          pulse && 'animate-pulse'
        )}
        style={{ top, left, width, height }}
        onClick={(e) => {
          e.stopPropagation()
          onTargetClick()
        }}
      />
    </div>
  )
}

interface BroadcastTutorialProps {
  isLive: boolean
  isHost: boolean
  onControlClick?: (controlId: string) => void
}

export default function BroadcastTutorial({ isLive, isHost, onControlClick }: BroadcastTutorialProps) {
  const { active, currentStep, currentStepIndex, totalSteps, isCompleted, advanceStep, skipTutorial } =
    useBroadcastTutorial()

  const tooltipRef = useRef<HTMLDivElement>(null)

  const handleTargetClick = useCallback(() => {
    if (!currentStep) return
    if (onControlClick) onControlClick(currentStep.dataTutorialId)
    advanceStep()
  }, [currentStep, advanceStep, onControlClick])

  const handleBack = useCallback(() => {
    // tutorial only goes forward; back is a no-op in this simple version
  }, [])

  useEffect(() => {
    if (!active || !currentStep) return
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement
      const tutorialTarget = target.closest(`[data-tutorial-id="${currentStep.dataTutorialId}"]`)
      if (tutorialTarget) {
        e.preventDefault()
        e.stopPropagation()
        handleTargetClick()
      }
    }
    window.addEventListener('click', handler, true)
    window.addEventListener('touchend', handler, true)
    return () => {
      window.removeEventListener('click', handler, true)
      window.removeEventListener('touchend', handler, true)
    }
  }, [active, currentStep, handleTargetClick])

  if (!active || !isHost || !isLive || isCompleted) return null

  if (!currentStep) return null

  return createPortal(
    <>
      <SpotlightOverlay targetId={currentStep.dataTutorialId} onTargetClick={handleTargetClick} pulse />
      <div
        ref={tooltipRef}
        className="fixed z-[80] w-[300px] max-w-[calc(100vw-32px)] rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur-xl"
        style={{
          bottom: '120px',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
          <button
            onClick={skipTutorial}
            className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-white"
          >
            Skip Tutorial
          </button>
        </div>
        <h3 className="text-lg font-bold text-white">{currentStep.controlName}</h3>
        <p className="mt-1 text-sm text-slate-300">{currentStep.explanation}</p>
        <p className="mt-2 text-xs text-cyan-400 font-medium">{currentStep.tapMessage}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i <= currentStepIndex ? 'bg-cyan-400 w-4' : 'bg-white/10 w-2'
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              disabled={currentStepIndex === 0}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={skipTutorial}
              className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
