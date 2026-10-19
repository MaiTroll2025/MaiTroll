import React from 'react'

export type GhostModeTier = 'basic' | 'supreme'

interface GhostModeAvatarProps {
  tier: GhostModeTier
  size?: number
  className?: string
}

const AVATAR_ASSETS: Record<GhostModeTier, string> = {
  basic: '/ghost-basic.svg',
  supreme: '/ghost-supreme.svg',
}

export default function GhostModeAvatar({
  tier,
  size = 40,
  className = '',
}: GhostModeAvatarProps) {
  const tierLabel = tier === 'supreme' ? 'Ghost Mode Supreme' : 'Ghost Mode'

  return (
    <img
      src={AVATAR_ASSETS[tier]}
      alt={`${tierLabel} avatar`}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  )
}
