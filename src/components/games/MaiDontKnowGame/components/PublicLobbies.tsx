import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Globe, Loader2, Plus, RefreshCw, Users } from 'lucide-react';
import CreateRoomDialog, { type LobbyMode } from '../components/CreateRoomDialog';
import { errorText, gameApi } from '../lib/gameApi';
import type { PublicRoom } from '../lib/types';

const REFRESH_MS = 4000;
const PUBLIC_LOBBY_MODE: LobbyMode = {
  title: 'Public Lobby',
  description: 'Anyone in the arcade can find and join this room.',
  visibility: 'public',
  defaultSize: 8,
};

interface PublicLobbiesProps {
  onBack: () => void;
  onEnterRoom: (roomId: string) => void;
}

export default function PublicLobbies({ onBack, onEnterRoom }: PublicLobbiesProps) {
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [hosting, setHosting] = useState(false);

  const load = useCallback(async () => {
    try {
      setRooms(await gameApi.listPublicRooms());
      setError(null);
    } catch (caught) {
      setError(errorText(caught));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const join = async (roomId: string) => {
    setError(null);
    setJoiningId(roomId);
    try {
      onEnterRoom(await gameApi.joinRoomById(roomId));
    } catch (caught) {
      setError(errorText(caught));
      setJoiningId(null);
      void load();
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-neon-blue">
        <ArrowLeft className="h-4 w-4" /> Back to arcade
      </button>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neon-amber">Live rooms</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-slate-100">Public Lobbies</h1>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => void load()} className="neon-button-ghost px-4 py-2.5 text-sm" aria-label="Refresh lobbies">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button type="button" onClick={() => setHosting(true)} className="neon-button px-4 py-2.5 text-sm">
            <Plus className="h-4 w-4" /> Host a lobby
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-6 rounded-xl border border-neon-red/40 bg-neon-red/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {rooms === null && (
        <div className="flex justify-center py-20 text-neon-blue">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {rooms && rooms.length === 0 && (
        <div className="neon-panel animate-pop-in p-10 text-center">
          <Globe className="mx-auto h-10 w-10 text-neon-amber" />
          <p className="mt-4 font-display text-lg font-bold text-slate-100">No open lobbies right now</p>
          <p className="mt-2 text-sm text-slate-400">Host one and the arcade will start filling it up.</p>
        </div>
      )}

      <ul className="space-y-3">
        {rooms?.map((room, index) => {
          const full = room.player_count >= room.max_players;
          return (
            <li
              key={room.room_id}
              style={{ animationDelay: `${index * 50}ms` }}
              className="neon-panel animate-pop-in flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-slate-100">{room.room_name}</p>
                <p className="mt-1 text-sm text-slate-400">Hosted by {room.host_name}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 rounded-full border border-neon-green/40 px-3 py-1 text-sm font-semibold text-neon-green">
                  <Users className="h-4 w-4" />
                  {room.player_count}/{room.max_players}
                </span>
                <button
                  type="button"
                  disabled={full || joiningId !== null}
                  onClick={() => void join(room.room_id)}
                  className="neon-button px-5 py-2.5 text-sm"
                >
                  {joiningId === room.room_id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {full ? 'Full' : 'Join'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {hosting && (
        <CreateRoomDialog
          mode={PUBLIC_LOBBY_MODE}
          onClose={() => setHosting(false)}
          onCreated={onEnterRoom}
        />
      )}
    </div>
  );
}

