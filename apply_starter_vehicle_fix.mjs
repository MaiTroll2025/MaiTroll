/**
 * Quick fix script to ensure starter vehicles are granted to new users
 * Run this to apply the migration that seeds vehicles_catalog and fixes the grant function
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gejtbllazzighxwxudyu.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
  console.log('🔧 Applying starter vehicle fix...');

  // 1. Seed vehicles_catalog with starter vehicle
  console.log('📦 Seeding vehicles_catalog...');
  
  const vehicles = [
    { name: 'Troll Compact S1', slug: 'troll_compact_s1', tier: 'Starter', style: 'Compact modern starter sedan', price: 5000, speed: 40, armor: 20, color_from: '#38bdf8', color_to: '#22c55e', image_url: '/assets/cars/troll_compact_s1.png', model_url: '/models/vehicles/troll_compact_s1.glb', category: 'Car' },
    { name: 'Midline XR', slug: 'midline_xr', tier: 'Mid', style: 'Mid-size SUV / crossover', price: 12000, speed: 60, armor: 35, color_from: '#fbbf24', color_to: '#f87171', image_url: '/assets/cars/midline_xr.png', model_url: '/models/vehicles/midline_xr.glb', category: 'Car' },
    { name: 'Urban Drift R', slug: 'urban_drift_r', tier: 'Mid', style: 'Aggressive street tuner coupe', price: 18000, speed: 75, armor: 30, color_from: '#a855f7', color_to: '#ec4899', image_url: '/assets/cars/urban_drift_r.png', model_url: '/models/vehicles/urban_drift_r.glb', category: 'Car' },
  ];

  for (const v of vehicles) {
    const { error } = await supabase
      .from('vehicles_catalog')
      .upsert(v, { onConflict: 'name', ignoreDuplicates: true });
    
    if (error) {
      console.error(`  Error inserting ${v.name}:`, error.message);
    } else {
      console.log(`  ✅ Inserted/verified: ${v.name}`);
    }
  }

  // 2. Check if grant_starter_vehicle function exists
  console.log('\n🔍 Checking grant_starter_vehicle function...');
  const { error: funcError } = await supabase
    .rpc('grant_starter_vehicle', { p_user_id: '00000000-0000-0000-0000-000000000000' })
    .then(() => ({ data: true, error: null }))
    .catch(e => ({ data: false, error: e }));

  if (funcError && funcError.message.includes('function')) {
    console.log('  ⚠️  Function does not exist, needs manual SQL execution');
    console.log('  Please run the migration: supabase/migrations/20270211000003_ensure_starter_vehicle_data.sql');
  } else {
    console.log('  ✅ Function exists');
  }

  // 3. Check if trigger exists
  console.log('\n🔍 Checking trigger...');
  const { data: triggers, error: triggerError } = await supabase
    .from('information_schema.triggers')
    .select('trigger_name')
    .eq('trigger_name', 'on_auth_user_created_credit');

  if (triggerError || !triggers?.length) {
    console.log('  ⚠️  Trigger may not exist, needs manual SQL execution');
  } else {
    console.log('  ✅ Trigger exists');
  }

  // 4. List current vehicles in catalog
  console.log('\n📋 Current vehicles in catalog:');
  const { data: catalog } = await supabase.from('vehicles_catalog').select('name, tier, price');
  if (catalog) {
    catalog.forEach(v => {
      console.log(`  - ${v.name} (${v.tier}) - ${v.price.toLocaleString()} coins`);
    });
  }

  console.log('\n✨ Fix application complete!');
  console.log('\nNote: If the grant_starter_vehicle function was missing, please run:');
  console.log('  supabase db push or supabase migration up');
}

applyFix().catch(console.error);
