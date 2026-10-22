import React, { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface BroadcastSchoolTimerProps {
  cooldownUntil: string | null
  onExpire?: () => void
}

export default function BroadcastSchoolTimer({
  cooldownUntil,
  onExpire,
}: BroadcastSchoolTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!cooldownUntil) {
      setTimeLeft(null)
      return
    }
    const expiresAt = Date.parse(cooldownUntil)
    if (Number.isNaN(expiresAt)) {
      setTimeLeft(null)
      return
    }

    const update = () => {
      const remaining = Math.max(0, expiresAt - Date.now())
      setTimeLeft(remaining)
      if (remaining <= 0) {
        onExpire?.()
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [cooldownUntil, onExpire])

  if (!timeLeft) return null

  const minutes = Math.floor(timeLeft / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)
  const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  return (
    <div className="flex items-center space-x-2 text-xs text-amber-400 font-mono">
      <Clock size={14} />
      <span>{formatted}</span>
    </div>
  )
}
