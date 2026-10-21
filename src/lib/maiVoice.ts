import { supabase } from './supabase';

/**
 * Mai Voice — browser-side client.
 *
 * Everything that touches voice data goes through the `mai-voice` edge
 * function, which is the only component allowed to read or write the voice
 * tables, call the TTS provider or move bytes through the private bucket.
 * This module only shapes requests and normalizes responses.
 */

export type MaiVoiceRoomKind = 'stream' | 'battle';

export const MAI_VOICE_CONSENT_VERSION = 'mai-voice-2026-10-21';

/** Recorded voice messages are limited to 20 seconds. */
export const MAI_VOICE_MESSAGE_MAX_SECONDS = 20;
/** A voice-clone sample must be between 30 and 180 seconds. */
export const MAI_VOICE_ENROLLMENT_MIN_SECONDS = 30;
export const MAI_VOICE_ENROLLMENT_MAX_SECONDS = 180;

export interface MaiVoiceRoomSettings {
  room_kind: MaiVoiceRoomKind;
  room_id: string;
  tts_enabled: boolean;
  chat_tts_enabled: boolean;
  flying_chat_tts_enabled: boolean;
  voice_chat_enabled: boolean;
  playback_volume: number;
  playback_paused: boolean;
  max_queue_size: number;
  cooldown_seconds: number;
  max_text_length: number;
  fallback_voice_enabled: boolean;
  fallback_voice_id: string | null;
  room_generation_budget: number;
  room_generation_used: number;
  updated_at?: string;
}

export interface MaiVoiceProfile {
  id: string;
  status:
    | 'not_set_up'
    | 'awaiting_consent'
    | 'processing'
    | 'ready'
    | 'failed'
    | 'disabled'
    | 'deletion_pending'
    | 'deleted';
  is_enabled: boolean;
  display_name: string | null;
  provider: string;
  consent_version: string | null;
  consented_at: string | null;
  consent_revoked_at: string | null;
  failure_reason: string | null;
  provider_requires_verification: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MaiVoiceConsent {
  purpose: 'voice_profile_creation' | 'broadcast_usage';
  consent_version: string;
  granted: boolean;
  granted_at: string;
  revoked_at: string | null;
  scope_room_kind: MaiVoiceRoomKind | null;
  scope_room_id: string | null;
}

/** Payload of the `voice_play` realtime event. */
export interface MaiVoiceClip {
  room_kind: MaiVoiceRoomKind;
  room_id: string;
  queue_item_id: string;
  message_id: string | null;
  kind: 'voice_message' | 'tts';
  play_token: string;
  /** Epoch milliseconds when the clip should start. */
  play_at: number;
  url: string;
  duration_ms: number | null;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  text: string | null;
  /** False when the clip uses the shared standard voice instead of the sender's own. */
  is_personalized: boolean;
  voice_label: string;
  delivery: 'livekit' | 'local';
  livekit_room_name: string | null;
  publisher_user_id: string | null;
}

/** Payload of the `voice_message` realtime event (metadata only). */
export interface MaiVoiceMessageMeta {
  room_kind: MaiVoiceRoomKind;
  room_id: string;
  message_id: string;
  sender_id: string;
  sender_name: string;
  duration_ms: number;
  expires_at: string;
  created_at: string;
}

export interface MaiVoiceResult<T> {
  /** True when the request succeeded. */
  ok: boolean;
  /** The payload. Only meaningful when `ok` is true. */
  data: T;
  /** Human readable failure message. Empty on success. */
  error: string;
  /** Machine readable failure code. Empty on success. */
  code: string;
}

/** Realtime topic used by the server for a room. */
export function maiVoiceChannel(roomKind: MaiVoiceRoomKind, roomId: string): string {
  return `mai-voice:${roomKind}:${roomId}`;
}

/**
 * Calls an edge function and retries once when the request never reached it.
 *
 * A dropped connection or a cold start that outlasts the gateway makes the
 * browser abort the fetch, which surfaces as "Failed to send a request to the
 * Edge Function". One retry turns most of those into a successful call.
 */
async function invokeWithRetry(
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: any; error: { message: string } | null }> {
  const call = () => supabase.functions.invoke(name, { body });

  try {
    return await call();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/Failed to send a request/i.test(message)) throw err;

    console.warn(`[MaiVoice] ${name} did not reach the server, retrying once…`, err);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return call();
  }
}

/**
 * Calls the `mai-voice` edge function.
 * The function always answers with `{ success, ... }` and, on failure, a
 * human readable `error` plus a machine readable `code`.
 */
export async function maiVoiceInvoke<T extends Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<MaiVoiceResult<T>> {
  try {
    const { data, error } = await invokeWithRetry('mai-voice', body);
    if (error) {
      return {
        ok: false,
        data: {} as T,
        error: error.message || 'Mai Voice is unavailable.',
        code: 'INVOKE_FAILED',
      };
    }
    const payload = (data ?? {}) as Record<string, any>;
    if (payload.success === false) {
      return {
        ok: false,
        data: {} as T,
        error: String(payload.error || 'Mai Voice request failed.'),
        code: String(payload.code || 'BAD_REQUEST'),
      };
    }
    return { ok: true, data: payload as unknown as T, error: '', code: '' };
  } catch (err) {
    console.error('[MaiVoice] Request failed:', err);
    return {
      ok: false,
      data: {} as T,
      error: 'Mai Voice could not be reached. Check your connection and try again.',
      code: 'NETWORK_ERROR',
    };
  }
}

// ── API surface ─────────────────────────────────────────────────────────────

/**
 * Asks the server to delete the storage objects of the voice messages and TTS
 * clips that already expired. The server drops the expired rows and the matching
 * objects in the `mai-voice` bucket, so the one minute lifetime is enforced on
 * the server as well and not only in the UI.
 */
export async function runMaiVoiceMaintenance(): Promise<MaiVoiceResult<{ expired: number }>> {
  return maiVoiceInvoke({ action: 'maintenance' });
}

export async function fetchMaiVoiceProfile(): Promise<MaiVoiceResult<{
  profile: MaiVoiceProfile | null;
  consents: MaiVoiceConsent[];
  consent_version: string;
  provider_configured: boolean;
  provider_supports_cloning: boolean;
}>> {
  return maiVoiceInvoke({ action: 'get-profile' });
}

export async function enrollMaiVoice(params: {
  audioBase64: string;
  mimeType: string;
  durationMs: number;
  displayName?: string;
}): Promise<MaiVoiceResult<{ status: string; requires_verification: boolean; message: string }>> {
  return maiVoiceInvoke({
    action: 'enroll',
    consent: true,
    consentVersion: MAI_VOICE_CONSENT_VERSION,
    ...params,
  });
}

export async function setMaiVoiceEnabled(enabled: boolean): Promise<MaiVoiceResult<{ is_enabled: boolean }>> {
  return maiVoiceInvoke({ action: 'set-enabled', enabled });
}

export async function deleteMaiVoiceProfile(): Promise<MaiVoiceResult<{ status: string }>> {
  return maiVoiceInvoke({ action: 'delete-profile' });
}

export async function setMaiVoiceOptIn(
  roomKind: MaiVoiceRoomKind,
  roomId: string,
  enabled: boolean,
): Promise<MaiVoiceResult<{ tts_enabled: boolean }>> {
  return maiVoiceInvoke({ action: 'set-opt-in', roomKind, roomId, enabled });
}

export async function fetchMaiVoiceRoomSettings(
  roomKind: MaiVoiceRoomKind,
  roomId: string,
): Promise<MaiVoiceResult<{
  settings: MaiVoiceRoomSettings | null;
  my_opt_in: boolean;
  consent_version: string;
  /** LiveKit room the broadcast is running in. */
  livekit_room_name: string | null;
  /** True when this user may publish the room's voice (broadcaster/admin). */
  can_publish_voice: boolean;
}>> {
  return maiVoiceInvoke({ action: 'get-room-settings', roomKind, roomId });
}

export async function updateMaiVoiceRoomSettings(
  roomKind: MaiVoiceRoomKind,
  roomId: string,
  patch: Partial<MaiVoiceRoomSettings>,
): Promise<MaiVoiceResult<{ settings: MaiVoiceRoomSettings }>> {
  return maiVoiceInvoke({ action: 'update-room-settings', roomKind, roomId, ...patch });
}

export async function maiVoiceQueueControl(
  roomKind: MaiVoiceRoomKind,
  roomId: string,
  queueAction: 'pause' | 'resume' | 'clear' | 'skip',
): Promise<MaiVoiceResult<{ action: string }>> {
  return maiVoiceInvoke({ action: 'queue-control', roomKind, roomId, queueAction });
}

export async function moderateMaiVoiceMessage(
  messageId: string,
  moderationAction: 'remove' | 'report',
  reason?: string,
): Promise<MaiVoiceResult<Record<string, unknown>>> {
  return maiVoiceInvoke({ action: 'moderate', messageId, moderationAction, reason });
}

export async function cancelMaiVoiceTts(params: {
  roomKind: MaiVoiceRoomKind;
  roomId: string;
  sourceMessageId: string;
}): Promise<MaiVoiceResult<{ cancelled: boolean }>> {
  return maiVoiceInvoke({ action: 'cancel-tts', ...params });
}

export async function submitMaiVoiceMessage(params: {
  roomKind: MaiVoiceRoomKind;
  roomId: string;
  audioBase64: string;
  mimeType: string;
  durationMs: number;
  idempotencyKey: string;
}): Promise<MaiVoiceResult<{ message_id: string; status: string; expires_at: string }>> {
  return maiVoiceInvoke({ action: 'submit-voice-message', ...params });
}

export async function maiVoicePublisherHeartbeat(
  roomKind: MaiVoiceRoomKind,
  roomId: string,
  livekitRoomName?: string | null,
): Promise<MaiVoiceResult<{ registered: boolean; livekit_room_name: string | null }>> {
  return maiVoiceInvoke({ action: 'publisher-heartbeat', roomKind, roomId, livekitRoomName });
}

export async function unregisterMaiVoicePublisher(
  roomKind: MaiVoiceRoomKind,
  roomId: string,
): Promise<MaiVoiceResult<{ registered: boolean }>> {
  return maiVoiceInvoke({ action: 'unregister-publisher', roomKind, roomId });
}

/**
 * Requests a LiveKit token for the hidden Mai Voice publisher participant.
 *
 * The grant is restricted to the auxiliary audio source: it may publish the
 * generated speech and nothing else.
 */
export async function requestMaiVoicePublisherToken(
  livekitRoomName: string,
): Promise<MaiVoiceResult<{ token: string; url: string }>> {
  try {
    const { data, error } = await invokeWithRetry('livekit-token', {
      room: livekitRoomName,
      roomName: livekitRoomName,
      role: 'mai-voice-publisher',
      mode: 'mai-voice-publisher',
    });

    if (error) {
      return {
        ok: false,
        data: {} as { token: string; url: string },
        error: error.message || 'Could not start the Mai Voice publisher.',
        code: 'PUBLISHER_TOKEN_FAILED',
      };
    }

    const payload = (data ?? {}) as Record<string, any>;
    if (!payload?.token) {
      return {
        ok: false,
        data: {} as { token: string; url: string },
        error: 'The LiveKit publisher token was empty.',
        code: 'PUBLISHER_TOKEN_FAILED',
      };
    }

    return {
      ok: true,
      data: { token: String(payload.token), url: String(payload.url || payload.serverUrl || '') },
      error: '',
      code: '',
    };
  } catch (err) {
    console.error('[MaiVoice] Publisher token request failed:', err);
    return {
      ok: false,
      data: {} as { token: string; url: string },
      error: 'The Mai Voice publisher could not be started. Check your connection and try again.',
      code: 'PUBLISHER_TOKEN_FAILED',
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Encodes recorded audio as base64 for the edge function. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Picks a recorder mime type the browser and the edge function both accept. */
export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/mpeg',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

/** Human readable label for a clip, never implying a voice it does not use. */
export function describeVoiceSource(clip: Pick<MaiVoiceClip, 'is_personalized' | 'voice_label'>): string {
  if (clip.is_personalized) return clip.voice_label || 'Personal voice';
  return 'Mai Voice (standard voice — not the sender’s voice)';
}

// Listener tracking added
export async function recordMaiVoiceMessageListen(messageId: string): Promise<MaiVoiceResult<Record<string, unknown>>> { return maiVoiceInvoke({ action: 'record-listen', messageId }); }
