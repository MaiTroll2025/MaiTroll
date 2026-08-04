import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, ChevronRight, ClipboardList, Crown, LayoutDashboard, LogOut, Shield, Coins } from 'lucide-react'
import { navigation } from './navigationConfig.tsx'
import { supabase } from '../../lib/supabase'

import { useAuthStore } from '../../lib/store'
import { usePresidentSystem } from '../../hooks/usePresidentSystem'
import PromoSlot from '../../components/promo/PromoSlot'

/* ================================
   Shared Panels
============================== */

import ExecutiveIntakeList from '../admin/components/shared/ExecutiveIntakeList'
import CriticalAlertsList from '../admin/components/shared/CriticalAlertsList'
import ExecutiveReportsList from '../admin/components/shared/ExecutiveReportsList'
import ProposalManagementPanel from '../admin/components/shared/ProposalManagementPanel'

/* ================================
   Admin Panels
============================== */

import StaffManagement from '../admin/components/StaffManagement'

/* ================================
   Specialized Panels
============================== */

import SecretaryDashboard from '../president/SecretaryDashboard'
import NeighborApprovals from './components/NeighborApprovals'
import CityAdsManager from './components/CityAdsManager'
import SecretaryCalendar from './components/SecretaryCalendar'
import SecretaryOwnDashboard from './components/SecretaryOwnDashboard'
import SecretaryCrownRedemptions from './components/SecretaryCrownRedemptions'

/* ================================
   Types
============================== */

type Section =
  | 'dashboard'
  | 'intake'
  | 'governance'
  | 'community'
  | 'administration'
  | 'security'

type View =
  | 'overview'
  | 'intake_queue'
  | 'cashouts'
  | 'bonus_approval'
  | 'payouts'
  | 'reports'
  | 'alerts'
  | 'elections'
  | 'proposals'
  | 'neighbors'
  | 'ads'
  | 'staff'
  | 'payout_control'
  | 'calendar'
  | 'secretary_dashboard'
  | 'crown_redemptions'
  | 'coin_liability'

/* ================================
   Main Component
============================== */

export default function ExecutiveOperationsConsole() {
  const navigate = useNavigate()

  const { user, profile, logout } = useAuthStore()

  const {
    currentElection,
    finalizeElection,
    loading
  } = usePresidentSystem()

  const [activeView, setActiveView] =
    useState<View>('overview')

  /* ================================
     Safe Logout
  ================================ */

  const handleLogout = async () => {
    try {
      sessionStorage.setItem(
        'logout_requested',
        'true'
      )

      await logout()

      localStorage.removeItem('auth')
      localStorage.removeItem('profile')

      navigate('/exit', { replace: true })
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  /* ================================
     Dashboard Stats
  ================================ */

  const [intakeCount, setIntakeCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)
  const [coinLiabilityCount, setCoinLiabilityCount] = useState(0)

// Fetch real counts for overview stats
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [intakeRes, alertsRes, coinRes] = await Promise.all([
          supabase.from('executive_intake').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress']),
          supabase.from('critical_alerts').select('id', { count: 'exact', head: true }).eq('resolved', false),
          supabase.from('payout_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'approved'])
        ])
        if (intakeRes.count != null) setIntakeCount(intakeRes.count)
        if (alertsRes.count != null) setAlertCount(alertsRes.count)
        if (coinRes.count != null) setCoinLiabilityCount(coinRes.count)
      } catch (err) {
        console.error('Error fetching overview counts:', err)
      }
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 30000)
    return () => clearInterval(interval)
  }, [])

  const dashboardStats = useMemo(
    () => [
      {
        label: 'Open Intake',
        value: String(intakeCount),
        icon: <ClipboardList className="w-5 h-5" />,
        color: 'text-blue-400',
        view: 'intake_queue' as View
      },
      {
        label: 'Critical Alerts',
        value: String(alertCount),
        icon: <AlertTriangle className="w-5 h-5" />,
        color: 'text-red-400',
        view: 'alerts' as View
      },
      {
        label: 'Active Elections',
        value: currentElection ? '1' : '0',
        icon: <Crown className="w-5 h-5" />,
        color: 'text-yellow-400',
        view: 'elections' as View
      },
      {
        label: 'Coin Liability',
        value: String(coinLiabilityCount),
        icon: <Coins className="w-5 h-5" />,
        color: 'text-green-400',
        view: 'coin_liability' as View
      }
    ],
    [currentElection, intakeCount, alertCount, coinLiabilityCount]
  )

  /* ================================
     Render Active View
  ================================ */

  const renderContent = () => {
    switch (activeView) {

      case 'overview':
        return (
          <div className="space-y-6">

            <div>
              <h2 className="text-3xl font-bold text-white">
                Operations Overview
              </h2>

              <p className="text-slate-400 mt-2">
                Centralized operational intelligence,
                approvals, escalations, and governance.
              </p>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {dashboardStats.map((stat) => (
                <button
                  key={stat.label}
                  onClick={() => stat.view && setActiveView(stat.view)}
                  className="
                    bg-slate-900
                    border border-slate-800
                    rounded-2xl
                    p-5
                    text-left
                    hover:border-slate-600
                    hover:bg-slate-800/80
                    transition-all
                    cursor-pointer
                  "
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={stat.color}>
                      {stat.icon}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>

                  <div className="text-3xl font-bold text-white">
                    {stat.value}
                  </div>

                  <div className="text-sm text-slate-400 mt-1">
                    {stat.label}
                  </div>
                </button>
              ))}
            </div>

            {/* Promo Slots */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <PromoSlot placement="home_right_upper" variant="featured" />
              <PromoSlot placement="home_right_lower" variant="sidebar" />
            </div>

          </div>
        )

      case 'intake_queue':
        return (
          <ExecutiveIntakeList viewMode="secretary" />
        )

      case 'reports':
        return (
          <ExecutiveReportsList viewMode="secretary" />
        )

      case 'alerts':
        return (
          <CriticalAlertsList viewMode="secretary" />
        )

      case 'elections':
        return (
          <div className="space-y-6">

            {currentElection &&
            currentElection.status !== 'finalized' && (
              <div
                className="
                  bg-slate-900
                  border border-slate-800
                  rounded-2xl
                  p-6
                "
              >
                <div className="flex items-start justify-between gap-4">

                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Election Control
                    </h2>

                    <p className="text-slate-400 mt-2">
                      Current Election:
                      {' '}
                      {currentElection.title || 'Untitled'}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      finalizeElection(currentElection.id)
                    }
                    disabled={loading}
                    className="
                      bg-blue-600 hover:bg-blue-700
                      disabled:opacity-50
                      text-white
                      px-4 py-2
                      rounded-lg
                      transition-colors
                    "
                  >
                    {loading
                      ? 'Processing...'
                      : 'Finalize Election'}
                  </button>
                </div>
              </div>
            )}

            <SecretaryDashboard />
          </div>
        )

      case 'proposals':
        return (
          <ProposalManagementPanel viewMode="secretary" />
        )

      case 'neighbors':
        return <NeighborApprovals />

      case 'ads':
        return <CityAdsManager />

      case 'staff':
        return <StaffManagement />

      case 'calendar':
        return <SecretaryCalendar />

      case 'crown_redemptions':
        return <SecretaryCrownRedemptions />

      case 'secretary_dashboard':
        return <SecretaryOwnDashboard />

      case 'coin_liability':
        navigate('/secretary/coin-liability')
        return null

      default:
        return null
    }
  }

  /* ================================
     Render
  ================================ */

  return (
    <div className="min-h-screen bg-[#05010a] text-white flex">

      {/* =====================================
           Sidebar
       ====================================== */}

      <aside
        className="
          w-80
          border-r border-white/10
          bg-[#0A0814]
          flex flex-col
        "
      >

        {/* Header */}
        <div
          className="
            px-6 py-5
            border-b border-white/10
          "
        >
          <div className="flex items-center gap-3">

            <div
              className="
                w-12 h-12
                rounded-xl
                bg-purple-500/10
                border border-purple-500/20
                flex items-center justify-center
              "
            >
              <Shield className="w-6 h-6 text-purple-400" />
            </div>

            <div>
              <h1
                className="
                  text-lg font-bold
                  bg-gradient-to-r
                  from-purple-400
                  to-pink-400
                  bg-clip-text
                  text-transparent
                "
              >
                Executive Operations
              </h1>

              <p className="text-xs text-slate-400 mt-1">
                {profile?.username || user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">

          <div className="space-y-6">

            {navigation.map((group) => (
              <div key={group.id}>

                <div
                  className="
                    flex items-center gap-2
                    px-3 mb-2
                    text-xs font-semibold
                    uppercase tracking-wider
                    text-slate-500
                  "
                >
                  {group.icon}
                  <span>{group.title}</span>
                </div>

                <div className="space-y-1">

                  {group.items.map((item) => {
                    const active =
                      activeView === item.id

                    return (
                      <button
                        key={item.id}
                        onClick={() =>
                          setActiveView(item.id)
                        }
                        className={`
                          w-full
                          flex items-center justify-between
                          px-3 py-2.5
                          rounded-xl
                          transition-all
                          group
                          ${
                            active
                              ? 'bg-purple-600 text-white'
                              : 'text-slate-400 hover:text-white hover:bg-white/5'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          {item.icon}

                          <span className="text-sm font-medium">
                            {item.label}
                          </span>
                        </div>

                        <ChevronRight
                          className="
                            w-4 h-4
                            opacity-40
                            group-hover:opacity-100
                          "
                        />
                      </button>
                    )}
                  )}

                </div>
              </div>
            ))}

          </div>
        </nav>

        {/* Footer */}
        <div
          className="
            border-t border-white/10
            p-4
          "
        >
          <button
            onClick={handleLogout}
            className="
              w-full
              flex items-center justify-center gap-2
              px-4 py-3
              rounded-xl
              bg-red-500/10
              text-red-400
              hover:bg-red-500/20
              transition-colors
            "
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* =====================================
           Main Content
       ====================================== */}

      <main className="flex-1 overflow-y-auto">

        <div className="max-w-7xl mx-auto p-8">
          {renderContent()}
        </div>

      </main>
    </div>
  )
}