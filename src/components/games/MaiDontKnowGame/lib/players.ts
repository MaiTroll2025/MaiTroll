const AVATAR_TONES = [
  'from-neon-blue/70 to-neon-purple/70',
  'from-neon-green/70 to-neon-blue/70',
  'from-neon-purple/70 to-neon-red/70',
  'from-neon-amber/70 to-neon-green/70',
  'from-neon-red/70 to-neon-amber/70',
];

export function playerName(player: { username: string; display_name: string | null }): string {
  return player.display_name?.trim() || player.username;
}

export function avatarTone(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function initialsOf(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
}

export function formatPoints(points: number): string {
  return points.toLocaleString('en-US');
}

export function rankPlayers<T extends { score: number }>(players: T[]): (T & { rank: number })[] {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  let rank = 0;
  return sorted.map((player, index) => {
    if (index === 0 || player.score !== sorted[index - 1].score) {
      rank = index + 1;
    }
    return { ...player, rank };
  });
}
