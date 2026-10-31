import { useEffect, useRef, useState } from 'react';
import { useGameInput } from '@/components/games/MaiTrollRun/hooks/useGameInput';
import { createGameState, isRunOver, snapshotGame, stepGame, summarizeRun } from '@/components/games/MaiTrollRun/game/engine';
import { drawScene } from '@/components/games/MaiTrollRun/game/render/scene';
import { WORLD_WIDTH, WORLD_HEIGHT } from '@/components/games/MaiTrollRun/game/config';
import type { ActiveRun } from '@/components/games/MaiTrollRun/lib/trollApi';
import type { HudSnapshot, RunSummary } from '@/components/games/MaiTrollRun/game/types';
import { Hud } from '@/components/games/MaiTrollRun/components/Hud';
import { supabase } from '@/lib/supabase';
import type { GameState } from '../game/types';
import { playCoin, playDie, playLevelComplete } from '@/components/games/MaiTrollRun/lib/gameSound';

interface GameViewProps {
  run: ActiveRun;
  onFinished: (summary: RunSummary) => void;
  lobbyId?: string;
  opponentName?: string;
}

const MAX_FRAME_SECONDS = 1 / 30;
const HUD_INTERVAL_MS = 80;

export function GameView({ run, onFinished, lobbyId, opponentName }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rivalCanvasRef=useRef<HTMLCanvasElement>(null);
  const [rivalHud,setRivalHud]=useState<HudSnapshot|null>(null);
  const channelRef=useRef<ReturnType<typeof supabase.channel>|null>(null);
  const opponentFrame=useRef<GameState|null>(null);
  useEffect(()=>{
   if(!lobbyId)return;
   const channel=supabase.channel(`mai-run-race:${lobbyId}`,{config:{broadcast:{self:false}}});
   channel.on('broadcast',{event:'frame'},({payload})=>{
    if(payload?.player===run.runId)return;
    if(payload?.state){opponentFrame.current=payload.state as GameState;setRivalHud(payload.hud as HudSnapshot);}
   }).subscribe();channelRef.current=channel;
   const timer=window.setInterval(()=>{
     const ctx=rivalCanvasRef.current?.getContext('2d');if(ctx&&opponentFrame.current)drawScene(ctx,opponentFrame.current);
   },100);
   return()=>{window.clearInterval(timer);channelRef.current=null;void supabase.removeChannel(channel)};
  },[lobbyId,run.runId]);
  const input = useGameInput();
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  const prevHud = useRef<HudSnapshot | null>(null);
  onFinishedRef.current = onFinished;
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const state = createGameState(run.difficulty, run.gender, run.seed);
    let frame = 0;
    let last = performance.now();
    let lastHud = 0;
    let lastBroadcast=0;

    const tick = (now: number) => {
      const dt = Math.min(MAX_FRAME_SECONDS, (now - last) / 1000);
      last = now;

      stepGame(state, dt, inputRef.current.read());
      drawScene(ctx, state);
      if(lobbyId && now-lastBroadcast>180){
        lastBroadcast=now;
        void channelRef.current?.send({type:'broadcast',event:'frame',payload:{player:run.runId,state:{...state,particles:[]},hud:snapshotGame(state)}});
      }

      if (now - lastHud > HUD_INTERVAL_MS || isRunOver(state.status)) {
        lastHud = now;
        const next = snapshotGame(state);
        const prev = prevHud.current;
        if (prev) {
          if (next.coins > prev.coins) playCoin();
          if (next.levelNumber > prev.levelNumber) playLevelComplete();
          if (next.status === 'dead' && prev.status !== 'dead') playDie();
        }
        prevHud.current = next;
        setHud(next);
      }

      if (isRunOver(state.status)) {
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinishedRef.current(summarizeRun(state));
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run]);

  const holdControl = (
    setter: (held: boolean) => void,
  ) => ({
    onPointerDown: () => setter(true),
    onPointerUp: () => setter(false),
    onPointerLeave: () => setter(false),
    onPointerCancel: () => setter(false),
  });

  const touchStartY = useRef(0);
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;

  const onCanvasTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? 0;
    inputRef.current.setDown(false);
  };

  const onCanvasTouchMove = (e: React.TouchEvent) => {
    const y = e.touches[0]?.clientY ?? 0;
    const delta = y - touchStartY.current;
    e.preventDefault();
    inputRef.current.setDown(delta > 30);
  };

  const onCanvasTouchEnd = () => {
    inputRef.current.setDown(false);
  };

  return (
    <div className={`relative mx-auto w-full max-w-5xl select-none ${isMobileView ? 'fixed inset-0 z-50 bg-black max-w-none h-screen' : ''}`}>
      <div className={lobbyId ? 'grid gap-3 lg:grid-cols-2' : ''}>
        <div
          className="relative overflow-hidden rounded-2xl border border-stone-800 bg-black shadow-2xl"
          onTouchStart={onCanvasTouchStart}
          onTouchMove={onCanvasTouchMove}
          onTouchEnd={onCanvasTouchEnd}
          style={{ touchAction: 'none' }}
        >
          {lobbyId && <div className="absolute left-2 top-2 z-20 rounded bg-black/80 px-3 py-1 text-sm font-bold text-white">YOU · {run.playerName}</div>}
          <canvas
            ref={canvasRef}
            width={WORLD_WIDTH}
            height={WORLD_HEIGHT}
            className={`block h-auto w-full ${isMobileView ? 'h-[85vh] w-[90vw] max-h-[85vh] max-w-[90vw] mx-auto object-contain' : ''}`}
          />
          {hud && <Hud hud={hud} difficulty={run.difficulty} />}
        </div>
        {lobbyId && <div className="relative overflow-hidden rounded-2xl border border-cyan-700 bg-black shadow-2xl">
          <div className="absolute left-2 top-2 z-20 rounded bg-black/80 px-3 py-1 text-sm font-bold text-cyan-200">OPPONENT · {opponentName || 'Rival'}</div>
          <canvas ref={rivalCanvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} className="block h-auto w-full" />
          {rivalHud && <Hud hud={rivalHud} difficulty={run.difficulty} />}
          {!rivalHud && <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-white">Waiting for opponent game feed…</div>}
        </div>}
      </div>
      {!isMobileView && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:hidden">
          <button
            type="button"
            className="touch-none rounded-xl bg-stone-800 py-4 text-sm font-semibold text-stone-100 active:bg-stone-700"
            {...holdControl((v) => inputRef.current.setDown(v))}
          >
            Crouch
          </button>
          <button
            type="button"
            className="touch-none rounded-xl bg-amber-500 py-4 text-sm font-bold text-stone-950 active:bg-amber-400"
            onPointerDown={() => input.queueJump()}
          >
            Jump
          </button>
          <button
            type="button"
            className="touch-none rounded-xl bg-stone-800 py-4 text-sm font-semibold text-stone-100 active:bg-stone-700"
            {...holdControl((v) => inputRef.current.setUp(v))}
          >
            Climb up
          </button>
        </div>
      )}
      <p className={`mt-3 text-center text-xs text-stone-400 ${isMobileView ? 'block' : 'hidden sm:block'}`}>
        {isMobileView ? 'Tap to jump (tap twice in air for a high jump) · swipe down to crouch · runner never stops' : 'Space or W to jump (tap twice for a high jump), hold W or Up to climb, hold S or Down to crouch or descend ladders.'}
      </p>
    </div>
  );
}
