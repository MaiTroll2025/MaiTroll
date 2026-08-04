
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runDiagnostics() {
  console.log('🚀 Starting Mai Troll Diagnostics...');
  console.log(`Target: ${supabaseUrl}`);

  // 1. Database Connection Check
  console.log('\n--- 1️⃣ DATABASE CHECK ---');
  const { error: dbError } = await supabase.from('user_profiles').select('count').limit(1).single();
  if (dbError) {
    console.error('❌ Database connection failed:', dbError.message);
    return;
  }
  console.log('✅ Database connected.');

  // 2. Gift System Stress Test
  console.log('\n--- 2️⃣ GIFT SYSTEM STRESS TEST ---');
  
  // Get a test user
  const { data: users } = await supabase.from('user_profiles').select('id').limit(2);
  if (!users || users.length < 2) {
    console.error('❌ Need at least 2 users for gift test');
  } else {
    const sender = users[0].id;
    const receiver = users[1].id;
    const iterations = 50; // "Gift Bomb" size

    console.log(`Sender: ${sender}`);
    console.log(`Receiver: ${receiver}`);
    console.log(`Simulating ${iterations} concurrent gifts...`);

    // Give sender some coins first (direct DB update for test)
    await supabase.from('user_profiles').update({ troll_coins: 1000000 }).eq('id', sender);

    const startTime = Date.now();
    const promises = [];
    
    for (let i = 0; i < iterations; i++) {
      // Use RPC if possible, else insert directly to ledger to simulate
      // We use direct insert because we are admin here and want to test the LEDGER throughput
      const p = supabase.from('gift_ledger').insert({
        sender_id: sender,
        receiver_id: receiver,
        gift_id: 'stress_test_gift',
        amount: 10,
        status: 'pending',
        idempotency_key: `stress_${Date.now()}_${i}`
      });
      promises.push(p);
    }

    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);
    const success = results.length - errors.length;
    const duration = (Date.now() - startTime) / 1000;

    console.log(`✅ Sent ${success}/${iterations} gifts in ${duration.toFixed(2)}s`);
    console.log(`⚡ Throughput: ${(success / duration).toFixed(2)} gifts/sec (Write only)`);

    if (errors.length > 0) console.error('Sample Error:', errors[0].error);

    // Process Batch
    console.log('Processing Batch...');
    const batchStart = Date.now();
    const { data: batchResult, error: batchError } = await supabase.rpc('process_gift_ledger_batch', { p_batch_size: 1000 });
    const batchDuration = (Date.now() - batchStart) / 1000;

    if (batchError) {
        console.error('❌ Batch Processing Failed:', batchError);
    } else {
        console.log('✅ Batch Result:', batchResult);
        console.log(`⚡ Processing Time: ${batchDuration.toFixed(2)}s`);
    }
  }

  // 3. Chat Stress Test (DB Insert Latency)
  console.log('\n--- 3️⃣ CHAT STRESS TEST (DB INSERTS) ---');
  if (users && users.length > 0) {
      const chatter = users[0].id;
      const chatIterations = 50;
      // Need a stream ID - try to find one or create dummy
      let streamId = '00000000-0000-0000-0000-000000000000';
      await supabase.from('streams').select('id').limit(1); // Assuming 'streams' table exists?
      // Wait, table might be 'broadcasts' or similar. 
      // Checking BroadcastChat.tsx -> 'stream_messages' has 'stream_id'.
      // I'll just use a random UUID, it might violate FK if enforced.
      // Let's check if FK is enforced on stream_messages.stream_id.
      // Assuming it is, I need a valid stream.
      
      // Attempt to find a stream
      await supabase.from('active_streams').select('id').limit(1); // guessing view name
      // Or 'streams' table
      const { data: streamTable } = await supabase.from('streams').select('id').limit(1);
      
      if (streamTable && streamTable.length > 0) streamId = streamTable[0].id;
      
      console.log(`Chatting in Stream: ${streamId}`);
      console.log(`Sending ${chatIterations} messages concurrently...`);
      
      const chatStart = Date.now();
      const chatPromises = [];
      for (let i = 0; i < chatIterations; i++) {
          chatPromises.push(
              supabase.from('stream_messages').insert({
                  stream_id: streamId,
                  user_id: chatter,
                  content: `Stress Test Message ${i}`
              })
          );
      }
      
      const chatResults = await Promise.all(chatPromises);
      const chatErrors = chatResults.filter(r => r.error);
      const chatDuration = (Date.now() - chatStart) / 1000;
      
      console.log(`✅ Sent ${chatIterations - chatErrors.length}/${chatIterations} messages in ${chatDuration.toFixed(2)}s`);
      console.log(`⚡ DB Insert Rate: ${((chatIterations - chatErrors.length) / chatDuration).toFixed(2)} msgs/sec`);
      
      if (chatErrors.length > 0) {
          console.error('❌ Chat Error (FK violation?):', chatErrors[0].error.message);
      }
  }

  // 4. Leaderboard Check
  console.log('\n--- 4️⃣ LEADERBOARD CHECK ---');
  // Check if broadcaster_stats is populated
  const { count: statsCount } = await supabase.from('broadcaster_stats').select('*', { count: 'exact', head: true });
  console.log(`Entries in broadcaster_stats (Optimized Table): ${statsCount}`);
  
  if (statsCount === 0) {
      console.warn('⚠️ broadcaster_stats is EMPTY. Leaderboards might be using slow query!');
  }

}

runDiagnostics().catch(console.error);
