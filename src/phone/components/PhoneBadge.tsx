import React from 'react'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getBadgeIcon, getRarityClasses, getCategoryColor } from '@/hooks/useBadges'

interface PhoneBadgeProps {
  badge: {
    slug: string
    name: string
    description: string | null
    icon: string | null
    color: string | null
    category: string
    rarity: string
    earned_at?: string
  }
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  className?: string
}

const SIZE_CLASSES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
}

const ICON_SIZES = {
  sm: 10,
  md: 14,
  lg: 18,
}

export const PhoneBadge = React.forwardRef<HTMLDivElement, PhoneBadgeProps>(
  (
    {
      badge,
      size = 'md',
      showTooltip = true,
      className,
    },
    ref
  ) => {
    const IconName = getBadgeIcon(badge.icon)
    const Icon = IconName
      ? LucideIcons[IconName as keyof typeof LucideIcons] as LucideIcon
      : null
    const iconSize = ICON_SIZES[size]
    const rarityClasses = getRarityClasses(badge.rarity)
    const categoryColor = badge.color || getCategoryColor(badge.category)

    const TooltipContent = (
      <div className="max-w-xs">
        <p className="font-black text-white">{badge.name}</p>
        {badge.description && (
          <p className="mt-1 text-[9px] text-zinc-400">{badge.description}</p>
        )}
        <p className="mt-2 text-[8px] font-black uppercase tracking-wider text-zinc-500">
          {badge.category.charAt(0).toUpperCase() + badge.category.slice(1)} • {badge.rarity.charAt(0).toUpperCase() + badge.rarity.slice(1)}
        </p>
        {badge.earned_at && (
          <p className="mt-1 text-[8px] text-zinc-600">
            Earned {new Date(badge.earned_at).toLocaleDateString()}
          </p>
        )}
      </div>
    )

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex-shrink-0 flex items-center justify-center rounded-xl',
          'shadow-[0_0_15px_rgba(0,0,0,0.3)]',
          SIZE_CLASSES[size],
          rarityClasses,
          className
        )}
        style={{ borderWidth: '2px' }}
      >
        {Icon && (
          <span
            className="flex items-center justify-center"
            style={{ color: categoryColor, textShadow: `0 0 8px ${categoryColor}` }}
          >
            <Icon size={iconSize} />
          </span>
        )}
        
        {!IconName && badge.icon && (
          <span className="flex items-center justify-center" style={{ fontSize: iconSize }}>
            {badge.icon}
          </span>
        )}

        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-3 rounded-xl bg-[#05050d]/95 border border-white/10 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            {TooltipContent}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#05050d]" />
          </div>
        )}
      </div>
    )
  }
)

PhoneBadge.displayName = 'PhoneBadge'

export default PhoneBadge