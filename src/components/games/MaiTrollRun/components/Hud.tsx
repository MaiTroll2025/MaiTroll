import { DIFFICULTIES, MAITROLL_LETTERS, POWER_COLORS, POWER_LABELS } from '@/components/games/MaiTrollRun/game/config';
import type { Difficulty, HudSnapshot, PowerKind } from '@/components/games/MaiTrollRun/game/types';

interface HudProps {
  hud: HudSnapshot;
  difficulty: Difficulty;
}

const ACTIVE_POWERS: PowerKind[] = ['shield', 'magnet', 'slow'];

function powerRemaining(hud: HudSnapshot, kind: PowerKind): number {
  if (kind === 'shield') return hud.power.shield;
  if (kind === 'magnet') return hud.power.magnet;
  return hud.power.slow;
}

export function Hud({ hud, difficulty }: HudProps) {
  const progressPercent = Math.round(hud.progress * 100);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-xl bg-black/60 px-3 py-2 backdrop-blur-sm">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300">
            Level {hud.levelNumber} of {hud.levelCount}
          </p>
          <p className="text-sm font-semibold text-stone-100">{hud.themeName}</p>
        </div>
        <div className="flex gap-1.5 rounded-xl bg-black/60 px-3 py-2 backdrop-blur-sm">
          {MAITROLL_LETTERS.map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              className={`font-serif text-lg font-bold transition-colors duration-300 ${
                hud.letters[index] ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.8)]' : 'text-stone-600'
              }`}
            >
              {letter}
            </span>
          ))}
        </div>
        <div className="rounded-xl bg-black/60 px-3 py-2 text-right backdrop-blur-sm">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400">Score</p>
          <p className="font-mono text-sm font-semibold text-stone-100">{hud.score.toLocaleString()}</p>
          <p className="font-mono text-xs text-amber-300">{hud.coins} troll_coins</p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ACTIVE_POWERS.map((kind) => {
            const remaining = powerRemaining(hud, kind);
            if (remaining <= 0) return null;
            return (
              <span
                key={kind}
                className="rounded-full border px-3 py-1 text-xs font-semibold text-stone-950"
                style={{ borderColor: POWER_COLORS[kind], background: POWER_COLORS[kind] }}
              >
                {POWER_LABELS[kind]}
                {` ${Math.ceil(remaining)}s`}
              </span>
            );
          })}
          <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] text-stone-400">
            {DIFFICULTIES[difficulty].label}
          </span>
        </div>
        <div className="w-40 sm:w-64">
          <div className="h-2 overflow-hidden rounded-full bg-black/60">
            <div
              className="h-full rounded-full bg-amber-400 transition-[width] duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-right font-mono text-[10px] text-stone-300">
            {progressPercent}% through this level
          </p>
        </div>
      </div>
    </div>
  );
}
