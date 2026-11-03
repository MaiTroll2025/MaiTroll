import { ArrowRight, Gift, MapPin, Play, Tv, X } from 'lucide-react';

interface MaiTrollRunWelcomePopupProps {
  visible: boolean;
  mode?: 'welcome' | 'outofcoins';
  onClose: () => void;
  onPlay: () => void;
  onGoToCity: () => void;
  onOutOfCoins: () => void;
  coins: number;
}

export function MaiTrollRunWelcomePopup({
  visible,
  mode = 'welcome',
  onClose,
  onPlay,
  onGoToCity,
  onOutOfCoins,
  coins,
}: MaiTrollRunWelcomePopupProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-sm mx-6 rounded-2xl border border-cyan-400/30 bg-gradient-to-b from-[#0A0814] to-[#05040B] p-6 text-stone-100 shadow-[0_0_40px_rgba(0,191,255,.25)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-full bg-stone-900 p-1.5 text-stone-400 hover:text-white hover:bg-stone-800"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {mode === 'welcome' ? (
          <>
            <div className="flex items-center justify-center gap-3 mb-6">
              <Gift className="h-8 w-8 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,.6)]" />
              <h2 className="text-2xl font-serif font-bold text-stone-50 tracking-tight">Welcome to MaiTroll Run</h2>
            </div>

            <p className="mb-6 text-sm text-stone-300 leading-relaxed">
              No sign-up needed. Here&apos;s <span className="font-mono text-amber-300">{coins} Troll Coins</span> on the house to start playing.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={onPlay}
                className="w-full rounded-xl bg-amber-400 px-5 py-4 font-bold text-stone-950 shadow-lg shadow-amber-400/30 flex items-center justify-center gap-2 transition hover:bg-amber-300"
              >
                <Play className="h-5 w-5" /> Play MaiTroll Run
              </button>
              <button
                type="button"
                onClick={onGoToCity}
                className="w-full rounded-xl border border-cyan-400/30 bg-cyan-900/20 px-5 py-4 font-semibold text-cyan-100 flex items-center justify-center gap-2 transition hover:bg-cyan-900/40 hover:border-cyan-400"
              >
                <MapPin className="h-5 w-5" /> Go to the City
              </button>
            </div>

            <p className="mt-6 text-xs text-stone-500 text-center">
              Your game session stays on this device only — nothing is saved to an account.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3 mb-6">
              <Tv className="h-8 w-8 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,.6)]" />
              <h2 className="text-2xl font-serif font-bold text-stone-50 tracking-tight">Out of Coins</h2>
            </div>

            <p className="mb-6 text-sm text-stone-300 leading-relaxed">
              You&apos;re out of coins. Wanna keep playing? Hop on to MaiTroll and start broadcasting to receive coins — and tell your friends.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={onGoToCity}
                className="w-full rounded-xl bg-cyan-500 px-5 py-4 font-bold text-stone-950 shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 transition hover:bg-cyan-400"
              >
                <Tv className="h-5 w-5" /> Start Broadcasting
              </button>
              <button
                type="button"
                onClick={onOutOfCoins}
                className="w-full rounded-xl border border-stone-600 bg-stone-900/50 px-5 py-4 font-semibold text-stone-200 flex items-center justify-center gap-2 transition hover:border-stone-400"
              >
                <ArrowRight className="h-5 w-5" /> Tell Your Friends
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
