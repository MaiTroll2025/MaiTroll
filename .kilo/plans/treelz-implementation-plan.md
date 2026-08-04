# Treelz Feature — Implementation Plan v2

## Overview
TikTok/Reels-style short-form video feed for Mai Troll. Horizontal swipe, double-tap to "troll", AI flagging with mod review, stream promotion, monetization analytics, and admin controls.

---

## Key Changes from v1

| Change | Detail |
|--------|--------|
| Video length | Min 15s, default 3min, max 10min |
| Upload size | 250 MB max |
| AI detection | Score > 70 → flag for mod review (no auto-delete) |
| "Troll" not "Like" | System still uses `likes` table,Frontend says "Trolled" / heart icon → troll icon |
| Stream promotion | 20+ viewers → "Share to Treelz" creates 15s preview clip + join button |
| Homepage row | 🔥 Trending TReelz — 8 horizontal thumbnails |
| Monetization | views, watch_time_seconds, completion_rate, shares, gifts_received, coins_received |
| Admin controls | Feature, Pin, Boost, Hide, Remove, Age Restrict, Disable Uploads |

---

## Phase 1: Database & Types
