# MaiTroll Operating Hours - Development Testing Guide

## Overview

The MaiTroll operating hours system is now live in development. This guide explains how to test the various scenarios, especially the **1:59 AM closing warning**.

---

## Quick Start: Testing 1:59 AM Closing Warning

### Step 1: Open Browser Console

1. Open your browser (Chrome, Firefox, Safari, Edge)
2. Press **F12** to open Developer Tools
3. Click the **Console** tab

### Step 2: Enable Time Override

Copy and paste this into the console to simulate **1:59 AM and 55 seconds** (5 seconds before closing):

```javascript
window.__MAITROLL_DEV = { timeOverride: new Date(2026, 8, 1, 1, 59, 55) }
```

Then press **Enter**.

### Step 3: Observe the Closing Warning

Within 1-2 seconds, you should see:

- **Yellow/orange warning banner** appears at the top of the page
- Banner shows: **"🧌 MaiTroll is Going to Bed Soon"**
- **Countdown timer** displays: **00:05** (5 seconds remaining)
- Banner becomes **non-dismissible** at the final minute
- Warning message: **"The trolls have less than a minute before bedtime"**

### Step 4: Watch Countdown

- Refresh the page or wait
- Countdown ticks down: `00:04`, `00:03`, `00:02`, `00:01`, `00:00`
- At exactly `00:00`, the banner disappears and the **Sleeping Troll Bedroom** appears

---

## All Test Scenarios

### Scenario 1: 10:00 AM (Opening Time)

```javascript
window.__MAITROLL_DEV = { timeOverride: new Date(2026, 8, 1, 10, 0, 0) }
```

**Expected Result:**
- Normal homepage appears
- No warning, no bedroom
- If you just transitioned from CLOSED to OPEN, you'll see **wake-up animation** (3 seconds)

---

### Scenario 2: 1:55 AM (Closing Warning Starts)

```javascript
window.__MAITROLL_DEV = { timeOverride: new Date(2026, 8, 1, 1, 55, 0) }
```

**Expected Result:**
- Yellow warning banner appears
- Countdown shows `05:00` (5 minutes remaining)
- Banner is **dismissible** (X button visible in corner)
- Homepage content still visible behind banner

---

### Scenario 3: 1:59 AM (Final Minute - Non-Dismissible)

```javascript
window.__MAITROLL_DEV = { timeOverride: new Date(2026, 8, 1, 1, 59, 0) }
```

**Expected Result:**
- Warning banner is **RED and PULSING** (more urgent)
- Message changes to: **"⚠️ MaiTroll is closing now. Finish up and prepare for bedtime."**
- **X button is hidden** (cannot dismiss in final minute)
- Countdown shows `00:60` initially, then counts down

---

### Scenario 4: 2:00 AM (Closing Time)

```javascript
window.__MAITROLL_DEV = { timeOverride: new Date(2026, 8, 1, 2, 0, 0) }
```

**Expected Result:**
- Warning banner disappears
- **Full-screen Sleeping Troll Bedroom** appears
- Shows:
  - Dark cyberpunk gradient background
  - Sleeping troll character (blue/cyan)
  - Floating Z's with animation
  - Countdown to next opening (8+ hours)
  - Message: "🧌 MaiTroll is Sleeping..."

---

### Scenario 5: 9:00 AM (Closed - Morning)

```javascript
window.__MAITROLL_DEV = { timeOverride: new Date(2026, 8, 1, 9, 0, 0) }
```

**Expected Result:**
- Sleeping Troll Bedroom shown (full screen)
- Countdown shows approximately `01:00:00` (1 hour until opening)

---

### Scenario 6: 9:59 AM (Almost Opening)

```javascript
window.__MAITROLL_DEV = { timeOverride: new Date(2026, 8, 1, 9, 59, 0) }
```

**Expected Result:**
- Sleeping Troll Bedroom shown
- Countdown shows approximately `00:01:00` (1 minute until opening)

---

### Scenario 7: Noon (Middle of Day - Open)

```javascript
window.__MAITROLL_DEV = { timeOverride: new Date(2026, 8, 1, 12, 0, 0) }
```

**Expected Result:**
- Normal homepage
- No warning, no bedroom
- Countdown to close shows approximately `14:00:00` (14 hours)

---

## Clear Time Override (Reset to Real Time)

When done testing, paste this into the console to go back to real time:

```javascript
window.__MAITROLL_DEV = null
```

Or simply refresh the page and the override will be cleared.

---

## Key Test Checkpoints

| Time | Component | Status | Details |
|------|-----------|--------|---------|
| 9:59 AM | Bedroom | ✅ Showing | Countdown < 1 min |
| 10:00 AM | Animation | ✅ Plays | 3-second transition |
| 10:01 AM | Homepage | ✅ Showing | Normal UI |
| 1:54 AM | Homepage | ✅ Showing | No warning yet |
| 1:55 AM | Warning | ✅ Shows | Dismissible banner |
| 1:59 AM | Warning | ✅ Shows | Non-dismissible, red |
| 2:00 AM | Bedroom | ✅ Showing | Countdown to open |
| 3:00 AM | Bedroom | ✅ Showing | Staff bypass works |

---

## Staff Bypass Testing

To test staff access:

1. Make sure your account has one of these flags set to `true` in `user_profiles`:
   - `is_admin = true`
   - `is_lead_officer = true`
   - `is_troll_officer = true`
   - `role = 'admin'`

2. Set time to closing: `window.__MAITROLL_DEV = { timeOverride: new Date(2026, 8, 1, 2, 0, 0) }`

3. **Expected Result:** Homepage shows normally (no bedroom, no warning)
   - Staff **always** see normal UI regardless of time

---

## Browser Console Tips

- Use **Up Arrow** to repeat previous commands
- Use **Ctrl+L** to clear console history
- Copy/paste directly into console

---

## Debugging

### If Warning Doesn't Appear at 1:59 AM

1. Check browser console for errors: `F12` → `Console` tab
2. Verify time override is set: `window.__MAITROLL_DEV`
3. Refresh page: `F5` or `Ctrl+R`
4. Check that you're logged in (not staff-only issue)

### If Bedroom Shows at 10:00 AM

1. You may have just transitioned from CLOSED state
2. Wait for 3-second wake-up animation to complete
3. After animation, homepage should appear
4. If stuck, refresh page

### If Homepage Shows at 2:00 AM

1. You're likely a staff member (check profile flags)
2. Staff always see homepage (this is correct!)
3. To test non-staff behavior, create a test account without staff roles

---

## Real-Time Testing

Once integrated into the actual homepage, you can also test:

- Set time to `1:55 AM` → dismiss warning → refresh → warning reappears
- Set time to `1:59 AM` → cannot dismiss warning (button hidden)
- Set time to `1:59:59` → set to `2:00:00` → watch transition to bedroom
- Multiple rapid time changes to verify state consistency

---

## Performance Notes

- Store updates happen every 1 second (throttled)
- No excessive re-renders
- Countdown updates smoothly
- All animations use CSS for 60fps performance

---

## Questions?

Refer to these files for implementation details:
- `src/lib/maitrollOperatingHours.ts` - Core logic
- `src/lib/maitrollOperatingStore.ts` - State management
- `src/components/maitroll/ClosingWarning.tsx` - Warning component
- `src/components/maitroll/SleepingTrollBedroom.tsx` - Bedroom component
- `src/components/maitroll/MaiTrollOperatingHoursWrapper.tsx` - Orchestrator
