import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gejtbllazzighxwxudyu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlanRibGxhenppZ2h4d3h1ZHl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE5NDk2MiwiZXhwIjoyMTAwNzcwOTYyfQ.cbE9pSa4QEilB6S3J4PyCfC8RiqVwlN2FSaEgUC8_H4'
);

async function checkPolicies() {
  // Use a raw query via rpc if available, otherwise try information_schema
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `SELECT policyname, permissive, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('streams', 'stream_viewers') ORDER BY tablename, cmd, policyname;`
  });

  if (error) {
    console.log('exec_sql not available, trying alternative approach...');
    
    // Try to check via a different method
    const { data: policies, error: policyError } = await supabase
      .from('pg_policies')
      .select('*')
      .or('tablename.eq.streams,tablename.eq.stream_viewers');
    
    if (policyError) {
      console.log('Cannot query pg_policies directly either');
    } else {
      console.log('Policies:', JSON.stringify(policies, null, 2));
    }
    return;
  }
  
  console.log('Policies:');
  console.log(JSON.stringify(data, null, 2));
}

async function checkAdminStreams() {
  // Check if there are any admin streams
  const { data: adminStreams, error } = await supabase
    .from('streams')
    .select('id, title, status, is_live, broadcaster_id, user_id')
    .eq('is_live', true)
    .limit(5);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Live streams:', JSON.stringify(adminStreams, null, 2));
  }
}

async function testJoinAsAnon() {
  // Test the join_stream_as_viewer function as anon
  const { data, error } = await supabase.rpc('join_stream_as_viewer', {
    p_stream_id: '58df857d-9529-4c3c-bac3-97005c5a9606',
    p_user_id: null,
    p_guest_id: 'test-guest-123'
  });

  if (error) {
    console.error('Join as anon error:', error);
  } else {
    console.log('Join as anon result:', JSON.stringify(data, null, 2));
  }
}

checkPolicies().then(() => {
  checkAdminStreams().then(() => {
    testJoinAsAnon().catch(console.error);
  });
}).catch(console.error);
