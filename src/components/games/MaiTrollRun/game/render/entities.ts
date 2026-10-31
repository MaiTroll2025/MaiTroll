import { POWER_COLORS, WORLD_WIDTH } from '@/components/games/MaiTrollRun/game/config';
import { hazardBox } from '@/components/games/MaiTrollRun/game/engine';
import { MAITROLL_LETTERS } from '@/components/games/MaiTrollRun/game/config';
import type { Hazard, Particle, Pickup } from '@/components/games/MaiTrollRun/game/types';

function inView(sx: number, margin = 80): boolean {
  return sx > -margin && sx < WORLD_WIDTH + margin;
}

export function drawHazards(ctx: CanvasRenderingContext2D, hazards: Hazard[], cam: number, time: number) {
  for (const hazard of hazards) {
    if (hazard.spent || !inView(hazard.x - cam)) continue;
    const box = hazardBox(hazard, time);
    const sx = box.x - cam;
    if (hazard.kind === 'spikes') drawSpikes(ctx, sx, box.y, box.w, box.h);
    else if (hazard.kind === 'boulder') drawBoulder(ctx, sx, box.y, box.w, box.h);
    else drawBat(ctx, sx, box.y, box.w, box.h, time, hazard.phase);
  }
}

function drawSpikes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const base = y + h;
  const metal = ctx.createLinearGradient(0, y, 0, base);
  metal.addColorStop(0, '#e7e5e4');
  metal.addColorStop(1, '#57534e');
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w, base);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(28,25,23,0.55)';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, base);
  ctx.lineTo(x + w / 2, base);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + 3, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoulder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx + 4, y + h + 2, w * 0.6, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const rock = ctx.createRadialGradient(cx - 8, cy - 12, 3, cx, cy, h / 1.6);
  rock.addColorStop(0, '#d6d3d1');
  rock.addColorStop(0.5, '#78716c');
  rock.addColorStop(1, '#1c1917');
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(12,10,9,0.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 6);
  ctx.lineTo(cx - 2, cy + 2);
  ctx.lineTo(cx + 6, cy - 4);
  ctx.moveTo(cx + 2, cy + 14);
  ctx.lineTo(cx + 10, cy + 8);
  ctx.stroke();
}

function drawBat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number,
  phase: number,
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const flap = Math.sin(time * 16 + phase);
  const wing = '#2a1a1f';
  const wingEdge = '#6b2d38';

  for (const side of [-1, 1]) {
    ctx.fillStyle = wing;
    ctx.strokeStyle = wingEdge;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + side * 6, cy);
    ctx.quadraticCurveTo(cx + side * (w / 2 + 2), cy - 10 - 12 * flap, cx + side * (w / 2 + 4), cy + 6);
    ctx.quadraticCurveTo(cx + side * (w / 4), cy + 2, cx + side * 5, cy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = '#1c1014';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#fca5a5';
  ctx.beginPath();
  ctx.arc(cx - 2.5, cy - 1, 1.3, 0, Math.PI * 2);
  ctx.arc(cx + 2.5, cy - 1, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

export function drawPickups(ctx: CanvasRenderingContext2D, pickups: Pickup[], cam: number, time: number) {
  for (const pickup of pickups) {
    if (pickup.taken) continue;
    const sx = pickup.x - cam;
    if (!inView(sx, 30)) continue;
    if (pickup.kind === 'coin') {
      drawCoin(ctx, sx, pickup.y, time + pickup.x * 0.01);
    } else if (pickup.kind === 'letter' && pickup.letterIndex !== undefined) {
      drawLetterTablet(ctx, sx, pickup.y + Math.sin(time * 3) * 3, MAITROLL_LETTERS[pickup.letterIndex]);
    } else if (pickup.kind === 'power' && pickup.power) {
      drawPowerOrb(ctx, sx, pickup.y + Math.sin(time * 2.5 + pickup.x) * 3, pickup.power, time);
    }
  }
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.max(0.15, Math.abs(Math.cos(t * 4))), 1);
  const gold = ctx.createRadialGradient(-3, -3, 1, 0, 0, 12);
  gold.addColorStop(0, '#fef3c7');
  gold.addColorStop(0.45, '#fbbf24');
  gold.addColorStop(1, '#92400e');
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#78350f';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('T', 0, 0.5);
  ctx.restore();
}

function drawLetterTablet(ctx: CanvasRenderingContext2D, x: number, y: number, letter: string) {
  ctx.save();
  ctx.shadowColor = '#fde68a';
  ctx.shadowBlur = 18;
  const stone = ctx.createLinearGradient(x, y - 17, x, y + 17);
  stone.addColorStop(0, '#78716c');
  stone.addColorStop(1, '#292524');
  ctx.fillStyle = stone;
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 17);
  ctx.lineTo(x + 13, y - 17);
  ctx.lineTo(x + 13, y + 14);
  ctx.lineTo(x, y + 19);
  ctx.lineTo(x - 13, y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 20px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, x, y);
  ctx.restore();
}

function drawPowerOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: keyof typeof POWER_COLORS,
  time: number,
) {
  const color = POWER_COLORS[kind];
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 16 + Math.sin(time * 5) * 4;
  const orb = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, 16);
  orb.addColorStop(0, '#ffffff');
  orb.addColorStop(0.4, color);
  orb.addColorStop(1, '#0f172a');
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = '#0f172a';
  ctx.fillStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'shield') {
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 6, y - 4);
    ctx.lineTo(x + 5, y + 2);
    ctx.lineTo(x, y + 7);
    ctx.lineTo(x - 5, y + 2);
    ctx.lineTo(x - 6, y - 4);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'magnet') {
    ctx.arc(x, y - 1, 6, 0, Math.PI);
    ctx.moveTo(x - 6, y - 1);
    ctx.lineTo(x - 6, y + 4);
    ctx.moveTo(x + 6, y - 1);
    ctx.lineTo(x + 6, y + 4);
    ctx.stroke();
  } else {
    ctx.moveTo(x - 5, y - 6);
    ctx.lineTo(x + 5, y - 6);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 5, y + 6);
    ctx.lineTo(x - 5, y + 6);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], cam: number) {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x - cam, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
