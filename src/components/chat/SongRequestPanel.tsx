import React, { useState } from 'react';
import { Music, Send, X, DollarSign } from 'lucide-react';

interface SongRequest {
  id: string;
  song_title: string;
  artist: string | null;
  status: string;
  requested_by: string;
}

interface SongRequestPanelProps {
  streamId: string;
  smokeEventId: string | null;
  songQueue: SongRequest[];
  onRequestSong: (title: string, artist?: string) => Promise<void>;
  isDisabled?: boolean;
}

export default function SongRequestPanel({
  streamId: _streamId,
  smokeEventId,
  songQueue,
  onRequestSong,
  isDisabled = false,
}: SongRequestPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || isDisabled) return;
    setSubmitting(true);
    setError(null);
    try {
      await onRequestSong(title.trim(), artist.trim() || undefined);
      setTitle('');
      setArtist('');
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!smokeEventId) return null;

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-medium transition-all"
      >
        <Music size={12} />
        Song Request
        {songQueue.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-blue-600/50 rounded-full text-[10px]">
            {songQueue.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-zinc-900 border border-blue-500/30 rounded-xl shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-blue-900/30 border-b border-blue-500/20">
            <div className="flex items-center gap-2">
              <Music size={14} className="text-blue-400" />
              <span className="text-sm font-bold text-white">Request Song</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white">
              <X size={14} />
            </button>
          </div>

          {/* Form */}
          <div className="p-3 space-y-2">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Song title *"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-blue-500"
              disabled={submitting}
            />
            <input
              type="text"
              value={artist}
              onChange={e => setArtist(e.target.value)}
              placeholder="Artist (optional)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-blue-500"
              disabled={submitting}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-zinc-400">
                <DollarSign size={10} />
                <span>10 Troll Coins</span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || submitting}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all"
              >
                <Send size={10} />
                {submitting ? '...' : 'Send'}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>

          {/* Queue */}
          {songQueue.length > 0 && (
            <div className="border-t border-blue-500/20 px-3 py-2 max-h-32 overflow-y-auto">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Queue</p>
              {songQueue.slice(0, 5).map((req) => (
                <div key={req.id} className="flex items-center gap-2 py-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    req.status === 'playing' ? 'bg-green-400 animate-pulse' : 'bg-zinc-500'
                  }`} />
                  <span className="text-xs text-white truncate">{req.song_title}</span>
                  {req.artist && <span className="text-xs text-zinc-500 truncate">- {req.artist}</span>}
                </div>
              ))}
              {songQueue.length > 5 && (
                <p className="text-[10px] text-zinc-500">+{songQueue.length - 5} more</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
