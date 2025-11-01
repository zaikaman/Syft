// T129-T131: Marketplace routes for NFT trading
// Purpose: Handle marketplace listings, browsing, and purchases

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { buildDeploymentTransaction } from '../services/vaultDeploymentService.js';

const router = Router();

/**
 * POST /api/marketplace/listings
 * Create a new marketplace listing for an NFT
 * 
 * Body: {
 *   nftId: string,
 *   profitSharePercentage?: number,  // 0-100%
 *   price?: number,                   // Optional for direct purchase
 *   currency?: string,
 *   sellerAddress: string
 * }
 */
router.post('/listings', async (req: Request, res: Response) => {
  try {
    const { nftId, profitSharePercentage, price, currency, sellerAddress } = req.body;

    // Validate required fields
    if (!nftId || !sellerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nftId, sellerAddress',
      });
    }

    // Validate that either price OR profitSharePercentage is provided
    if (!price && !profitSharePercentage) {
      return res.status(400).json({
        success: false,
        error: 'Either price or profitSharePercentage must be provided',
      });
    }

    // Validate profit share percentage if provided
    if (profitSharePercentage !== undefined) {
      if (profitSharePercentage <= 0 || profitSharePercentage > 100) {
        return res.status(400).json({
          success: false,
          error: 'Profit share percentage must be between 0 and 100',
        });
      }
    }

    // Validate price if provided
    if (price !== undefined && price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Price must be greater than 0',
      });
    }

    // Get NFT and verify ownership
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

    if (nft.current_holder !== sellerAddress) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to list this NFT',
      });
    }

    // Check if already listed
    const { data: existingListing } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('nft_id', nftId)
      .eq('status', 'active')
      .single();

    if (existingListing) {
      return res.status(400).json({
        success: false,
        error: 'NFT is already listed in marketplace',
      });
    }

    // Create listing - use NFT's UUID id for foreign key
    const listingId = `listing_${nftId}_${Date.now()}`;
    
    // Generate title from NFT metadata
    const title = nft.metadata?.name || `Vault Strategy NFT`;
    const description = nft.metadata?.description || 'Subscribe to this vault strategy with profit sharing';
    
    // Build insert data
    const insertData: any = {
      listing_id: listingId,
      nft_id: nft.id, // Use UUID foreign key
      seller_wallet_address: sellerAddress,
      status: 'active',
      title: title,
      description: description,
    };

    // Add profit share or price
    if (profitSharePercentage !== undefined) {
      insertData.profit_share_percentage = profitSharePercentage;
    }
    if (price !== undefined) {
      insertData.price = price;
      insertData.price_asset = currency || 'XLM';
    }
    
    const { data: listing, error: listingError } = await supabase
      .from('marketplace_listings')
      .insert(insertData)
      .select()
      .single();

    if (listingError) {
      console.error('Error creating listing:', listingError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create listing',
      });
    }

    return res.json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error('Error creating listing:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/marketplace/listings
 * Browse marketplace listings with filters
 * 
 * Query params:
 *   - status: 'active' | 'sold' | 'cancelled'
 *   - minPrice: number
 *   - maxPrice: number
 *   - sortBy: 'price' | 'created_at'
 *   - sortOrder: 'asc' | 'desc'
 */
router.get('/listings', async (req: Request, res: Response) => {
  try {
    const {
      status = 'active',
      minPrice,
      maxPrice,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    let query = supabase
      .from('marketplace_listings')
      .select(`
        *,
        vault_nfts!inner (
          nft_id,
          metadata,
          vaults!inner (
            vault_id,
            name,
            description,
            total_value_locked,
            config
          )
        )
      `)
      .eq('status', status);

    // Apply price filters
    if (minPrice) {
      query = query.gte('price', Number(minPrice));
    }
    if (maxPrice) {
      query = query.lte('price', Number(maxPrice));
    }

    // Apply sorting
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy as string, { ascending });

    const { data: listings, error } = await query;

    if (error) {
      console.error('Error fetching listings:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch listings',
      });
    }

    // Transform response to match frontend expectations
    const transformedListings = listings?.map((listing: any) => ({
      listing_id: listing.listing_id || listing.id,
      nft_id: listing.vault_nfts?.nft_id || listing.nft_id,
      vault_id: listing.vault_nfts?.vaults?.vault_id,
      seller: listing.seller_wallet_address || listing.seller_address,
      profit_share_percentage: listing.profit_share_percentage,
      price: listing.price,
      currency: listing.price_asset || listing.currency || 'XLM',
      status: listing.status,
      created_at: listing.created_at,
      vault_nfts: {
        nft_id: listing.vault_nfts?.nft_id,
        metadata: listing.vault_nfts?.metadata || {},
        vaults: {
          vault_id: listing.vault_nfts?.vaults?.vault_id,
          name: listing.vault_nfts?.vaults?.name || listing.vault_nfts?.vaults?.config?.name || 'Unknown Vault',
          description: listing.vault_nfts?.vaults?.description || listing.vault_nfts?.vaults?.config?.description || '',
          total_value: listing.vault_nfts?.vaults?.total_value_locked || 0,
          performance: 0, // TODO: Calculate from performance table
        },
      },
    })) || [];

    return res.json({
      success: true,
      data: transformedListings,
    });
  } catch (error) {
    console.error('Error browsing marketplace:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/marketplace/listings/:listingId
 * Get detailed information about a listing
 */
router.get('/listings/:listingId', async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;

    const { data: listing, error } = await supabase
      .from('marketplace_listings')
      .select(`
        *,
        vault_nfts (
          nft_id,
          current_holder,
          metadata,
          minted_at,
          vaults (
            vault_id,
            name,
            description,
            contract_address,
            total_value_locked,
            created_at
          )
        )
      `)
      .eq('listing_id', listingId)
      .single();

    if (error || !listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found',
      });
    }

    return res.json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/marketplace/purchase
 * Purchase an NFT from the marketplace
 * 
 * Body: {
 *   listingId: string,
 *   buyerAddress: string,
 *   transactionHash?: string
 * }
 */
router.post('/purchase', async (req: Request, res: Response) => {
  try {
    const { listingId, buyerAddress, transactionHash } = req.body;

    if (!listingId || !buyerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: listingId, buyerAddress',
      });
    }

    // Get listing
    const { data: listing, error: listingError } = await supabase
      .from('marketplace_listings')
      .select('*, vault_nfts(*)')
      .eq('listing_id', listingId)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found',
      });
    }

    if (listing.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Listing is not active',
      });
    }

    // Check buyer is not seller
    if (listing.seller_address === buyerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Cannot purchase your own listing',
      });
    }

    // Begin transaction: Update NFT holder and listing status
    const { error: nftUpdateError } = await supabase
      .from('vault_nfts')
      .update({
        current_holder: buyerAddress,
        last_transfer_at: new Date().toISOString(),
      })
      .eq('nft_id', listing.nft_id);

    if (nftUpdateError) {
      console.error('Error updating NFT:', nftUpdateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to transfer NFT ownership',
      });
    }

    const { data: updatedListing, error: listingUpdateError } = await supabase
      .from('marketplace_listings')
      .update({
        status: 'sold',
        buyer_address: buyerAddress,
        sold_at: new Date().toISOString(),
        transaction_hash: transactionHash,
      })
      .eq('listing_id', listingId)
      .select()
      .single();

    if (listingUpdateError) {
      console.error('Error updating listing:', listingUpdateError);
      // Try to rollback NFT transfer
      await supabase
        .from('vault_nfts')
        .update({
          current_holder: listing.seller_address,
        })
        .eq('nft_id', listing.nft_id);

      return res.status(500).json({
        success: false,
        error: 'Failed to complete purchase',
      });
    }

    return res.json({
      success: true,
      data: {
        listing: updatedListing,
        message: 'NFT purchased successfully',
      },
    });
  } catch (error) {
    console.error('Error purchasing NFT:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * DELETE /api/marketplace/listings/:listingId
 * Cancel a marketplace listing
 * 
 * Body: {
 *   sellerAddress: string
 * }
 */
router.delete('/listings/:listingId', async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const { sellerAddress } = req.body;

    if (!sellerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sellerAddress',
      });
    }

    // Get listing
    const { data: listing, error: listingError } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('listing_id', listingId)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found',
      });
    }

    // Verify ownership
    if (listing.seller_address !== sellerAddress) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to cancel this listing',
      });
    }

    if (listing.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Listing is not active',
      });
    }

    // Cancel listing
    const { data: updatedListing, error: updateError } = await supabase
      .from('marketplace_listings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('listing_id', listingId)
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling listing:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel listing',
      });
    }

    return res.json({
      success: true,
      data: updatedListing,
    });
  } catch (error) {
    console.error('Error cancelling listing:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/marketplace/subscribe
 * Subscribe to a vault strategy from marketplace
 * This creates a new vault instance for the subscriber using the original vault's strategy
 * 
 * Body: {
 *   listingId: string,
 *   subscriberAddress: string,
 *   network?: string
 * }
 */
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { listingId, subscriberAddress, network } = req.body;

    console.log('[Subscribe] Request:', { listingId, subscriberAddress, network });

    if (!listingId || !subscriberAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: listingId, subscriberAddress',
      });
    }

    // Get listing with vault details
    const { data: listing, error: listingError } = await supabase
      .from('marketplace_listings')
      .select(`
        *,
        vault_nfts!inner (
          vault_id,
          vaults!inner (
            id,
            vault_id,
            owner_wallet_address,
            config,
            network
          )
        )
      `)
      .eq('listing_id', listingId)
      .eq('status', 'active')
      .single();

    if (listingError) {
      console.error('[Subscribe] Error fetching listing:', listingError);
      return res.status(404).json({
        success: false,
        error: `Listing not found: ${listingError.message}`,
      });
    }

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found or not active',
      });
    }

    console.log('[Subscribe] Listing data:', JSON.stringify(listing, null, 2));

    const originalVault = listing.vault_nfts?.vaults;
    if (!originalVault) {
      console.error('[Subscribe] Original vault not found in listing data');
      return res.status(404).json({
        success: false,
        error: 'Original vault not found',
      });
    }

    console.log('[Subscribe] Original vault:', originalVault);

    // Check if user already subscribed to this vault
    const { data: existingSubscription } = await supabase
      .from('vault_subscriptions')
      .select('*')
      .eq('original_vault_id', originalVault.id)
      .eq('subscriber_wallet_address', subscriberAddress)
      .single();

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: 'You have already subscribed to this vault',
      });
    }

    // Clone the vault config and ensure it has the correct format
    const originalConfig = originalVault.config || {};
    const clonedConfig = {
      owner: subscriberAddress, // Subscriber becomes the owner of the new vault
      name: originalConfig.name || `Subscribed ${originalVault.name || 'Vault'}`,
      assets: originalConfig.assets || ['XLM'], // Default to XLM if no assets specified
      rules: originalConfig.rules || [],
      routerAddress: originalConfig.routerAddress,
      // Keep reference to original vault
      clonedFrom: originalVault.vault_id,
    };

    console.log('[Subscribe] Cloned config:', JSON.stringify(clonedConfig, null, 2));

    // Build deployment transaction for the subscriber
    const deploymentResult = await buildDeploymentTransaction(
      clonedConfig,
      subscriberAddress,
      network || originalVault.network || 'testnet'
    );

    // Return deployment XDR for user to sign
    return res.json({
      success: true,
      data: {
        deploymentXdr: deploymentResult.xdr,
        vaultId: deploymentResult.vaultId,
        profitSharePercentage: listing.profit_share_percentage,
        originalVaultId: originalVault.id,
        clonedConfig: clonedConfig,
        message: 'Sign this transaction to deploy your own instance of this vault strategy',
      },
    });
  } catch (error) {
    console.error('[Subscribe] Error in subscription:', error);
    console.error('[Subscribe] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      details: error instanceof Error ? error.stack : String(error),
    });
  }
});

/**
 * POST /api/marketplace/subscribe/complete
 * Complete subscription after deployment transaction is signed
 * 
 * Body: {
 *   listingId: string,
 *   subscriberAddress: string,
 *   subscribedVaultId: string,
 *   transactionHash: string
 * }
 */
router.post('/subscribe/complete', async (req: Request, res: Response) => {
  try {
    const { listingId, subscriberAddress, subscribedVaultId, transactionHash } = req.body;

    if (!listingId || !subscriberAddress || !subscribedVaultId || !transactionHash) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // Get listing
    const { data: listing } = await supabase
      .from('marketplace_listings')
      .select(`
        *,
        vault_nfts (
          vaults (
            id
          )
        )
      `)
      .eq('listing_id', listingId)
      .single();

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found',
      });
    }

    const originalVaultId = listing.vault_nfts?.vaults?.id;
    if (!originalVaultId) {
      return res.status(404).json({
        success: false,
        error: 'Original vault not found',
      });
    }

    // Get subscribed vault
    const { data: subscribedVault } = await supabase
      .from('vaults')
      .select('id')
      .eq('vault_id', subscribedVaultId)
      .single();

    if (!subscribedVault) {
      return res.status(404).json({
        success: false,
        error: 'Subscribed vault not found',
      });
    }

    // Create subscription record
    const { data: subscription, error: subError } = await supabase
      .from('vault_subscriptions')
      .insert({
        original_vault_id: originalVaultId,
        subscribed_vault_id: subscribedVault.id,
        subscriber_wallet_address: subscriberAddress,
        profit_share_percentage: listing.profit_share_percentage || 10,
      })
      .select()
      .single();

    if (subError) {
      console.error('Error creating subscription:', subError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create subscription record',
      });
    }

    return res.json({
      success: true,
      data: {
        subscription,
        subscribedVaultId,
        transactionHash,
        message: 'Successfully subscribed! Your vault instance has been deployed.',
      },
    });
  } catch (error) {
    console.error('Error completing subscription:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
