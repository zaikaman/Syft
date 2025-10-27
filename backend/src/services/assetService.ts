// T040: Asset balance fetching service using Horizon SDK
// Purpose: Fetch user asset balances from Stellar Horizon API

import { horizonServer } from '../lib/horizonClient';

export interface AssetBalance {
  asset_code: string;
  asset_issuer?: string;
  asset_type: string;
  balance: string;
  limit?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
  is_authorized?: boolean;
  is_authorized_to_maintain_liabilities?: boolean;
  is_clawback_enabled?: boolean;
}

export interface WalletAssets {
  address: string;
  balances: AssetBalance[];
  totalAssets: number;
  nativeBalance: string;
  fetchedAt: string;
}

/**
 * Fetch all asset balances for a given Stellar address
 * @param address - Stellar public key (G...)
 * @returns WalletAssets object containing all balances
 */
export async function fetchAssetBalances(address: string): Promise<WalletAssets> {
  try {
    // Validate address format
    if (!address || !address.startsWith('G') || address.length !== 56) {
      throw new Error('Invalid Stellar address format');
    }

    // Load account from Horizon
    const account = await horizonServer.loadAccount(address);
    
    // Extract balances
    const balances: AssetBalance[] = account.balances.map((balance: any) => ({
      asset_code: balance.asset_type === 'native' ? 'XLM' : balance.asset_code,
      asset_issuer: balance.asset_issuer,
      asset_type: balance.asset_type,
      balance: balance.balance,
      limit: balance.limit,
      buying_liabilities: balance.buying_liabilities,
      selling_liabilities: balance.selling_liabilities,
      is_authorized: balance.is_authorized,
      is_authorized_to_maintain_liabilities: balance.is_authorized_to_maintain_liabilities,
      is_clawback_enabled: balance.is_clawback_enabled,
    }));

    // Find native XLM balance
    const nativeBalance = balances.find(b => b.asset_type === 'native')?.balance || '0';

    return {
      address,
      balances,
      totalAssets: balances.length,
      nativeBalance,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    // Handle specific Horizon errors
    if (error.response?.status === 404) {
      throw new Error('Account not found. The account may not be funded yet.');
    }
    
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Re-throw with context
    throw new Error(`Failed to fetch asset balances: ${error.message}`);
  }
}

/**
 * Get balance for a specific asset
 * @param address - Stellar public key
 * @param assetCode - Asset code (e.g., 'USDC', 'XLM')
 * @param assetIssuer - Asset issuer (optional, not needed for XLM)
 */
export async function getAssetBalance(
  address: string,
  assetCode: string,
  assetIssuer?: string
): Promise<string> {
  try {
    const walletAssets = await fetchAssetBalances(address);
    
    // For native XLM
    if (assetCode === 'XLM' || assetCode === 'native') {
      return walletAssets.nativeBalance;
    }

    // For other assets
    const asset = walletAssets.balances.find(
      b => b.asset_code === assetCode && 
           (!assetIssuer || b.asset_issuer === assetIssuer)
    );

    return asset?.balance || '0';
  } catch (error: any) {
    throw new Error(`Failed to get ${assetCode} balance: ${error.message}`);
  }
}

/**
 * Check if an account holds a specific asset (trustline exists)
 * @param address - Stellar public key
 * @param assetCode - Asset code
 * @param assetIssuer - Asset issuer
 */
export async function hasAssetTrustline(
  address: string,
  assetCode: string,
  assetIssuer: string
): Promise<boolean> {
  try {
    const walletAssets = await fetchAssetBalances(address);
    
    return walletAssets.balances.some(
      b => b.asset_code === assetCode && b.asset_issuer === assetIssuer
    );
  } catch (error: any) {
    throw new Error(`Failed to check trustline: ${error.message}`);
  }
}

/**
 * Get available balance (excluding liabilities)
 * @param address - Stellar public key
 * @param assetCode - Asset code
 * @param assetIssuer - Asset issuer (optional)
 */
export async function getAvailableBalance(
  address: string,
  assetCode: string,
  assetIssuer?: string
): Promise<string> {
  try {
    const balance = await getAssetBalance(address, assetCode, assetIssuer);
    const walletAssets = await fetchAssetBalances(address);
    
    const asset = walletAssets.balances.find(
      b => b.asset_code === assetCode && 
           (!assetIssuer || b.asset_issuer === assetIssuer)
    );

    if (!asset) return '0';

    // Calculate available balance (total - selling liabilities)
    const totalBalance = parseFloat(balance);
    const sellingLiabilities = parseFloat(asset.selling_liabilities || '0');
    const available = totalBalance - sellingLiabilities;

    return Math.max(0, available).toFixed(7);
  } catch (error: any) {
    throw new Error(`Failed to calculate available balance: ${error.message}`);
  }
}

export default {
  fetchAssetBalances,
  getAssetBalance,
  hasAssetTrustline,
  getAvailableBalance,
};
