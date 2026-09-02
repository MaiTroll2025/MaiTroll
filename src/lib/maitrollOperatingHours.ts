/**
 * MaiTroll Operating Hours System
 *
 * Public operating hours:
 *   OPEN:   10:00 AM → 2:00 AM America/Chicago
 *   CLOSED: 2:00 AM → 10:00 AM America/Chicago
 *
 * Closing warning:
 *   1:55 AM → 2:00 AM
 *
 * Authorized staff:
 *   24/7 access
 *
 * IMPORTANT:
 * The frontend uses this utility for display and state presentation.
 * Server-side enforcement must remain authoritative for protected actions.
 */

export enum MaiTrollOperatingState {
  OPEN = 'OPEN',
  CLOSING_SOON = 'CLOSING_SOON',
  CLOSED = 'CLOSED',
  STAFF_BYPASS = 'STAFF_BYPASS',
}

const TIME_ZONE = 'America/Chicago'

const OPEN_HOUR = 10
const OPEN_MINUTE = 0

const CLOSE_HOUR = 2
const CLOSE_MINUTE = 0

const CLOSING_WARNING_MINUTES = 5

/**
 * Get the current time represented in America/Chicago.
 * Supports development time override via window.__MAITROLL_DEV.timeOverride
 */
export function getChicagoTime(): Date {
  // Check for development time override
  if (typeof window !== 'undefined' && window.__MAITROLL_DEV?.timeOverride) {
    return window.__MAITROLL_DEV.timeOverride
  }

  const chicagoTime = new Date().toLocaleString('en-US', {
    timeZone: TIME_ZONE,
  })

  return new Date(chicagoTime)
}

declare global {
  interface Window {
    __MAITROLL_DEV?: {
      timeOverride?: Date
    } | null
  }
}

/**
 * Get hours and minutes from a date in Chicago time.
 */
function getChicagoHourMinutes(
  date: Date,
): { hours: number; minutes: number } {
  const chicagoString = date.toLocaleString('en-US', {
    timeZone: TIME_ZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })

  const [hours, minutes] = chicagoString.split(':').map(Number)

  return {
    hours,
    minutes,
  }
}

/**
 * Convert hours/minutes to total minutes.
 */
function timeToMinutes(
  hours: number,
  minutes = 0,
): number {
  return hours * 60 + minutes
}

/**
 * MaiTroll opens at 10:00 AM and closes at 2:00 AM.
 *
 * Because the schedule crosses midnight:
 *
 * OPEN:
 *   10:00 AM → 11:59 PM
 *   12:00 AM → 1:59 AM
 *
 * CLOSED:
 *   2:00 AM → 9:59 AM
 */
export function isMaiTrollOpen(
  date: Date = getChicagoTime(),
): boolean {
  const { hours, minutes } = getChicagoHourMinutes(date)

  const currentMinutes = timeToMinutes(hours, minutes)

  const openingTime = timeToMinutes(
    OPEN_HOUR,
    OPEN_MINUTE,
  )

  const closingTime = timeToMinutes(
    CLOSE_HOUR,
    CLOSE_MINUTE,
  )

  if (currentMinutes >= openingTime) {
    return true
  }

  if (currentMinutes < closingTime) {
    return true
  }

  return false
}

/**
 * Check whether MaiTroll is in the five-minute closing warning.
 *
 * Warning:
 *   1:55 AM → 1:59 AM
 *
 * At exactly 2:00 AM the state becomes CLOSED.
 */
export function isClosingSoon(
  date: Date = getChicagoTime(),
): boolean {
  const { hours, minutes } = getChicagoHourMinutes(date)

  const currentMinutes = timeToMinutes(hours, minutes)

  const closingTime = timeToMinutes(
    CLOSE_HOUR,
    CLOSE_MINUTE,
  )

  const warningStartTime =
    closingTime - CLOSING_WARNING_MINUTES

  return (
    currentMinutes >= warningStartTime &&
    currentMinutes < closingTime
  )
}

/**
 * Get the current MaiTroll operating state.
 */
export function getMaiTrollOperatingState(
  date: Date = getChicagoTime(),
  isAuthorizedStaff = false,
): MaiTrollOperatingState {
  if (isAuthorizedStaff) {
    return MaiTrollOperatingState.STAFF_BYPASS
  }

  if (isClosingSoon(date)) {
    return MaiTrollOperatingState.CLOSING_SOON
  }

  if (isMaiTrollOpen(date)) {
    return MaiTrollOperatingState.OPEN
  }

  return MaiTrollOperatingState.CLOSED
}

/**
 * Get seconds until the next 10:00 AM opening.
 */
export function getSecondsUntilOpen(
  date: Date = getChicagoTime(),
): number {
  const { hours, minutes } = getChicagoHourMinutes(date)

  const currentMinutes = timeToMinutes(hours, minutes)
  const currentSeconds = date.getSeconds()

  const openingTime = timeToMinutes(
    OPEN_HOUR,
    OPEN_MINUTE,
  )

  let minutesUntilOpen: number

  if (currentMinutes < openingTime) {
    minutesUntilOpen =
      openingTime - currentMinutes
  } else {
    minutesUntilOpen =
      1440 - currentMinutes + openingTime
  }

  return Math.max(
    0,
    minutesUntilOpen * 60 - currentSeconds,
  )
}

/**
 * Get seconds until the next 2:00 AM closing.
 */
export function getSecondsUntilClose(
  date: Date = getChicagoTime(),
): number {
  const { hours, minutes } = getChicagoHourMinutes(date)

  const currentMinutes = timeToMinutes(hours, minutes)
  const currentSeconds = date.getSeconds()

  const closingTime = timeToMinutes(
    CLOSE_HOUR,
    CLOSE_MINUTE,
  )

  let minutesUntilClose: number

  if (currentMinutes < closingTime) {
    minutesUntilClose =
      closingTime - currentMinutes
  } else {
    minutesUntilClose =
      1440 - currentMinutes + closingTime
  }

  return Math.max(
    0,
    minutesUntilClose * 60 - currentSeconds,
  )
}

/**
 * Format seconds as HH:MM:SS.
 */
export function formatCountdown(
  seconds: number,
): string {
  const safeSeconds = Math.max(
    0,
    Math.floor(seconds),
  )

  const hours = Math.floor(
    safeSeconds / 3600,
  )

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60,
  )

  const secs = safeSeconds % 60

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(secs).padStart(2, '0'),
  ].join(':')
}

/**
 * Get the next opening time.
 *
 * Returns a Date representing 10:00 AM Chicago time
 * for the next applicable opening.
 */
export function getNextOpeningTime(
  date: Date = getChicagoTime(),
): Date {
  const { hours } = getChicagoHourMinutes(date)

  const chicagoDate = date.toLocaleDateString(
    'en-US',
    {
      timeZone: TIME_ZONE,
    },
  )

  const nextOpening = new Date(
    `${chicagoDate} 10:00:00`,
  )

  if (hours >= OPEN_HOUR) {
    nextOpening.setDate(
      nextOpening.getDate() + 1,
    )
  }

  return nextOpening
}

/**
 * Get the next closing time.
 *
 * Returns a Date representing 2:00 AM Chicago time
 * for the next applicable closing.
 */
export function getNextClosingTime(
  date: Date = getChicagoTime(),
): Date {
  const { hours } = getChicagoHourMinutes(date)

  const chicagoDate = date.toLocaleDateString(
    'en-US',
    {
      timeZone: TIME_ZONE,
    },
  )

  const nextClosing = new Date(
    `${chicagoDate} 02:00:00`,
  )

  if (hours >= CLOSE_HOUR) {
    nextClosing.setDate(
      nextClosing.getDate() + 1,
    )
  }

  return nextClosing
}

/**
 * Information about the current operating state.
 */
export interface OperatingHoursInfo {
  opensAt: string
  closesAt: string

  state: MaiTrollOperatingState

  isOpen: boolean
  isClosingSoon: boolean
  isClosed: boolean

  secondsUntilOpen: number
  secondsUntilClose: number

  countdownToOpen: string
  countdownToClose: string

  nextOpeningTime: Date
  nextClosingTime: Date
}

/**
 * Get complete operating-hours information.
 */
export function getOperatingHoursInfo(
  date: Date = getChicagoTime(),
  isAuthorizedStaff = false,
): OperatingHoursInfo {
  const state = getMaiTrollOperatingState(
    date,
    isAuthorizedStaff,
  )

  const isOpen =
    state === MaiTrollOperatingState.OPEN ||
    state === MaiTrollOperatingState.STAFF_BYPASS

  const closingSoon =
    state === MaiTrollOperatingState.CLOSING_SOON

  const closed =
    state === MaiTrollOperatingState.CLOSED

  const secondsUntilOpen =
    getSecondsUntilOpen(date)

  const secondsUntilClose =
    getSecondsUntilClose(date)

  return {
    opensAt: '10:00 AM',
    closesAt: '2:00 AM',

    state,

    isOpen,
    isClosingSoon: closingSoon,
    isClosed: closed,

    secondsUntilOpen,
    secondsUntilClose,

    countdownToOpen:
      formatCountdown(secondsUntilOpen),

    countdownToClose:
      formatCountdown(secondsUntilClose),

    nextOpeningTime:
      getNextOpeningTime(date),

    nextClosingTime:
      getNextClosingTime(date),
  }
}