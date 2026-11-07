import { useState, type FormEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import { errorText, gameApi } from '../lib/gameApi';

export interface LobbyMode {
  title: string;
  description: string;
  visibility: 'public' | 'private';
  defaultSize: number;
}

interface CreateRoomDialogProps {
  mode: LobbyMode;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

const SIZE_OPTIONS = Array.from({ length: 11 }, (_, index) => index + 2);

export default function CreateRoomDialog({ mode, onClose, onCreated }: CreateRoomDialogProps) {
  const [name, setName] = useState(`${mode.title}`);
  const [size, setSize] = useState(mode.defaultSize);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const roomId = await gameApi.createRoom(name, mode.visibility, size);
      onCreated(roomId);
    } catch (caught) {
      setError(errorText(caught));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="neon-panel w-full max-w-lg animate-pop-in rounded-b-none p-6 sm:rounded-2xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neon-green">{mode.visibility === 'public' ? 'Open to all' : 'Invite only'}</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-100">{mode.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{mode.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-400 transition hover:bg-arena-800 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Lobby name</span>
            <input className="field" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} required />
          </label>

          <div>
            <span className="mb-2 block text-sm text-slate-300">Players (up to 12)</span>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
              {SIZE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSize(option)}
                  aria-pressed={size === option}
                  className={`rounded-lg py-2 font-display text-sm font-extrabold transition ${
                    size === option
                      ? 'bg-neon-green text-arena-950 shadow-neon-green'
                      : 'border border-arena-600 text-slate-300 hover:border-neon-green/60'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {error && <p role="alert" className="rounded-xl border border-neon-red/40 bg-neon-red/10 px-4 py-3 text-sm text-red-200">{error}</p>}

          <button type="submit" disabled={busy} className="neon-button w-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Open lobby
          </button>
        </form>
      </div>
    </div>
  );
}

