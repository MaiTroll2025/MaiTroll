import { Suspense, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { neonBar, neonTextGradient } from '../phoneTheme'
import { cn } from '@/lib/utils'

interface PhoneWebEmbedProps {
  Component: ComponentType<any>
  title?: string
  showBack?: boolean
  backTo?: string
  /** When true, render only the web page without the phone header chrome. */
  bare?: boolean
}

/**
 * Embeds an existing web page (src/pages/*) inside the phone chrome.
 * Phone pages that are currently placeholders should use this helper so they
 * share the same data, queries, and UI as the desktop version while keeping
 * a consistent phone-styled back navigation.
 */
export default function PhoneWebEmbed({
  Component,
  title,
  showBack = true,
  backTo,
  bare = false,
}: PhoneWebEmbedProps) {
  const navigate = useNavigate()
  const handleBack = () => (backTo ? navigate(backTo) : navigate(-1))

  if (bare) {
    return (
      <Suspense fallback={<CenteredLoader />}>
        <Component />
      </Suspense>
    )
  }

  return (
    <div className="relative min-h-screen w-full bg-[#05010f] text-white">
      <header
        className={cn(
          'sticky top-0 z-40 flex items-center justify-between px-4 py-3 backdrop-blur-2xl',
          neonBar,
        )}
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div className="w-9" />
        )}
        <h1 className={cn('text-sm font-black uppercase tracking-widest', neonTextGradient)}>
          {title || ''}
        </h1>
        <div className="w-9" />
      </header>
      <div className="pb-20">
        <Suspense fallback={<CenteredLoader />}>
          <Component />
        </Suspense>
      </div>
    </div>
  )
}

export function CenteredLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
    </div>
  )
}
