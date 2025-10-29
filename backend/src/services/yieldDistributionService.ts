// T132: Yield distribution service for multi-owner vaults
// Purpose: Calculate and distribute profits proportionally to NFT holders

import { supabase } from '../lib/supabase.js';

export interface DistributionResult {
  vaultId: string;
  totalProfit: number;
  distributions: {
    holderAddress: string;
    ownershipPct: number;
    share: number;
    nftId: string;
  }[];
  timestamp: string;
}

/**
 * Calculate profit distribution for all NFT holders of a vault
 */
export async function calculateDistribution(
  vaultId: string,
  totalProfit: number
): Promise<DistributionResult> {
  if (totalProfit <= 0) {
    throw new Error('Total profit must be greater than 0');
  }

  // Get all NFTs for the vault
  const { data: nfts, error: nftsError } = await supabase
    .from('vault_nfts')
    .select('*')
    .eq('vault_id', vaultId);

  if (nftsError) {
    throw new Error(`Failed to fetch vault NFTs: ${nftsError.message}`);
  }

  if (!nfts || nfts.length === 0) {
    throw new Error('No NFT holders found for this vault');
  }

  // Calculate total ownership percentage (stored as percent in DB)
  const totalOwnership = nfts.reduce((sum, nft) => sum + (nft.ownership_percentage || 0), 0);

  if (totalOwnership > 100) {
    throw new Error('Total ownership exceeds 100%');
  }

  // Calculate distribution for each holder
  const distributions = nfts.map((nft) => {
    // Calculate holder's share based on their ownership percentage
    const share = (totalProfit * (nft.ownership_percentage || 0)) / 100;

    return {
      holderAddress: nft.current_holder,
      ownershipPct: nft.ownership_percentage || 0,
      share,
      nftId: nft.nft_id,
    };
  });

  return {
    vaultId,
    totalProfit,
    distributions,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Execute profit distribution and record in database
 */
export async function executeDistribution(
  vaultId: string,
  totalProfit: number,
  transactionHash?: string
): Promise<DistributionResult> {
  const distribution = await calculateDistribution(vaultId, totalProfit);

  // Record distribution in database
  const { error: recordError } = await supabase
    .from('yield_distributions')
    .insert({
      vault_id: vaultId,
      total_profit: totalProfit,
      distributions: distribution.distributions,
      transaction_hash: transactionHash,
      distributed_at: distribution.timestamp,
    });

  if (recordError) {
    console.error('Failed to record distribution:', recordError);
    // Continue even if recording fails
  }

  return distribution;
}

/**
 * Get distribution history for a vault
 */
export async function getDistributionHistory(
  vaultId: string,
  limit: number = 50
): Promise<any[]> {
  const { data, error } = await supabase
    .from('yield_distributions')
    .select('*')
    .eq('vault_id', vaultId)
    .order('distributed_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch distribution history: ${error.message}`);
  }

  return data || [];
}

/**
 * Get total earnings for an NFT holder across all vaults
 */
export async function getHolderEarnings(holderAddress: string): Promise<{
  totalEarnings: number;
  byVault: {
    vaultId: string;
    earnings: number;
    ownershipPct: number;
  }[];
}> {
  // Get all NFTs held by this address
  const { data: nfts, error: nftsError } = await supabase
    .from('vault_nfts')
    .select('*, vaults(*)')
    .eq('current_holder', holderAddress);

  if (nftsError) {
    throw new Error(`Failed to fetch holder NFTs: ${nftsError.message}`);
  }

  if (!nfts || nfts.length === 0) {
    return {
      totalEarnings: 0,
      byVault: [],
    };
  }

  const vaultEarnings: { [vaultId: string]: { earnings: number; ownershipPct: number } } = {};
  let totalEarnings = 0;

  // Get distributions for each vault
  for (const nft of nfts) {
    const { data: distributions, error: distError } = await supabase
      .from('yield_distributions')
      .select('*')
      .eq('vault_id', nft.vault_id);

    if (distError) {
      console.error(`Error fetching distributions for vault ${nft.vault_id}:`, distError);
      continue;
    }

    // Calculate earnings from this vault
    let vaultTotal = 0;
    if (distributions) {
      for (const dist of distributions) {
        const holderDist = dist.distributions.find(
          (d: any) => d.holderAddress === holderAddress
        );
        if (holderDist) {
          vaultTotal += holderDist.share;
        }
      }
    }

    if (!vaultEarnings[nft.vault_id]) {
      vaultEarnings[nft.vault_id] = {
        earnings: vaultTotal,
        ownershipPct: (nft.ownership_percentage || 0),
      };
    }

    totalEarnings += vaultTotal;
  }

  return {
    totalEarnings,
    byVault: Object.entries(vaultEarnings).map(([vaultId, data]) => ({
      vaultId,
      ...data,
    })),
  };
}

/**
 * Validate that total ownership doesn't exceed 100% before minting new NFT
 */
export async function validateOwnershipLimit(
  vaultId: string,
  newOwnershipPct: number
): Promise<{ valid: boolean; currentTotal: number; message?: string }> {
  const { data: nfts, error } = await supabase
    .from('vault_nfts')
    .select('ownership_percentage')
    .eq('vault_id', vaultId);

  if (error) {
    throw new Error(`Failed to validate ownership: ${error.message}`);
  }

  const currentTotal = nfts?.reduce((sum, nft) => sum + (nft.ownership_percentage || 0), 0) || 0;
  // Accept newOwnershipPct as either percent (0-100) or basis points (>100)
  const newOwnershipPctPercent = newOwnershipPct > 100 ? newOwnershipPct / 100 : newOwnershipPct;
  const newTotal = currentTotal + newOwnershipPctPercent;

  if (newTotal > 100) {
    return {
      valid: false,
      currentTotal: currentTotal,
      message: `Would exceed 100% ownership. Current: ${currentTotal}%, Requested: ${newOwnershipPctPercent}%`,
    };
  }

  return {
    valid: true,
    currentTotal: currentTotal,
  };
}
