# Camera-Off Image System - Setup & Implementation Guide

## Overview
This feature allows broadcasters to set a custom image that displays when their camera is turned off during a broadcast. The image fills the entire broadcaster box.

## What Was Implemented

### 1. Database Schema
- **Migration:** `20260901000001_add_camera_off_image_url.sql`
- **Column:** `camera_off_image_url` on `user_profiles` table
- Added index for faster lookups of users with camera-off images

### 2. Storage Bucket
- **Bucket Name:** `camera-off-images`
- **Type:** Public (allows public viewing of images)
- **Policies:** 
  - Users can upload their own images
  - Users can update/delete their own images
  - Public can view images (needed for broadcasts)

### 3. Components

#### CameraOffImageUpload.tsx
- React component for uploading camera-off images
- Features:
  - Drag-and-drop image selection
  - Live preview
  - File size validation (max 10MB)
  - Upload progress feedback
  - Remove image option
- Location: `src/components/broadcast/CameraOffImageUpload.tsx`
- Used in: SetupPage

#### CameraOffImageModal.tsx
- Modal component for managing camera-off images during broadcasts
- Features:
  - Fullscreen modal interface
  - Drag-and-drop or click to upload
  - Live preview of selected image
  - Upload/remove buttons
  - Can be opened anytime during broadcast
- Location: `src/components/broadcast/CameraOffImageModal.tsx`
- Used in: BroadcastPage (accessible via button in broadcast controls)

#### SetupPage Integration
- Added camera-off image upload UI to SetupPage
- Placed after religion selector, before permission warning
- Users can upload/manage their camera-off image before going live

#### BroadcastPage Integration
- Added CameraOffImageModal to BroadcastPage
- Added button to access modal during broadcast
- Button location: Top-right control area (next to collaboration button)
- Updates broadcaster profile live when image changes

### 4. Broadcast Display Logic

#### BroadcastGrid.tsx Modifications
1. **LiveKitVideoPlayer Component**
   - Added `cameraOffImageUrl` prop
   - Displays full-screen image when camera is off (no video track)
   - Image uses `object-cover` to fill the entire box
   - Fallback to avatar-based display if no image set

2. **Camera-Off Placeholder Logic**
   - For broadcaster (local user): Displays camera-off image if available
   - For other participants: Displays camera-off image if available, otherwise shows avatar + "Camera Off" text
   - Image fills the entire broadcaster box

### 5. Key Features

✅ **Anytime Updates**
- Users can upload camera-off images before, during, or after broadcasts
- Admin/CEO can change images as often as they want
- Changes are immediate and apply across all sessions

✅ **For All Users**
- Every user (admin, CEO, regular broadcaster, guest) can set a camera-off image
- Individual profiles store individual images
- No central override needed

✅ **Live Access**
- Button in broadcast controls for quick access during stream
- Modal opens without interrupting broadcast
- Image takes effect immediately when camera is toggled off

## Setup Instructions

### Step 1: Run Database Migration
```bash
# Apply the migration to add camera_off_image_url column
# Via Supabase CLI:
supabase migration up

# Or manually in Supabase SQL editor:
# Paste contents of: supabase/migrations/20260901000001_add_camera_off_image_url.sql
```

### Step 2: Create Storage Bucket

**Via Supabase Dashboard:**
1. Go to **Storage** in the Supabase dashboard
2. Click **New bucket**
3. Set:
   - **Bucket name:** `camera-off-images`
   - **Make it public:** ✅ (checked)
4. Click **Create bucket**

**Set RLS Policies:**
The bucket policies are documented in `supabase/migrations/20260901000002_create_camera_off_images_bucket.sql`

Run these policies in the Supabase SQL editor:
```sql
-- Policy 1: Authenticated users can upload their own camera-off images
CREATE POLICY "Users can upload camera-off images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'camera-off-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Public can view all camera-off images (needed for broadcasts)
CREATE POLICY "Public can view camera-off images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'camera-off-images');

-- Policy 3: Users can update their own camera-off images
CREATE POLICY "Users can update own camera-off images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'camera-off-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Users can delete their own camera-off images
CREATE POLICY "Users can delete own camera-off images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'camera-off-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Step 3: Upload CEO's Camera-Off Image

**For CEO Account (UUID: 3da9479f-2fb1-49d3-8b6a-a2bf25873d31)**

#### Option A: Use the Setup Script
```bash
# Install dependencies (if not already done)
npm install

# Run the setup script
node setup_ceo_camera_off_image.cjs "C:\Users\kainm\Downloads\c062c1c2-9fc2-4cb6-912e-8d21d81fc28e.png" "3da9479f-2fb1-49d3-8b6a-a2bf25873d31"
```

Environment variables needed:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

#### Option B: Manual Upload via Supabase Dashboard
1. Go to **Storage** → **camera-off-images** bucket
2. Click **Upload file**
3. Select your image
4. After upload, note the public URL
5. Go to **SQL Editor** and run:
```sql
UPDATE public.user_profiles 
SET camera_off_image_url = 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/camera-off-images/3da9479f-2fb1-49d3-8b6a-a2bf25873d31/[timestamp].png'
WHERE id = '3da9479f-2fb1-49d3-8b6a-a2bf25873d31';
```

#### Option C: In-App Upload via SetupPage
1. Log in as the CEO account
2. Go to **Create Broadcast** (SetupPage)
3. Scroll to **Camera Off Image** section
4. Upload the image from there
5. Save and go live

## Usage

### For Broadcasters

#### Before Going Live (SetupPage)
1. When creating a broadcast (SetupPage):
   - Scroll to **Camera Off Image** section
   - Click to upload your camera-off image
   - Image will be saved to your profile
   - When you turn off your camera during broadcast, this image displays

#### During Live Broadcast
1. **Mobile:** Tap the camera icon 📷 button in the top-right controls
2. **Desktop:** Click the camera icon 📷 button in the top-right corner
3. Upload a new image anytime during the broadcast
4. The new image will display immediately when you turn off your camera

#### Managing Your Image
- **Upload new image:** Click to select a new image (replaces old one)
- **Remove image:** Click the Remove button to delete your camera-off image
- **Update anytime:** You can change your image multiple times during a broadcast
- **Fallback:** If no image is set, the default avatar + "Camera Off" text displays

### For Viewers
- If a broadcaster has a custom camera-off image, it displays fullscreen when they turn off their camera
- Image fills the entire broadcaster box
- If no image is set, viewers see the default avatar display

## Image Specifications

- **Format:** PNG, JPG, GIF, WebP (any common image format)
- **Max Size:** 10MB
- **Recommended Size:** 1920x1080 (16:9 aspect ratio)
- **Display:** Image will use `object-cover` to fill the broadcaster box
  - Maintains aspect ratio
  - No distortion
  - May crop sides/top if ratio doesn't match

## Database Schema

```sql
-- New column on user_profiles table
ALTER TABLE public.user_profiles
  ADD COLUMN camera_off_image_url TEXT;

-- Index for faster lookups
CREATE INDEX idx_user_profiles_camera_off_image_url 
ON public.user_profiles(camera_off_image_url) 
WHERE camera_off_image_url IS NOT NULL;
```

## File Structure

```
TrollCity/
├── supabase/
│   └── migrations/
│       ├── 20260901000001_add_camera_off_image_url.sql
│       └── 20260901000002_create_camera_off_images_bucket.sql
├── src/
│   ├── components/broadcast/
│   │   ├── CameraOffImageUpload.tsx (setup page component)
│   │   ├── CameraOffImageModal.tsx (live broadcast modal - NEW)
│   │   └── BroadcastGrid.tsx (modified)
│   ├── pages/broadcast/
│   │   ├── SetupPage.tsx (modified)
│   │   └── BroadcastPage.tsx (modified)
├── setup_ceo_camera_off_image.cjs
└── CAMERA_OFF_IMAGE_SETUP.md (this file)
```

## Testing Checklist

- [ ] Migration applied successfully
- [ ] Storage bucket created and public
- [ ] RLS policies added
- [ ] CEO image uploaded to bucket
- [ ] User profile updated with image URL
- [ ] Can upload image via SetupPage
- [ ] Can upload image via modal during broadcast (mobile and desktop)
- [ ] Can update camera-off image multiple times during broadcast
- [ ] Can remove camera-off image
- [ ] Camera-off image displays when broadcaster turns off camera
- [ ] Image fills entire broadcaster box
- [ ] Default avatar display works when no image is set
- [ ] Multiple broadcasters can have different camera-off images
- [ ] Mobile view displays image correctly
- [ ] Desktop view displays image correctly
- [ ] Image updates immediately (no need to toggle camera on/off)

## Troubleshooting

### Image not displaying
1. Check that storage bucket exists and is public
2. Verify RLS policies are correctly applied
3. Ensure image URL is valid: `https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/camera-off-images/[path]`
4. Check browser console for CORS errors
5. Verify user_profiles record has camera_off_image_url set

### Upload fails
1. Check file size (max 10MB)
2. Verify storage bucket permissions
3. Ensure authenticated user has correct RLS policy
4. Check that `camera-off-images` bucket exists and is public

### Storage bucket not found
1. Create bucket manually via Supabase dashboard
2. Name: `camera-off-images`
3. Make it public
4. Apply RLS policies

## Related Files

- Migration: `supabase/migrations/20260901000001_add_camera_off_image_url.sql`
- Bucket setup: `supabase/migrations/20260901000002_create_camera_off_images_bucket.sql`
- Upload component: `src/components/broadcast/CameraOffImageUpload.tsx`
- Modal component: `src/components/broadcast/CameraOffImageModal.tsx` (NEW)
- Setup integration: `src/pages/broadcast/SetupPage.tsx`
- Broadcast integration: `src/pages/broadcast/BroadcastPage.tsx` (NEW)
- Grid display logic: `src/components/broadcast/BroadcastGrid.tsx`
- Setup script: `setup_ceo_camera_off_image.cjs`

## Feature Complete ✅

All features have been implemented:
1. ✅ Database column for camera-off image URL
2. ✅ Storage bucket for uploading images
3. ✅ Upload component with validation
4. ✅ SetupPage integration (pre-broadcast upload)
5. ✅ BroadcastPage modal integration (live broadcast update)
6. ✅ BroadcastGrid display logic
7. ✅ Fullscreen image display when camera is off
8. ✅ Fallback to avatar if no image
9. ✅ Support for all broadcasters
10. ✅ CEO account setup script
11. ✅ **ANYTIME UPDATES - Users can change images during broadcast**
12. ✅ **For all users - Admin/CEO/Broadcasters/Guests**
