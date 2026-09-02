/**
 * Closing Warning Component
 * 
 * Appears when MaiTroll is in CLOSING_SOON state (5 minutes before 2:00 AM)
 * Warns users that MaiTroll is closing soon
 */

import React, { useEffect, useState } from 'react'
import { AlertTriangle, Clock } from 'lucide-react'
import { getChicagoTime, getSecondsUntilClose } from '@/lib/maitrollOperatingHours'

interface ClosingWarningProps {
  onClosed?: () => void
  dismissible?: boolean
  position?: 'top' | 'bottom' | 'center'
}

export function ClosingWarning({
  onClosed,
  dismissible = true,
  position = 'top',
}: ClosingWarningProps) {
  const [secondsUntilClose, setSecondsUntilClose] = useState<number>(0)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    if (isDismissed) return

    const updateCountdown = () => {
      const seconds = getSecondsUntilClose(getChicagoTime())
      setSecondsUntilClose(seconds)

      // If countdown reaches zero, trigger closed callback
      if (seconds <= 0 && onClosed) {
        onClosed()
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [isDismissed, onClosed])

  if (isDismissed) return null

  const minutes = Math.floor(secondsUntilClose / 60)
  const seconds = secondsUntilClose % 60

  const positionClasses = {
    top: 'top-4 left-1/2 transform -translate-x-1/2',
    bottom: 'bottom-4 left-1/2 transform -translate-x-1/2',
    center: 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
  }

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 px-6 py-4 rounded-lg border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-900/80 via-orange-900/80 to-red-900/80 backdrop-blur-xl shadow-2xl shadow-yellow-500/20 max-w-md`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          <AlertTriangle className="w-6 h-6 text-yellow-300 animate-pulse" />
        </div>

        <div className="flex-1">
          {/* Main message */}
          <h3 className="text-lg font-bold text-yellow-200 mb-2">⚠️ MaiTroll is Closing Soon</h3>

          <p className="text-yellow-100/80 text-sm mb-3">
            The trolls have {minutes > 0 ? `${minutes} minute${minutes !== 1 ? 's' : ''}` : 'less than a minute'} before bedtime.
          </p>

          {/* Countdown timer */}
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-orange-300" />
            <span className="font-mono text-base font-bold text-orange-300">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>

          {/* Info text */}
          <p className="text-yellow-100/60 text-xs">
            Save your progress and prepare for the sleep cycle. Broadcasts will end at 2:00 AM.
          </p>
        </div>

        {/* Close button */}
        {dismissible && (
          <button
            onClick={() => setIsDismissed(true)}
            className="flex-shrink-0 text-yellow-300 hover:text-yellow-100 transition-colors p-1"
            aria-label="Dismiss closing warning"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Warning glow effect */}
      <div className="absolute inset-0 rounded-lg opacity-20 bg-gradient-to-r from-yellow-500 to-red-500 blur-md -z-10"></div>
    </div>
  )
}

export default ClosingWarning
