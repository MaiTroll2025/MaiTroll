declare module 'electron-updater' {
  export interface UpdateInfo {
    version: string
    releaseDate?: string
    releaseNotes?: string
  }

  export interface ProgressInfo {
    percent: number
    transferred: number
    total: number
    bytesPerSecond: number
  }

  export interface AutoUpdater {
    setFeedURL(feedUrl: string | { provider: string; owner: string; repo: string; token?: string }): void
    checkForUpdates(): Promise<UpdateInfo | null>
    downloadUpdate(): Promise<void>
    quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
    cancelDownload(): Promise<void>
    autoDownload: boolean
    autoInstallOnAppQuit: boolean
    on(event: 'checking-for-update', listener: () => void): this
    on(event: 'update-available', listener: (info: UpdateInfo) => void): this
    on(event: 'update-not-available', listener: (info: UpdateInfo) => void): this
    on(event: 'error', listener: (error: Error) => void): this
    on(event: 'download-progress', listener: (progress: ProgressInfo) => void): this
    on(event: 'update-downloaded', listener: (info: UpdateInfo) => void): this
    removeAllListeners(event?: string): this
  }

  export const autoUpdater: AutoUpdater
}
