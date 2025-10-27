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

export interface VaultPerformanceMetrics {
  currentValue: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netReturn: number;
  returnPercentage: number;
  lastUpdated: string;
}

/**
 * Monitor vault state from blockchain
 */
export async function monitorVaultState(
  contractAddress: string
): Promise<VaultState | null> {
  try {
    // In production, this would query the Soroban contract state
    // For MVP, we'll return mock data or query from our database

    const { data, error } = await supabase
      .from('vaults')
      .select('*')
      .eq('contract_address', contractAddress)
      .single();

    if (error || !data) {
      console.error('Vault not found:', error);
      return null;
    }

    // Mock vault state for MVP
    return {
      totalShares: '1000000',
      totalValue: '1000000',
      lastRebalance: Date.now(),
      assetBalances: [
        { asset: 'XLM', balance: '500000', value: '500000' },
        { asset: 'USDC', balance: '500000', value: '500000' },
      ],
    };
  } catch (error) {
    console.error('Error monitoring vault state:', error);
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
    // Query performance data from database
    const { data: performanceData, error } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vaultId)
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
    const { error } = await supabase.from('vault_performance').insert({
      vault_id: vaultId,
      timestamp: new Date().toISOString(),
      value,
      returns,
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
    const { data, error } = await supabase
      .from('vault_performance')
      .select('timestamp, value, returns')
      .eq('vault_id', vaultId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
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
