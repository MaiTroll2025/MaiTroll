# App Icons

This folder contains the Progressive Web App (PWA) icons for Mai Troll.

## Required Icon Sizes

Upload the following icon sizes for best PWA compatibility:

- `icon-192.png` - 192x192 pixels (required for PWA)
- `icon-512.png` - 512x512 pixels (required for PWA)
- `icon-72.png` - 72x72 pixels (iOS home screen)
- `icon-96.png` - 96x96 pixels (favicon)
- `icon-128.png` - 128x128 pixels (various platforms)
- `icon-144.png` - 144x144 pixels (Android home screen)

## Icon Format

- Use PNG format with transparent background
- Square aspect ratio (1:1)
- High quality, crisp graphics
- Consider the app's dark theme (#0A0814 background)

## Usage

Once uploaded, update the `manifest.webmanifest` file to reference these icons:

```json
{
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

## Current Setup

The app currently uses `/favicon.svg` as the main icon. Replace this with PNG icons for better cross-platform compatibility.