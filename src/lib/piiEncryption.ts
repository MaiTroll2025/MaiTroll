// Demo-grade client-side PII encryption for job applications.
// NOTE: This is NOT production-grade. A real system must encrypt PII server-side
// using a managed KMS / envelope encryption so the key is never exposed to the client.
// Here we derive a key from a constant app secret + the user id via PBKDF2 and
// encrypt with AES-GCM via Web Crypto. Only the last 4 of the SSN are stored in clear.

const APP_SECRET = 'MaiTroll-demo-pii-secret-v1'

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

async function deriveKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(APP_SECRET),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(`Mai Troll:${userId}`),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export interface EncryptedPayload {
  iv: string
  data: string
}

export async function encryptPII(value: string, userId: string): Promise<EncryptedPayload> {
  const key = await deriveKey(userId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(value)
  )
  return {
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
  }
}

export async function decryptPII(payload: EncryptedPayload, userId: string): Promise<string> {
  const key = await deriveKey(userId)
  const iv = fromBase64(payload.iv)
  const data = fromBase64(payload.data)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data as BufferSource
  )
  return new TextDecoder().decode(plaintext)
}
