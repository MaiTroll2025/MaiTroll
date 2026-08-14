import React from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'

interface ProfileDropdownProps {
  className?: string
}

export default function ProfileDropdown({ className }: ProfileDropdownProps) {
  const { user, profile } = useAuthStore()
  const frame = useUserFrame(user?.id)

  if (!profile) return null

  return (
    <div className={`relative flex items-center gap-1 ${className}`}>
      <Link
        to={`/profile/${profile.username}`}
        className="relative group outline-none"
      >
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-visible flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
          <ProfileFrame
            frame={frame}
            avatarUrl={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username || 'user'}`}
            size="md"
            username={profile.username || ''}
          />
        </div>
      </Link>
    </div>
  )
}
