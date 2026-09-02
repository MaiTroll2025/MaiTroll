#!/usr/bin/env node
/**
 * Create camera-off-images storage bucket and set RLS policies
 * 
 * This script reads from env.example and creates the storage bucket
 * 
 * Usage: node create_camera_off_images_bucket.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function createBucket() {
  try {
    console.log('🔍 Checking if bucket exists...');
    
    // Try to list the bucket to see if it exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Failed to list buckets:', listError.message);
      process.exit(1);
    }

    const bucketExists = buckets?.some(b => b.name === 'camera-off-images');

    if (bucketExists) {
      console.log('✅ Bucket already exists: camera-off-images');
    } else {
      console.log('📦 Creating bucket: camera-off-images');
      
      const { data, error } = await supabase.storage.createBucket('camera-off-images', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp'
        ]
      });

      if (error) {
        console.error('❌ Failed to create bucket:', error.message);
        process.exit(1);
      }

      console.log('✅ Bucket created successfully');
    }

    console.log('\n📋 Bucket details:');
    console.log('   Name: camera-off-images');
    console.log('   Public: Yes');
    console.log('   Max file size: 10MB');
    console.log('   Allowed types: JPEG, PNG, GIF, WebP, BMP');

    console.log('\n✨ Storage bucket is ready!');
    console.log('   You can now upload camera-off images.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createBucket();
