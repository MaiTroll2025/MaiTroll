import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_LOGS = 200

type DebugLogEntry = {
  prefix: string
  message: string
  timestamp: number
  data?: any
}

export function usePhoneViewerDebug(prefix = '[PhoneViewerPage]') {
  const logsRef = useRef<DebugLogEntry[]>([])
  const [logs, setLogs] = useState<DebugLogEntry[]>([])

  const pushLog = useCallback(
    (message: string, data?: any) => {
      const entry: DebugLogEntry = {
        prefix,
        message,
        timestamp: Date.now(),
        data,
      }

      logsRef.current = [...logsRef.current.slice(-MAX_LOGS), entry]
      setLogs([...logsRef.current])

      if (import.meta.env.DEV) {
        const time = new Date(entry.timestamp).toLocaleTimeString()
        console.log(`[${time}] ${prefix} ${message}`, data ?? '')
      }
    },
    [prefix],
  )

  useEffect(() => {
    return () => {
      logsRef.current = []
    }
  }, [])

  return {
    logs,
    pushLog,
    clearLogs: useCallback(() => {
      logsRef.current = []
      setLogs([])
    }, []),
  }
}
