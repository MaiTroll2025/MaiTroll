import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, Calendar, CheckCircle2, Package, Settings, Users } from 'lucide-react';
import { cn } from '../../lib/utils'

interface AuctionNavProps {
  /** Page identifier for highlighting the active tab */
  active: 'shows' | 'inventory' | 'bidders' | 'sales' | 'analytics' | 'settings'
  /** Optional extra content rendered to the right of the nav tabs */
  extra?: React.ReactNode
}

const panel =
  'rounded-[1.65rem] border border-cyan-300/15 bg-[#0b1628]/85 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'

const tabs = [
  { key: 'shows' as const, label: 'My Shows', icon: Calendar, route: '/auctions/studio' },
  { key: 'inventory' as const, label: 'Inventory', icon: Package, route: '/auctions/inventory' },
  { key: 'bidders' as const, label: 'Bidders', icon: Users, route: '/auctions/bidders' },
  { key: 'sales' as const, label: 'Sales', icon: CheckCircle2, route: '/auctions/sales' },
  { key: 'analytics' as const, label: 'Analytics', icon: BarChart3, route: '/auctions/analytics' },
  { key: 'settings' as const, label: 'Settings', icon: Settings, route: '/auctions/settings' },
]

export default function AuctionNav({ active, extra }: AuctionNavProps) {
  const navigate = useNavigate()
  const location = useLocation()

  // Determine if we're on the studio page itself to show the back button differently
  const _isStudio = location.pathname === '/auctions/studio'

  return (
    <div className={cn(panel, 'overflow-hidden p-3')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Back button */}
        <button
          onClick={() => navigate('/auctions/studio')}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-cyan-300/15 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Studio
        </button>

        {/* Nav tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = active === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.route)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition',
                  isActive
                    ? 'border-cyan-300/25 bg-cyan-400/12 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.12)]'
                    : 'border-transparent text-slate-400 hover:border-cyan-300/15 hover:bg-cyan-400/8 hover:text-cyan-100'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Extra content slot */}
        {extra && <div className="flex items-center gap-2">{extra}</div>}
      </div>
    </div>
  )
}
