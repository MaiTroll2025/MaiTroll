import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

let Preferences: any = null
let preferencesLoaded = false

async function loadPreferences() {
  if (preferencesLoaded) return
  preferencesLoaded = true
  if (isNative) {
    try {
      const mod = await import('@capacitor/preferences')
      Preferences = mod.Preferences
    } catch {
      Preferences = null
    }
  }
}

function getStorageKey(key: string): string {
  return `supabase.auth.${key}`
}

export const supabaseStorage = {
  async getItem(key: string): Promise<string | null> {
    await loadPreferences()
    const storageKey = getStorageKey(key)
    if (isNative && Preferences) {
      const { value } = await Preferences.get({ key: storageKey })
      return value ?? null
    }
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(storageKey)
    }
    return null
  },

  async setItem(key: string, value: string): Promise<void> {
    await loadPreferences()
    const storageKey = getStorageKey(key)
    if (isNative && Preferences) {
      await Preferences.set({ key: storageKey, value })
      return
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, value)
    }
  },

  async removeItem(key: string): Promise<void> {
    await loadPreferences()
    const storageKey = getStorageKey(key)
    if (isNative && Preferences) {
      await Preferences.remove({ key: storageKey })
      return
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey)
    }
  },
}