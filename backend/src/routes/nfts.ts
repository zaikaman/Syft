// T128: API endpoint POST /api/vaults/:vaultId/nft
// Purpose: Handle vault NFT minting operations

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

/**
 * POST /api/vaults/:vaultId/nft
 * Mint a new vault NFT
 * 
 * Body: {
 *   ownershipPercentage: number,  // In basis points (100 = 1%, 10000 = 100%)
 *   metadata: {
 *     name: string,
 *     description: string,
 *     imageUrl: string,
 *     vaultPerformance: number
 *   }
 * }
 */
router.post('/:vaultId/nft', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { ownershipPercentage, metadata, walletAddress } = req.body;

    // Validate required fields
    if (!ownershipPercentage || !metadata || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ownershipPercentage, metadata, walletAddress',
      });
    }

    // Validate ownership percentage (1-10000 basis points)
    if (ownershipPercentage <= 0 || ownershipPercentage > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Ownership percentage must be between 1 and 10000 basis points',
      });
    }

    // Get vault details
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();

    if (vaultError || !vault) {
      return res.status(404).json({
        success: false,
        error: 'Vault not found',
      });
    }

    // Check total ownership doesn't exceed 100%.
    // Note: incoming ownershipPercentage is expected in basis points (100 = 1%).
    const { data: existingNFTs } = await supabase
      .from('vault_nfts')
      .select('ownership_percentage')
      .eq('vault_id', vaultId);

    const totalExistingOwnership = existingNFTs?.reduce(
      (sum, nft) => sum + (nft.ownership_percentage || 0),
      0
    ) || 0;

    // convert incoming basis points to percent
    const ownershipPctPercent = ownershipPercentage / 100;

    if (totalExistingOwnership + ownershipPctPercent > 100) {
      return res.status(400).json({
        success: false,
        error: `Cannot mint NFT: would exceed 100% ownership. Current: ${totalExistingOwnership}%, Requested: ${ownershipPctPercent}%`,
      });
    }

    // Generate NFT ID
    const nftId = `nft_${vaultId}_${Date.now()}`;

    // Store NFT in database
    const { data: nft, error: nftError } = await supabase
      .from('vault_nfts')
      .insert({
        nft_id: nftId,
        vault_id: vaultId,
        // store as percentage (0-100) in DB
        ownership_percentage: ownershipPctPercent,
        // schema uses `current_holder` for the holder address
        current_holder: walletAddress,
        metadata: metadata,
        minted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (nftError) {
      console.error('Error storing NFT:', nftError);
      return res.status(500).json({
        success: false,
        error: 'Failed to mint NFT',
      });
    }

    return res.json({
      success: true,
      data: {
        nftId: nft.nft_id,
        vaultId: vault.vault_id,
        // return ownership in basis points for compatibility
        ownershipPercentage: (nft.ownership_percentage ?? ownershipPctPercent) * 100,
        holder: nft.current_holder,
        metadata: nft.metadata,
        mintedAt: nft.minted_at,
      },
    });
  } catch (error) {
    console.error('Error minting NFT:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/vaults/:vaultId/nfts
 * Get all NFTs for a vault
 */
router.get('/:vaultId/nfts', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;

    const { data: nfts, error } = await supabase
      .from('vault_nfts')
      .select('*')
      .eq('vault_id', vaultId)
      .order('minted_at', { ascending: false });

    if (error) {
      console.error('Error fetching NFTs:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch NFTs',
      });
    }

    return res.json({
      success: true,
      data: nfts,
    });
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/nfts/:nftId
 * Get NFT details
 */
router.get('/:nftId', async (req: Request, res: Response) => {
  try {
    const { nftId } = req.params;

    const { data: nft, error } = await supabase
      .from('vault_nfts')
      .select(`
        *,
        vaults (
          vault_id,
          name,
          description,
          contract_address,
          status,
          total_value_locked,
          created_at
        )
      `)
      .eq('nft_id', nftId)
      .single();

    if (error || !nft) {
      return res.status(404).json({
        success: false,
        error: 'NFT not found',
      });
    }

    // Normalize vault fields for frontend
    if (nft && nft.vaults) {
      if (nft.vaults.total_value === undefined && nft.vaults.total_value_locked !== undefined) {
        nft.vaults.total_value = nft.vaults.total_value_locked;
      }
      if (nft.vaults.performance === undefined) {
        nft.vaults.performance = 0;
      }
    }

    return res.json({
      success: true,
      data: nft,
    });
  } catch (error) {
    console.error('Error fetching NFT:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/nfts/:nftId/transfer
 * Transfer NFT to another address
 */
router.post('/:nftId/transfer', async (req: Request, res: Response) => {
  try {
    const { nftId } = req.params;
    const { fromAddress, toAddress } = req.body;

    if (!fromAddress || !toAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromAddress, toAddress',
      });
    }

    // Get NFT
    const { data: nft, error: nftError } = await supabase
      .from('vault_nfts')
      .select('*')
      .eq('nft_id', nftId)
      .single();

    if (nftError || !nft) {
      return res.status(404).json({
        success: false,
        error: 'NFT not found',
      });
    }

    // Verify ownership (schema uses `current_holder`)
    if (nft.current_holder !== fromAddress) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to transfer this NFT',
      });
    }

    // Update holder
    const { data: updatedNFT, error: updateError } = await supabase
      .from('vault_nfts')
      .update({
        current_holder: toAddress,
        last_transfer_at: new Date().toISOString(),
      })
      .eq('nft_id', nftId)
      .select()
      .single();

    if (updateError) {
      console.error('Error transferring NFT:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to transfer NFT',
      });
    }

    return res.json({
      success: true,
      data: updatedNFT,
    });
  } catch (error) {
    console.error('Error transferring NFT:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/nfts/owner/:address
 * Get all NFTs held by a wallet address
 */
router.get('/owner/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const { data: nfts, error } = await supabase
      .from('vault_nfts')
      .select(`*, vaults (vault_id, name, description, contract_address, status, total_value_locked, created_at)`)
      .eq('current_holder', address)
      .order('minted_at', { ascending: false });

    if (error) {
      console.error('Error fetching holder NFTs:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch holder NFTs',
      });
    }

    // Normalize vaulted and nft fields for frontend compatibility
    const normalized = (nfts || []).map((nft: any) => {
      const vault = nft.vaults || null;
      if (vault) {
        // Provide legacy keys if missing
        if (vault.total_value === undefined && vault.total_value_locked !== undefined) {
          vault.total_value = vault.total_value_locked;
        }
        if (vault.performance === undefined) {
          // performance may be calculated elsewhere; default to 0 to avoid UI issues
          vault.performance = 0;
        }
      }

      // Map schema fields to legacy frontend expectations
      if (nft.current_holder && !nft.holder_address) {
        nft.holder_address = nft.current_holder;
      }
      if (nft.ownership_percentage !== undefined) {
        // frontend sometimes expects basis points or `ownership_pct`; provide both
        nft.ownership_pct = Math.round(nft.ownership_percentage * 100);
      }

      return nft;
    });

    return res.json({
      success: true,
      data: normalized,
    });
  } catch (error) {
    console.error('Error fetching holder NFTs:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
