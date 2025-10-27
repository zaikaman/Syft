import { supabase } from '../lib/supabase.js';
import { monitorVaultState, recordPerformanceSnapshot } from './vaultMonitorService.js';

/**
 * Sync vault state from blockchain to Supabase
 */
export async function syncVaultState(vaultId: string): Promise<boolean> {
  try {
    // Get vault from database
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      console.error('Vault not found:', error);
      return false;
    }

    // Get current state from blockchain
    const state = await monitorVaultState(vault.contract_address);

    if (!state) {
      console.error('Failed to get vault state from blockchain');
      return false;
    }

    // Update vault in database
    const { error: updateError } = await supabase
      .from('vaults')
      .update({
        updated_at: new Date().toISOString(),
        config: {
          ...vault.config,
          current_state: state,
        },
      })
      .eq('vault_id', vaultId);

    if (updateError) {
      console.error('Error updating vault:', updateError);
      return false;
    }

    // Record performance snapshot
    const totalValue = parseFloat(state.totalValue);
    await recordPerformanceSnapshot(vaultId, totalValue, 0);

    return true;
  } catch (error) {
    console.error('Error syncing vault state:', error);
    return false;
  }
}

/**
 * Sync all active vaults
 */
export async function syncAllVaults(): Promise<{
  synced: number;
  failed: number;
}> {
  try {
    // Get all active vaults
    const { data: vaults, error } = await supabase
      .from('vaults')
      .select('vault_id')
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching vaults:', error);
      return { synced: 0, failed: 0 };
    }

    if (!vaults || vaults.length === 0) {
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    // Sync each vault
    for (const vault of vaults) {
      const success = await syncVaultState(vault.vault_id);
      if (success) {
        synced++;
      } else {
        failed++;
      }
    }

    console.log(`Sync complete: ${synced} synced, ${failed} failed`);

    return { synced, failed };
  } catch (error) {
    console.error('Error syncing all vaults:', error);
    return { synced: 0, failed: 0 };
  }
}

/**
 * Start continuous vault sync (runs every 5 minutes)
 */
export function startVaultSync(): NodeJS.Timeout {
  console.log('Starting vault sync service (every 5 minutes)...');

  // Initial sync
  syncAllVaults();

  // Periodic sync
  const interval = setInterval(async () => {
    console.log('Running periodic vault sync...');
    await syncAllVaults();
  }, 300000); // Every 5 minutes

  return interval;
}

/**
 * Stop vault sync
 */
export function stopVaultSync(interval: NodeJS.Timeout): void {
  clearInterval(interval);
  console.log('Vault sync service stopped');
}

/**
 * Force sync a specific vault immediately
 */
export async function forceSyncVault(vaultId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const success = await syncVaultState(vaultId);
    
    return {
      success,
      message: success 
        ? 'Vault synced successfully' 
        : 'Failed to sync vault',
    };
  } catch (error) {
    console.error('Error forcing vault sync:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get sync status for a vault
 */
export async function getVaultSyncStatus(vaultId: string): Promise<{
  lastSync: string | null;
  syncAge: number;
  needsSync: boolean;
}> {
  try {
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('updated_at')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      return {
        lastSync: null,
        syncAge: -1,
        needsSync: true,
      };
    }

    const lastSync = new Date(vault.updated_at);
    const syncAge = (Date.now() - lastSync.getTime()) / 1000; // seconds
    const needsSync = syncAge > 600; // More than 10 minutes old

    return {
      lastSync: lastSync.toISOString(),
      syncAge,
      needsSync,
    };
  } catch (error) {
    console.error('Error getting vault sync status:', error);
    return {
      lastSync: null,
      syncAge: -1,
      needsSync: true,
    };
  }
}

/**
 * Sync vault transaction history
 */
export async function syncVaultTransactions(vaultId: string): Promise<boolean> {
  try {
    // Get vault from database
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      return false;
    }

    // In production, fetch transactions from Horizon and store them
    // For MVP, this is a placeholder

    console.log(`Syncing transactions for vault ${vaultId}`);

    return true;
  } catch (error) {
    console.error('Error syncing vault transactions:', error);
    return false;
  }
}
