import { horizonServer } from '../lib/horizonClient.js';
import { supabase } from '../lib/supabase.js';

export interface VaultState {
  totalShares: string;
  totalValue: string;
  lastRebalance: number;
  assetBalances: Array<{
    asset: string;
    balance: string;
    value: string;
  }>;
}

// Simple in-memory cache for vault states to reduce contract calls
interface CachedVaultState {
  state: VaultState;
  timestamp: number;
}

const vaultStateCache = new Map<string, CachedVaultState>();
const CACHE_TTL = 30000; // 30 seconds cache

export interface VaultPerformanceMetrics {
  currentValue: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netReturn: number;
  returnPercentage: number;
  lastUpdated: string;
}

/**
 * Get user's position in a vault
 */
export async function getUserPosition(
  contractAddress: string,
  userAddress: string,
  network?: string
): Promise<{ shares: string; lastDeposit: number } | null> {
  try {
    // Get vault from database to determine network
    const { data: vaultData } = await supabase
      .from('vaults')
      .select('network')
      .eq('contract_address', contractAddress)
      .single();

    const vaultNetwork = network || vaultData?.network || 'testnet';

    // Import the invokeVaultMethod to query contract state
    const { invokeVaultMethod } = await import('./vaultDeploymentService.js');
    const { Keypair } = await import('@stellar/stellar-sdk');
    
    // Use deployer keypair for read-only operations
    const deployerSecret = process.env.DEPLOYER_SECRET_KEY;
    if (!deployerSecret) {
      console.error('[getUserPosition] No deployer secret key available');
      return null;
    }
    
    const sourceKeypair = Keypair.fromSecret(deployerSecret);

    try {
      // Query user position from contract using get_position method
      const positionResult = await invokeVaultMethod(
        contractAddress,
        'get_position',
        [userAddress],
        sourceKeypair,
        vaultNetwork
      );

      if (!positionResult.success || !positionResult.result) {
        console.error('[getUserPosition] Failed to get position from contract');
        return {
          shares: '0',
          lastDeposit: 0,
        };
      }

      // Parse the XDR result
      const contractResult = positionResult.result;
      
      console.log('[getUserPosition] Raw contract result:', contractResult);

      // Import stellar-sdk for XDR parsing
      const StellarSdk = await import('@stellar/stellar-sdk');
      
      let shares = '0';
      let lastDeposit = 0;
      
      try {
        if (contractResult && typeof contractResult === 'object') {
          // Try to access the values directly if they're already parsed
          if ('shares' in contractResult) {
            shares = contractResult.shares?.toString() || '0';
          }
          if ('last_deposit' in contractResult) {
            const lastDepositValue = contractResult.last_deposit;
            lastDeposit = typeof lastDepositValue === 'bigint' 
              ? Number(lastDepositValue) 
              : (lastDepositValue || 0);
          }
          
          // If it's an ScVal, decode it
          if (contractResult._switch) {
            const decoded = StellarSdk.scValToNative(contractResult);
            console.log('[getUserPosition] Decoded position:', decoded);
            
            if (decoded && typeof decoded === 'object') {
              shares = decoded.shares?.toString() || '0';
              const lastDepositValue = decoded.last_deposit;
              lastDeposit = typeof lastDepositValue === 'bigint' 
                ? Number(lastDepositValue) 
                : (lastDepositValue || 0);
            }
          }
        }
        
        console.log('[getUserPosition] Parsed position - shares:', shares, 'lastDeposit:', lastDeposit);
      } catch (parseError) {
        console.error('[getUserPosition] Error parsing contract result:', parseError);
      }

      return {
        shares,
        lastDeposit,
      };
    } catch (contractError) {
      console.error('[getUserPosition] Error querying contract:', contractError);
      return {
        shares: '0',
        lastDeposit: 0,
      };
    }
  } catch (error) {
    console.error('[getUserPosition] Error:', error);
    return null;
  }
}

/**
 * Monitor vault state from blockchain
 */
export async function monitorVaultState(
  contractAddress: string,
  network?: string
): Promise<VaultState | null> {
  try {
    // Check cache first
    const cached = vaultStateCache.get(contractAddress);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[monitorVaultState] Returning cached state for ${contractAddress}`);
      return cached.state;
    }

    // Get vault from database to determine network
    const { data: vaultData } = await supabase
      .from('vaults')
      .select('network')
      .eq('contract_address', contractAddress)
      .single();

    const vaultNetwork = network || vaultData?.network || 'testnet';

    // Import the invokeVaultMethod to query contract state
    const { invokeVaultMethod } = await import('./vaultDeploymentService.js');
    const { Keypair } = await import('@stellar/stellar-sdk');
    
    // Use deployer keypair for read-only operations
    const deployerSecret = process.env.DEPLOYER_SECRET_KEY;
    if (!deployerSecret) {
      console.error('[monitorVaultState] No deployer secret key available');
      // Return cached state if available, even if expired
      return cached?.state || null;
    }
    
    const sourceKeypair = Keypair.fromSecret(deployerSecret);

    try {
      // Query vault state from contract using get_state method
      const stateResult = await invokeVaultMethod(
        contractAddress,
        'get_state',
        [],
        sourceKeypair,
        vaultNetwork
      );

      if (!stateResult.success || !stateResult.result) {
        console.error('[monitorVaultState] Failed to get state from contract');
        return {
          totalShares: '0',
          totalValue: '0',
          lastRebalance: Date.now(),
          assetBalances: [],
        };
      }

      // Parse the XDR result - it should be a VaultState struct
      const contractResult = stateResult.result;
      
      console.log('[monitorVaultState] Raw contract result:', contractResult);

      // Import stellar-sdk for XDR parsing
      const StellarSdk = await import('@stellar/stellar-sdk');
      
      // Try to parse the ScVal structure
      let totalShares = '0';
      let totalValue = '0';
      
      try {
        // The result is an ScVal that needs to be decoded
        // For a struct, it should be an ScMap or similar
        if (contractResult && typeof contractResult === 'object') {
          // Try to access the values directly if they're already parsed
          if ('total_shares' in contractResult) {
            totalShares = contractResult.total_shares?.toString() || '0';
          }
          if ('total_value' in contractResult) {
            totalValue = contractResult.total_value?.toString() || '0';
          }
          
          // If it's an ScVal, decode it
          if (contractResult._switch) {
            const decoded = StellarSdk.scValToNative(contractResult);
            console.log('[monitorVaultState] Decoded contract state:', decoded);
            
            if (decoded && typeof decoded === 'object') {
              totalShares = decoded.total_shares?.toString() || '0';
              totalValue = decoded.total_value?.toString() || '0';
            }
          }
        }
        
        console.log('[monitorVaultState] Parsed state - shares:', totalShares, 'value:', totalValue);
      } catch (parseError) {
        console.error('[monitorVaultState] Error parsing contract result:', parseError);
      }

      const vaultState: VaultState = {
        totalShares,
        totalValue,
        lastRebalance: Date.now(),
        assetBalances: [],
      };

      // Cache the result
      vaultStateCache.set(contractAddress, {
        state: vaultState,
        timestamp: Date.now(),
      });

      return vaultState;
    } catch (contractError) {
      console.error('[monitorVaultState] Error querying contract:', contractError);
      
      // Return cached state if available, even if expired
      if (cached) {
        console.log('[monitorVaultState] Returning expired cached state due to error');
        return cached.state;
      }
      
      // Return zero values instead of mock data
      return {
        totalShares: '0',
        totalValue: '0',
        lastRebalance: Date.now(),
        assetBalances: [],
      };
    }
  } catch (error) {
    console.error('[monitorVaultState] Error:', error);
    return null;
  }
}

/**
 * Get vault performance metrics
 */
export async function getVaultPerformance(
  vaultId: string
): Promise<VaultPerformanceMetrics> {
  try {
    // First get the vault UUID from vault_id
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (vaultError || !vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    // Query performance data from database using UUID
    const { data: performanceData, error } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    if (!performanceData || performanceData.length === 0) {
      return {
        currentValue: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        netReturn: 0,
        returnPercentage: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    // Calculate metrics
    const latest = performanceData[0];
    const oldest = performanceData[performanceData.length - 1];
    
    const currentValue = latest.value;
    const initialValue = oldest.value || 1;
    const netReturn = currentValue - initialValue;
    const returnPercentage = (netReturn / initialValue) * 100;

    return {
      currentValue,
      totalDeposits: 0, // Would be calculated from transaction history
      totalWithdrawals: 0, // Would be calculated from transaction history
      netReturn,
      returnPercentage,
      lastUpdated: latest.timestamp,
    };
  } catch (error) {
    console.error('Error getting vault performance:', error);
    throw error;
  }
}

/**
 * Record vault performance snapshot
 */
export async function recordPerformanceSnapshot(
  vaultId: string,
  value: number,
  returns: number
): Promise<void> {
  try {
    // First get the vault UUID from vault_id
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (vaultError || !vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    const { error } = await supabase.from('vault_performance').insert({
      vault_id: vault.id,
      timestamp: new Date().toISOString(),
      total_value: value,
      share_price: 1.0, // Will be calculated properly in production
      returns_all_time: returns,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error recording performance snapshot:', error);
    throw error;
  }
}

/**
 * Get historical performance data for charting
 */
export async function getPerformanceHistory(
  vaultId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ timestamp: string; value: number; returns: number }>> {
  try {
    // First get the vault UUID from vault_id
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (vaultError || !vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    const { data, error } = await supabase
      .from('vault_performance')
      .select('timestamp, total_value, returns_all_time')
      .eq('vault_id', vault.id)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      throw error;
    }

    // Map the database columns to the expected format
    return (data || []).map(row => ({
      timestamp: row.timestamp,
      value: row.total_value,
      returns: row.returns_all_time || 0,
    }));
  } catch (error) {
    console.error('Error getting performance history:', error);
    throw error;
  }
}

/**
 * Stream vault events in real-time
 */
export async function streamVaultEvents(
  contractAddress: string,
  onEvent: (event: any) => void
): Promise<() => void> {
  try {
    // In production, this would stream contract events from Horizon
    // For MVP, we'll use a polling mechanism

    const interval = setInterval(async () => {
      const state = await monitorVaultState(contractAddress);
      if (state) {
        onEvent({ type: 'state_update', data: state });
      }
    }, 10000); // Poll every 10 seconds

    // Return cleanup function
    return () => clearInterval(interval);
  } catch (error) {
    console.error('Error streaming vault events:', error);
    return () => {};
  }
}

/**
 * Get vault transaction history from Horizon
 */
export async function getVaultTransactionHistory(
  contractAddress: string,
  limit: number = 50
): Promise<any[]> {
  try {
    // In production, query contract address transactions
    const transactions = await horizonServer
      .transactions()
      .forAccount(contractAddress)
      .limit(limit)
      .order('desc')
      .call();

    return transactions.records.map((tx: any) => ({
      hash: tx.hash,
      createdAt: tx.created_at,
      operations: tx.operation_count,
      successful: tx.successful,
    }));
  } catch (error) {
    console.error('Error getting vault transaction history:', error);
    return [];
  }
}

/**
 * Check vault health and status
 */
export async function checkVaultHealth(
  vaultId: string
): Promise<{
  healthy: boolean;
  issues: string[];
  lastCheck: string;
}> {
  try {
    const issues: string[] = [];

    // Get vault from database
    const { data: vault, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (error || !vault) {
      issues.push('Vault not found in database');
      return {
        healthy: false,
        issues,
        lastCheck: new Date().toISOString(),
      };
    }

    // Check if vault is active
    if (vault.status !== 'active') {
      issues.push(`Vault status is ${vault.status}`);
    }

    // Check if vault has been updated recently
    const lastUpdate = new Date(vault.updated_at);
    const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate > 24) {
      issues.push('Vault has not been updated in over 24 hours');
    }

    return {
      healthy: issues.length === 0,
      issues,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error checking vault health:', error);
    return {
      healthy: false,
      issues: ['Error checking vault health'],
      lastCheck: new Date().toISOString(),
    };
  }
}
