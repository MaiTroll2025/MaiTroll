import { useCallback, useEffect, useRef } from 'react';
import type { InputState } from '@/components/games/MaiTrollRun/game/types';
import { playJump } from '@/components/games/MaiTrollRun/lib/gameSound';

export interface GameInput {
  read: () => InputState;
  setUp: (held: boolean) => void;
  setDown: (held: boolean) => void;
  setShoot: (held: boolean) => void;
  queueJump: () => void;
}

export function useGameInput(): GameInput {
  const held = useRef({ up: false, down: false, shoot: false });
  const jumpQueued = useRef(false);

  const read = useCallback((): InputState => {
    const jumpPressed = jumpQueued.current;
    jumpQueued.current = false;
    return { up: held.current.up, down: held.current.down, jumpPressed, shootHeld: held.current.shoot };
  }, []);

  const setUp = useCallback((value: boolean) => {
    held.current.up = value;
  }, []);

  const setDown = useCallback((value: boolean) => {
    held.current.down = value;
  }, []);

  const setShoot = useCallback((value: boolean) => {
    held.current.shoot = value;
  }, []);

  const queueJump = useCallback(() => {
    jumpQueued.current = true;
    playJump();
  }, []);

  useEffect(() => {
    const isJumpKey = (code: string) => code === 'Space' || code === 'KeyW' || code === 'ArrowUp';
    const isDownKey = (code: string) => code === 'KeyS' || code === 'ArrowDown';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (isJumpKey(event.code)) {
        event.preventDefault();
        queueJump();
      }
      if (event.code === 'KeyW' || event.code === 'ArrowUp') held.current.up = true;
      if (isDownKey(event.code)) held.current.down = true;
      if (event.code === 'KeyF') held.current.shoot = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'KeyW' || event.code === 'ArrowUp') held.current.up = false;
      if (isDownKey(event.code)) held.current.down = false;
      if (event.code === 'KeyF') held.current.shoot = false;
    };
    const onBlur = () => {
      held.current = { up: false, down: false, shoot: false };
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [queueJump]);

  return { read, setUp, setDown, setShoot, queueJump };
}
