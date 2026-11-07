import { Check, X } from 'lucide-react';
const LETTERS = ['A', 'B', 'C', 'D'] as const;
const LETTER_TONES = [
  'border-neon-blue/50 text-neon-blue',
  'border-neon-green/50 text-neon-green',
  'border-neon-purple/50 text-neon-purple',
  'border-neon-amber/50 text-neon-amber',
] as const;

interface AnswerGridProps {
  options: string[];
  selected: number | null;
  correctIndex: number | null;
  disabled: boolean;
  votesByIndex?: Record<number, string[]>;
  onPick?: (index: number) => void;
}

export default function AnswerGrid({
  options,
  selected,
  correctIndex,
  disabled,
  votesByIndex,
  onPick,
}: AnswerGridProps) {
  const revealed = correctIndex !== null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((value, index) => {
        const isCorrect = revealed && index === correctIndex;
        const isWrongPick = revealed && index === selected && index !== correctIndex;
        const isSelected = !revealed && index === selected;
        const dimmed = revealed && !isCorrect && !isWrongPick;
        const voters = votesByIndex?.[index] ?? [];

        const stateClass = isCorrect
          ? 'border-neon-green bg-neon-green/15 shadow-neon-green'
          : isWrongPick
            ? 'animate-shake border-neon-red bg-neon-red/15 shadow-neon-red'
            : isSelected
              ? 'border-neon-blue bg-neon-blue/15 shadow-neon-blue'
              : 'border-arena-600 bg-arena-900/70';

        return (
          <button
            key={`${index}-${value}`}
            type="button"
            disabled={disabled || !onPick}
            onClick={() => onPick?.(index)}
            className={`relative flex min-h-[84px] w-full items-center gap-4 rounded-xl border-2 px-4 py-4 text-left transition duration-200 disabled:cursor-default ${stateClass} ${
              dimmed ? 'opacity-40' : 'opacity-100'
            } ${onPick && !disabled ? 'hover:-translate-y-0.5 hover:border-neon-blue/70' : ''}`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-arena-950 font-display text-sm font-bold ${LETTER_TONES[index % LETTER_TONES.length]}`}
            >
              {LETTERS[index % LETTERS.length]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-xl font-bold text-slate-100 sm:text-2xl">
                {value}
              </span>
              {voters.length > 0 && (
                <span className="mt-1 block truncate text-xs text-slate-400">
                  {voters.slice(0, 4).join(', ')}
                  {voters.length > 4 ? ` +${voters.length - 4}` : ''}
                </span>
              )}
            </span>
            {isCorrect && <Check className="h-6 w-6 shrink-0 text-neon-green" aria-label="Correct answer" />}
            {isWrongPick && <X className="h-6 w-6 shrink-0 text-neon-red" aria-label="Your wrong pick" />}
            {isSelected && !revealed && (
              <span className="shrink-0 rounded-full bg-neon-blue/20 px-2.5 py-1 text-xs font-semibold text-neon-blue">
                Locked
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
