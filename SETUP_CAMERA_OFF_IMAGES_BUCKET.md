# Quick Setup: Create camera-off-images Storage Bucket

You're getting a "Bucket not found" error because the storage bucket needs to be created first. Choose one of these methods:

## Method 1: Automated Script (Recommended)

```bash
# Run this command to create the bucket automatically
node create_camera_off_images_bucket.cjs
```

That's it! The script will:
- ✅ Create the `camera-off-images` bucket
- ✅ Set it to public
- ✅ Configure file size limits (10MB max)
- ✅ Restrict to image file types

Then you can immediately run:
```bash
node setup_ceo_camera_off_image.cjs "C:\Users\kainm\Downloads\c062c1c2-9fc2-4cb6-912e-8d21d81fc28e.png" "3da9479f-2fb1-49d3-8b6a-a2bf25873d31"
```

---

## Method 2: Manual Setup via Supabase Dashboard

1. **Go to Supabase Dashboard**
   - Open: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/storage/buckets

2. **Create Bucket**
   - Click **"Create a new bucket"** button
   - Bucket name: `camera-off-images`
   - ✅ Make it **Public** (check the box)
   - Click **"Create bucket"**

3. **Verify**
   - You should see `camera-off-images` in your bucket list
   - Status should show "Public"

4. **Then run the upload script**
   ```bash
   node setup_ceo_camera_off_image.cjs "C:\Users\kainm\Downloads\c062c1c2-9fc2-4cb6-912e-8d21d81fc28e.png" "3da9479f-2fb1-49d3-8b6a-a2bf25873d31"
   ```

---

## Method 3: SQL in Supabase Dashboard

If you prefer SQL, go to SQL Editor and run:

```sql
-- The bucket creation needs to happen via API or dashboard UI
-- SQL cannot create buckets. Use Method 1 or 2 instead.

-- But you CAN verify it exists after creation:
SELECT id, name, owner, public, file_size_limit, created_at 
FROM storage.buckets 
WHERE name = 'camera-off-images';
```

---

## Troubleshooting

### Still getting "Bucket not found" after creation?
1. Refresh the browser (hard refresh: Ctrl+Shift+R)
2. Wait 10-15 seconds for the bucket to sync across regions
3. Try uploading again

### Bucket created but upload fails?
1. Check that the bucket is **Public** (not Private)
2. Verify the image file exists at the path provided
3. Check file size is under 10MB
4. Try a different image file

### Environment variables not set?
Make sure these are in your `.env.local`:
```
VITE_SUPABASE_URL=https://gejtbllazzighxwxudyu.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

To get these values:
1. Go to Supabase Dashboard → Project Settings → API
2. Find your URL and keys there
3. Add to `.env.local` file

---

## Complete Setup Flow

```bash
# 1. Create the bucket
node create_camera_off_images_bucket.cjs

# 2. Upload CEO's image
node setup_ceo_camera_off_image.cjs "C:\Users\kainm\Downloads\c062c1c2-9fc2-4cb6-912e-8d21d81fc28e.png" "3da9479f-2fb1-49d3-8b6a-a2bf25873d31"

# 3. Done! Users can now:
#    - Upload images via SetupPage
#    - Change images during broadcast via modal
#    - See camera-off images when broadcasters turn off camera
```

---

## What Happens Next

After successful bucket creation and image upload:

✅ CEO account will have the image set as camera-off display  
✅ All broadcasters can upload their own images  
✅ During broadcast, users can access the modal to change their image  
✅ When camera is off, the image displays fullscreen  
✅ When camera is on, normal video feed shows  

**Need more help?** Check `CAMERA_OFF_IMAGE_SETUP.md` for detailed documentation.
