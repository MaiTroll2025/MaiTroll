# MAI Network App Switcher

Universal component for switching between all MAI platform apps. Works across Mai Troll, MaiPlay, MaiCorp, UDryve (Auto/Health/Food), MaiPay, and future MAI applications.

## Features

- ✅ **Mobile-first bottom sheet** design matching each platform's theme
- ✅ **Universal config-driven** - Add new apps by updating the config array only
- ✅ **Unified authentication** - Users sign in once, access all MAI apps
- ✅ **External links** - All store links open safely in new tabs
- ✅ **Platform theming** - Automatically matches Mai Troll (neon), MaiPlay (red/gold), MaiCorp (corporate), etc.
- ✅ **Status badges** - Live / Beta / Coming Soon states
- ✅ **Responsive** - Mobile bottom sheet, desktop-ready for future header dropdown

---

## Installation

### Step 1: Copy Files

Copy the entire `src/components/mai-network/` folder to your project:

```
your-project/
└── src/
    └── components/
        └── mai-network/
            ├── MaiNetworkSwitcher.tsx
            └── README.md  (this file)
```

### Step 2: Install Dependencies

Ensure you have these dependencies in your `package.json`:

```json
{
  "dependencies": {
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.400.0",
    "react": "^18.0.0",
    "react-router-dom": "^6.0.0"
  }
}
```

Run:
```bash
npm install
```

### Step 3: Add Supabase Auth (Shared Across All MAI Apps)

**All MAI apps MUST use the same Supabase project** for unified login.

In `src/lib/supabase.ts` (create if missing):

```typescript
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})
```

### Step 4: Configure Supabase Cross-Domain Auth

In your **Supabase Dashboard** → **Authentication** → **URL Configuration**:

**Site URL:**
```
https://maiMai Troll.com  (or your primary domain)
```

**Redirect URLs** (add ALL MAI domains):
```
https://maiMai Troll.com/*
https://maiplay.cloud/*
https://maicorp.online/*
https://udryveauto.com/*
https://udryvehealth.com/*
https://udryvefood.com/*
https://maipay.app/*
http://localhost:5173/*  (development only)
```

**Allowed CORS origins** (Settings → API → Configuration):
```
https://maiMai Troll.com
https://maiplay.cloud
https://maicorp.online
https://udryveauto.com
https://udryvehealth.com
https://udryvefood.com
https://maipay.app
```

### Step 5: Add User Profile Store

If your project uses Zustand for auth state (like Mai Troll), ensure you have:

```typescript
// src/lib/store.ts (or similar)
import { create } from 'zustand'

interface UserProfile {
  id: string
  username: string
  avatar_url: string | null
  // ... your existing profile fields
}

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  setUser: (user: UserProfile | null) => void
  setIsLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setIsLoading: (isLoading) => set({ isLoading }),
}))
```

---

## Usage

### Basic Integration (Home Page)

```tsx
import MaiNetworkSwitcher from '@/components/mai-network/MaiNetworkSwitcher'
import { useState } from 'react'

export default function Home() {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false)

  return (
    <div>
      {/* Add this button to your mobile header */}
      <button
        onClick={() => setIsSwitcherOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl"
      >
        MAI Apps
      </button>

      {/* Add the overlay component at the end of your page */}
      <MaiNetworkSwitcher
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
        platformTheme="troll-city"  // or 'maiplay', 'maicorp', 'default'
      />
    </div>
  )
}
```

### Custom App Configuration

Override the default app list:

```tsx
import MaiNetworkSwitcher, { MaiApp } from '@/components/mai-network/MaiNetworkSwitcher'

const myCustomApps: MaiApp[] = [
  {
    id: 'my-custom-app',
    name: 'My App',
    tagline: 'Short description',
    category: 'Category',
    websiteUrl: 'https://myapp.com',
    googlePlayUrl: 'https://play.google.com/store/apps/...',
    appleStoreUrl: 'https://apps.apple.com/app/...',
    status: 'live',
    theme: 'default'
  }
]

<MaiNetworkSwitcher
  apps={myCustomApps}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  platformTheme="default"
/>
```

### Platform Theme Mapping

| `platformTheme` prop | Used For | Colors |
|---------------------|----------|--------|
| `'troll-city'` | Mai Troll | Purple → Pink → Cyan neon |
| `'maiplay'` | MaiPlay | Red → Rose → Gold |
| `'maicorp'` | MaiCorp | Slate → Zinc → Neutral |
| `'default'` | Fallback | Purple → Pink → Cyan (generic MAI) |

---

## App Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (no spaces) |
| `name` | `string` | Display name |
| `tagline` | `string` | Short description (1-2 lines) |
| `category` | `string` | App category (e.g., "Live Social City") |
| `websiteUrl` | `string` | Full URL to website (required) |
| `googlePlayUrl` | `string?` | Google Play Store URL (optional) |
| `appleStoreUrl` | `string?` | Apple App Store URL (optional) |
| `status` | `'live' \| 'beta' \| 'coming_soon'` | App availability status |
| `theme` | `AppTheme` | Per-app icon theme (matches card accent color) |
| `icon` | `ReactNode?` | Custom icon override (optional) |

---

## Universal Auth Flow

```
User Journey:
  1. User signs into ANY MAI app (e.g., Mai Troll)
  2. Supabase creates session stored in browser
  3. User visits MaiNetworkSwitcher → sees all apps + sign-in prompt if not logged in
  4. User clicks MaiPlay card → opens https://maiplay.cloud
  5. MaiPlay reads Supabase session cookie → user is automatically logged in
  6. Same wallet, same profile, same coins across all platforms
```

### Requirements for Shared Auth

1. **All apps MUST use the same Supabase project** (same URL + anon key)
2. **Redirect URLs configured** in Supabase for every domain
3. **CORS origins whitelisted** in Supabase settings
4. **Shared `user_profiles` table** - all apps query the same DB
5. **Consistent auth client config** - same `persistSession: true`

---

## File Structure

```
mai-network/
├── MaiNetworkSwitcher.tsx   # Main component (copy this file)
└── README.md               # Documentation (this file)
```

---

## Customization Examples

### Change Button Text (Mai Troll → "Network")
```tsx
// In Home.tsx
<button>
  <span>Network</span>  {/* Change "MAI Apps" to "Network" */}
</button>
```

### Modify Theme Colors per Platform

Edit `getPlatformTheme()` inside `MaiNetworkSwitcher.tsx`:

```typescript
const getPlatformTheme = (platform: PlatformTheme) => ({
  'maiplay': {
    primaryGradient: 'from-red-600 via-orange-600 to-yellow-500',  // custom colors
    accentColor: 'text-orange-400',
    buttonGlow: 'shadow-[0_0_30px_rgba(251,191,36,0.4)]',
  }
  // ...
})
```

### Add New MAI App to Default List

Edit `DEFAULT_MAI_APPS` array at the top of the file:

```typescript
{
  id: 'newapp',
  name: 'New MAI App',
  tagline: 'What it does',
  category: 'Category',
  websiteUrl: 'https://newapp.com',
  googlePlayUrl: '...',
  appleStoreUrl: '...',
  status: 'coming_soon',
  theme: 'default'
}
```

---

## Testing

1. **Mobile**: Open dev tools → toggle device toolbar → test bottom sheet animation
2. **Auth flow**: 
   - Sign in on Mai Troll
   - Open Network Switcher → should show "Sign in with Google" hidden (user logged in)
   - Click any app card → opens in new tab
   - Verify that the target app recognizes the session
3. **Store buttons**: Only show if URL provided; disabled if `status === 'coming_soon'`
4. **External links**: All should open `target="_blank"` with `rel="noopener noreferrer"`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Apps not sharing login | Check Supabase redirect URLs include all domains |
| CORS errors | Add domains to Supabase CORS allowlist |
| Component not rendering | Verify `isOpen` state is passed correctly |
| Styling mismatch | Ensure Tailwind CSS is configured with `backdropBlur` and `boxShadow` |
| Icons missing | Install `lucide-react` package |

---

## License

Part of the MAI ecosystem. Copy freely to all MAI platforms.
