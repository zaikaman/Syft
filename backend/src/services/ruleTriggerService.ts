import { supabase } from '../lib/supabase.js';
import { monitorVaultState } from './vaultMonitorService.js';

export interface RuleTrigger {
  vaultId: string;
  ruleIndex: number;
  triggered: boolean;
  triggerTime: string;
  conditionMet: string;
}

/**
 * Evaluate vault rules and detect triggers
 */
export async function evaluateVaultRules(vaultId: string): Promise<RuleTrigger[]> {
  try {
    // Get vault configuration
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      console.error('Vault not found:', error);
      return [];
    }

    const config = vault.config;
    const rules = config.rules || [];
    const triggers: RuleTrigger[] = [];

    // Get current vault state
    const state = await monitorVaultState(vault.contract_address);

    // Evaluate each rule
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const triggered = await evaluateRule(rule, state, vault);

      if (triggered) {
        triggers.push({
          vaultId,
          ruleIndex: i,
          triggered: true,
          triggerTime: new Date().toISOString(),
          conditionMet: rule.condition_type,
        });
      }
    }

    return triggers;
  } catch (error) {
    console.error('Error evaluating vault rules:', error);
    return [];
  }
}

/**
 * Check if rebalancing is actually needed by comparing current vs target allocation
 */
async function checkIfRebalanceNeeded(rule: any, vault: any): Promise<boolean> {
  try {
    // Validate vault has a valid contract address
    const contractAddress = vault.contract_address;
    if (!contractAddress) {
      console.log(`⏭️  Vault ${vault.vault_id} has no contract address - skipping rebalance check`);
      return false;
    }

    // Check if contract address is valid (should start with C or G and be 56 chars)
    if (!contractAddress.startsWith('C') && !contractAddress.startsWith('G')) {
      console.log(`⏭️  Vault ${vault.vault_id} has invalid contract address format: ${contractAddress} - skipping rebalance check`);
      return false;
    }

    if (contractAddress.length !== 56) {
      console.log(`⏭️  Vault ${vault.vault_id} has invalid contract address length: ${contractAddress.length} - skipping rebalance check`);
      return false;
    }

    // Get target allocation from rule
    const targetAllocation = rule.target_allocation || [];
    if (targetAllocation.length === 0) {
      return false;
    }

    // Get vault configuration to determine which assets to check
    const config = vault.config || {};
    const assets = config.assets || [];
    
    if (assets.length === 0) {
      return false;
    }

    // Determine if this is a contract address (C...) or a regular wallet (G...)
    const isContractAddress = contractAddress.startsWith('C');
    
    let totalValue = 0;
    const assetValues: number[] = [];
    
    if (isContractAddress) {
      // For contract addresses, query the contract state directly
      const vaultState = await monitorVaultState(contractAddress);
      
      if (!vaultState || !vaultState.totalValue) {
        console.log(`⏭️  Could not fetch contract state for vault ${vault.vault_id}`);
        return false;
      }
      
      // Parse total value from contract (it's in stroops for XLM)
      totalValue = Number(vaultState.totalValue) / 10_000_000; // Convert stroops to XLM
      
      // For stake and liquidity actions, always allow rebalancing if there's any value
      // These actions don't depend on allocation drift
      if (rule.action === 'stake' || rule.action === 'provide_liquidity') {
        console.log(`  ✓ ${rule.action} action - rebalance allowed (TVL: ${totalValue.toFixed(2)} XLM)`);
        return totalValue > 0; // Allow if there's any value to stake/provide
      }
      
      // For rebalance actions, only trigger if total value is significant enough
      console.log(`  Contract vault total value: ${totalValue.toFixed(2)} XLM`);
      console.log(`  ⚠️  Note: Contract-based vault - cannot verify individual asset allocations`);
      console.log(`  ✓ Assuming contract is managing allocations correctly`);
      
      // For contract vaults doing rebalance, we can't verify actual drift, so we'll allow rebalancing
      // if the total value is significant enough (>= 1 XLM)
      // The contract's rebalance function will handle the actual allocation logic
      return totalValue >= 1;
    } else {
      // For regular wallet addresses, use fetchAssetBalances
      const { fetchAssetBalances } = await import('./assetService.js');
      const walletAssets = await fetchAssetBalances(contractAddress);
      
      for (const asset of assets) {
        const assetCode = asset.code || 'XLM';
        
        // Find balance for this asset
        let balance = 0;
        const assetBalance = walletAssets.balances.find(b => {
          if (assetCode === 'XLM' && b.asset_type === 'native') {
            return true;
          }
          return b.asset_code === assetCode;
        });
        
        if (assetBalance) {
          balance = parseFloat(assetBalance.balance);
        }
        
        // Get price in USD (for now use mock prices, in production use real prices)
        const priceUSD = assetCode === 'XLM' ? 0.12 : 1.0; // Mock: XLM=$0.12, USDC=$1
        const value = balance * priceUSD;
        
        assetValues.push(value);
        totalValue += value;
      }
    }

    if (totalValue === 0) {
      console.log(`⏭️  Vault ${vault.vault_id} has 0 total value - no rebalance needed`);
      return false;
    }

    // Calculate current allocation percentages
    const currentAllocation = assetValues.map(value => (value / totalValue) * 100);

    // Compare current vs target (target is in basis points, 100_0000 = 100%)
    const TOLERANCE_PERCENT = 1.0; // 1% tolerance
    let maxDrift = 0;

    for (let i = 0; i < Math.min(currentAllocation.length, targetAllocation.length); i++) {
      const current = currentAllocation[i];
      const target = targetAllocation[i] / 1000; // Convert from basis points (100_0000 = 100%) to percentage
      const drift = Math.abs(current - target);
      maxDrift = Math.max(maxDrift, drift);
      
      console.log(`  Asset ${i} (${assets[i]?.code || 'unknown'}): Current=${current.toFixed(2)}%, Target=${target.toFixed(2)}%, Drift=${drift.toFixed(2)}%`);
    }

    console.log(`  Max allocation drift: ${maxDrift.toFixed(2)}% (tolerance: ${TOLERANCE_PERCENT}%)`);

    // Need rebalance if drift exceeds tolerance
    const needsRebalance = maxDrift > TOLERANCE_PERCENT;
    
    if (!needsRebalance) {
      console.log(`  ✓ Already at target allocation (drift ${maxDrift.toFixed(2)}% < ${TOLERANCE_PERCENT}%)`);
    }
    
    return needsRebalance;
  } catch (error) {
    console.error('[checkIfRebalanceNeeded] Error:', error);
    // If we can't determine (e.g., invalid address), skip rebalancing to avoid errors
    // The vault needs to be properly deployed first
    return false;
  }
}

/**
 * Evaluate a single rule
 */
async function evaluateRule(
  rule: any,
  state: any,
  vault: any
): Promise<boolean> {
  const conditionType = rule.condition_type;
  const threshold = rule.threshold;

  // Time-based condition
  if (conditionType.includes('time')) {
    const lastRebalance = new Date(vault.updated_at).getTime();
    const currentTime = Date.now();
    const timeSinceRebalance = (currentTime - lastRebalance) / 1000; // seconds
    
    // Check if enough time has passed
    if (timeSinceRebalance < threshold) {
      return false;
    }

    // Additionally check if rebalancing is actually needed
    // by comparing current allocation to target allocation
    if (!state || !state.totalValue || state.totalValue === '0') {
      console.log(`⏭️  Skipping rebalance for vault ${vault.vault_id}: No assets in vault (TVL = 0)`);
      return false;
    }

    // Check if we're already at target allocation (within 1% tolerance)
    const needsRebalance = await checkIfRebalanceNeeded(rule, vault);
    if (!needsRebalance) {
      console.log(`⏭️  Skipping rebalance for vault ${vault.vault_id}: Already at target allocation`);
      return false;
    }
    
    return true;
  }

  // APY threshold condition
  if (conditionType.includes('apy')) {
    // First get the vault UUID from vault_id
    const { data: vaultData, error: vaultError } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vault.vault_id)
      .single();

    if (vaultError || !vaultData) {
      return false;
    }

    // Get recent performance
    const { data: performance } = await supabase
      .from('vault_performance')
      .select('returns_all_time')
      .eq('vault_id', vaultData.id)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (performance && performance.length > 0) {
      const currentAPY = performance[0].returns_all_time;
      return currentAPY >= threshold;
    }
  }

  // Allocation drift condition
  if (conditionType.includes('allocation')) {
    if (!state || !state.assetBalances) {
      return false;
    }

    const targetAllocation = rule.target_allocation || [];
    const currentBalances = state.assetBalances;

    // Calculate allocation drift
    const totalValue = currentBalances.reduce(
      (sum: number, asset: any) => sum + parseFloat(asset.value),
      0
    );

    for (let i = 0; i < currentBalances.length && i < targetAllocation.length; i++) {
      const currentPct = (parseFloat(currentBalances[i].value) / totalValue) * 100;
      const targetPct = targetAllocation[i] / 1000; // Assuming target is in basis points
      const drift = Math.abs(currentPct - targetPct);

      if (drift >= threshold / 1000) {
        return true; // Drift exceeds threshold
      }
    }
  }

  // Price-based condition
  if (conditionType.includes('price')) {
    // Would integrate with price oracle
    // For MVP, return false
    return false;
  }

  return false;
}

/**
 * Start continuous rule monitoring for all active vaults
 */
export function startRuleMonitoring(
  onTrigger: (trigger: RuleTrigger) => void
): NodeJS.Timeout {
  console.log('Starting rule monitoring service (polling every 60 seconds)...');

  const interval = setInterval(() => {
    // Run async without blocking the interval
    (async () => {
      try {
        // Get all active vaults
        const { data: vaults, error } = await supabase
          .from('vaults')
          .select('vault_id')
          .eq('status', 'active');

        if (error) {
          console.error('Error fetching active vaults:', error);
          return;
        }

        if (!vaults || vaults.length === 0) {
          console.log('No active vaults to monitor');
          return;
        }

        console.log(`Monitoring ${vaults.length} active vaults...`);

        // Evaluate rules for each vault in parallel for better performance
        const evaluationPromises = vaults.map(vault => 
          evaluateVaultRules(vault.vault_id).catch(error => {
            console.error(`Error evaluating vault ${vault.vault_id}:`, error);
            return [];
          })
        );

        const allTriggers = await Promise.all(evaluationPromises);

        // Flatten and process all triggers
        for (const triggers of allTriggers) {
          if (triggers.length > 0) {
            // Call callback for each trigger (callback handles async execution)
            triggers.forEach((trigger) => {
              console.log(`Rule triggered for vault ${trigger.vaultId}:`, trigger);
              onTrigger(trigger);
            });
          }
        }
      } catch (error) {
        console.error('Error in rule monitoring loop:', error);
      }
    })(); // Fire and forget - don't block the interval
  }, 60000); // Check every 1 minute

  return interval;
}

/**
 * Stop rule monitoring
 */
export function stopRuleMonitoring(interval: NodeJS.Timeout): void {
  clearInterval(interval);
  console.log('Rule monitoring stopped');
}

/**
 * Get rule trigger history for a vault
 */
export async function getRuleTriggerHistory(
  vaultId: string,
  _limit: number = 50
): Promise<RuleTrigger[]> {
  try {
    // In production, we'd store trigger events in a dedicated table
    // For MVP, we'll infer from vault update history

    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      return [];
    }

    // Mock trigger history
    return [
      {
        vaultId,
        ruleIndex: 0,
        triggered: true,
        triggerTime: new Date(Date.now() - 86400000).toISOString(),
        conditionMet: 'time_based',
      },
    ];
  } catch (error) {
    console.error('Error getting rule trigger history:', error);
    return [];
  }
}

/**
 * Manually trigger rule evaluation for a specific vault
 */
export async function manuallyTriggerEvaluation(
  vaultId: string
): Promise<{ triggered: boolean; triggers: RuleTrigger[] }> {
  try {
    const triggers = await evaluateVaultRules(vaultId);
    return {
      triggered: triggers.length > 0,
      triggers,
    };
  } catch (error) {
    console.error('Error manually triggering evaluation:', error);
    return {
      triggered: false,
      triggers: [],
    };
  }
}
