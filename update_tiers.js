import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role key
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required env vars: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateCashoutTiers() {
  console.log('Fetching current cashout tiers...')
  const { data: tiers, error: fetchError } = await supabase
    .from('cashout_tiers')
    .select('*')

  if (fetchError) {
    console.error('Error fetching cashout tiers:', fetchError)
    return
  }

  console.log('Current tiers:', tiers)

  // Step 1: If there's a tier with 5000 coins, update it to 7500 coins and $25
  const fiveThousandTier = tiers.find(t => t.coin_amount === 5000)
  if (fiveThousandTier) {
    const { data: _data, error: updateError } = await supabase
      .from('cashout_tiers')
      .update({ coin_amount: 7500, cash_amount: 25 })
      .eq('id', fiveThousandTier.id)

    if (updateError) {
      console.error('Error updating 5000 tier to 7500:', updateError)
    } else {
      console.log(`Updated 5000 tier to 7500 coins -> $25`)
    }
  }

  // Define the desired tiers (after potential 5000->7500 update)
  const desiredTiers = [
    { coin_amount: 7500, cash_amount: 25 },
    { coin_amount: 15000, cash_amount: 50 },
    { coin_amount: 30000, cash_amount: 150 },
    { coin_amount: 60000, cash_amount: 300 },
    { coin_amount: 120000, cash_amount: 600 },
    { coin_amount: 200000, cash_amount: 1000 }
  ]

  // Step 2: For each desired tier, try to update by coin_amount; if 0 rows updated, insert
  for (const tier of desiredTiers) {
    const { data: _data, error: updateError, count } = await supabase
      .from('cashout_tiers')
      .update({ 
        cash_amount: tier.cash_amount,
        currency: 'USD',
        processing_fee_percentage: 0,
        is_active: true
      })
      .eq('coin_amount', tier.coin_amount)

    if (updateError) {
      console.error(`Error updating tier ${tier.coin_amount}:`, updateError)
    } else {
      if (count === 0) {
        // No rows updated, so insert
        const { data: _insertData, error: insertError } = await supabase
          .from('cashout_tiers')
          .insert({
            coin_amount: tier.coin_amount,
            cash_amount: tier.cash_amount,
            currency: 'USD',
            processing_fee_percentage: 0,
            is_active: true
          })

        if (insertError) {
          console.error(`Error inserting tier ${tier.coin_amount}:`, insertError)
        } else {
          console.log(`Inserted tier ${tier.coin_amount} -> $${tier.cash_amount}`)
        }
      } else {
        console.log(`Updated tier ${tier.coin_amount} -> $${tier.cash_amount}`)
      }
    }
  }

  // Step 3: Deactivate any tiers not in the desired list
  const desiredCoinAmounts = desiredTiers.map(t => t.coin_amount)
  const { data: _deactiveData, error: deactiveError, count: deactiveCount } = await supabase
    .from('cashout_tiers')
    .update({ is_active: false })
    .not('coin_amount', 'in', `(${desiredCoinAmounts.join(',')})`)

  if (deactiveError) {
    console.error('Error deactivating unwanted tiers:', deactiveError)
  } else {
    console.log(`Deactivated ${deactiveCount} tiers not in desired list`)
  }

  // Fetch and display final tiers
  const { data: finalTiers, error: finalError } = await supabase
    .from('cashout_tiers')
    .select('*')
    .order('coin_amount')

  if (finalError) {
    console.error('Error fetching final tiers:', finalError)
  } else {
    console.log('Final cashout tiers:')
    finalTiers.forEach(t => {
      console.log(`  ${t.coin_amount} coins -> $${t.cash_amount} (active: ${t.is_active})`)
    })
  }
}

updateCashoutTiers().catch(console.error)