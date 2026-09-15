import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { useState } from 'react'
import {
  Home,
  Users,
  MessageCircle,
  Briefcase,
  Users2,
  Droplet,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react'

interface SchoolHeaderProps {
  title: string
  showSidebar?: boolean
  onSidebarToggle?: (open: boolean) => void
  isSidebarOpen?: boolean
}

export function SchoolHeader({ 
  title, 
  showSidebar = true, 
  onSidebarToggle, 
  isSidebarOpen 
}: SchoolHeaderProps) {
  const navigate = useNavigate()
  const { profile, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="bg-gradient-to-b from-[#1a1f2e] to-[#0f1419] border-b border-white/10 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showSidebar && (
            <button
              onClick={() => onSidebarToggle?.(!isSidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition lg:hidden"
            >
              {isSidebarOpen ? (
                <X className="size-5 text-white" />
              ) : (
                <Menu className="size-5 text-white" />
              )}
            </button>
          )}
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-white">MAi School</h1>
            <p className="text-sm text-white/60">{title}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
            <img
              src={profile?.avatar_url || '/default-avatar.png'}
              alt={profile?.username}
              className="w-6 h-6 rounded-full object-cover"
            />
            <span className="text-sm text-white">{profile?.username}</span>
            <span className="text-xs bg-blue-600/50 text-white px-2 py-1 rounded">
              STUDENT
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 hover:bg-red-600/20 rounded-lg transition text-red-400 hover:text-red-300"
            title="Logout"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface SchoolSidebarProps {
  isOpen: boolean
  userType: 'student' | 'instructor' | 'institution_staff'
  onClose?: () => void
}

export function SchoolSidebar({ isOpen, userType, onClose }: SchoolSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const studentNavigation = [
    { label: 'Home', icon: Home, path: '/school' },
    { label: 'Social', icon: MessageCircle, path: '/school/social' },
    { label: 'My Profile', icon: Users, path: '/school/profile' },
    { label: 'Connections', icon: Users2, path: '/school/connections' },
    { label: 'MAi Business', icon: Briefcase, path: '/school/business' },
    { label: 'My Team', icon: Users2, path: '/school/team' },
    { label: 'School Pool', icon: Droplet, path: '/school/pool' },
    { label: 'UtroMail', icon: MessageCircle, path: '/utromail' },
  ]

  const instructorNavigation = [
    { label: 'Home', icon: Home, path: '/school/instructor' },
    { label: 'My Profile', icon: Users, path: '/school/instructor/profile' },
    { label: 'My Students', icon: Users2, path: '/school/instructor/students' },
    { label: 'Instructor Network', icon: Users, path: '/school/instructor/network' },
    { label: 'Institution Dashboard', icon: Briefcase, path: '/school/instructor/dashboard' },
    { label: 'UtroMail', icon: MessageCircle, path: '/utromail' },
  ]

  const institutionNavigation = [
    { label: 'Overview', icon: Home, path: '/school/institution' },
    { label: 'Students', icon: Users2, path: '/school/institution/students' },
    { label: 'Instructors', icon: Users, path: '/school/institution/instructors' },
    { label: 'Programs', icon: Briefcase, path: '/school/institution/programs' },
    { label: 'Teams', icon: Users2, path: '/school/institution/teams' },
    { label: 'School Pool', icon: Droplet, path: '/school/institution/pool' },
    { label: 'Announcements', icon: MessageCircle, path: '/school/institution/announcements' },
    { label: 'Settings', icon: Settings, path: '/school/institution/settings' },
  ]

  const navigation = 
    userType === 'student' ? studentNavigation :
    userType === 'instructor' ? instructorNavigation :
    institutionNavigation

  const handleNavClick = (path: string) => {
    navigate(path)
    onClose?.()
  }

  return (
    <div
      className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-gradient-to-b from-[#1a1f2e] to-[#0f1419] border-r border-white/10 p-4 overflow-y-auto transition-all z-40 lg:z-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                isActive
                  ? 'bg-[#6366f1] text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="size-5 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
