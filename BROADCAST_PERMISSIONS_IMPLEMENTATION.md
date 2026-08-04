# Broadcast Box & Permissions Implementation Guide

## Overview
This document describes the implementation of the broadcast box management and role-based permissions system for Mai Troll.

## Key Changes Implemented

### 1. Real-Time Box Visibility ✅
**Status:** Already Working

Box additions/removals are visible to all viewers in real-time via:
- `BOX_COUNT_UPDATE` system messages in the `messages` table
- All viewers subscribe to `messages` for the stream
- When box count changes, a message is inserted and all clients update

### 2. Role-Based Permissions ✅

#### Staff Roles (Full Broadcast Control)
- **Admin** - Full access to all broadcasts and moderation tools
- **Lead Troll Officer** - High-level moderation across all broadcasts
- **Troll Officer** - Standard moderation across all broadcasts
- **Secretary** - Staff role with moderation capabilities
- **Pastor** - Staff role with moderation capabilities

#### Broadofficer (Assigned per Broadcaster)
- Assigned by the broadcaster (max 10 per broadcaster)
- Has box management permissions for that specific broadcast
- Can use all OfficerActionBubble tools

#### Broadofficer Restrictions
- **Cannot** manage boxes unless assigned to that specific broadcaster's stream
- **Can** kick, ban, mute, and use other moderation tools
- **Cannot** assign/remove other broadofficers (only broadcaster can)

### 3. Box Management Permissions ✅

#### Who Can Add/Remove Boxes:
| Role | Can Manage Boxes |
|------|------------------|
| Broadcaster | ✅ Yes |
| Broadofficer (assigned) | ✅ Yes |
| Admin | ✅ Yes |
| Lead Troll Officer | ✅ Yes |
| Troll Officer | ✅ Yes |
| Secretary | ✅ Yes |
| Pastor | ✅ Yes |
| Regular User | ❌ No |

### 4. OfficerActionBubble Visibility ✅

The Officer Action Bubble is now visible to:
- Broadcaster (always visible)
- Staff users (admin, lead_troll_officer, troll_officer, secretary, pastor)
- Broadofficers (assigned to that broadcast)

#### Box Management in OfficerActionBubble:
- Add Box / Deduct Box buttons only appear if user has box management permissions
- All other tools (kick, mute, ban, etc.) are available to all OfficerActionBubble users

## Files Modified

### 1. `src/pages/LivePage.tsx`

#### Added:
- `canManageBoxes` memo for box management permissions
- `canUseOfficerTools` memo for OfficerActionBubble visibility
- `pastor` role to all permission checks

#### Updated:
- `isRoleExempt` - Added `pastor` role
- `officerRoleNames` - Added `secretary`, `pastor`
- `isOfficerUser` - Updated to include new roles
- `OfficerActionBubble` - Added `canManageBoxes` prop
- Box buttons in OfficerActionBubble - Now conditional on `canManageBoxes`
- Officer Stream access - Added `secretary`, `pastor` roles
- Gift tracking - Added `pastor` to privileged roles

### 2. Database Functions (`BROADCAST_PERMISSIONS_FIX.sql`)

#### New Functions:
- `is_broadofficer(broadcaster_id, user_id)` - Check if user is broadofficer
- `can_manage_stream_boxes(broadcaster_id, user_id)` - Check box management permissions
- `is_stream_staff(user_id)` - Check if user is staff
- `can_use_officer_tools(broadcaster_id, user_id)` - Check officer tool permissions
- `kick_user_from_stream(...)` - Kick user from stream
- `mute_user_in_stream(...)` - Mute user in stream
- `disable_user_chat_in_stream(...)` - Disable user chat
- `remove_user_from_seat(...)` - Remove user from box/seat

## How to Use

### For Broadcasters:
1. Go to your broadcast
2. Click "Add Box" / "Deduct Box" in the header to manage boxes
3. Assign broadofficers by clicking on users and selecting "Assign Officer"
4. Broadofficers can then manage boxes for your broadcast

### For Staff (Admin/Officers/Secretary/Pastor):
1. Double-click anywhere on the broadcast stage to open OfficerActionBubble
2. Use all moderation tools (kick, mute, ban, etc.)
3. Box management is NOT available - only broadofficers/broadcasters can manage boxes

### For Broadofficers:
1. Once assigned by broadcaster, you can manage boxes
2. Double-click on broadcast stage to open OfficerActionBubble
3. Use Add Box / Deduct Box buttons to manage boxes
4. Use all other moderation tools (kick, mute, ban, etc.)

## Database Setup

Run the following in Supabase SQL Editor:
```sql
-- Run BROADCAST_PERMISSIONS_FIX.sql
```

This will:
1. Create/update `broadcast_officers` table
2. Set up RLS policies
3. Create all necessary RPC functions
4. Create performance indexes

## Testing Checklist

- [ ] Box additions visible to all viewers in real-time
- [ ] Box removals visible to all viewers in real-time
- [ ] Broadcaster can add/remove boxes
- [ ] Assigned broadofficer can add/remove boxes
- [ ] Staff (admin/officer) CANNOT add/remove boxes
- [ ] OfficerActionBubble visible to broadcaster
- [ ] OfficerActionBubble visible to staff
- [ ] OfficerActionBubble visible to broadofficers
- [ ] Add/Deduct Box buttons hidden for staff in OfficerActionBubble
- [ ] All mod tools (kick, mute, ban) work for staff
- [ ] All mod tools (kick, mute, ban) work for broadofficers
- [ ] Pastor role has full staff access
- [ ] Secretary role has full staff access

## Troubleshooting

### Box management not working:
1. Check if user is broadcaster or assigned broadofficer
2. Verify `broadcast_officers` table has correct entry
3. Check browser console for errors

### OfficerActionBubble not showing:
1. Double-click on broadcast stage
2. Check if user has staff role or is broadofficer
3. Verify `isOfficerUser` or `isCurrentUserBroadofficer` is true

### Real-time updates not working:
1. Check Supabase subscription is connected
2. Verify `BOX_COUNT_UPDATE` messages are being inserted
3. Check browser console for subscription errors
