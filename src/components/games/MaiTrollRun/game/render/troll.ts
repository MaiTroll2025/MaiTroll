import { RUNNER_X } from '@/components/games/MaiTrollRun/game/config';
import type { Gender, Runner } from '@/components/games/MaiTrollRun/game/types';

type Pt = { x: number; y: number };
type Angles = [number, number];

interface Pose {
  legF: Angles;
  legB: Angles;
  armF: Angles;
  armB: Angles;
  lean: number;
  bob: number;
}

const HIP_Y = -40;
const THIGH = 21;
const SHIN = 19;
const UPPER_ARM = 14;
const FOREARM = 13;
const RUN_PHASE_RATE = 0.07;

const PALETTE = {
  outline: '#140d08',
  skinShadow: '#3c4a30',
  skin: '#667a4f',
  skinLight: '#8fa270',
  skinFemale: '#748d6c',
  skinFemaleShadow: '#48604a',
  skinFemaleLight: '#9ab38e',
  hairDark: '#1d1611',
  hairMid: '#33261b',
  leather: '#4a3424',
  leatherDark: '#24180f',
  breeches: '#3a2a1e',
  breechesDark: '#22180f',
  cloth: '#3b2a1c',
  clothStripe: '#24180f',
  boot: '#17110c',
  bootShine: '#3d2c1f',
  gold: '#d4a017',
  tusk: '#f1ead2',
  eye: '#fbbf24',
  bone: '#d6cfb4',
};

function poseFor(runner: Runner, time: number, idle: boolean): Pose {
  if (idle) {
    const breath = Math.sin(time * 2.2);
    return {
      legF: [0.04, 0.02],
      legB: [-0.04, -0.02],
      armF: [0.3 + breath * 0.02, 0.9],
      armB: [-0.25, 0.5],
      lean: 0.02,
      bob: breath * 0.9,
    };
  }

  const q = runner.worldX * RUN_PHASE_RATE;
  const s = Math.sin(q);

  if (runner.mode === 'air') {
    if (runner.vy < 0) {
      return {
        legF: [0.95, -0.35],
        legB: [0.35, -0.7],
        armF: [2.55, 2.9],
        armB: [2.0, 2.4],
        lean: 0.16,
        bob: 0,
      };
    }
    return {
      legF: [0.45, 0.15],
      legB: [-0.35, -0.2],
      armF: [1.9, 2.4],
      armB: [1.5, 2.0],
      lean: 0.1,
      bob: 0,
    };
  }

  if (runner.mode === 'climb') {
    const c = Math.sin(q * 0.5);
    return {
      legF: [0.28 + 0.2 * c, -0.25 + 0.2 * c],
      legB: [0.28 - 0.2 * c, -0.25 - 0.2 * c],
      armF: [2.75 + 0.22 * c, 2.95 + 0.22 * c],
      armB: [2.75 - 0.22 * c, 2.95 - 0.22 * c],
      lean: 0.06,
      bob: 0,
    };
  }

  return {
    legF: [0.5 * s, 0.5 * s - 0.5 * Math.max(0, -s)],
    legB: [-0.5 * s, -0.5 * s - 0.5 * Math.max(0, s)],
    armF: [-0.5 * s, -0.5 * s + 1.1],
    armB: [0.5 * s, 0.5 * s + 1.1],
    lean: 0.12,
    bob: -Math.abs(Math.cos(q)) * 1.6,
  };
}

function along(origin: Pt, length: number, angle: number): Pt {
  return { x: origin.x + Math.sin(angle) * length, y: origin.y + Math.cos(angle) * length };
}

function strokePath(ctx: CanvasRenderingContext2D, points: Pt[], width: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width + 2.4;
  ctx.strokeStyle = PALETTE.outline;
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  hip: Pt,
  angles: Angles,
  gender: Gender,
  dark: boolean,
) {
  const knee = along(hip, THIGH, angles[0]);
  const ankle = along(knee, SHIN, angles[1]);
  const female = gender === 'female';
  const skin = female ? (dark ? PALETTE.skinFemaleShadow : PALETTE.skinFemale) : dark ? PALETTE.skinShadow : PALETTE.skin;

  if (female) {
    strokePath(ctx, [hip, knee], 9.5, skin);
    strokePath(ctx, [knee, ankle], 7.5, skin);
  } else {
    strokePath(ctx, [hip, knee], 12, dark ? PALETTE.breechesDark : PALETTE.breeches);
    strokePath(ctx, [knee, ankle], 10.5, dark ? PALETTE.breechesDark : PALETTE.breeches);
  }

  ctx.save();
  ctx.translate(ankle.x, ankle.y);
  ctx.rotate(angles[1] * 0.5);
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.roundRect(-7, -9, 14, 13, 3);
  ctx.fill();
  ctx.fillStyle = PALETTE.boot;
  ctx.beginPath();
  ctx.roundRect(-6, -8, 12, 11, 2.5);
  ctx.fill();
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.ellipse(4, 3, 7, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.boot;
  ctx.beginPath();
  ctx.ellipse(4, 2.6, 6.2, 2.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.bootShine;
  ctx.fillRect(-4, -4, 8, 1.4);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(-1.5, -6, 3, 2.5);
  ctx.restore();
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  shoulder: Pt,
  angles: Angles,
  gender: Gender,
  dark: boolean,
) {
  const elbow = along(shoulder, UPPER_ARM, angles[0]);
  const hand = along(elbow, FOREARM, angles[1]);
  const female = gender === 'female';
  const skin = female ? (dark ? PALETTE.skinFemaleShadow : PALETTE.skinFemale) : dark ? PALETTE.skinShadow : PALETTE.skin;
  const sleeve = dark ? PALETTE.leatherDark : PALETTE.leather;

  strokePath(ctx, [shoulder, elbow], female ? 6.5 : 8, sleeve);
  strokePath(ctx, [elbow, hand], female ? 5.5 : 7, skin);

  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.arc(hand.x, hand.y, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(hand.x, hand.y, 3.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = PALETTE.bone;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(hand.x - 1, hand.y - 1);
  ctx.lineTo(hand.x + 2, hand.y + 2);
  ctx.stroke();
}

function drawTorso(ctx: CanvasRenderingContext2D, gender: Gender) {
  const female = gender === 'female';
  const skin = female ? PALETTE.skinFemale : PALETTE.skin;

  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  if (female) {
    ctx.moveTo(-10, 3);
    ctx.lineTo(10, 3);
    ctx.quadraticCurveTo(10, -4, 8, -8);
    ctx.quadraticCurveTo(9, -16, 10, -22);
    ctx.quadraticCurveTo(6, -28, -1, -28);
    ctx.quadraticCurveTo(-8, -27, -9, -21);
    ctx.quadraticCurveTo(-8, -12, -8, -8);
    ctx.quadraticCurveTo(-10, -4, -10, 3);
  } else {
    ctx.moveTo(-10, 3);
    ctx.lineTo(10, 3);
    ctx.quadraticCurveTo(10, -6, 10, -10);
    ctx.quadraticCurveTo(12, -18, 13, -23);
    ctx.quadraticCurveTo(7, -29, -2, -29);
    ctx.quadraticCurveTo(-10, -28, -12, -22);
    ctx.quadraticCurveTo(-10, -14, -9, -9);
    ctx.quadraticCurveTo(-10, -4, -10, 3);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = skin;
  ctx.fill();
  const torsoShade = ctx.createLinearGradient(-12, 0, 12, 0);
  torsoShade.addColorStop(0, 'rgba(0,0,0,0.35)');
  torsoShade.addColorStop(0.45, 'rgba(255,255,255,0.08)');
  torsoShade.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = torsoShade;
  ctx.fill();

  ctx.strokeStyle = PALETTE.skinShadow;
  ctx.lineWidth = 1.1;
  if (!female) {
    ctx.beginPath();
    ctx.moveTo(-1, -22);
    ctx.quadraticCurveTo(2, -17, 0, -13);
    ctx.moveTo(-4, -12);
    ctx.quadraticCurveTo(-2, -9, -4, -6);
    ctx.moveTo(4, -12);
    ctx.quadraticCurveTo(6, -9, 4, -6);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-3, -20);
    ctx.quadraticCurveTo(0, -17, 3, -20);
    ctx.stroke();
  }
}

function drawVest(ctx: CanvasRenderingContext2D, gender: Gender) {
  const female = gender === 'female';
  ctx.fillStyle = PALETTE.leather;
  ctx.strokeStyle = PALETTE.leatherDark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (female) {
    ctx.moveTo(-7, -26);
    ctx.lineTo(3, -26);
    ctx.lineTo(7, -17);
    ctx.lineTo(2, -14);
    ctx.lineTo(-6, -17);
    ctx.lineTo(-8, -21);
  } else {
    ctx.moveTo(-8, -27);
    ctx.lineTo(4, -28);
    ctx.lineTo(11, -21);
    ctx.lineTo(10, -9);
    ctx.lineTo(6, -5);
    ctx.lineTo(-8, -5);
    ctx.lineTo(-10, -13);
    ctx.lineTo(-9, -21);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#c9a66b';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(-6 + i * 3.4, female ? -24 : -26 + i * 1.4, 1, 1);
  }
}

function drawBelt(ctx: CanvasRenderingContext2D, gender: Gender) {
  ctx.fillStyle = '#1c1410';
  ctx.fillRect(-10.5, -6, 21, 4.5);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(-2, -6.5, 4.5, 5.5);
  ctx.fillStyle = '#7c5a14';
  ctx.fillRect(-1, -5, 2.5, 3);
  if (gender === 'male') {
    ctx.fillStyle = '#2a1d13';
    ctx.beginPath();
    ctx.roundRect(5, -2, 6, 7, 1.5);
    ctx.fill();
  }
}

function drawLowerGarment(ctx: CanvasRenderingContext2D, gender: Gender) {
  if (gender === 'male') {
    ctx.fillStyle = PALETTE.outline;
    ctx.beginPath();
    ctx.moveTo(-7.5, -2);
    ctx.lineTo(7.5, -2);
    ctx.lineTo(9, 13);
    ctx.lineTo(0, 17);
    ctx.lineTo(-7, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.cloth;
    ctx.beginPath();
    ctx.moveTo(-6.5, -2);
    ctx.lineTo(6.5, -2);
    ctx.lineTo(7.8, 12);
    ctx.lineTo(0, 15.4);
    ctx.lineTo(-6, 11);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.clothStripe;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, 1);
    ctx.lineTo(-4, 12);
    ctx.moveTo(2, 1);
    ctx.lineTo(3, 13);
    ctx.stroke();
    return;
  }

  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.moveTo(-11, -3);
  ctx.lineTo(11, -3);
  ctx.lineTo(15, 19);
  ctx.lineTo(-15, 19);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.cloth;
  ctx.beginPath();
  ctx.moveTo(-10, -2);
  ctx.lineTo(10, -2);
  ctx.lineTo(13.6, 17.5);
  ctx.lineTo(-13.6, 17.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = PALETTE.clothStripe;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let x = -9; x <= 9; x += 4.5) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x * 1.25, 17);
  }
  ctx.stroke();
}

function drawHair(ctx: CanvasRenderingContext2D, gender: Gender) {
  if (gender === 'female') {
    ctx.fillStyle = PALETTE.hairDark;
    ctx.beginPath();
    ctx.moveTo(-3, -12);
    ctx.quadraticCurveTo(-14, -14, -17, -4);
    ctx.quadraticCurveTo(-21, 10, -15, 24);
    ctx.quadraticCurveTo(-10, 16, -8, 4);
    ctx.quadraticCurveTo(-6, -6, -3, -12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.hairMid;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.quadraticCurveTo(-17, 4, -14, 14);
    ctx.moveTo(-10, -4);
    ctx.quadraticCurveTo(-13, 6, -11, 15);
    ctx.stroke();
    ctx.fillStyle = PALETTE.hairDark;
    ctx.beginPath();
    ctx.ellipse(1, -10, 10.5, 5.5, -0.2, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.quadraticCurveTo(-1, -20, 9, -10);
    ctx.lineTo(9, -13);
    ctx.quadraticCurveTo(-1, -23, -10, -10);
    ctx.fill();
    return;
  }

  ctx.fillStyle = PALETTE.hairDark;
  ctx.beginPath();
  ctx.moveTo(-9, -4);
  ctx.lineTo(-12, -9);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-9, -15);
  ctx.lineTo(-4, -14);
  ctx.lineTo(-2, -19);
  ctx.lineTo(3, -17);
  ctx.lineTo(7, -20);
  ctx.lineTo(8, -14);
  ctx.lineTo(11, -13);
  ctx.lineTo(9, -9);
  ctx.lineTo(7, -6);
  ctx.lineTo(-2, -8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = PALETTE.hairMid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, -15);
  ctx.lineTo(-1, -14);
  ctx.moveTo(2, -17);
  ctx.lineTo(5, -15);
  ctx.stroke();
}

function drawHead(ctx: CanvasRenderingContext2D, gender: Gender, time: number) {
  const female = gender === 'female';
  const skin = female ? PALETTE.skinFemale : PALETTE.skin;
  const shade = female ? PALETTE.skinFemaleShadow : PALETTE.skinShadow;
  const rx = female ? 9.2 : 10.4;
  const ry = female ? 11.2 : 12.2;

  ctx.save();
  ctx.translate(0, -39);

  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.moveTo(-rx - 6, 2);
  ctx.lineTo(-rx + 1, -2);
  ctx.lineTo(-rx + 1, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(-rx - 5, 2);
  ctx.lineTo(-rx + 1.5, -1);
  ctx.lineTo(-rx + 1.5, 5);
  ctx.closePath();
  ctx.fill();

  if (female) {
    ctx.save();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(-rx + 2, 6, 2.6, -1.2, 1.9);
    ctx.stroke();
    ctx.restore();
  }

  drawHair(ctx, gender);

  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx + 1, ry + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  const faceGrad = ctx.createRadialGradient(-3, -5, 2, 0, 0, ry + 2);
  faceGrad.addColorStop(0, female ? PALETTE.skinFemaleLight : PALETTE.skinLight);
  faceGrad.addColorStop(0.55, skin);
  faceGrad.addColorStop(1, shade);
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.ellipse(2.5, 7.5, rx * 0.78, 4.8, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(2.5, 7, rx * 0.74, 4.2, 0.05, 0, Math.PI * 2);
  ctx.fill();

  if (female) {
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-1, -5.5);
    ctx.quadraticCurveTo(3, -7.5, 7, -5);
    ctx.stroke();
  } else {
    ctx.fillStyle = PALETTE.outline;
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.quadraticCurveTo(2, -10.5, 10, -4.5);
    ctx.lineTo(10, -2.5);
    ctx.quadraticCurveTo(2, -7.5, -6, -2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#e8e4cf';
  ctx.beginPath();
  ctx.ellipse(4.2, -1.6, female ? 2.3 : 2.6, female ? 1.7 : 1.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.arc(4.6, -1.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  const glow = 0.6 + Math.sin(time * 4) * 0.25;
  ctx.shadowColor = PALETTE.eye;
  ctx.shadowBlur = 6 * glow;
  ctx.fillStyle = PALETTE.eye;
  ctx.beginPath();
  ctx.arc(4.6, -1.5, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (female) {
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, -3.4);
    ctx.lineTo(1.4, -4.6);
    ctx.moveTo(6.4, -3.4);
    ctx.lineTo(7, -4.6);
    ctx.stroke();
  }

  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(9.4, 2.8, female ? 2 : 2.6, female ? 2.8 : 3.4, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.arc(10.2, 1.6, 0.8, 0, Math.PI * 2);
  ctx.arc(8.4, 1.8, 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(4, 6.8);
  ctx.quadraticCurveTo(8, 7.8, 11, 6.2);
  ctx.stroke();

  ctx.fillStyle = PALETTE.tusk;
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 0.9;
  const tuskScale = female ? 0.7 : 1;
  for (const tx of [5.8, 9.6]) {
    ctx.beginPath();
    ctx.moveTo(tx - 1.4 * tuskScale, 7.4);
    ctx.quadraticCurveTo(tx, 3.4 * tuskScale + 2, tx + 1.1 * tuskScale, 4.2 + 2 - tuskScale);
    ctx.quadraticCurveTo(tx + 1, 6.8, tx + 1.4 * tuskScale, 7.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (!female) {
    ctx.strokeStyle = 'rgba(40,20,15,0.55)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(-7, 2);
    ctx.moveTo(-7.5, -1);
    ctx.lineTo(-5.8, 4);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(30,20,10,0.35)';
  for (const [dx, dy] of [
    [-5, 5],
    [-2, 9],
    [3, -8],
    [-6, -2],
  ]) {
    ctx.beginPath();
    ctx.arc(dx, dy, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawTroll(
  ctx: CanvasRenderingContext2D,
  runner: Runner,
  gender: Gender,
  time: number,
  idle: boolean,
): void {
  const pose = poseFor(runner, time, idle);
  const hip: Pt = { x: 0, y: HIP_Y };

  ctx.save();
  ctx.translate(RUNNER_X, runner.feetY);
  if (runner.crouching) ctx.scale(1, 0.66);

  drawArm(ctx, { x: -4, y: -62 + pose.bob }, pose.armB, gender, true);
  drawLeg(ctx, hip, pose.legB, gender, true);

  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(pose.lean);
  ctx.translate(-hip.x, -hip.y);
  ctx.translate(0, pose.bob);
  drawLowerGarment(ctx, gender);
  drawTorso(ctx, gender);
  drawVest(ctx, gender);
  drawBelt(ctx, gender);
  ctx.restore();

  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(pose.lean);
  ctx.translate(-hip.x, -hip.y);
  ctx.translate(0, pose.bob);
  drawHead(ctx, gender, time);
  ctx.restore();

  drawLeg(ctx, hip, pose.legF, gender, false);
  drawArm(ctx, { x: 5, y: -62 + pose.bob }, pose.armF, gender, false);

  ctx.restore();
}
