import { useState, useCallback, useRef, useEffect } from 'react'
import OBSWebSocket from 'obs-websocket-js'

export interface ObsScene {
  name: string
  isActive: boolean
}

interface UseObsScenesOptions {
  url?: string
  autoConnect?: boolean
}

interface UseObsScenesReturn {
  scenes: ObsScene[]
  currentScene: string | null
  isConnected: boolean
  isConnecting: boolean
  isStreaming: boolean
  connect: (url?: string) => Promise<void>
  disconnect: () => void
  switchScene: (sceneName: string) => Promise<void>
  stopStreaming: () => Promise<void>
  error: string | null
}

export function useObsScenes(options: UseObsScenesOptions = {}): UseObsScenesReturn {
  const { url: defaultUrl = 'ws://localhost:4455', autoConnect = false } = options

  const [scenes, setScenes] = useState<ObsScene[]>([])
  const [currentScene, setCurrentScene] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const obsRef = useRef<OBSWebSocket | null>(null)

  const fetchScenes = useCallback(async (obs: OBSWebSocket) => {
    try {
      const { scenes: obsScenes } = await obs.call('GetSceneList')
      const mapped: ObsScene[] = obsScenes.map((s: any) => ({
        name: s.sceneName as string,
        isActive: s.sceneName === obsScenes[0]?.sceneName,
      }))
      setScenes(mapped)
      setCurrentScene(obsScenes[0]?.sceneName ?? null)
    } catch (err: any) {
      console.warn('[useObsScenes] Failed to fetch scenes:', err?.message)
    }
  }, [])

  const fetchStreamingStatus = useCallback(async (obs: OBSWebSocket) => {
    try {
      const response = await obs.call('GetStreamingStatus' as any)
      const streaming = Boolean(
        (response as any)?.streaming === true ||
        (response as any)?.streamingActive === true ||
        (response as any)?.outputActive === true ||
        (response as any)?.isStreaming === true,
      )
      setIsStreaming(streaming)
    } catch (err: any) {
      console.warn('[useObsScenes] Failed to fetch streaming status:', err?.message)
      setIsStreaming(false)
    }
  }, [])

  const connect = useCallback(async (overrideUrl?: string) => {
    const targetUrl = overrideUrl || defaultUrl

    if (obsRef.current) {
      try { obsRef.current.disconnect() } catch {}
    }

    const obs = new OBSWebSocket()
    obsRef.current = obs
    setIsConnecting(true)
    setError(null)

    obs.on('CurrentSceneChanged', (data: any) => {
      const newName = data.sceneName as string
      setCurrentScene(newName)
      setScenes((prev) =>
        prev.map((s) => ({ ...s, isActive: s.name === newName })),
      )
    })

    obs.on('SceneListChanged', () => {
      if (obsRef.current) fetchScenes(obsRef.current)
    })

    obs.on('StreamStateChanged', (data: any) => {
      const streaming = Boolean(
        data?.streaming === true ||
        data?.streamingActive === true ||
        data?.outputActive === true ||
        data?.isStreaming === true,
      )
      setIsStreaming(streaming)
    })

    obs.on('ConnectionClosed', () => {
      setIsConnected(false)
      setIsConnecting(false)
      setIsStreaming(false)
    })

    try {
      await obs.connect(targetUrl)
      setIsConnected(true)
      setIsConnecting(false)
      await fetchScenes(obs)
      await fetchStreamingStatus(obs)
    } catch (err: any) {
      setIsConnected(false)
      setIsConnecting(false)
      const msg = err?.message || ''
      if (msg.includes('ERR_CONNECTION_REFUSED') || msg.includes('ECONNREFUSED') || msg.includes('connect')) {
        setError('OBS not running — open OBS Studio and enable WebSocket in Tools → WebSocket Server Settings')
      } else {
        setError(msg || 'Failed to connect to OBS WebSocket')
      }
    }
  }, [defaultUrl, fetchScenes])

  const disconnect = useCallback(() => {
    if (obsRef.current) {
      try { obsRef.current.disconnect() } catch {}
      obsRef.current = null
    }
    setIsConnected(false)
    setIsStreaming(false)
    setScenes([])
    setCurrentScene(null)
  }, [])

  const switchScene = useCallback(async (sceneName: string) => {
    if (!obsRef.current || !isConnected) return
    try {
      await obsRef.current.call('SetCurrentProgramScene', { sceneName })
      setCurrentScene(sceneName)
      setScenes((prev) =>
        prev.map((s) => ({ ...s, isActive: s.name === sceneName })),
      )
    } catch (err: any) {
      console.error('[useObsScenes] Failed to switch scene:', err?.message)
    }
  }, [isConnected])

  const stopStreaming = useCallback(async () => {
    if (!obsRef.current || !isConnected) return
    try {
      await obsRef.current.call('StopStreaming' as any)
      setIsStreaming(false)
    } catch (err: any) {
      console.error('[useObsScenes] Failed to stop streaming:', err?.message)
    }
  }, [isConnected])

  useEffect(() => {
    if (autoConnect) {
      connect()
    }
    return () => {
      if (obsRef.current) {
        try { obsRef.current.disconnect() } catch {}
        obsRef.current = null
      }
    }
  }, [])

  return { scenes, currentScene, isConnected, isConnecting, isStreaming, connect, disconnect, switchScene, stopStreaming, error }
}
