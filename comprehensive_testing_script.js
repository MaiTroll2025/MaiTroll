// ===================================================
// COMPREHENSIVE TESTING SCRIPT
// ===================================================
// Mai Troll2 - Test all critical functionality
// Date: 2025-12-09
// ===================================================

import { createClient } from '@supabase/supabase-js'
// import { toast } from 'sonner'

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'your_supabase_url'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your_anon_key'
const EDGE_FUNCTIONS_URL = process.env.VITE_EDGE_FUNCTIONS_URL || 'https://your-project.supabase.co/functions/v1'

// Initialize Supabase client
// Use service role key if available for comprehensive testing (bypasses RLS)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
}

// Utility functions
function logTest(testName, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL'
  console.log(`${status} ${testName}${message ? ': ' + message : ''}`)
  
  testResults.details.push({
    test: testName,
    passed,
    message
  })
  
  if (passed) {
    testResults.passed++
  } else {
    testResults.failed++
  }
  testResults.total++
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`)
}

// function logError(message) {
//   console.error(`🚨 ${message}`)
// }

// Test functions
async function testDatabaseConnection() {
  logInfo('Testing database connection...')
  
  try {
    const { error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)
    
    if (error) throw error
    
    logTest('Database Connection', true, 'Successfully connected to database')
    return true
  } catch (error) {
    logTest('Database Connection', false, error.message)
    return false
  }
}

async function testUserProfiles() {
  logInfo('Testing user profiles table...')
  
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, troll_coins, troll_coins, og_badge')
      .limit(5)
    
    if (error) throw error
    
    const hasOgBadge = data.some(user => user.og_badge === true)
    const hasValidBalances = data.every(user => 
      typeof user.troll_coins === 'number' && 
      typeof user.troll_coins === 'number'
    )
    
    logTest('User Profiles', true, `Found ${data.length} users`)
    logTest('OG Badge System', hasOgBadge, 'OG badge system is working')
    logTest('Coin Balances', hasValidBalances, 'Coin balances are valid')
    
    return true
  } catch (error) {
    logTest('User Profiles', false, error.message)
    return false
  }
}


async function testRiskTables() {
  logInfo('Testing risk management tables...')
  
  try {
    // Test user_risk_profile table
    const { error: riskError } = await supabase
      .from('user_risk_profile')
      .select('*')
      .limit(1)
    
    if (riskError) throw riskError
    
    // Test risk_events table
    const { error: eventsError } = await supabase
      .from('risk_events')
      .select('*')
      .limit(1)
    
    if (eventsError) throw eventsError
    
    logTest('Risk Profile Table', true, 'Risk profile table exists')
    logTest('Risk Events Table', true, 'Risk events table exists')
    
    return true
  } catch (error) {
    logTest('Risk Tables', false, error.message)
    return false
  }
}

async function testBroadcasterEarnings() {
  logInfo('Testing broadcaster earnings table...')
  
  try {
    const { error } = await supabase
      .from('broadcaster_earnings')
      .select('*')
      .limit(1)
    
    if (error) throw error
    
    logTest('Broadcaster Earnings', true, 'Broadcaster earnings table exists')
    return true
  } catch (error) {
    logTest('Broadcaster Earnings', false, error.message)
    return false
  }
}

async function testEdgeFunctions() {
  logInfo('Testing edge functions...')
  
  const functionsToTest = [
    'paypal-create-order',
    'paypal-complete-order',
    'officer-auto-clockout',
    'toggle-ghost-mode'
  ]
  
  for (const funcName of functionsToTest) {
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/${funcName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ test: true })
      })
      
      // We expect some functions to return errors, but we want to verify they're accessible
      const isAccessible = response.status < 500 // Not a server error
      
      logTest(`Edge Function: ${funcName}`, isAccessible, `Status: ${response.status}`)
    } catch (error) {
      logTest(`Edge Function: ${funcName}`, false, error.message)
    }
  }
}

async function testCoinEconomy() {
  logInfo('Testing coin economy system...')
  
  try {
    // Test coin transactions table
    const { data: transactions, error: transError } = await supabase
      .from('coin_transactions')
      .select('*')
      .limit(5)
    
    if (transError) throw transError
    
    logTest('Coin Transactions', true, `Found ${transactions.length} transactions`)
    
    return true
  } catch (error) {
    logTest('Coin Economy', false, error.message)
    return false
  }
}

async function testPayPalIntegration() {
  logInfo('Testing PayPal integration...')
  
  try {
    // Check if PayPal environment variables are set
    const hasClientId = !!process.env.VITE_PAYPAL_CLIENT_ID
    
    logTest('PayPal Client ID', hasClientId, hasClientId ? 'Configured' : 'Missing')
    
    // Test PayPal create order function
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/paypal-create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: 6.49,
          coins: 500,
          user_id: 'test-user-id'
        })
      })
      
      const isAccessible = response.status < 500
      logTest('PayPal Create Order Function', isAccessible, `Status: ${response.status}`)
    } catch (error) {
      logTest('PayPal Create Order Function', false, error.message)
    }
    
    return true
  } catch (error) {
    logTest('PayPal Integration', false, error.message)
    return false
  }
}

async function testOfficerSystem() {
  logInfo('Testing officer system...')
  
  try {
    // Check if officer tables exist
    const { error: actionsError } = await supabase
      .from('officer_actions')
      .select('*')
      .limit(1)
    
    if (actionsError && !actionsError.message.includes('does not exist')) {
      throw actionsError
    }
    
    const { error: earningsError } = await supabase
      .from('officer_earnings')
      .select('*')
      .limit(1)
    
    if (earningsError && !earningsError.message.includes('does not exist')) {
      throw earningsError
    }
    
    logTest('Officer Actions Table', !actionsError, actionsError ? 'Table needs to be created' : 'Table exists')
    logTest('Officer Earnings Table', !earningsError, earningsError ? 'Table needs to be created' : 'Table exists')
    
    return true
  } catch (error) {
    logTest('Officer System', false, error.message)
    return false
  }
}

async function runAllTests() {
  console.log('🚀 Starting Mai Troll2 Comprehensive Testing')
  console.log('=' .repeat(50))
  
  // Wait a moment for imports to settle
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Run all tests
  await testDatabaseConnection()
  console.log('')
  
  await testUserProfiles()
  console.log('')
  
  await testRiskTables()
  console.log('')
  
  await testBroadcasterEarnings()
  console.log('')
  
  await testCoinEconomy()
  console.log('')
  
  await testPayPalIntegration()
  console.log('')
  
  await testOfficerSystem()
  console.log('')
  
  await testEdgeFunctions()
  console.log('')
  
  // Print final results
  console.log('=' .repeat(50))
  console.log('🏁 TESTING COMPLETE')
  console.log('=' .repeat(50))
  console.log(`Total Tests: ${testResults.total}`)
  console.log(`Passed: ${testResults.passed} ✅`)
  console.log(`Failed: ${testResults.failed} ❌`)
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`)
  console.log('')
  
  if (testResults.failed > 0) {
    console.log('❌ Failed Tests:')
    testResults.details
      .filter(test => !test.passed)
      .forEach(test => {
        console.log(`  - ${test.test}: ${test.message}`)
      })
    console.log('')
  }
  
  if (testResults.passed === testResults.total) {
    console.log('🎉 ALL TESTS PASSED! Your Mai Troll2 deployment is ready!')
  } else {
    console.log('⚠️  Some tests failed. Please review and fix the issues above.')
  }
  
  return testResults
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0)
    })
    .catch(error => {
      console.error('Testing script error:', error)
      process.exit(1)
    })
}

export { runAllTests, testResults }