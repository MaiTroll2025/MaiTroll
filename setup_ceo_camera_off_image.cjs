#!/usr/bin/env node
/**
 * Upload CEO's camera-off image to Supabase and set it in user profile
 * 
 * Usage: node setup_ceo_camera_off_image.cjs <local_image_path> <user_id>
 * Example: node setup_ceo_camera_off_image.cjs "C:\Users\kainm\Downloads\c062c1c2-9fc2-4cb6-912e-8d21d81fc28e.png" "3da9479f-2fb1-49d3-8b6a-a2bf25873d31"
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read env.example
function readEnvExample() {
  const envPath = path.join(__dirname, 'env.example');
  if (!fs.existsSync(envPath)) {
    console.error('❌ env.example file not found');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    const [key, ...valueParts] = line.split('=');
    if (key) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return env;
}

const env = readEnvExample();
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing credentials in env.example:');
  if (!supabaseUrl) console.error('  - VITE_SUPABASE_URL or SUPABASE_URL');
  if (!supabaseServiceRoleKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function uploadCEOCameraOffImage() {
  const imagePath = process.argv[2];
  const userId = process.argv[3];

  if (!imagePath || !userId) {
    console.error('❌ Usage: node setup_ceo_camera_off_image.cjs <local_image_path> <user_id>');
    console.error('Example: node setup_ceo_camera_off_image.cjs "C:\\Users\\kainm\\Downloads\\image.png" "3da9479f-2fb1-49d3-8b6a-a2bf25873d31"');
    process.exit(1);
  }

  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ Image file not found: ${imagePath}`);
      process.exit(1);
    }

    console.log('📁 Reading image file:', imagePath);
    const fileBuffer = fs.readFileSync(imagePath);
    const fileName = path.basename(imagePath);
    const fileExt = path.extname(fileName).replace('.', '') || 'jpg';

    console.log('📤 Uploading to Supabase...');
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.${fileExt}`;

    // Determine MIME type
    const mimeType = getMimeType(fileExt);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('camera-off-images')
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
      process.exit(1);
    }

    console.log('✅ Image uploaded successfully');
    console.log('📍 Storage path:', filePath);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('camera-off-images')
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl;
    console.log('🔗 Public URL:', publicUrl);

    // Update user profile
    console.log('💾 Updating user profile...');
    const { data: updateData, error: updateError } = await supabase
      .from('user_profiles')
      .update({ camera_off_image_url: publicUrl })
      .eq('id', userId)
      .select();

    if (updateError) {
      console.error('❌ Profile update failed:', updateError.message);
      process.exit(1);
    }

    if (!updateData || updateData.length === 0) {
      console.error('❌ User not found:', userId);
      process.exit(1);
    }

    console.log('✅ User profile updated successfully');
    console.log('\n✨ Camera-off image setup complete!');
    console.log('   User ID:', userId);
    console.log('   Image URL:', publicUrl);
    console.log('\n✏️  The image will now display when the broadcaster turns off their camera.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

function getMimeType(ext) {
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
  };
  return mimeTypes[ext.toLowerCase()] || 'image/jpeg';
}

uploadCEOCameraOffImage();
