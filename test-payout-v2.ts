/**
 * Test Payout Setup - Edge Function Version
 * This creates the payout request by calling a helper function that bypasses triggers
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_USER_ID = 'aab07dfc-3304-4553-a1db-fa410f264ead';
const TEST_PAYPAL_EMAIL = 'Mai Troll2025@gmail.com';
const TEST_COINS = 5000;
const TEST_USD = 1.00;

async function main() {
  console.log('=== Starting Payout Test (Edge Function) ===\n');

  try {
    // Step 1: Add coins to user and set PayPal email
    console.log('Step 1: Adding coins and setting PayPal email...');
    
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        troll_coins: TEST_COINS,
        payout_paypal_email: TEST_PAYPAL_EMAIL
      })
      .eq('id', TEST_USER_ID);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }
    console.log('✓ Profile updated - Coins: 5000, PayPal email set\n');

    // Step 2: Create payout request using Edge Function
    console.log('Step 2: Creating payout request via Edge Function...');
    
    // Call the payout-request API which should handle this properly
    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payout-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use service role key for admin access
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        user_id: TEST_USER_ID,
        amount_coins: TEST_COINS,
        amount_usd: TEST_USD,
        currency: 'USD'
      })
    });

    const result = await response.json();
    
    if (!response.ok || result.error) {
      console.error('Payout request API error:', result.error || response.statusText);
      throw new Error(result.error || 'Failed to create payout request');
    }
    
    console.log(`✓ Payout request created: ${result.payout_request?.id}\n`);

    // Step 3: Create payout batch
    console.log('Step 3: Creating payout batch...');
    
    const { data: batch, error: batchError } = await supabase
      .from('payout_batches')
      .insert({
        week_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        week_end: new Date().toISOString().split('T')[0],
        payout_date: new Date().toISOString(),
        status: 'pending',
        total_amount: TEST_USD,
        total_requests: 1
      })
      .select()
      .single();

    if (batchError) {
      console.error('Error creating batch:', batchError);
      throw batchError;
    }
    console.log(`✓ Payout batch created: ${batch.id}\n`);

    // Step 4: Link payout request to batch
    console.log('Step 4: Linking payout request to batch...');
    
    const { error: linkError } = await supabase
      .from('payout_requests')
      .update({ batch_id: batch.id })
      .eq('id', result.payout_request.id);

    if (linkError) {
      console.error('Error linking request to batch:', linkError);
      throw linkError;
    }
    console.log('✓ Payout request linked to batch\n');

    // Step 5: Display summary
    console.log('=== Test Setup Complete ===');
    console.log(`User ID: ${TEST_USER_ID}`);
    console.log(`PayPal Email: ${TEST_PAYPAL_EMAIL}`);
    console.log(`Coins: ${TEST_COINS}`);
    console.log(`USD Amount: $${TEST_USD}`);
    console.log(`Payout Request ID: ${result.payout_request.id}`);
    console.log(`Batch ID: ${batch.id}`);
    console.log('\nTo process the payout, call the process-payout-batch Edge Function with the batch ID.');
    console.log(`\nBatch is ready for processing in Secretary Console.`);

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();