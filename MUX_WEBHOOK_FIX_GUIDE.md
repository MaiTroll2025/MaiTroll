# Mai Troll Webhook & Playback Issues - Complete Fix Guide

## Issues Identified

### 1. **Mux Webhook 401 Unauthorized Error** ⚠️ CRITICAL
**Error:** 
```
POST | 401 | https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1/mux-webhook
sb_error_code: UNAUTHORIZED_NO_AUTH_HEADER
execution_time_ms: 131
```

**Impact:** Mux webhooks cannot reach your function because Supabase rejects them at the auth layer.

**Root Cause:** Supabase Edge Functions require JWT authentication by default. Webhooks from external services (Mux) don't include JWT tokens, so they fail before your function code runs.

**Solution:**
```bash
# Deploy mux-webhook WITHOUT JWT verification
npm run deploy:mux-webhook

# Or manually:
supabase functions deploy mux-webhook --no-verify-jwt
```

---

### 2. **Video Playback Error: DEMUXER_ERROR_COULD_NOT_PARSE** ❌ DEPENDENT
**Error:**
```
[ViewerPage][MuxVideo] native video error
MediaError {
  code: 4,
  message: "PipelineStatus::DEMUXER_ERROR_COULD_NOT_PARSE"
}
```

**Root Cause:** The video player can't parse the HLS stream. This is likely caused by:
- Invalid playback ID in stream metadata
- Playback ID not being saved due to webhook failures
- Corrupted or incomplete stream URL

**This should resolve automatically** once the Mux webhook is fixed and processes events correctly.

**Verification:**
1. Check `streams` table for `mux_playback_id` being populated
2. Verify HLS URL is being constructed correctly in ViewerPage.tsx
3. Test stream playback once webhook is deployed

---

### 3. **Gift Loading Error: No Gifts Found** ⚠️ SECONDARY
**Error:**
```
[GiftBoxModal] No gifts found in any table (gift_items, gifts, gift_catalog, broadcast_gifts)
```

**Root Cause:** The code tries multiple table names but none contain data:
- `gift_items`
- `gifts`
- `gift_catalog`
- `broadcast_gifts`

**Action Items:**
1. Identify which table actually contains gifts in your schema
2. Update `GiftBoxModal.tsx:153` to query the correct table
3. Ensure RLS policies allow reading gifts

---

## Deployment Instructions

### Step 1: Deploy Mux Webhook (REQUIRED)
```bash
# Option A: Using npm script (easiest)
npm run deploy:mux-webhook

# Option B: Using Supabase CLI
supabase functions deploy mux-webhook --no-verify-jwt

# Option C: Using PowerShell
.\deploy-mux-webhook.ps1
```

### Step 2: Verify Deployment
```bash
# Check function logs
supabase functions logs mux-webhook --tail

# Test with a sample webhook from Mux dashboard
```

### Step 3: Monitor Stream Updates
Check Supabase console:
```sql
SELECT 
  id, 
  mux_playback_id, 
  mux_stream_id, 
  status, 
  updated_at 
FROM streams 
ORDER BY updated_at DESC 
LIMIT 10;
```

---

## Files Modified/Created

| File | Purpose |
|------|---------|
| `supabase/functions/mux-webhook/deno.json` | Function dependencies |
| `supabase/config.json` | Supabase function configuration |
| `deploy-mux-webhook.ps1` | PowerShell deployment script |
| `deploy-mux-webhook.sh` | Bash deployment script |
| `package.json` | Added `deploy:mux-webhook` npm script |

---

## Troubleshooting

### Still getting 401?
- [ ] Confirm you deployed with `--no-verify-jwt`
- [ ] Check function is listed: `supabase functions list`
- [ ] Redeploy if needed: `npm run deploy:mux-webhook`

### Webhook processing but no stream updates?
- [ ] Check Mux webhook secret is set: `echo $MUX_WEBHOOK_SECRET`
- [ ] Verify Supabase credentials in function env vars
- [ ] Check function logs: `supabase functions logs mux-webhook`

### Video still won't play?
- [ ] Verify `mux_playback_id` is populated in streams table
- [ ] Check HLS URL construction in ViewerPage.tsx
- [ ] Ensure Mux playback ID is valid format

### Gifts still not loading?
- [ ] Identify correct gift table in schema
- [ ] Update table names in GiftBoxModal.tsx
- [ ] Check RLS policies allow gift selection

---

## Priority Order
1. ✅ Deploy mux-webhook (fixes 401 error)
2. ✅ Verify webhook processes events
3. 🔄 Test video playback (should auto-fix)
4. 🔄 Fix gift loading (identify correct table)

---

## Quick Links
- Mux Webhook Index: `supabase/functions/mux-webhook/index.ts`
- Video Player: `src/pages/broadcast/ViewerPage.tsx:251`
- Gift Modal: `src/components/broadcast/GiftBoxModal.tsx:153`
- Deployment Script: `deploy-mux-webhook.ps1`

---

**Last Updated:** 2026-05-10
**Status:** Ready for deployment ✅
