import React, { useMemo } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Gauge,
  ShieldCheck,
  Sparkles,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { cn } from '../lib/utils';

interface FastPayProgramProps {
  compact?: boolean;

  /**
   * Successful cashouts made by the current user during the
   * previous 24 hours.
   *
   * This value must come from server-validated cashout data.
   */
  successfulCashoutsLast24Hours?: number;

  /**
   * Earliest time the user may submit another cashout after
   * reaching the daily limit.
   */
  nextCashoutAvailableAt?: string | Date | null;

  /**
   * Loading state while cashout eligibility is retrieved.
   */
  loading?: boolean;
}

const DAILY_CASHOUT_LIMIT = 1;

export default function FastPayProgram({
  compact = false,
  successfulCashoutsLast24Hours = 0,
  nextCashoutAvailableAt = null,
  loading = false,
}: FastPayProgramProps) {
  const { profile } = useAuthStore();

  const cashoutLimit = DAILY_CASHOUT_LIMIT;

  const completedCashouts = Math.min(
    cashoutLimit,
    Math.max(0, Math.floor(successfulCashoutsLast24Hours))
  );

  const remainingCashouts = Math.max(
    0,
    cashoutLimit - completedCashouts
  );

  const hasReachedCashoutLimit =
    completedCashouts >= cashoutLimit;

  const isVerified = Boolean(profile?.verified_since);

  const mayCashOut =
    isVerified &&
    !hasReachedCashoutLimit &&
    !loading;

  const nextCashoutWait = useMemo(
    () => formatRemainingTime(nextCashoutAvailableAt),
    [nextCashoutAvailableAt]
  );

  const progressPercent =
    (completedCashouts / cashoutLimit) * 100;

  if (compact) {
    return (
      <div
        className={cn(
          'rounded-2xl border bg-slate-950/75 p-4 backdrop-blur-xl',
          'border-cyan-400/20 shadow-[0_0_30px_rgba(34,211,238,0.08)]'
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
              'border-cyan-400/20 bg-cyan-400/10 text-cyan-300'
            )}
          >
            <WalletCards className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-black text-white">
                MaiTroll Cashouts
              </p>

              {!loading && mayCashOut && (
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-emerald-400"
                  aria-label="Eligible to cash out"
                />
              )}
            </div>

            <p className="truncate text-xs text-slate-400">
              {loading
                ? 'Checking cashout access...'
                : !isVerified
                  ? 'Account verification required'
                  : hasReachedCashoutLimit
                    ? `Limit reached • ${nextCashoutWait}`
                    : `${remainingCashouts} of ${cashoutLimit} cashout remaining today`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      className={cn(
        'overflow-hidden rounded-[2rem] border bg-slate-950/80 shadow-2xl backdrop-blur-2xl',
        'border-white/10'
      )}
    >
      <header
        className={cn(
          'relative overflow-hidden border-b px-5 py-6 sm:px-7',
          'border-white/10 bg-gradient-to-r from-cyan-950 via-slate-950 to-blue-950'
        )}
      >
        <div
          className={cn(
            'pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl',
            'bg-cyan-400/10'
          )}
        />

        <div
          className={cn(
            'pointer-events-none absolute -bottom-24 left-10 h-64 w-64 rounded-full blur-3xl',
            'bg-blue-500/10'
          )}
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border',
                'border-cyan-300/20 bg-cyan-400/10 text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.14)]'
              )}
            >
              <WalletCards className="h-7 w-7" aria-hidden="true" />
            </div>

            <div>
              <p
                className={cn(
                  'text-xs font-black uppercase tracking-[0.22em]',
                  'text-cyan-300'
                )}
              >
                Mai Troll Earnings
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-white sm:text-3xl">
                  Cashout Program
                </h2>
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Verified users may cash out once per day after earning enough coins for a supported cashout amount.
              </p>
            </div>
          </div>

          <CashoutStatus
            loading={loading}
            isVerified={isVerified}
            hasReachedCashoutLimit={hasReachedCashoutLimit}
            mayCashOut={mayCashOut}
            remainingCashouts={remainingCashouts}
            cashoutLimit={cashoutLimit}
            nextCashoutWait={nextCashoutWait}
          />
        </div>
      </header>

      <div className="space-y-7 p-5 sm:p-7">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Cashout Access"
            value="No Levels"
            description="User levels never restrict cashout eligibility."
            accentClassName="text-emerald-300"
            iconClassName="bg-emerald-400/10 text-emerald-300"
          />

          <SummaryCard
            icon={<Sparkles className="h-5 w-5" />}
            label="Cashout Fees"
            value="$0 / 5%"
            description="PayPal: $0.25 flat (50 coins). Venmo & Cash App: 5% fee."
            accentClassName="text-cyan-300"
            iconClassName="bg-cyan-400/10 text-cyan-300"
          />

          <SummaryCard
            icon={
              <Gauge className="h-5 w-5" />
            }
             label="Daily Limit"
             value={`${cashoutLimit} per day`}
             description={'Only successful cashouts count toward the limit.'}
            accentClassName="text-violet-300"
            iconClassName="bg-violet-400/10 text-violet-300"
          />
        </div>

        <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>

             <div>
               <h3 className="text-base font-black text-emerald-300">
                 Cashout Fee
               </h3>

               <p className="mt-1 text-sm leading-6 text-slate-300">
                 A $0.25 processing fee applies per cashout.
                 The net amount is paid out to you.
               </p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-5">
            <div
              className={cn(
                'flex items-center gap-2',
                'text-cyan-300'
              )}
            >
              <Gauge className="h-4 w-4" aria-hidden="true" />

                <h3 className="text-sm font-black uppercase tracking-[0.16em]">
                  Daily Cashout Limit
                </h3>
            </div>

               <p className="mt-1 text-sm leading-6 text-slate-500">
                  A user may complete up to {cashoutLimit} successful cashout(s) per day.
                </p>

            <div className="mt-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-black text-white">
                    {completedCashouts}

                    <span className="text-lg text-slate-500">
                      /{cashoutLimit}
                    </span>
                  </p>

                  <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Successful cashouts
                  </p>
                </div>

                <p
                  className={cn(
                    'text-right text-sm font-black',
                    hasReachedCashoutLimit
                      ? 'text-amber-300'
                      : 'text-cyan-300'
                  )}
                >
                  {hasReachedCashoutLimit
                    ? 'No cashouts remaining'
                    : `${remainingCashouts} remaining`}
                </p>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-500',
                    hasReachedCashoutLimit
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                      : 'bg-gradient-to-r from-cyan-400 to-blue-500'
                  )}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, progressPercent)
                    )}%`,
                  }}
                />
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-400">
                Each successful cashout remains in the rolling count for
                exactly 24 hours. Eligibility automatically returns as older
                cashouts fall outside that window.
              </p>
            </div>
          </div>

          <EligibilityCard
            loading={loading}
            isVerified={isVerified}
            hasReachedCashoutLimit={hasReachedCashoutLimit}
            nextCashoutWait={nextCashoutWait}
          />
        </div>
      </div>
    </section>
  );
}

function CashoutStatus({
  loading,
  isVerified,
  hasReachedCashoutLimit,
  mayCashOut,
  remainingCashouts,
  cashoutLimit,
  nextCashoutWait,
}: {
  loading: boolean;
  isVerified: boolean;
  hasReachedCashoutLimit: boolean;
  mayCashOut: boolean;
  remainingCashouts: number;
  cashoutLimit: number;
  nextCashoutWait: string;
}) {
  return (
    <div
      className={cn(
        'w-full rounded-2xl border p-4 sm:w-auto sm:min-w-[245px]',
        loading
          ? 'border-slate-700/60 bg-slate-900/60'
          : mayCashOut
            ? 'border-emerald-400/25 bg-emerald-400/5'
            : 'border-amber-400/25 bg-amber-400/5'
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        Cashout status
      </p>

      <div className="mt-2 flex items-center gap-2">
        {loading ? (
          <Clock3
            className="h-5 w-5 text-slate-400"
            aria-hidden="true"
          />
        ) : mayCashOut ? (
          <BadgeCheck
            className="h-5 w-5 text-emerald-400"
            aria-hidden="true"
          />
        ) : (
          <XCircle
            className="h-5 w-5 text-amber-400"
            aria-hidden="true"
          />
        )}

        <p
          className={cn(
            'text-base font-black',
            loading
              ? 'text-slate-300'
              : mayCashOut
                ? 'text-emerald-300'
                : 'text-amber-300'
          )}
        >
          {loading
            ? 'Checking Access'
            : !isVerified
              ? 'Verification Required'
                 : hasReachedCashoutLimit
                   ? 'Daily Limit Reached'
                   : 'Eligible to Cash Out'}
        </p>
      </div>

      <p className="mt-1 text-xs leading-5 text-slate-400">
        {loading
          ? 'Loading your current cashout status.'
          : !isVerified
            ? 'Complete account verification before requesting a cashout.'
            : hasReachedCashoutLimit
              ? nextCashoutWait
               : `${remainingCashouts} of ${cashoutLimit} cashout(s) remain today.`}
      </p>
    </div>
  );
}

function EligibilityCard({
  loading,
  isVerified,
  hasReachedCashoutLimit,
  nextCashoutWait,
}: {
  loading: boolean;
  isVerified: boolean;
  hasReachedCashoutLimit: boolean;
  nextCashoutWait: string;
}) {
  const available =
    !loading &&
    isVerified &&
    !hasReachedCashoutLimit;

  return (
    <div
      className={cn(
        'rounded-2xl border p-5',
        loading
          ? 'border-slate-700/60 bg-slate-900/45'
          : !isVerified
            ? 'border-amber-400/25 bg-amber-400/5'
            : hasReachedCashoutLimit
              ? 'border-red-400/25 bg-red-400/5'
              : 'border-emerald-400/25 bg-emerald-400/5'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            loading
              ? 'bg-slate-700/40 text-slate-400'
              : !isVerified
                ? 'bg-amber-400/10 text-amber-300'
                : hasReachedCashoutLimit
                  ? 'bg-red-400/10 text-red-300'
                  : 'bg-emerald-400/10 text-emerald-300'
          )}
        >
          {loading ? (
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          ) : available ? (
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          ) : (
            <XCircle className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        <div>
          <h3
            className={cn(
              'text-base font-black',
              loading
                ? 'text-slate-300'
                : !isVerified
                  ? 'text-amber-300'
                  : hasReachedCashoutLimit
                    ? 'text-red-300'
                    : 'text-emerald-300'
            )}
          >
            {loading
              ? 'Checking Cashout Access'
              : !isVerified
                ? 'Verify Your Account'
                  : hasReachedCashoutLimit
                    ? "You've reached today's cashout limit."
                    : 'Cashout Access Available'}
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-400">
            {loading
              ? 'Your current cashout eligibility is being loaded.'
              : !isVerified
                ? 'Every verified user may cash out immediately after earning enough coins for a supported cashout tier.'
                : hasReachedCashoutLimit
                  ? 'You may cash out again after 24 hours have passed since your last cashout.'
                  : 'Select a cashout tier below to continue.'}
          </p>

          {hasReachedCashoutLimit && (
            <div className="mt-4 rounded-xl border border-red-400/15 bg-black/15 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-300/70">
                Next available cashout
              </p>

              <p className="mt-1 text-sm font-black text-red-200">
                {nextCashoutWait}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  description,
  accentClassName,
  iconClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
  accentClassName: string;
  iconClassName: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/45 p-4">
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl',
          iconClassName
        )}
      >
        {icon}
      </div>

      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>

      <p className={cn('mt-1 text-xl font-black', accentClassName)}>
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </article>
  );
}

function formatRemainingTime(
  availableAt: string | Date | null
): string {
  if (!availableAt) {
    return 'Available after 24 hours have passed since your last cashout.';
  }

  const targetTime =
    availableAt instanceof Date
      ? availableAt.getTime()
      : new Date(availableAt).getTime();

  if (Number.isNaN(targetTime)) {
    return 'Available after 24 hours have passed since your last cashout.';
  }

  const remainingMilliseconds = targetTime - Date.now();

  if (remainingMilliseconds <= 0) {
    return 'You may cash out again now.';
  }

  const totalMinutes = Math.ceil(
    remainingMilliseconds / (1000 * 60)
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `You may cash out again in ${minutes} minute${
      minutes === 1 ? '' : 's'
    }.`;
  }

  if (minutes === 0) {
    return `You may cash out again in ${hours} hour${
      hours === 1 ? '' : 's'
    }.`;
  }

  return `You may cash out again in ${hours} hour${
    hours === 1 ? '' : 's'
  } and ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}  