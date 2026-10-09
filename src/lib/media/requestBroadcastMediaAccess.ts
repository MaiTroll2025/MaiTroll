export type MediaRequestStatus =
  | { status: 'success'; stream: MediaStream }
  | { status: 'camera_denied' }
  | { status: 'microphone_denied' }
  | { status: 'no_camera_found' }
  | { status: 'no_microphone_found' }
  | { status: 'device_in_use' }
  | { status: 'unsupported_browser' }
  | { status: 'insecure_context' }
  | { status: 'unknown_error'; error: any };

function isIOS() {
  try {
    const ua = navigator.userAgent || '';
    const platform = (navigator as any).platform || '';
    const maxTouch = navigator.maxTouchPoints || 0;
    return /iP(hone|ad|od)/i.test(ua) || (/Mac/.test(platform) && maxTouch > 1);
  } catch (_e) {
    return false;
  }
}

export async function requestBroadcastMediaAccess(): Promise<MediaRequestStatus> {
  const dev = import.meta.env.DEV;

  const isSecure = window.isSecureContext === true;
  const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const isiOS = isIOS();
  const isStandalone = (window.navigator as any).standalone === true;

  if (dev) console.debug('[requestBroadcastMediaAccess] debug:', { isiOS, isStandalone, isSecure, hasMediaDevices });

  if (!isSecure) return { status: 'insecure_context' };
  if (!hasMediaDevices) return { status: 'unsupported_browser' };

  // Try the simplest, permissive constraints first per iOS guidance
  const tryGet = async (constraints: MediaStreamConstraints) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      return { ok: true as const, stream: s };
    } catch (err: any) {
      return { ok: false as const, error: err };
    }
  };

  try {
    const both = await tryGet({ video: true, audio: true });
    if (both.ok) return { status: 'success', stream: both.stream };

    // If failed, try video-only then audio-only to surface which is denied/failing
    const videoOnly = await tryGet({ video: true, audio: false });
    if (videoOnly.ok) {
      return { status: 'microphone_denied' };
    }

    const audioOnly = await tryGet({ video: false, audio: true });
    if (audioOnly.ok) {
      return { status: 'camera_denied' };
    }

    // If neither succeeded, inspect errors if available
    const errBoth = (both as any).error;
    if (errBoth) {
      const name = errBoth.name || '';
      if (name === 'NotFoundError') return { status: 'no_camera_found' };
      if (name === 'NotReadableError') return { status: 'device_in_use' };
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return { status: 'camera_denied' };
      }
    }

    return { status: 'unknown_error', error: errBoth || null };
  } catch (err) {
    if (dev) console.debug('[requestBroadcastMediaAccess] unexpected error', err);
    return { status: 'unknown_error', error: err };
  }
}

export default requestBroadcastMediaAccess;
