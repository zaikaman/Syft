// T128: API endpoint POST /api/vaults/:vaultId/nft
// Purpose: Handle vault NFT minting operations

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { generateVaultNFTImage, generateVaultPrompt } from '../services/runwareService.js';

const router = Router();

/**
 * POST /api/nfts/mint
 * Mint a new vault NFT (convenience endpoint)
 * 
 * Body: {
 *   vaultId: string,
 *   ownerAddress: string,
 *   metadata: {
 *     name: string,
 *     description: string,
 *     imageUrl?: string
 *   }
 * }
 */
router.post('/mint', async (req: Request, res: Response) => {
  try {
    const { vaultId, ownerAddress, metadata } = req.body;

    // Validate required fields
    if (!vaultId || !ownerAddress || !metadata) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: vaultId, ownerAddress, metadata',
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

    // Generate NFT ID and token ID
    const timestamp = Date.now();
    const nftId = `nft_${vaultId}_${timestamp}`;
    const tokenId = `token_${vaultId}_${timestamp}`;
    
    // Use vault contract address or generate placeholder
    const contractAddress = vault.contract_address || `pending_${vaultId}`;

    // Generate AI image if not provided
    let finalImageUrl = metadata.imageUrl;
    if (!finalImageUrl || finalImageUrl.trim() === '') {
      console.log(`[Mint NFT] Generating AI image for ${nftId}`);
      const prompt = generateVaultPrompt(
        vault.name || 'Vault',
        vault.description,
        0 // No ownership percentage concept
      );
      finalImageUrl = await generateVaultNFTImage(prompt);
      console.log(`[Mint NFT] Generated image URL: ${finalImageUrl}`);
    }

    // Update metadata with final image URL
    const finalMetadata = {
      ...metadata,
      imageUrl: finalImageUrl,
    };

    // Store NFT in database
    const { data: nft, error: nftError } = await supabase
      .from('vault_nfts')
      .insert({
        nft_id: nftId,
        vault_id: vault.id,
        token_id: tokenId,
        contract_address: contractAddress,
        original_owner: ownerAddress,
        current_holder: ownerAddress,
        metadata: finalMetadata,
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
 * POST /api/vaults/:vaultId/nft
 * Mint a new vault NFT
 * 
 * Body: {
 *   metadata: {
 *     name: string,
 *     description: string,
 *     imageUrl?: string,
 *     vaultPerformance?: number
 *   },
 *   walletAddress: string
 * }
 */
router.post('/:vaultId/nft', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;
    const { metadata, walletAddress } = req.body;

    // Validate required fields
    if (!metadata || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: metadata, walletAddress',
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

    // Generate NFT ID and token ID
    const timestamp = Date.now();
    const nftId = `nft_${vaultId}_${timestamp}`;
    const tokenId = `token_${vaultId}_${timestamp}`;

    // Generate AI image if not provided
    let finalImageUrl = metadata.imageUrl;
    if (!finalImageUrl || finalImageUrl.trim() === '') {
      console.log(`[Mint NFT] Generating AI image for ${nftId}`);
      
      // Use custom prompt if provided, otherwise generate vault-themed prompt
      let prompt: string;
      if (metadata.customPrompt && metadata.customPrompt.trim() !== '') {
        // Enhance user's custom prompt with vault context
        prompt = `${generateVaultPrompt(
          vault.name || 'Vault',
          vault.description,
          0 // No ownership percentage concept
        )}, ${metadata.customPrompt}`;
        console.log(`[Mint NFT] Using custom prompt enhancement: "${metadata.customPrompt}"`);
      } else {
        // Use automatic vault-themed prompt
        prompt = generateVaultPrompt(
          vault.name || 'Vault',
          vault.description,
          0 // No ownership percentage concept
        );
      }
      
      finalImageUrl = await generateVaultNFTImage(prompt);
      console.log(`[Mint NFT] Generated image URL: ${finalImageUrl}`);
    }

    // Update metadata with final image URL
    const finalMetadata = {
      ...metadata,
      imageUrl: finalImageUrl,
    };

    // Store NFT in database (use vault.id which is the UUID)
    const { data: nft, error: nftError } = await supabase
      .from('vault_nfts')
      .insert({
        nft_id: nftId,
        token_id: tokenId,
        vault_id: vault.id, // Use UUID instead of vault_id string
        contract_address: vault.contract_address || `pending_${vaultId}`,
        current_holder: walletAddress,
        original_owner: walletAddress,
        metadata: finalMetadata,
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

    // Normalize vault fields for frontend compatibility
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
