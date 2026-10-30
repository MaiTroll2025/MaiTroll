import React, { useEffect, useRef, useState } from 'react';
import {
  Crown,
  Zap,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Swords,
  Trophy,
  Sparkles,
  Plus,
} from 'lucide-react';

export interface UltimateModePowerUpDevProps {
  broadcasterName?: string;
  opponentName?: string;
  powerMeter?: number;
  isBattleActive?: boolean;
  disabled?: boolean;
  battleId?: string | number;
  ultimateScoreBonus?: number;
  previewMode?: boolean;
  onActivate?: () => void;
  onAnnounce?: (message: string) => void;
  className?: string;
}

type ActivationStatus = 'idle' | 'activating' | 'used';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function UltimateModePowerUpDev({
  broadcasterName = 'NeonReaper',
  opponentName = 'HyperSpecter',
  powerMeter,
  isBattleActive = true,
  disabled = false,
  battleId = 'preview-battle',
  ultimateScoreBonus = 500,
  previewMode = true,
  onActivate,
  onAnnounce,
  className = '',
}: UltimateModePowerUpDevProps) {
  const [demoMeter, setDemoMeter] = useState(75);
  const [demoOpponentMeter, setDemoOpponentMeter] = useState(75);
  const [demoScore, setDemoScore] = useState(18427);
  const [demoOpponentScore, setDemoOpponentScore] = useState(16115);

  const [status, setStatus] = useState<ActivationStatus>('idle');
  const [opponentStatus, setOpponentStatus] =
    useState<ActivationStatus>('idle');

  const [feedback, setFeedback] = useState(
    'Charge your meter to 100% to unlock Ultimate Mode.',
  );
  const [announcer, setAnnouncer] = useState(
    'The battle is heating up! Who will unleash the ultimate?',
  );
  const [showUltimate, setShowUltimate] = useState(false);
  const [ultimateSide, setUltimateSide] = useState<'player' | 'opponent'>(
    'player',
  );
  const [battleNumber, setBattleNumber] = useState(1);

  const activationLock = useRef(false);
  const opponentActivationLock = useRef(false);
  const mountedRef = useRef(false);
  const animationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousBattleId = useRef(battleId);

  const meter = clamp(
    Number.isFinite(powerMeter) ? (powerMeter ?? demoMeter) : 0,
    0,
    100,
  );

  const playerMeter = previewMode ? demoMeter : meter;
  const enemyMeter = demoOpponentMeter;
  const playerScore = demoScore;
  const enemyScore = demoOpponentScore;

  const isReady = playerMeter >= 100;
  const opponentIsReady = enemyMeter >= 100;
  const hasActivated = status === 'used';
  const opponentHasActivated = opponentStatus === 'used';
  const isActivating = status === 'activating';
  const opponentIsActivating = opponentStatus === 'activating';

  const clearTimers = () => {
    if (animationTimeout.current !== null) {
      clearTimeout(animationTimeout.current);
      animationTimeout.current = null;
    }

    if (flashTimeout.current !== null) {
      clearTimeout(flashTimeout.current);
      flashTimeout.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (previousBattleId.current === battleId) return;

    previousBattleId.current = battleId;
    clearTimers();

    activationLock.current = false;
    opponentActivationLock.current = false;

    setStatus('idle');
    setOpponentStatus('idle');
    setShowUltimate(false);
    setFeedback('New battle started. Charge your meter to unleash Ultimate Mode.');
    setAnnouncer('A new battle begins! Let the showdown commence.');

    if (previewMode) {
      setDemoMeter(75);
      setDemoOpponentMeter(75);
      setDemoScore(18427);
      setDemoOpponentScore(16115);
      setBattleNumber((current) => current + 1);
    }
  }, [battleId, previewMode]);

  useEffect(() => {
    if (!isBattleActive) {
      clearTimers();
      activationLock.current = false;
      opponentActivationLock.current = false;
      setStatus((current) => current === 'activating' ? 'idle' : current);
      setOpponentStatus((current) =>
        current === 'activating' ? 'idle' : current,
      );
      setShowUltimate(false);
    }
  }, [isBattleActive]);

  const announce = (message: string) => {
    setAnnouncer(message);
    onAnnounce?.(message);
  };

  const chargePlayer = (amount: number) => {
    if (!previewMode || !isBattleActive || disabled || hasActivated || isActivating) {
      return;
    }

    setDemoMeter((current) => {
      const next = clamp(current + amount, 0, 100);

      if (next >= 100 && current < 100) {
        announce(`${broadcasterName}'s Ultimate Mode is READY!`);
        setFeedback('FULL POWER! Unleash Ultimate Mode now!');
      } else {
        setFeedback(`${broadcasterName}'s power meter: ${next}%.`);
      }

      return next;
    });
  };

  const chargeOpponent = (amount: number) => {
    if (
      !previewMode ||
      !isBattleActive ||
      opponentHasActivated ||
      opponentIsActivating
    ) {
      return;
    }

    setDemoOpponentMeter((current) => {
      const next = clamp(current + amount, 0, 100);

      if (next >= 100 && current < 100) {
        announce(`${opponentName}'s Ultimate Mode is READY!`);
      }

      return next;
    });
  };

  const activatePlayerUltimate = () => {
    if (activationLock.current || status !== 'idle') return;

    if (!isBattleActive) {
      setFeedback('Ultimate Mode is only available during an active battle.');
      return;
    }

    if (disabled) {
      setFeedback('Ultimate Mode is currently unavailable.');
      return;
    }

    if (!isReady) {
      setFeedback('Your power meter must reach 100% first.');
      return;
    }

    activationLock.current = true;
    setStatus('activating');
    setUltimateSide('player');
    setShowUltimate(true);
    setFeedback(`${broadcasterName} is unleashing Ultimate Mode!`);

    announce(
      `ULTIMATE MODE! ${broadcasterName} unleashes the ultimate attack!`,
    );

    try {
      if (previewMode) {
        // The preview applies a real local score bonus and consumes the meter.
        setDemoMeter(0);
        setDemoScore((current) => current + ultimateScoreBonus);

        setFeedback(
          `${broadcasterName} gained ${ultimateScoreBonus.toLocaleString()} battle points!`,
        );
      } else {
        if (!onActivate) {
          throw new Error('No battle activation handler is connected.');
        }

        // In production mode, the parent battle engine owns the actual effect.
        onActivate();
      }

      setStatus('used');

      announce(
        `${broadcasterName} scores an ultimate strike! +${ultimateScoreBonus.toLocaleString()} points in the preview!`,
      );
    } catch (error) {
      activationLock.current = false;
      setStatus('idle');
      setShowUltimate(false);
      setFeedback('Ultimate activation failed. Please check the battle handler.');
      console.error('Ultimate Mode activation failed:', error);
      return;
    }

    clearTimers();

    animationTimeout.current = setTimeout(() => {
      if (!mountedRef.current) return;

      setShowUltimate(false);
      animationTimeout.current = null;
    }, 1600);
  };

  const activateOpponentUltimate = () => {
    if (!previewMode || opponentActivationLock.current || opponentStatus !== 'idle') {
      return;
    }

    if (!isBattleActive || !opponentIsReady) {
      setFeedback(
        !isBattleActive
          ? 'The battle is inactive.'
          : `${opponentName} needs 100% power to activate Ultimate Mode.`,
      );
      return;
    }

    opponentActivationLock.current = true;
    setOpponentStatus('activating');
    setUltimateSide('opponent');
    setShowUltimate(true);

    setDemoOpponentMeter(0);
    setDemoOpponentScore((current) => current + ultimateScoreBonus);

    setOpponentStatus('used');
    setFeedback(`${opponentName} unleashed Ultimate Mode!`);
    announce(
      `ULTIMATE MODE! ${opponentName} unleashes the ultimate attack and scores ${ultimateScoreBonus.toLocaleString()} bonus points!`,
    );

    clearTimers();

    animationTimeout.current = setTimeout(() => {
      if (!mountedRef.current) return;

      setShowUltimate(false);
      animationTimeout.current = null;
    }, 1600);
  };

  const startNewBattle = () => {
    clearTimers();

    activationLock.current = false;
    opponentActivationLock.current = false;

    setStatus('idle');
    setOpponentStatus('idle');
    setShowUltimate(false);

    setDemoMeter(75);
    setDemoOpponentMeter(75);
    setDemoScore(18427);
    setDemoOpponentScore(16115);
    setBattleNumber((current) => current + 1);

    setFeedback('New preview battle ready. Both meters start at 75%.');
    announce('New battle! Both broadcasters have a fresh chance to win!');
  };

  const leader =
    playerScore > enemyScore
      ? broadcasterName
      : enemyScore > playerScore
        ? opponentName
        : 'Tied';

  const canActivatePlayer =
    isReady &&
    isBattleActive &&
    !disabled &&
    status === 'idle';

  const canActivateOpponent =
    previewMode &&
    opponentIsReady &&
    isBattleActive &&
    opponentStatus === 'idle';

  return (
    <section
      className={[
        'relative isolate overflow-hidden rounded-2xl border border-yellow-400/40',
        'bg-gradient-to-br from-slate-950 via-purple-950 to-black p-4 text-white',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Ultimate Mode battle preview"
    >
      <style>{`
        @keyframes ultimate-flash {
          0% { opacity: 0; transform: scale(0.5); }
          18% { opacity: 1; transform: scale(1.05); }
          55% { opacity: 0.9; transform: scale(1.25); }
          100% { opacity: 0; transform: scale(1.8); }
        }
        @keyframes ultimate-ring {
          0% { opacity: 0.95; transform: scale(0.2) rotate(0deg); }
          100% { opacity: 0; transform: scale(2.5) rotate(160deg); }
        }
        @keyframes ultimate-text {
          0% { opacity: 0; transform: scale(0.45) translateY(20px); }
          20% { opacity: 1; transform: scale(1.12) translateY(0); }
          75% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(1.3) translateY(-12px); }
        }
        @keyframes ultimate-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes ultimate-particle {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0); }
        }
        .ultimate-flash { animation: ultimate-flash 1.4s ease-out forwards; }
        .ultimate-ring { animation: ultimate-ring 1.3s ease-out forwards; }
        .ultimate-text { animation: ultimate-text 1.6s ease-out forwards; }
        .ultimate-shake { animation: ultimate-shake 0.35s linear; }
        .ultimate-particle { animation: ultimate-particle 1.2s ease-out forwards; }
      `}</style>

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
          isActivating ? 'opacity-100' : 'opacity-30'
        }`}
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(250,204,21,0.24), transparent 65%)',
        }}
      />

      {showUltimate && (
        <div
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden"
          aria-hidden="true"
        >
          <div className="ultimate-flash absolute inset-0 bg-yellow-100/50" />

          <div className="ultimate-ring absolute h-32 w-32 rounded-full border-8 border-yellow-200 shadow-[0_0_50px_rgba(250,204,21,0.9)]" />

          <div className="ultimate-ring absolute h-32 w-32 rounded-full border-4 border-fuchsia-400 shadow-[0_0_50px_rgba(217,70,239,0.9)]" />

          {Array.from({ length: 16 }, (_, index) => {
            const angle = (index / 16) * Math.PI * 2;
            const distance = 100 + (index % 4) * 25;

            return (
              <span
                key={index}
                className="ultimate-particle absolute h-2 w-2 rounded-full bg-yellow-200 shadow-[0_0_12px_rgba(250,204,21,1)]"
                style={
                  {
                    '--tx': `${Math.cos(angle) * distance}px`,
                    '--ty': `${Math.sin(angle) * distance}px`,
                    animationDelay: `${(index % 4) * 30}ms`,
                  } as React.CSSProperties
                }
              />
            );
          })}

          <div className="ultimate-text relative rounded-2xl border border-yellow-200/80 bg-black/90 px-6 py-4 text-center shadow-[0_0_55px_rgba(250,204,21,0.6)]">
            <Crown className="mx-auto mb-1 h-8 w-8 text-yellow-300" />
            <p className="text-xs font-black tracking-[0.35em] text-fuchsia-300">
              {ultimateSide === 'player' ? broadcasterName : opponentName}
            </p>
            <p className="mt-1 text-2xl font-black italic tracking-wider text-yellow-200">
              ULTIMATE!
            </p>
            <p className="mt-1 text-xs font-bold text-white">
              +{ultimateScoreBonus.toLocaleString()} POINTS
            </p>
          </div>
        </div>
      )}

      <header className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-yellow-300/40 bg-yellow-400/10">
            <Crown className="h-7 w-7 text-yellow-300" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-black uppercase tracking-wider text-yellow-200">
              Ultimate Mode
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              Battle Finisher · Preview #{battleNumber}
            </p>
          </div>
        </div>

        <span
          className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
            hasActivated
              ? 'border-slate-500/40 bg-slate-700/30 text-slate-300'
              : isReady
                ? 'border-yellow-300/50 bg-yellow-400/10 text-yellow-200'
                : 'border-purple-400/30 bg-purple-500/10 text-purple-200'
          }`}
        >
          {hasActivated ? 'Used' : isReady ? 'Ready' : 'Charging'}
        </span>
      </header>

      <div className="relative z-10 mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
          <p className="truncate text-xs font-bold text-emerald-200">
            {broadcasterName}
          </p>
          <p className="mt-1 text-xl font-black tabular-nums">
            {playerScore.toLocaleString()}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
            Battle points
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-lime-300 transition-all duration-500"
              style={{
                width: `${clamp(
                  (playerScore / Math.max(1, playerScore + enemyScore)) * 100 * 2,
                  0,
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/5 p-3 text-right">
          <p className="truncate text-xs font-bold text-fuchsia-200">
            {opponentName}
          </p>
          <p className="mt-1 text-xl font-black tabular-nums">
            {enemyScore.toLocaleString()}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
            Battle points
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/60">
            <div
              className="ml-auto h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-300 transition-all duration-500"
              style={{
                width: `${clamp(
                  (enemyScore / Math.max(1, playerScore + enemyScore)) * 100 * 2,
                  0,
                  100,
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-3 flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs">
        <Trophy className="h-4 w-4 text-yellow-300" />
        <span className="text-slate-300">Current leader:</span>
        <span className="font-black text-white">{leader}</span>
      </div>

      <div className="relative z-10 mt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-slate-300">{broadcasterName} power meter</span>
          <span className="font-black tabular-nums text-yellow-200">
            {playerMeter}%
          </span>
        </div>

        <div
          className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/60"
          role="progressbar"
          aria-label={`${broadcasterName} power meter`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={playerMeter}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isReady
                ? 'bg-gradient-to-r from-yellow-500 via-amber-300 to-white shadow-[0_0_15px_rgba(250,204,21,0.8)]'
                : 'bg-gradient-to-r from-purple-700 to-fuchsia-400'
            }`}
            style={{ width: `${playerMeter}%` }}
          />
        </div>

        {previewMode && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => chargePlayer(10)}
              disabled={
                !isBattleActive ||
                disabled ||
                hasActivated ||
                isActivating ||
                playerMeter >= 100
              }
              className="inline-flex items-center gap-1 rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-200 hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
              Charge +10%
            </button>

            <button
              type="button"
              onClick={() => chargePlayer(25)}
              disabled={
                !isBattleActive ||
                disabled ||
                hasActivated ||
                isActivating ||
                playerMeter >= 100
              }
              className="inline-flex items-center gap-1 rounded-lg border border-yellow-400/30 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-200 hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Zap className="h-3 w-3" />
              Charge +25%
            </button>
          </div>
        )}
      </div>

      {previewMode && (
        <div className="relative z-10 mt-5 rounded-xl border border-fuchsia-400/20 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-fuchsia-200">
              {opponentName} power meter
            </span>
            <span className="text-xs font-black tabular-nums text-fuchsia-200">
              {enemyMeter}%
            </span>
          </div>

          <div
            className="h-2 overflow-hidden rounded-full bg-black/60"
            role="progressbar"
            aria-label={`${opponentName} power meter`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={enemyMeter}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-300 transition-all duration-500"
              style={{ width: `${enemyMeter}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => chargeOpponent(10)}
              disabled={
                opponentHasActivated ||
                opponentIsActivating ||
                enemyMeter >= 100 ||
                !isBattleActive
              }
              className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Charge opponent +10%
            </button>

            <button
              type="button"
              onClick={activateOpponentUltimate}
              disabled={!canActivateOpponent}
              className="rounded-lg border border-fuchsia-300/40 bg-fuchsia-500/15 px-3 py-2 text-xs font-bold text-fuchsia-100 hover:bg-fuchsia-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {opponentHasActivated
                ? 'Opponent Ultimate Used'
                : 'Test Opponent Ultimate'}
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={activatePlayerUltimate}
          disabled={!canActivatePlayer}
          aria-busy={isActivating}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-300/50 bg-gradient-to-r from-yellow-500/20 to-amber-300/10 px-4 py-3 text-sm font-black uppercase tracking-wide text-yellow-100 transition hover:border-yellow-200 hover:bg-yellow-400/20 focus:outline-none focus:ring-2 focus:ring-yellow-300/70 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500"
        >
          {hasActivated ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : !isReady ? (
            <ShieldAlert className="h-4 w-4" />
          ) : (
            <Zap className="h-4 w-4" />
          )}

          {hasActivated
            ? 'Ultimate Used'
            : isActivating
              ? 'Unleashing Ultimate...'
              : !isBattleActive
                ? 'Battle Inactive'
                : !isReady
                  ? 'Charge to 100%'
                  : disabled
                    ? 'Currently Unavailable'
                    : 'Unleash Ultimate'}
        </button>

        {previewMode && (
          <button
            type="button"
            onClick={startNewBattle}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <RotateCcw className="h-3 w-3" />
            Start New Preview Battle
          </button>
        )}
      </div>

      <div className="relative z-10 mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-200">
              Live Battle Announcer
            </p>
            <p className="mt-1 text-sm font-semibold text-white" aria-live="polite">
              {announcer}
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className="relative z-10 mt-3 flex items-start gap-2 rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-200"
          role="status"
          aria-live="polite"
        >
          {hasActivated ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-yellow-300" />
          )}
          <span>{feedback}</span>
        </div>
      )}

      <p className="relative z-10 mt-4 border-t border-white/10 pt-3 text-[10px] uppercase tracking-widest text-slate-500">
        {previewMode
          ? 'Interactive development preview · Local scores only · No coin transactions'
          : 'Battle integration mode · Battle engine owns the ultimate effect'}
      </p>
    </section>
  );
}