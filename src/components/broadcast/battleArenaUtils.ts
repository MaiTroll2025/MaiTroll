import { RemoteParticipant, RemoteTrackPublication, Track } from 'livekit-client';

export function safeValues<T>(mapLike: Map<any, T> | undefined | null): T[] {
  if (!mapLike || typeof mapLike.values !== 'function') return [];
  try {
    return Array.from(mapLike.values());
  } catch (error) {
    console.warn('[BattleView] safeValues failed:', error);
    return [];
  }
}

export const safeParseMetadata = (raw: unknown, context: string): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`[BattleView] Failed to parse metadata for ${context}:`, raw, error);
      return {};
    }
  }
  return {};
};

export const getTrackPublications = (
  participant: RemoteParticipant,
  kind: 'video' | 'audio'
): RemoteTrackPublication[] => {
  const sourceMaps = kind === 'video'
    ? [
        (participant as any).videoTrackPublications,
        (participant as any).videoTracks,
      ]
    : [
        (participant as any).audioTrackPublications,
        (participant as any).audioTracks,
      ];

  for (const mapLike of sourceMaps) {
    if (!mapLike?.values) continue;

    const entries = safeValues(mapLike) as any[];
    if (entries.length === 0) continue;

    const normalized = entries.map((entry) => {
      if (entry && typeof entry.track === 'undefined' && typeof entry.attach === 'function') {
        return {
          track: entry,
          isSubscribed: (entry as any).isSubscribed ?? true,
          kind: (entry as any).kind,
          source: (entry as any).source,
          sid: (entry as any).sid ?? (entry as any).trackSid ?? '',
          trackSid: (entry as any).sid ?? (entry as any).trackSid ?? '',
        };
      }
      return entry;
    }) as RemoteTrackPublication[];

    return normalized.filter((publication) =>
      kind === 'video'
        ? publication.kind === Track.Kind.Video
        : publication.kind === Track.Kind.Audio
    );
  }

  const all = safeValues((participant as any).trackPublications) as RemoteTrackPublication[];

  return all.filter((publication) => {
    if (kind === 'video') {
      return publication.kind === Track.Kind.Video || publication.track?.kind === Track.Kind.Video;
    }
    return publication.kind === Track.Kind.Audio || publication.track?.kind === Track.Kind.Audio;
  });
};
