# Storage Bucket Usage Audit

> Generated: 2026-05-31. All storage bucket references in src/ directory.
> 15+ unique buckets identified.

---

## Direct Frontend Bucket Usage

| Bucket | Operations | File(s) | Trigger | Route |
|--------|-----------|---------|---------|-------|
| `post-images` | upload, getPublicUrl | pages/Trollifieds.tsx, pages/SellOnMai Troll.tsx | User action | Marketplace, Sell |
| `auction-items` | upload, getPublicUrl | pages/auction/AuctionStudio.tsx, pages/auction/AuctionInventory.tsx | User action | Auctions |
| `family-banners` | getPublicUrl | pages/FamilyProfilePage.tsx | Page load | Family |
| `ad-assets` | getPublicUrl, remove | pages/admin/XAdsStudio.tsx | Admin action | Admin |
| `avatars` | getPublicUrl | pages/ProfileSetup.tsx | Page load | Profile Setup |
| `troll-city-assets` | getPublicUrl | pages/ProfileSetup.tsx, pages/admin/MediaLibrary.tsx | Page load/admin | Profile, Admin |
| `org-files` | upload, createSignedUrl | hooks/useOrganizationFiles.ts | User action | Organizations |
| `audio` | getPublicUrl, remove | components/live/AudioSettingsPanel.tsx | User action | Audio settings |
| `verification_docs` | upload, getPublicUrl | components/IdVerifyClient.tsx | User action | Verification |
| `review-images` | upload, getPublicUrl | lib/sellerApi.ts | User action | Seller |
| `appeal-media` | upload, getPublicUrl | lib/sellerApi.ts | User action | Seller appeals |
| `covers` | getPublicUrl | (admin Media Library) | Admin action | Admin |
| `chat-media` | getPublicUrl | (admin Media Library) | Admin action | Admin |
| `public` | getPublicUrl | lib/giftVisuals.ts | Page load | Gift rendering |
| `gift-videos` | URL resolution | lib/giftVisuals.ts | Page load | Gift rendering |
| `gift-animations` | URL resolution | lib/giftVisuals.ts | Page load | Gift rendering |
| `gifts` | URL resolution | lib/giftVisuals.ts | Page load | Gift rendering |

---

## Edge Function Bucket Usage

| Bucket | Function | Operation |
|--------|----------|-----------|
| `ad-assets` | capture-content, generate-ad | insert, upsert |

---

## Admin Media Library UI

From `pages/admin/MediaLibrary.tsx`, the following buckets are managed via UI:
- `avatars` — Avatars
- `covers` — Cover Photos
- `chat-media` — Chat Media
- `troll-city-assets` — Assets
- `public` — Public

---

## Observations

1. **`ad-assets` bucket** is the only bucket with write operations directly from edge functions (capture-content).
2. **`verification_docs`** contains sensitive user ID documents. Ensure RLS policies restrict access to the user and authorized roles.
3. **`org-files`** uses `createSignedUrl` rather than public URLs, which is correct for private files.
4. **`gift-videos`, `gift-animations`, `gifts`** buckets are referenced for URL resolution from `lib/giftVisuals.ts` — these are read-only at the frontend level.
5. No frontend code was found that creates or manages buckets dynamically — all are assumed to be pre-created.
6. **Storage policies should be audited separately** — this audit only tracked code references, not policy configurations.
