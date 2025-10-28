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

/**
 * Invalidate cached state for a vault (call after deposits/withdrawals/rebalances)
 */
export function invalidateVaultCache(contractAddress: string): void {
  vaultStateCache.delete(contractAddress);
  console.log(`[Cache] Invalidated cache for vault ${contractAddress}`);
}

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
            const sharesValue = contractResult.total_shares;
            totalShares = (typeof sharesValue === 'bigint' ? sharesValue : BigInt(sharesValue || 0)).toString();
          }
          if ('total_value' in contractResult) {
            const valueValue = contractResult.total_value;
            totalValue = (typeof valueValue === 'bigint' ? valueValue : BigInt(valueValue || 0)).toString();
          }
          
          // If it's an ScVal, decode it
          if (contractResult._switch) {
            const decoded = StellarSdk.scValToNative(contractResult);
            console.log('[monitorVaultState] Decoded contract state:', decoded);
            
            if (decoded && typeof decoded === 'object') {
              const sharesValue = decoded.total_shares;
              const valueValue = decoded.total_value;
              totalShares = (typeof sharesValue === 'bigint' ? sharesValue : BigInt(sharesValue || 0)).toString();
              totalValue = (typeof valueValue === 'bigint' ? valueValue : BigInt(valueValue || 0)).toString();
            }
          }
        }
        
        console.log('[monitorVaultState] Parsed state - shares:', totalShares, 'value:', totalValue);
        console.log('[monitorVaultState] TVL in XLM:', (Number(totalValue) / 10_000_000).toFixed(7));
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
 * Calculate current APY for a vault based on historical data
 */
async function calculateCurrentAPY(_vaultId: string, vaultUUID: string): Promise<number> {
  try {
    // Get transaction data for cost-basis method
    const { data: transactions } = await supabase
      .from('vault_transactions')
      .select('*')
      .eq('vault_id', vaultUUID)
      .order('timestamp', { ascending: true });

    if (transactions && transactions.length > 0) {
      // Calculate net deposits
      const deposits = transactions.filter(tx => tx.type === 'deposit');
      const withdrawals = transactions.filter(tx => tx.type === 'withdrawal');
      
      const totalDeposited = deposits.reduce((sum, tx) => sum + tx.amount_usd, 0);
      const totalWithdrawn = withdrawals.reduce((sum, tx) => sum + tx.amount_usd, 0);
      const netInvested = totalDeposited - totalWithdrawn;

      if (netInvested <= 0) return 0;

      // Get current TVL
      const { data: latestSnapshot } = await supabase
        .from('vault_performance')
        .select('total_value, timestamp')
        .eq('vault_id', vaultUUID)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (!latestSnapshot) return 0;

      const firstDeposit = deposits[0];
      const daysInvested = (new Date(latestSnapshot.timestamp).getTime() - new Date(firstDeposit.timestamp).getTime()) / (1000 * 60 * 60 * 24);

      if (daysInvested < 0.01) return 0;

      const currentValue = latestSnapshot.total_value;
      const totalReturn = (currentValue - netInvested) / netInvested;
      const apy = (Math.pow(1 + totalReturn, 365 / daysInvested) - 1) * 100;

      return Math.max(-100, Math.min(100000, apy));
    }

    // Fallback: snapshot-based method
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: snapshots } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vaultUUID)
      .gte('timestamp', thirtyDaysAgo)
      .order('timestamp', { ascending: true });

    if (!snapshots || snapshots.length < 2) return 0;

    const validSnapshots = snapshots.filter(s => s.total_value > 0 && s.total_value < 1_000_000_000);
    if (validSnapshots.length < 2) return 0;

    const firstSnapshot = validSnapshots[0];
    const lastSnapshot = validSnapshots[validSnapshots.length - 1];

    const initialValue = firstSnapshot.total_value;
    const currentValue = lastSnapshot.total_value;

    if (initialValue <= 0) return 0;

    const timeDiff = new Date(lastSnapshot.timestamp).getTime() - new Date(firstSnapshot.timestamp).getTime();
    const days = timeDiff / (1000 * 60 * 60 * 24);

    if (days <= 0) return 0;

    const simpleReturn = (currentValue - initialValue) / initialValue;
    const apy = (Math.pow(1 + simpleReturn, 365 / days) - 1) * 100;

    return Math.max(-100, Math.min(10000, apy));
  } catch (error) {
    console.error('[calculateCurrentAPY] Error:', error);
    return 0;
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

    // Calculate time-based returns by comparing to historical snapshots
    const now = new Date();
    const time24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const time7dAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const time30dAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get historical snapshots for comparison
    const { data: snapshot24h } = await supabase
      .from('vault_performance')
      .select('total_value')
      .eq('vault_id', vault.id)
      .lte('timestamp', time24hAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    const { data: snapshot7d } = await supabase
      .from('vault_performance')
      .select('total_value')
      .eq('vault_id', vault.id)
      .lte('timestamp', time7dAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    const { data: snapshot30d } = await supabase
      .from('vault_performance')
      .select('total_value')
      .eq('vault_id', vault.id)
      .lte('timestamp', time30dAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    // Calculate returns as percentage
    const calculateReturn = (oldValue: number | null, currentValue: number): number | null => {
      if (!oldValue || oldValue <= 0) return null;
      return ((currentValue - oldValue) / oldValue) * 100;
    };

    const returns24h = calculateReturn(snapshot24h?.total_value || null, value);
    const returns7d = calculateReturn(snapshot7d?.total_value || null, value);
    const returns30d = calculateReturn(snapshot30d?.total_value || null, value);

    // Calculate current APY
    const apyCurrent = await calculateCurrentAPY(vaultId, vault.id);

    // Calculate share price (will be properly calculated from vault state in production)
    const sharePrice = 1.0; // TODO: Get from vault state

    const { error } = await supabase.from('vault_performance').insert({
      vault_id: vault.id,
      timestamp: new Date().toISOString(),
      total_value: value,
      share_price: sharePrice,
      returns_24h: returns24h,
      returns_7d: returns7d,
      returns_30d: returns30d,
      returns_all_time: returns,
      apy_current: apyCurrent,
    });

    if (error) {
      throw error;
    }

    console.log(`[recordPerformanceSnapshot] ${vaultId} - Recorded snapshot: TVL=$${value.toFixed(2)}, 24h=${returns24h?.toFixed(2) || 'N/A'}%, 7d=${returns7d?.toFixed(2) || 'N/A'}%, 30d=${returns30d?.toFixed(2) || 'N/A'}%, APY=${apyCurrent.toFixed(2)}%`);
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
