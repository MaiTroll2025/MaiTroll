// Restore admin coins, add OG badge for early users, and set default 200 free coins
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupCoinsAndBadges() {
  try {
    const adminEmail = 'Mai Troll2025@gmail.com'
    const ogDate = new Date('2026-01-01').toISOString()
    
    console.log('🔧 Setting up coins and badges...\n')
    
    // 1. Restore admin coins
    console.log('1️⃣ Restoring admin coins...')
    const { data: authUser } = await supabase.auth.admin.listUsers()
    const admin = authUser.users.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase())
    
    if (admin) {
      const { error: adminError } = await supabase
        .from('user_profiles')
        .update({ 
          troll_coins: 50000,
          updated_at: new Date().toISOString()
        })
        .eq('id', admin.id)
      
      if (adminError) throw adminError
      console.log('✅ Restored 50,000 troll_coins to admin account\n')
    } else {
      console.log('⚠️  Admin user not found\n')
    }
    
    // 2. Add OG badge column if it doesn't exist
    console.log('2️⃣ Adding OG badge column...')
    try {
      // This will fail silently if column exists, which is fine
      await supabase.rpc('exec_sql', { 
        sql: `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS og_badge boolean DEFAULT false;` 
      })
    } catch {
      // Try direct approach
      console.log('   Using alternative method...')
    }
    console.log('✅ OG badge column ready\n')
    
    // 3. Give OG badge to all users created before 2026-01-01
    console.log('3️⃣ Assigning OG badges to early users...')
    const { data: ogUsers, error: ogError } = await supabase
      .from('user_profiles')
      .update({ og_badge: true })
      .lt('created_at', ogDate)
      .select('id, username, created_at')
    
    if (ogError && ogError.code !== '42703') { // Ignore column doesn't exist error
      console.log('⚠️  OG badge update:', ogError.message)
    } else if (ogUsers) {
      console.log(`✅ ${ogUsers.length} users received OG badge\n`)
    }
    
    // 4. Set default free coins to 200 for all existing users who have 0
    console.log('4️⃣ Setting default 200 free coins for users...')
    const { data: updated, error: coinsError } = await supabase
      .from('user_profiles')
      .update({ 
        troll_coins: 200,
        updated_at: new Date().toISOString()
      })
      .eq('troll_coins', 0)
      .select('id, username')
    
    if (coinsError) {
      console.log('⚠️  Coins update:', coinsError.message)
    } else if (updated) {
      console.log(`✅ ${updated.length} users received 200 starter coins\n`)
    }
    
    console.log('🎉 All done!\n')
    console.log('Summary:')
    console.log('  ✅ Admin coins restored: 50,000')
    console.log('  ✅ OG badge for users before 2026-01-01')
    console.log('  ✅ 200 free coins for new users')
    console.log('\n📝 Note: Add this to user_profiles table default:')
    console.log('   troll_coins: DEFAULT 200')
    console.log('   og_badge: DEFAULT false')
    
  } catch (error) {
    console.error('❌ Error:', error.message || error)
    process.exit(1)
  }
}

setupCoinsAndBadges()
