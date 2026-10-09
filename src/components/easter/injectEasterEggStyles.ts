let injected = false

export function injectEasterEggStyles() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const style = document.createElement('style')
  style.id = 'easter-egg-styles'
  style.textContent = `
    @keyframes easter-egg-idle {
      0%, 100% { transform: translate(-50%, -50%) translateY(0) rotate(-2deg); }
      33% { transform: translate(-50%, -50%) translateY(-3px) rotate(1deg); }
      66% { transform: translate(-50%, -50%) translateY(-1px) rotate(2deg); }
    }
    @keyframes easter-egg-found {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      50% { transform: translate(-50%, -50%) scale(1.8); opacity: 0.8; }
      100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}
