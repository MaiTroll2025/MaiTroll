export const unlockGiftAudio = async (): Promise<void> => {
  const audio = document.createElement('audio')
  audio.muted = false
  audio.volume = 0.01
  const silentAudio =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA=='
  audio.src = silentAudio
  try {
    await audio.play()
    audio.pause()
    audio.remove()
  } catch {
    audio.remove()
  }
}
