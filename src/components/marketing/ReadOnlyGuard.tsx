import React from 'react'
import { useAuthStore } from '../../lib/store'
import { isMarketingReadonly, canWrite } from '../../lib/supabase'
import { Eye, Lock } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ReadOnlyGuardProps {
  children: React.ReactNode
  action?: 'broadcast' | 'gift' | 'chat' | 'payment' | 'purchase' | 'withdraw' | 'edit' | 'delete' | 'create' | 'any'
  showBadge?: boolean
  className?: string
}

export function ReadOnlyGuard({ children, action = 'any', showBadge = true, className }: ReadOnlyGuardProps) {
  const profile = useAuthStore((state) => state.profile)

  const isReadOnly = isMarketingReadonly(profile)
  const actionCanWrite = canWriteAction(profile, action)

  if (!isReadOnly || actionCanWrite) {
    return <>{children}</>
  }

  if (showBadge) {
    return (
      <div className={cn('relative', className)}>
        {children}
        <div className="absolute inset-0 bg-transparent cursor-not-allowed" title="Read-only access" />
        {showBadge && (
          <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-amber-500/90 text-white text-[10px] font-bold rounded flex items-center gap-1">
            <Eye className="w-3 h-3" />
            READ-ONLY
          </div>
        )}
      </div>
    )
  }

  return <>{children}</>
}

function canWriteAction(
  profile: ReturnType<typeof useAuthStore.getState>['profile'],
  action: ReadOnlyGuardProps['action']
): boolean {
  if (!profile) return true

  const writeActions: Record<string, boolean> = {
    broadcast: canWrite(profile) ?? true,
    gift: canWrite(profile) ?? true,
    chat: canWrite(profile) ?? true,
    payment: canWrite(profile) ?? true,
    purchase: canWrite(profile) ?? true,
    withdraw: canWrite(profile) ?? true,
    edit: canWrite(profile) ?? true,
    delete: canWrite(profile) ?? true,
    create: canWrite(profile) ?? true,
    any: canWrite(profile) ?? true,
  }

  return writeActions[action] ?? true
}

interface ReadOnlyOverlayProps {
  message?: string
}

export function ReadOnlyOverlay({ message = 'Read-only access - View only' }: ReadOnlyOverlayProps) {
  const profile = useAuthStore((state) => state.profile)
  const isReadOnly = isMarketingReadonly(profile)

  if (!isReadOnly) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
      <div className="bg-amber-600 text-white text-center py-1 text-sm font-medium flex items-center justify-center gap-2">
        <Eye className="w-4 h-4" />
        {message}
      </div>
    </div>
  )
}

interface ReadOnlyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  action?: 'broadcast' | 'gift' | 'chat' | 'payment' | 'purchase' | 'withdraw' | 'edit' | 'delete' | 'create' | 'any'
  showBadge?: boolean
}

export const ReadOnlyButton = React.forwardRef<HTMLButtonElement, ReadOnlyButtonProps>(
  ({ children, action = 'any', showBadge = true, disabled, className, ...props }, ref) => {
    const profile = useAuthStore((state) => state.profile)
    const isReadOnly = isMarketingReadonly(profile)
    const actionCanWrite = canWriteAction(profile, action)

    const isDisabled = disabled || (isReadOnly && !actionCanWrite)

    return (
      <div className="relative">
        <button
          ref={ref}
          disabled={isDisabled}
          className={cn(isDisabled && 'opacity-50 cursor-not-allowed', className)}
          {...props}
        >
          {children}
        </button>
        {isReadOnly && !actionCanWrite && showBadge && (
          <div className="absolute -top-1 -right-1 px-1 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded flex items-center gap-0.5">
            <Eye className="w-2.5 h-2.5" />
            VIEW
          </div>
        )}
      </div>
    )
  }
)
ReadOnlyButton.displayName = 'ReadOnlyButton'

export function useCanWrite() {
  const profile = useAuthStore((state) => state.profile)
  return canWrite(profile) ?? true
}

export function useIsMarketingReadonly() {
  const profile = useAuthStore((state) => state.profile)
  return isMarketingReadonly(profile)
}