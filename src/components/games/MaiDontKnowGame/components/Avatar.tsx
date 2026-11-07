import { avatarTone, initialsOf } from '../lib/players';

interface AvatarProps {
  name: string;
  seed: string;
  src: string | null;
  size?: 'sm' | 'md' | 'lg';
  ringClass?: string;
}

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
} as const;

export default function Avatar({ name, seed, src, size = 'md', ringClass = 'ring-neon-blue/50' }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${SIZE_CLASSES[size]} shrink-0 rounded-full object-cover ring-2 ${ringClass}`}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`${SIZE_CLASSES[size]} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarTone(seed)} font-display font-extrabold text-arena-950 ring-2 ${ringClass}`}
    >
      {initialsOf(name)}
    </div>
  );
}

