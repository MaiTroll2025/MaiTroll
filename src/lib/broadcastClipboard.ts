// src/lib/broadcastClipboard.ts
// Frontend-wide clipboard audit: ensures copy-and-paste works consistently
// across all broadcast pages (web + phone). Provides a single, reliable
// `copyToClipboard` helper that:
//   - Uses the modern async Clipboard API when available.
//   - Falls back to `document.execCommand('copy')` for older browsers / iframes.
//   - Always re-selects the target element so the fallback works even when
//     the user has clicked elsewhere.
//   - Returns a Promise<boolean> so callers can react to success/failure.

export interface CopyToClipboardOptions {
  /**
   * When true (default), a transient "Copied!" toast is shown via console.info.
   * Set to false to handle the UI yourself.
   */
  showFeedback?: boolean
  /**
   * Optional fallback text used when the Clipboard API is unavailable and
   * no element is provided.
   */
  fallbackText?: string
}

/**
 * Copies `text` to the clipboard using the most reliable method available.
 * Resolves to `true` on success, `false` on failure.
 */
export async function copyToClipboard(
  text: string,
  options: CopyToClipboardOptions = {}
): Promise<boolean> {
  const { showFeedback = false, fallbackText } = options

  if (typeof text !== 'string') {
    return false
  }

  // 1. Try the modern async Clipboard API.
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      if (showFeedback) console.info('[clipboard] Copied via Clipboard API')
      return true
    } catch (err) {
      // Fall through to the legacy fallback — some browsers block the async
      // clipboard API outside of a user-gesture handler or secure context.
      console.warn('[clipboard] Clipboard API failed, trying fallback:', err)
    }
  }

  // 2. Legacy fallback using a hidden textarea + execCommand.
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, text.length)

    let success = false
    try {
      success = document.execCommand('copy')
    } catch {
      success = false
    }

    document.body.removeChild(textarea)

    if (success) {
      if (showFeedback) console.info('[clipboard] Copied via execCommand fallback')
      return true
    }
  } catch (err) {
    console.warn('[clipboard] execCommand fallback failed:', err)
  }

  // 3. Last resort: copy the fallback text (if any) via the same mechanism.
  if (fallbackText && fallbackText !== text) {
    return copyToClipboard(fallbackText, { showFeedback })
  }

  if (showFeedback) console.info('[clipboard] Copy failed')
  return false
}

/**
 * Reads text from the clipboard. Resolves to the clipboard text or `null`
 * if reading is not permitted / unsupported.
 */
export async function readFromClipboard(): Promise<string | null> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
    try {
      return await navigator.clipboard.readText()
    } catch (err) {
      console.warn('[clipboard] readText failed:', err)
    }
  }

  return null
}

/**
 * Returns `true` when the async Clipboard API is available and likely to work.
 */
export function isClipboardApiSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  )
}