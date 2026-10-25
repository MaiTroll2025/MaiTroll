/**
 * Mai Voice — single server-side entry point for both Mai Voice features.
 *
 * 1) Mai Voice Chat  : recorded voice messages (max 20s) sent to the live audience.
 * 2) Mai Voice TTS   : personalized speech generated from a sender's own
 *                      authorized voice profile.
 *
 * The function is the only place that may:
 *   - upload or delete voice audio,
 *   - call the TTS provider,
 *   - mutate consent, voice profiles, room settings or the playback queue,
 *   - assert moderation approval.
 *
 * Clients never write to those tables directly (see RLS in the migration).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applyCors, handleCorsPreflight, withCors } from '../_shared/cors.ts';
import {
  getMaiVoiceProvider,
  getFallbackVoiceId,
  VOICE_ENROLLMENT_MAX_BYTES,
  VOICE_ENROLLMENT_MAX_SECONDS,
  VOICE_ENROLLMENT_MIN_BYTES,
  VOICE_ENROLLMENT_MIN_SECONDS,
  VOICE_MESSAGE_MAX_BYTES,
  VOICE_MESSAGE_MAX_SECONDS,
} from '../_shared/maiVoiceProvider.ts';
import {
  canModerateRoom,
  checkVoiceEligibility,
  normalizeSpeechText,
  resolveLiveKitRoomName,
} from '../_shared/maiVoiceModeration.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const _SIGNING_SECRET = Deno.env.get('SIGNING_SECRET_K1') || 'fallback-secret-k1-change-me';

const CONSENT_VERSION = 'mai-voice-2026-10-21';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WORKER_ID = `mai-voice-${crypto.randomUUID()}`;

const ALLOWED_MESSAGE_MIME = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-m4a',
  'audio/aac',
  'video/webm',
  'video/webm;codecs=opus',
]);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Realtime broadcast (same transport the chat gate uses) ───────────────────

async function publishRealtime(channel: string, event: string, payload: unknown): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const endpoint = new URL(
      `/realtime/v1/api/broadcast/${encodeURIComponent(channel)}/events/${encodeURIComponent(event)}`,
      SUPABASE_URL,
    );
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { apikey: SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error('[mai-voice] realtime broadcast failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('[mai-voice] realtime broadcast error:', error instanceof Error ? error.message : error);
  } finally {
    clearTimeout(timeout);
  }
}

function roomChannel(roomKind: string, roomId: string): string {
  return `mai-voice:${roomKind}:${roomId}`;
}

/**
 * Inserts a row into `mai_voice_queue`.
 *
 * `source_presentation` is only present in databases that already ran the
 * matching migration. PostgREST rejects the whole insert when the column is
 * unknown, so the row is retried without it instead of losing the clip.
 */
async function insertQueueItem(payload: Record<string, unknown>): Promise<{ error: any }> {
  const first = await admin.from('mai_voice_queue').insert(payload);
  if (!first.error) return { error: null };

  const message = String(first.error.message || '');
  const missingColumn =
    message.includes('source_presentation') &&
    (message.includes('does not exist') ||
      message.includes('not found') ||
      message.includes('could not find') ||
      message.includes('schema cache'));

  if (!missingColumn) return { error: first.error };

  console.warn('[mai-voice] mai_voice_queue.source_presentation is missing, retrying without it');
  const { source_presentation: _ignored, ...rest } = payload as Record<string, unknown>;
  const second = await admin.from('mai_voice_queue').insert(rest);
  return { error: second.error };
}

// ── Small helpers ───────────────────────────────────────────────────────────

function jsonError(message: string, status = 400, code = 'BAD_REQUEST') {
  return withCors({ success: false, error: message, code }, status);
}

function jsonOk(data: Record<string, unknown>, status = 200) {
  return withCors({ success: true, ...data }, status);
}

function base64ToBytes(base64: string): Uint8Array {
  const cleaned = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function extensionFor(mimeType: string): string {
  const m = (mimeType || '').toLowerCase();
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('wav')) return 'wav';
  if (m.includes('aac')) return 'aac';
  return 'webm';
}

/** Signs a short-lived playback URL for a stored clip. */
async function signPlaybackUrl(path: string, expiresInSeconds: number): Promise<string | null> {
  const { data, error } = await admin.storage.from('mai-voice').createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error('[mai-voice] failed to sign url:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Writes an audit row using the platform's existing audit_logs convention. */
async function audit(
  action: string,
  actorId: string | null,
  targetId: string | null,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await admin.from('audit_logs').insert({
      action,
      user_id: actorId,
      actor_id: actorId,
      target_id: targetId,
      details,
    });
  } catch (error) {
    console.error('[mai-voice] audit write failed:', error instanceof Error ? error.message : error);
  }
}

async function logSecurityEvent(
  eventType: string,
  userId: string,
  metadata: Record<string, unknown>,
  severity: 'low' | 'medium' | 'high' = 'low',
): Promise<void> {
  try {
    await admin.from('security_events').insert({
      event_type: eventType,
      severity,
      status: 'open',
      user_id: userId,
      source: 'mai_voice',
      title: eventType,
      description: eventType,
      metadata,
      risk_score: severity === 'high' ? 70 : severity === 'medium' ? 40 : 10,
    });
  } catch {
    // Never fail a request because auditing failed.
  }
}

interface Actor {
  userId: string;
  isService: boolean;
}

/**
 * True when the bearer token is a service role credential.
 *
 * The platform can hand the function either the raw secret (`sb_secret_…` or the
 * legacy JWT stored in SUPABASE_SERVICE_ROLE_KEY) or a service role JWT that
 * the gateway minted from it, so a plain string comparison is not enough.
 */
function isServiceRoleToken(token: string): boolean {
  if (!token) return false;
  if (SERVICE_ROLE_KEY && token === SERVICE_ROLE_KEY) return true;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = JSON.parse(atob(padded));
    return json?.role === 'service_role' || json?.role === 'supabase_service_role';
  } catch {
    return false;
  }
}

async function resolveActor(req: Request): Promise<Actor | null> {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  if (isServiceRoleToken(token)) {
    return { userId: '', isService: true };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return { userId: data.user.id, isService: false };
}

// ── Voice profile helpers ────────────────────────────────────────────────────

async function loadProfile(userId: string) {
  const { data } = await admin
    .from('mai_voice_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

/** A profile may be used for synthesis only when it is ready and enabled. */
function isProfileUsable(profile: any): boolean {
  return (
    !!profile &&
    profile.status === 'ready' &&
    profile.is_enabled === true &&
    !profile.deleted_at &&
    !!profile.provider_voice_id
  );
}

async function ensureConsent(
  userId: string,
  purpose: 'voice_profile_creation' | 'broadcast_usage',
  granted: boolean,
  scope?: { roomKind: 'stream' | 'battle'; roomId: string },
): Promise<void> {
  await admin.from('mai_voice_consents').insert({
    user_id: userId,
    consent_version: CONSENT_VERSION,
    purpose,
    scope_room_kind: scope?.roomKind ?? null,
    scope_room_id: scope?.roomId ?? null,
    granted,
  });
}

// ── Actions ─────────────────────────────────────────────────────────────────

async function actionGetProfile(actor: Actor) {
  const profile = await loadProfile(actor.userId);
  const { data: consents } = await admin
    .from('mai_voice_consents')
    .select('purpose, consent_version, granted, granted_at, revoked_at, scope_room_kind, scope_room_id')
    .eq('user_id', actor.userId)
    .order('granted_at', { ascending: false })
    .limit(25);

  const provider = getMaiVoiceProvider();
  return jsonOk({
    profile: profile
      ? {
          id: profile.id,
          status: profile.status,
          is_enabled: profile.is_enabled,
          display_name: profile.display_name,
          provider: profile.provider,
          consent_version: profile.consent_version,
          consented_at: profile.consented_at,
          consent_revoked_at: profile.consent_revoked_at,
          failure_reason: profile.failure_reason,
          provider_requires_verification: profile.provider_requires_verification,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        }
      : null,
    consents: consents ?? [],
    consent_version: CONSENT_VERSION,
    provider_configured: provider.isConfigured(),
    provider_supports_cloning: provider.supportsCloning(),
  });
}

async function actionEnroll(actor: Actor, body: any) {
  if (body.consent !== true) {
    return jsonError('Consent is required before a voice profile can be created.', 400, 'CONSENT_REQUIRED');
  }
  if (body.consentVersion !== CONSENT_VERSION) {
    return jsonError('The voice consent version is out of date. Please review and accept the current terms.', 400, 'CONSENT_VERSION_MISMATCH');
  }

  const provider = getMaiVoiceProvider();
  if (!provider.isConfigured()) {
    return jsonError('Voice enrollment is temporarily unavailable.', 503, 'PROVIDER_UNAVAILABLE');
  }
  if (!provider.supportsCloning()) {
    return jsonError('Voice enrollment is temporarily unavailable.', 503, 'PROVIDER_UNAVAILABLE');
  }

  const mimeType = String(body.mimeType || '').toLowerCase();
  if (!ALLOWED_MESSAGE_MIME.has(mimeType)) {
    return jsonError('Unsupported audio format for voice enrollment.', 400, 'UNSUPPORTED_MIME');
  }

  let audio: Uint8Array;
  try {
    audio = base64ToBytes(String(body.audioBase64 || ''));
  } catch {
    return jsonError('The recorded sample could not be read.', 400, 'INVALID_AUDIO');
  }
  if (audio.byteLength < VOICE_ENROLLMENT_MIN_BYTES) {
    return jsonError('The recording was too short. Please record a longer sample.', 400, 'AUDIO_TOO_SHORT');
  }
  if (audio.byteLength > VOICE_ENROLLMENT_MAX_BYTES) {
    return jsonError('The recording was too large. Please record a shorter sample.', 400, 'AUDIO_TOO_LARGE');
  }

  const durationSeconds = Number(body.durationMs || 0) / 1000;
  if (durationSeconds < VOICE_ENROLLMENT_MIN_SECONDS) {
    return jsonError(
      `Please record at least ${VOICE_ENROLLMENT_MIN_SECONDS} seconds of clear speech.`,
      400,
      'AUDIO_TOO_SHORT',
    );
  }
  if (durationSeconds > VOICE_ENROLLMENT_MAX_SECONDS) {
    return jsonError(
      `Please keep the sample under ${VOICE_ENROLLMENT_MAX_SECONDS} seconds.`,
      400,
      'AUDIO_TOO_LONG',
    );
  }

  const existing = await loadProfile(actor.userId);
  if (existing && (existing.status === 'deletion_pending' || existing.status === 'deleted')) {
    return jsonError('Your voice profile is being deleted. Create a new one once deletion completes.', 409, 'DELETION_PENDING');
  }

  // Create (or reuse) the profile row in a non-usable state.
  const { data: profile, error: profileError } = await admin
    .from('mai_voice_profiles')
    .upsert(
      {
        user_id: actor.userId,
        provider: provider.id,
        status: 'processing',
        is_enabled: true,
        consent_version: CONSENT_VERSION,
        consented_at: new Date().toISOString(),
        consent_revoked_at: null,
        failure_reason: null,
        provider_error: null,
        provider_requires_verification: false,
        display_name: String(body.displayName || '').slice(0, 60) || null,
        sample_duration_seconds: durationSeconds,
        sample_mime_type: mimeType,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();

  if (profileError || !profile) {
    console.error('[mai-voice] failed to upsert profile:', profileError?.message);
    return jsonError('Could not start voice enrollment.', 500, 'PROFILE_WRITE_FAILED');
  }

  await ensureConsent(actor.userId, 'voice_profile_creation', true);

  // Store the sample privately before sending it to the provider.
  const samplePath = `samples/${actor.userId}/${crypto.randomUUID()}.${extensionFor(mimeType)}`;
  const { error: uploadError } = await admin.storage
    .from('mai-voice')
    .upload(samplePath, audio, { contentType: mimeType, upsert: false });
  if (uploadError) {
    console.error('[mai-voice] sample upload failed:', uploadError.message);
    await admin
      .from('mai_voice_profiles')
      .update({ status: 'failed', failure_reason: 'Could not store the voice sample.' })
      .eq('id', profile.id);
    return jsonError('Could not store the voice sample.', 500, 'UPLOAD_FAILED');
  }

  const enrollment = await provider.createVoice({
    audio,
    mimeType,
    displayName: profile.display_name || actor.userId.slice(0, 8),
    userId: actor.userId,
  });

  if (!enrollment.providerVoiceId) {
    await admin
      .from('mai_voice_profiles')
      .update({
        status: 'failed',
        failure_reason: enrollment.error || 'The voice provider rejected the sample.',
        provider_error: enrollment.error || null,
      })
      .eq('id', profile.id);
    await logSecurityEvent('mai_voice_enrollment_failed', actor.userId, { reason: enrollment.error ?? 'unknown' }, 'medium');
    return jsonError(enrollment.error || 'The voice provider rejected the sample.', 502, 'PROVIDER_REJECTED');
  }

  const usable = !enrollment.requiresVerification && enrollment.ready;
  await admin
    .from('mai_voice_profiles')
    .update({
      status: usable ? 'ready' : 'processing',
      provider_voice_id: enrollment.providerVoiceId,
      provider_requires_verification: enrollment.requiresVerification,
      sample_path: samplePath,
      failure_reason: usable ? null : enrollment.error || 'Waiting for voice verification.',
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  await audit('mai_voice.enroll', actor.userId, profile.id, {
    status: usable ? 'ready' : 'processing',
    provider: provider.id,
    requires_verification: enrollment.requiresVerification,
  });

  return jsonOk({
    status: usable ? 'ready' : 'processing',
    requires_verification: enrollment.requiresVerification,
    message: usable
      ? 'Your Mai Voice profile is ready.'
      : 'Your voice is being verified. You will be able to use it once it is approved.',
  });
}

async function actionSetEnabled(actor: Actor, body: any) {
  const enabled = body.enabled === true;
  const profile = await loadProfile(actor.userId);
  if (!profile) {
    return jsonError('You do not have a Mai Voice profile yet.', 404, 'PROFILE_NOT_FOUND');
  }
  if (profile.status === 'deletion_pending' || profile.status === 'deleted') {
    return jsonError('This voice profile is being deleted.', 409, 'DELETION_PENDING');
  }

  await admin
    .from('mai_voice_profiles')
    .update({
      is_enabled: enabled,
      status: enabled ? (profile.status === 'disabled' ? 'ready' : profile.status) : 'disabled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', actor.userId);

  await audit('mai_voice.set_enabled', actor.userId, profile.id, { enabled });
  return jsonOk({ is_enabled: enabled });
}

async function actionDeleteProfile(actor: Actor) {
  const profile = await loadProfile(actor.userId);
  if (!profile) {
    return jsonOk({ status: 'deleted', deleted: true });
  }

  // 1. Stop authorizing new speech immediately.
  await admin
    .from('mai_voice_profiles')
    .update({
      status: 'deletion_pending',
      is_enabled: false,
      consent_revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  await ensureConsent(actor.userId, 'voice_profile_creation', false);

  // 2. Drop anything still queued for this user.
  await admin
    .from('mai_voice_queue')
    .update({ status: 'removed', last_error: 'Voice profile deleted', updated_at: new Date().toISOString() })
    .eq('user_id', actor.userId)
    .in('status', ['pending', 'generating', 'ready']);

  // 3. Delete the provider-side voice.
  let providerDeleted = true;
  let providerError: string | undefined;
  if (profile.provider_voice_id) {
    const result = await getMaiVoiceProvider().deleteVoice(profile.provider_voice_id);
    providerDeleted = result.deleted;
    providerError = result.error;
  }

  // 4. Delete the stored sample.
  if (profile.sample_path) {
    await admin.storage.from('mai-voice').remove([profile.sample_path]);
  }

  await admin
    .from('mai_voice_profiles')
    .update({
      status: 'deleted',
      provider_voice_id: null,
      sample_path: null,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      failure_reason: providerDeleted ? null : providerError || 'Provider deletion failed.',
    })
    .eq('id', profile.id);

  await audit('mai_voice.delete_profile', actor.userId, profile.id, { provider_deleted: providerDeleted });

  return jsonOk({
    status: 'deleted',
    provider_deleted: providerDeleted,
    provider_error: providerError ?? null,
  });
}

async function actionSetOptIn(actor: Actor, body: any) {
  const roomKind = body.roomKind === 'battle' ? 'battle' : 'stream';
  const roomId = String(body.roomId || '');
  const enabled = body.enabled === true;
  if (!UUID_REGEX.test(roomId)) {
    return jsonError('Invalid room.', 400, 'INVALID_ROOM');
  }

  const { error } = await admin.from('mai_voice_room_optins').upsert(
    {
      room_kind: roomKind,
      room_id: roomId,
      user_id: actor.userId,
      tts_enabled: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'room_kind,room_id,user_id' },
  );
  if (error) {
    console.error('[mai-voice] opt-in write failed:', error.message);
    return jsonError('Could not update your voice preference.', 500, 'OPTIN_WRITE_FAILED');
  }

  if (enabled) {
    await ensureConsent(actor.userId, 'broadcast_usage', true, { roomKind, roomId });
  }

  return jsonOk({ tts_enabled: enabled });
}

async function actionSubmitVoiceMessage(actor: Actor, body: any) {
  const roomKind = body.roomKind === 'battle' ? 'battle' : 'stream';
  const roomId = String(body.roomId || '');
  if (!UUID_REGEX.test(roomId)) {
    return jsonError('Invalid room.', 400, 'INVALID_ROOM');
  }

  const idempotencyKey = String(body.idempotencyKey || '').slice(0, 120);
  if (!idempotencyKey) {
    return jsonError('Missing idempotency key.', 400, 'MISSING_IDEMPOTENCY_KEY');
  }

  // Idempotent replay: if the same submission already exists, return it.
  const { data: existing } = await admin
    .from('mai_voice_messages')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing) {
    return jsonOk({ message_id: existing.id, status: existing.status, duplicate: true });
  }

  const eligibility = await checkVoiceEligibility(admin, actor.userId, roomKind, roomId);
  if (!eligibility.allowed) {
    return jsonError(eligibility.reason, eligibility.status, eligibility.code);
  }

  const { data: settings } = await admin
    .from('mai_voice_room_settings')
    .select('*')
    .eq('room_kind', roomKind)
    .eq('room_id', roomId)
    .maybeSingle();

  if (settings && settings.voice_chat_enabled === false) {
    return jsonError('The broadcaster has turned off voice messages for this broadcast.', 403, 'VOICE_CHAT_DISABLED');
  }

  const mimeType = String(body.mimeType || '').toLowerCase();
  if (!ALLOWED_MESSAGE_MIME.has(mimeType)) {
    return jsonError('Unsupported audio format.', 400, 'UNSUPPORTED_MIME');
  }

  const durationMs = Math.round(Number(body.durationMs || 0));
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return jsonError('The recording length could not be determined.', 400, 'INVALID_DURATION');
  }
  if (durationMs > VOICE_MESSAGE_MAX_SECONDS * 1000) {
    return jsonError('Voice messages are limited to 20 seconds.', 400, 'DURATION_EXCEEDED');
  }

  let audio: Uint8Array;
  try {
    audio = base64ToBytes(String(body.audioBase64 || ''));
  } catch {
    return jsonError('The recording could not be read.', 400, 'INVALID_AUDIO');
  }
  if (audio.byteLength > VOICE_MESSAGE_MAX_BYTES) {
    return jsonError('The recording is too large.', 400, 'AUDIO_TOO_LARGE');
  }
  if (audio.byteLength < 512) {
    return jsonError('The recording was empty.', 400, 'AUDIO_EMPTY');
  }

  // Per-user cooldown (uses the same rule as the room's TTS cooldown).
  const cooldownSeconds = settings?.cooldown_seconds ?? 10;
  const { data: lastItem } = await admin
    .from('mai_voice_queue')
    .select('created_at')
    .eq('room_kind', roomKind)
    .eq('room_id', roomId)
    .eq('user_id', actor.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastItem?.created_at && cooldownSeconds > 0) {
    const elapsed = (Date.now() - new Date(lastItem.created_at).getTime()) / 1000;
    if (elapsed < cooldownSeconds) {
      return jsonError(
        `Please wait ${Math.ceil(cooldownSeconds - elapsed)}s before sending another voice message.`,
        429,
        'COOLDOWN',
      );
    }
  }

  // Queue cap: keep the room from being flooded with voice.
  const maxQueueSize = settings?.max_queue_size ?? 10;
  const { count: pendingCount } = await admin
    .from('mai_voice_queue')
    .select('id', { count: 'exact', head: true })
    .eq('room_kind', roomKind)
    .eq('room_id', roomId)
    .in('status', ['pending', 'generating', 'ready', 'playing']);
  if ((pendingCount ?? 0) >= maxQueueSize) {
    return jsonError('The voice queue is full. Please try again in a moment.', 429, 'QUEUE_FULL');
  }

  const messageId = crypto.randomUUID();
  const storagePath = `messages/${roomKind}/${roomId}/${messageId}.${extensionFor(mimeType)}`;

  const { error: uploadError } = await admin.storage
    .from('mai-voice')
    .upload(storagePath, audio, { contentType: mimeType, upsert: false });
  if (uploadError) {
    console.error('[mai-voice] voice message upload failed:', uploadError.message);
    return jsonError('The recording could not be uploaded.', 500, 'UPLOAD_FAILED');
  }

  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const { data: message, error: insertError } = await admin
    .from('mai_voice_messages')
    .insert({
      id: messageId,
      room_kind: roomKind,
      room_id: roomId,
      stream_id: eligibility.streamIds[0] ?? null,
      sender_id: actor.userId,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: audio.byteLength,
      duration_ms: durationMs,
      status: 'approved',
      moderation_status: 'approved',
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (insertError || !message) {
    console.error('[mai-voice] voice message insert failed:', insertError?.message);
    await admin.storage.from('mai-voice').remove([storagePath]);
    return jsonError('The voice message could not be saved.', 500, 'INSERT_FAILED');
  }

  const { error: queueError } = await insertQueueItem({
    room_kind: roomKind,
    room_id: roomId,
    kind: 'voice_message',
    message_id: messageId,
    user_id: actor.userId,
    duration_ms: durationMs,
    storage_path: storagePath,
    priority: 200,
    status: 'ready',
    delivery: 'auto',
    expires_at: expiresAt,
    idempotency_key: `voice-message:${idempotencyKey}`,
    source_presentation: 'chat',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (queueError) {
    console.error('[mai-voice] queue insert failed:', queueError.message);
    await admin.storage.from('mai-voice').remove([storagePath]);
    await admin.from('mai_voice_messages').delete().eq('id', messageId);
    return jsonError('The voice message could not be queued.', 500, 'QUEUE_FAILED');
  }

  // Let the room know a new voice message exists (metadata only, no audio URL).
  await publishRealtime(roomChannel(roomKind, roomId), 'voice_message', {
    room_kind: roomKind,
    room_id: roomId,
    message_id: messageId,
    sender_id: actor.userId,
    sender_name: (eligibility.profile.display_name as string) || (eligibility.profile.username as string) || 'Viewer',
    duration_ms: durationMs,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    listener_count: 0,
  });

  await audit('mai_voice.voice_message_sent', actor.userId, messageId, {
    room_kind: roomKind,
    room_id: roomId,
    duration_ms: durationMs,
    size_bytes: audio.byteLength,
  });

  // Kick the queue so the clip plays promptly.
  await processQueue(roomKind, roomId).catch((error) =>
    console.error('[mai-voice] queue pump failed:', error instanceof Error ? error.message : error),
  );

  return jsonOk({ message_id: messageId, status: 'approved', expires_at: expiresAt });
}
async function actionGetRoomSettings(actor: Actor, body: any) {
  const roomKind = body.roomKind === 'battle' ? 'battle' : 'stream';
  const roomId = String(body.roomId || '');
  if (!UUID_REGEX.test(roomId)) {
    return jsonError('Invalid room.', 400, 'INVALID_ROOM');
  }

  const { data: settings } = await admin.rpc('mai_voice_get_room_settings', {
    p_room_kind: roomKind,
    p_room_id: roomId,
  });

  const { data: optin } = await admin
    .from('mai_voice_room_optins')
    .select('tts_enabled')
    .eq('room_kind', roomKind)
    .eq('room_id', roomId)
    .eq('user_id', actor.userId)
    .maybeSingle();

  const livekitRoomName = await resolveLiveKitRoomName(admin, roomKind, roomId);
  const canPublishVoice = await canPublishRoomVoice(roomKind, roomId, actor.userId);

  return jsonOk({
    settings: settings ?? null,
    my_opt_in: optin?.tts_enabled === true,
    consent_version: CONSENT_VERSION,
    livekit_room_name: livekitRoomName,
    can_publish_voice: canPublishVoice,
  });
}

async function actionUpdateRoomSettings(actor: Actor, body: any) {
  const roomKind = body.roomKind === 'battle' ? 'battle' : 'stream';
  const roomId = String(body.roomId || '');
  if (!UUID_REGEX.test(roomId)) {
    return jsonError('Invalid room.', 400, 'INVALID_ROOM');
  }

  const allowed = await canModerateRoom(admin, roomKind, roomId, actor.userId);
  if (!allowed) {
    await logSecurityEvent('mai_voice_settings_denied', actor.userId, { room_kind: roomKind, room_id: roomId }, 'medium');
    return jsonError('You are not allowed to change the voice settings for this broadcast.', 403, 'NOT_ALLOWED');
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: actor.userId };
  const booleans = [
    'tts_enabled',
    'chat_tts_enabled',
    'flying_chat_tts_enabled',
    'voice_chat_enabled',
    'playback_paused',
    'fallback_voice_enabled',
  ];
  for (const key of booleans) {
    if (typeof body[key] === 'boolean') patch[key] = body[key];
  }
  if (typeof body.playback_volume === 'number' && body.playback_volume >= 0 && body.playback_volume <= 1) {
    patch.playback_volume = body.playback_volume;
  }
  if (typeof body.max_queue_size === 'number' && body.max_queue_size >= 1 && body.max_queue_size <= 50) {
    patch.max_queue_size = Math.round(body.max_queue_size);
  }
  if (typeof body.cooldown_seconds === 'number' && body.cooldown_seconds >= 0 && body.cooldown_seconds <= 600) {
    patch.cooldown_seconds = Math.round(body.cooldown_seconds);
  }
  if (typeof body.max_text_length === 'number' && body.max_text_length >= 20 && body.max_text_length <= 1000) {
    patch.max_text_length = Math.round(body.max_text_length);
  }
  if (typeof body.fallback_voice_id === 'string' || body.fallback_voice_id === null) {
    patch.fallback_voice_id = body.fallback_voice_id ?? null;
  }

  await admin.rpc('mai_voice_get_room_settings', { p_room_kind: roomKind, p_room_id: roomId });

  const { data, error } = await admin
    .from('mai_voice_room_settings')
    .upsert({ ...patch, room_kind: roomKind, room_id: roomId }, { onConflict: 'room_kind,room_id' })
    .select('*')
    .single();
  if (error) {
    console.error('[mai-voice] settings update failed:', error.message);
    return jsonError('Could not update the voice settings.', 500, 'SETTINGS_WRITE_FAILED');
  }

  // Turning a feature off must also stop queued work for that feature.
  if (patch.tts_enabled === false) {
    await admin
      .from('mai_voice_queue')
      .update({ status: 'skipped', last_error: 'TTS disabled by broadcaster', updated_at: new Date().toISOString() })
      .eq('room_kind', roomKind)
      .eq('room_id', roomId)
      .eq('kind', 'tts')
      .in('status', ['pending', 'generating', 'ready']);
  }
  if (patch.voice_chat_enabled === false) {
    await admin
      .from('mai_voice_queue')
      .update({ status: 'skipped', last_error: 'Voice chat disabled by broadcaster', updated_at: new Date().toISOString() })
      .eq('room_kind', roomKind)
      .eq('room_id', roomId)
      .eq('kind', 'voice_message')
      .in('status', ['pending', 'generating', 'ready']);
  }

  await audit('mai_voice.room_settings_updated', actor.userId, roomId, { room_kind: roomKind, patch });

  await publishRealtime(roomChannel(roomKind, roomId), 'voice_settings', {
    room_kind: roomKind,
    room_id: roomId,
    settings: {
      tts_enabled: data.tts_enabled,
      chat_tts_enabled: data.chat_tts_enabled,
      flying_chat_tts_enabled: data.flying_chat_tts_enabled,
      voice_chat_enabled: data.voice_chat_enabled,
      playback_paused: data.playback_paused,
      playback_volume: data.playback_volume,
    },
  });

  return jsonOk({ settings: data });
}

async function actionQueueControl(actor: Actor, body: any) {
  const roomKind = body.roomKind === 'battle' ? 'battle' : 'stream';
  const roomId = String(body.roomId || '');
  if (!UUID_REGEX.test(roomId)) {
    return jsonError('Invalid room.', 400, 'INVALID_ROOM');
  }
  const allowed = await canModerateRoom(admin, roomKind, roomId, actor.userId);
  if (!allowed) {
    return jsonError('You are not allowed to control the voice queue.', 403, 'NOT_ALLOWED');
  }

  const action = String(body.action || '');
  const now = new Date().toISOString();

  if (action === 'pause') {
    await admin
      .from('mai_voice_room_settings')
      .update({ playback_paused: true, updated_at: now, updated_by: actor.userId })
      .eq('room_kind', roomKind)
      .eq('room_id', roomId);
  } else if (action === 'resume') {
    await admin
      .from('mai_voice_room_settings')
      .update({ playback_paused: false, updated_at: now, updated_by: actor.userId })
      .eq('room_kind', roomKind)
      .eq('room_id', roomId);
  } else if (action === 'clear') {
    await admin
      .from('mai_voice_queue')
      .update({ status: 'skipped', last_error: 'Queue cleared by moderator', updated_at: now })
      .eq('room_kind', roomKind)
      .eq('room_id', roomId)
      .in('status', ['pending', 'generating', 'ready']);
  } else if (action === 'skip') {
    await admin
      .from('mai_voice_queue')
      .update({ status: 'skipped', last_error: 'Skipped by moderator', updated_at: now })
      .eq('room_kind', roomKind)
      .eq('room_id', roomId)
      .eq('status', 'playing');
  } else {
    return jsonError('Unknown queue action.', 400, 'UNKNOWN_ACTION');
  }

  await publishRealtime(roomChannel(roomKind, roomId), 'voice_state', {
    room_kind: roomKind,
    room_id: roomId,
    action,
  });

  return jsonOk({ action });
}

/** Removes a queued/played voice message at the request of a moderator. */
async function actionModerate(actor: Actor, body: any) {
  const messageId = String(body.messageId || '');
  if (!UUID_REGEX.test(messageId)) {
    return jsonError('Invalid message.', 400, 'INVALID_MESSAGE');
  }

  const { data: message } = await admin
    .from('mai_voice_messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle();
  if (!message) {
    return jsonError('Message not found.', 404, 'NOT_FOUND');
  }

  const allowed = await canModerateRoom(admin, message.room_kind, message.room_id, actor.userId);
  if (!allowed) {
    return jsonError('You are not allowed to moderate voice messages here.', 403, 'NOT_ALLOWED');
  }

  const action = String(body.action || 'remove');

  if (action === 'remove') {
    await admin
      .from('mai_voice_messages')
      .update({
        status: 'removed',
        moderation_status: 'removed',
        moderation_reason: body.reason ? String(body.reason).slice(0, 500) : null,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', messageId);
    await admin
      .from('mai_voice_queue')
      .update({ status: 'removed', last_error: 'Removed by moderator', updated_at: new Date().toISOString() })
      .eq('message_id', messageId)
      .in('status', ['pending', 'generating', 'ready']);
    if (message.storage_path) {
      await admin.storage.from('mai-voice').remove([message.storage_path]);
    }
    await publishRealtime(roomChannel(message.room_kind, message.room_id), 'voice_removed', {
      room_kind: message.room_kind,
      room_id: message.room_id,
      message_id: messageId,
    });
    await audit('mai_voice.message_removed', actor.userId, messageId, {
      room_kind: message.room_kind,
      room_id: message.room_id,
      sender_id: message.sender_id,
    });
    return jsonOk({ removed: true });
  }

  if (action === 'report') {
    await admin
      .from('mai_voice_messages')
      .update({ report_count: (message.report_count ?? 0) + 1 })
      .eq('id', messageId);

    const { data: existingReport } = await admin
      .from('user_reports')
      .select('id')
      .eq('reported_user_id', message.sender_id)
      .eq('report_type', 'voice_message')
      .eq('metadata->>voice_message_id', messageId)
      .maybeSingle();

    if (!existingReport) {
      await admin.from('user_reports').insert({
        user_id: actor.userId,
        reported_by_id: actor.userId,
        reported_user_id: message.sender_id,
        // `target_user_id` is a foreign key to user_profiles, so the voice
        // message id is carried in the metadata instead.
        target_user_id: null,
        report_type: 'voice_message',
        category: 'harassment',
        reason: body.reason ? String(body.reason).slice(0, 500) : 'Inappropriate voice message',
        description: `Voice message ${messageId} reported in ${message.room_kind} ${message.room_id}`,
        status: 'pending',
        priority: 'normal',
        metadata: { voice_message_id: messageId, room_kind: message.room_kind, room_id: message.room_id },
      });
    }

    await audit('mai_voice.message_reported', actor.userId, messageId, { sender_id: message.sender_id });
    return jsonOk({ reported: true });
  }

  return jsonError('Unknown moderation action.', 400, 'UNKNOWN_ACTION');
}

/** Cancels a queued TTS item (used when the source chat message is deleted). */
async function actionCancelTts(actor: Actor, body: any) {
  const sourceMessageId = String(body.sourceMessageId || '');
  if (!UUID_REGEX.test(sourceMessageId)) {
    return jsonError('Invalid message.', 400, 'INVALID_MESSAGE');
  }
  const roomKind = body.roomKind === 'battle' ? 'battle' : 'stream';
  const roomId = String(body.roomId || '');
  if (!UUID_REGEX.test(roomId)) {
    return jsonError('Invalid room.', 400, 'INVALID_ROOM');
  }

  await admin
    .from('mai_voice_queue')
    .update({ status: 'removed', last_error: 'Source message removed', updated_at: new Date().toISOString() })
    .eq('room_kind', roomKind)
    .eq('room_id', roomId)
    .eq('source_message_id', sourceMessageId)
    .eq('kind', 'tts')
    .in('status', ['pending', 'generating', 'ready']);

  return jsonOk({ cancelled: true });
}

/**
 * The user ids that may publish the room's voice.
 *
 * This mirrors the authorization the `livekit-token` function applies to the
 * Mai Voice publisher grant. Both sides must agree, otherwise the server
 * would route a clip to a publisher that is not allowed to publish it and the
 * audience would not hear anything.
 */
async function resolveRoomBroadcasters(
  roomKind: 'stream' | 'battle',
  roomId: string,
): Promise<string[]> {
  const columns = 'broadcaster_id, user_id, host_id, owner_id';

  if (roomKind === 'stream') {
    const { data } = await admin
      .from('streams')
      .select(columns)
      .eq('id', roomId)
      .maybeSingle();
    if (!data) return [];
    return [data.broadcaster_id, data.user_id, data.host_id, data.owner_id].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
  }

  const { data: battle } = await admin
    .from('battles')
    .select('challenger_stream_id, opponent_stream_id')
    .eq('id', roomId)
    .maybeSingle();
  if (!battle) return [];

  const streamIds = [battle.challenger_stream_id, battle.opponent_stream_id].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  if (!streamIds.length) return [];

  const { data: streams } = await admin
    .from('streams')
    .select(columns)
    .in('id', streamIds);

  return (streams || []).flatMap((stream: any) => [
    stream.broadcaster_id,
    stream.user_id,
    stream.host_id,
    stream.owner_id,
  ]).filter((value): value is string => typeof value === 'string' && value.length > 0);
}

/** True when the user owns the room (broadcaster) or is a platform admin. */
async function canPublishRoomVoice(
  roomKind: 'stream' | 'battle',
  roomId: string,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await admin
    .from('user_profiles')
    .select('is_admin, is_super_admin, role')
    .eq('id', userId)
    .maybeSingle();

  if (profile) {
    const role = String(profile.role || '').toLowerCase();
    if (
      profile.is_admin === true ||
      profile.is_super_admin === true ||
      ['admin', 'super_admin', 'superadmin', 'owner'].includes(role)
    ) {
      return true;
    }
  }

  const broadcasters = await resolveRoomBroadcasters(roomKind, roomId);
  return broadcasters.includes(userId);
}

/** Registers (or refreshes) the room's LiveKit voice publisher. */
async function actionPublisherHeartbeat(actor: Actor, body: any) {
  const roomKind = body.roomKind === 'battle' ? 'battle' : 'stream';
  const roomId = String(body.roomId || '');
  if (!UUID_REGEX.test(roomId)) {
    return jsonError('Invalid room.', 400, 'INVALID_ROOM');
  }

  /*
   * Only the broadcaster of the room (or a platform admin) may become the
   * voice publisher. A viewer can never register a publisher, otherwise anyone
   * could hijack the delivery path for the whole audience.
   */
  const mayPublish = await canPublishRoomVoice(roomKind, roomId, actor.userId);
  if (!mayPublish) {
    await logSecurityEvent(
      'mai_voice_publisher_denied',
      actor.userId,
      { room_kind: roomKind, room_id: roomId },
      'low',
    );
    return jsonError(
      'You are not authorized to publish voice for this room.',
      403,
      'PUBLISHER_NOT_AUTHORIZED',
    );
  }

  const livekitRoomName =
    (body.livekitRoomName as string) || (await resolveLiveKitRoomName(admin, roomKind, roomId));

  const { error } = await admin.from('mai_voice_publishers').upsert(
    {
      room_kind: roomKind,
      room_id: roomId,
      publisher_user_id: actor.userId,
      livekit_room_name: livekitRoomName,
      last_heartbeat_at: new Date().toISOString(),
    },
    { onConflict: 'room_kind,room_id,publisher_user_id' },
  );
  if (error) {
    console.error('[mai-voice] publisher heartbeat failed:', error.message);
    return jsonError('Could not register the voice publisher.', 500, 'HEARTBEAT_FAILED');
  }
  return jsonOk({ registered: true, livekit_room_name: livekitRoomName });
}

async function actionUnregisterPublisher(actor: Actor, body: any) {
  const roomKind = body.roomKind === 'battle' ? 'battle' : 'stream';
  const roomId = String(body.roomId || '');
  if (!UUID_REGEX.test(roomId)) return jsonError('Invalid room.', 400, 'INVALID_ROOM');

  await admin
    .from('mai_voice_publishers')
    .delete()
    .eq('room_kind', roomKind)
    .eq('room_id', roomId)
    .eq('publisher_user_id', actor.userId);
  return jsonOk({ registered: false });
}

/** Issues a short-lived playback URL for an approved voice message. */
async function actionGetPlaybackUrl(actor: Actor, body: any) {
  const messageId = String(body.messageId || '');
  if (!UUID_REGEX.test(messageId)) {
    return jsonError('Invalid message.', 400, 'INVALID_MESSAGE');
  }

  const { data: message } = await admin
    .from('mai_voice_messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle();
  if (!message) return jsonError('Message not found.', 404, 'NOT_FOUND');
  if (message.status === 'removed' || message.deleted_at) {
    return jsonError('This voice message was removed.', 404, 'REMOVED');
  }
  if (new Date(message.expires_at).getTime() < Date.now()) {
    return jsonError('This voice message has expired.', 410, 'EXPIRED');
  }

  const url = await signPlaybackUrl(message.storage_path, 120);
  if (!url) return jsonError('Could not prepare the recording.', 500, 'SIGN_FAILED');

  return jsonOk({ url, expires_in: 120, duration_ms: message.duration_ms });
}

/**
 * Enqueues a TTS item for a chat message. Internal action — called by the
 * `send-message` edge function with the service role so both chat paths share
 * exactly one implementation of the eligibility rules.
 */
async function actionEnqueueTts(actor: Actor, body: any) {
  const userId = String(body.userId || actor.userId || '');
  if (!UUID_REGEX.test(userId)) {
    return jsonError('Invalid user.', 400, 'INVALID_USER');
  }
  const roomKind = body.roomKind === 'battle' ? 'battle' : 'stream';
  const roomId = String(body.roomId || '');
  if (!UUID_REGEX.test(roomId)) {
    return jsonError('Invalid room.', 400, 'INVALID_ROOM');
  }
  const presentation: 'chat' | 'flying_chat' = body.presentation === 'flying_chat' ? 'flying_chat' : 'chat';

  // The settings row is created on demand so a broadcaster never has to open
  // the panel before the room can use Mai Voice.
  const { data: settingsRow } = await admin.rpc('mai_voice_get_room_settings', {
    p_room_kind: roomKind,
    p_room_id: roomId,
  });
  const settings = (Array.isArray(settingsRow) ? settingsRow[0] : settingsRow) ?? null;
  if (!settings) return jsonOk({ enqueued: false, reason: 'no_settings' });
  if (settings.tts_enabled !== true) return jsonOk({ enqueued: false, reason: 'tts_disabled' });
  if (presentation === 'flying_chat' && settings.flying_chat_tts_enabled !== true) {
    return jsonOk({ enqueued: false, reason: 'flying_chat_tts_disabled' });
  }
  if (presentation === 'chat' && settings.chat_tts_enabled !== true) {
    return jsonOk({ enqueued: false, reason: 'chat_tts_disabled' });
  }
  if (settings.playback_paused === true) return jsonOk({ enqueued: false, reason: 'paused' });

  // Sender must have opted in for this room.
  const { data: optin } = await admin
    .from('mai_voice_room_optins')
    .select('tts_enabled')
    .eq('room_kind', roomKind)
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!optin?.tts_enabled) return jsonOk({ enqueued: false, reason: 'sender_not_opted_in' });

  const profile = await loadProfile(userId);
  const usePersonalized = isProfileUsable(profile);
  if (!usePersonalized && settings.fallback_voice_enabled !== true) {
    return jsonOk({ enqueued: false, reason: 'no_authorized_voice' });
  }

  const rawText = String(body.text || '');
  const maxLength = settings.max_text_length ?? 280;
  const text = normalizeSpeechText(rawText, maxLength);
  if (!text) return jsonOk({ enqueued: false, reason: 'empty_text' });
  if (text.length < 2) return jsonOk({ enqueued: false, reason: 'too_short' });

  // Per-user cooldown.
  const cooldownSeconds = settings.cooldown_seconds ?? 10;
  const { data: lastItem } = await admin
    .from('mai_voice_queue')
    .select('created_at')
    .eq('room_kind', roomKind)
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .eq('kind', 'tts')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastItem?.created_at && cooldownSeconds > 0) {
    const elapsed = (Date.now() - new Date(lastItem.created_at).getTime()) / 1000;
    if (elapsed < cooldownSeconds) return jsonOk({ enqueued: false, reason: 'cooldown' });
  }

  // Room generation budget (rolling hourly window).
  const windowStart = new Date(settings.room_budget_window_start ?? Date.now());
  const used =
    Date.now() - windowStart.getTime() > 3_600_000
      ? 0
      : (settings.room_generation_used ?? 0);
  if (used >= (settings.room_generation_budget ?? 200)) {
    return jsonOk({ enqueued: false, reason: 'room_budget_exhausted' });
  }

  // Queue cap.
  const { count: pendingCount } = await admin
    .from('mai_voice_queue')
    .select('id', { count: 'exact', head: true })
    .eq('room_kind', roomKind)
    .eq('room_id', roomId)
    .in('status', ['pending', 'generating', 'ready', 'playing']);
  if ((pendingCount ?? 0) >= (settings.max_queue_size ?? 10)) {
    return jsonOk({ enqueued: false, reason: 'queue_full' });
  }

  const sourceMessageId = UUID_REGEX.test(String(body.sourceMessageId || ''))
    ? String(body.sourceMessageId)
    : null;
  const idempotencyKey = `tts:${roomKind}:${roomId}:${sourceMessageId ?? crypto.randomUUID()}`;

  const { error } = await insertQueueItem({
    room_kind: roomKind,
    room_id: roomId,
    kind: 'tts',
    source_message_id: sourceMessageId,
    user_id: userId,
    text,
    priority: 100,
    status: 'pending',
    delivery: 'auto',
    idempotency_key: idempotencyKey,
    is_personalized: usePersonalized,
    voice_profile_id: usePersonalized ? profile.id : null,
    provider: usePersonalized ? profile.provider : null,
    provider_voice_id: usePersonalized ? profile.provider_voice_id : getFallbackVoiceId(),
    source_presentation: presentation,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (String(error.message).includes('duplicate')) {
      return jsonOk({ enqueued: false, reason: 'duplicate' });
    }
    console.error('[mai-voice] tts enqueue failed:', error.message);
    return jsonError('Could not queue the speech request.', 500, 'TTS_ENQUEUE_FAILED');
  }

  return jsonOk({ enqueued: true, personalized: usePersonalized });
}

// ── Queue processing ─────────────────────────────────────────────────────────

/** Upper bound of items a single pump run may process. */
const MAX_ITEMS_PER_PUMP = 10;

/**
 * Drains the room queue.
 *
 * `processOneQueueItem` handles a single item, so a burst of messages would
 * otherwise stall until the next chat message arrives. The pump keeps working
 * through the queue until nothing is pending any more.
 */
async function processQueue(roomKind: 'stream' | 'battle', roomId: string): Promise<void> {
  for (let i = 0; i < MAX_ITEMS_PER_PUMP; i++) {
    const { data: pending } = await admin
      .from('mai_voice_queue')
      .select('id')
      .eq('room_kind', roomKind)
      .eq('room_id', roomId)
      .in('status', ['pending', 'generating'])
      .limit(1);

    if (!pending || !pending.length) return;

    await processOneQueueItem(roomKind, roomId);
  }
}

async function processOneQueueItem(roomKind: 'stream' | 'battle', roomId: string): Promise<void> {
  // Nothing may play while the broadcaster has playback paused.
  const { data: settings } = await admin
    .from('mai_voice_room_settings')
    .select('*')
    .eq('room_kind', roomKind)
    .eq('room_id', roomId)
    .maybeSingle();
  if (settings?.playback_paused) return;

  const { data: claimed, error: claimError } = await admin.rpc('mai_voice_claim_next_item', {
    p_room_kind: roomKind,
    p_room_id: roomId,
    p_worker_id: WORKER_ID,
    p_claim_status: 'generating',
  });
  if (claimError) {
    console.error('[mai-voice] claim failed:', claimError.message);
    return;
  }
  if (!claimed) return;

  const item = claimed as any;

  // Re-check eligibility at generation time: the sender may have been muted,
  // banned or jailed after the message was queued.
  const eligibility = await checkVoiceEligibility(admin, item.user_id, roomKind, roomId);
  if (!eligibility.allowed) {
    await admin
      .from('mai_voice_queue')
      .update({ status: 'rejected', last_error: eligibility.reason, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    return;
  }

  // Re-check the feature switches.
  const { data: currentSettings } = await admin
    .from('mai_voice_room_settings')
    .select('*')
    .eq('room_kind', roomKind)
    .eq('room_id', roomId)
    .maybeSingle();
  const featureEnabled =
    item.kind === 'voice_message'
      ? currentSettings?.voice_chat_enabled !== false
      : item.source_presentation === 'flying_chat'
        ? currentSettings?.flying_chat_tts_enabled === true
        : currentSettings?.chat_tts_enabled === true;
  if (!featureEnabled) {
    await admin
      .from('mai_voice_queue')
      .update({ status: 'skipped', last_error: 'Feature disabled', updated_at: new Date().toISOString() })
      .eq('id', item.id);
    return;
  }

  let storagePath = item.storage_path as string | null;
  const _durationMs = item.duration_ms as number | null;
  const _mimeType = 'audio/mpeg';
  const isPersonalized = item.is_personalized === true;

  if (item.kind === 'tts') {
    // Personalized speech needs the sender's *authorized* voice.
    const profile = await loadProfile(item.user_id);
    if (isPersonalized) {
      if (!isProfileUsable(profile)) {
        await admin
          .from('mai_voice_queue')
          .update({
            status: 'skipped',
            last_error: 'Voice profile is no longer usable',
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
        return;
      }
    } else {
      // Fallback voice: make sure a fallback is actually configured.
      const fallbackId = currentSettings?.fallback_voice_id || getFallbackVoiceId();
      if (!fallbackId) {
        await admin
          .from('mai_voice_queue')
          .update({
            status: 'skipped',
            last_error: 'No fallback voice configured',
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
        return;
      }
      item.provider_voice_id = fallbackId;
    }

    const provider = getMaiVoiceProvider();
    const synthesis = await provider.synthesize({
      providerVoiceId: item.provider_voice_id,
      text: item.text,
    });
    if (synthesis.error || !synthesis.audio.byteLength) {
      console.error('[mai-voice] synthesis failed:', synthesis.error);
      await admin
        .from('mai_voice_queue')
        .update({
          status: 'failed',
          last_error: synthesis.error || 'Speech generation failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      return;
    }

    storagePath = `tts/${roomKind}/${roomId}/${item.id}.mp3`;
    const { error: uploadError } = await admin.storage
      .from('mai-voice')
      .upload(storagePath, synthesis.audio, { contentType: synthesis.mimeType, upsert: true });
    if (uploadError) {
      console.error('[mai-voice] tts upload failed:', uploadError.message);
      await admin
        .from('mai_voice_queue')
        .update({
          status: 'failed',
          last_error: 'Could not store generated speech',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      return;
    }
    mimeType = synthesis.mimeType;
    durationMs = synthesis.durationMs ?? Math.max(500, Math.round((synthesis.audio.byteLength * 8) / 128_000));
  } else {
    const { data: message } = await admin
      .from('mai_voice_messages')
      .select('*')
      .eq('id', item.message_id)
      .maybeSingle();
    if (!message || message.status === 'removed' || message.deleted_at) {
      await admin
        .from('mai_voice_queue')
        .update({ status: 'removed', last_error: 'Voice message removed', updated_at: new Date().toISOString() })
        .eq('id', item.id);
      return;
    }
    storagePath = message.storage_path;
    durationMs = message.duration_ms;
    mimeType = message.mime_type;
  }

  if (!storagePath) {
    await admin
      .from('mai_voice_queue')
      .update({ status: 'failed', last_error: 'No audio available', updated_at: new Date().toISOString() })
      .eq('id', item.id);
    return;
  }

  // Decide the delivery path: LiveKit when a publisher is present, otherwise
  // every participant plays the clip in sync.
  const { data: publishers } = await admin
    .from('mai_voice_publishers')
    .select('publisher_user_id, livekit_room_name, last_heartbeat_at')
    .eq('room_kind', roomKind)
    .eq('room_id', roomId);
  const livePublisher = (publishers || []).find(
    (p: any) => new Date(p.last_heartbeat_at).getTime() > Date.now() - 45_000,
  );
  const delivery: 'livekit' | 'local' = livePublisher ? 'livekit' : 'local';

  const playToken = crypto.randomUUID();
  /*
   * LiveKit delivery needs lead time: the publisher has to fetch, decode and
   * publish the clip before it can start playing for the whole audience.
   */
  const playAt = new Date(Date.now() + (delivery === 'livekit' ? 1800 : 400));
  const signedUrl = await signPlaybackUrl(storagePath, delivery === 'livekit' ? 300 : 120);
  if (!signedUrl) {
    await admin
      .from('mai_voice_queue')
      .update({ status: 'failed', last_error: 'Could not sign playback url', updated_at: new Date().toISOString() })
      .eq('id', item.id);
    return;
  }

  const { data: profile } = await admin
    .from('user_profiles')
    .select('username, display_name, avatar_url')
    .eq('id', item.user_id)
    .maybeSingle();

  const senderName = (profile?.display_name as string) || (profile?.username as string) || 'Viewer';

  await admin
    .from('mai_voice_queue')
    .update({
      status: 'playing',
      storage_path: storagePath,
      duration_ms: durationMs,
      delivery,
      play_token: playToken,
      play_at: playAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id);

  if (item.kind === 'voice_message') {
    await admin
      .from('mai_voice_messages')
      .update({ status: 'queued' })
      .eq('id', item.message_id);
  }

  await publishRealtime(roomChannel(roomKind, roomId), 'voice_play', {
    room_kind: roomKind,
    room_id: roomId,
    queue_item_id: item.id,
    message_id: item.message_id ?? null,
    kind: item.kind,
    play_token: playToken,
    play_at: playAt.getTime(),
    url: signedUrl,
    duration_ms: durationMs,
    sender_id: item.user_id,
    sender_name: senderName,
    sender_avatar: profile?.avatar_url ?? null,
    text: item.kind === 'tts' ? item.text : null,
    is_personalized: isPersonalized,
    voice_label: isPersonalized ? `${senderName}'s voice` : 'Mai Voice (standard)',
    delivery,
    livekit_room_name: delivery === 'livekit' ? livePublisher?.livekit_room_name ?? null : null,
    publisher_user_id: delivery === 'livekit' ? livePublisher?.publisher_user_id ?? null : null,
  });

  await audit('mai_voice.playback_started', item.user_id, item.id, {
    room_kind: roomKind,
    room_id: roomId,
    kind: item.kind,
    delivery,
    duration_ms: durationMs,
  });
}

// ── Request handling ────────────────────────────────────────────────────────

/*
 * The response is built by helpers that do not always know the request, so the
 * CORS headers are applied once more here with the origin of the caller. Without
 * this the browser refuses to read the answer on a dev origin.
 */
serve(async (req: Request): Promise<Response> => {
  return applyCors(await handleRequest(req), req);
});

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);
  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405, req);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid request body.', 400, 'INVALID_BODY');
  }

  const action = String(body.action || '');

  // Maintenance actions run without a user session.
  if (action === 'maintenance') {
    const { data: expiredPaths } = await admin.rpc('mai_voice_expire_due');
    if (Array.isArray(expiredPaths) && expiredPaths.length) {
      for (const path of expiredPaths as string[]) {
        if (path) await admin.storage.from('mai-voice').remove([path]);
      }
    }
    await admin.rpc('mai_voice_prune_publishers');
    return jsonOk({ expired: Array.isArray(expiredPaths) ? expiredPaths.length : 0 });
  }

  const actor = await resolveActor(req);
  if (!actor) {
    return withCors({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401, req);
  }

  try {
    switch (action) {
      case 'get-profile':
        return await actionGetProfile(actor);
      case 'enroll':
        return await actionEnroll(actor, body);
      case 'set-enabled':
        return await actionSetEnabled(actor, body);
      case 'delete-profile':
        return await actionDeleteProfile(actor);
      case 'set-opt-in':
        return await actionSetOptIn(actor, body);
      case 'submit-voice-message':
        return await actionSubmitVoiceMessage(actor, body);
      case 'get-room-settings':
        return await actionGetRoomSettings(actor, body);
      case 'update-room-settings':
        return await actionUpdateRoomSettings(actor, body);
      case 'queue-control':
        return await actionQueueControl(actor, body);
      case 'moderate':
        return await actionModerate(actor, body);
      case 'cancel-tts':
        return await actionCancelTts(actor, body);
      case 'publisher-heartbeat':
        return await actionPublisherHeartbeat(actor, body);
      case 'unregister-publisher':
        return await actionUnregisterPublisher(actor, body);
      case 'get-playback-url':
        return await actionGetPlaybackUrl(actor, body);
        case 'record-listen':
          return await actionRecordListen(actor, body);
      case 'enqueue-tts': {
        if (!actor.isService) {
          // Regular users may only enqueue TTS for themselves.
          body.userId = actor.userId;
        }
        const result = await actionEnqueueTts(actor, body);
        if (body.process !== false) {
          // Speech generation must not delay the chat response, so the queue
          // pump is detached from the request whenever the runtime supports it.
          const pump = processQueue(body.roomKind === 'battle' ? 'battle' : 'stream', String(body.roomId)).catch(
            (error) => console.error('[mai-voice] queue pump failed:', error instanceof Error ? error.message : error),
          );
          if (EdgeRuntime?.waitUntil) {
            EdgeRuntime.waitUntil(pump);
          } else {
            await pump;
          }
        }
        return result;
      }
      case 'process-queue': {
        const roomKind = body.roomKind === 'battle' ? 'battle' : 'stream';
        const roomId = String(body.roomId || '');
        if (!UUID_REGEX.test(roomId)) return jsonError('Invalid room.', 400, 'INVALID_ROOM');
        await processQueue(roomKind, roomId);
        return jsonOk({ processed: true });
      }
      default:
        return jsonError('Unknown action.', 400, 'UNKNOWN_ACTION');
    }
  } catch (error) {
    console.error('[mai-voice] unhandled error:', error instanceof Error ? error.stack : error);
    return withCors(
      { success: false, error: 'Mai Voice is temporarily unavailable.', code: 'INTERNAL_ERROR' },
      500,
      req,
    );
  }
}


// Record a listen event for a voice message
async function actionRecordListen(actor: Actor, body: any) {
  const messageId = String(body.messageId || '');
  if (!UUID_REGEX.test(messageId)) {
    return jsonError('Invalid message.', 400, 'INVALID_MESSAGE');
  }
  if (actor.isService) {
    // service role might call with userId
    const userId = String(body.userId || '');
    if (!UUID_REGEX.test(userId)) {
      return jsonError('Invalid user.', 400, 'INVALID_USER');
    }
    const { data, error } = await admin.rpc('mai_voice_record_listen', {
      p_message_id: messageId,
      p_user_id: userId,
    });
    if (error) {
      console.error('[mai-voice] record listen failed:', error.message);
      return jsonError('Failed to record listen.', 500, 'RECORD_LISTEN_FAILED');
    }
    return jsonOk(data || {});
  }
  const { data, error } = await admin.rpc('mai_voice_record_listen', {
    p_message_id: messageId,
    p_user_id: actor.userId,
  });
  if (error) {
    console.error('[mai-voice] record listen failed:', error.message);
    return jsonError('Failed to record listen.', 500, 'RECORD_LISTEN_FAILED');
  }
  return jsonOk(data || {});
}
