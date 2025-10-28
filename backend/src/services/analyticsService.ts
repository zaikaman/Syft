/**
 * Analytics Service - Production-ready vault analytics and APY calculations
 */

import { supabase } from '../lib/supabase.js';

interface VaultAnalytics {
  vaultId: string;
  tvl: number; // Current TVL in USD
  tvlChange24h: number; // Percentage change in 24h
  tvlChange7d: number; // Percentage change in 7d
  apy: number; // Annualized percentage yield
  totalDeposits: number; // Total deposits in USD
  totalWithdrawals: number; // Total withdrawals in USD
  netDeposits: number; // Net deposits (deposits - withdrawals)
  totalEarnings: number; // Actual earnings (current value - net deposits)
  earningsPercentage: number; // Earnings as percentage of net deposits
  sharePrice: number; // Current price per share
  totalShares: string; // Total shares outstanding
  lastUpdated: string;
}

interface PortfolioAnalytics {
  totalTVL: number;
  totalEarnings: number;
  averageAPY: number;
  weightedAPY: number; // APY weighted by TVL
  totalDeposits: number;
  totalWithdrawals: number;
  bestPerformingVault: {
    vaultId: string;
    name: string;
    apy: number;
  } | null;
  worstPerformingVault: {
    vaultId: string;
    name: string;
    apy: number;
  } | null;
  vaultCount: number;
  activeVaultCount: number;
}

/**
 * Calculate APY based on historical performance
 * 
 * NEW METHOD: For trading vaults with frequent rebalances
 * - Uses actual deposits vs current TVL to calculate true returns
 * - Accounts for trading profits, not just holding appreciation
 * - Works correctly even with minute-by-minute rebalancing
 */
async function calculateAPY(vaultId: string): Promise<number> {
  try {
    // Get vault UUID
    const { data: vault } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (!vault) return 0;

    // METHOD 1: If we have transaction data, use cost-basis APY (accurate!)
    const { data: transactions } = await supabase
      .from('vault_transactions')
      .select('*')
      .eq('vault_id', vault.id)
      .order('timestamp', { ascending: true });

    if (transactions && transactions.length > 0) {
      // Calculate net deposits (deposits - withdrawals)
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
        .eq('vault_id', vault.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (!latestSnapshot) return 0;

      // Get first deposit timestamp
      const firstDeposit = deposits[0];
      const daysInvested = (new Date(latestSnapshot.timestamp).getTime() - new Date(firstDeposit.timestamp).getTime()) / (1000 * 60 * 60 * 24);

      if (daysInvested < 0.01) return 0; // Less than 15 minutes, too early

      const currentValue = latestSnapshot.total_value;
      const totalReturn = (currentValue - netInvested) / netInvested;

      // Annualize: APY = (1 + return)^(365/days) - 1
      // BUT: For very new vaults (< 1 day), don't annualize to avoid unrealistic extrapolations
      let apy: number;
      
      if (daysInvested < 1) {
        // For vaults less than 1 day old, show actual return percentage
        // This prevents -100% APY from a -0.27% loss over 10 minutes
        console.warn(`[calculateAPY] ${vaultId} - Vault is very new (${(daysInvested * 24).toFixed(1)} hours), showing actual return instead of annualized`);
        apy = totalReturn * 100;
      } else {
        // For vaults 1 day or older, annualize the return
        apy = (Math.pow(1 + totalReturn, 365 / daysInvested) - 1) * 100;
      }

      console.log(`[calculateAPY] ${vaultId} - COST-BASIS METHOD:`, {
        netInvested: `$${netInvested.toFixed(2)}`,
        currentValue: `$${currentValue.toFixed(2)}`,
        profit: `$${(currentValue - netInvested).toFixed(2)}`,
        return: `${(totalReturn * 100).toFixed(2)}%`,
        daysInvested: daysInvested.toFixed(2),
        apy: `${apy.toFixed(2)}%`,
        annualized: daysInvested >= 1,
      });

      // For very new vaults (< 1 day), show a warning that APY is extrapolated
      if (daysInvested < 1) {
        console.warn(`[calculateAPY] ${vaultId} - Vault is very new (${(daysInvested * 24).toFixed(1)} hours), showing actual return (not annualized)`);
      }

      // Cap APY at reasonable bounds (-100% to 100,000%)
      return Math.max(-100, Math.min(100000, apy));
    }

    // METHOD 2: Fallback to snapshot-based APY (less accurate for trading vaults)
    console.log(`[calculateAPY] ${vaultId} - Using snapshot-based method (no transaction data)`);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: snapshots } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
      .gte('timestamp', thirtyDaysAgo)
      .order('timestamp', { ascending: true });

    if (!snapshots || snapshots.length < 2) {
      return 0; // Not enough data
    }

    // Filter out any snapshots with unrealistic values
    // 1. Remove corrupted stroops values (> 1 billion)
    // 2. Remove outliers that are 10x different from median
    const validValues = snapshots
      .filter(s => s.total_value > 0 && s.total_value < 1_000_000_000)
      .map(s => s.total_value)
      .sort((a, b) => a - b);
    
    if (validValues.length < 2) {
      console.warn(`[calculateAPY] Not enough valid snapshots for vault ${vaultId}`);
      return 0;
    }

    const median = validValues[Math.floor(validValues.length / 2)];
    
    const filteredSnapshots = snapshots.filter(s => {
      if (s.total_value <= 0 || s.total_value >= 1_000_000_000) return false;
      const ratio = s.total_value / (median || 1);
      return ratio >= 0.1 && ratio <= 10; // Within 10x of median
    });

    if (filteredSnapshots.length < 2) {
      console.warn(`[calculateAPY] Not enough valid snapshots after filtering for vault ${vaultId}`);
      return 0;
    }

    const firstSnapshot = filteredSnapshots[0];
    const lastSnapshot = filteredSnapshots[filteredSnapshots.length - 1];

    const initialValue = firstSnapshot.total_value;
    const currentValue = lastSnapshot.total_value;

    if (initialValue <= 0) return 0;

    // Calculate time period in days
    const timeDiff = new Date(lastSnapshot.timestamp).getTime() - new Date(firstSnapshot.timestamp).getTime();
    const days = timeDiff / (1000 * 60 * 60 * 24);

    if (days <= 0) return 0;

    // Calculate simple return
    const simpleReturn = (currentValue - initialValue) / initialValue;

    // Annualize the return (APY = (1 + return) ^ (365 / days) - 1)
    // BUT: For very new vaults (< 1 day), don't annualize to avoid unrealistic extrapolations
    let apy: number;
    
    if (days < 1) {
      // For vaults less than 1 day old, show actual return percentage
      console.log(`[calculateAPY] ${vaultId} - SNAPSHOT METHOD (${(days * 24).toFixed(1)} hours): Initial: $${initialValue.toFixed(2)}, Current: $${currentValue.toFixed(2)}, Return: ${(simpleReturn * 100).toFixed(2)}% (not annualized)`);
      apy = simpleReturn * 100;
    } else {
      // For vaults 1 day or older, annualize the return
      apy = (Math.pow(1 + simpleReturn, 365 / days) - 1) * 100;
      console.log(`[calculateAPY] ${vaultId} - SNAPSHOT METHOD: Initial: $${initialValue.toFixed(2)}, Current: $${currentValue.toFixed(2)}, Days: ${days.toFixed(1)}, APY: ${apy.toFixed(2)}%`);
    }

    // Cap APY at reasonable bounds (-100% to 10000%)
    return Math.max(-100, Math.min(10000, apy));
  } catch (error) {
    console.error('[calculateAPY] Error:', error);
    return 0;
  }
}

/**
 * Get deposit and withdrawal totals from transaction ledger
 * 
 * PROPER METHOD: Track actual transactions with entry prices
 * Falls back to estimation if no transaction data exists
 */
async function getTransactionTotals(vaultId: string, currentTVL: number): Promise<{
  totalDeposits: number;
  totalWithdrawals: number;
}> {
  try {
    // Get vault UUID
    const { data: vault } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (!vault) return { totalDeposits: currentTVL, totalWithdrawals: 0 };

    // Try to get from transaction ledger (new method - accurate!)
    const { data: transactions, error: txError } = await supabase
      .from('vault_transactions')
      .select('type, amount_usd')
      .eq('vault_id', vault.id);

    if (!txError && transactions && transactions.length > 0) {
      // We have transaction data! Calculate accurately
      const deposits = transactions
        .filter(tx => tx.type === 'deposit')
        .reduce((sum, tx) => sum + tx.amount_usd, 0);
      
      const withdrawals = transactions
        .filter(tx => tx.type === 'withdrawal')
        .reduce((sum, tx) => sum + tx.amount_usd, 0);

      console.log(`[getTransactionTotals] ${vaultId} - Using transaction ledger: Deposits=$${deposits.toFixed(2)}, Withdrawals=$${withdrawals.toFixed(2)}`);
      
      return { totalDeposits: deposits, totalWithdrawals: withdrawals };
    }

    // Fallback: Estimate from snapshots (old method - less accurate)
    console.log(`[getTransactionTotals] ${vaultId} - No transaction data, falling back to estimation`);
    
    const { data: snapshots } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
      .order('timestamp', { ascending: true });

    if (!snapshots || snapshots.length === 0) {
      return { totalDeposits: currentTVL, totalWithdrawals: 0 };
    }

    // Filter out zero values AND corrupted stroops values (> 1 billion = clearly stroops, not USD)
    const validSnapshots = snapshots.filter(s => s.total_value > 0 && s.total_value < 1_000_000_000);
    if (validSnapshots.length === 0) {
      console.warn(`[getTransactionTotals] No valid snapshots found for vault ${vaultId}. Using current TVL as baseline.`);
      return { totalDeposits: currentTVL, totalWithdrawals: 0 };
    }

    // Use the MINIMUM value as deposit baseline (closer to reality than first snapshot)
    // This assumes vault only has gains, no losses - imperfect but better than alternatives
    const minValue = Math.min(...validSnapshots.map(s => s.total_value));
    
    // Safety check: if min value is way higher than current TVL,
    // the historical data is corrupted. Use current TVL as baseline.
    if (minValue > currentTVL * 2) {
      console.warn(`[getTransactionTotals] Min value (${minValue}) much higher than current TVL (${currentTVL}). Using current TVL as deposit baseline.`);
      return { totalDeposits: currentTVL, totalWithdrawals: 0 };
    }
    
    // For withdrawals, look for significant drops (>30% decrease between consecutive snapshots)
    // IMPORTANT: Use validSnapshots array to avoid corrupted data
    let totalWithdrawals = 0;
    for (let i = 1; i < validSnapshots.length; i++) {
      const prevValue = validSnapshots[i - 1].total_value;
      const currValue = validSnapshots[i].total_value;
      const valueDiff = prevValue - currValue;
      
      // If value dropped by more than 30%, it's likely a withdrawal
      if (valueDiff > prevValue * 0.3 && valueDiff > 0) {
        totalWithdrawals += valueDiff;
      }
    }

    console.log(`[getTransactionTotals] ${vaultId} - Min: $${minValue.toFixed(2)}, Current: $${currentTVL.toFixed(2)}, Withdrawals: $${totalWithdrawals.toFixed(2)}`);

    return { 
      totalDeposits: minValue, 
      totalWithdrawals 
    };
  } catch (error) {
    console.error('[getTransactionTotals] Error:', error);
    return { totalDeposits: currentTVL, totalWithdrawals: 0 };
  }
}

/**
 * Calculate TVL change over time period
 */
async function getTVLChange(vaultId: string, hours: number): Promise<number> {
  try {
    // Get vault UUID
    const { data: vault } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (!vault) return 0;

    const targetTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Get current and historical snapshot
    const { data: snapshots } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
      .order('timestamp', { ascending: false })
      .limit(1);

    const { data: historicalSnapshot } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
      .lte('timestamp', targetTime)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (!snapshots || snapshots.length === 0) return 0;

    const currentValue = snapshots[0].total_value;

    if (!historicalSnapshot || historicalSnapshot.length === 0) {
      return 0; // Not enough historical data
    }

    const historicalValue = historicalSnapshot[0].total_value;

    if (historicalValue <= 0) return 0;

    return ((currentValue - historicalValue) / historicalValue) * 100;
  } catch (error) {
    console.error('[getTVLChange] Error:', error);
    return 0;
  }
}

/**
 * Get comprehensive analytics for a single vault
 */
export async function getVaultAnalytics(vaultId: string): Promise<VaultAnalytics> {
  try {
    // Get vault data
    const { data: vault } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (!vault) {
      throw new Error('Vault not found');
    }

    // Get the LATEST performance snapshot (which already has USD value and calculated returns)
    const { data: latestSnapshot } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
      .order('timestamp', { ascending: false })
      .limit(1);

    // If no snapshots, TVL is 0
    const tvl = latestSnapshot && latestSnapshot.length > 0 
      ? latestSnapshot[0].total_value 
      : 0;

    console.log(`[getVaultAnalytics] ${vaultId} - Current TVL from latest snapshot: $${tvl.toFixed(2)}`);

    // Use pre-calculated APY from snapshot if available, otherwise calculate it
    let apy: number;
    if (latestSnapshot && latestSnapshot.length > 0 && latestSnapshot[0].apy_current !== null) {
      apy = latestSnapshot[0].apy_current;
      console.log(`[getVaultAnalytics] ${vaultId} - Using pre-calculated APY: ${apy.toFixed(2)}%`);
    } else {
      apy = await calculateAPY(vaultId);
      console.log(`[getVaultAnalytics] ${vaultId} - Calculated APY on-the-fly: ${apy.toFixed(2)}%`);
    }

    // Get transaction totals (pass current TVL for safety checks)
    const { totalDeposits, totalWithdrawals } = await getTransactionTotals(vaultId, tvl);
    const netDeposits = totalDeposits - totalWithdrawals;

    // Calculate earnings
    // Earnings = Current TVL - Net Deposits
    let totalEarnings = tvl - netDeposits;
    
    // Safety check: if earnings are wildly negative (more than TVL), 
    // it means our deposit tracking is wrong. Reset to 0.
    if (totalEarnings < -tvl) {
      console.warn(`[getVaultAnalytics] Unrealistic earnings (${totalEarnings}) for vault ${vaultId}. Resetting to 0.`);
      totalEarnings = 0;
    }
    
    const earningsPercentage = netDeposits > 0 ? (totalEarnings / netDeposits) * 100 : 0;

    console.log(`[getVaultAnalytics] ${vaultId} DETAILED CALCULATION:`, {
      tvl: `$${tvl.toFixed(2)}`,
      totalDeposits: `$${totalDeposits.toFixed(2)}`,
      totalWithdrawals: `$${totalWithdrawals.toFixed(2)}`,
      netDeposits: `$${netDeposits.toFixed(2)}`,
      totalEarnings: `$${totalEarnings.toFixed(2)}`,
      earningsPercentage: `${earningsPercentage.toFixed(2)}%`,
      calculation: `Earnings = TVL (${tvl.toFixed(2)}) - NetDeposits (${netDeposits.toFixed(2)}) = ${totalEarnings.toFixed(2)}`,
    });

    // Get total shares from blockchain state
    // NOTE: totalShares is NOT in stroops - it's a dimensionless ratio
    // In the contract: shares = (deposit_amount * total_shares) / total_value
    // Both numerator and denominator are in stroops, so shares cancel out to be unitless
    const { data: vaultData } = await supabase
      .from('vaults')
      .select('config')
      .eq('vault_id', vaultId)
      .single();
    
    const totalShares = vaultData?.config?.current_state?.totalShares || '0';

    // Calculate share price (TVL in USD per share)
    // Shares are unitless ratios, not stroops amounts
    const sharePrice = Number(totalShares) > 0 
      ? tvl / Number(totalShares)
      : 1.0;

    // Use pre-calculated TVL changes from snapshots if available, otherwise calculate
    let tvlChange24h: number;
    let tvlChange7d: number;
    
    if (latestSnapshot && latestSnapshot.length > 0 && latestSnapshot[0].returns_24h !== null) {
      tvlChange24h = latestSnapshot[0].returns_24h;
      console.log(`[getVaultAnalytics] ${vaultId} - Using pre-calculated 24h change: ${tvlChange24h.toFixed(2)}%`);
    } else {
      tvlChange24h = await getTVLChange(vaultId, 24);
      console.log(`[getVaultAnalytics] ${vaultId} - Calculated 24h change on-the-fly: ${tvlChange24h.toFixed(2)}%`);
    }

    if (latestSnapshot && latestSnapshot.length > 0 && latestSnapshot[0].returns_7d !== null) {
      tvlChange7d = latestSnapshot[0].returns_7d;
      console.log(`[getVaultAnalytics] ${vaultId} - Using pre-calculated 7d change: ${tvlChange7d.toFixed(2)}%`);
    } else {
      tvlChange7d = await getTVLChange(vaultId, 24 * 7);
      console.log(`[getVaultAnalytics] ${vaultId} - Calculated 7d change on-the-fly: ${tvlChange7d.toFixed(2)}%`);
    }

    return {
      vaultId,
      tvl,
      tvlChange24h,
      tvlChange7d,
      apy,
      totalDeposits,
      totalWithdrawals,
      netDeposits,
      totalEarnings,
      earningsPercentage,
      sharePrice,
      totalShares,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[getVaultAnalytics] Error:', error);
    throw error;
  }
}

/**
 * Get portfolio-wide analytics for a user
 */
export async function getPortfolioAnalytics(
  userAddress: string,
  network: string = 'testnet'
): Promise<PortfolioAnalytics> {
  try {
    // Get all user vaults
    const { data: vaults } = await supabase
      .from('vaults')
      .select('*')
      .eq('owner_wallet_address', userAddress)
      .eq('network', network);

    if (!vaults || vaults.length === 0) {
      return {
        totalTVL: 0,
        totalEarnings: 0,
        averageAPY: 0,
        weightedAPY: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        bestPerformingVault: null,
        worstPerformingVault: null,
        vaultCount: 0,
        activeVaultCount: 0,
      };
    }

    // Get analytics for each vault
    const vaultAnalytics = await Promise.all(
      vaults.map(v => getVaultAnalytics(v.vault_id))
    );

    // Calculate portfolio totals
    const totalTVL = vaultAnalytics.reduce((sum, va) => sum + va.tvl, 0);
    const totalEarnings = vaultAnalytics.reduce((sum, va) => sum + va.totalEarnings, 0);
    const totalDeposits = vaultAnalytics.reduce((sum, va) => sum + va.totalDeposits, 0);
    const totalWithdrawals = vaultAnalytics.reduce((sum, va) => sum + va.totalWithdrawals, 0);

    console.log(`[getPortfolioAnalytics] Portfolio Summary for ${userAddress}:`, {
      vaultCount: vaults.length,
      totalTVL: `$${totalTVL.toFixed(2)}`,
      totalEarnings: `$${totalEarnings.toFixed(2)}`,
      totalDeposits: `$${totalDeposits.toFixed(2)}`,
      perVault: vaultAnalytics.map(va => ({
        id: va.vaultId,
        tvl: `$${va.tvl.toFixed(2)}`,
        earnings: `$${va.totalEarnings.toFixed(2)}`,
      })),
    });

    // Calculate average APY (simple average)
    const validAPYs = vaultAnalytics.filter(va => va.apy !== 0);
    const averageAPY = validAPYs.length > 0
      ? validAPYs.reduce((sum, va) => sum + va.apy, 0) / validAPYs.length
      : 0;

    // Calculate weighted APY (weighted by TVL)
    const weightedAPY = totalTVL > 0
      ? vaultAnalytics.reduce((sum, va) => sum + (va.apy * va.tvl), 0) / totalTVL
      : 0;

    // Find best and worst performing vaults
    let bestPerformingVault = null;
    let worstPerformingVault = null;

    if (vaultAnalytics.length > 0) {
      const sortedByAPY = [...vaultAnalytics].sort((a, b) => b.apy - a.apy);
      const bestVault = vaults.find(v => v.vault_id === sortedByAPY[0].vaultId);
      const worstVault = vaults.find(v => v.vault_id === sortedByAPY[sortedByAPY.length - 1].vaultId);

      bestPerformingVault = bestVault ? {
        vaultId: sortedByAPY[0].vaultId,
        name: bestVault.config?.name || 'Unnamed Vault',
        apy: sortedByAPY[0].apy,
      } : null;

      worstPerformingVault = worstVault ? {
        vaultId: sortedByAPY[sortedByAPY.length - 1].vaultId,
        name: worstVault.config?.name || 'Unnamed Vault',
        apy: sortedByAPY[sortedByAPY.length - 1].apy,
      } : null;
    }

    return {
      totalTVL,
      totalEarnings,
      averageAPY,
      weightedAPY,
      totalDeposits,
      totalWithdrawals,
      bestPerformingVault,
      worstPerformingVault,
      vaultCount: vaults.length,
      activeVaultCount: vaults.filter(v => v.status === 'active').length,
    };
  } catch (error) {
    console.error('[getPortfolioAnalytics] Error:', error);
    throw error;
  }
}

/**
 * Get historical performance data for charts
 */
export async function getHistoricalPerformance(
  vaultId: string,
  days: number = 30
): Promise<Array<{ date: string; value: number; apy: number }>> {
  try {
    // Get vault UUID
    const { data: vault } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (!vault) return [];

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: snapshots } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
      .gte('timestamp', startDate)
      .order('timestamp', { ascending: true });

    if (!snapshots || snapshots.length === 0) return [];

    // Calculate APY for each point relative to start
    const firstValue = snapshots[0].total_value;

    return snapshots.map((snapshot) => {
      const currentValue = snapshot.total_value;
      const timeDiff = new Date(snapshot.timestamp).getTime() - new Date(snapshots[0].timestamp).getTime();
      const daysPassed = timeDiff / (1000 * 60 * 60 * 24);

      let apy = 0;
      if (daysPassed > 0 && firstValue > 0) {
        const simpleReturn = (currentValue - firstValue) / firstValue;
        apy = (Math.pow(1 + simpleReturn, 365 / daysPassed) - 1) * 100;
        apy = Math.max(-100, Math.min(10000, apy));
      }

      return {
        date: new Date(snapshot.timestamp).toLocaleDateString(),
        value: currentValue,
        apy: apy,
      };
    });
  } catch (error) {
    console.error('[getHistoricalPerformance] Error:', error);
    return [];
  }
}
