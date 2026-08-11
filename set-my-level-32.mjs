#!/usr/bin/env node

/**
 * Quick script to set your own level to 32
 * This uses the Supabase client to directly update your level
 * Usage: node set-my-level-32.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load env vars
function loadEnv() {
  try {
    const envContent = readFileSync('.env', 'utf-8')
    const env = {}
    envContent.split('\n').forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=')
        const value = valueParts.join('=').trim()
        if (key && value) {
          env[key.trim()] = value
        }
      }
    })
    return env
  } catch (err) {
    console.error('❌ Error loading .env file:', err.message)
    return {}
  }
}

const env = loadEnv()
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://gejtbllazzighxwxudyu.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  console.log('\n💡 To use this script, set the service role key:')
  console.log('   Windows CMD: set SUPABASE_SERVICE_ROLE_KEY=your_key')
  console.log('   Windows PowerShell: $env:SUPABASE_SERVICE_ROLE_KEY="your_key"')
  console.log('   Linux/Mac: export SUPABASE_SERVICE_ROLE_KEY="your_key"\n')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function setMyLevel() {
  try {
    const userId = process.argv[2]

    if (!userId) {
      console.log('💡 Usage: node set-my-level-32.mjs <your-user-id>')
      console.log('\n📋 To find your user ID:')
      console.log('   1. Open your browser DevTools (F12)')
      console.log('   2. Go to Console and run:')
      console.log('      const { data } = await supabase.auth.getUser(); console.log(data.user.id)')
      console.log('   3. Copy the ID and run this script with it')
      return
    }

    console.log('\n🔄 Setting your level to 32...\n')

    // Get current level
    const { data: current, error: fetchErr } = await supabase
      .from('user_levels')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchErr || !current) {
      console.error('❌ Could not find your level data')
      return
    }

    console.log('📊 Current Level Data:')
    console.log(`   Level: ${current.level}`)
    console.log(`   XP: ${current.xp}`)
    console.log(`   Total XP: ${current.total_xp}\n`)

    // Update to level 32
    const { data: updated, error: updateErr } = await supabase
      .from('user_levels')
      .update({
        level: 32,
        xp: 3200,        // Start of level 32
        total_xp: 49600, // Total XP to reach level 32
        next_level_xp: 3300,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()

    if (updateErr) {
      console.error('❌ Update failed:', updateErr.message)
      return
    }

    console.log('✅ Success! Your level has been set to 32\n')
    console.log('📊 New Level Data:')
    console.log(`   Level: ${updated[0].level}`)
    console.log(`   XP: ${updated[0].xp}`)
    console.log(`   Total XP: ${updated[0].total_xp}`)
    console.log(`   Next Level XP: ${updated[0].next_level_xp}\n`)
    console.log('💡 Refresh your app to see the changes!')

  } catch (err) {
    console.error('❌ Error:', err.message)
  }
}

setMyLevel()
