export function formatCoins(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1000) return String(value)
  if (value < 1_000_000) {
    const k = value / 1000
    return `${(k % 1 === 0 ? k.toFixed(0) : k.toFixed(1))}k`
  }
  const m = value / 1_000_000
  return `${(m % 1 === 0 ? m.toFixed(0) : m.toFixed(1))}m`
}
