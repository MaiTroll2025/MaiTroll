export interface AppDownloadRelease {
  version: string
  build: number
  releaseDate: string
  apkPath: string
  notes?: string
}

// Add each published APK here, newest first, and place its file in public/downloads/.
export const appDownloadReleases: AppDownloadRelease[] = []
