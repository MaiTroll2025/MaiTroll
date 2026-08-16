import React from 'react'
import { Shield } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ProtectedRoleBadgeProps {
  role?: string | null
  trollRole?: string | null
  isAdmin?: boolean | null
  isSuperAdmin?: boolean | null
  size?: 'sm' | 'md'
}

export default function ProtectedRoleBadge({
  role,
  trollRole,
  isAdmin,
  isSuperAdmin,
  size = 'sm',
}: ProtectedRoleBadgeProps) {
  const isProtected =
    isAdmin === true ||
    isSuperAdmin === true ||
    (role && ['admin', 'superadmin', 'ceo', 'secretary', 'pastor', 'lead_troll_officer', 'troll_officer', 'president', 'vice_president', 'judge', 'attorney', 'prosecutor'].includes(role)) ||
    (trollRole && ['admin', 'superadmin', 'ceo', 'secretary', 'pastor', 'lead_officer', 'officer', 'lead_troll_officer', 'troll_officer'].includes(trollRole))

  if (!isProtected) return null

  const sizeClasses = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-2 py-1'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 font-bold text-amber-300',
        sizeClasses
      )}
    >
      <Shield className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
      Host
    </span>
  )
}
