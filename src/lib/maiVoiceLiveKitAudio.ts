import { Track, type RemoteAudioTrack } from 'livekit-client';

/**
 * Mai Voice delivery over LiveKit.
 *
 * The room's Mai Voice publisher pushes the generated speech into the LiveKit
 * room as an auxiliary audio track (the `screen_share_audio` source). Clients
 * that only care about the camera and the microphone never touch that source,
 * so the audience needs a small bridge that attaches the auxiliary track to a
 * hidden audio element.
 */

/**
 * True when a remote publication carries the Mai Voice auxiliary audio.
 *
 * `livekit-client` v2 exposes `Track.Source` as a string enum, older builds
 * used the numeric protocol values, so both are accepted here.
 */
export function isMaiVoiceAuxPublication(publication?: {
  source?: Track.Source | number | null;
} | null): boolean {
  if (!publication) return false;
  const source = publication.source;
  if (source === undefined || source === null) return false;
  return source === Track.Source.ScreenShareAudio || source === 4;
}

/**
 * Attaches a Mai Voice auxiliary track so the audience actually hears it.
 * Returns the audio element that was created, or null when it failed.
 */
export function attachMaiVoiceAuxAudio(track: RemoteAudioTrack): HTMLAudioElement | null {
  try {
    const element = track.attach() as HTMLAudioElement;
    element.autoplay = true;
    element.setAttribute('data-mai-voice', 'true');
    element.style.display = 'none';
    if (!element.parentElement) {
      document.body.appendChild(element);
    }
    void element.play().catch(() => undefined);
    return element;
  } catch (error) {
    console.warn('[MaiVoice] Could not attach the auxiliary audio track:', error);
    return null;
  }
}
