import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gejtbllazzighxwxudyu.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const TARGET_ID = '8dff9f37-21b5-4b8e-adc2-b9286874be1a'

async function checkDbStatus() {
  console.log('Starting DB check...')
  console.log('\n=== CHECKING DB STATUS ===\n')

  // 1. Check User Existence
  console.log(`Checking user ID: ${TARGET_ID}`)
  
  try {
    // Check auth.users
    const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUserById(TARGET_ID)
    if (authError) {
      console.log(`❌ Auth User Check Failed: ${authError.message}`)
    } else if (authUser) {
      console.log(`✅ Found in auth.users: ${authUser.email}`)
    } else {
      console.log(`❌ Not found in auth.users`)
    }

    // Check user_profiles
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', TARGET_ID)
      .single()
    
    if (profileError) {
      console.log(`❌ Profile Check Failed: ${profileError.message}`)
    } else if (profile) {
      console.log(`✅ Found in user_profiles: @${profile.username}`)
    } else {
      console.log(`❌ Not found in user_profiles`)
    }

    // 2. Check Notifications Table Schema
    console.log('\nChecking notifications table schema...')
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .limit(1)
    
    if (notifError) {
      console.log(`❌ Notifications Select Failed: ${notifError.message}`)
    } else if (notifications && notifications.length > 0) {
      console.log(`✅ Notifications Columns: ${Object.keys(notifications[0]).join(', ')}`)
    } else {
      console.log(`⚠️ Notifications table empty or select returned no rows.`)
       // Attempt to select 'sender_id' specifically
       const { error: colError } = await supabase
       .from('notifications')
       .select('sender_id')
       .limit(1)
     if (colError) {
         console.log(`❌ 'sender_id' column check failed: ${colError.message}`)
     } else {
         console.log(`✅ 'sender_id' column exists (or at least query didn't fail).`)
     }
    }

    // 3. Check Troll Wall Posts Permissions
    console.log('\nChecking troll_wall_posts permissions...')
    const { error: wallError } = await supabase
      .from('troll_wall_posts')
      .select('*')
      .limit(1)
    
    if (wallError) {
      console.log(`❌ Troll Wall Select Failed: ${wallError.message}`)
    } else {
      console.log(`✅ Troll Wall Select OK`)
    }
  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

checkDbStatus()
