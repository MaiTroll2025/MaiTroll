import { useEffect, useCallback, useState } from 'react'

export type UpdateStatus =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string; releaseDate?: string; releaseNotes?: string }
  | { status: 'downloading'; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { status: 'downloaded'; version: string; releaseDate?: string }
  | { status: 'not-available'; version: string }
  | { status: 'error'; message: string }
  | { status: 'dev' }

declare global {
  interface Window {
    electronAPI?: {
      checkForUpdate: () => Promise<UpdateStatus>
      downloadUpdate: () => Promise<UpdateStatus>
      installUpdate: () => Promise<{ status: string }>
      cancelUpdate: () => Promise<{ status: string }>
      onAppUpdate: (callback: (payload: UpdateStatus) => void) => () => void
    }
  }
}

export function useAutoUpdate() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    const isElectronEnv =
      typeof window !== 'undefined' &&
      window.electronAPI &&
      typeof window.electronAPI.onAppUpdate === 'function'

    if (!isElectronEnv) {
      setIsElectron(false)
      return
    }

    setIsElectron(true)

    const unsubscribe = window.electronAPI.onAppUpdate((payload) => {
      setUpdateStatus(payload)
    })

    window.electronAPI.checkForUpdate().then((status) => {
      setUpdateStatus(status)
    })

    return unsubscribe
  }, [])

  const checkForUpdate = useCallback(async () => {
    if (!window.electronAPI) return
    const status = await window.electronAPI.checkForUpdate()
    setUpdateStatus(status)
  }, [])

  const downloadUpdate = useCallback(async () => {
    if (!window.electronAPI) return
    const status = await window.electronAPI.downloadUpdate()
    setUpdateStatus(status)
  }, [])

  const installUpdate = useCallback(async () => {
    if (!window.electronAPI) return
    await window.electronAPI.installUpdate()
  }, [])

  const cancelUpdate = useCallback(async () => {
    if (!window.electronAPI) return
    const status = await window.electronAPI.cancelUpdate()
    setUpdateStatus(status)
  }, [])

  const dismissUpdate = useCallback(() => {
    setUpdateStatus({ status: 'idle' })
  }, [])

  return {
    isElectron,
    updateStatus,
    checkForUpdate,
    downloadUpdate,
    installUpdate,
    cancelUpdate,
    dismissUpdate,
  }
}
