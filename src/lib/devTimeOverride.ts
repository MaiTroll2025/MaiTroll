/**
 * Development Time Override Utility
 * 
 * DEVELOPMENT ONLY - Remove before production!
 * 
 * Allows testing different MaiTroll operating hours scenarios
 * by overriding the current Chicago time.
 * 
 * Usage in browser console:
 *   // Set to 1:59 AM (5 seconds before closing)
 *   window.__MAITROLL_DEV = { timeOverride: new Date(2026, 8, 1, 1, 59, 55) }
 * 
 *   // Set to 10:00 AM (opening time)
 *   window.__MAITROLL_DEV = { timeOverride: new Date(2026, 8, 1, 10, 0, 0) }
 * 
 *   // Set to 2:00 AM (closing time)
 *   window.__MAITROLL_DEV = { timeOverride: new Date(2026, 8, 1, 2, 0, 0) }
 * 
 *   // Clear override (back to real time)
 *   window.__MAITROLL_DEV = null
 */

declare global {
  interface Window {
    __MAITROLL_DEV?: {
      timeOverride?: Date
    } | null
  }
}

export function getDevTimeOverride(): Date | null {
  if (typeof window === 'undefined') return null
  
  const devConfig = window.__MAITROLL_DEV
  if (!devConfig?.timeOverride) return null
  
  console.log(
    '[MaiTroll DEV] Time override active:',
    devConfig.timeOverride.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'short',
      timeStyle: 'long',
    })
  )
  
  return devConfig.timeOverride
}

export function clearDevTimeOverride(): void {
  if (typeof window === 'undefined') return
  window.__MAITROLL_DEV = null
  console.log('[MaiTroll DEV] Time override cleared')
}

export function setDevTimeOverride(chicagoDate: Date): void {
  if (typeof window === 'undefined') return
  window.__MAITROLL_DEV = { timeOverride: chicagoDate }
  console.log(
    '[MaiTroll DEV] Time override set to:',
    chicagoDate.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'short',
      timeStyle: 'long',
    })
  )
}
