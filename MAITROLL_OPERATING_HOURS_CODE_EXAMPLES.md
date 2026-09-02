# MaiTroll Operating Hours - Integration Code Examples

## 1. Wrapping the Homepage

### Example: Integrate with Home.tsx

```tsx
// src/pages/Home.tsx

import React from 'react'
import { MaiTrollOperatingHoursWrapper } from '@/components/maitroll/MaiTrollOperatingHoursWrapper'
import { MaiTrollOperatingState } from '@/lib/maitrollOperatingHours'
import { useAuthStore } from '@/lib/store'

// ... other imports ...

export default function Home() {
  const { user } = useAuthStore()

  const handleOperatingStateChange = (newState: MaiTrollOperatingState) => {
    // Optional: Log state changes for analytics
    console.log('[MaiTroll] Operating state changed to:', newState)

    // Optional: Trigger actions based on state
    switch (newState) {
      case MaiTrollOperatingState.OPEN:
        // MaiTroll just opened - could show announcement, unlock features
        console.log('🌅 MaiTroll is now OPEN!')
        break
      case MaiTrollOperatingState.CLOSING_SOON:
        // Show warning 5 minutes before close
        console.log('⚠️ MaiTroll closing soon!')
        break
      case MaiTrollOperatingState.CLOSED:
        // MaiTroll closed - disable public features
        console.log('🌙 MaiTroll is now closed')
        break
      case MaiTrollOperatingState.STAFF_BYPASS:
        // Staff have 24/7 access
        console.log('👮 Staff mode - full access')
        break
    }
  }

  return (
    <MaiTrollOperatingHoursWrapper onStateChange={handleOperatingStateChange}>
      {/* Your existing homepage content */}
      <div className="min-h-screen bg-gradient-to-b from-dark to-darker">
        {/* Sidebar */}
        <LeftNavSidebar />

        {/* Main content */}
        <div className="pl-16 md:pl-64">
          {/* Your tabs and content */}
          <MainTabContent />

          {/* Featured broadcasts, live grid, etc */}
          <LiveGrid />
          <PromoSlots />
        </div>
      </div>
    </MaiTrollOperatingHoursWrapper>
  )
}
```

## 2. Broadcast Start Permission Check

### Example: Integrate with SetupPage.tsx

```tsx
// src/pages/broadcast/SetupPage.tsx

import React, { useState } from 'react'
import { useBroadcastStartCheck } from '@/hooks/useBroadcastStartCheck'
import { toast } from 'sonner'
import { AlertCircle, Clock } from 'lucide-react'

// ... other imports ...

export function BroadcastSetupPage() {
  const [isStarting, setIsStarting] = useState(false)
  
  // Get broadcast permission status
  const {
    allowed: canBroadcast,
    reason: broadcastReason,
    isStaff,
    isMaiTrollOpen,
    loading: checkingPermission,
    recheck,
  } = useBroadcastStartCheck()

  // ... your other state and handlers ...

  const handleStartBroadcast = async () => {
    // Check if user can broadcast
    if (!canBroadcast) {
      toast.error(broadcastReason)
      return
    }

    setIsStarting(true)

    try {
      // Your existing broadcast start logic
      const result = await startBroadcastWithCapacityCheck({
        title: broadcastTitle,
        category: selectedCategory,
        // ... other settings ...
      })

      if (result.success) {
        navigate(`/broadcast/${result.streamId}`)
      }
    } catch (error) {
      toast.error('Failed to start broadcast')
      console.error('Broadcast start error:', error)
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Start Your Broadcast</h1>

      {/* Permission status indicator */}
      {!canBroadcast && (
        <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-600 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-yellow-200 font-semibold mb-1">
                Cannot Start Broadcast
              </h3>
              <p className="text-yellow-100/70 text-sm mb-3">{broadcastReason}</p>
              {!isMaiTrollOpen && !isStaff && (
                <div className="flex items-center gap-2 text-xs text-yellow-100/60">
                  <Clock className="w-3 h-3" />
                  MaiTroll opens at 10:00 AM America/Chicago
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Optional: Show status for staff */}
      {isStaff && (
        <div className="mb-6 p-4 bg-emerald-900/30 border border-emerald-600 rounded-lg">
          <p className="text-emerald-200 text-sm font-semibold">
            👮 Staff Access: You have 24/7 broadcast privileges
          </p>
        </div>
      )}

      {/* Your existing form fields */}
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-semibold mb-2">Broadcast Title</label>
          <input
            type="text"
            value={broadcastTitle}
            onChange={(e) => setBroadcastTitle(e.target.value)}
            placeholder="What are you broadcasting?"
            className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-semibold mb-2">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5"
          >
            {BROADCAST_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* ... other fields ... */}
      </div>

      {/* Start button */}
      <div className="mt-8 flex gap-3">
        <button
          onClick={handleStartBroadcast}
          disabled={!canBroadcast || isStarting || checkingPermission}
          className={`px-8 py-3 rounded-lg font-bold transition flex items-center gap-2 ${
            canBroadcast && !isStarting && !checkingPermission
              ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
              : 'bg-slate-600 text-slate-300 cursor-not-allowed opacity-50'
          }`}
        >
          {checkingPermission ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Checking...
            </>
          ) : isStarting ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Starting Stream...
            </>
          ) : (
            <>
              🔴 Go Live
            </>
          )}
        </button>

        {/* Manual permission check button */}
        <button
          onClick={() => recheck()}
          disabled={checkingPermission}
          className="px-4 py-3 rounded-lg border border-white/20 text-white hover:bg-white/10 transition font-semibold"
        >
          ↻ Recheck Permission
        </button>
      </div>

      {/* Help text */}
      <div className="mt-6 p-4 bg-slate-900/50 rounded-lg">
        <h3 className="text-sm font-semibold mb-2">📅 MaiTroll Operating Hours</h3>
        <p className="text-xs text-slate-300 mb-2">
          MaiTroll is open 16 hours daily from 10:00 AM to 2:00 AM (America/Chicago timezone).
        </p>
        <p className="text-xs text-slate-400">
          Broadcasts can only be started during operating hours. Staff and authorized users can broadcast 24/7.
        </p>
      </div>
    </div>
  )
}
```

## 3. Show Closing Warning in Active Streams

### Example: Integrate with BroadcastRoom.tsx

```tsx
// src/pages/broadcast/ViewerPage.tsx or your broadcast room component

import React from 'react'
import { useMaiTrollOperatingHours } from '@/lib/maitrollOperatingStore'
import { ClosingWarning } from '@/components/maitroll/ClosingWarning'

export function BroadcastRoom({ streamId, streamerName }) {
  const { isClosingSoon, isOpen } = useMaiTrollOperatingHours()
  const [streamEnded, setStreamEnded] = React.useState(false)

  // Handle when MaiTroll closes
  React.useEffect(() => {
    if (!isOpen && !isClosingSoon) {
      // MaiTroll has closed - handle graceful disconnect
      setStreamEnded(true)
      // Could also disconnect from LiveKit room, show message, etc.
    }
  }, [isOpen, isClosingSoon])

  return (
    <div className="relative h-screen">
      {/* Show closing warning if applicable */}
      {isClosingSoon && (
        <ClosingWarning position="top" dismissible={true} />
      )}

      {/* Main broadcast video */}
      <div className="w-full h-full bg-black">
        {streamEnded ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-6xl mb-4">😴</div>
              <h2 className="text-2xl font-bold text-white mb-2">
                MaiTroll is Sleeping
              </h2>
              <p className="text-slate-300 mb-6">
                This stream has ended for the night.
              </p>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700"
              >
                Back to MaiTroll
              </button>
            </div>
          </div>
        ) : (
          <LiveKitRoom streamId={streamId} />
        )}
      </div>

      {/* Chat, moderation tools, etc */}
      <StreamChat streamId={streamId} />
    </div>
  )
}
```

## 4. Add Operating Hours Status to Header

### Example: Global status indicator

```tsx
// src/components/AppHeader.tsx

import React from 'react'
import { useMaiTrollOperatingHours } from '@/lib/maitrollOperatingStore'
import { MaiTrollOperatingState } from '@/lib/maitrollOperatingHours'

export function AppHeader() {
  const { state, isOpen, countdownToOpen, countdownToClose } = useMaiTrollOperatingHours()

  const getStatusDisplay = () => {
    switch (state) {
      case MaiTrollOperatingState.OPEN:
        return {
          icon: '🟢',
          text: 'Open',
          color: 'text-emerald-400',
          details: `Closing in ${countdownToClose}`,
        }
      case MaiTrollOperatingState.CLOSING_SOON:
        return {
          icon: '🟡',
          text: 'Closing Soon',
          color: 'text-yellow-400',
          details: `${countdownToClose}`,
        }
      case MaiTrollOperatingState.CLOSED:
        return {
          icon: '🔴',
          text: 'Closed',
          color: 'text-red-400',
          details: `Opens in ${countdownToOpen}`,
        }
      case MaiTrollOperatingState.STAFF_BYPASS:
        return {
          icon: '👮',
          text: 'Staff Access',
          color: 'text-blue-400',
          details: 'Full 24/7 access',
        }
      default:
        return {
          icon: '❓',
          text: 'Unknown',
          color: 'text-slate-400',
          details: 'Loading...',
        }
    }
  }

  const status = getStatusDisplay()

  return (
    <header className="border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-950 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo and brand */}
        <div className="flex items-center gap-2">
          <div className="text-2xl font-black text-cyan-400">🧌 MaiTroll</div>
        </div>

        {/* Operating status indicator */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-800/50 border border-white/10">
          <span className="text-2xl">{status.icon}</span>
          <div>
            <p className={`text-sm font-bold ${status.color}`}>{status.text}</p>
            <p className="text-xs text-slate-400 font-mono">{status.details}</p>
          </div>
        </div>

        {/* Navigation and auth */}
        <nav className="flex items-center gap-4">
          {/* Your nav items */}
        </nav>
      </div>
    </header>
  )
}
```

## 5. Advanced: Custom Hook for Operating Hours Logic

### Example: Create a custom hook for your needs

```tsx
// src/hooks/useMaiTrollAccess.ts

import { useMaiTrollOperatingHours } from '@/lib/maitrollOperatingStore'
import { useAuthStore } from '@/lib/store'
import { MaiTrollOperatingState } from '@/lib/maitrollOperatingHours'

export function useMaiTrollAccess() {
  const { profile } = useAuthStore()
  const { state, isOpen } = useMaiTrollOperatingHours()

  const isStaff = !!(
    profile?.is_admin ||
    profile?.is_lead_officer ||
    profile?.is_troll_officer ||
    profile?.role === 'admin' ||
    profile?.role === 'staff'
  )

  return {
    // State info
    state,
    isOpen: isOpen || isStaff,
    isClosed: state === MaiTrollOperatingState.CLOSED,
    isClosingSoon: state === MaiTrollOperatingState.CLOSING_SOON,
    isStaff,
    isStaffBypass: state === MaiTrollOperatingState.STAFF_BYPASS,

    // Permissions
    canBroadcast: isOpen || isStaff,
    canAccessPublicFeatures: isOpen || isStaff,
    canModerate: isStaff,
    canAccessAdmin: isStaff,

    // Display logic
    shouldShowBedroom: state === MaiTrollOperatingState.CLOSED && !isStaff,
    shouldShowWarning: state === MaiTrollOperatingState.CLOSING_SOON,
    shouldShowNormalUI: isOpen || isStaff,
  }
}

// Usage:
function MyComponent() {
  const { canBroadcast, shouldShowBedroom } = useMaiTrollAccess()

  if (shouldShowBedroom) {
    return <SleepingBedroom />
  }

  return canBroadcast ? <GoLiveButton /> : <DisabledBroadcast />
}
```

## 6. Testing/Development: Manual Time Override (For Testing Only)

### Example: Development utility for testing different times

```tsx
// src/lib/developmentTimeOverride.ts
// ⚠️ DEVELOPMENT ONLY - Remove before production

export let DEV_TIME_OVERRIDE: Date | null = null

export function setDevTimeOverride(hours: number, minutes: number = 0) {
  const chicagoTime = new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago',
  })
  const baseDate = new Date(chicagoTime)
  baseDate.setHours(hours, minutes, 0)
  DEV_TIME_OVERRIDE = baseDate
  console.log('[DEV] Time override set to:', baseDate)
}

export function clearDevTimeOverride() {
  DEV_TIME_OVERRIDE = null
  console.log('[DEV] Time override cleared')
}

// Modify maitrollOperatingHours.ts to use override:
export function getChicagoTime(): Date {
  if (DEV_TIME_OVERRIDE) {
    return DEV_TIME_OVERRIDE
  }
  // ... normal implementation
}

// Usage in browser console:
// setDevTimeOverride(9, 59)  // Set to 9:59 AM
// setDevTimeOverride(10, 0)  // Set to 10:00 AM
// setDevTimeOverride(13, 55) // Set to 1:55 AM
// setDevTimeOverride(2, 0)   // Set to 2:00 AM
// clearDevTimeOverride()     // Back to real time
```

## Summary of Integration Points

1. ✅ **Wrap Homepage** - Add `<MaiTrollOperatingHoursWrapper>` around home page
2. ✅ **Check Broadcast** - Add `useBroadcastStartCheck()` in SetupPage
3. ✅ **Show Warning** - Add `<ClosingWarning>` in active stream rooms
4. ✅ **Status Indicator** - Display operating status in header (optional)
5. ✅ **Custom Logic** - Create hooks for specific feature logic (advanced)

All examples follow TrollCity conventions and integrate seamlessly with existing code patterns.
