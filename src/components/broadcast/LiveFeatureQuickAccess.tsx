import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ShieldCheck, X } from 'lucide-react'

type LiveFeature = 'insurance'

const LIVE_FEATURES: Record<LiveFeature, { label: string; path: string; icon: typeof ShieldCheck }> = {
  insurance: { label: 'Insurance', path: '/insurance', icon: ShieldCheck },
}

export default function LiveFeatureQuickAccess() {
  const [activeFeature, setActiveFeature] = useState<LiveFeature | null>(null)

  const feature = activeFeature ? LIVE_FEATURES[activeFeature] : null

  return (
    <>
      <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+5.5rem)] z-[75] flex flex-col gap-2">
        {(Object.entries(LIVE_FEATURES) as [LiveFeature, typeof LIVE_FEATURES[LiveFeature]][]).map(([key, item]) => {
          const Icon = item.icon
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFeature(key)}
              className="flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-slate-950/85 px-3 text-xs font-bold text-white shadow-lg backdrop-blur-md"
              aria-label={`Open ${item.label} without leaving the live session`}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {feature && createPortal(
        <div className="fixed inset-0 z-[10000] flex flex-col bg-black">
          <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-white/10 bg-slate-950 px-4 text-white">
            <h2 className="text-sm font-bold">{feature.label}</h2>
            <button
              type="button"
              onClick={() => setActiveFeature(null)}
              className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10"
              aria-label={`Close ${feature.label} and return to the live session`}
            >
              <X size={20} />
            </button>
          </div>
          <iframe
            key={feature.path}
            src={feature.path}
            title={feature.label}
            className="min-h-0 flex-1 border-0 bg-black"
          />
        </div>,
        document.body,
      )}
    </>
  )
}
