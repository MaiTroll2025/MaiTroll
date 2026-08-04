/**
 * Test Payout Script
 * This script creates a test payout transaction to verify the PayPal payout system works.
 * 
 * User: aab07dfc-3304-4553-a1db-fa410f264ead
 * PayPal: Mai Troll2025@gmail.com
 * Coins: 5000 (=$1)
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
  console.log('=== Starting Payout Test ===\n');

  try {
    // Step 0: Fix missing profiles columns (tax_status trigger requires them)
    console.log('Step 0: Ensuring profiles table has required columns...');
    
    // Check if profiles table has tax_status column
    const { data: colCheck } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'profiles')
      .eq('column_name', 'tax_status');
    
    if (!colCheck || colCheck.length === 0) {
      console.log('Adding missing tax_status column to profiles...');
      // Try to add via a workaround - insert a dummy record that will trigger the column creation
      // Actually, let's just skip the trigger by using a different approach
      console.log('Note: tax_status column missing - will work around trigger issue');
    }

    // Step 1: Add coins to user and set PayPal email
    console.log('Step 1: Adding coins and setting PayPal email...');
    
    const { data: profileUpdate, error: profileError } = await supabase
      .from('user_profiles')
      .update({
        troll_coins: TEST_COINS,
        payout_paypal_email: TEST_PAYPAL_EMAIL
      })
      .eq('id', TEST_USER_ID)
      .select();

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }
    console.log('✓ Profile updated - Coins: 5000, PayPal email set\n');

    // Step 2: Create payout request - bypass trigger by using a direct insert approach
    console.log('Step 2: Creating payout request...');
    
    // First, let's check if we can insert directly
    // The trigger references profiles.tax_status which may not exist
    // We'll try the insert and if it fails due to trigger, we'll handle it
    
    let payoutRequest;
    let insertSuccess = false;
    
    // Try regular insert first
    const { data: payoutData, error: payoutError } = await supabase
      .from('payout_requests')
      .insert({
        user_id: TEST_USER_ID,
        coin_amount: TEST_COINS,
        cash_amount: TEST_USD,
        net_amount: TEST_USD,
        amount_usd: TEST_USD,
        status: 'pending',
        currency: 'USD',
        requested_coins: TEST_COINS,
        coins_used: TEST_COINS
      })
      .select()
      .single();

    if (payoutError) {
      console.log('Regular insert failed:', payoutError.message);
      
      // Check if it's the trigger issue - if so, we need to add the profile record first
      if (payoutError.message.includes('tax_status')) {
        console.log('Trigger issue detected - adding profile record...');
        
        // First ensure there's a profile record for this user
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: TEST_USER_ID,
            role: 'user',
            troll_coins: 0,
            tax_status: null,
            tax_last_updated: null
          }, { onConflict: 'id' });
        
        if (profileError) {
          console.log('Profile upsert error (may be expected):', profileError.message);
        }
        
        // Try insert again
        const { data: retryData, error: retryError } = await supabase
          .from('payout_requests')
          .insert({
            user_id: TEST_USER_ID,
            coin_amount: TEST_COINS,
            cash_amount: TEST_USD,
            net_amount: TEST_USD,
            amount_usd: TEST_USD,
            status: 'pending',
            currency: 'USD',
            requested_coins: TEST_COINS,
            coins_used: TEST_COINS
          })
          .select()
          .single();
        
        if (retryError) {
          console.error('Retry also failed:', retryError);
          throw retryError;
        }
        payoutRequest = retryData;
        insertSuccess = true;
      } else {
        throw payoutError;
      }
    } else {
      payoutRequest = payoutData;
      insertSuccess = true;
    }

    if (!insertSuccess || !payoutRequest) {
      throw new Error('Failed to create payout request');
    }

    if (payoutError) {
      console.error('Error creating payout request:', payoutError);
      throw payoutError;
    }
    console.log(`✓ Payout request created: ${payoutRequest.id}\n`);

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
      .eq('id', payoutRequest.id);

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
    console.log(`Payout Request ID: ${payoutRequest.id}`);
    console.log(`Batch ID: ${batch.id}`);
    console.log('\nTo process the payout, call the process-payout-batch Edge Function with the batch ID.');
    console.log(`\nBatch is ready for processing in Secretary Console.`);

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();