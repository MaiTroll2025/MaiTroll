import React from 'react';
import { Sparkles } from 'lucide-react';
import { useFounderIdentity } from '@/hooks/useFounderProgram';
import { formatMultiplier } from '@/services/founderProgram';

interface FounderBadgeProps {
  userId?: string | null;
  /** Hide the text label and show only the icon (compact lists). */
  compact?: boolean;
  className?: string;
  /** Show the live gift/cashout multipliers next to the badge. */
  showMultipliers?: boolean;
}

/**
 * ⭐ FOUNDER badge.
 *
 * Renders for any active Founder, everywhere a username is shown — web and
 * phone — because it reads from the shared Founder directory store.
 *
 * Admins are intentionally excluded: Founder is a public identity marker, and an
 * Admin already carries the strongest role presentation in the app, so the
 * Founder treatment is suppressed for them in every container.
 *
 * Presentation only. The database re-verifies Founder status on every Founder
 * resource; hiding this component cannot remove a real permission and showing
 * it grants nothing.
 */
export default function FounderBadge({
  userId,
  compact = false,
  className = '',
  showMultipliers = false,
}: FounderBadgeProps) {
  const { showFounderBadge, entry } = useFounderIdentity(userId);

  if (!showFounderBadge || !entry) return null;

  const gift = formatMultiplier(entry.gift_multiplier);
  const cashout = formatMultiplier(entry.cashout_multiplier);

  return (
    <span
      className={`founder-badge ${compact ? 'founder-badge--compact' : ''} ${className}`}
      title={`Mai Troll Founder — Gift rewards ${gift}, Cashout ${cashout}`}
    >
      <Sparkles size={compact ? 12 : 14} className="founder-badge__icon" aria-hidden="true" />
      {!compact && <span className="founder-badge__label">Founder</span>}
      {showMultipliers && !compact && (
        <span className="founder-badge__multipliers">
          {gift} / {cashout}
        </span>
      )}
      <span className="sr-only">Founder</span>
    </span>
  );
}

interface FounderUsernameProps {
  userId?: string | null;
  username: string;
  prefix?: string;
  className?: string;
  /** Render the Founder badge after the username (default true). */
  showBadge?: boolean;
}

/**
 * Username with Founder treatment: gold gradient text + Founder badge.
 *
 * Drop-in replacement for the shared username renderers so the perk appears at
 * every username location across web and phone.
 */
export function FounderUsername({
  userId,
  username,
  prefix = '@',
  className = '',
  showBadge = true,
}: FounderUsernameProps) {
  const { showFounderBadge } = useFounderIdentity(userId);

  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}>
      <span
        className={`username username-readable font-bold ${
          showFounderBadge ? 'founder-username' : ''
        }`}
      >
        {prefix}
        {username}
      </span>
      {showBadge && <FounderBadge userId={userId} compact />}
    </span>
  );
}