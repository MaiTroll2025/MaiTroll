# MaiTroll Daily Operating Hours Implementation Guide

## Overview
This document provides complete implementation instructions for the MaiTroll Daily Operating Hours + Sleeping Troll Closed Experience feature.

**Operating Schedule**: 10:00 AM - 2:00 AM (America/Chicago timezone)
**Closed Period**: 2:00 AM - 10:00 AM (America/Chicago timezone)
**Open Duration**: 16 hours/day
**Closed Duration**: 8 hours/day

## Architecture

### Backend Layers
1. **Operating Hours Utilities** (`src/lib/maitrollOperatingHours.ts`)
   - Timezone-aware calculations
   - State determination
   - Countdown calculations
   - Exported for use in frontend and backend

2. **Supabase RPC Functions** (SQL migrations)
   - `is_maitroll_open()` - Checks current operating status
   - `is_authorized_maitroll_staff(user_id)` - Validates staff access
   - `can_start_broadcast_maitroll(user_id)` - Enforces broadcast restrictions
   - `get_maitroll_operating_state(user_id)` - Comprehensive state report

### Frontend Layers
1. **State Management** (`src/lib/maitrollOperatingStore.ts`)
   - Zustand store for operating hours state
   - Real-time updates every 1 second
   - Staff authorization tracking
   - Hook: `useMaiTrollOperatingHours()`

2. **UI Components**
   - `SleepingTrollBedroom.tsx` - Full-screen bedroom scene when closed
   - `ClosingWarning.tsx` - Warning notification when closing soon
   - `TrollWakeUpAnimation.tsx` - Transition animation when opening
   - `MaiTrollOperatingHoursWrapper.tsx` - Main orchestrator component

3. **Hooks**
   - `useBroadcastStartCheck()` - Check if broadcast can be started
   - `useMaiTrollOperatingHours()` - Get current operating hours info

## Integration Steps

### Step 1: Apply Database Migration
```bash
# Option 1: Via Supabase CLI
supabase migration up

# Option 2: Manually in Supabase Console
# Copy contents of: supabase/migrations/20260901000001_add_maitroll_operating_hours_functions.sql
# Paste into Supabase SQL Editor and run
```

### Step 2: Integrate with Home Page

Find your MaiTroll homepage component (likely in `src/pages/Home.tsx` or similar).

Wrap it with the operating hours wrapper:

```tsx
// At top of file
import { MaiTrollOperatingHoursWrapper } from '@/components/maitroll/MaiTrollOperatingHoursWrapper'
import { MaiTrollOperatingState } from '@/lib/maitrollOperatingHours'

// Inside your component
export default function MaiTrollHomepage() {
  const handleOperatingStateChange = (state: MaiTrollOperatingState) => {
    // Optional: Log state changes for analytics
    console.log('[MaiTroll] Operating state changed:', state)
    
    // Optional: Trigger actions based on state
    switch (state) {
      case MaiTrollOperatingState.OPEN:
        // Platform is now open
        break
      case MaiTrollOperatingState.CLOSING_SOON:
        // Notify users
        break
      case MaiTrollOperatingState.CLOSED:
        // Disable user-facing features
        break
    }
  }

  return (
    <MaiTrollOperatingHoursWrapper onStateChange={handleOperatingStateChange}>
      {/* Your existing MaiTroll homepage content */}
      <NormalMaiTrollUI />
    </MaiTrollOperatingHoursWrapper>
  )
}
```

### Step 3: Broadcast Start Prevention

In your broadcast setup page (`src/pages/broadcast/SetupPage.tsx`):

```tsx
// Add import
import { useBroadcastStartCheck } from '@/hooks/useBroadcastStartCheck'

// Inside component
export function BroadcastSetupPage() {
  const { allowed: canBroadcast, reason: broadcastReason, loading } = useBroadcastStartCheck()
  const [showStartError, setShowStartError] = React.useState(false)

  const handleStartBroadcast = async () => {
    // Check permission first
    if (!canBroadcast) {
      setShowStartError(true)
      toast.error(broadcastReason)
      return
    }

    // Proceed with normal broadcast start
    // ... your existing broadcast start logic ...
  }

  return (
    <>
      {/* Your existing UI */}
      
      {/* Add this section */}
      {!canBroadcast && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-4">
          <p className="text-yellow-200 font-semibold">⚠️ Cannot Start Broadcast</p>
          <p className="text-yellow-100/70 text-sm mt-1">{broadcastReason}</p>
        </div>
      )}

      {/* Disable start button when closed */}
      <button
        onClick={handleStartBroadcast}
        disabled={!canBroadcast || loading}
        className={`px-6 py-3 rounded-lg font-bold transition ${
          canBroadcast
            ? 'bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer'
            : 'bg-slate-600 text-slate-300 cursor-not-allowed opacity-50'
        }`}
      >
        {loading ? 'Checking...' : 'Go Live'}
      </button>
    </>
  )
}
```

### Step 4: Active Stream Handling

If you have active broadcast rooms, add the closing warning:

```tsx
// In your broadcast viewer/room component
import { ClosingWarning } from '@/components/maitroll/ClosingWarning'
import { useMaiTrollOperatingHours } from '@/lib/maitrollOperatingStore'

function BroadcastRoom() {
  const { isClosingSoon } = useMaiTrollOperatingHours()

  return (
    <>
      {isClosingSoon && (
        <ClosingWarning position="top" dismissible={true} />
      )}
      
      {/* Your existing broadcast room content */}
    </>
  )
}
```

### Step 5: Optional - Add to App Root

For global operating hours display, you can add a small indicator to your app header:

```tsx
import { useMaiTrollOperatingHours } from '@/lib/maitrollOperatingStore'

function AppHeader() {
  const { state, countdownToOpen, isOpen } = useMaiTrollOperatingHours()

  return (
    <header>
      {/* Your existing header content */}
      
      {/* Status indicator (optional) */}
      <div className="text-xs font-mono text-right">
        {isOpen ? (
          <span className="text-green-400">🟢 Open</span>
        ) : (
          <span className="text-red-400">🔴 Closed - Opens: {countdownToOpen}</span>
        )}
      </div>
    </header>
  )
}
```

## API Reference

### Operating Hours Utilities
```typescript
// Check if MaiTroll is open
import { isMaiTrollOpen, getChicagoTime } from '@/lib/maitrollOperatingHours'

const currentTime = getChicagoTime()
if (isMaiTrollOpen(currentTime)) {
  // MaiTroll is open
}

// Get complete operating info
import { getOperatingHoursInfo } from '@/lib/maitrollOperatingHours'

const info = getOperatingHoursInfo(currentTime, isStaff)
// Returns: { state, isOpen, isClosingSoon, secondsUntilOpen, countdownToOpen, ... }
```

### Supabase RPC Functions
```typescript
// Check if user can start broadcast
const { data, error } = await supabase.rpc('can_start_broadcast_maitroll', {
  user_id: userId
})

if (data?.allowed) {
  // User can broadcast
}

// Get operating state for user
const { data: state } = await supabase.rpc('get_maitroll_operating_state', {
  user_id: userId
})

console.log(state.state) // 'OPEN' | 'CLOSED' | 'CLOSING_SOON' | 'STAFF_BYPASS'
```

### React Hooks
```typescript
// Use operating hours info
import { useMaiTrollOperatingHours } from '@/lib/maitrollOperatingStore'

function MyComponent() {
  const {
    state,                 // 'OPEN' | 'CLOSED' | 'CLOSING_SOON' | 'STAFF_BYPASS'
    isOpen,               // boolean
    isClosed,             // boolean
    isClosingSoon,        // boolean
    countdownToOpen,      // "HH:MM:SS"
    countdownToClose,     // "HH:MM:SS"
    operatingHoursInfo    // Full info object
  } = useMaiTrollOperatingHours()

  return <div>{state}</div>
}

// Check broadcast permission
import { useBroadcastStartCheck } from '@/hooks/useBroadcastStartCheck'

function BroadcastSetup() {
  const {
    allowed,              // boolean
    reason,              // string message
    isStaff,             // boolean
    isMaiTrollOpen,      // boolean
    loading,             // boolean
    recheck              // () => void for manual refresh
  } = useBroadcastStartCheck()

  return allowed ? <GoLiveButton /> : <ClosedNotice message={reason} />
}
```

## Testing Guide

### Manual Testing

#### Test 1: Closed Period (2:00 AM - 10:00 AM)
1. Access MaiTroll when closed
2. **Expected**: See Sleeping Troll bedroom with countdown
3. **Verify**: Countdown updates every second
4. **Verify**: Branding message displays correctly

#### Test 2: Opening Transition (10:00 AM)
1. Keep page open until 10:00 AM
2. **Expected**: Wake-up animation plays (~3 seconds)
3. **Expected**: Animation completes and transitions to normal homepage
4. **Verify**: No manual refresh needed

#### Test 3: Closing Warning (1:55 AM - 2:00 AM)
1. Keep page open until 1:55 AM
2. **Expected**: Yellow warning banner appears
3. **Expected**: Shows countdown to closing
4. **Verify**: Can dismiss warning (still on normal homepage)
5. At 2:00 AM: **Expected** Transitioned to bedroom

#### Test 4: Broadcast Restriction
1. As public user, try to start broadcast at 3:00 AM
2. **Expected**: "Go Live" button disabled or shows error
3. **Expected**: Error message explains MaiTroll is closed
4. At 10:00 AM: **Expected** Button becomes enabled

#### Test 5: Staff Bypass
1. Log in as admin/lead officer/troll officer
2. **Expected**: Can access normal homepage at any time
3. **Expected**: Can start broadcasts at any time
4. **Expected**: No sleeping bedroom ever appears

### Automated Testing

```typescript
// Example test using Vitest
import { describe, it, expect } from 'vitest'
import {
  isMaiTrollOpen,
  getMaiTrollOperatingState,
  formatCountdown,
  getSecondsUntilOpen,
  MaiTrollOperatingState,
} from '@/lib/maitrollOperatingHours'

describe('MaiTroll Operating Hours', () => {
  it('should correctly identify open hours', () => {
    // Mock: 10:30 AM Chicago time
    const openTime = new Date('2026-09-01T10:30:00').toLocaleString('en-US', {
      timeZone: 'America/Chicago',
    })
    const mockDate = new Date(openTime)
    
    expect(isMaiTrollOpen(mockDate)).toBe(true)
  })

  it('should correctly identify closed hours', () => {
    // Mock: 3:00 AM Chicago time
    const closedTime = new Date('2026-09-01T03:00:00').toLocaleString('en-US', {
      timeZone: 'America/Chicago',
    })
    const mockDate = new Date(closedTime)
    
    expect(isMaiTrollOpen(mockDate)).toBe(false)
  })

  it('should format countdown correctly', () => {
    expect(formatCountdown(3661)).toBe('01:01:01') // 1 hour, 1 minute, 1 second
    expect(formatCountdown(123)).toBe('00:02:03') // 2 minutes, 3 seconds
  })

  it('should handle staff bypass', () => {
    const state = getMaiTrollOperatingState(undefined, true)
    expect(state).toBe(MaiTrollOperatingState.STAFF_BYPASS)
  })
})
```

## Troubleshooting

### Issue: Bedroom appears during open hours
**Cause**: Operating hours check is using local device time instead of server time
**Solution**: 
- Check browser console for timezone errors
- Verify Supabase connection is active
- Clear browser cache and reload
- Check that `maitrollOperatingStore.ts` is properly initializing

### Issue: Wake-up animation doesn't play
**Cause**: Component not detecting state change from CLOSED → OPEN
**Solution**:
- Verify store update interval is set (should be every 1 second)
- Check browser console for animation errors
- Ensure `operatingHoursInfo` is being updated in store
- Test state manually: `getMaiTrollOperatingState(getChicagoTime())`

### Issue: Broadcast starts when MaiTroll is closed
**Cause**: Frontend check passed but backend didn't enforce
**Solution**:
- Verify SQL migration was applied correctly
- Test `can_start_broadcast_maitroll()` directly in Supabase SQL Editor
- Ensure broadcast start calls the RPC function for authorization
- Check server logs for errors

### Issue: Staff bypass not working
**Cause**: User role not recognized
**Solution**:
- Verify user profile has correct role flag:
  - `is_admin = true` OR
  - `is_lead_officer = true` OR
  - `is_troll_officer = true` OR
  - `role = 'admin'` OR `role = 'staff'`
- Check SQL function: `SELECT is_authorized_maitroll_staff(user_id)`

## Performance Considerations

### Frontend
- Store updates throttled to max 1 per 100ms
- Countdown calculations optimized
- Animations use CSS for 60fps performance
- No continuous polling of Supabase (interval-based updates)

### Backend
- SQL functions are STABLE (cached by Postgres)
- No complex joins or subqueries
- RPC calls return immediately
- Timezone calculations done server-side (authoritative)

### Optimization Tips
- Lazy load `SleepingTrollBedroom` component if on slow networks
- Debounce `useBroadcastStartCheck().recheck()` if called frequently
- Consider caching broadcast permission check results (with 30-second TTL)

## Maintenance & Monitoring

### Monitoring Checklist
- [ ] Monitor Supabase function execution times
- [ ] Track state change events for analytics
- [ ] Monitor broadcast start success/failure rates
- [ ] Check error logs for timezone-related issues
- [ ] Verify DST transitions work correctly

### DST Transition (Spring Forward / Fall Back)
- No special handling needed - uses `America/Chicago` IANA timezone
- Postgres automatically handles DST rules
- Frontend calculations use browser's locale-based conversion

## Future Enhancements

1. **Configurable Hours**: Allow admin to adjust opening/closing times
2. **Announcement System**: Show maintenance messages during closed period
3. **Queue System**: Let users queue to enter at next opening
4. **Analytics**: Track peak usage times and optimize infrastructure
5. **Gradual Wind-Down**: 15-minute warning before closing
6. **Maintenance Mode**: Separate "under maintenance" state
7. **Event Scheduling**: Allow special extended hours for events

## Support & Questions

For issues or questions:
1. Check troubleshooting section above
2. Review console logs for error messages
3. Test `getOperatingHoursInfo()` directly in browser console
4. Verify SQL functions exist in Supabase
5. Check that all files are properly imported

## Deployment Checklist

- [ ] Apply SQL migration to production Supabase
- [ ] Deploy new component files to production
- [ ] Test operating hours at key times on production
- [ ] Verify staff bypass works for admins
- [ ] Monitor broadcast start success rate
- [ ] Check analytics for state transitions
- [ ] Communicate opening schedule to users
- [ ] Monitor timezone handling around DST changes
