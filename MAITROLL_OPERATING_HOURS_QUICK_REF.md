# MaiTroll Operating Hours - Quick Reference

## Schedule
- **Opens**: 10:00 AM America/Chicago
- **Closes**: 2:00 AM America/Chicago
- **Open Duration**: 16 hours
- **Closed Duration**: 8 hours

## Core Files

### Utilities
| File | Purpose |
|------|---------|
| `src/lib/maitrollOperatingHours.ts` | Core timezone calculations and state logic |
| `src/lib/maitrollOperatingStore.ts` | Zustand store for real-time state management |

### Components
| File | Purpose | When Shown |
|------|---------|-----------|
| `SleepingTrollBedroom.tsx` | Bedroom scene with countdown | CLOSED (2 AM - 10 AM) |
| `ClosingWarning.tsx` | Yellow warning notification | CLOSING_SOON (1:55 AM - 2 AM) |
| `TrollWakeUpAnimation.tsx` | Wake-up transition animation | CLOSED → OPEN transition |
| `MaiTrollOperatingHoursWrapper.tsx` | Main orchestrator component | Wrap homepage with this |

### Backend
| File | Type | Purpose |
|------|------|---------|
| `20260901000001_add_maitroll_operating_hours_functions.sql` | Migration | SQL functions for server-side enforcement |

### Hooks
| Hook | Returns | Purpose |
|------|---------|---------|
| `useMaiTrollOperatingHours()` | `{ state, isOpen, countdownToOpen, ... }` | Get current operating hours info |
| `useBroadcastStartCheck()` | `{ allowed, reason, isStaff, ... }` | Check if user can start broadcast |

## Quick Integration

### 1. Wrap Homepage
```tsx
<MaiTrollOperatingHoursWrapper>
  <NormalHomepage />
</MaiTrollOperatingHoursWrapper>
```

### 2. Disable Broadcasts
```tsx
const { allowed, reason } = useBroadcastStartCheck()
<button disabled={!allowed}>{reason}</button>
```

### 3. Show Closing Warning
```tsx
const { isClosingSoon } = useMaiTrollOperatingHours()
{isClosingSoon && <ClosingWarning />}
```

## Operating States

| State | Time | Public UI | Staff UI |
|-------|------|-----------|----------|
| OPEN | 10 AM - 2 AM | Normal homepage | Normal homepage |
| CLOSING_SOON | 1:55 AM - 2 AM | Warning banner + homepage | Warning banner + homepage |
| CLOSED | 2 AM - 10 AM | Sleeping bedroom | Normal homepage |
| STAFF_BYPASS | Always | N/A | Always normal homepage |

## Staff Authorization
Users with 24/7 access:
- `is_admin = true`
- `is_lead_officer = true`
- `is_troll_officer = true`
- `role = 'admin'` OR `role = 'staff'`

## Testing at Key Times

| Time | Expected Behavior |
|------|-------------------|
| 9:00 AM | Bedroom with countdown |
| 9:59 AM | Bedroom with countdown |
| 10:00 AM | Wake-up animation → homepage |
| 10:01 AM | Normal homepage |
| 1:54 AM | Normal homepage |
| 1:55 AM | Closing warning appears |
| 1:59 AM | Closing warning with countdown |
| 2:00 AM | Bedroom appears |
| 3:00 AM | Bedroom (stays until 10 AM) |

## Broadcast Restrictions

| User Type | When | Can Broadcast |
|-----------|------|---------------|
| Public | Open hours (10 AM - 2 AM) | ✅ Yes |
| Public | Closed hours (2 AM - 10 AM) | ❌ No |
| Staff | Any time | ✅ Yes (24/7) |

## Database Functions

```sql
-- Check if open
SELECT is_maitroll_open();

-- Check if user is staff
SELECT is_authorized_maitroll_staff(user_id);

-- Check if user can broadcast
SELECT can_start_broadcast_maitroll(user_id);

-- Get full operating state
SELECT get_maitroll_operating_state(user_id);
```

## Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| Bedroom shows during open hours | Check browser timezone, clear cache, verify store updates |
| Animation doesn't play at 10 AM | Verify store interval is running, check console errors |
| Broadcasts not blocked when closed | Verify SQL migration applied, check RPC function in Supabase |
| Staff bypass not working | Verify user has correct role flags in database |

## Deployment Steps

1. Apply SQL migration
2. Deploy new component files
3. Integrate wrapper in Home page
4. Add broadcast check in SetupPage
5. Test at key times
6. Monitor logs for errors

## Files to Implement

- [x] Core utilities
- [x] State management
- [x] UI components
- [x] SQL functions
- [x] Broadcast check hook
- [ ] Home page integration (user needs to do)
- [ ] SetupPage integration (user needs to do)

## Timezone Notes

- All times use `America/Chicago` timezone
- Automatically handles CST/CDT daylight saving
- Calculations done server-side for authoritative truth
- No reliance on device/browser clock
