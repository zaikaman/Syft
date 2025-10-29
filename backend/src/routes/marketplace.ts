// T129-T131: Marketplace routes for NFT trading
// Purpose: Handle marketplace listings, browsing, and purchases

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

/**
 * POST /api/marketplace/listings
 * Create a new marketplace listing for an NFT
 * 
 * Body: {
 *   nftId: string,
 *   price: number,
 *   currency: string,
 *   sellerAddress: string
 * }
 */
router.post('/listings', async (req: Request, res: Response) => {
  try {
    const { nftId, price, currency, sellerAddress } = req.body;

    // Validate required fields
    if (!nftId || !price || !currency || !sellerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nftId, price, currency, sellerAddress',
      });
    }

    // Validate price
    if (price <= 0) {
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

    if (nft.holder_address !== sellerAddress) {
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

    // Create listing
    const listingId = `listing_${nftId}_${Date.now()}`;
    const { data: listing, error: listingError } = await supabase
      .from('marketplace_listings')
      .insert({
        listing_id: listingId,
        nft_id: nftId,
        seller_wallet_address: sellerAddress,
        price: price,
        price_asset: currency,
        status: 'active',
      })
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
 *   - sortBy: 'price' | 'created_at' | 'ownership_pct'
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
      .select('*')
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
      nft_id: listing.nft_id,
      vault_id: listing.vault_id,
      seller: listing.seller_wallet_address || listing.seller_address,
      price: listing.price,
      currency: listing.price_asset || listing.currency || 'XLM',
      status: listing.status,
      created_at: listing.created_at,
      vault_nfts: {
        nft_id: listing.nft_id,
        ownership_percentage: 0, // Will be fetched separately if needed
        metadata: listing.metadata || {},
        vaults: {
          vault_id: listing.vault_id,
          name: 'Unknown Vault',
          description: '',
          total_value: 0,
          performance: 0,
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
          ownership_pct,
          holder_address,
          metadata,
          minted_at,
          vaults (
            vault_id,
            name,
            description,
            contract_address,
            total_value,
            performance,
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
        holder_address: buyerAddress,
        updated_at: new Date().toISOString(),
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
          holder_address: listing.seller_address,
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

export default router;
