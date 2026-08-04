# Integration Examples - How to Add InstallButton

## Example 1: Auth.tsx (Login/Signup Page)

### Before (Old Code):
```tsx
import React, { useState } from 'react'
import { Mail, Lock, User } from 'lucide-react'

const Auth = () => {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState<boolean>(() => {
    try { return localStorage.getItem('pwa-installed') === 'true' } catch { return false }
  })
  
  // ... rest of component

  return (
    // ... form fields ...
    
    {installPrompt && !installed && (
      <div className="mt-6">
        <div className="text-xs text-gray-400 mb-2 text-center">
          Install the app now.
        </div>
        <button
          className="w-full py-3 bg-[#22c55e] text-black font-semibold rounded-lg"
          onClick={async () => {
            await installPrompt.prompt()
            const choice = await installPrompt.userChoice
            if (choice?.outcome === 'accepted') {
              setInstalled(true)
              setInstallPrompt(null)
            }
          }}
        >
          Install App
        </button>
      </div>
    )}
  )
}
```

### After (New Code):
```tsx
import React, { useState } from 'react'
import { Mail, Lock, User } from 'lucide-react'
import InstallButton from '../components/InstallButton'  // ← ADD THIS

const Auth = () => {
  // ← REMOVE installPrompt and installed state
  
  // ... rest of component

  return (
    // ... form fields ...
    
    {/* PWA Install Button */}  {/* ← REPLACE OLD CODE WITH THIS */}
    <div className="mt-6">
      <div className="text-xs text-gray-400 mb-2 text-center">
        Install the app now. You'll use the same login on web and app.
      </div>
      <InstallButton 
        className="w-full py-3"
        text="Install App"
        hideWhenInstalled={false}
        showInstalledBadge={true}
      />
    </div>
  )
}
```

### Changes Made:
1. ✅ Import `InstallButton` component
2. ✅ Remove `installPrompt` state
3. ✅ Remove `installed` state
4. ✅ Replace conditional button with `<InstallButton />`
5. ✅ Configure props: `hideWhenInstalled={false}` and `showInstalledBadge={true}`

---

## Example 2: LivePage.tsx (Desktop Install Button)

### Before (Old Code):
```tsx
{/* Desktop only install button */}
<button
  onClick={() => toast.info('Coming soon!')}
  className="hidden lg:flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all"
>
  <Download size={16} />
  Install App
</button>
```

### After (New Code):
```tsx
import InstallButton from '../components/InstallButton'  // ← ADD THIS AT TOP

{/* Desktop install button with full functionality */}
<div className="hidden lg:block">
  <InstallButton 
    compact={false}
    text="Install App"
    className="px-3 py-2"
  />
</div>
```

### Changes Made:
1. ✅ Import `InstallButton` component
2. ✅ Replace placeholder button with `<InstallButton />`
3. ✅ Keep `hidden lg:block` wrapper for desktop-only display
4. ✅ Maintain similar styling with `className="px-3 py-2"`

---

## Example 3: Header/Navbar (Always Visible)

### Add to Your Header Component:
```tsx
import InstallButton from '../components/InstallButton'

function Header() {
  return (
    <header className="flex items-center justify-between p-4">
      <Logo />
      
      <div className="flex items-center gap-4">
        <SearchBar />
        <NotificationBell />
        
        {/* Install button - hides when installed */}
        <InstallButton compact />
        
        <ProfileMenu />
      </div>
    </header>
  )
}
```

---

## Example 4: Settings Page (Show Install Status)

### Add to Settings:
```tsx
import InstallButton from '../components/InstallButton'

function SettingsPage() {
  return (
    <div className="settings-container">
      <h2>App Settings</h2>
      
      <div className="setting-row">
        <div>
          <h3>Progressive Web App</h3>
          <p className="text-sm text-gray-400">
            Install Mai Troll for a native app experience
          </p>
        </div>
        
        <InstallButton 
          text="Install"
          hideWhenInstalled={false}
          showInstalledBadge={true}
        />
      </div>
    </div>
  )
}
```

---

## Example 5: Mobile Menu (Bottom Sheet)

### Add to Mobile Navigation:
```tsx
import InstallButton from '../components/InstallButton'

function MobileMenu({ isOpen, onClose }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-black/80">
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl p-6">
        <h3>Menu</h3>
        
        <nav className="space-y-4">
          <Link to="/profile">Profile</Link>
          <Link to="/settings">Settings</Link>
          
          {/* Install button in mobile menu */}
          <div className="pt-4 border-t border-gray-700">
            <InstallButton 
              className="w-full py-3"
              text="Install Mai Troll"
            />
          </div>
        </nav>
      </div>
    </div>
  )
}
```

---

## Example 6: Onboarding Flow (First Visit)

### Show During Onboarding:
```tsx
import InstallButton from '../components/InstallButton'

function OnboardingWelcome() {
  return (
    <div className="onboarding-step">
      <h1>Welcome to Mai Troll!</h1>
      
      <div className="features-list">
        <p>✓ Live streaming</p>
        <p>✓ Join families</p>
        <p>✓ Play games</p>
      </div>
      
      <div className="cta-section">
        <h3>Get the best experience</h3>
        <p className="text-sm text-gray-400 mb-4">
          Install our app for offline access and instant notifications
        </p>
        
        <InstallButton 
          className="w-full py-4 text-lg"
          text="Install Now"
        />
        
        <button className="mt-4 text-gray-400">
          Skip for now
        </button>
      </div>
    </div>
  )
}
```

---

## Props Reference

### InstallButton Props

```tsx
interface InstallButtonProps {
  /** Custom className for styling */
  className?: string;
  
  /** Show as compact icon-only button */
  compact?: boolean;
  
  /** Custom text for the button */
  text?: string;
  
  /** Hide button when app is installed (default: true) */
  hideWhenInstalled?: boolean;
  
  /** Show "Installed" badge instead of hiding (default: false) */
  showInstalledBadge?: boolean;
}
```

### Common Configurations

```tsx
// 1. Simple button (auto-hides when installed)
<InstallButton />

// 2. Full-width button with custom text
<InstallButton 
  className="w-full py-4"
  text="Get the App"
/>

// 3. Compact icon-only (for headers/navbars)
<InstallButton compact />

// 4. Always visible with status badge
<InstallButton 
  hideWhenInstalled={false}
  showInstalledBadge={true}
/>

// 5. Large prominent CTA
<InstallButton 
  className="w-full py-5 text-xl"
  text="Install Mai Troll"
/>
```

---

## Quick Copy-Paste Snippets

### For Login/Signup Pages:
```tsx
import InstallButton from '../components/InstallButton'

<div className="mt-6">
  <p className="text-xs text-gray-400 mb-2 text-center">
    Install the app for the best experience
  </p>
  <InstallButton 
    className="w-full py-3"
    text="Install App"
    hideWhenInstalled={false}
    showInstalledBadge={true}
  />
</div>
```

### For Headers/Navigation:
```tsx
import InstallButton from '../components/InstallButton'

<div className="hidden md:block">
  <InstallButton compact />
</div>
```

### For Settings Pages:
```tsx
import InstallButton from '../components/InstallButton'

<div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
  <div>
    <h4>Progressive Web App</h4>
    <p className="text-sm text-gray-400">Native app experience</p>
  </div>
  <InstallButton 
    hideWhenInstalled={false}
    showInstalledBadge={true}
  />
</div>
```

---

## Testing After Integration

1. **Android Chrome**: Click button → Should show native prompt
2. **iOS Safari**: Click button → Should show instruction modal
3. **Installed app**: Button should hide or show "Installed" badge
4. **Desktop**: Click button → Appropriate message/prompt

---

## Need Help?

See `PWA_INSTALL_SYSTEM.md` for full documentation.
