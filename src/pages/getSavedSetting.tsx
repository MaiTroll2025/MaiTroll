import React, { createContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { applyBatterySaverClass, isRealtimeRoute } from '../lib/performanceMode'

export type BatterySaverSetting = 'auto' | 'on' | 'off'
export type BatterySaverMode = 'normal' | 'reduced' | 'ultra'

export interface BatterySaverContextValue {
  setting: BatterySaverSetting
  setSetting: (value: BatterySaverSetting) => void
  effectiveMode: BatterySaverMode
  isBatterySaverOn: boolean
  isUltraMode: boolean
  batteryLevel: number | null
  charging: boolean | null
  saveData: boolean
  isPageHidden: boolean
  isMobileWidth: boolean
  isStandalonePWA: boolean
  isStreamRoute: boolean
  isViewerOnlyStreamRoute: boolean
  isBroadcasterRoute: boolean
  shouldReduceAnimations: boolean
  shouldReduceRealtime: boolean
  shouldReducePolling: boolean
  shouldReduceVideoQuality: boolean
  shouldPauseNonEssentialWork: boolean
  getRealtimeThrottleMs: (defaultMs: number) => number
  getPollingInterval: (defaultMs: number) => number
}

const STORAGE_KEY = 'tc_battery_saver_mode'

const defaultContextValue: BatterySaverContextValue = {
  setting: 'auto',
  setSetting: () => {},
  effectiveMode: 'normal',
  isBatterySaverOn: false,
  isUltraMode: false,
  batteryLevel: null,
  charging: null,
  saveData: false,
  isPageHidden: false,
  isMobileWidth: false,
  isStandalonePWA: false,
  isStreamRoute: false,
  isViewerOnlyStreamRoute: false,
  isBroadcasterRoute: false,
  shouldReduceAnimations: false,
  shouldReduceRealtime: false,
  shouldReducePolling: false,
  shouldReduceVideoQuality: false,
  shouldPauseNonEssentialWork: false,
  getRealtimeThrottleMs: (defaultMs) => defaultMs,
  getPollingInterval: (defaultMs) => defaultMs,
}

const BatterySaverContext = createContext<BatterySaverContextValue>(defaultContextValue)

const getSavedSetting = (): BatterySaverSetting => {
  if (typeof window === 'undefined') return 'auto'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'on' || raw === 'off' || raw === 'auto') return raw
  } catch {
    // ignore
  }
  return 'auto'
}

const getIsStandalone = () => {
  if (typeof window === 'undefined') return false
  const nav = navigator as any
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    nav?.standalone === true
  )
}

const MOBILE_WIDTH_BREAKPOINT = 900

export function BatterySaverProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [setting, setSetting] = useState<BatterySaverSetting>(getSavedSetting)
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const [charging, setCharging] = useState<boolean | null>(null)
  const [saveData, setSaveData] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false
    return !!(navigator as any)?.connection?.saveData
  })
  const [isPageHidden, setIsPageHidden] = useState<boolean>(
    typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false
  )
  const [isMobileWidth, setIsMobileWidth] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_WIDTH_BREAKPOINT : false
  )
  const [isStandalonePWA, setIsStandalonePWA] = useState<boolean>(getIsStandalone())

  const pathname = location.pathname
  const isStreamRoute = useMemo(
    () => isRealtimeRoute(pathname) || pathname.startsWith('/broadcast/'),
    [pathname]
  )

  const isViewerOnlyStreamRoute = useMemo(() => {
    if (pathname.startsWith('/watch/')) return true
    if (pathname.startsWith('/live')) return true
    if (pathname.startsWith('/stream')) return true
    return false
  }, [pathname])

  const isBroadcasterRoute = useMemo(() => {
    if (!pathname.startsWith('/broadcast/')) return false
    return pathname !== '/broadcast/setup' && !pathname.startsWith('/broadcast/summary')
  }, [pathname])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, setting)
    } catch {
      // ignore storage write failures
    }
  }, [setting])

  useEffect(() => {
    const updateHidden = () => setIsPageHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', updateHidden)
    return () => document.removeEventListener('visibilitychange', updateHidden)
  }, [])

  useEffect(() => {
    const updateSaveData = () => {
      const connection = (navigator as any)?.connection
      setSaveData(!!connection?.saveData)
    }

    updateSaveData()
    const connection = (navigator as any)?.connection
    if (connection && typeof connection.addEventListener === 'function') {
      connection.addEventListener('change', updateSaveData)
    }
    return () => {
      if (connection && typeof connection.removeEventListener === 'function') {
        connection.removeEventListener('change', updateSaveData)
      }
    }
  }, [])

  useEffect(() => {
    const updateWidth = () => setIsMobileWidth(window.innerWidth <= MOBILE_WIDTH_BREAKPOINT)
    const updateStandalone = () => setIsStandalonePWA(getIsStandalone())

    window.addEventListener('resize', updateWidth)
    window.addEventListener('DOMContentLoaded', updateStandalone)
    window.addEventListener('load', updateStandalone)

    return () => {
      window.removeEventListener('resize', updateWidth)
      window.removeEventListener('DOMContentLoaded', updateStandalone)
      window.removeEventListener('load', updateStandalone)
    }
  }, [])

  useEffect(() => {
    if (!(navigator as any)?.getBattery) return undefined
    let cancelled = false
    let battery: any = null
    const handleBatteryUpdate = () => {
      if (!battery || cancelled) return
      setBatteryLevel(typeof battery.level === 'number' ? battery.level : null)
      setCharging(typeof battery.charging === 'boolean' ? battery.charging : null)
    }

    (navigator as any).getBattery().then((bat) => {
      if (cancelled) return
      battery = bat
      handleBatteryUpdate()
      // Use on* property assignment for cross-browser compatibility
      // (Firefox/Safari may not support addEventListener on BatteryManager)
      if (typeof battery.addEventListener === 'function') {
        battery.addEventListener('levelchange', handleBatteryUpdate)
        battery.addEventListener('chargingchange', handleBatteryUpdate)
      } else {
        battery.onlevelchange = handleBatteryUpdate
        battery.onchargingchange = handleBatteryUpdate
      }
    }).catch(() => {
      // Battery API unavailable or denied
    })

    return () => {
      cancelled = true
      if (battery) {
        if (typeof battery.removeEventListener === 'function') {
          battery.removeEventListener('levelchange', handleBatteryUpdate)
          battery.removeEventListener('chargingchange', handleBatteryUpdate)
        } else {
          battery.onlevelchange = null
          battery.onchargingchange = null
        }
      }
    }
  }, [])

  const effectiveMode = useMemo<BatterySaverMode>(() => {
    if (setting === 'on') return 'reduced'
    if (setting === 'off') return 'normal'

    if (isPageHidden) return 'ultra'
    if (saveData) return 'reduced'
    if (isMobileWidth && isStandalonePWA && batteryLevel !== null && batteryLevel < 0.25) return 'ultra'
    if (isMobileWidth && batteryLevel !== null && batteryLevel < 0.25) return 'ultra'
    if (isMobileWidth && batteryLevel !== null && batteryLevel < 0.45) return 'reduced'
    if (isMobileWidth && !isStandalonePWA && batteryLevel === null && saveData) return 'reduced'
    if (isViewerOnlyStreamRoute) return 'reduced'
    if (isBroadcasterRoute && batteryLevel !== null && batteryLevel < 0.20) return 'reduced'
    return 'normal'
  }, [setting, saveData, isPageHidden, isMobileWidth, isStandalonePWA, batteryLevel, isViewerOnlyStreamRoute, isBroadcasterRoute])

  useEffect(() => {
    applyBatterySaverClass(effectiveMode)
  }, [effectiveMode])

  const isBatterySaverOn = useMemo(() => setting === 'on' || effectiveMode !== 'normal', [setting, effectiveMode])
  const isUltraMode = effectiveMode === 'ultra'
  const shouldReduceAnimations = effectiveMode !== 'normal'
  const shouldReduceRealtime = effectiveMode !== 'normal'
  const shouldReducePolling = effectiveMode !== 'normal'
  const shouldReduceVideoQuality = effectiveMode !== 'normal'
  const shouldPauseNonEssentialWork = effectiveMode === 'ultra'

  const getRealtimeThrottleMs = (defaultMs: number) => {
    if (effectiveMode === 'normal') return defaultMs
    if (effectiveMode === 'reduced') return Math.max(Math.round(defaultMs * 2), 15000)
    return Math.max(Math.round(defaultMs * 4), 30000)
  }

  const getPollingInterval = (defaultMs: number) => {
    if (effectiveMode === 'normal') return defaultMs
    if (effectiveMode === 'reduced') return Math.max(Math.round(defaultMs * 2.5), 15000)
    return Math.max(Math.round(defaultMs * 6), 60000)
  }

  const value: BatterySaverContextValue = {
    setting,
    setSetting,
    effectiveMode,
    isBatterySaverOn,
    isUltraMode,
    batteryLevel,
    charging,
    saveData,
    isPageHidden,
    isMobileWidth,
    isStandalonePWA,
    isStreamRoute,
    isViewerOnlyStreamRoute,
    isBroadcasterRoute,
    shouldReduceAnimations,
    shouldReduceRealtime,
    shouldReducePolling,
    shouldReduceVideoQuality,
    shouldPauseNonEssentialWork,
    getRealtimeThrottleMs,
    getPollingInterval,
  }

  return <BatterySaverContext.Provider value={value}>{children}</BatterySaverContext.Provider>
}

export { BatterySaverContext }
