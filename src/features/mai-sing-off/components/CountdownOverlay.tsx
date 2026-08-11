import { useEffect, useState } from 'react'

interface CountdownOverlayProps {
  remaining: number | null
  targetName?: string
}

export function CountdownOverlay({ remaining, targetName }: CountdownOverlayProps) {
  if (remaining === null || remaining === undefined) return null
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      <span className="text-8xl font-extrabold text-yellow-300 drop-shadow-2xl">{remaining}</span>
      {targetName ? <span className="mt-2 text-sm text-zinc-300">get ready, {targetName}!</span> : null}
    </div>
  )
}
