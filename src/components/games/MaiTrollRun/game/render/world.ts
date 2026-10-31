import { GROUND_Y, WORLD_HEIGHT, WORLD_WIDTH } from '@/components/games/MaiTrollRun/game/config';
import type { LevelTheme, Ladder, Surface } from '@/components/games/MaiTrollRun/game/types';

const BRICK_HEIGHT = 26;
const BRICK_WIDTH = 64;

function isVisible(sx1: number, sx2: number): boolean {
  return sx2 > -20 && sx1 < WORLD_WIDTH + 20;
}

export function drawGround(
  ctx: CanvasRenderingContext2D,
  ground: Surface[],
  cam: number,
  theme: LevelTheme,
) {
  for (let i = 0; i < ground.length - 1; i++) {
    const sx1 = ground[i].x2 - cam;
    const sx2 = ground[i + 1].x1 - cam;
    if (!isVisible(sx1, sx2)) continue;
    const chasm = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_HEIGHT);
    chasm.addColorStop(0, '#050607');
    chasm.addColorStop(0.8, '#000000');
    chasm.addColorStop(1, theme.accent);
    ctx.fillStyle = chasm;
    ctx.fillRect(sx1, GROUND_Y, sx2 - sx1, WORLD_HEIGHT - GROUND_Y);
  }

  for (const segment of ground) {
    const sx1 = segment.x1 - cam;
    const sx2 = segment.x2 - cam;
    if (!isVisible(sx1, sx2)) continue;
    const stone = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_HEIGHT);
    stone.addColorStop(0, theme.stoneLight);
    stone.addColorStop(0.35, theme.stoneDark);
    stone.addColorStop(1, '#0c0c0a');
    ctx.fillStyle = stone;
    ctx.fillRect(sx1, GROUND_Y, sx2 - sx1, WORLD_HEIGHT - GROUND_Y);
    ctx.fillStyle = theme.lip;
    ctx.fillRect(sx1, GROUND_Y, sx2 - sx1, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(sx1, GROUND_Y + 6, sx2 - sx1, 1);
  }

  drawBrickJoints(ctx, ground, cam, theme);
}

function drawBrickJoints(
  ctx: CanvasRenderingContext2D,
  ground: Surface[],
  cam: number,
  theme: LevelTheme,
) {
  ctx.save();
  ctx.beginPath();
  for (const segment of ground) {
    ctx.rect(segment.x1 - cam, GROUND_Y, segment.x2 - segment.x1, WORLD_HEIGHT - GROUND_Y);
  }
  ctx.clip();

  ctx.strokeStyle = theme.mortar;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const firstColumn = Math.floor((cam - BRICK_WIDTH) / BRICK_WIDTH) * BRICK_WIDTH;
  let row = 0;
  for (let y = GROUND_Y + 6; y < WORLD_HEIGHT; y += BRICK_HEIGHT, row++) {
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_WIDTH, y);
    const shift = row % 2 === 0 ? 0 : BRICK_WIDTH / 2;
    for (let wx = firstColumn; wx < cam + WORLD_WIDTH + BRICK_WIDTH; wx += BRICK_WIDTH) {
      const sx = wx + shift - cam;
      ctx.moveTo(sx, y);
      ctx.lineTo(sx, y + BRICK_HEIGHT);
    }
  }
  ctx.stroke();
  ctx.restore();
}

export function drawPlatforms(
  ctx: CanvasRenderingContext2D,
  platforms: Surface[],
  cam: number,
  theme: LevelTheme,
) {
  for (const platform of platforms) {
    const sx1 = platform.x1 - cam;
    const sx2 = platform.x2 - cam;
    if (!isVisible(sx1, sx2)) continue;
    const thickness = 22;
    const top = platform.y;

    for (let px = platform.x1 + 24; px < platform.x2 - 20; px += 120) {
      const sx = px - cam;
      const pillar = ctx.createLinearGradient(sx, 0, sx + 26, 0);
      pillar.addColorStop(0, theme.stoneDark);
      pillar.addColorStop(0.5, theme.stoneLight);
      pillar.addColorStop(1, theme.stoneDark);
      ctx.fillStyle = pillar;
      ctx.fillRect(sx, top + thickness, 26, GROUND_Y - top - thickness);
    }

    const slab = ctx.createLinearGradient(0, top, 0, top + thickness);
    slab.addColorStop(0, theme.stoneLight);
    slab.addColorStop(1, theme.stoneDark);
    ctx.fillStyle = slab;
    ctx.fillRect(sx1, top, sx2 - sx1, thickness);
    ctx.fillStyle = theme.lip;
    ctx.fillRect(sx1, top, sx2 - sx1, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sx1, top + thickness - 4, sx2 - sx1, 4);
  }
}

export function drawLadders(ctx: CanvasRenderingContext2D, ladders: Ladder[], cam: number) {
  for (const ladder of ladders) {
    const sx = ladder.x - cam;
    if (!isVisible(sx - 20, sx + 20)) continue;
    const height = ladder.bottom - ladder.top;

    ctx.fillStyle = '#4a2f18';
    ctx.fillRect(sx - 15, ladder.top, 4, height);
    ctx.fillRect(sx + 11, ladder.top, 4, height);

    ctx.fillStyle = '#8a5f36';
    ctx.fillRect(sx - 14, ladder.top, 1.5, height);
    ctx.fillRect(sx + 12, ladder.top, 1.5, height);

    ctx.fillStyle = '#6e4a28';
    for (let y = ladder.top + 14; y < ladder.bottom - 4; y += 16) {
      ctx.fillRect(sx - 11, y, 22, 3);
    }
  }
}

export function drawGate(
  ctx: CanvasRenderingContext2D,
  gateX: number,
  cam: number,
  time: number,
  theme: LevelTheme,
) {
  const sx = gateX - cam;
  if (!isVisible(sx - 100, sx + 100)) return;
  const archTop = GROUND_Y - 220;

  ctx.save();
  const light = ctx.createRadialGradient(sx, GROUND_Y - 100, 10, sx, GROUND_Y - 100, 120);
  light.addColorStop(0, theme.glow);
  light.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.45 + Math.sin(time * 3) * 0.12;
  ctx.fillStyle = light;
  ctx.fillRect(sx - 120, archTop - 40, 240, 260);
  ctx.restore();

  ctx.fillStyle = theme.stoneDark;
  ctx.fillRect(sx - 87, archTop + 70, 34, GROUND_Y - archTop - 70);
  ctx.fillRect(sx + 53, archTop + 70, 34, GROUND_Y - archTop - 70);

  ctx.strokeStyle = theme.stoneLight;
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.arc(sx, archTop + 70, 70, Math.PI, 0);
  ctx.stroke();

  ctx.strokeStyle = theme.lip;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(sx, archTop + 70, 88, Math.PI, 0);
  ctx.stroke();

  ctx.fillStyle = theme.glow;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MAITROLL', sx, archTop - 14);
}
