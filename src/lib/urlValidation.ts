// src/lib/urlValidation.ts
// Secure URL validation utility for the broadcast wishlist feature.
// Broadcasters may paste any valid HTTPS URL. We enforce:
//   - HTTPS protocol only (no HTTP, no protocol-relative URLs, no data: URIs)
//   - Valid hostname (no IP addresses, no localhost, no internal hostnames)
//   - No javascript:, file:, ftp:, etc.
//   - Length cap to prevent abuse
//   - No control characters / whitespace in the URL

export interface UrlValidationResult {
  valid: boolean
  error?: string
  normalizedUrl?: string
}

const MAX_URL_LENGTH = 2048

function containsControlChars(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

/**
 * Validates that a URL is a safe, external HTTPS URL suitable for display
 * in the broadcast ticker as a clickable link.
 */
export function validateWishlistUrl(input: unknown): UrlValidationResult {
  if (typeof input !== 'string') {
    return { valid: false, error: 'URL must be a string' }
  }

  const trimmed = input.trim()

  if (!trimmed) {
    return { valid: false, error: 'URL is required' }
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return { valid: false, error: `URL must be ${MAX_URL_LENGTH} characters or fewer` }
  }

  if (containsControlChars(trimmed)) {
    return { valid: false, error: 'URL contains control characters' }
  }

  // Reject URLs with embedded credentials (user:pass@host)
  if (/^[^:]+:[^@]+@/i.test(trimmed)) {
    return { valid: false, error: 'URLs with embedded credentials are not allowed' }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }

  // Only HTTPS is allowed.
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS URLs are allowed' }
  }

  const hostname = parsed.hostname.toLowerCase()

  if (!hostname) {
    return { valid: false, error: 'URL is missing a hostname' }
  }

  // Block IP literals (IPv4 and IPv6).
  if (
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
    hostname.startsWith('[') ||
    hostname === '::1' ||
    hostname === '::'
  ) {
    return { valid: false, error: 'IP addresses are not allowed' }
  }

  // Block loopback / link-local / private hostnames.
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.') ||
    hostname.startsWith('172.16.') ||
    hostname.startsWith('172.17.') ||
    hostname.startsWith('172.18.') ||
    hostname.startsWith('172.19.') ||
    hostname.startsWith('172.2') ||
    hostname.startsWith('172.30.') ||
    hostname.startsWith('172.31.') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    return { valid: false, error: 'Local/loopback addresses are not allowed' }
  }

  // Block known internal TLDs.
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) {
    return { valid: false, error: 'Local network addresses are not allowed' }
  }

  // Must have at least one dot in the hostname (TLD present).
  if (!hostname.includes('.')) {
    return { valid: false, error: 'URL must include a valid domain name' }
  }

  // Reject empty path segments like file:// — already handled by protocol check,
  // but also ensure the pathname is not a javascript: payload.
  if (parsed.pathname && /javascript:/i.test(parsed.pathname)) {
    return { valid: false, error: 'JavaScript URLs are not allowed' }
  }

  // Normalize: strip any fragment (anchor) and trailing whitespace.
  // Keep the search/query string intact since it can carry legitimate params.
  const normalized = `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search || ''}`

  return { valid: true, normalizedUrl: normalized }
}