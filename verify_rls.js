import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gejtbllazzighxwxudyu.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const TARGET_ID = '8dff9f37-21b5-4b8e-adc2-b9286874be1a'

async function verifyRls() {
  console.log('Starting RLS Verification...')
  
  // 1. Create Test User
  const email = `test_rls_${Date.now()}@example.com`
  const password = 'TestPassword123!'
  console.log(`Creating test user: ${email}`)
  
  const { data: { user }, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })
  
  if (createError) {
    console.error('Failed to create test user:', createError)
    return
  }
  
  console.log(`Test user created: ${user.id}`)
  
  try {
    // 2. Sign In as Test User
    const { data: { session: _session }, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password
    })
    
    if (signInError) {
      console.error('Failed to sign in:', signInError)
      return
    }
    
    console.log('Signed in successfully.')
    
    // 3. Try to Fetch Target Profile (Simulating Profile.tsx)
    console.log(`Attempting to fetch profile ${TARGET_ID} as authenticated user...`)
    const { data: profile, error: profileError } = await anonClient
      .from('user_profiles')
      .select('*, avatar_url')
      .eq('id', TARGET_ID)
      .maybeSingle()
      
    if (profileError) {
      console.error('❌ Fetch Error:', profileError)
    } else if (!profile) {
      console.error('❌ Profile NOT FOUND (RLS likely blocking)')
    } else {
      console.log('✅ Profile FOUND:', profile.username)
    }

    // 4. Try to Insert Notification (Checking sender_id error)
    console.log(`Attempting to insert notification...`)
    const { error: notifError } = await anonClient
      .from('notifications')
      .insert({
        user_id: user.id, // self
        type: 'message',
        title: 'Test',
        message: 'Test Message',
        is_read: false
      })
      
    if (notifError) {
      console.error('❌ Notification Insert Error:', notifError)
    } else {
      console.log('✅ Notification Insert OK')
    }

  } finally {
    // Cleanup
    console.log('Cleaning up test user...')
    await adminClient.auth.admin.deleteUser(user.id)
  }
}

verifyRls()
