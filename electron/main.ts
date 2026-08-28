import { app, BrowserWindow, session, shell, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { autoUpdater } from 'electron-updater'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged

let mainWindow: BrowserWindow | null = null

const getProductionUrl = (): string => {
  const env = process.env as Record<string, string | undefined>
  const url = env.MAITROLL_PROD_URL
  if (url) return url
  return 'https://www.maitroll.com'
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    icon: path.join(__dirname, '..', 'public', 'icons', 'maitroll.ico'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    mainWindow
      .loadURL('http://localhost:5178')
      .catch(() => {
        mainWindow?.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
      })
    mainWindow.webContents.openDevTools({ mode: 'right' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const allowedOrigins = [getProductionUrl(), 'http://localhost:5178']
    const isAllowed = allowedOrigins.some((origin) => url.startsWith(origin))

    if (isAllowed && url.startsWith('http')) {
      return { action: 'allow' }
    }

    shell.openExternal(url)
    return { action: 'deny' }
  })

  ;(mainWindow.webContents as any).on('did-navigate-in-page', (_event: Electron.IpcMainEvent, url: string) => {
    const allowedOrigins = [getProductionUrl(), 'http://localhost:5178']
    const isAllowed = allowedOrigins.some((origin) => url.startsWith(origin))
    if (!isAllowed && url.startsWith('http')) {
      shell.openExternal(url)
      mainWindow?.loadURL(getProductionUrl())
    }
  })

  mainWindow.webContents.on('did-create-window', (child) => {
    ;(child as any).on('did-navigate-in-page', (_event: Electron.IpcMainEvent, url: string) => {
      const allowedOrigins = [getProductionUrl(), 'http://localhost:5178']
      const isAllowed = allowedOrigins.some((origin) => url.startsWith(origin))
      if (!isAllowed && url.startsWith('http')) {
        shell.openExternal(url)
        child.close()
      }
    })
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function setupPermissions(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = ['media', 'audioCapture', 'videoCapture', 'notifications']
    if (allowedPermissions.includes(permission)) {
      callback(true)
      return
    }
    callback(false)
  })

  if (typeof session.defaultSession.setDevicePermissionHandler === 'function') {
    ;(session.defaultSession as any).setDevicePermissionHandler((details: any) => {
      if (details.deviceType === 'audioinput' || details.deviceType === 'videoinput') {
        return true
      }
      return false
    })
  }
}

function setupDeepLinks(): void {
  const protocol = 'maitroll'

  if (process.defaultApp) {
    app.removeAsDefaultProtocolClient(protocol, process.execPath, ['--'])
  } else {
    app.removeAsDefaultProtocolClient(protocol)
  }

  app.setAsDefaultProtocolClient(protocol)

  const gotDeepLink = (url: string) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('deep-link', url)
    }
  }

  if (process.platform === 'win32') {
    if (process.argv.length >= 2) {
      const arg = process.argv[1]
      if (typeof arg === 'string' && arg.startsWith(`${protocol}://`)) {
        gotDeepLink(arg)
      }
    }
  } else {
    gotDeepLink(process.argv[1] || '')
  }
}

function setupAutoUpdater(): void {
  if (isDev) {
    return
  }

  const feedUrl = getProductionUrl().replace(/\/$/, '')

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'maitroll',
    repo: 'maitroll',
  })

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('app-update', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info: any) => {
    mainWindow?.webContents.send('app-update', {
      status: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    })
  })

  autoUpdater.on('update-not-available', (info: any) => {
    mainWindow?.webContents.send('app-update', {
      status: 'not-available',
      version: info.version,
    })
  })

  autoUpdater.on('download-progress', (progress: any) => {
    mainWindow?.webContents.send('app-update', {
      status: 'downloading',
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', (info: any) => {
    mainWindow?.webContents.send('app-update', {
      status: 'downloaded',
      version: info.version,
      releaseDate: info.releaseDate,
    })
  })

  autoUpdater.on('error', (error: any) => {
    mainWindow?.webContents.send('app-update', {
      status: 'error',
      message: error.message,
    })
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // ignore initial check failure
    })
  }, 5000)

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // ignore periodic check failure
    })
  }, 1000 * 60 * 60)
}

ipcMain.handle('app-version', () => {
  return app.getVersion()
})

ipcMain.handle('app-path', () => {
  return app.getPath('userData')
})

ipcMain.handle('app-update-check', async () => {
  if (isDev) {
    return { status: 'dev' }
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    return { status: 'checked', ...result }
  } catch (error: any) {
    return { status: 'error', message: error?.message || 'Update check failed' }
  }
})

ipcMain.handle('app-update-download', async () => {
  if (isDev) {
    return { status: 'dev' }
  }

  try {
    await autoUpdater.downloadUpdate()
    return { status: 'downloading' }
  } catch (error: any) {
    return { status: 'error', message: error?.message || 'Download failed' }
  }
})

ipcMain.handle('app-update-install', async () => {
  if (isDev) {
    return { status: 'dev' }
  }

  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true)
  })

  return { status: 'installing' }
})

ipcMain.handle('app-update-cancel', async () => {
  if (isDev) {
    return { status: 'dev' }
  }

  try {
    ;(autoUpdater as any).cancelDownload?.()
    return { status: 'canceled' }
  } catch (error: any) {
    return { status: 'error', message: error?.message || 'Cancel failed' }
  }
})

app.whenReady().then(() => {
  setupPermissions()
  createWindow()
  setupDeepLinks()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('open-url', (_event, url) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('deep-link', url)
  }
})

app.on('second-instance', (_event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }

  const deepLink = commandLine.find((arg) => typeof arg === 'string' && arg.startsWith('maitroll://'))
  if (deepLink && mainWindow?.webContents) {
    mainWindow.webContents.send('deep-link', deepLink)
  }
})
