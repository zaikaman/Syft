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
    
    return timeSinceRebalance >= threshold;
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

  const interval = setInterval(async () => {
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

      // Evaluate rules for each vault
      for (const vault of vaults) {
        const triggers = await evaluateVaultRules(vault.vault_id);

        // Call callback for each trigger
        triggers.forEach((trigger) => {
          console.log(`Rule triggered for vault ${trigger.vaultId}:`, trigger);
          onTrigger(trigger);
        });
      }
    } catch (error) {
      console.error('Error in rule monitoring loop:', error);
    }
  }, 60000); // Check every 60 seconds

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
