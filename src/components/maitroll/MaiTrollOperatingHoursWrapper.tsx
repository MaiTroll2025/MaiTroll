import React, { useCallback, useEffect, useState } from 'react'
import { MaiTrollOperatingState } from '@/lib/maitrollOperatingHours'
import { useMaiTrollOperatingHours } from '@/lib/maitrollOperatingStore'
import { useAuthStore } from '@/lib/store'
import { UserRole } from '@/lib/supabase'
import { SleepingTrollBedroom } from './SleepingTrollBedroom'
import { ClosingWarning } from './ClosingWarning'
import { TrollWakeUpAnimation } from './TrollWakeUpAnimation'

interface MaiTrollOperatingHoursWrapperProps {
  /**
   * The children to render when MaiTroll is open or for staff.
   * Typically the homepage content.
   */
  children: React.ReactNode

  /**
   * Optional callback when the operating state changes.
   */
  onStateChange?: (state: MaiTrollOperatingState) => void
}

export function MaiTrollOperatingHoursWrapper({
  children,
  onStateChange,
}: MaiTrollOperatingHoursWrapperProps) {
  const { profile } = useAuthStore()
  const { state, isOpen, isClosed, isClosingSoon } = useMaiTrollOperatingHours()

  const [showWakeUpAnimation, setShowWakeUpAnimation] = useState(false)
  const [previousState, setPreviousState] = useState<MaiTrollOperatingState | null>(null)

  // Determine if current user is authorized staff
  const isStaff = !!(
    profile?.is_admin ||
    profile?.is_lead_officer ||
    profile?.is_troll_officer ||
    profile?.role === UserRole.ADMIN
  )

  // Handle state changes and wake-up animation trigger
  useEffect(() => {
    if (state === previousState) return

    onStateChange?.(state)
    setPreviousState(state)

    // Trigger wake-up animation when transitioning from CLOSED to OPEN
    if (previousState === MaiTrollOperatingState.CLOSED && state === MaiTrollOperatingState.OPEN && !isStaff) {
      setShowWakeUpAnimation(true)
    }
  }, [state, previousState, isStaff, onStateChange])

  // Handle wake-up animation completion
  const handleWakeUpComplete = useCallback(() => {
    setShowWakeUpAnimation(false)
  }, [])

  // Show wake-up animation (overlays everything)
  if (showWakeUpAnimation && !isStaff) {
    return <TrollWakeUpAnimation onAnimationComplete={handleWakeUpComplete} />
  }

  // Staff always see normal UI (no bedroom, no warning)
  if (isStaff) {
    return <>{children}</>
  }

  // Closing soon: show warning + children
  if (isClosingSoon) {
    return (
      <>
        <ClosingWarning position="top" dismissible={true} />
        {children}
      </>
    )
  }

  // Closed: show sleeping bedroom
  if (isClosed) {
    return <SleepingTrollBedroom isStaff={false} />
  }

  // Open: show normal UI
  return <>{children}</>
}

export default MaiTrollOperatingHoursWrapper
