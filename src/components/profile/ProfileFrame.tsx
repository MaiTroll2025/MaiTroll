/**
 * ProfileFrame — Premium Animated Avatar Frame Component
 *
 * Frame wraps AROUND the avatar image (border on outside edge).
 * Avatar is 100% visible inside. Frame never overlaps the image.
 *
 * Layer order (bottom to top):
 *   1. Background effects (glow)
 *   2. Avatar image (fully visible)
 *   3. Frame border (on outside edge)
 *   4. Animation effects (fire, smoke, snow, etc.)
 *   5. Particles / Sparkles
 *   6. Badges
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ProfileFrame as ProfileFrameType, AnimationSpeed } from '../../config/profileFrames';
import { ANIMATION_DURATIONS, RARITY_COLORS } from '../../config/profileFrames';

export type FrameSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface SizeConfig {
  avatar: number;
  borderWidth: number;
  fontSize: number;
  badgeSize: string;
  particleCount: number;
}

const SIZE_MAP: Record<FrameSize, SizeConfig> = {
  xs:  { avatar: 20,  borderWidth: 2, fontSize: 6,  badgeSize: 'text-[5px]',  particleCount: 2 },
  sm:  { avatar: 28,  borderWidth: 2, fontSize: 8,  badgeSize: 'text-[7px]',  particleCount: 3 },
  md:  { avatar: 40,  borderWidth: 3, fontSize: 10, badgeSize: 'text-[9px]',  particleCount: 4 },
  lg:  { avatar: 56,  borderWidth: 3, fontSize: 12, badgeSize: 'text-[10px]', particleCount: 5 },
  xl:  { avatar: 80,  borderWidth: 4, fontSize: 14, badgeSize: 'text-xs',     particleCount: 7 },
  xxl: { avatar: 104, borderWidth: 4, fontSize: 16, badgeSize: 'text-sm',     particleCount: 9 },
};

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

interface ProfileFrameProps {
  frame: ProfileFrameType | null;
  avatarUrl: string;
  size?: FrameSize;
  username?: string;
  showBadge?: boolean;
  className?: string;
  onClick?: () => void;
  fillParent?: boolean;
  containerSize?: number;
}

// ─── Fire Particle ─────────────────────────────────────────────
function FireParticle({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed];
  const angle = (index / total) * 360;
  const radiusX = containerSize / 2 + 2;
  const radiusY = containerSize / 2 - 2;
  const size = 4 + Math.random() * 6;
  const delay = (index / total) * duration;
  const x = Math.cos((angle * Math.PI) / 180) * radiusX;
  const y = Math.sin((angle * Math.PI) / 180) * radiusY;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size * 1.5,
        background: `radial-gradient(ellipse, ${color}, #ff4400, transparent)`,
        borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        filter: `blur(${size > 6 ? 1 : 0.5}px)`,
      }}
      animate={{
        opacity: [0, 1, 0.8, 0],
        scale: [0.3, 1.2, 0.8, 0],
        y: [0, -(8 + Math.random() * 12)],
        x: [0, (Math.random() - 0.5) * 6],
      }}
      transition={{
        duration: duration * 0.6,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

// ─── Smoke Particle ────────────────────────────────────────────
function SmokeParticle({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 1.5;
  const angle = (index / total) * 360 + (index * 37);
  const radius = containerSize / 2 + 4;
  const size = 8 + Math.random() * 10;
  const delay = (index / total) * duration;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;
  const driftX = (Math.random() - 0.5) * 20;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle, ${color}90, ${color}40, transparent)`,
        borderRadius: '50%',
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        filter: 'blur(3px)',
      }}
      animate={{
        opacity: [0, 0.5, 0.3, 0],
        scale: [0.5, 1.8, 2.5, 3],
        y: [0, -15 - Math.random() * 10],
        x: [0, driftX],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

// ─── Snow Particle ─────────────────────────────────────────────
function SnowParticle({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 2;
  const startX = -containerSize / 2 + Math.random() * containerSize;
  const size = 2 + Math.random() * 4;
  const delay = (index / total) * duration * 1.5;
  const swayAmount = 4 + Math.random() * 8;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size,
        backgroundColor: color,
        borderRadius: '50%',
        left: `calc(50% + ${startX}px)`,
        top: `calc(50% - ${containerSize / 2 + 4}px)`,
        boxShadow: `0 0 ${size}px ${color}`,
      }}
      animate={{
        y: [0, containerSize + 10],
        x: [0, swayAmount, -swayAmount, swayAmount * 0.5, 0],
        opacity: [0, 1, 1, 0.8, 0],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// ─── Rain Particle ─────────────────────────────────────────────
function RainParticle({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 0.8;
  const startX = -containerSize / 2 + Math.random() * containerSize;
  const size = 1 + Math.random() * 2;
  const delay = (index / total) * duration;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size * 4,
        background: `linear-gradient(to bottom, transparent, ${color}, transparent)`,
        borderRadius: size,
        left: `calc(50% + ${startX}px)`,
        top: `calc(50% - ${containerSize / 2 + 2}px)`,
      }}
      animate={{
        y: [0, containerSize + 8],
        opacity: [0, 0.8, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// ─── Bubble Particle ───────────────────────────────────────────
function BubbleParticle({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 1.8;
  const startX = -containerSize / 3 + Math.random() * (containerSize * 0.66);
  const size = 3 + Math.random() * 6;
  const delay = (index / total) * duration;
  const wobbleX = (Math.random() - 0.5) * 16;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle at 30% 30%, ${color}cc, ${color}40, transparent)`,
        borderRadius: '50%',
        border: `0.5px solid ${color}60`,
        left: `calc(50% + ${startX}px)`,
        bottom: `calc(50% - ${containerSize / 2 + 2}px)`,
      }}
      animate={{
        y: [0, -(containerSize + 8)],
        x: [0, wobbleX, -wobbleX * 0.5, wobbleX * 0.3],
        opacity: [0, 0.7, 0.5, 0],
        scale: [0.5, 1, 1.1, 0.8],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

// ─── Heart Particle ────────────────────────────────────────────
function HeartParticle({ index, total, color: _color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 1.6;
  const startX = -containerSize / 3 + Math.random() * (containerSize * 0.66);
  const size = 5 + Math.random() * 5;
  const delay = (index / total) * duration;
  const wobbleX = (Math.random() - 0.5) * 12;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size,
        left: `calc(50% + ${startX}px)`,
        bottom: `calc(50% - ${containerSize / 2}px)`,
        fontSize: size,
        lineHeight: 1,
      }}
      animate={{
        y: [0, -(containerSize + 10)],
        x: [0, wobbleX, -wobbleX * 0.5],
        opacity: [0, 1, 0.8, 0],
        scale: [0.5, 1.1, 0.9, 0.5],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    >
      ❤️
    </motion.div>
  );
}

// ─── Star / Starfall Particle ──────────────────────────────────
function StarParticle({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 1.2;
  const startX = -containerSize / 2 + Math.random() * containerSize;
  const size = 3 + Math.random() * 5;
  const delay = (index / total) * duration;
  const trailLength = 8 + Math.random() * 12;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size,
        backgroundColor: color,
        borderRadius: '50%',
        left: `calc(50% + ${startX}px)`,
        top: `calc(50% - ${containerSize / 2}px)`,
        boxShadow: `0 0 ${size * 2}px ${color}, -${trailLength}px 0 ${size}px ${color}40`,
      }}
      animate={{
        y: [0, containerSize + 10],
        x: [0, (Math.random() - 0.5) * 30],
        opacity: [0, 1, 0.6, 0],
        scale: [0.3, 1, 0.5, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeIn',
      }}
    />
  );
}

// ─── Confetti Particle ─────────────────────────────────────────
function ConfettiParticle({ index, total, speed, containerSize }: {
  index: number; total: number; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 1.5;
  const startX = -containerSize / 2 + Math.random() * containerSize;
  const colors = ['#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#fb923c'];
  const color = colors[index % colors.length];
  const size = 3 + Math.random() * 4;
  const delay = (index / total) * duration;
  const isRect = index % 2 === 0;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: isRect ? size * 1.5 : size,
        height: isRect ? size * 0.6 : size,
        backgroundColor: color,
        borderRadius: isRect ? 0 : '50%',
        left: `calc(50% + ${startX}px)`,
        top: `calc(50% - ${containerSize / 2}px)`,
      }}
      animate={{
        y: [0, containerSize + 10],
        x: [0, (Math.random() - 0.5) * 20],
        rotate: [0, 360 * (index % 2 === 0 ? 1 : -1)],
        opacity: [0, 1, 0.8, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeIn',
      }}
    />
  );
}

// ─── Matrix Particle ───────────────────────────────────────────
function MatrixParticle({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 0.9;
  const colWidth = containerSize / total;
  const startX = -containerSize / 2 + index * colWidth;
  const delay = (index / total) * duration;
  const chars = '01アイウエオカキクケコサシスセソタチツテト';
  const char = chars[index % chars.length];

  return (
    <motion.div
      className="absolute pointer-events-none font-mono font-bold"
      style={{
        fontSize: 8 + Math.random() * 4,
        color,
        left: `calc(50% + ${startX}px)`,
        top: `calc(50% - ${containerSize / 2}px)`,
        textShadow: `0 0 6px ${color}`,
      }}
      animate={{
        y: [0, containerSize + 8],
        opacity: [0, 1, 0.8, 0.2, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {char}
    </motion.div>
  );
}

// ─── Cherry Blossom Petal ──────────────────────────────────────
function PetalParticle({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 2;
  const startX = -containerSize / 2 + Math.random() * containerSize;
  const size = 4 + Math.random() * 5;
  const delay = (index / total) * duration;
  const swayX = 10 + Math.random() * 15;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size * 0.7,
        background: `linear-gradient(135deg, ${color}, ${color}80)`,
        borderRadius: '50% 0 50% 0',
        left: `calc(50% + ${startX}px)`,
        top: `calc(50% - ${containerSize / 2}px)`,
      }}
      animate={{
        y: [0, containerSize + 10],
        x: [0, swayX, -swayX, swayX * 0.5],
        rotate: [0, 180, 360, 540],
        opacity: [0, 0.9, 0.7, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// ─── Halloween Ghost/Bat Particle ──────────────────────────────
function HalloweenParticle({ index, total, color: _color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 1.8;
  const angle = (index / total) * 360;
  const radius = containerSize / 2 + 6;
  const delay = (index / total) * duration;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;
  const emojis = ['👻', '🦇', '🎃', '💀', '🕷️'];
  const emoji = emojis[index % emojis.length];
  const size = 8 + Math.random() * 6;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        fontSize: size,
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
      }}
      animate={{
        opacity: [0, 1, 0.8, 0],
        scale: [0.5, 1.1, 0.9, 0.3],
        y: [0, -8 - Math.random() * 8],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    >
      {emoji}
    </motion.div>
  );
}

// ─── Lightning Bolt ────────────────────────────────────────────
function LightningBolt({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 0.5;
  const angle = (index / total) * 360;
  const radius = containerSize / 2;
  const delay = Math.random() * duration * 2;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;
  const length = 10 + Math.random() * 14;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: 2,
        height: length,
        background: `linear-gradient(to bottom, transparent, ${color}, white, ${color}, transparent)`,
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        borderRadius: 1,
        boxShadow: `0 0 8px ${color}, 0 0 16px ${color}`,
      }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0.5, 1.2, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatDelay: duration * (1 + Math.random() * 2),
        ease: 'easeOut',
      }}
    />
  );
}

// ─── Ocean Wave ────────────────────────────────────────────────
function OceanWave({ index, color, speed, containerSize }: {
  index: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 1.5;
  const yOffset = index * 6 - 6;
  const delay = index * 0.3;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: containerSize + 16,
        height: 4,
        background: `linear-gradient(90deg, transparent, ${color}60, ${color}, ${color}60, transparent)`,
        borderRadius: 4,
        left: `calc(50% - ${(containerSize + 16) / 2}px)`,
        top: `calc(50% + ${yOffset}px)`,
        filter: 'blur(1px)',
      }}
      animate={{
        opacity: [0.2, 0.6, 0.2],
        scaleX: [0.9, 1.05, 0.9],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// ─── Aurora Wave ───────────────────────────────────────────────
function AuroraWave({ index, speed, containerSize }: {
  index: number; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 2;
  const colors = ['#00ff8840', '#8800ff30', '#00ffaa35', '#cc00ff25', '#44ff6630'];
  const color = colors[index % colors.length];
  const yOffset = (index - 2) * 5;
  const delay = index * 0.4;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: containerSize + 20,
        height: 6,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        borderRadius: 6,
        left: `calc(50% - ${(containerSize + 20) / 2}px)`,
        top: `calc(50% + ${yOffset}px)`,
        filter: 'blur(3px)',
      }}
      animate={{
        opacity: [0.1, 0.5, 0.1],
        scaleX: [0.8, 1.1, 0.8],
        y: [0, -3, 3, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// ─── Lava Bubble ───────────────────────────────────────────────
function LavaBubble({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 1.2;
  const angle = (index / total) * 360;
  const radius = containerSize / 2;
  const size = 3 + Math.random() * 5;
  const delay = (index / total) * duration;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle at 30% 30%, #ffcc00, ${color}, #990000)`,
        borderRadius: '50%',
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        boxShadow: `0 0 ${size}px ${color}`,
      }}
      animate={{
        opacity: [0, 0.9, 0],
        scale: [0.3, 1.3, 0.2],
        y: [0, -(4 + Math.random() * 8)],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

// ─── Frost Crystal ─────────────────────────────────────────────
function FrostCrystal({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 1.5;
  const angle = (index / total) * 360;
  const radius = containerSize / 2 + 2;
  const size = 3 + Math.random() * 4;
  const delay = (index / total) * duration;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, white, ${color})`,
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        boxShadow: `0 0 ${size}px ${color}`,
      }}
      animate={{
        opacity: [0, 0.8, 0],
        rotate: [0, 180, 360],
        scale: [0.5, 1, 0.5],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// ─── Neon Pulse Ring ───────────────────────────────────────────
function NeonPulseRing({ index, color, speed, containerSize }: {
  index: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed];
  const delay = index * (duration / 3);
  const size = containerSize + 8 + index * 8;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size,
        border: `1.5px solid ${color}`,
        borderRadius: '50%',
        left: `calc(50% - ${size / 2}px)`,
        top: `calc(50% - ${size / 2}px)`,
        boxShadow: `0 0 6px ${color}, inset 0 0 6px ${color}40`,
      }}
      animate={{
        opacity: [0.6, 0.1, 0.6],
        scale: [0.95, 1.05, 0.95],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// ─── Gold Leaf Particle ────────────────────────────────────────
function GoldLeaf({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 1.3;
  const angle = (index / total) * 360;
  const radius = containerSize / 2 + 3;
  const size = 4 + Math.random() * 4;
  const delay = (index / total) * duration;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size * 0.6,
        background: `linear-gradient(135deg, #ffd700, ${color}, #b8860b)`,
        borderRadius: '50% 0 50% 0',
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        boxShadow: `0 0 4px #ffd700`,
      }}
      animate={{
        opacity: [0, 1, 0.7, 0],
        rotate: [0, 360],
        scale: [0.5, 1.1, 0.5],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// ─── Diamond Sparkle Particle ──────────────────────────────────
function DiamondSparkle({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed];
  const angle = (index / total) * 360;
  const radius = containerSize / 2 + 2;
  const size = 3 + Math.random() * 5;
  const delay = (index / total) * duration;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, white, ${color}, white)`,
        clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        boxShadow: `0 0 ${size * 2}px ${color}`,
      }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0.3, 1.2, 0.3],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// ─── Shadow Void Particle ──────────────────────────────────────
function _ShadowVoidParticle({ index, total, color, speed, containerSize }: {
  index: number; total: number; color: string; speed: AnimationSpeed; containerSize: number;
}) {
  const duration = ANIMATION_DURATIONS[speed] * 1.4;
  const angle = (index / total) * 360;
  const radius = containerSize / 2 + 3;
  const size = 6 + Math.random() * 8;
  const delay = (index / total) * duration;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle, ${color}80, #1a0030, transparent)`,
        borderRadius: '50%',
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        filter: 'blur(2px)',
      }}
      animate={{
        opacity: [0, 0.6, 0],
        scale: [0.5, 1.5, 0.3],
        y: [0, -6 - Math.random() * 6],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

// ─── Effect Renderer ───────────────────────────────────────────
function FrameEffects({ frame, containerSize, reducedMotion }: {
  frame: ProfileFrameType; containerSize: number; reducedMotion: boolean;
}) {
  if (reducedMotion) return null;

  const count = Math.min(frame.particleCount, 12);
  const speed = frame.animationSpeed;

  const effects: Record<string, React.ReactNode> = {
    fire: Array.from({ length: count }).map((_, i) => (
      <FireParticle key={i} index={i} total={count} color={frame.particleColor || '#ffcc00'} speed={speed} containerSize={containerSize} />
    )),
    smoke: Array.from({ length: count }).map((_, i) => (
      <SmokeParticle key={i} index={i} total={count} color={frame.particleColor || '#9ca3af'} speed={speed} containerSize={containerSize} />
    )),
    snow: Array.from({ length: count }).map((_, i) => (
      <SnowParticle key={i} index={i} total={count} color={frame.particleColor || '#ffffff'} speed={speed} containerSize={containerSize} />
    )),
    rain: Array.from({ length: count }).map((_, i) => (
      <RainParticle key={i} index={i} total={count} color={frame.particleColor || '#93c5fd'} speed={speed} containerSize={containerSize} />
    )),
    starfall: Array.from({ length: count }).map((_, i) => (
      <StarParticle key={i} index={i} total={count} color={frame.particleColor || '#fbbf24'} speed={speed} containerSize={containerSize} />
    )),
    bubbles: Array.from({ length: count }).map((_, i) => (
      <BubbleParticle key={i} index={i} total={count} color={frame.particleColor || '#a5f3fc'} speed={speed} containerSize={containerSize} />
    )),
    hearts: Array.from({ length: count }).map((_, i) => (
      <HeartParticle key={i} index={i} total={count} color={frame.particleColor || '#f9a8d4'} speed={speed} containerSize={containerSize} />
    )),
    confetti: Array.from({ length: count }).map((_, i) => (
      <ConfettiParticle key={i} index={i} total={count} speed={speed} containerSize={containerSize} />
    )),
    matrix: Array.from({ length: count }).map((_, i) => (
      <MatrixParticle key={i} index={i} total={count} color={frame.particleColor || '#4ade80'} speed={speed} containerSize={containerSize} />
    )),
    cherry_blossom: Array.from({ length: count }).map((_, i) => (
      <PetalParticle key={i} index={i} total={count} color={frame.particleColor || '#f9a8d4'} speed={speed} containerSize={containerSize} />
    )),
    halloween: Array.from({ length: count }).map((_, i) => (
      <HalloweenParticle key={i} index={i} total={count} color={frame.particleColor || '#c084fc'} speed={speed} containerSize={containerSize} />
    )),
    lightning: Array.from({ length: count }).map((_, i) => (
      <LightningBolt key={i} index={i} total={count} color={frame.particleColor || '#fde68a'} speed={speed} containerSize={containerSize} />
    )),
    ocean: Array.from({ length: 5 }).map((_, i) => (
      <OceanWave key={i} index={i} color={frame.particleColor || '#38bdf8'} speed={speed} containerSize={containerSize} />
    )),
    aurora: Array.from({ length: 5 }).map((_, i) => (
      <AuroraWave key={i} index={i} speed={speed} containerSize={containerSize} />
    )),
    lava: Array.from({ length: count }).map((_, i) => (
      <LavaBubble key={i} index={i} total={count} color={frame.particleColor || '#ff6600'} speed={speed} containerSize={containerSize} />
    )),
    ice: Array.from({ length: count }).map((_, i) => (
      <FrostCrystal key={i} index={i} total={count} color={frame.particleColor || '#7dd3fc'} speed={speed} containerSize={containerSize} />
    )),
    neon_glow: Array.from({ length: 3 }).map((_, i) => (
      <NeonPulseRing key={i} index={i} color={frame.glowColor || '#e879f9'} speed={speed} containerSize={containerSize} />
    )),
    gold_shimmer: Array.from({ length: count }).map((_, i) => (
      <GoldLeaf key={i} index={i} total={count} color={frame.particleColor || '#fde68a'} speed={speed} containerSize={containerSize} />
    )),
    diamond_sparkle: Array.from({ length: count }).map((_, i) => (
      <DiamondSparkle key={i} index={i} total={count} color={frame.particleColor || '#67e8f9'} speed={speed} containerSize={containerSize} />
    )),
  };

  return <>{effects[frame.animationType || '']}</>;
}

// ─── Main Component ────────────────────────────────────────────
export default function ProfileFrame({
  frame,
  avatarUrl,
  size = 'md',
  username = '',
  showBadge = false,
  className = '',
  onClick,
  fillParent = false,
  containerSize: customContainerSize,
}: ProfileFrameProps) {
  const reducedMotion = useReducedMotion();
  const dims = SIZE_MAP[size];
  // For fillParent, we don't know the actual pixel size yet (it's % based),
  // so we use the avatar dimension as the base for effects calculations.
  const containerSize = customContainerSize || (fillParent ? dims.avatar : dims.avatar + dims.borderWidth * 2);
  const rarityColor = frame ? RARITY_COLORS[frame.rarity] : null;

  const glowStyle = frame?.glowColor && frame.glowIntensity > 0 && !reducedMotion
    ? `0 0 ${frame.glowIntensity * 8}px ${frame.glowColor}, 0 0 ${frame.glowIntensity * 16}px ${frame.glowColor}40`
    : 'none';

  const _borderStyle = frame?.borderGradient
    ? undefined
    : frame?.borderColor;

  const renderFrameBorder = (borderW: number) => {
    if (!frame) return null;
    if (frame.borderGradient) {
      return (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            padding: borderW,
            background: frame.borderGradient,
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            boxShadow: glowStyle,
          }}
        />
      );
    }
    return (
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          border: `${borderW}px solid ${frame.borderColor}`,
          boxShadow: glowStyle,
        }}
      />
    );
  };

  const renderShimmer = (borderW: number) => {
    if (!frame || reducedMotion || frame.animationType !== 'shimmer') return null;
    return (
      <div
        className="absolute inset-0 rounded-full pointer-events-none overflow-hidden"
        style={{ border: `${borderW}px solid transparent` }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, transparent, ${frame.borderColor}40, transparent)`,
            backgroundSize: '200% 100%',
            animation: `pf-shimmer ${ANIMATION_DURATIONS[frame.animationSpeed]}s linear infinite`,
          }}
        />
      </div>
    );
  };

  const renderParticles = () => {
    if (!frame || !frame.hasParticles || !frame.particleColor || reducedMotion) return null;
    return (
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: dims.particleCount }).map((_, i) => {
          const angle = (i / dims.particleCount) * 360;
          const radius = containerSize / 2 + 4;
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;
          return (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 3, height: 3,
                backgroundColor: frame.particleColor,
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                boxShadow: `0 0 4px ${frame.particleColor}`,
              }}
              animate={{ opacity: [0, 0.8, 0], scale: [0.3, 1, 0.3] }}
              transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
            />
          );
        })}
      </div>
    );
  };

  const renderEnergyRings = () => {
    if (!frame || !frame.hasEnergyRings || !frame.glowColor || reducedMotion) return null;
    return (
      <div className="absolute inset-0 pointer-events-none">
        {[0, 1].map((i) => (
          <motion.div
            key={`ring-${i}`}
            className="absolute rounded-full"
            style={{ inset: -(4 + i * 6), border: `1px solid ${frame!.glowColor}30` }}
            animate={{ opacity: [0.2, 0.5, 0.2], scale: [0.98, 1.02, 0.98] }}
            transition={{ duration: 3 + i, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>
    );
  };

  const renderEffects = () => {
    if (!frame || reducedMotion) return null;
    return <FrameEffects frame={frame} containerSize={containerSize} reducedMotion={reducedMotion} />;
  };

  const renderBadge = () => {
    if (!showBadge || !frame || !rarityColor) return null;
    return (
      <div
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
        style={{ backgroundColor: rarityColor.bg, border: `1px solid ${rarityColor.border}` }}
      >
        <span className={`font-bold ${dims.badgeSize}`} style={{ color: rarityColor.text }}>
          {frame.icon} {frame.name}
        </span>
      </div>
    );
  };

  // ─── fillParent mode ─────────────────────────────────────────
  // Container fills the parent entirely. Avatar is inset by borderWidth on each side.
  // Frame border, glow, and shimmer render at the container edge (absolute inset-0).
  // Particles/effects are omitted in fillParent mode since the container size is
  // dynamic and can't be known at render time — the border + glow are the priority.
  if (fillParent) {
    const borderW = dims.borderWidth;
    return (
      <div
        className={`relative flex flex-col items-center justify-center gap-1 ${className}`}
        onClick={onClick}
        style={{ width: '100%', height: '100%', overflow: 'visible', aspectRatio: '1 / 1' }}
      >
        {/* Glow behind the avatar */}
        {frame && glowStyle !== 'none' && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${frame.glowColor}30 0%, transparent 70%)`,
              filter: 'blur(4px)',
              zIndex: 0,
            }}
          />
        )}
        {/* Avatar image — inset by borderWidth so border goes around the outside */}
        <div
          className="relative rounded-full overflow-hidden"
          style={{
            width: `calc(100% - ${borderW * 2}px)`,
            height: `calc(100% - ${borderW * 2}px)`,
            zIndex: 2,
          }}
        >
          <img
            src={avatarUrl}
            alt={username || 'Avatar'}
            className="w-full h-full object-cover rounded-full"
            draggable={false}
            loading="lazy"
          />
        </div>
        {/* Frame border — fills the entire container */}
        {renderFrameBorder(borderW)}
        {renderShimmer(borderW)}
        {/* Simple orbiting particles that work with any container size */}
        {frame && frame.hasParticles && frame.particleColor && !reducedMotion && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
            {Array.from({ length: Math.min(dims.particleCount, 4) }).map((_, i) => {
              const angle = (i / Math.min(dims.particleCount, 4)) * 360;
              return (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 3, height: 3,
                    backgroundColor: frame.particleColor,
                    left: '50%', top: '50%',
                    boxShadow: `0 0 4px ${frame.particleColor}`,
                  }}
                  animate={{
                    x: [0, Math.cos((angle * Math.PI) / 180) * 14, 0],
                    y: [0, Math.sin((angle * Math.PI) / 180) * 14, 0],
                    opacity: [0, 0.8, 0],
                    scale: [0.3, 1, 0.3],
                  }}
                  transition={{ duration: 2.5, delay: i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              );
            })}
          </div>
        )}
        {renderBadge()}
        <style>{`
          @keyframes pf-shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}</style>
      </div>
    );
  }

  // ─── Fixed size mode ─────────────────────────────────────────
  // Add padding around the container so effects (particles, glow, rings) don't get clipped
  const effectsPad = frame ? 20 : 0;
  const outerSize = containerSize + effectsPad * 2;

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-1 ${className}`}
      onClick={onClick}
      style={{ overflow: 'visible' }}
    >
      {/* Outer wrapper — large enough to contain effects */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: outerSize, height: outerSize, overflow: 'visible' }}
      >
        {/* Effects layer — extends beyond the avatar */}
        {frame && (
          <div
            className="absolute pointer-events-none"
            style={{
              width: outerSize,
              height: outerSize,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              overflow: 'visible',
              zIndex: 1,
            }}
          >
            {glowStyle !== 'none' && (
              <div
                className="absolute rounded-full"
                style={{
                  width: containerSize + 12,
                  height: containerSize + 12,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: `radial-gradient(circle, ${frame.glowColor}40 0%, transparent 70%)`,
                  filter: 'blur(6px)',
                }}
              />
            )}
            {renderEffects()}
            {renderParticles()}
            {renderEnergyRings()}
          </div>
        )}
        {/* Avatar + border layer — centered */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: containerSize, height: containerSize, zIndex: 2 }}
        >
          <div
            className="relative rounded-full overflow-hidden"
            style={{ width: dims.avatar, height: dims.avatar }}
          >
            <img
              src={avatarUrl}
              alt={username || 'Avatar'}
              className="w-full h-full object-cover rounded-full"
              draggable={false}
              loading="lazy"
            />
          </div>
          {renderFrameBorder(dims.borderWidth)}
          {renderShimmer(dims.borderWidth)}
        </div>
      </div>
      {renderBadge()}
      <style>{`
        @keyframes pf-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}
