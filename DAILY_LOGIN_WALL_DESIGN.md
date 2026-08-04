# 🎨 Daily Login Wall - Visual Design Guide

## UI Component Overview

### Desktop View

```
╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║  💬 Mai Troll Wall                                                  [+ New Post]║
║  Share updates, achievements, and connect with the community                  ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  📅 Daily Login Post                                                    ✓      ║
║                                                                                ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │ ⚡ Post once daily to earn 0-100 Troll Coins                           │  ║
║  └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │ What's on your mind? Share your daily troll thoughts...                │  ║
║  │                                                                         │  ║
║  │                                                                         │  ║
║  │                                                                         │  ║
║  │                                                                 47/500  │  ║
║  └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                ║
║  ┌──────────────────────────────────────────────────┐                        ║
║  │ 📤 Post & Earn Coins                    +47 🪙 │  ← Shows on hover      ║
║  └──────────────────────────────────────────────────┘                        ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                      OTHER POSTS                               ║
╠════════════════════════════════════════════════════════════════════════════════╣
║ 👤 TrollMaster (ADMIN)                                                        ║
║ 🎬 Stream Announcement • 2 hours ago                                          ║
║                                                                                ║
║ Going live in 5 minutes! Stream COD and chill. New skin unlocked!            ║
║                                                                                ║
║ ❤️ 234  💬 12  🔥 45                                                          ║
║────────────────────────────────────────────────────────────────────────────── ║
```

### "Already Posted" State

```
╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║  📅 Daily Login Post                                           ✓ Posted Today ║
║                                                                                ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │ ⚡ Post once daily to earn 0-100 Troll Coins                           │  ║
║  └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │                                                                         │  ║
║  │         ✓ Great! You already posted today. Come back tomorrow!         │  ║
║  │                                                                         │  ║
║  │           Posts reset daily at midnight UTC                           │  ║
║  │                                                                         │  ║
║  └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

### Not Logged In State

```
╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║  📅 Daily Login Post                                                          ║
║                                                                                ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │                                                                         │  ║
║  │       🔐 Log in to post daily and earn Troll Coins!                    │  ║
║  │                                                                         │  ║
║  └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

---

## Color Scheme

### Gradients & Backgrounds
```css
/* Main Container */
background: linear-gradient(135deg, rgb(15, 23, 42) 0%, rgb(30, 41, 59) 100%)
border: 1px solid rgb(71, 85, 105)

/* Status Box */
background: rgba(30, 41, 59, 0.5)
border: 1px solid rgb(71, 85, 105)

/* Submit Button */
background: linear-gradient(90deg, rgb(6, 182, 212) 0%, rgb(59, 130, 246) 100%)
hover: linear-gradient(90deg, rgb(14, 165, 233) 0%, rgb(37, 99, 235) 100%)
disabled: linear-gradient(90deg, rgb(71, 85, 105) 0%, rgb(71, 85, 105) 100%)
```

### Text Colors
```css
/* Headers */
color: rgb(255, 255, 255)  /* White */

/* Secondary Text */
color: rgb(209, 213, 219)  /* Gray-300 */

/* Tertiary/Placeholder */
color: rgb(107, 114, 128)  /* Gray-500 */

/* Accent - Coins */
color: rgb(250, 204, 21)   /* Yellow-400 */

/* Accent - Status */
color: rgb(34, 197, 94)    /* Green-500 */

/* Accent - Icons */
color: rgb(34, 211, 238)   /* Cyan-400 */
```

### Icons & Emojis
```
📅  Calendar - Daily theme
⚡  Zap - Lightning/energy, reward
🪙  Coins - Currency
📤  Send - Submit action
✓   Checkmark - Success
🔐  Lock - Authentication required
```

---

## Component Anatomy

### Header Section
```
┌──────────────────────────────────────────┐
│ [📅] Daily Login Post           [✓]      │
│ (icon)  (title)           (status badge) │
└──────────────────────────────────────────┘
```

### Status Message Section
```
┌──────────────────────────────────────────┐
│ ⚡ Post once daily to earn 0-100 Coins │
│ (icon)  (descriptive message)           │
└──────────────────────────────────────────┘
```

### Form Section
```
┌──────────────────────────────────────────┐
│ [Textarea - 4 rows high]                │
│ Placeholder: "What's on your mind..."   │
│ Max length: 500 characters              │
│                                     47/500
└──────────────────────────────────────────┘
```

### Action Button
```
┌──────────────────────────────────────────┐
│ [📤] Post & Earn Coins    [+47 🪙 hover]│
│ (icon)  (label)        (coin preview)   │
└──────────────────────────────────────────┘
```

---

## Responsive Behavior

### Desktop (1024px+)
```
┌─ Full Width ─────────────────────────────────┐
│  DailyLoginWall (max-width: 768px, centered)│
│  ┌─────────────────────────────────────────┐ │
│  │  Daily Login Post Section              │ │
│  │  - 4 rows textarea                     │ │
│  │  - Full width button                   │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Tablet (768px - 1023px)
```
┌─ Medium Width ─────────────────────────┐
│ ┌─────────────────────────────────────┐│
│ │ Daily Login Post Section            ││
│ │ - 3 rows textarea                   ││
│ │ - Full width button                 ││
│ └─────────────────────────────────────┘│
└────────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌─ Small Width ──────┐
│ ┌────────────────┐ │
│ │Daily Login Post│ │
│ │ Section        │ │
│ │ - 3 rows       │ │
│ │ - Full width   │ │
│ │ [Button full]  │ │
│ └────────────────┘ │
└────────────────────┘
```

---

## Animation & Interactions

### Button Hover
```
Normal:
  background: linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%)
  opacity: 1

Hover:
  background: linear-gradient(90deg, #0ea5e9 0%, #2563eb 100%) 
  opacity: 1
  transition: all 150ms ease

Active (Click):
  transform: scale(0.98)
  opacity: 0.95
```

### Coin Preview
```
On Hover (Button):
  Show: "+47 🪙"
  Color: rgb(250, 204, 21) - Yellow-400
  Font-weight: bold
  Transition: fade in 100ms

On Leave (Button):
  Hide: coin preview
  Transition: fade out 100ms
```

### Form States

**Enabled**:
```
- Textarea: Blue border on focus
- Button: Clickable, gradient visible
- Character count: Gray text
```

**Disabled** (Already Posted):
```
- Textarea: N/A
- Button: Gray gradient, cursor: not-allowed
- Container: Muted colors
```

**Loading**:
```
- Textarea: opacity: 0.5
- Button: "Posting..." text, cursor: wait
- Disabled: true
```

---

## Typography

### Font Stack
```css
font-family: system-ui, -apple-system, sans-serif;
```

### Text Sizes
```css
h3.title        { font-size: 1.125rem; font-weight: bold; }  /* 18px */
p.description   { font-size: 0.875rem; font-weight: normal; } /* 14px */
p.placeholder   { font-size: 0.875rem; font-weight: normal; } /* 14px */
span.count      { font-size: 0.75rem;  font-weight: normal; } /* 12px */
button.action   { font-size: 1rem;     font-weight: bold; }   /* 16px */
```

### Text Weights
```
Titles:       700 (bold)
Labels:       600 (semi-bold)
Body:         400 (normal)
Placeholders: 400 (normal)
```

---

## Toast Notifications

### Success Toast
```
╔══════════════════════════════════════════╗
║ 🎉 You earned 47 Troll Coins!           ║
║ Come back tomorrow for another daily post!║
║                                    [×]    ║
╚══════════════════════════════════════════╝

Position: Bottom-right
Duration: 4 seconds
Background: rgb(34, 197, 94) - Green-500 translucent
Icon: Party popper emoji
```

### Error Toast
```
╔═════════════════════════════════════════╗
║ ✕ Failed to create post                 ║
║ Please try again                    [×]  ║
╚═════════════════════════════════════════╝

Position: Bottom-right
Duration: 3 seconds
Background: rgb(239, 68, 68) - Red-500 translucent
Icon: X or warning emoji
```

### Info Toast
```
╔═════════════════════════════════════════╗
║ ⚠️ You already posted today             ║
║ Come back tomorrow!              [×]    ║
╚═════════════════════════════════════════╝

Position: Bottom-right
Duration: 3 seconds
Background: rgb(245, 158, 11) - Amber-400 translucent
Icon: Warning emoji
```

---

## Accessibility Features

### Keyboard Navigation
```
Tab:      Move focus through form elements
Enter:    Submit form (when button focused)
Space:    Activate button
Esc:      Clear textarea (optional)
```

### Screen Reader Hints
```
Component: "Daily Login Wall section"
Form Label: "Post content text area"
Button: "Post and earn coins, button"
Counter: "Character count: 47 of 500"
Status: "You can post daily for coins"
```

### Color Contrast
```
Text on Background: 7.2:1 (WCAG AAA compliant)
Button Text on Button: 7.5:1 (WCAG AAA compliant)
Icons: 5.1:1 (WCAG AA compliant)
```

### Focus Indicators
```
Textarea Focus: 2px solid rgb(59, 130, 246) - Blue-500
Button Focus: 2px solid rgb(34, 211, 238) - Cyan-400
Visible: Yes
```

---

## Dark Mode Support

The component uses the site's existing dark theme:
- Base: `slate-950` (darkest)
- Secondary: `slate-900` (dark)
- Accents: `cyan-400`, `blue-500`, `yellow-400`
- Text: `white`, `gray-300`, `gray-500`

No additional dark mode CSS needed - fully compatible with existing theme.

---

## Mobile-Specific Optimizations

### Touch Targets
```
Button Height: 48px minimum (iOS guidance)
Button Width: 100% (full width on mobile)
Padding: 16px all sides for easy tapping
Gap between elements: 16px minimum
```

### Input Optimization
```
Textarea Height: 3 rows (prevents scrolling)
Font Size: 16px (prevents zoom on iOS)
Keyboard: default (auto-detect)
Autocomplete: off (custom prompt)
```

### Viewport
```
max-width: 768px for component
Margin: auto (centered)
Padding: 16px (mobile safe)
```

---

## Design Tokens

```css
/* Spacing */
$spacing-xs: 4px
$spacing-sm: 8px
$spacing-md: 12px
$spacing-lg: 16px
$spacing-xl: 24px

/* Border Radius */
$rounded-sm: 4px
$rounded-md: 8px
$rounded-lg: 12px

/* Colors */
$primary: #06b6d4      (cyan-400)
$secondary: #3b82f6    (blue-500)
$success: #22c55e      (green-500)
$warning: #f59e0b      (amber-400)
$error: #ef4444        (red-500)
$background: #0f172a   (slate-950)
$surface: #1e293b      (slate-900)
$text-primary: #ffffff (white)
$text-secondary: #d1d5db (gray-300)

/* Transitions */
$transition-fast: 100ms ease
$transition-base: 150ms ease
$transition-slow: 300ms ease
```

---

## States Summary

| State | Textarea | Button | Color |
|-------|----------|--------|-------|
| **Ready** | Enabled | Blue gradient | Cyan |
| **Hover** | - | Darker blue | Blue |
| **Focus** | Blue border | - | Cyan |
| **Typing** | Text visible | Enabled | White |
| **Loading** | Disabled | Gray "Posting..." | Gray |
| **Error** | Disabled | Gray | Red |
| **Posted** | Hidden | Gray "Posted" | Gray |
| **Tomorrow** | Hidden | Gray disabled | Gray |

---

**Last Updated**: January 21, 2026
**Design Version**: 1.0
**Responsive**: Mobile-first responsive design
