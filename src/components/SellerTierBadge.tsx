import React from 'react';
import { SellerTier, getSellerTierInfo, canDisplaySellerTier } from '../lib/sellerTiers';

interface SellerTierBadgeProps {
  tier: SellerTier | string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showIcon?: boolean;
  tooltip?: boolean;
}

/**
 * Seller Tier Badge Component
 * 
 * IMPORTANT: Blue is reserved for Troll Officers ONLY.
 * Seller badges use: Yellow (Verified), Gold (Verified Pro), Orange (Merchant), Purple (Enterprise)
 */
export default function SellerTierBadge({ 
  tier, 
  className = '', 
  size = 'md',
  showLabel = false,
  showIcon = true,
  tooltip = true
}: SellerTierBadgeProps) {
  // Don't display for standard or null tiers
  if (!canDisplaySellerTier(tier)) {
    return null;
  }

  const tierInfo = getSellerTierInfo(tier as SellerTier);
  
  const sizeClasses = {
    sm: {
      badge: 'px-1.5 py-0.5 text-xs',
      icon: 'w-3 h-3',
    },
    md: {
      badge: 'px-2 py-1 text-sm',
      icon: 'w-4 h-4',
    },
    lg: {
      badge: 'px-3 py-1.5 text-base',
      icon: 'w-5 h-5',
    },
  };

  const iconContent = () => {
    switch (tier) {
      case 'verified':
        return (
          <svg viewBox="0 0 24 24" fill="none" className={sizeClasses[size].icon}>
            <circle cx="12" cy="12" r="10" fill={tierInfo.color} opacity="0.2" />
            <circle cx="12" cy="12" r="9" stroke={tierInfo.color} strokeWidth="2" />
            <path
              d="M9 12l2 2 4-4"
              stroke={tierInfo.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case 'verified_pro':
        return (
          <svg viewBox="0 0 24 24" fill="none" className={sizeClasses[size].icon}>
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" 
              fill={tierInfo.color} opacity="0.3" />
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" 
              stroke={tierInfo.color} strokeWidth="1.5" fill="none" />
            <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill={tierInfo.color}>★</text>
          </svg>
        );
      case 'merchant':
        return (
          <svg viewBox="0 0 24 24" fill="none" className={sizeClasses[size].icon}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" 
              stroke={tierInfo.color} strokeWidth="2" fill="none" />
            <polyline points="9 22 9 12 15 12 15 22" 
              stroke={tierInfo.color} strokeWidth="2" />
          </svg>
        );
      case 'enterprise':
        return (
          <svg viewBox="0 0 24 24" fill="none" className={sizeClasses[size].icon}>
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" 
              stroke={tierInfo.color} strokeWidth="2" fill="none" />
            <line x1="4" y1="8" x2="20" y2="8" stroke={tierInfo.color} strokeWidth="2" />
            <line x1="8" y1="4" x2="8" y2="6" stroke={tierInfo.color} strokeWidth="2" />
            <line x1="16" y1="4" x2="16" y2="6" stroke={tierInfo.color} strokeWidth="2" />
            <circle cx="12" cy="14" r="2" fill={tierInfo.color} />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${sizeClasses[size].badge}
        ${className}
      `}
      style={{
        backgroundColor: tierInfo.bgColor,
        border: `1px solid ${tierInfo.borderColor}`,
        color: tierInfo.color,
      }}
      title={tooltip ? tierInfo.label : undefined}
    >
      {showIcon && iconContent()}
      {showLabel && <span>{tierInfo.label}</span>}
    </span>
  );
}

/**
 * Simplified version for inline display next to username
 */
export function SellerTierInline({ tier }: { tier: SellerTier | string | null }) {
  if (!canDisplaySellerTier(tier)) {
    return null;
  }

  const tierInfo = getSellerTierInfo(tier as SellerTier);
  
  return (
    <span
      className="inline-flex items-center ml-1"
      title={tierInfo.label}
    >
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
        {tier === 'verified' && (
          <>
            <circle cx="8" cy="8" r="7" fill={tierInfo.color} opacity="0.2" />
            <circle cx="8" cy="8" r="6" stroke={tierInfo.color} strokeWidth="1.5" fill="none" />
            <path d="M5 8l2 2 4-4" stroke={tierInfo.color} strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
        {tier === 'verified_pro' && (
          <text x="8" y="11" textAnchor="middle" fontSize="9" fill={tierInfo.color}>★</text>
        )}
        {tier === 'merchant' && (
          <path d="M2 6l6-4.5 6 4.5v8.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" 
            stroke={tierInfo.color} strokeWidth="1.5" fill="none" />
        )}
        {tier === 'enterprise' && (
          <rect x="3" y="2" width="10" height="12" rx="1" 
            stroke={tierInfo.color} strokeWidth="1.5" fill="none" />
        )}
      </svg>
    </span>
  );
}
