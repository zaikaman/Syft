/**
 * Analytics Service - Production-ready vault analytics and APY calculations
 */

import { supabase } from '../lib/supabase.js';

// Cache for resolved asset names to avoid repeated API calls
const assetNameCache = new Map<string, { name: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

/**
 * Resolve a contract address to its token symbol
 * Uses Soroswap API to fetch token information
 */
async function resolveAssetName(contractAddress: string, network: string): Promise<string> {
  // Check cache first
  const cached = assetNameCache.get(contractAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.name;
  }

  try {
    // Fetch from Soroswap API
    const response = await fetch('https://api.soroswap.finance/api/tokens');
    if (response.ok) {
      const data = await response.json() as any;
      const networkData = data.find((n: any) => n.network === network.toLowerCase());
      
      if (networkData && networkData.assets) {
        const token = networkData.assets.find((asset: any) => asset.contract === contractAddress);
        if (token) {
          const name = token.code || token.name;
          assetNameCache.set(contractAddress, { name, timestamp: Date.now() });
          return name;
        }
      }
    }
  } catch (error) {
    console.warn(`[resolveAssetName] Failed to resolve ${contractAddress}:`, error);
  }

  // If resolution fails, return shortened address
  return `${contractAddress.slice(0, 4)}...${contractAddress.slice(-4)}`;
}

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

      // Get current TVL - try snapshot first, fallback to live vault state
      let currentValue = 0;
      let referenceTimestamp = new Date().toISOString();
      
      const { data: latestSnapshot } = await supabase
        .from('vault_performance')
        .select('total_value, timestamp')
        .eq('vault_id', vault.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (latestSnapshot) {
        currentValue = latestSnapshot.total_value;
        referenceTimestamp = latestSnapshot.timestamp;
      } else {
        // No snapshot yet - get live vault state
        console.log(`[calculateAPY] ${vaultId} - No performance snapshot found, using live vault state`);
        const { data: vaultData } = await supabase
          .from('vaults')
          .select('config, contract_address')
          .eq('vault_id', vaultId)
          .single();
        
        if (vaultData?.config?.current_state?.totalValue) {
          // Convert stroops to USD
          const { stroopsToUSD } = await import('./priceService.js');
          const stroopsValue = parseFloat(vaultData.config.current_state.totalValue);
          currentValue = await stroopsToUSD(stroopsValue);
          console.log(`[calculateAPY] ${vaultId} - Using live TVL: $${currentValue.toFixed(2)}`);
        } else {
          console.warn(`[calculateAPY] ${vaultId} - No TVL data available (no snapshot and no current_state)`);
          return 0;
        }
      }

      // Get first deposit timestamp
      const firstDeposit = deposits[0];
      const daysInvested = (new Date(referenceTimestamp).getTime() - new Date(firstDeposit.timestamp).getTime()) / (1000 * 60 * 60 * 24);

      if (daysInvested < 0.01) return 0; // Less than 15 minutes, too early
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
    // IMPORTANT: This should match the earnings calculation methodology
    console.log(`[calculateAPY] ${vaultId} - Using snapshot-based method (no transaction data)`);
    
    const { data: snapshots } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
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

    // Get current TVL from latest snapshot
    const lastSnapshot = filteredSnapshots[filteredSnapshots.length - 1];
    const currentValue = lastSnapshot.total_value;

    // Get the deposit baseline using the SAME method as earnings calculation
    // This ensures APY and earnings are always consistent
    const { totalDeposits, totalWithdrawals } = await getTransactionTotals(vaultId, currentValue);
    const netDeposits = totalDeposits - totalWithdrawals;

    if (netDeposits <= 0) {
      console.warn(`[calculateAPY] ${vaultId} - Net deposits <= 0, cannot calculate APY`);
      return 0;
    }

    // Calculate time period: use earliest snapshot as start time
    const firstSnapshot = filteredSnapshots[0];
    const timeDiff = new Date(lastSnapshot.timestamp).getTime() - new Date(firstSnapshot.timestamp).getTime();
    const days = timeDiff / (1000 * 60 * 60 * 24);

    if (days <= 0) {
      console.warn(`[calculateAPY] ${vaultId} - Invalid time period`);
      return 0;
    }

    // Calculate simple return using net deposits as baseline (same as earnings!)
    const simpleReturn = (currentValue - netDeposits) / netDeposits;

    console.log(`[calculateAPY] ${vaultId} - SNAPSHOT METHOD (consistent with earnings):`, {
      netDeposits: `$${netDeposits.toFixed(2)}`,
      currentValue: `$${currentValue.toFixed(2)}`,
      profit: `$${(currentValue - netDeposits).toFixed(2)}`,
      return: `${(simpleReturn * 100).toFixed(2)}%`,
      days: days.toFixed(2),
    });

    // Annualize the return (APY = (1 + return) ^ (365 / days) - 1)
    // BUT: For very new vaults (< 1 day), don't annualize to avoid unrealistic extrapolations
    let apy: number;
    
    if (days < 1) {
      // For vaults less than 1 day old, show actual return percentage
      console.log(`[calculateAPY] ${vaultId} - Vault is very new (${(days * 24).toFixed(1)} hours), showing actual return (not annualized)`);
      apy = simpleReturn * 100;
    } else {
      // For vaults 1 day or older, annualize the return
      apy = (Math.pow(1 + simpleReturn, 365 / days) - 1) * 100;
      console.log(`[calculateAPY] ${vaultId} - Annualized APY: ${apy.toFixed(2)}%`);
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
    console.warn(`[getTransactionTotals] ${vaultId} - No transaction data available! Falling back to snapshot-based estimation. Earnings calculations will be approximate only.`);
    
    const { data: snapshots } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
      .order('timestamp', { ascending: true });

    if (!snapshots || snapshots.length === 0) {
      console.warn(`[getTransactionTotals] ${vaultId} - No snapshots either. Assuming current TVL as deposit baseline.`);
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

    // Get TVL - try snapshot first, fallback to live vault state
    let tvl = 0;
    
    if (latestSnapshot && latestSnapshot.length > 0) {
      tvl = latestSnapshot[0].total_value;
      console.log(`[getVaultAnalytics] ${vaultId} - Current TVL from snapshot: $${tvl.toFixed(2)}`);
    } else {
      // No snapshot yet - get live vault state
      console.log(`[getVaultAnalytics] ${vaultId} - No performance snapshot, using live vault state`);
      const { data: vaultData } = await supabase
        .from('vaults')
        .select('config')
        .eq('vault_id', vaultId)
        .single();
      
      if (vaultData?.config?.current_state?.totalValue) {
        // Convert stroops to USD
        const { stroopsToUSD } = await import('./priceService.js');
        const stroopsValue = parseFloat(vaultData.config.current_state.totalValue);
        tvl = await stroopsToUSD(stroopsValue);
        console.log(`[getVaultAnalytics] ${vaultId} - Current TVL from live state: $${tvl.toFixed(2)}`);
      } else {
        console.warn(`[getVaultAnalytics] ${vaultId} - No TVL data available (no snapshot and no current_state)`);
        tvl = 0;
      }
    }

    // ALWAYS calculate APY fresh to ensure consistency with earnings calculation
    // Don't use pre-calculated snapshot APY as it may use different methodology
    const apy = await calculateAPY(vaultId);
    console.log(`[getVaultAnalytics] ${vaultId} - Calculated APY: ${apy.toFixed(2)}%`);

    // Get transaction totals (pass current TVL for safety checks)
    const { totalDeposits, totalWithdrawals } = await getTransactionTotals(vaultId, tvl);
    const netDeposits = totalDeposits - totalWithdrawals;

    // Calculate earnings
    // Earnings = Current TVL - Net Deposits
    // NOTE: If no transaction data exists, this uses min snapshot value as deposits,
    // which means earnings will be TVL - min(snapshot), representing growth from lowest point
    let totalEarnings = tvl - netDeposits;
    
    // Safety checks for unrealistic values
    if (totalEarnings < -tvl) {
      console.warn(`[getVaultAnalytics] Unrealistic earnings (${totalEarnings}) for vault ${vaultId}. Resetting to 0.`);
      totalEarnings = 0;
    }
    
    // If earnings are negative but very small (< 1% of TVL), it's likely just price fluctuations
    // when we have no transaction data. Consider it break-even.
    if (totalEarnings < 0 && Math.abs(totalEarnings) < tvl * 0.01 && totalDeposits === totalWithdrawals) {
      console.log(`[getVaultAnalytics] Small negative earnings without transaction data. Likely price noise. Setting to 0.`);
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
        name: bestVault.name || bestVault.config?.name || 'Unnamed Vault',
        apy: sortedByAPY[0].apy,
      } : null;

      worstPerformingVault = worstVault ? {
        vaultId: sortedByAPY[sortedByAPY.length - 1].vaultId,
        name: worstVault.name || worstVault.config?.name || 'Unnamed Vault',
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

/**
 * Get portfolio-wide performance history for charts
 */
export async function getPortfolioPerformanceHistory(
  userAddress: string,
  network: string = 'testnet',
  days: number = 30
): Promise<Array<{ date: string; value: number; apy: number }>> {
  try {
    // Get all user vaults
    const { data: vaults } = await supabase
      .from('vaults')
      .select('id, vault_id')
      .eq('owner_wallet_address', userAddress)
      .eq('network', network);

    if (!vaults || vaults.length === 0) return [];

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get all snapshots for all vaults
    const vaultIds = vaults.map(v => v.id);
    const { data: snapshots } = await supabase
      .from('vault_performance')
      .select('*')
      .in('vault_id', vaultIds)
      .gte('timestamp', startDate)
      .order('timestamp', { ascending: true });

    if (!snapshots || snapshots.length === 0) return [];

    // FIXED: Group by hour and vault, taking only the LATEST snapshot per vault per hour
    // This prevents summing multiple snapshots from the same vault in one hour
    const groupedByHourAndVault: Record<string, Record<number, any>> = {};
    
    snapshots.forEach(snapshot => {
      const hourKey = new Date(snapshot.timestamp).toISOString().slice(0, 13); // YYYY-MM-DDTHH
      if (!groupedByHourAndVault[hourKey]) {
        groupedByHourAndVault[hourKey] = {};
      }
      
      // Keep only the latest snapshot for each vault in this hour
      const existing = groupedByHourAndVault[hourKey][snapshot.vault_id];
      if (!existing || new Date(snapshot.timestamp) > new Date(existing.timestamp)) {
        groupedByHourAndVault[hourKey][snapshot.vault_id] = snapshot;
      }
    });

    // Now sum the latest snapshot from each vault per hour
    const portfolioHistory: Array<{ timestamp: string; totalValue: number }> = [];
    
    for (const hourKey of Object.keys(groupedByHourAndVault).sort()) {
      const vaultSnapshots = Object.values(groupedByHourAndVault[hourKey]);
      const totalValue = vaultSnapshots.reduce((sum, s: any) => sum + s.total_value, 0);
      const latestTimestamp = vaultSnapshots.reduce((latest: string, s: any) => {
        return new Date(s.timestamp) > new Date(latest) ? s.timestamp : latest;
      }, vaultSnapshots[0].timestamp);
      
      portfolioHistory.push({
        timestamp: latestTimestamp,
        totalValue,
      });
    }

    if (portfolioHistory.length === 0) return [];

    const firstValue = portfolioHistory[0].totalValue;

    return portfolioHistory.map((point) => {
      const currentValue = point.totalValue;
      const timeDiff = new Date(point.timestamp).getTime() - new Date(portfolioHistory[0].timestamp).getTime();
      const daysPassed = timeDiff / (1000 * 60 * 60 * 24);

      let apy = 0;
      if (daysPassed > 0 && firstValue > 0) {
        const simpleReturn = (currentValue - firstValue) / firstValue;
        apy = (Math.pow(1 + simpleReturn, 365 / daysPassed) - 1) * 100;
        apy = Math.max(-100, Math.min(10000, apy));
      }

      return {
        date: new Date(point.timestamp).toLocaleDateString(),
        value: currentValue,
        apy: apy,
      };
    });
  } catch (error) {
    console.error('[getPortfolioPerformanceHistory] Error:', error);
    return [];
  }
}

/**
 * Get portfolio asset allocation
 */
export async function getPortfolioAllocation(
  userAddress: string,
  network: string = 'testnet'
): Promise<Array<{ asset: string; value: number; percentage: number; color: string }>> {
  try {
    // Get all user vaults with their current state
    const { data: vaults } = await supabase
      .from('vaults')
      .select('*')
      .eq('owner_wallet_address', userAddress)
      .eq('network', network);

    if (!vaults || vaults.length === 0) return [];

    // Get analytics for each vault to get TVL
    const vaultAnalytics = await Promise.all(
      vaults.map(v => getVaultAnalytics(v.vault_id))
    );

    const totalTVL = vaultAnalytics.reduce((sum, va) => sum + va.tvl, 0);

    if (totalTVL === 0) return [];

    // Calculate asset allocation based on ACTUAL on-chain balances, not configured allocations
    const assetMap = new Map<string, number>();

    for (let i = 0; i < vaults.length; i++) {
      const vault = vaults[i];
      
      console.log(`[getPortfolioAllocation] Processing vault ${vault.vault_id}`);
      
      // Get actual on-chain state with real token balances
      try {
        const { monitorVaultState } = await import('./vaultMonitorService.js');
        const vaultState = await monitorVaultState(vault.contract_address, vault.network);
        
        if (vaultState && vaultState.assetBalances && vaultState.assetBalances.length > 0) {
          console.log(`[getPortfolioAllocation] Got ${vaultState.assetBalances.length} asset balances from contract`);
          
          // Use actual on-chain balances
          for (const assetBalance of vaultState.assetBalances) {
            const assetAddr = assetBalance.asset;
            const balanceInStroops = parseFloat(assetBalance.balance);
            
            // Skip zero balances
            if (balanceInStroops === 0) continue;
            
            // Convert stroops to USD
            const { stroopsToUSD } = await import('./priceService.js');
            const valueUSD = await stroopsToUSD(balanceInStroops);
            
            // Resolve asset name from contract address
            let assetCode = await resolveAssetName(assetAddr, network);
            
            console.log(`[getPortfolioAllocation] Asset ${assetCode}: ${balanceInStroops} stroops = $${valueUSD.toFixed(2)}`);
            
            const currentValue = assetMap.get(assetCode) || 0;
            assetMap.set(assetCode, currentValue + valueUSD);
          }
        } else {
          // Fallback: use configured allocations if we can't get actual balances
          console.warn(`[getPortfolioAllocation] No asset balances from contract, falling back to configured allocations`);
          
          const analytics = vaultAnalytics[i];
          const vaultTVL = analytics.tvl;
          const assets = vault.config?.assets || [];

          for (const asset of assets) {
            let assetKey = typeof asset === 'string' ? asset : (asset.code || 'UNKNOWN');
            let assetCode = assetKey;
            
            // Resolve contract addresses
            if (typeof assetCode === 'string' && assetCode.startsWith('C') && assetCode.length === 56) {
              assetCode = await resolveAssetName(assetCode, network);
            }

            // Use equal distribution as fallback
            const allocation = typeof asset === 'object' && asset.allocation 
              ? asset.allocation 
              : (100 / assets.length);
            
            const assetValue = (vaultTVL * allocation) / 100;
            
            const currentValue = assetMap.get(assetCode) || 0;
            assetMap.set(assetCode, currentValue + assetValue);
          }
        }
      } catch (error) {
        console.error(`[getPortfolioAllocation] Error getting vault state for ${vault.vault_id}:`, error);
        // Continue with next vault
      }
    }

    // Convert to array and calculate percentages
    const colors = ['#dce85d', '#74b97f', '#60a5fa', '#e06c6e', '#dca204', '#9b87f5', '#f97316', '#22d3ee'];
    let colorIndex = 0;

    const allocation = Array.from(assetMap.entries())
      .map(([asset, value]) => ({
        asset,
        value,
        percentage: (value / totalTVL) * 100,
        color: colors[colorIndex++ % colors.length],
      }))
      .sort((a, b) => b.value - a.value); // Sort by value descending

    console.log('[getPortfolioAllocation] Asset Allocation:', {
      totalTVL: `$${totalTVL.toFixed(2)}`,
      assets: allocation.map(a => `${a.asset}: $${a.value.toFixed(2)} (${a.percentage.toFixed(1)}%)`),
    });

    return allocation;
  } catch (error) {
    console.error('[getPortfolioAllocation] Error:', error);
    return [];
  }
}

/**
 * Calculate Sharpe Ratio for a vault
 * Sharpe Ratio = (Average Return - Risk-Free Rate) / Standard Deviation
 */
async function calculateSharpeRatio(vaultId: string, riskFreeRate: number = 0.04): Promise<number> {
  try {
    const { data: vault } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (!vault) return 0;

    // Get 30 days of snapshots
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: snapshots } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
      .gte('timestamp', thirtyDaysAgo)
      .order('timestamp', { ascending: true });

    if (!snapshots || snapshots.length < 2) return 0;

    // Calculate daily returns
    const dailyReturns: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = snapshots[i - 1].total_value;
      const currValue = snapshots[i].total_value;
      if (prevValue > 0) {
        const dailyReturn = (currValue - prevValue) / prevValue;
        dailyReturns.push(dailyReturn);
      }
    }

    if (dailyReturns.length === 0) return 0;

    // Calculate average return
    const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

    // Calculate standard deviation
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Annualize values (multiply by sqrt(365) for standard deviation)
    const annualizedReturn = avgReturn * 365;
    const annualizedStdDev = stdDev * Math.sqrt(365);
    const dailyRiskFreeRate = riskFreeRate / 365;

    const sharpeRatio = (annualizedReturn - dailyRiskFreeRate * 365) / annualizedStdDev;

    return sharpeRatio;
  } catch (error) {
    console.error('[calculateSharpeRatio] Error:', error);
    return 0;
  }
}

/**
 * Calculate Maximum Drawdown for a vault
 * Max Drawdown = (Trough Value - Peak Value) / Peak Value
 */
async function calculateMaxDrawdown(vaultId: string): Promise<number> {
  try {
    const { data: vault } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (!vault) return 0;

    const { data: snapshots } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
      .order('timestamp', { ascending: true });

    if (!snapshots || snapshots.length < 2) return 0;

    let maxDrawdown = 0;
    let peak = snapshots[0].total_value;

    for (const snapshot of snapshots) {
      const value = snapshot.total_value;
      
      // Update peak if new high
      if (value > peak) {
        peak = value;
      }

      // Calculate drawdown from peak
      const drawdown = ((value - peak) / peak) * 100;
      
      // Update max drawdown if this is worse
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  } catch (error) {
    console.error('[calculateMaxDrawdown] Error:', error);
    return 0;
  }
}

/**
 * Calculate volatility (standard deviation of returns)
 */
async function calculateVolatility(vaultId: string): Promise<number> {
  try {
    const { data: vault } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', vaultId)
      .single();

    if (!vault) return 0;

    // Get 30 days of snapshots
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: snapshots } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault.id)
      .gte('timestamp', thirtyDaysAgo)
      .order('timestamp', { ascending: true });

    if (!snapshots || snapshots.length < 2) return 0;

    // Calculate daily returns
    const dailyReturns: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = snapshots[i - 1].total_value;
      const currValue = snapshots[i].total_value;
      if (prevValue > 0) {
        const dailyReturn = (currValue - prevValue) / prevValue;
        dailyReturns.push(dailyReturn);
      }
    }

    if (dailyReturns.length === 0) return 0;

    // Calculate average return
    const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

    // Calculate standard deviation
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize volatility
    const annualizedVolatility = stdDev * Math.sqrt(365) * 100;

    return annualizedVolatility;
  } catch (error) {
    console.error('[calculateVolatility] Error:', error);
    return 0;
  }
}

/**
 * Get detailed vault analytics with risk metrics
 */
export async function getDetailedVaultAnalytics(vaultId: string) {
  try {
    const baseAnalytics = await getVaultAnalytics(vaultId);
    
    // Calculate additional risk metrics
    const [sharpeRatio, maxDrawdown, volatility] = await Promise.all([
      calculateSharpeRatio(vaultId),
      calculateMaxDrawdown(vaultId),
      calculateVolatility(vaultId),
    ]);

    // Get transaction history
    const { data: vault } = await supabase
      .from('vaults')
      .select('id, config')
      .eq('vault_id', vaultId)
      .single();

    let transactions: any[] = [];
    if (vault) {
      const { data: txData } = await supabase
        .from('vault_transactions')
        .select('*')
        .eq('vault_id', vault.id)
        .order('timestamp', { ascending: false })
        .limit(50);
      
      transactions = txData || [];
    }

    // Get rebalance events from snapshots
    const { data: rebalances } = await supabase
      .from('vault_performance')
      .select('*')
      .eq('vault_id', vault?.id)
      .order('timestamp', { ascending: false })
      .limit(20);

    return {
      ...baseAnalytics,
      riskMetrics: {
        sharpeRatio,
        maxDrawdown,
        volatility,
      },
      transactions,
      recentRebalances: rebalances || [],
      vaultConfig: vault?.config || {},
    };
  } catch (error) {
    console.error('[getDetailedVaultAnalytics] Error:', error);
    throw error;
  }
}

/**
 * Get vault breakdown for portfolio analytics
 */
export async function getVaultBreakdown(userAddress: string, network: string = 'testnet') {
  try {
    // Get all user vaults
    const { data: vaults } = await supabase
      .from('vaults')
      .select('*')
      .eq('owner_wallet_address', userAddress)
      .eq('network', network);

    if (!vaults || vaults.length === 0) return [];

    // Get analytics for each vault
    const vaultAnalytics = await Promise.all(
      vaults.map(async (vault) => {
        const analytics = await getVaultAnalytics(vault.vault_id);
        const [sharpeRatio, maxDrawdown, volatility] = await Promise.all([
          calculateSharpeRatio(vault.vault_id),
          calculateMaxDrawdown(vault.vault_id),
          calculateVolatility(vault.vault_id),
        ]);

        return {
          ...analytics,
          name: vault.name || vault.config?.name || 'Unnamed Vault',
          assets: vault.config?.assets || [],
          status: vault.status,
          riskMetrics: {
            sharpeRatio,
            maxDrawdown,
            volatility,
          },
        };
      })
    );

    return vaultAnalytics.sort((a, b) => b.tvl - a.tvl);
  } catch (error) {
    console.error('[getVaultBreakdown] Error:', error);
    throw error;
  }
}

