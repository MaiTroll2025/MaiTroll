import type { StreamType, EngagementTarget } from '../../types/engagement';

const BROADCAST_PAGE_PATHS = ['/broadcast', '/broadcast/'];
const VIEWER_PAGE_PATHS = ['/viewer', '/viewer/'];
const HYTRO_GAME_PATHS = ['/hytro', '/hytro/'];
const PODCAST_PATHS = ['/podcast', '/podcast/'];

const PATH_TO_STREAM_TYPE: Record<string, StreamType> = {
  '/broadcast': 'broadcast',
  '/viewer': 'broadcast',
  '/hytro': 'hytrogame',
  '/podcast': 'podcast',
};

export function resolveEngagementTarget(
  pathname: string,
  streamId: string | null | undefined
): EngagementTarget | null {
  if (!streamId) {
    return null;
  }

  const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  let streamType: StreamType | undefined;
  for (const [path, type] of Object.entries(PATH_TO_STREAM_TYPE)) {
    if (normalizedPath === path || normalizedPath.startsWith(path + '/')) {
      streamType = type;
      break;
    }
  }

  if (!streamType) {
    return null;
  }

  return { streamType, streamId };
}

export function getStreamTypeFromPath(pathname: string): StreamType | null {
  const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  for (const [path, type] of Object.entries(PATH_TO_STREAM_TYPE)) {
    if (normalizedPath === path || normalizedPath.startsWith(path + '/')) {
      return type;
    }
  }

  return null;
}

export function isValidStreamType(value: string): value is StreamType {
  return value === 'broadcast' || value === 'hytrogame' || value === 'podcast';
}