/**
 * MaiTroll Operating State Store
 * 
 * Manages real-time updates to the MaiTroll operating state
 * Automatically updates every second and handles state transitions
 */

import React from 'react'
import { create } from 'zustand'
import {
  getChicagoTime,
  getMaiTrollOperatingState,
  getOperatingHoursInfo,
  MaiTrollOperatingState,
  type OperatingHoursInfo,
} from '@/lib/maitrollOperatingHours'

interface MaiTrollOperatingStore {
  operatingHoursInfo: OperatingHoursInfo | null
  isAuthorizedStaff: boolean
  lastUpdateTime: number | null
  updateOperatingState: (isAuthorizedStaff?: boolean) => void
  setAuthorizedStaff: (isStaff: boolean) => void
}

export const useMaiTrollOperatingStore = create<MaiTrollOperatingStore>((set, get) => ({
  operatingHoursInfo: null,
  isAuthorizedStaff: false,
  lastUpdateTime: null,

  updateOperatingState: (isAuthorizedStaff?: boolean) => {
    const state = get()
    const staffStatus = isAuthorizedStaff !== undefined ? isAuthorizedStaff : state.isAuthorizedStaff
    const now = Date.now()

    // Don't update too frequently (max every 100ms)
    if (state.lastUpdateTime && now - state.lastUpdateTime < 100) {
      return
    }

    try {
      const currentTime = getChicagoTime()
      const info = getOperatingHoursInfo(currentTime, staffStatus)

      set({
        operatingHoursInfo: info,
        isAuthorizedStaff: staffStatus,
        lastUpdateTime: now,
      })
    } catch (error) {
      console.error('[MaiTrollOperatingStore] Failed to update operating state:', error)
    }
  },

  setAuthorizedStaff: (isStaff: boolean) => {
    set({ isAuthorizedStaff: isStaff })
    get().updateOperatingState(isStaff)
  },
}))

/**
 * Hook to use MaiTroll operating hours info
 * Automatically updates every second
 */
export function useMaiTrollOperatingHours() {
  const store = useMaiTrollOperatingStore()
  const [mounted, setMounted] = React.useState(false)

  // Initialize on mount
  React.useEffect(() => {
    setMounted(true)
    store.updateOperatingState()
  }, [])

  // Set up interval for real-time updates
  React.useEffect(() => {
    if (!mounted) return

    const interval = setInterval(() => {
      store.updateOperatingState()
    }, 1000)

    return () => clearInterval(interval)
  }, [mounted])

  return {
    operatingHoursInfo: store.operatingHoursInfo,
    isOpen: store.operatingHoursInfo?.isOpen ?? false,
    isClosed: store.operatingHoursInfo?.isClosed ?? false,
    isClosingSoon: store.operatingHoursInfo?.isClosingSoon ?? false,
    state: store.operatingHoursInfo?.state ?? MaiTrollOperatingState.CLOSED,
    countdownToOpen: store.operatingHoursInfo?.countdownToOpen ?? '00:00:00',
    countdownToClose: store.operatingHoursInfo?.countdownToClose ?? '00:00:00',
  }
}
