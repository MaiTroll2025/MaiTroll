# MaiTalent ↔ Mai Troll Integration Debugging Findings

## Issue Summary
The `sync-mai-platform-user` function on MaiTalent's Supabase (`https://tovzpzpimvwaldqkkmmi.supabase.co/functions/v1/sync-mai-platform-user`) returns **400 Bad Request** when Mai Troll attempts to link accounts via the `link` action.

## Payload Being Sent from MaiTalent Side
```json
{
  "action": "link",
  "external_platform": "troll-city",
  "external_user_id": "test_user_123",
  "normalized_email": "test@example.com"
}
```

Headers:
```
x-service-role: maicorp1336944428554803
Content-Type: application/json
```

---

## Required Verification Steps

### 1. Verify Mai Troll Supabase Schema
**Table:** `user_profiles` (not `profiles`)
**Columns needed:** `id`, `email`

Migration files confirm the table is `user_profiles`:
- `20260701000002_add_maitalent_profile_link_columns.sql`
- `20260701000001_add_maitalent_link_fields_to_user_profiles.sql`

**Action Required:** Execute in Supabase SQL Editor:
```sql
SELECT id, email FROM user_profiles WHERE id = 'test_user_123';
```

### 2. Verify Service Role Key Permissions
**Environment Variables** (from `env.example`):
```bash
Mai Troll_SUPABASE_URL=https://yjxpwfalenorzrqxwmtr.supabase.co
Mai Troll_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyOTExNywiZXhwIjoyMDc5NjA1MTE3fQ.Ra1AhVwUYPxODzeFnCnWyurw8QiTzO0OeCo-sXzTVHo
```

**Test Command:**
```bash
curl -X GET "https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?id=eq.test_user_123&select=id,email" \
  -H "Authorization: Bearer $Mai Troll_SERVICE_ROLE_KEY" \
  -H "apikey: $Mai Troll_SERVICE_ROLE_KEY"
```

### 3. Verify Test User Exists
The test user `test_user_123` with a valid email must exist in `user_profiles`.

**Check via Supabase Dashboard:** 
1. Go to Table Editor → `user_profiles`
2. Filter: `id = 'test_user_123'`
3. Verify `email` column is populated

### 4. Verify External Accounts Feature
**Location in Supabase Dashboard:**
- Configuration → External Accounts
- Enable: Facebook + Email (required for cross-platform linking)

---

## Current Findings

| Check | Status | Notes |
|-------|--------|-------|
| `user_profiles` table exists | ✅ Confirmed via migrations | Multiple migration files alter this table |
| Service role key format | ✅ Valid JWT | Starts with `eyJ` |
| Test user `test_user_123` | ❓ Unknown | Need to run SQL query |
| External accounts enabled | ❓ Unknown | Need to check dashboard |
| API query permissions | ❓ Unknown | Need to test curl command |

---

## Next Steps for IDE Builder

### Immediate Actions Required:
1. **Run the SQL query** in Supabase SQL Editor:
   ```sql
   SELECT id, email FROM user_profiles WHERE id = 'test_user_123';
   ```

2. **Test service role key** with REST API:
   ```bash
   curl -X GET "https://yjxpwfalenorzrqxwmtr.supabase.co/rest/v1/user_profiles?id=eq.test_user_123&select=id,email" \
     -H "Authorization: Bearer [Mai Troll_SERVICE_ROLE_KEY]" \
     -H "apikey: [Mai Troll_SERVICE_ROLE_KEY]"
   ```

3. **Enable External Accounts** in Supabase Dashboard:
   - Navigate to: Configuration → External Accounts
   - Enable "Email" provider at minimum

4. **Check Supabase Logs** for the `sync-mai-platform-user` function:
   - Look for errors when the function queries `user_profiles`
   - Check for permission denied or table not found errors

### If Test User Missing:
Create the test user in `user_profiles`:
```sql
INSERT INTO user_profiles (id, email, username, role)
VALUES ('test_user_123', 'test@example.com', 'testuser', 'user')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
```

---

## Environment Variables Reference

### Mai Troll Side (env.example)
```bash
Mai Troll_SUPABASE_URL=https://yjxpwfalenorzrqxwmtr.supabase.co
Mai Troll_SERVICE_ROLE_KEY=[service_role_key]
TROLL_CITY_SYNC_URL=https://tovzpzpimvwaldqkkmmi.supabase.co/functions/v1/sync-mai-platform-user
TROLL_CITY_SECRET=maicorp1336944428554803
```

### MaiTalent Side (env.example)
```bash
MAITALENT_SYNC_URL=https://tovzpzpimvwaldqkkmmi.supabase.co/functions/v1/sync-mai-platform-user
MAITALENT_SYNC_SECRET=maicorp1336944428554803
MAITALENT_SERVICE_ROLE_KEY=[maitalent_service_role_key]
```

---

## Debugging Contact
**Mai Troll Engineering** - This file should be shared with the MaiTalent team to coordinate the fix.

**Expected Resolution:** Once the test user exists in `user_profiles` and external accounts are enabled, the 400 error should resolve and the link action should succeed.