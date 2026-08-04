// src/components/entrance/CeremonyRibbon.tsx
import React from 'react'

interface CeremonyRibbonProps {
  visible: boolean
  separated: boolean
}

export default function CeremonyRibbon({
  visible,
  separated,
}: CeremonyRibbonProps) {
  return (
    <div
      className={`gce-ribbon ${visible ? 'gce-is-ribbon' : ''} ${
        separated ? 'gce-is-separated' : ''
      }`}
      aria-hidden="true"
    >
      <div className="gce-ribbon-half gce-ribbon-left" />
      <div className="gce-ribbon-half gce-ribbon-right" />
      <span className="gce-ribbon-text">Mai Troll</span>
    </div>
  )
}
