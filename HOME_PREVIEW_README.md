# Premium Home Page Dev Previews

This document describes the 10 premium home page layouts created for development preview.

## Layouts Overview

### 1. **Hero Immersive** (`HeroImmersiveLayout`)
- Full-screen hero with single featured stream
- Floating glass navigation
- Elegant typography hierarchy
- Subtle ambient animations
- Premium "resort lobby" feel

### 2. **Glassmorphism Bento** (`GlassBentoLayout`)
- Apple-style rounded cards in asymmetrical grid
- Multi-size cards (1x1, 2x1, 2x2)
- Frosted glass backdrop
- Soft shadow elevations
- Dynamic content distribution

### 3. **Cinematic Marquee** (`CinematicMarqueeLayout`)
- Horizontal hero carousel with parallax
- Floating indicator dots
- Gradient overlays
- Editorial-style typography
- Large scale imagery

### 4. **Spread Magazine** (`SpreadMagazineLayout`)
- Editorial grid with varied typography
- Large headline modules
- Asymmetric layouts
- Swiss design influence
- Negative space emphasis

### 5. **Neon Noir** (`NeonNoirLayout`)
- Dark mode only
- Neon accent on hover only
- Minimal UI
- High contrast
- Cyberpunk sophistication

### 6. **Parallax Depth** (`ParallaxDepthLayout`)
- Multi-layer parallax scrolling
- Background mesh gradients
- Floating elements
- Depth perception design
- Premium motion feel

### 7. **Luxury Carousel** (`LuxuryCarouselLayout`)
- Smooth horizontal scroll sections
- Card peeking effect
- Magnetic hover states
- Rich shadows and glows
- Hotel lobby aesthetic

### 8. **Ambient Aurora** (`AmbientAuroraLayout`)
- Aurora background effects
- Soft color transitions
- Ethereal atmosphere
- Floating glass panels
- Premium spa-like feel

### 9. **Swiss Minimal** (`SwissMinimalLayout`)
- Clean grid system
- Bold typographic hierarchy
- Monochrome with single accent
- International style
- Understated luxury

### 10. **Dark crystalline** (`DarkCrystallineLayout`)
- Geometric crystalline patterns
- Faceted card shapes
- Metallic accents
- Sharp edges + soft glows
- Premium tech feel

## Usage

In development mode, a layout selector appears in the top-right corner of the home page. Click to cycle through all 10 premium layouts.

Each layout uses the same data sources:
- Live streams from `streams` table
- Featured broadcasts
- Troll Wall feed
- Universe battles

## Technical Notes

- All layouts are fully responsive (mobile + desktop)
- Uses Tailwind CSS custom config
- Integrates with existing `Mai TrollTheme`
- Glass effects via backdrop-blur and border utilities
- Animations via Framer Motion
- No external dependencies beyond existing stack
