// Test script to check if signup edge function is deployed and reachable
async function testSignupFunction() {
  const url = 'https://gejtbllazzighxwxudyu.supabase.co/functions/v1/signup';
  const anonKey = 'sb_publishable_GVheE6oivAY558QfBgBqzQ_szoqEcjy';
  
  console.log('Testing signup function...');
  console.log('URL:', url);
  
  // Test 1: OPTIONS request (CORS preflight)
  try {
    console.log('\n1. Testing OPTIONS (CORS preflight)...');
    const optionsResponse = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5178',
        'apikey': anonKey,
      },
    });
    
    console.log('   Status:', optionsResponse.status);
    console.log('   Headers:', {
      'access-control-allow-origin': optionsResponse.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': optionsResponse.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': optionsResponse.headers.get('access-control-allow-headers'),
    });
  } catch (error) {
    console.error('   OPTIONS failed:', error.message);
  }
  
  // Test 2: POST request
  try {
    console.log('\n2. Testing POST...');
    const postResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Origin': 'http://localhost:5178',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpass123',
        username: 'testuser',
        role: 'user',
        data: {
          terms_accepted: true,
          accepted_at: new Date().toISOString(),
        }
      }),
    });
    
    console.log('   Status:', postResponse.status);
    const text = await postResponse.text();
    console.log('   Response:', text.substring(0, 200));
  } catch (error) {
    console.error('   POST failed:', error.message);
  }
}

testSignupFunction().catch(console.error);
