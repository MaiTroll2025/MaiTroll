/**
 * Signed OAuth state for the Meta authorization flow.
 *
 * The state is the ONLY thing that travels through the browser during the
 * OAuth round trip. It carries the initiating admin's user id plus a nonce
 * and timestamp, and is signed with the Meta app secret using HMAC-SHA256.
 *
 * Because it is signed:
 *   - an attacker cannot forge a state for a victim admin
 *   - the callback can prove which admin started the flow
 * and because the callback additionally requires that admin's live JWT,
 * a stolen authorization code alone is useless.
 */

const STATE_TTL_MS = 15 * 60 * 1000;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export interface FacebookOAuthState {
  userId: string;
  nonce: string;
  issuedAt: number;
}

export async function hashOAuthNonce(nonce: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  return base64UrlEncode(new Uint8Array(digest));
}

/** Create `<payload>.<signature>` for the given admin. */
export async function createOAuthState(
  userId: string,
  secret: string,
): Promise<{ state: string; nonce: string }> {
  const payload: FacebookOAuthState = {
    userId,
    nonce: crypto.randomUUID(),
    issuedAt: Date.now(),
  };

  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(encodedPayload),
  );

  return {
    state: `${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`,
    nonce: payload.nonce,
  };
}

export interface StateVerification {
  valid: boolean;
  reason?: string;
  state?: FacebookOAuthState;
}

/** Verify signature and freshness. Never throws. */
export async function verifyOAuthState(
  state: string | null,
  secret: string,
): Promise<StateVerification> {
  if (!state || !state.includes('.')) {
    return { valid: false, reason: 'missing_state' };
  }

  const parts = state.split('.');
  const [encodedPayload, encodedSignature] = parts;
  if (parts.length !== 2 || !encodedPayload || !encodedSignature) {
    return { valid: false, reason: 'malformed_state' };
  }

  let signatureValid = false;
  try {
    const key = await hmacKey(secret);
    signatureValid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(encodedSignature),
      new TextEncoder().encode(encodedPayload),
    );
  } catch {
    return { valid: false, reason: 'malformed_signature' };
  }

  if (!signatureValid) {
    return { valid: false, reason: 'bad_signature' };
  }

  let parsed: FacebookOAuthState;
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
  } catch {
    return { valid: false, reason: 'malformed_payload' };
  }

  if (
    typeof parsed?.userId !== 'string' ||
    !parsed.userId ||
    typeof parsed.nonce !== 'string' ||
    !parsed.nonce ||
    typeof parsed.issuedAt !== 'number'
  ) {
    return { valid: false, reason: 'incomplete_payload' };
  }

  const age = Date.now() - parsed.issuedAt;
  if (age < 0 || age > STATE_TTL_MS) {
    return { valid: false, reason: 'expired_state' };
  }

  return { valid: true, state: parsed };
}
