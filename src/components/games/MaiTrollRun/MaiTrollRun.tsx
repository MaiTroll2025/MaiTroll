import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Gamepad2, Gift, MapPin, Play, Tv, Users, X } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { DIFFICULTIES } from './game/config';
import { SetupScreen } from './components/SetupScreen';
import { GameStore } from './components/GameStore';
import { GameView } from './components/GameView';
import { ResultScreen } from './components/ResultScreen';
import { RaceOutcome } from './components/RaceOutcome';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { MaiTrollRunWelcomePopup } from './components/MaiTrollRunWelcomePopup';
import { PUBLIC_WELCOME_COINS } from './lib/publicSession';
import type { Difficulty, GunKey, RunCheckpoint, RunSummary } from './game/types';
import { toast } from 'sonner';

type PublicRun = {
  runId: string;
  playerName: string;
  gender: 'male' | 'female';
  difficulty: Difficulty;
  seed: number;
  lobbyId?: string;
  gunKey: GunKey | null;
  walletBalance: number;
};

type View =
  | { kind: 'menu' }
  | { kind: 'store' }
  | { kind: 'solo'; run: PublicRun }
  | { kind: 'race'; run: PublicRun; lobby: any }
  | { kind: 'result'; run: PublicRun; summary: RunSummary }
  | { kind: 'leaderboard' }
  | { kind: 'lobbies'; difficulty: Difficulty }
  | { kind: 'waiting'; lobbyId: string };

interface MaiTrollRunProps {
  publicWelcomePopup?: boolean;
  onPublicPopupDismiss?: () => void;
}

export default function MaiTrollRun({
  publicWelcomePopup = false,
  onPublicPopupDismiss,
}: MaiTrollRunProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const userId = user?.id;
  const [view, setView] = useState<View>({ kind: 'menu' });
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [activeLobby, setActiveLobby] = useState<any | null>(null);
  const [inventory, setInventory] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const waitingLobbyId = view.kind === 'waiting' ? view.lobbyId : null;

  /* The unsigned guest balance stays in memory and is never saved to the server. */
  const [publicCoins, setPublicCoins] = useState(PUBLIC_WELCOME_COINS);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showOutOfCoins, setShowOutOfCoins] = useState(false);

  const reloadInventory = useCallback(async () => {
    const { getRunInventory } = await import('./lib/trollApi');
    setInventory(await getRunInventory());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { listLobbies } = await import('./lib/trollApi');
      setLobbies(await listLobbies());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void (async () => {
      const { getRunInventory } = await import('./lib/trollApi');
      try {
        const value = await getRunInventory();
        if (active) setInventory(value);
      } catch (cause: unknown) {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (view.kind !== 'lobbies') return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [view.kind, refresh]);

  useEffect(() => {
    if (!waitingLobbyId) return;
    let alive = true;
    const sync = async () => {
      try {
        const { getLobby } = await import('./lib/trollApi');
        const lobby = await getLobby(waitingLobbyId);
        if (!alive) return;
        setActiveLobby(lobby);
        if (lobby.status === 'playing' && userId) {
          const { data, error: resultError } = await supabase
            .from('mai_run_results')
            .select('id,gender')
            .eq('lobby_id', lobby.id)
            .eq('player_id', userId)
            .single();
          if (resultError) throw resultError;
          const { getRunInventory } = await import('./lib/trollApi');
          const currentInventory = await getRunInventory();
          if (!alive) return;
          setInventory(currentInventory);
          setView({
            kind: 'race',
            run: {
              runId: data.id,
              playerName: profile?.display_name || profile?.username || 'Troll',
              gender: data.gender,
              difficulty: lobby.difficulty,
              seed: lobby.seed,
              lobbyId: lobby.id,
              gunKey: currentInventory.equippedGun,
              walletBalance: currentInventory.trollCoins,
            },
            lobby,
          });
        }
        if (lobby.status === 'cancelled') setView({ kind: 'menu' });
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : String(cause));
      }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [waitingLobbyId, userId, profile?.display_name, profile?.username]);

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  /* Public balances exist only in component memory and are never persisted. */
  useEffect(() => {
    if (user) return;
    setPublicCoins(PUBLIC_WELCOME_COINS);
    setShowWelcome(publicWelcomePopup);
  }, [publicWelcomePopup, user]);

  const isPublic = !user;

  const handlePublicPlay = useCallback((difficulty: Difficulty, gender: 'male' | 'female', name: string) => {
    const fee = DIFFICULTIES[difficulty].entryFee;
    if (publicCoins < fee) {
      setShowOutOfCoins(true);
      return;
    }
    const nextCoins = publicCoins - fee;
    setPublicCoins(nextCoins);
    setShowOutOfCoins(false);
    const runId = `public-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setView({
      kind: 'solo',
      run: {
        runId,
        playerName: name,
        gender,
        difficulty,
        seed: Math.floor(Math.random() * 2_147_483_647),
        gunKey: null,
        walletBalance: nextCoins,
      },
    });
  }, [publicCoins]);

  const handlePublicFinish = useCallback((summary: RunSummary) => {
    const run: PublicRun = {
      runId: 'public',
      playerName: '',
      gender: 'female',
      difficulty: 'normal',
      seed: 0,
      gunKey: null,
      walletBalance: publicCoins,
    };
    setView({ kind: 'result', run, summary });
  }, [publicCoins]);

  useEffect(() => {
    if (isPublic && publicCoins <= 0 && view.kind !== 'solo') {
      setShowOutOfCoins(true);
    }
  }, [isPublic, publicCoins, view.kind]);

  const tellFriends = useCallback(async () => {
    const shareData = {
      title: 'MaiTroll Run',
      text: 'Play MaiTroll Run and join me in MaiTroll City!',
      url: window.location.origin,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        toast.success('MaiTroll link copied. Send it to your friends!');
      } else {
        toast.error('Sharing is not available in this browser.');
        return;
      }
      setShowOutOfCoins(false);
      onPublicPopupDismiss?.();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      toast.error('Could not share the MaiTroll link.');
    }
  }, [onPublicPopupDismiss]);

  if (isPublic && publicWelcomePopup) {
    const goToCity = () => {
      setShowWelcome(false);
      setShowOutOfCoins(false);
      onPublicPopupDismiss?.();
    };
    const startBroadcasting = () => {
      setShowOutOfCoins(false);
      onPublicPopupDismiss?.();
      navigate('/broadcast/setup');
    };
    const replayPublicRun = () => {
      if (publicCoins < DIFFICULTIES.easy.entryFee) {
        setShowOutOfCoins(true);
        return;
      }
      handlePublicPlay('easy', 'female', 'Guest Troll');
    };

    return (
      <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6">
        <section
          className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#050714] shadow-[0_20px_80px_rgba(0,0,0,.65),0_0_50px_rgba(0,191,255,.16)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="public-maitroll-run-title"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#080c1a] px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-orange-300/30 bg-orange-400/10">
                <Gamepad2 className="size-5 text-orange-300" />
              </span>
              <div className="min-w-0">
                <h2 id="public-maitroll-run-title" className="truncate text-sm font-black text-white sm:text-base">MaiTroll Run</h2>
                <p className="truncate text-[10px] text-slate-400">
                  {view.kind === 'solo' ? 'Playing as a guest · no sign-in' : 'Welcome gift · no sign-in needed'}
                </p>
              </div>
              <span className="ml-1 hidden shrink-0 items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1.5 text-[10px] font-bold text-amber-100 sm:inline-flex">
                <Gift className="size-3 text-amber-300" />
                {publicCoins} coins
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-2.5 py-1.5 text-[10px] font-bold text-amber-100 sm:hidden">
                <Gift className="size-3 text-amber-300" />{publicCoins}
              </span>
              <button type="button" onClick={goToCity} className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10" aria-label="Close MaiTroll Run and go to the city">
                <X className="size-5" />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {(showOutOfCoins || (publicCoins <= 0 && view.kind !== 'solo')) ? (
              <div className="p-3 sm:p-5">
                <div className="mx-auto max-w-xl rounded-2xl border border-cyan-300/20 bg-[radial-gradient(ellipse_at_80%_0%,rgba(34,211,238,.12),transparent_55%),#080c1a] p-5 text-center sm:p-8">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10">
                    <Tv className="size-7 text-cyan-300" />
                  </span>
                  <h3 className="mt-4 text-xl font-black text-white">Out of welcome coins</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-300">
                    Want to keep playing? Join MaiTroll and start broadcasting to receive coins. Bring your friends along, too.
                  </p>
                  <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                    <button type="button" onClick={startBroadcasting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300">
                      <Tv className="size-4" /> Start broadcasting
                    </button>
                    <button type="button" onClick={() => void tellFriends()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                      <Users className="size-4" /> Tell your friends
                    </button>
                  </div>
                  <button type="button" onClick={goToCity} className="mt-4 inline-flex min-h-10 items-center gap-2 px-3 text-xs font-semibold text-slate-400 transition hover:text-white">
                    <MapPin className="size-3.5" /> Explore the city
                  </button>
                </div>
              </div>
            ) : (
              <>
            {view.kind === 'solo' && (
              <div className="p-2 sm:p-4">
                <GameView
                  run={view.run as any}
                  onFinished={handlePublicFinish}
                  isPublic
                  publicBalance={publicCoins}
                  onPublicBalanceChange={setPublicCoins}
                  embedded
                />
              </div>
            )}

            {view.kind === 'result' && (
              <div className="p-3 sm:p-5">
                <ResultScreen
                  run={view.run as any}
                  summary={view.summary}
                  playerId=""
                  onPlayAgain={replayPublicRun}
                  onOpenLeaderboard={() => setView({ kind: 'leaderboard' })}
                  checkpoints={0}
                  allowCheckpoints={false}
                  onUseCheckpoint={async () => {}}
                  isPublic
                />
              </div>
            )}

            {view.kind === 'leaderboard' && (
              <div className="p-3 sm:p-5">
                <LeaderboardScreen onBack={() => setView({ kind: 'menu' })} />
              </div>
            )}

            {(view.kind === 'menu' || view.kind === 'store' || view.kind === 'lobbies' || view.kind === 'waiting') && (
              <div className="p-3 sm:p-5">
                <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-orange-300/20 bg-[#080c1a]">
                    <div className="relative flex aspect-video min-h-[190px] max-h-[48dvh] flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_100%,rgba(249,115,22,.24),transparent_40%),linear-gradient(135deg,#10102a,#080c1a_55%,#211128)] px-4 text-center">
                      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:36px_36px]" />
                      <span className="relative grid size-14 place-items-center rounded-2xl border border-orange-200/30 bg-orange-400/10 shadow-[0_0_36px_rgba(251,146,60,.18)] sm:size-16">
                        <Gamepad2 className="size-7 text-orange-200 sm:size-8" />
                      </span>
                      <p className="relative mt-3 text-[10px] font-black uppercase tracking-[.25em] text-orange-200/80">A MaiTroll arcade original</p>
                      <h3 className="relative mt-1 text-2xl font-black text-white sm:text-4xl">MaiTroll Run</h3>
                      <p className="relative mt-1 max-w-md text-xs text-slate-300 sm:text-sm">Run, jump, and collect the MAITROLL letters across eight realms.</p>
                      <button type="button" onClick={() => handlePublicPlay('easy', 'female', 'Guest Troll')} className="relative mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-300 px-6 py-3 text-sm font-black text-slate-950 shadow-[0_8px_24px_rgba(251,146,60,.2)] transition hover:bg-orange-200">
                        <Play className="size-4 fill-current" /> Play free · {publicCoins} coins
                      </button>
                      <span className="relative mt-2 text-[10px] text-slate-400">Guest play · no account required</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] px-4 py-3">
                      <span className="text-[10px] text-slate-400">Your welcome coins stay in this temporary game session.</span>
                      <button type="button" onClick={goToCity} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10">
                        Go to the city <ArrowRight className="size-3.5" />
                      </button>
                    </div>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (isPublic) {
    return (
      <main className="min-h-screen bg-stone-950 bg-[radial-gradient(ellipse_at_top,_rgba(120,53,15,0.25),_transparent_60%)] px-3 py-7 text-stone-100 sm:px-8">
        {error && <p role="alert" className="mx-auto mb-4 max-w-4xl rounded-lg bg-red-900 p-3 text-red-100">{error}</p>}

        <MaiTrollRunWelcomePopup
          visible={showWelcome}
          mode="welcome"
          onClose={() => setShowWelcome(false)}
          onPlay={() => {
            setShowWelcome(false);
            handlePublicPlay('easy', 'female', 'Guest Troll');
          }}
          onGoToCity={() => {
            setShowWelcome(false);
            navigate('/');
          }}
          onOutOfCoins={() => {
            setShowOutOfCoins(false);
          }}
          coins={publicCoins ?? PUBLIC_WELCOME_COINS}
        />

        {showOutOfCoins && (
          <MaiTrollRunWelcomePopup
            visible
              mode="outofcoins"
              onClose={() => setShowOutOfCoins(false)}
              onPlay={() => {}}
              onGoToCity={() => {
                setShowOutOfCoins(false);
                navigate('/broadcast/setup');
              }}
              onOutOfCoins={tellFriends}
              coins={0}
            />
        )}

        {!showWelcome && !showOutOfCoins && (
          <>
            <div className="mx-auto w-full max-w-4xl">
              <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Broadcast arcade · Guest</p>
                  <h1 className="mt-2 font-serif text-4xl font-bold text-stone-50 sm:text-5xl">Maitroll Run</h1>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
                    Sprint across eight cursed realms, leap chasms, climb ladders and collect the letters of MAITROLL.
                  </p>
                </div>
                <div className="flex gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setView({ kind: 'leaderboard' })}
                    className="rounded-full border border-stone-700 px-4 py-2 text-sm font-medium text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
                  >
                    Leaderboard
                  </button>
                </div>
              </header>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                <section className="rounded-2xl border border-stone-800 bg-stone-900/70 p-6">
                  <label htmlFor="troll-name" className="text-sm font-semibold text-stone-200">
                    Troll name
                  </label>
                  <input
                    id="troll-name"
                    defaultValue="Guest Troll"
                    readOnly
                    placeholder="Your MaiTroll display name"
                    className="mt-2 w-full rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-stone-100 placeholder:text-stone-500"
                  />

                  <p className="mt-6 text-sm font-semibold text-stone-200">Troll</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {['female', 'male'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`rounded-xl border px-4 py-4 text-left transition ${option === 'female' ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-stone-700 bg-stone-950 text-stone-300 hover:border-stone-500'}`}
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
                    {(['easy', 'normal', 'brutal', 'nightmare'] as Difficulty[]).map((level) => {
                      const config = DIFFICULTIES[level];
                      const canAfford = (publicCoins ?? 0) >= config.entryFee;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handlePublicPlay(level, 'female', 'Guest Troll')}
                          disabled={!canAfford}
                          className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition border-stone-700 bg-stone-950 ${!canAfford ? 'opacity-50' : 'hover:border-stone-500'}`}
                        >
                          <span>
                            <span className="block text-sm font-semibold text-stone-100">{config.label}</span>
                            <span className="block text-xs text-stone-400">{config.entryFee} coins</span>
                          </span>
                          <span className="shrink-0 rounded-full bg-stone-800 px-3 py-1 font-mono text-xs text-amber-300">
                            {config.entryFee} coins
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-4 rounded-lg bg-stone-950 p-3 text-sm leading-relaxed text-stone-300">
                    Your coins: <span className="font-mono text-amber-300">{publicCoins ?? PUBLIC_WELCOME_COINS}</span> troll_coins{' '}
                    <span className="text-xs text-stone-500">(session only, not saved to an account)</span>
                  </p>
                  {publicCoins !== null && publicCoins < DIFFICULTIES.easy.entryFee && (
                    <p className="mt-2 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
                      Not enough coins to start a run. Keep playing or sign up to broadcast and earn more.
                    </p>
                  )}
                </section>

                <aside className="flex flex-col rounded-2xl border border-stone-800 bg-stone-900/70 p-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Your balance</p>
                  <p className="mt-2 font-mono text-4xl font-bold text-amber-300">{publicCoins ?? PUBLIC_WELCOME_COINS}</p>
                  <p className="text-sm text-stone-400">troll_coins</p>
                  <p className="mt-2 text-sm text-cyan-300">20 checkpoints available</p>

                  <div className="mt-6 rounded-xl bg-stone-950 p-4 text-sm leading-relaxed text-stone-300">
                    <p>
                      Entry fee: <span className="font-mono text-amber-300">10&ndash;50</span> troll_coins
                    </p>
                    <p className="mt-2 text-xs text-stone-500">
                      Clear a level for 100 Troll Coins. Each weapon shot costs 1 Troll Coin.
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          </>
        )}
      </main>
    );
  }

  if (!user) return <main className="p-8 text-white">Sign in to MaiTroll to play MaiTroll Run.</main>;

  return (
    <main className="min-h-screen bg-stone-950 bg-[radial-gradient(ellipse_at_top,_rgba(120,53,15,0.25),_transparent_60%)] px-3 py-7 text-stone-100 sm:px-8">
      {error && <p role="alert" className="mx-auto mb-4 max-w-4xl rounded-lg bg-red-900 p-3 text-red-100">{error}</p>}

      {view.kind === 'menu' && (
        <>
          <SetupScreen
            playerId={user.id}
            onStart={(run) => setView({ kind: 'solo', run })}
            onOpenLeaderboard={() => setView({ kind: 'leaderboard' })}
            onOpenStore={() => setView({ kind: 'store' })}
          />
          <div className="mx-auto mt-5 max-w-4xl">
            <button
              onClick={() => setView({ kind: 'lobbies', difficulty: 'normal' })}
              className="w-full rounded-xl border border-cyan-400 bg-cyan-900/40 p-4 font-bold text-cyan-100"
            >
              ⚔ Multiplayer · Create or join a 1v1 level race
            </button>
          </div>
        </>
      )}

      {view.kind === 'store' && (
        <GameStore onBack={() => void runAction(async () => {
          await reloadInventory();
          setView({ kind: 'menu' });
        })} />
      )}

      {view.kind === 'leaderboard' && <LeaderboardScreen onBack={() => setView({ kind: 'menu' })} />}

      {view.kind === 'lobbies' && (
        <div className="mx-auto max-w-3xl space-y-5">
          <button onClick={() => setView({ kind: 'menu' })}>← Back</button>
          <h1 className="text-3xl font-bold">Multiplayer race lobbies</h1>
          <p className="text-stone-400">Two players compete through the same eight levels with a shared seed. Both players pay the selected difficulty entry fee when the host starts. Each cleared level still earns its 100 Troll Coins; there is no separate winner prize.</p>
          <select value={view.difficulty} onChange={(event) => setView({ kind: 'lobbies', difficulty: event.target.value as Difficulty })} className="rounded bg-stone-800 p-3">
            {(['easy', 'normal', 'brutal', 'nightmare'] as Difficulty[]).map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
          </select>
          <button disabled={busy} onClick={() => void runAction(async () => { const { createLobby } = await import('./lib/trollApi'); const id = await createLobby(view.difficulty); setView({ kind: 'waiting', lobbyId: id }); })} className="ml-3 rounded bg-cyan-500 px-5 py-3 font-semibold text-black">Create lobby</button>
          <button onClick={() => void refresh()} className="ml-3 rounded bg-stone-700 p-3">Refresh</button>
          {lobbies.map((lobby) => (
            <div key={lobby.id} className="flex items-center justify-between rounded-xl border border-stone-700 p-4">
              <span>Lobby {lobby.id.slice(0, 8)} · {lobby.difficulty}</span>
              <button disabled={busy || lobby.host_id === user.id} onClick={() => void runAction(async () => { const { joinLobby } = await import('./lib/trollApi'); await joinLobby(lobby.id); setView({ kind: 'waiting', lobbyId: lobby.id }); })} className="rounded bg-amber-400 px-4 py-2 text-black disabled:opacity-50">Join lobby</button>
            </div>
          ))}
          {lobbies.length === 0 && <p className="text-stone-400">No waiting lobbies. Create the first.</p>}
        </div>
      )}

      {view.kind === 'waiting' && (
        <div className="mx-auto max-w-2xl space-y-5 rounded-2xl bg-stone-900 p-8 text-center">
          <h1 className="text-3xl font-bold">Race lobby</h1>
          <p className="text-cyan-300">Room {view.lobbyId.slice(0, 8)}</p>
          <p>Host: {activeLobby?.host_id === user.id ? 'You' : 'Another troll'} · Opponent: {activeLobby?.guest_id ? 'Joined' : 'Waiting…'}</p>
          {activeLobby?.host_id === user.id && activeLobby?.guest_id && <button disabled={busy} className="rounded bg-amber-400 px-6 py-3 font-bold text-black" onClick={() => void runAction(async () => { const { beginMatch } = await import('./lib/trollApi'); await beginMatch(view.lobbyId); })}>Start 1v1 race</button>}
          <button onClick={() => void runAction(async () => { const { cancelLobby } = await import('./lib/trollApi'); await cancelLobby(view.lobbyId); setView({ kind: 'menu' }); })} className="block w-full rounded border border-stone-600 p-3">Leave lobby</button>
        </div>
      )}

      {view.kind === 'solo' && (
        <GameView
          run={view.run as any}
          onFinished={(summary) => {
            if (isPublic) {
              handlePublicFinish(summary);
            } else {
              setView({ kind: 'result', run: view.run as any, summary });
            }
          }}
          isPublic={isPublic}
          publicBalance={(view.run as any).walletBalance}
          onPublicBalanceChange={(balance) => {
            if (isPublic) setPublicCoins(balance);
          }}
        />
      )}

      {view.kind === 'race' && (
        <>
          <div className="mx-auto mb-4 max-w-5xl rounded bg-cyan-950 p-3 text-center text-cyan-200">1v1 RACE · First to clear the most levels wins. Both screens show live player gameplay.</div>
          <GameView run={view.run} lobbyId={view.lobby.id} opponentName="Rival" onFinished={(summary) => setView({ kind: 'result', run: view.run, summary })} />
        </>
      )}

      {view.kind === 'result' && (
        <>
          <ResultScreen
            run={view.run as any}
            summary={view.summary}
            playerId={user.id}
            checkpoints={inventory?.checkpoints ?? 0}
            allowCheckpoints={!view.run.lobbyId && !isPublic}
            onUseCheckpoint={async (checkpoint: RunCheckpoint) => {
              const { spendCheckpoint } = await import('./lib/trollApi');
              const remaining = await spendCheckpoint(view.run.runId);
              setInventory((current) => current ? { ...current, checkpoints: remaining } : current);
              setView({ kind: 'solo', run: { ...view.run, checkpoint } as any });
            }}
            onPlayAgain={() => {
              setView({ kind: 'menu' });
            }}
            onOpenLeaderboard={() => setView({ kind: 'leaderboard' })}
            isPublic={isPublic}
          />
          {view.run.lobbyId && !isPublic && <RaceOutcome lobbyId={view.run.lobbyId} playerId={user.id} />}
        </>
      )}
    </main>
  );
}
