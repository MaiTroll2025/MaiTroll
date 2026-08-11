/**
 * AvatarWithFrame — Drop-in replacement for any avatar <img> tag.
 * 
 * Wraps the avatar with a profile frame border if the user has one equipped.
 * Frame renders OUTSIDE the avatar edge (like TikTok/Discord profile frames).
 * Avatar is always 100% visible. Frame never overlaps the image.
 * 
 * Usage: Replace any `<img src={avatarUrl} ... />` with:
 *   <AvatarWithFrame src={avatarUrl} size="sm" />
 * 
 * For user-specific frames, pass userId:
 *   <AvatarWithFrame src={avatarUrl} userId={msg.userId} size="sm" />
 */

import React, { useState, useEffect } from 'react';
import ProfileFrame from '@/components/profile/ProfileFrame';
import { getFrameById, type ProfileFrame as ProfileFrameType } from '@/config/profileFrames';
import { supabase } from '@/lib/supabase';

export type AvatarFrameSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface AvatarWithFrameProps {
  src: string;
  alt?: string;
  size?: AvatarFrameSize;
  userId?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  rounded?: 'full' | 'lg' | 'xl' | '2xl' | 'none';
}

// Cache for equipped frames to avoid repeated DB lookups
const frameCache = new Map<string | null, ProfileFrameType | null>();
const pendingLookups = new Set<string>();

export default function AvatarWithFrame({
  src,
  alt = '',
  size = 'sm',
  userId,
  className = '',
  style,
  onClick,
  rounded,
}: AvatarWithFrameProps) {
  const [frame, setFrame] = useState<ProfileFrameType | null>(null);

  useEffect(() => {
    if (!userId) {
      setFrame(null);
      return;
    }

    const cached = frameCache.get(userId);
    if (cached !== undefined) {
      setFrame(cached);
      return;
    }

    if (pendingLookups.has(userId)) return;
    pendingLookups.add(userId);

    supabase
      .from('user_profile_frames')
      .select('frame_id')
      .eq('user_id', userId)
      .eq('is_equipped', true)
      .maybeSingle()
      .then(({ data }) => {
        const equippedFrame = data?.frame_id ? getFrameById(data.frame_id) || null : null;
        frameCache.set(userId, equippedFrame);
        setFrame(equippedFrame);
        pendingLookups.delete(userId);
      })
      .then(undefined, () => {
        frameCache.set(userId, null);
        setFrame(null);
        pendingLookups.delete(userId);
      });
  }, [userId]);

  // If no frame, render plain avatar
  if (!frame) {
    const roundedClass = rounded === 'full' ? 'rounded-full' : rounded === 'lg' ? 'rounded-lg' : rounded === 'xl' ? 'rounded-xl' : rounded === '2xl' ? 'rounded-2xl' : 'rounded-full';
    return (
      <img
        src={src}
        alt={alt}
        className={`object-cover ${roundedClass} ${className}`}
        style={style}
        onClick={onClick}
        draggable={false}
      />
    );
  }

  // Render avatar with frame
  return (
    <ProfileFrame
      frame={frame}
      avatarUrl={src}
      size={size}
      username={alt}
      className={className}
      onClick={onClick}
    />
  );
}
