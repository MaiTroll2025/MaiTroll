import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { X, LogOut } from 'lucide-react'
import LevelStatusCard from '../components/home/LevelStatusCard'

interface PhoneDrawerProps {
  open: boolean
  onClose: () => void
}

function getInitials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(/[\s_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export default function PhoneDrawer({ open, onClose }: PhoneDrawerProps) {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const [coins, setCoins] = useState<number | null>(null)

  const sections = useMemo(() => {
    const isAdmin = (profile as any)?.is_admin || (profile as any)?.role === 'admin'
    const items: { title: string; items: { label: string; path: string; icon: string; show?: boolean }[] }[] = []

    const add = (title: string, data: { label: string; path: string; icon: string; show?: boolean }[]) => {
      const visible = data.filter((i) => i.show !== false)
      if (!visible.length) return
      items.push({ title, items: visible })
    }

    add('Menu', [
      { label: 'Home', path: '/', icon: 'Home' },
      { label: 'Profile', path: '/profile', icon: 'User', show: !!user },
      { label: 'Coins', path: '/store', icon: 'Coins' },
      { label: 'Mai Pay', path: '/wallet', icon: 'Wallet' },
      { label: 'Mai Piks', path: '/mai-piks', icon: 'Image' },
      { label: 'Troll Court', path: '/troll-court', icon: 'Scale' },
      { label: 'Treelz', path: '/treelz', icon: 'Video' },
      { label: 'Auctions', path: '/auctions', icon: 'Gavel' },
      { label: 'HytroGaming', path: '/hytro', icon: 'Gamepad2' },
      { label: 'Careers', path: '/careers', icon: 'Briefcase' },
      { label: 'Live', path: '/broadcast/setup', icon: 'Radio', show: !!(profile as any)?.is_broadcaster || isAdmin },
    ])

    if (isAdmin) {
      add('Admin', [
        { label: 'Admin Dashboard', path: '/admin', icon: 'LayoutDashboard' },
        { label: 'Admin Mobile', path: '/admin-mobile', icon: 'Smartphone' },
      ])
    }

    const isSecretary = (profile as any)?.role === 'secretary' || (profile as any)?.troll_role === 'secretary' || (profile as any)?.is_secretary === true
    const isLeadOfficer = (profile as any)?.role === 'lead_troll_officer' || (profile as any)?.troll_role === 'lead_troll_officer' || (profile as any)?.is_lead_officer === true
    const isTrollOfficer = (profile as any)?.role === 'troll_officer' || (profile as any)?.troll_role === 'troll_officer' || (profile as any)?.is_troll_officer === true
    const isPastor = (profile as any)?.role === 'pastor' || (profile as any)?.troll_role === 'pastor'
    const isTCNN = (profile as any)?.role === 'tcnn' || (profile as any)?.troll_role === 'tcnn' || (profile as any)?.is_tcnn === true
    const isRecordLabel = (profile as any)?.role === 'record_label' || (profile as any)?.troll_role === 'record_label'

    if (isSecretary || isLeadOfficer || isTrollOfficer || isPastor || isTCNN || isRecordLabel || isAdmin) {
      const roleItems: { label: string; path: string; icon: string }[] = []
      if (isSecretary) roleItems.push({ label: 'Secretary', path: '/phone-secretary', icon: 'PenSquare' })
      if (isLeadOfficer) roleItems.push({ label: 'Lead Officer', path: '/phone-lead-officer', icon: 'Star' })
      if (isTrollOfficer) roleItems.push({ label: 'Troll Officer', path: '/phone-troll-officer', icon: 'Shield' })
      if (isPastor) roleItems.push({ label: 'Pastor', path: '/phone-pastor', icon: 'Heart' })
      if (isTCNN) roleItems.push({ label: 'TCNN News', path: '/tcnn', icon: 'MessageCircle' })
      if (isRecordLabel) roleItems.push({ label: 'Record Label', path: '/mai-record-label', icon: 'Music' })
      if (roleItems.length) add('Role', roleItems)
    }

    add('Explore', [
      { label: 'Live Now', path: '/live', icon: 'Radio' },
      { label: 'Leagues', path: '/leagues', icon: 'Trophy' },
      { label: 'Academy', path: '/academy', icon: 'BookOpen' },
      { label: 'Community Wall', path: '/community-wall', icon: 'MessageSquare' },
      { label: 'Blocked Users', path: '/blocked-users', icon: 'Ban' },
    ])

    add('Support', [
      { label: 'Support', path: '/support', icon: 'LifeBuoy' },
      { label: 'Safety', path: '/safety', icon: 'Shield' },
      { label: 'Legal', path: '/legal', icon: 'FileText' },
    ])

    return items
  }, [profile, user])

  useEffect(() => {
    if (!open || !user?.id) return
    let cancelled = false

    const load = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .maybeSingle()

      if (!cancelled && data) {
        setCoins(data.troll_coins ?? 0)
      }
    }

    load()

    const channel = supabase
      .channel(`phone-drawer-profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as any
          setCoins(row.troll_coins ?? 0)
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [open, user?.id])

  const displayName = (profile as any)?.display_name || (profile as any)?.username || user?.email || 'Guest'
  const roleLabel = (profile as any)?.role
    ? String((profile as any).role).split(/[_\s]+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : null

  const handleSignOut = async () => {
    try {
      sessionStorage.setItem('logout_requested', 'true')

      await supabase.auth.signOut().catch((err) => {
        console.warn('Phone logout signOut error:', err)
      })

      await useAuthStore.getState().logout()

      try {
        localStorage.clear()

        const introSeen = sessionStorage.getItem('trollIntroSeen')
        sessionStorage.clear()

        if (introSeen) {
          sessionStorage.setItem('trollIntroSeen', introSeen)
        }

        if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
          const dbs = await window.indexedDB.databases()

          dbs.forEach((db: any) => {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name)
            }
          })
        }
      } catch (storageError) {
        console.error('Phone logout storage clear error:', storageError)
      }

      onClose()
      navigate('/auth', { replace: true })
    } catch (error: any) {
      console.error('Phone logout error:', error)
      onClose()
      navigate('/auth', { replace: true })
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <aside className="absolute left-0 top-0 flex h-full w-[82%] max-w-[320px] flex-col bg-zinc-950 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <span className="text-lg font-black tracking-tight">MENU</span>
          <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-1 text-white hover:bg-white/10">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {user && (
            <div className="mb-4 rounded-xl border border-white/10 bg-zinc-900 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-sm font-bold text-white">
                  {getInitials(displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                  {roleLabel && <p className="truncate text-xs text-zinc-400">{roleLabel}</p>}
                </div>
                <button
                  onClick={handleSignOut}
                  className="shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-400 transition hover:bg-red-500/20"
                  aria-label="Sign out"
                >
                  <LogOut size={18} />
                </button>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Coins</span>
                  <span className="font-black text-[#00BFFF]">{coins != null ? coins.toLocaleString() : '—'}</span>
                </div>
              </div>

              <div className="mt-3">
                <LevelStatusCard />
              </div>
            </div>
          )}

          {!user && (
            <button
              onClick={() => {
                onClose()
                navigate('/auth')
              }}
              className="mb-4 block w-full rounded-lg px-3 py-2 text-left text-sm text-cyan-400 hover:bg-white/10"
            >
              Sign in to see your profile
            </button>
          )}

          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <button
                    key={`${item.path}-${item.label}`}
                    onClick={() => {
                      onClose()
                      navigate(item.path)
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-white transition hover:bg-white/10"
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="ml-auto text-zinc-600">›</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
