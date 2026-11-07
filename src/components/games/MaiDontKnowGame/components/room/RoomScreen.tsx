import { useState, type ReactNode } from 'react';
import { ArrowLeft, Loader2, RotateCcw, WifiOff } from 'lucide-react';
import MatchResults from '../../components/room/MatchResults';
import MatchScreen from '../../components/room/MatchScreen';
import WaitingRoom from '../../components/room/WaitingRoom';
import { GameError, errorText, gameApi } from '../../lib/gameApi';
import { useRoom } from '../../hooks/useRoom';

const FATAL_CODES = ['not_a_member', 'room_not_found', 'not_signed_in'];

interface RoomScreenProps {
  roomId: string;
  userId: string;
  onHome: () => void;
  onLeft: () => void;
  onOpenRoom: (roomId: string) => void;
}

export default function RoomScreen({ roomId, userId, onHome, onLeft, onOpenRoom }: RoomScreenProps) {
  const { state, clockOffset, error, sync } = useRoom(roomId);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (caught) {
      setActionError(errorText(caught));
    } finally {
      await sync();
      setBusy(false);
    }
  };

  const fatal = error instanceof GameError && FATAL_CODES.includes(error.code);

  if (!state) {
    if (fatal) {
      return (
        <CenteredNotice
          title="This lobby is no longer available"
          body={errorText(error)}
          actionLabel="Back to arcade"
          onAction={onLeft}
        />
      );
    }
    if (error) {
      return (
        <CenteredNotice
          title="Reconnecting to the lobby"
          body={errorText(error)}
          actionLabel="Try again"
          onAction={() => void sync()}
          secondaryLabel="Back to arcade"
          onSecondary={onHome}
        />
      );
    }
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-neon-blue">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  const { room } = state;
  const sharedProps = { state, userId, busy };

  const toggleReady = (ready: boolean) => run(() => gameApi.setReady(roomId, ready));
  const startMatch = () => run(() => gameApi.startMatch(roomId));
  const leave = () =>
    run(async () => {
      await gameApi.leaveRoom(roomId);
      onLeft();
    });
  const answer = (choice: number) => {
    if (!state.round) return Promise.resolve();
    return run(() => gameApi.submitAnswer(state.round!.id, choice));
  };
  const playAgain = () => run(async () => onOpenRoom(await gameApi.quickMatch()));
  const soloAgain = () => run(async () => onOpenRoom(await gameApi.createSoloMatch()));
  const rematch = () =>
    run(async () => onOpenRoom(await gameApi.createRoom(`${room.name} Rematch`, 'private', Math.max(2, room.max_players))));

  let content: ReactNode;
  if (room.status === 'waiting') {
    content = (
      <WaitingRoom
        {...sharedProps}
        clockOffset={clockOffset}
        onToggleReady={(ready) => void toggleReady(ready)}
        onStart={() => void startMatch()}
        onLeave={() => void leave()}
        onHome={onHome}
      />
    );
  } else if (room.status === 'in_progress') {
    content = (
      <MatchScreen
        {...sharedProps}
        clockOffset={clockOffset}
        onAnswer={(choice) => void answer(choice)}
        onHome={onHome}
      />
    );
  } else {
    content = (
      <MatchResults
        {...sharedProps}
        onPlayAgain={() => void (room.visibility === 'solo' ? soloAgain() : playAgain())}
        onRematch={() => void rematch()}
        onHome={onLeft}
      />
    );
  }

  return (
    <>
      {content}
      {(actionError || error) && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-40 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-neon-red/50 bg-arena-900/95 px-4 py-3 text-sm text-red-100 shadow-neon-red backdrop-blur"
        >
          {!actionError && <WifiOff className="h-4 w-4 shrink-0 text-neon-red" />}
          <span className="flex-1">{actionError ?? errorText(error)}</span>
          <button type="button" onClick={() => void sync()} aria-label="Retry" className="rounded-full p-1.5 text-neon-blue hover:bg-neon-blue/10">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}

interface CenteredNoticeProps {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

function CenteredNotice({ title, body, actionLabel, onAction, secondaryLabel, onSecondary }: CenteredNoticeProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="neon-panel w-full max-w-md animate-pop-in p-8 text-center">
        <WifiOff className="mx-auto h-10 w-10 text-neon-amber" />
        <h1 className="mt-4 font-display text-xl font-extrabold text-slate-100">{title}</h1>
        <p className="mt-3 text-sm text-slate-400">{body}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={onAction} className="neon-button">
            {actionLabel}
          </button>
          {secondaryLabel && onSecondary && (
            <button type="button" onClick={onSecondary} className="neon-button-ghost">
              <ArrowLeft className="h-4 w-4" /> {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

