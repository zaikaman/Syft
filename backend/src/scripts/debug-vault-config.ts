/**
 * Debug script to check vault config structure and allocation data
 */

import { supabase } from '../lib/supabase.js';

async function debugVaultConfig(vaultId: string) {
  console.log(`\n=== Debugging Vault Config for ${vaultId} ===\n`);

  // 1. Get vault from database
  const { data: vault, error } = await supabase
    .from('vaults')
    .select('*')
    .eq('vault_id', vaultId)
    .single();

  if (error || !vault) {
    console.error('❌ Vault not found:', error);
    return;
  }

  console.log('📦 Vault Data:');
  console.log('  Vault ID:', vault.vault_id);
  console.log('  Name:', vault.name);
  console.log('  Owner:', vault.owner_wallet_address);
  console.log('  Status:', vault.status);
  console.log('  Network:', vault.network);

  console.log('\n📋 Config Structure:');
  console.log(JSON.stringify(vault.config, null, 2));

  // 2. Check assets array
  console.log('\n🎯 Assets Analysis:');
  if (!vault.config?.assets) {
    console.error('  ❌ No assets array found in config!');
  } else if (!Array.isArray(vault.config.assets)) {
    console.error('  ❌ Assets is not an array:', typeof vault.config.assets);
  } else if (vault.config.assets.length === 0) {
    console.warn('  ⚠️  Assets array is empty!');
  } else {
    console.log(`  ✓ Found ${vault.config.assets.length} assets`);
    
    let totalAllocation = 0;
    vault.config.assets.forEach((asset: any, index: number) => {
      console.log(`\n  Asset ${index + 1}:`);
      console.log('    - assetCode:', asset.assetCode || asset.code || 'MISSING');
      console.log('    - assetId:', asset.assetId || asset.id || 'MISSING');
      console.log('    - percentage:', asset.percentage ?? 'MISSING');
      console.log('    - Full asset object:', JSON.stringify(asset, null, 2));
      
      totalAllocation += asset.percentage || 0;
    });
    
    console.log(`\n  📊 Total Allocation: ${totalAllocation}%`);
    
    if (Math.abs(totalAllocation - 100) > 0.1) {
      console.warn(`  ⚠️  Allocation doesn't sum to 100%! This is the issue!`);
    } else {
      console.log('  ✓ Allocation sums to 100%');
    }
  }

  // 3. Check rules
  console.log('\n⚙️  Rules Analysis:');
  if (!vault.config?.rules) {
    console.warn('  ⚠️  No rules array found in config');
  } else if (!Array.isArray(vault.config.rules)) {
    console.error('  ❌ Rules is not an array:', typeof vault.config.rules);
  } else if (vault.config.rules.length === 0) {
    console.warn('  ⚠️  Rules array is empty');
  } else {
    console.log(`  ✓ Found ${vault.config.rules.length} rules`);
    vault.config.rules.forEach((rule: any, index: number) => {
      console.log(`    Rule ${index + 1}: ${rule.name || 'Unnamed'}`);
    });
  }

  // 4. Get latest performance snapshot
  console.log('\n📈 Latest Performance Data:');
  const { data: latestPerf } = await supabase
    .from('vault_performance')
    .select('*')
    .eq('vault_id', vault.id)
    .order('timestamp', { ascending: false })
    .limit(1);

  if (latestPerf && latestPerf.length > 0) {
    console.log('  Total Value:', latestPerf[0].total_value);
    console.log('  Total Shares:', latestPerf[0].total_shares);
    console.log('  Asset Balances:', latestPerf[0].asset_balances);
  } else {
    console.warn('  ⚠️  No performance data found');
  }

  console.log('\n=== End Debug ===\n');
}

// Get vault ID from command line or use default
const vaultId = process.argv[2];

if (!vaultId) {
  console.error('❌ Please provide a vault ID as argument');
  console.log('Usage: tsx debug-vault-config.ts <vaultId>');
  process.exit(1);
}

debugVaultConfig(vaultId).then(() => {
  console.log('Debug complete');
  process.exit(0);
}).catch((error) => {
  console.error('Debug failed:', error);
  process.exit(1);
});
