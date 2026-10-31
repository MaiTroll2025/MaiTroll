import { useEffect, useState } from 'react';
import { DIFFICULTY_ORDER, DIFFICULTIES } from '@/components/games/MaiTrollRun/game/config';
import { openWallet, startRun, type ActiveRun } from '@/components/games/MaiTrollRun/lib/trollApi';
import type { Difficulty, Gender } from '@/components/games/MaiTrollRun/game/types';

interface SetupScreenProps {
  playerId: string;
  onStart: (run: ActiveRun) => void;
  onOpenLeaderboard: () => void;
}

const NAME_MAX = 16;

export function SetupScreen({ playerId, onStart, onOpenLeaderboard }: SetupScreenProps) {
  const [name, setName] = useState('');
  useEffect(() => { let active=true; import('../lib/trollApi').then(({getProfile}) => getProfile(playerId)).then((profile)=>{if(active)setName(profile.display_name || profile.username || 'Troll');}).catch(()=>{if(active)setLoadError('Could not retrieve MaiTroll profile.');});return()=>{active=false};},[playerId]);
  const [gender, setGender] = useState<Gender>('female');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [balance, setBalance] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    openWallet(playerId)
      .then((value) => {
        if (!cancelled) setBalance(value);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load your troll_coins.');
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const fee = DIFFICULTIES[difficulty].entryFee;
  const trimmedName = name.trim();
  const canAfford = balance !== null && balance >= fee;
  const canStart = trimmedName.length > 0 && canAfford && !starting;

  const handleStart = async () => {
    if (!canStart) return;
    setStarting(true);
    setStartError(null);
    try {
      const runId = await startRun(playerId, trimmedName, gender, difficulty);
      onStart({
        runId,
        playerName: trimmedName,
        gender,
        difficulty,
        seed: Math.floor(Math.random() * 2_147_483_647),
      });
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Could not start the run.');
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Broadcast arcade</p>
          <h1 className="mt-2 font-serif text-4xl font-bold text-stone-50 sm:text-5xl">Maitroll Run</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
            Sprint across eight cursed realms, leap chasms, climb ladders and collect the letters of
            MAITROLL. Every run costs troll_coins.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="self-start rounded-full border border-stone-700 px-4 py-2 text-sm font-medium text-stone-200 transition hover:border-amber-400 hover:text-amber-300 sm:self-auto"
        >
          Leaderboard
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-stone-800 bg-stone-900/70 p-6">
          <label htmlFor="troll-name" className="text-sm font-semibold text-stone-200">
            Troll name
          </label>
          <input
            id="troll-name"
            value={name}
            maxLength={NAME_MAX}
            readOnly
            placeholder="Your MaiTroll display name"
            className="mt-2 w-full rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 placeholder:text-stone-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />

          <p className="mt-6 text-sm font-semibold text-stone-200">Troll</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(['female', 'male'] as Gender[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setGender(option)}
                aria-pressed={gender === option}
                className={`rounded-xl border px-4 py-4 text-left transition ${
                  gender === option
                    ? 'border-amber-400 bg-amber-400/10 text-amber-200'
                    : 'border-stone-700 bg-stone-950 text-stone-300 hover:border-stone-500'
                }`}
              >
                <span className="block text-base font-semibold capitalize">{option}</span>
                <span className="mt-1 block text-xs text-stone-400">
                  {option === 'female' ? 'Braided hair, lean stride' : 'Broad shoulders, heavy tusks'}
                </span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm font-semibold text-stone-200">Difficulty</p>
          <div className="mt-2 grid gap-2">
            {DIFFICULTY_ORDER.map((level) => {
              const config = DIFFICULTIES[level];
              const active = difficulty === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  aria-pressed={active}
                  className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${
                    active
                      ? 'border-amber-400 bg-amber-400/10'
                      : 'border-stone-700 bg-stone-950 hover:border-stone-500'
                  }`}
                >
                  <span>
                    <span className="block text-sm font-semibold text-stone-100">{config.label}</span>
                    <span className="block text-xs text-stone-400">{config.description}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-stone-800 px-3 py-1 font-mono text-xs text-amber-300">
                    {config.entryFee} coins
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="flex flex-col rounded-2xl border border-stone-800 bg-stone-900/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Your balance</p>
          <p className="mt-2 font-mono text-4xl font-bold text-amber-300">
            {balance !== null ? balance : '...'}
          </p>
          <p className="text-sm text-stone-400">troll_coins</p>

          <div className="mt-6 rounded-xl bg-stone-950 p-4 text-sm leading-relaxed text-stone-300">
            <p>
              Entry fee: <span className="font-mono text-amber-300">{fee}</span> troll_coins
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Entry fees use your actual MaiTroll Troll Coins. Collected game coins are recorded as a score only; payouts require server-verified gameplay.
            </p>
          </div>

          {loadError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
              {loadError}
            </p>
          )}
          {!loadError && balance !== null && !canAfford && (
            <p className="mt-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
              Not enough troll_coins for this difficulty. Pick an easier run.
            </p>
          )}
          {startError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
              {startError}
            </p>
          )}

          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="mt-auto rounded-xl bg-amber-400 px-6 py-4 text-base font-bold text-stone-950 shadow-lg shadow-amber-400/20 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400 disabled:shadow-none"
          >
            {starting ? 'Starting...' : `Pay ${fee} and run`}
          </button>
          {trimmedName.length === 0 && (
            <p className="mt-2 text-center text-xs text-stone-500">Set your display name in your MaiTroll profile to play.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
