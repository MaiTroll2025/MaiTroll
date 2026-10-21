/**
 * Mai Voice — server-side TTS provider abstraction.
 *
 * The platform never talks to a vendor SDK directly. Everything goes through
 * the `MaiVoiceProvider` interface so a provider can be swapped without
 * touching queue, moderation or playback code.
 *
 * Implemented providers:
 *   - elevenlabs  (default; see docs/MAI_VOICE.md for the comparison)
 *
 * All provider secrets stay server-side. Nothing in this file may be imported
 * by frontend code.
 */

export type MaiVoiceProviderId = 'elevenlabs' | 'none';

export interface VoiceEnrollmentInput {
  /** Raw encoded audio bytes of the consented sample. */
  audio: Uint8Array;
  mimeType: string;
  /** Human readable name for the cloned voice. */
  displayName: string;
  /** Stable user identifier, used to make the provider-side voice name unique. */
  userId: string;
}

export interface VoiceEnrollmentResult {
  provider: MaiVoiceProviderId;
  providerVoiceId: string | null;
  /** True when the provider created the voice but still needs a human check. */
  requiresVerification: boolean;
  /** True when the voice is immediately usable for synthesis. */
  ready: boolean;
  error?: string;
}

export interface VoiceSynthesisInput {
  providerVoiceId: string;
  text: string;
  /** Optional override; defaults to the provider's fast model. */
  modelId?: string;
  /** Optional output format override; defaults to mp3_44100_128. */
  outputFormat?: string;
  /** When true the request is made with zero-retention logging. */
  zeroRetention?: boolean;
}

export interface VoiceSynthesisResult {
  audio: Uint8Array;
  mimeType: string;
  /** Estimated play time of the generated audio in milliseconds. */
  durationMs?: number;
  error?: string;
}

export interface MaiVoiceProvider {
  readonly id: MaiVoiceProviderId;
  /** True when the provider has been configured with credentials. */
  isConfigured(): boolean;
  /** True when the provider can create cloned voices from a sample. */
  supportsCloning(): boolean;
  createVoice(input: VoiceEnrollmentInput): Promise<VoiceEnrollmentResult>;
  deleteVoice(providerVoiceId: string): Promise<{ deleted: boolean; error?: string }>;
  /** Confirms the provider still knows about the voice (used before marking ready). */
  voiceExists(providerVoiceId: string): Promise<boolean>;
  synthesize(input: VoiceSynthesisInput): Promise<VoiceSynthesisResult>;
}

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

/**
 * Instant voice clone endpoints. ElevenLabs is renaming the flat
 * `POST /v1/voices/add` route to `POST /v1/voices/add/ivc`, so both are tried
 * and the first one that answers is used.
 */
const INSTANT_CLONE_PATHS = ['/voices/add/ivc', '/voices/add'];

/**
 * Bitrate in kbps for the supported ElevenLabs output formats.
 *
 * The mp3 encoder always delivers roughly 128 kbps, even for the "mp3_22050_32"
 * format (measured: 128 kB for ~8 s of speech), so the mp3 entries are tuned to
 * the real payload size instead of the name of the format.
 */
const OUTPUT_FORMAT_BITRATE_KBPS: Record<string, number> = {
  mp3_22050_32: 128,
  mp3_44100_64: 128,
  mp3_44100_96: 128,
  mp3_44100_128: 128,
  mp3_44100_192: 128,
  pcm_16000: 128,
  pcm_22050: 176,
  pcm_24000: 192,
  pcm_44100: 352,
  ulaw_8000: 64,
};

/**
 * Estimates how long the generated audio plays.
 *
 * The clip is served straight from storage and played by the browser, so the
 * duration is only used for the countdown in the UI — but it should still
 * match the real bitrate of the requested format.
 */
function estimateDurationMs(byteLength: number, outputFormat: string): number {
  const kbps = OUTPUT_FORMAT_BITRATE_KBPS[outputFormat] ?? 64;
  return Math.max(400, Math.round((byteLength * 8) / (kbps * 1000)));
}

/** Formats a browser recording into a file name the provider accepts. */
function extensionForMime(mimeType: string): string {
  const m = (mimeType || '').toLowerCase();
  if (m.includes('mp4') || m.includes('m4a')) return 'mp4';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('wav')) return 'wav';
  if (m.includes('aac')) return 'aac';
  return 'webm';
}

class ElevenLabsProvider implements MaiVoiceProvider {
  readonly id: MaiVoiceProviderId = 'elevenlabs';

  private apiKey(): string {
    return Deno.env.get('ELEVENLABS_API_KEY') || '';
  }

  isConfigured(): boolean {
    return this.apiKey().length > 0;
  }

  supportsCloning(): boolean {
    return true;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { 'xi-api-key': this.apiKey(), ...extra };
  }

  /**
   * POST /v1/voices/add/ivc (or /v1/voices/add) — instant voice cloning.
   * Requires a minimum of ~1 minute of clean audio; the profile is only marked
   * ready when the provider returns a voice id and does not require verification.
   */
  async createVoice(input: VoiceEnrollmentInput): Promise<VoiceEnrollmentResult> {
    if (!this.isConfigured()) {
      return {
        provider: this.id,
        providerVoiceId: null,
        requiresVerification: false,
        ready: false,
        error: 'TTS provider is not configured on the server.',
      };
    }

    try {
      const extension = extensionForMime(input.mimeType);
      const fileName = `mai-voice-${input.userId}.${extension}`;
      const blob = new Blob([input.audio as unknown as BlobPart], {
        type: input.mimeType || 'audio/webm',
      });

      let response: Response | null = null;
      let lastStatus = 0;
      let lastBody = '';

      for (const path of INSTANT_CLONE_PATHS) {
        const form = new FormData();
        form.append('name', `MaiVoice ${input.displayName}`.slice(0, 100));
        form.append('description', 'Mai Troll authorized personal voice');
        form.append('files', blob, fileName);

        const attempt = await fetch(`${ELEVENLABS_BASE}${path}`, {
          method: 'POST',
          headers: this.headers(),
          body: form,
        });

        if (attempt.ok) {
          response = attempt;
          break;
        }

        lastStatus = attempt.status;
        lastBody = await attempt.text();

        // Only a missing route is worth retrying on the other path. Any other
        // error (bad key, plan limit, rejected sample) is final.
        if (attempt.status !== 404 && attempt.status !== 405) {
          break;
        }
      }

      if (!response) {
        return {
          provider: this.id,
          providerVoiceId: null,
          requiresVerification: false,
          ready: false,
          error: `Voice provider rejected the sample (${lastStatus}): ${lastBody.slice(0, 300)}`,
        };
      }

      const data = await response.json();
      const voiceId = typeof data?.voice_id === 'string' ? data.voice_id : null;
      const requiresVerification = data?.requires_verification === true;

      if (!voiceId) {
        return {
          provider: this.id,
          providerVoiceId: null,
          requiresVerification: false,
          ready: false,
          error: 'Voice provider did not return a voice id.',
        };
      }

      return {
        provider: this.id,
        providerVoiceId: voiceId,
        requiresVerification,
        ready: !requiresVerification,
        error: requiresVerification
          ? 'The provider requires the cloned voice to be verified before use.'
          : undefined,
      };
    } catch (error) {
      return {
        provider: this.id,
        providerVoiceId: null,
        requiresVerification: false,
        ready: false,
        error: error instanceof Error ? error.message : 'Unknown provider error',
      };
    }
  }

  async deleteVoice(providerVoiceId: string): Promise<{ deleted: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { deleted: false, error: 'TTS provider is not configured on the server.' };
    }
    try {
      const response = await fetch(`${ELEVENLABS_BASE}/voices/${providerVoiceId}`, {
        method: 'DELETE',
        headers: this.headers(),
      });
      if (response.ok || response.status === 404) {
        return { deleted: true };
      }
      const body = await response.text();
      return { deleted: false, error: `Provider delete failed (${response.status}): ${body.slice(0, 300)}` };
    } catch (error) {
      return {
        deleted: false,
        error: error instanceof Error ? error.message : 'Unknown provider error',
      };
    }
  }

  async voiceExists(providerVoiceId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const response = await fetch(`${ELEVENLABS_BASE}/voices/${providerVoiceId}`, {
        method: 'GET',
        headers: this.headers(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * POST /v1/text-to-speech/{voice_id}
   * Uses the fast model by default so chat speech latency stays low.
   */
  async synthesize(input: VoiceSynthesisInput): Promise<VoiceSynthesisResult> {
    if (!this.isConfigured()) {
      return { audio: new Uint8Array(), mimeType: 'audio/mpeg', error: 'TTS provider is not configured on the server.' };
    }

    const modelId = input.modelId || Deno.env.get('ELEVENLABS_TTS_MODEL') || 'eleven_flash_v2_5';
    const outputFormat = input.outputFormat || Deno.env.get('ELEVENLABS_TTS_FORMAT') || 'mp3_44100_128';

    try {
      const response = await fetch(
        `${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(input.providerVoiceId)}`,
        {
          method: 'POST',
          headers: this.headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            text: input.text,
            model_id: modelId,
            output_format: outputFormat,
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        return {
          audio: new Uint8Array(),
          mimeType: 'audio/mpeg',
          error: `Speech synthesis failed (${response.status}): ${body.slice(0, 300)}`,
        };
      }

      const buffer = new Uint8Array(await response.arrayBuffer());
      return {
        audio: buffer,
        mimeType: outputFormat.startsWith('mp3') ? 'audio/mpeg' : 'audio/mp4',
        durationMs: estimateDurationMs(buffer.byteLength, outputFormat),
      };
    } catch (error) {
      return {
        audio: new Uint8Array(),
        mimeType: 'audio/mpeg',
        error: error instanceof Error ? error.message : 'Unknown provider error',
      };
    }
  }
}

/**
 * Disabled provider — used when no TTS credentials are configured.
 * It never fabricates audio; callers must treat a failure as "skip speech".
 */
class DisabledProvider implements MaiVoiceProvider {
  readonly id: MaiVoiceProviderId = 'none';
  isConfigured(): boolean {
    return false;
  }
  supportsCloning(): boolean {
    return false;
  }
  async createVoice(): Promise<VoiceEnrollmentResult> {
    return {
      provider: this.id,
      providerVoiceId: null,
      requiresVerification: false,
      ready: false,
      error: 'No TTS provider is configured on the server.',
    };
  }
  async deleteVoice(): Promise<{ deleted: boolean; error?: string }> {
    return { deleted: true };
  }
  async voiceExists(): Promise<boolean> {
    return false;
  }
  async synthesize(): Promise<VoiceSynthesisResult> {
    return { audio: new Uint8Array(), mimeType: 'audio/mpeg', error: 'No TTS provider is configured on the server.' };
  }
}

let cached: MaiVoiceProvider | null = null;

/** Resolve the configured provider (cached for the lifetime of the isolate). */
export function getMaiVoiceProvider(): MaiVoiceProvider {
  if (cached) return cached;
  const requested = (Deno.env.get('MAI_VOICE_PROVIDER') || 'elevenlabs').toLowerCase();
  cached = requested === 'elevenlabs' ? new ElevenLabsProvider() : new DisabledProvider();
  return cached;
}

/**
 * Standard voice used when the broadcaster enables the fallback policy and the
 * sender has no authorized clone. The UI must label this as NOT the sender's
 * own voice.
 */
export function getFallbackVoiceId(): string | null {
  return Deno.env.get('MAI_VOICE_FALLBACK_VOICE_ID') || null;
}

export const VOICE_ENROLLMENT_MIN_SECONDS = 30;
export const VOICE_ENROLLMENT_MAX_SECONDS = 180;
export const VOICE_ENROLLMENT_MIN_BYTES = 8_000;
export const VOICE_ENROLLMENT_MAX_BYTES = 5_242_880;
export const VOICE_MESSAGE_MAX_SECONDS = 20;
export const VOICE_MESSAGE_MAX_BYTES = 5_242_880;
