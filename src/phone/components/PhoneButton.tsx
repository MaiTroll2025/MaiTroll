import React from 'react'
import { cn } from '@/lib/utils'

export type PhoneButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'outline' 
  | 'ghost' 
  | 'danger' 
  | 'icon-only'
  | 'nav'

export type PhoneButtonSize = 'sm' | 'md' | 'lg' | 'xl'

interface PhoneButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PhoneButtonVariant
  size?: PhoneButtonSize
  icon?: React.ReactNode
  iconOnly?: boolean
  children?: React.ReactNode
  fullWidth?: boolean
  loading?: boolean
}

const SIZE_CLASSES: Record<PhoneButtonSize, string> = {
  sm: 'h-10 px-3 text-[10px]',
  md: 'h-12 px-4 text-xs',
  lg: 'h-14 px-5 text-sm',
  xl: 'h-16 px-6 text-base',
}

const ICON_SIZES: Record<PhoneButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
}

const VARIANT_CLASSES: Record<PhoneButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] text-white shadow-[0_0_20px_rgba(0,191,255,0.3)]',
  secondary: 'bg-gradient-to-r from-[#BF00FF] to-[#9B30FF] text-white shadow-[0_0_20px_rgba(191,0,255,0.3)]',
  outline: 'border border-white/20 bg-white/5 text-white hover:bg-white/10',
  ghost: 'bg-transparent text-white hover:bg-white/5',
  danger: 'bg-red-500/90 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]',
  'icon-only': 'bg-white/10 text-white hover:bg-white/20',
  nav: 'bg-white/10 text-white hover:bg-white/20',
}

export const PhoneButton = React.forwardRef<HTMLButtonElement, PhoneButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconOnly = false,
      children,
      fullWidth = false,
      loading = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const iconSize = ICON_SIZES[size]
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'relative flex items-center justify-center gap-2',
          'font-black uppercase tracking-wider transition-all duration-150',
          'active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed',
          'rounded-xl',
          SIZE_CLASSES[size],
          VARIANT_CLASSES[variant],
          fullWidth && 'w-full',
          iconOnly && 'p-0 aspect-square',
          className
        )}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}

        {icon && !loading && !iconOnly && (
          <span className="flex-shrink-0" aria-hidden="true">
            {React.isValidElement(icon)
              ? React.cloneElement(icon as React.ReactElement, { size: iconSize })
              : icon}
          </span>
        )}

        {iconOnly && icon && !loading && (
          <span className="flex items-center justify-center" aria-hidden="true">
            {React.isValidElement(icon)
              ? React.cloneElement(icon as React.ReactElement, { size: iconSize + 4 })
              : icon}
          </span>
        )}

        {children && !iconOnly && (
          <span className={cn(
            'flex items-center justify-center',
            loading && 'invisible'
          )}>
            {children}
          </span>
        )}
      </button>
    )
  }
)

PhoneButton.displayName = 'PhoneButton'

export default PhoneButton