# MAI Network Switcher - Deployment Guide

## ✅ What Was Built

**`MaiNetworkSwitcher.tsx`** - Universal React component for all MAI platforms:
- Mobile bottom sheet (framer-motion spring animation)
- Config-driven app list (no hardcoded UI)
- Per-app theming (city/premium/corporate/auto/health/food/payments)
- Status badges (Live/Beta/Coming Soon)
- External store links (Google Play / App Store)
- Sign-in prompt for unauthenticated users
- Platform-specific branding (Mai Troll neon, MaiPlay red/gold, MaiCorp slate)

**File location:** `src/components/mai-network/`

---

## 🚀 Deploy to Another MAI App (e.g., MaiPlay)

### Step 1: Copy Files

```bash
# From Mai Troll project
cp -r src/components/mai-network /path/to/MaiPlay/src/components/
```

### Step 2: Install Dependencies

```bash
cd /path/to/MaiPlay
npm install framer-motion lucide-react
```

### Step 3: Add Supabase Auth (Shared Across MAI)

**Use the SAME Supabase project as Mai Troll** for unified login.

In MaiPlay's `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co'  // Same as Mai Troll
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY'                // Same as Mai Troll

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
```

### Step 4: Add Provider (if using Zustand)

If MaiPlay uses Zustand (like Mai Troll):

```typescript
// src/lib/store.ts
import { create } from 'zustand'
import { supabase } from './supabase'

interface AuthState {
  user: any
  isLoading: boolean
  setUser: (user: any) => void
  setIsLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setIsLoading: (isLoading) => set({ isLoading }),
}))
```

### Step 5: Integrate into Home Page

```tsx
// src/pages/Home.tsx (or equivalent)
import MaiNetworkSwitcher from '@/components/mai-network/MaiNetworkSwitcher'
import { useState } from 'react'

export default function Home() {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false)

  return (
    <div className="mobile-home">
      {/* Your existing header content */}
      
      {/* Add MAI Apps button - CTA on mobile */}
      <div className="mt-4 px-4 md:hidden">
        <button
          onClick={() => setIsSwitcherOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-600 to-yellow-500 text-white font-bold rounded-xl"
        >
          MAI Apps
        </button>
      </div>

      {/* Rest of home page content */}
      
      {/* Overlay - placed at end of page */}
      <MaiNetworkSwitcher
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
        platformTheme="maiplay"  // ← Change per platform
      />
    </div>
  )
}
```

### Step 6: Customize Theme (Optional)

**For MaiPlay** - edit `MaiNetworkSwitcher.tsx` → `getPlatformTheme()`:

```typescript
'maicorp': {
  primaryGradient: 'from-slate-600 via-zinc-600 to-neutral-500',
  accentColor: 'text-slate-300',
  buttonGlow: 'shadow-[0_0_30px_rgba(100,116,139,0.4)]',
},
```

Or customize the CTA button color directly in your Home page using MaiPlay's brand colors (red/gold).

### Step 7: Add Custom Apps (Optional)

```tsx
<MaiNetworkSwitcher
  apps={[
    {
      id: 'troll-city',
      name: 'Mai Troll',
      tagline: 'Go live, earn coins',
      category: 'Live Social',
      websiteUrl: 'https://maiMai Troll.com',
      status: 'live',
      theme: 'city'
    },
    // Add your app-specific custom apps here
  ]}
  platformTheme="maiplay"
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
/>
```

---

## 🔐 Shared Auth Setup (One-Time in Supabase)

All MAI apps must point to the **same Supabase project** and have these settings:

### In Supabase Dashboard → Authentication → URL Configuration

```
Site URL: https://maiMai Troll.com  (or your primary domain)

Redirect URLs (add ALL):
  https://maiMai Troll.com/*
  https://maiplay.cloud/*
  https://maicorp.online/*
  https://udryveauto.com/*
  https://udryvehealth.com/*
  https://udryvefood.com/*
  https://maipay.app/*
  http://localhost:5173/*  (dev only)
```

### In Supabase Dashboard → Settings → API → Configuration

**Allowed CORS origins:**
```
https://maiMai Troll.com
https://maiplay.cloud
https://maicorp.online
https://udryveauto.com
https://udryvehealth.com
https://udryvefood.com
https://maipay.app
```

---

## 📱 Platform Theme Reference

| Platform | `platformTheme` prop | Button Gradient | Accent |
|----------|--------------------|-----------------|--------|
| Mai Troll | `"troll-city"` | purple → pink → cyan | cyan |
| MaiPlay | `"maiplay"` | red → rose → gold | gold |
| MaiCorp | `"maicorp"` | slate → zinc → neutral | slate |
| UDryve Auto | `"default"` + auto theme cards | customizable | blue |
| UDryve Health | `"default"` + health theme cards | customizable | emerald |
| UDryve Food | `"default"` + food theme cards | customizable | orange |
| MaiPay | `"default"` + payments theme cards | customizable | green |

**Set per-app card theme** in the `apps` config array using the `theme` field:

```typescript
{
  id: 'maiplay',
  name: 'MaiPlay',
  theme: 'premium'  // This sets the card's icon color
}
```

---

## 🧪 Testing Checklist

- [ ] Component renders without errors
- [ ] Mobile bottom sheet slides up smoothly
- [ ] Tap outside → closes drawer
- [ ] All app cards visible and sorted by status
- [ ] Website buttons open in new tab (`target="_blank"`)
- [ ] Store buttons show only if URL provided
- [ ] "Coming Soon" buttons disabled when store URLs missing
- [ ] Sign-in prompt appears when `user` is null/undefined
- [ ] After login, sign-in prompt hides
- [ ] Safe-area padding works on iPhone (notch)
- [ ] Theme colors match platform branding
- [ ] No console errors/warnings

---

## 📂 File Structure to Copy

```
mai-network/
├── MaiNetworkSwitcher.tsx   (420 lines - main component)
├── index.ts                 ( barrel export )
└── README.md               (documentation)
```

**Tip:** Keep these 3 files together in every MAI project under `src/components/mai-network/`.

---

## 🐛 Troubleshooting

**"Cannot find module '@/lib/store'"**
→ MaiNetworkSwitcher tries to import Mai Troll's auth store. Pass `user` and `onSignIn` as props instead:
```tsx
<MaiNetworkSwitcher user={user} onSignIn={signIn} ... />
```

**"Module not found: Can't resolve 'framer-motion'"**
→ `npm install framer-motion`

**"Module not found: Can't resolve 'lucide-react'"**
→ `npm install lucide-react`

**Auth doesn't persist across apps**
→ Verify all apps use the SAME Supabase project (same URL + anon key). Check Redirect URLs in Supabase include all domains.

**CORS errors**
→ Add your app's domain to Supabase CORS allowed origins (Settings → API → Configuration).

---

## 🎯 Quick Copy-Paste Summary

**In your Home page:**
```tsx
const [isOpen, setIsOpen] = useState(false)

return (
  <>
    {/* Mobile CTA button */}
    <button onClick={() => setIsOpen(true)} className="...">
      MAI Apps
    </button>

    {/* Overlay */}
    <MaiNetworkSwitcher
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      platformTheme="your-platform"
      user={user}              // optional - from your auth store
      onSignIn={handleSignIn}  // optional - your sign-in function
    />
  </>
)
```

**Supabase shared config (must be identical everywhere):**
```typescript
const supabase = createClient(
  'https://YOUR-PROJECT.supabase.co',
  'YOUR-ANON-KEY',
  { auth: { persistSession: true } }
)
```

---

✅ **You're ready. Copy folder to each MAI app, set platformTheme prop, ensure Supabase shared config.**
