// src/components/entrance/GrandCityEntrance.tsx
import React, { useEffect, useRef } from 'react'
import './grandEntrance.css'
import { useGrandEntrance } from './useGrandEntrance'
import EntranceBackdrop from './EntranceBackdrop'
import CityDoors from './CityDoors'
import EntranceTitle from './EntranceTitle'
import CeremonyRibbon from './CeremonyRibbon'
import CeremonyScissors from './CeremonyScissors'
import ConfettiTrumpets from './ConfettiTrumpets'
import EntranceControls from './EntranceControls'
import AudioControls from './AudioControls'

/**
 * GrandCityEntrance
 * Cinematic ceremonial entrance shown when users first arrive at MaiMai Troll.com.
 * Reveals the live Mai Troll home page behind the doors once the sequence completes.
 */
export default function GrandCityEntrance() {
  const e = useGrandEntrance()
  const rootRef = useRef<HTMLDivElement | null>(null)

  /* Lock body scroll while the entrance is active */
  useEffect(() => {
    if (!e.active) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.classList.add('gce-active')
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
      document.body.classList.remove('gce-active')
    }
  }, [e.active])

  /* Hard safety net: never trap the user, even if the timeline stalls */
  useEffect(() => {
    if (!e.active) return
    const safety = window.setTimeout(() => {
      try {
        e.skip()
      } catch {
        /* last resort: drop the overlay */
        document.body.style.overflow = ''
        document.documentElement.style.overflow = ''
        document.body.classList.remove('gce-active')
      }
    }, 9000)
    return () => window.clearTimeout(safety)
  }, [e.active, e.skip])

  if (!e.active) return null

  const rootClass = [
    'gce-root',
    e.lowPower ? 'gce-lowpower' : '',
    e.doorsVisible ? 'gce-is-doors' : '',
    e.welcomeVisible ? 'gce-is-welcome' : '',
    e.titleVisible ? 'gce-is-title' : '',
    e.subtitleVisible ? 'gce-is-subtitle' : '',
    e.ribbonVisible ? 'gce-is-ribbon' : '',
    e.scissorsVisible ? 'gce-is-scissors' : '',
    e.cut ? 'gce-is-cut' : '',
    e.ribbonSeparated ? 'gce-is-separated' : '',
    e.doorsOpening ? 'gce-is-opening' : '',
    e.revealing ? 'gce-is-revealing' : '',
    e.showEnter ? 'gce-is-enter' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={rootRef}
      className={rootClass}
      role="dialog"
      aria-label="Mai Troll Grand Entrance"
      aria-modal="false"
    >
      <div className="gce-safe">
        <EntranceBackdrop revealed={e.revealing} lowPower={e.lowPower} />

        <CityDoors />

        <EntranceTitle
          welcomeVisible={e.welcomeVisible}
          titleVisible={e.titleVisible}
          subtitleVisible={e.subtitleVisible}
          showBeta={e.showBeta}
        />

        <CeremonyRibbon
          visible={e.ribbonVisible}
          separated={e.ribbonSeparated}
        />

        <CeremonyScissors
          visible={e.scissorsVisible}
          cut={e.cut}
          separated={e.ribbonSeparated}
        />

        <ConfettiTrumpets active={e.confetti} lowPower={e.lowPower} />

        <EntranceControls
          onSkip={e.skip}
          onEnter={e.enterCity}
        />

        <AudioControls enabled={e.audioEnabled} onToggle={e.toggleAudio} />

        <div className="gce-brand">MaiMai Troll.com</div>

        <div className="gce-sr" aria-live="polite" role="status">
          {e.announce}
        </div>
      </div>
    </div>
  )
}
