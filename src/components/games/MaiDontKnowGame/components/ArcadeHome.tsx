import { useState, type FormEvent } from 'react';
import {
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Timer,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import CreateRoomDialog, { type LobbyMode } from '../components/CreateRoomDialog';
import { errorText, gameApi } from '../lib/gameApi';

export type ArcadeView = 'home' | 'public' | 'leaderboard';

interface ArcadeHomeProps {
  resumeRoomId: string | null;
  onEnterRoom: (roomId: string) => void;
  onNavigate: (view: ArcadeView) => void;
  onResume: () => void;
}

interface ModeCard {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  glow: string;
  badge: string;
}

const CARDS: ModeCard[] = [
  {
    id: 'solo',
    title: 'Solo Practice',
    description: 'Beat the clock alone. Ten questions, fifteen seconds each.',
    icon: Timer,
    accent: 'text-neon-blue border-neon-blue/40',
    glow: 'hover:shadow-neon-blue',
    badge: '10 questions',
  },
  {
    id: 'quick',
    title: 'Quick Match',
    description: 'Jump into a live lobby with other players and start in seconds.',
    icon: Zap,
    accent: 'text-neon-green border-neon-green/40',
    glow: 'hover:shadow-neon-green',
    badge: 'Auto-start',
  },
  {
    id: 'private',
    title: 'Private Lobby',
    description: 'Create a room code and invite your friends.',
    icon: Lock,
    accent: 'text-neon-purple border-neon-purple/40',
    glow: 'hover:shadow-neon-purple',
    badge: 'Room code',
  },
  {
    id: 'public',
    title: 'Public Lobbies',
    description: 'Browse open rooms and grab a seat.',
    icon: Globe,
    accent: 'text-neon-amber border-neon-amber/40',
    glow: 'hover:shadow-neon-amber',
    badge: 'Browse',
  },
  {
    id: 'party',
    title: 'Party Mode',
    description: 'Up to twelve players, live scoring, and a rowdy podium finish.',
    icon: Users,
    accent: 'text-neon-red border-neon-red/40',
    glow: 'hover:shadow-neon-red',
    badge: 'Up to 12',
  },
  {
    id: 'leaderboard',
    title: 'Leaderboards',
    description: 'Daily, weekly and all-time champions of the arena.',
    icon: Trophy,
    accent: 'text-neon-green border-neon-green/40',
    glow: 'hover:shadow-neon-green',
    badge: 'Rankings',
  },
];

const LOBBY_MODES: Record<string, LobbyMode> = {
  private: {
    title: 'Private Lobby',
    description: 'Only players with your room code can join.',
    visibility: 'private',
    defaultSize: 6,
  },
  party: {
    title: 'Party Mode',
    description: 'Invite-only party room for a big crowd.',
    visibility: 'private',
    defaultSize: 12,
  },
};

export default function ArcadeHome({ resumeRoomId, onEnterRoom, onNavigate, onResume }: ArcadeHomeProps) {
  const [busyCard, setBusyCard] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<LobbyMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const startCard = async (id: string) => {
    if (id === 'public' || id === 'leaderboard') {
      onNavigate(id === 'public' ? 'public' : 'leaderboard');
      return;
    }
    if (id === 'private' || id === 'party') {
      setDialogMode(LOBBY_MODES[id]);
      return;
    }
    setError(null);
    setBusyCard(id);
    try {
      const roomId = id === 'solo' ? await gameApi.createSoloMatch() : await gameApi.quickMatch();
      onEnterRoom(roomId);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusyCard(null);
    }
  };

  const handleJoinCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setJoining(true);
    try {
      const roomId = await gameApi.joinRoomByCode(code);
      onEnterRoom(roomId);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <section className="mb-10 text-center sm:mb-14">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-neon-green">MaiTroll Arcade presents</p>
        <h1 className="neon-title text-4xl leading-tight sm:text-6xl">MAI DON&apos;T KNOW!</h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-slate-300">
          Answer fast, bluff smart and climb the leaderboard. Pick a mode and get in the arena.
        </p>
      </section>

      {resumeRoomId && (
        <button
          type="button"
          onClick={onResume}
          className="neon-panel mb-8 flex w-full items-center justify-between gap-4 p-4 text-left transition hover:-translate-y-0.5 sm:p-5"
        >
          <span>
            <span className="block text-xs font-semibold uppercase tracking-widest text-neon-green">You have a lobby open</span>
            <span className="mt-1 block font-semibold text-slate-100">Return to your match</span>
          </span>
          <span className="neon-button px-4 py-2 text-sm">Resume</span>
        </button>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card, index) => {
          const Icon = card.icon;
          const busy = busyCard === card.id;
          return (
            <button
              key={card.id}
              type="button"
              disabled={busyCard !== null}
              onClick={() => void startCard(card.id)}
              style={{ animationDelay: `${index * 70}ms` }}
              className={`neon-panel group animate-pop-in relative overflow-hidden p-6 text-left transition duration-300 hover:-translate-y-1 disabled:opacity-60 ${card.glow}`}
            >
              <div className="flex items-start justify-between gap-4">
                <span className={`flex h-14 w-14 items-center justify-center rounded-2xl border bg-arena-950/80 transition group-hover:scale-110 ${card.accent}`}>
                  {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${card.accent}`}>{card.badge}</span>
              </div>
              <h2 className="mt-6 font-display text-xl font-extrabold text-slate-100">{card.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{card.description}</p>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleJoinCode} className="neon-panel mt-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-3 sm:flex-1">
          <KeyRound className="h-5 w-5 shrink-0 text-neon-blue" />
          <div>
            <p className="font-semibold text-slate-100">Have a room code?</p>
            <p className="text-sm text-slate-400">Enter the code your friend shared to join their lobby.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <input
            className="field w-40 font-display uppercase tracking-[0.3em]"
            value={code}
            maxLength={6}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
            aria-label="Room code"
          />
          <button type="submit" disabled={joining || code.trim().length < 6} className="neon-button">
            {joining && <Loader2 className="h-4 w-4 animate-spin" />}
            Join
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-neon-red/40 bg-neon-red/10 px-4 py-3 text-center text-sm text-red-200">
          {error}
        </p>
      )}

      {dialogMode && (
        <CreateRoomDialog
          mode={dialogMode}
          onClose={() => setDialogMode(null)}
          onCreated={onEnterRoom}
        />
      )}
    </div>
  );
}

