# How to Clear All Neighborhoods - Frontend & Database Reset Guide

## Overview
This guide explains how to completely reset all neighborhood data in Mai Troll, clearing both frontend state and database records so all users can start fresh.

## Method 1: Complete Database Reset (Recommended)

Run the SQL script to delete ALL neighborhood-related data from the database:

### Using Supabase SQL Editor:
1. Go to your Supabase dashboard
2. Navigate to **Database** → **SQL Editor**
3. Paste the contents of `clear_all_neighborhoods.sql`
4. Click **Run**

### Using psql/supabase CLI:
```bash
# Connect to your database
supabase db remote
# or
psql "your-database-url"

# Run the SQL file\i /path/to/clear_all_neighborhoods.sql
```

### What Gets Deleted:
- All `neighborhoods` (leader-created communities)
- All `neighborhood_members` (membership records)
- All `houses` (property records)
- All `house_upgrades` (customization records)
- All `house_loans` (financial records)
- All `vehicles` (cars owned)
- All `vehicle_loans` (car loans)
- All `driver_tests` (test records)
- All `user_licenses` (driver licenses)
- All `neighborhood_invites` (pending invitations)
- All `house_raids` (raid history)
- All `homeowners_insurances` (house insurance)
- All `car_insurances` (car insurance)
- All `broadcast_insurances` (broadcast insurance)
- Clears `neighborhood_id`, `house_id`, `vehicle_id`, `license_id` from all user profiles

### Verification:
After running, the script will output a count table showing 0 records in all neighborhood-related tables.

## Method 2: Individual User Reset

If you only need to reset specific users (not everyone), use the admin script:

```sql
-- clear_admin_neighborhood.sql
UPDATE user_profiles
SET neighborhood_id = NULL, house_id = NULL
WHERE id = 'SPECIFIC_USER_UUID';
```

## Method 3: Frontend Cache Clearing

If users are seeing stale data after database reset, clear frontend caches:

### Browser Cache:
1. Hard refresh: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
2. Clear site data: `Ctrl + Shift + Delete` → Clear cached images and files

### Application State:
The NeighborhoodOnboarding page (`/neighborhood-setup`) will automatically detect missing neighborhood data and redirect users to the setup flow.

## After Reset - Next Steps

1. **Users will be redirected automatically**: The Neighbors page checks for `neighborhood_id` and `house_id` in user profiles, redirecting to `/neighborhood-setup` if missing

2. **New neighborhood creation**: Users can create fresh neighborhoods through the NeighborhoodOnboarding flow at `/neighborhood-setup`

3. **Setup process includes**:
   - Building a street with custom name and ZIP code
   - Choosing house style and aesthetics
   - Purchasing a starter vehicle
   - Passing the driver's test
   - Buying car insurance
   - Customizing license plates

## Files Referenced:
- `clear_all_neighborhoods.sql` - Complete database reset (recommended)
- `clear_admin_neighborhood.sql` - Individual user reset
- `src/sql/neighborhood_schema.sql` - Database schema reference
- `src/pages/NeighborhoodOnboarding.tsx` - Setup flow after reset
- `src/pages/Neighbors.tsx` - Neighborhood management page

## Safety Notes:
⚠️ **This operation is PERMANENT** - Deleted neighborhood data cannot be recovered
⚠️ **Backup first** - Consider exporting data before running the reset
⚠️ **User impact** - All users will lose their neighborhoods, houses, vehicles, and licenses
✅ **Auto-redirect** - Users will be guided through re-setup automatically

## Testing the Reset:
After running the SQL, verify with:
```sql
SELECT COUNT(*) FROM neighborhoods; -- Should return 0
SELECT COUNT(*) FROM houses; -- Should return 0
SELECT neighborhood_id FROM user_profiles WHERE neighborhood_id IS NOT NULL; -- Should return empty
```
