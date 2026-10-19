/**
 * AvatarWithFrame — Smart avatar wrapper that auto-applies equipped profile frame
 *
 * Drop-in replacement for any <img> or avatar component.
 * Uses ProfileFrameContext to look up any user's equipped frame.
 * Falls back to plain avatar if no frame is equipped.
 *
 * Usage:
 *   <AvatarWithFrame
 *     userId={user.id}
 *     avatarUrl={user.avatar_url}
 *     size="sm"
 *     username={user.username}
 *     className="rounded-full"
 *   />
 */

import React from 'react';
import ProfileFrame from './ProfileFrame';
import type { FrameSize } from './ProfileFrame';
import { useProfileFrameContext } from '../../hooks/useProfileFrameContext';
import { usePublicProfileIdentity } from '../../hooks/usePublicProfileIdentity';

interface AvatarWithFrameProps {
  /** User ID to look up their equipped frame */
  userId?: string | null;
  /** Avatar image URL */
  avatarUrl?: string | null;
  /** Size preset for the frame */
  size?: FrameSize;
  /** Username for alt text */
  username?: string;
  /** Additional className */
  className?: string;
  /** Show frame badge (default: false for inline avatars) */
  showBadge?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Fallback element if no avatar URL */
  fallback?: React.ReactNode;
  /** Render as a div wrapper instead of img (for non-img avatars) */
  asDiv?: boolean;
}

/**
 * AvatarWithFrame component — wraps avatar with equipped profile frame
 */
export default function AvatarWithFrame({
  userId,
  avatarUrl,
  size = 'sm',
  username = '',
  className = '',
  showBadge = false,
  onClick,
  fallback,
  asDiv = false,
}: AvatarWithFrameProps) {
  const { getUserFrame } = useProfileFrameContext();
  const { identity, loading } = usePublicProfileIdentity(userId);
  const userFrame = getUserFrame(userId || '');
  const frame = userFrame?.frame || null;

  const safeAvatarUrl = userId
    ? identity?.avatar_url || (loading ? '/ghost-basic.svg' : '/default-avatar.png')
    : avatarUrl;
  const safeUsername = userId
    ? identity?.username || (loading ? 'Ghost Mode' : 'User')
    : username;
  const resolvedAvatarUrl =
    safeAvatarUrl ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId || 'default'}`;

  // If no frame, render plain avatar
  if (!frame) {
    if (fallback && !safeAvatarUrl) {
      return <>{fallback}</>;
    }
    if (asDiv) {
      return (
        <div className={className} onClick={onClick}>
          <img
            src={resolvedAvatarUrl}
            alt={safeUsername || 'Avatar'}
            className="w-full h-full object-cover rounded-full"
            draggable={false}
            loading="lazy"
          />
        </div>
      );
    }
    return (
      <img
        src={resolvedAvatarUrl}
        alt={safeUsername || 'Avatar'}
        className={className}
        onClick={onClick}
        draggable={false}
        loading="lazy"
      />
    );
  }

  // Render avatar with frame
  return (
    <ProfileFrame
      frame={frame}
      avatarUrl={resolvedAvatarUrl}
      size={size}
      username={safeUsername}
      showBadge={showBadge}
      className={className}
      onClick={onClick}
    />
  );
}
