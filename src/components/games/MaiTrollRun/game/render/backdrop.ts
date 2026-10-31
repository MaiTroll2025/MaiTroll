import { GROUND_Y, WORLD_HEIGHT, WORLD_WIDTH } from '@/components/games/MaiTrollRun/game/config';
import type { LevelTheme } from '@/components/games/MaiTrollRun/game/types';

function drawRidge(
  ctx: CanvasRenderingContext2D,
  offset: number,
  baseY: number,
  amplitude: number,
  color: string,
  phase: number,
) {
  ctx.beginPath();
  ctx.moveTo(0, WORLD_HEIGHT);
  for (let sx = 0; sx <= WORLD_WIDTH + 12; sx += 12) {
    const wx = sx + offset;
    const wave =
      0.55 * Math.sin(wx * 0.0085 + phase) +
      0.3 * Math.sin(wx * 0.021 + phase * 1.7) +
      0.15 * Math.sin(wx * 0.053 + phase * 0.6);
    ctx.lineTo(sx, baseY - amplitude * (0.5 + wave * 0.5));
  }
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function hash(n: number): number {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

function drawPines(
  ctx: CanvasRenderingContext2D,
  offset: number,
  baseY: number,
  height: number,
  color: string,
  spacing: number,
) {
  ctx.fillStyle = color;
  const first = Math.floor(offset / spacing);
  for (let i = first; i * spacing - offset < WORLD_WIDTH + spacing; i++) {
    const sx = i * spacing - offset + spacing * 0.5;
    const h = height * (0.7 + 0.3 * hash(i));
    const w = h * 0.26;
    ctx.beginPath();
    ctx.moveTo(sx, baseY - h);
    ctx.lineTo(sx + w, baseY);
    ctx.lineTo(sx - w, baseY);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  theme: LevelTheme,
  cam: number,
  time: number,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(0.7, theme.skyBottom);
  sky.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.5;
  const glow = ctx.createRadialGradient(WORLD_WIDTH * 0.72, GROUND_Y * 0.36, 6, WORLD_WIDTH * 0.72, GROUND_Y * 0.36, 190);
  glow.addColorStop(0, theme.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.restore();

  drawRidge(ctx, cam * 0.18, GROUND_Y - 90, 200, theme.farRidge, 1.3);
  drawPines(ctx, cam * 0.3, GROUND_Y - 36, 110, theme.treeFar, 26);
  drawRidge(ctx, cam * 0.42, GROUND_Y - 40, 120, theme.nearRidge, 2.4);
  drawPines(ctx, cam * 0.7, GROUND_Y - 6, 150, theme.treeNear, 72);

  const fog = ctx.createLinearGradient(0, GROUND_Y - 130, 0, GROUND_Y + 10);
  fog.addColorStop(0, 'rgba(0,0,0,0)');
  fog.addColorStop(1, theme.fog);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = fog;
  ctx.fillRect(0, GROUND_Y - 130, WORLD_WIDTH, 140);
  ctx.restore();

  ctx.fillStyle = theme.glow;
  for (let i = 0; i < 26; i++) {
    const x = (((i * 97.3 - cam * 0.25 - time * 14) % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
    const y = 70 + hash(i + 3) * 260 + Math.sin(time * 1.6 + i) * 8;
    ctx.globalAlpha = 0.25 + 0.35 * hash(i + 9);
    ctx.beginPath();
    ctx.arc(x, y, 1.3 + hash(i) * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
