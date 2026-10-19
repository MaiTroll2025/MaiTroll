export function getLiveKitUrl(): string {
  const configuredUrl = import.meta.env.VITE_LIVEKIT_URL?.trim()

  if (!configuredUrl) {
    throw new Error('VITE_LIVEKIT_URL is missing. Configure the LiveKit WebSocket URL before starting a broadcast.')
  }

  if (/\s/.test(configuredUrl)) {
    throw new Error('VITE_LIVEKIT_URL contains whitespace. Set it to the exact LiveKit WebSocket URL (wss://...).')
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(configuredUrl)
  } catch {
    throw new Error('VITE_LIVEKIT_URL must be a valid absolute WebSocket URL (wss://...).')
  }

  if (!['ws:', 'wss:'].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
    throw new Error('VITE_LIVEKIT_URL must use ws:// or wss:// and include a hostname.')
  }

  return configuredUrl
}
