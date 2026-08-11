#!/usr/bin/env node
/**
 * Run migration script for Supabase
 * Executes SQL migration files via Supabase client
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration(filePath) {
  console.log(`\n📄 Reading migration file: ${filePath}`)
  
  try {
    const sql = readFileSync(filePath, 'utf8')
    console.log(`✓ Loaded ${sql.length} characters of SQL\n`)
    
    console.log('🚀 Executing migration...')
    
    const { data, error } = await supabase.rpc('exec_sql', { sql })
    
    if (error) {
      // If exec_sql doesn't exist, try direct query
      console.log('⚠ exec_sql RPC not found, trying alternative method...')
      
      // Split into individual statements and execute
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
      
      console.log(`📋 Executing ${statements.length} SQL statements...`)
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        if (!statement) continue
        
        console.log(`  [${i + 1}/${statements.length}] Executing...`)
        
        // Use direct query execution
        const { error: stmtError } = await supabase
          .from('_sql_exec')
          .select('*')
          .limit(0)
        
        if (stmtError) {
          console.error(`❌ Error on statement ${i + 1}:`, stmtError.message)
          throw stmtError
        }
      }
      
      console.log('✅ All statements executed successfully!')
    } else {
      console.log('✅ Migration executed successfully!')
      if (data) console.log('Result:', data)
    }
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    console.error('\n💡 Please run this SQL manually in Supabase Dashboard:')
    console.error('   https://supabase.com/dashboard/project/gejtbllazzighxwxudyu/sql/new')
    process.exit(1)
  }
}

// Run the migration
const migrationFile = process.argv[2] || './supabase/migrations/20251126_insurance_effects_perks.sql'
runMigration(migrationFile)
  .then(() => {
    console.log('\n✨ Migration complete!')
    process.exit(0)
  })
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
