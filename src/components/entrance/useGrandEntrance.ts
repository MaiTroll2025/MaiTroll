// src/components/entrance/useGrandEntrance.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

/* ------------------------------------------------------------------ *
 * Storage keys & first-visit logic
 * ------------------------------------------------------------------ */
export const GRAND_ENTRANCE_SEEN_KEY = 'troll_city_grand_entrance_seen'
export const GRAND_ENTRANCE_FORCE_KEY = 'troll_city_grand_entrance_force'
export const GRAND_ENTRANCE_LAUNCH_KEY = 'troll_city_grand_entrance_launch'
export const JUST_LOGGED_IN_KEY = 'tc_just_logged_in'
export const REPLAY_EVENT = 'troll-city:replay-grand-entrance'

const HOME_PATHS = ['/', '/home']

/* Beta launch window — entrance is the official celebration for these 2 weeks */
const BETA_START = new Date('2026-07-13T00:00:00')
const BETA_END = new Date('2026-07-27T23:59:59')
const BETA_SEEN_KEY = 'troll_city_grand_entrance_beta_seen_v1'

function inBetaWindow(): boolean {
  const now = Date.now()
  return now >= BETA_START.getTime() && now <= BETA_END.getTime()
}

function readStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
  } catch {
    return null
  }
}

function isForcedParam(): boolean {
  if (typeof window === 'undefined') return false
  const v = new URLSearchParams(window.location.search).get('grand-entrance')
  const r = new URLSearchParams(window.location.search).get('replay-entrance')
  return v === '1' || r === '1'
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — fail silently */
  }
}

/* ------------------------------------------------------------------ *
 * Timing (milliseconds)
 * ------------------------------------------------------------------ */
const T_NORMAL = {
  doors: 500,
  welcome: 1000,
  title: 1400,
  subtitle: 1800,
  ribbon: 2300,
  scissors: 2800,
  cut: 3300,
  separate: 3600,
  opening: 3900,
  revealing: 5500,
  done: 6000,
}

const T_REDUCED = {
  show: 0,
  reveal: 1200,
  done: 1900,
}

/* ------------------------------------------------------------------ *
 * Lightweight synthesized audio (no asset files required)
 * ------------------------------------------------------------------ */
function useEntranceAudio() {
  const [enabled, setEnabled] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const enabledRef = useRef(false)
  enabledRef.current = enabled

  const ensureCtx = useCallback(() => {
    if (ctxRef.current) return ctxRef.current
    try {
      const Ctor =
        (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctor) return null
      ctxRef.current = new Ctor()
    } catch {
      ctxRef.current = null
    }
    return ctxRef.current
  }, [])

  const tone = useCallback(
    (freq: number, dur: number, type: OscillatorType, gain: number, when = 0) => {
      const ctx = ctxRef.current
      if (!ctx) return
      try {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = type
        osc.frequency.value = freq
        const t0 = ctx.currentTime + when
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.linearRampToValueAtTime(gain, t0 + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
        osc.connect(g)
        g.connect(ctx.destination)
        osc.start(t0)
        osc.stop(t0 + dur + 0.03)
      } catch {
        /* ignore audio errors — entrance must work without sound */
      }
    },
    []
  )

  const playCue = useCallback(
    (cue: 'snip' | 'door' | 'impact' | 'ambient') => {
      if (!enabledRef.current) return
      const ctx = ensureCtx()
      if (!ctx) return
      try {
        if (ctx.state === 'suspended') void ctx.resume()
      } catch {
        /* ignore */
      }
      if (cue === 'snip') {
        tone(1900, 0.05, 'square', 0.05)
        tone(1250, 0.07, 'square', 0.045, 0.05)
      } else if (cue === 'door') {
        tone(120, 0.7, 'sine', 0.06)
        tone(78, 0.9, 'sine', 0.05)
      } else if (cue === 'impact') {
        tone(58, 0.5, 'sine', 0.07)
        tone(110, 0.25, 'triangle', 0.04)
      } else if (cue === 'ambient') {
        tone(110, 1.4, 'sine', 0.035)
        tone(165, 1.4, 'sine', 0.02, 0.02)
      }
    },
    [ensureCtx, tone]
  )

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      enabledRef.current = next
      if (next) {
        const ctx = ensureCtx()
        try {
          if (ctx && ctx.state === 'suspended') void ctx.resume()
        } catch {
          /* ignore */
        }
        // gentle confirmation cue after the user gesture
        window.setTimeout(() => playCue('ambient'), 30)
      }
      return next
    })
  }, [ensureCtx, playCue])

  return { audioEnabled: enabled, toggleAudio: toggle, playCue }
}

/* ------------------------------------------------------------------ *
 * Main hook — centralizes all entrance state & scheduling
 * ------------------------------------------------------------------ */
export interface GrandEntranceState {
  active: boolean
  reducedMotion: boolean
  lowPower: boolean
  doorsVisible: boolean
  welcomeVisible: boolean
  titleVisible: boolean
  subtitleVisible: boolean
  ribbonVisible: boolean
  scissorsVisible: boolean
  cut: boolean
  ribbonSeparated: boolean
  doorsOpening: boolean
  revealing: boolean
  confetti: boolean
  showBeta: boolean
  done: boolean
  showEnter: boolean
  announce: string
  audioEnabled: boolean
  toggleAudio: () => void
  skip: () => void
  enterCity: () => void
  replay: () => void
}

export function useGrandEntrance(): GrandEntranceState {
  const location = useLocation()
  const onHome = HOME_PATHS.includes(location.pathname)

  const [reducedMotion, setReducedMotion] = useState(false)
  const [lowPower, setLowPower] = useState(false)

  const [active, setActive] = useState(false)
  const [doorsVisible, setDoorsVisible] = useState(false)
  const [welcomeVisible, setWelcomeVisible] = useState(false)
  const [titleVisible, setTitleVisible] = useState(false)
  const [subtitleVisible, setSubtitleVisible] = useState(false)
  const [ribbonVisible, setRibbonVisible] = useState(false)
  const [scissorsVisible, setScissorsVisible] = useState(false)
  const [cut, setCut] = useState(false)
  const [ribbonSeparated, setRibbonSeparated] = useState(false)
  const [doorsOpening, setDoorsOpening] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [showBeta] = useState(() => inBetaWindow())
  const [done, setDone] = useState(false)
  const [showEnter, setShowEnter] = useState(false)
  const [announce, setAnnounce] = useState('')

  const timersRef = useRef<number[]>([])
  const startedRef = useRef(false)
  const onHomeRef = useRef(onHome)
  onHomeRef.current = onHome

  const audio = useEntranceAudio()
  const playCue = audio.playCue

  /* Detect capabilities (client only) */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener?.('change', onChange)

    const cores = navigator.hardwareConcurrency || 4
    const saveData =
      (navigator as any).connection?.saveData === true ||
      (navigator as any).connection?.effectiveType === 'slow-2g'
    setLowPower(cores <= 2 || saveData)

    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
  }, [])

  const schedule = useCallback(
    (steps: Array<[number, () => void]>) => {
      steps.forEach(([at, fn]) => {
        const id = window.setTimeout(fn, at)
        timersRef.current.push(id)
      })
    },
    []
  )

  const finish = useCallback(() => {
    clearTimers()
    setRevealing(true)
    const id = window.setTimeout(() => {
      writeStorage(GRAND_ENTRANCE_SEEN_KEY, '1')
      writeStorage(BETA_SEEN_KEY, '1')
      // Consume the fresh-login flag so the entrance only plays once per login
      try { window.sessionStorage.removeItem(JUST_LOGGED_IN_KEY) } catch { /* ignore */ }
      setDone(true)
      setActive(false)
      startedRef.current = false
    }, 1000)
    timersRef.current.push(id)
  }, [clearTimers])

  const begin = useCallback(
    (force: boolean) => {
      const forcedParam = isForcedParam()
      const forced = force || readStorage(GRAND_ENTRANCE_FORCE_KEY) === '1' || forcedParam
      const launchMode = readStorage(GRAND_ENTRANCE_LAUNCH_KEY) === '1'
      const seen = readStorage(GRAND_ENTRANCE_SEEN_KEY) === '1'
      const justLoggedIn = readStorage(JUST_LOGGED_IN_KEY) === '1'
      const beta = inBetaWindow()
      const betaSeen = readStorage(BETA_SEEN_KEY) === '1'
      const shouldShow = forced || launchMode || justLoggedIn || (beta && !betaSeen) || !seen

      if (!shouldShow) return
      if (!onHomeRef.current) return
      if (startedRef.current) return

      startedRef.current = true
      clearTimers()
      // reset
      setDoorsVisible(false)
      setWelcomeVisible(false)
      setTitleVisible(false)
      setSubtitleVisible(false)
      setRibbonVisible(false)
      setScissorsVisible(false)
      setCut(false)
      setRibbonSeparated(false)
      setDoorsOpening(false)
      setRevealing(false)
      setDone(false)
      setShowEnter(false)
      setActive(true)

      if (reducedMotion) {
        schedule([
          [T_REDUCED.show, () => {
            setDoorsVisible(true)
            setWelcomeVisible(true)
            setTitleVisible(true)
            setSubtitleVisible(true)
            setAnnounce(
              'Welcome to maitroll.com, the very first virtual broadcasting city.'
            )
            setShowEnter(true)
          }],
          [T_REDUCED.reveal, () => {
            playCue('door')
            setRevealing(true)
          }],
          [T_REDUCED.done, finish],
        ])
      } else {
        schedule([
          [T_NORMAL.doors, () => setDoorsVisible(true)],
          [T_NORMAL.welcome, () => {
            setWelcomeVisible(true)
            setShowEnter(true)
          }],
          [T_NORMAL.title, () => setTitleVisible(true)],
          [T_NORMAL.subtitle, () => {
            setSubtitleVisible(true)
            setAnnounce(
              'Welcome to maitroll.com, the very first virtual broadcasting city.'
            )
          }],
          [T_NORMAL.ribbon, () => setRibbonVisible(true)],
          [T_NORMAL.scissors, () => setScissorsVisible(true)],
          [T_NORMAL.cut, () => {
            setCut(true)
            playCue('snip')
          }],
          [T_NORMAL.separate, () => setRibbonSeparated(true)],
          [T_NORMAL.opening, () => {
            setDoorsOpening(true)
            if (!reducedMotion) setConfetti(true)
            playCue('door')
          }],
          [T_NORMAL.revealing, () => {
            playCue('impact')
            setRevealing(true)
          }],
          [T_NORMAL.done, finish],
        ])
      }
    },
    [reducedMotion, schedule, clearTimers, playCue, finish]
  )

  // Auto-start once on first qualifying home visit
  const shouldAutoShowRef = useRef(true)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const forced =
      isForcedParam() || readStorage(GRAND_ENTRANCE_FORCE_KEY) === '1'
    const launchMode = readStorage(GRAND_ENTRANCE_LAUNCH_KEY) === '1'
    const seen = readStorage(GRAND_ENTRANCE_SEEN_KEY) === '1'
    const justLoggedIn = readStorage(JUST_LOGGED_IN_KEY) === '1'
    shouldAutoShowRef.current =
      forced || launchMode || justLoggedIn || !seen

    if (shouldAutoShowRef.current && onHome && !startedRef.current) {
      // A fresh login always replays the entrance, regardless of seen flag.
      begin(justLoggedIn || forced)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onHome])

  /* Replay via window event (menu action, etc.) */
  useEffect(() => {
    const handler = () => begin(true)
    window.addEventListener(REPLAY_EVENT, handler)
    return () => window.removeEventListener(REPLAY_EVENT, handler)
  }, [begin])

  const skip = useCallback(() => {
    clearTimers()
    setDoorsVisible(true)
    setWelcomeVisible(true)
    setTitleVisible(true)
    setSubtitleVisible(true)
    setRibbonVisible(true)
    setScissorsVisible(true)
    setCut(true)
    setRibbonSeparated(true)
    setDoorsOpening(true)
    if (!reducedMotion) setConfetti(true)
    setShowEnter(false)
    finish()
  }, [clearTimers, reducedMotion, finish])

  const enterCity = useCallback(() => {
    if (!active && !startedRef.current) {
      begin(false)
      return
    }
    clearTimers()
    setDoorsVisible(true)
    setWelcomeVisible(true)
    setTitleVisible(true)
    setSubtitleVisible(true)
    setRibbonVisible(true)
    setScissorsVisible(true)
    setCut(true)
    setRibbonSeparated(true)
    setDoorsOpening(true)
    if (!reducedMotion) setConfetti(true)
    setShowEnter(false)
    playCue('snip')
    schedule([
      [120, () => playCue('door')],
      [450, () => {
        playCue('impact')
        setRevealing(true)
      }],
      [950, finish],
    ])
  }, [active, begin, clearTimers, reducedMotion, playCue, schedule, finish])

  const replay = useCallback(() => begin(true), [begin])

  return {
    active,
    reducedMotion,
    lowPower,
    doorsVisible,
    welcomeVisible,
    titleVisible,
    subtitleVisible,
    ribbonVisible,
    scissorsVisible,
    cut,
    ribbonSeparated,
    doorsOpening,
    revealing,
    confetti,
    showBeta,
    done,
    showEnter,
    announce,
    audioEnabled: audio.audioEnabled,
    toggleAudio: audio.toggleAudio,
    skip,
    enterCity,
    replay,
  }
}
