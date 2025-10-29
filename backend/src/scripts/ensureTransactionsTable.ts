/**
 * Script to ensure vault_transactions table exists
 * Run this to verify the migration has been applied
 */

import { supabase } from '../lib/supabase.js';

async function ensureTransactionsTable() {
  try {
    console.log('Checking if vault_transactions table exists...');

    // Try to query the table
    const { error } = await supabase
      .from('vault_transactions')
      .select('id')
      .limit(1);

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.error('\n❌ vault_transactions table does NOT exist!');
        console.error('\nYou need to run migration 009_vault_transactions.sql in Supabase:');
        console.error('1. Go to your Supabase Dashboard');
        console.error('2. Navigate to SQL Editor');
        console.error('3. Run the SQL from: backend/migrations/009_vault_transactions.sql');
        console.error('\nAlternatively, if using Supabase CLI:');
        console.error('   supabase db push\n');
        process.exit(1);
      } else {
        console.error('Error checking table:', error);
        process.exit(1);
      }
    }

    console.log('✅ vault_transactions table exists!');
    
    // Check if there are any transactions
    const { count } = await supabase
      .from('vault_transactions')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Current transaction count: ${count || 0}`);

    // Show table structure
    console.log('\nTable is ready to record deposit and withdrawal transactions.');
    console.log('Each transaction will include:');
    console.log('  - type (deposit/withdrawal)');
    console.log('  - amount in XLM and USD');
    console.log('  - shares minted/burned');
    console.log('  - XLM price at transaction time');
    console.log('  - share price for cost-basis tracking');
    console.log('  - transaction hash');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

ensureTransactionsTable();
