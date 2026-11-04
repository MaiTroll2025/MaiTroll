import React from 'react'
import { Loader2 } from 'lucide-react'

type UniversalButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon'

export interface UniversalButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  iconPosition?: 'start' | 'end'
  iconOnly?: boolean
  loading?: boolean
  variant?: UniversalButtonVariant
}

const variantClasses: Record<UniversalButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-[#9515f3] to-[#f12dc9] text-white shadow-[0_8px_22px_rgba(173,25,239,.25)] hover:brightness-110',
  secondary: 'border border-[#a746e8]/50 bg-[#23163b] text-[#e5a5ff] hover:bg-[#30204d]',
  ghost: 'bg-white/5 text-[#c7a0ff] hover:bg-white/10',
  icon: 'border border-white/10 bg-[#1b1b34] text-[#e0b8ff] hover:bg-white/10',
}

const baseClasses =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a18] active:scale-[.98] disabled:pointer-events-none disabled:opacity-40'

const iconClasses = 'shrink-0 [&>svg]:h-4 [&>svg]:w-4'

const UniversalButton = React.forwardRef<HTMLButtonElement, UniversalButtonProps>(
  function UniversalButton(
    {
      children,
      className = '',
      icon,
      iconPosition = 'start',
      iconOnly = false,
      loading = false,
      disabled = false,
      type = 'button',
      variant = 'primary',
      'aria-label': ariaLabel,
      ...props
    },
    ref,
  ) {
    const accessibleLabel = ariaLabel || (typeof children === 'string' ? children : undefined)

    if (iconOnly && !accessibleLabel) {
      throw new Error('UniversalButton iconOnly buttons require an aria-label')
    }

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        aria-label={accessibleLabel}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        className={`${baseClasses} ${variantClasses[iconOnly ? 'icon' : variant]} ${
          iconOnly ? 'h-10 w-10 p-0' : ''
        } ${className}`}
      >
        {loading ? <Loader2 className={`${iconClasses} animate-spin`} aria-hidden="true" /> : iconPosition === 'start' ? icon : null}
        {!iconOnly && children}
        {!loading && !iconOnly && iconPosition === 'end' ? icon : null}
      </button>
    )
  },
)

UniversalButton.displayName = 'UniversalButton'

export default UniversalButton
