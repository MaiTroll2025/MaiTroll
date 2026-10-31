import { POWER_COLORS, RUNNER_X, WORLD_HEIGHT, WORLD_WIDTH } from '@/components/games/MaiTrollRun/game/config';
import { drawBackdrop } from '@/components/games/MaiTrollRun/game/render/backdrop';
import { drawHazards, drawParticles, drawPickups } from '@/components/games/MaiTrollRun/game/render/entities';
import { drawGate, drawGround, drawLadders, drawPlatforms } from '@/components/games/MaiTrollRun/game/render/world';
import { drawTroll } from '@/components/games/MaiTrollRun/game/render/troll';
import type { GameState } from '@/components/games/MaiTrollRun/game/types';

export function drawScene(ctx: CanvasRenderingContext2D, s: GameState): void {
  const { level, runner } = s;
  const cam = runner.worldX - RUNNER_X;
  const time = s.time;

  drawBackdrop(ctx, level.theme, runner.worldX, time);
  drawGround(ctx, level.ground, cam, level.theme);
  drawPlatforms(ctx, level.platforms, cam, level.theme);
  drawLadders(ctx, level.ladders, cam);
  drawGate(ctx, level.length, cam, time, level.theme);
  drawHazards(ctx, level.hazards, cam, time);
  drawPickups(ctx, level.pickups, cam, time);

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(RUNNER_X, runner.feetY + 2, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (s.power.shield > 0) drawShieldRing(ctx, runner.feetY, time, s.power.shield);

  const playing = s.status === 'playing' || s.status === 'banner';
  if (playing) {
    drawTroll(ctx, runner, s.gender, time, s.status === 'banner');
  }

  drawParticles(ctx, s.particles, cam);
  drawVignette(ctx);
}

function drawShieldRing(ctx: CanvasRenderingContext2D, feetY: number, time: number, remaining: number) {
  const pulse = 1 + Math.sin(time * 8) * 0.04;
  const alpha = remaining < 2 ? 0.35 + 0.35 * Math.abs(Math.sin(time * 14)) : 0.55;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = POWER_COLORS.shield;
  ctx.shadowColor = POWER_COLORS.shield;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(RUNNER_X, feetY - 42, 34 * pulse, 50 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createRadialGradient(
    WORLD_WIDTH / 2,
    WORLD_HEIGHT / 2,
    WORLD_HEIGHT * 0.35,
    WORLD_WIDTH / 2,
    WORLD_HEIGHT / 2,
    WORLD_WIDTH * 0.7,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}
