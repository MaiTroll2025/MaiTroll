import { Coins, Gamepad2, LogOut } from 'lucide-react';
import Avatar from '../components/Avatar';
import { playerName } from '../lib/players';
import type { Profile } from '../lib/types';

interface HeaderProps {
  profile: Profile | null;
  trollCoins: number | null;
  trollCoinError: string | null;
  onHome: () => void;
  onSignOut: () => void;
}

export default function Header({ profile, trollCoins, trollCoinError, onHome, onSignOut }: HeaderProps) {
  const name = profile ? playerName(profile) : 'Player';

  return (
    <header className="sticky top-0 z-30 border-b border-neon-blue/15 bg-arena-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <button
          type="button"
          onClick={onHome}
          className="group flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-neon-blue"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-blue/15 text-neon-blue shadow-neon-blue transition group-hover:scale-105">
            <Gamepad2 className="h-5 w-5" />
          </span>
          <span className="font-display text-sm font-extrabold tracking-wider text-slate-100 sm:text-base">
            MAI DON&apos;T KNOW!
          </span>
        </button>

        {profile && (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-3 py-1.5 text-sm font-semibold text-neon-amber"
              title={trollCoinError ?? 'Troll Coins'}
            >
              <Coins className="h-4 w-4" />
              <span>{trollCoins === null ? '--' : trollCoins.toLocaleString('en-US')}</span>
              <span className="hidden text-xs font-medium text-neon-amber/80 sm:inline">coins</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-arena-600 bg-arena-900/80 py-1 pl-1 pr-3">
              <Avatar name={name} seed={profile.id} src={profile.avatar_url} size="sm" />
              <span className="max-w-[8rem] truncate text-sm font-semibold sm:max-w-[12rem]">{name}</span>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-arena-600 text-slate-400 transition hover:border-neon-red/60 hover:text-neon-red"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

