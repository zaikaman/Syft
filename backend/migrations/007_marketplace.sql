-- T023: Marketplace listings for vault NFT trading
-- Migration: 007_marketplace
-- Description: Enable buying and selling of vault ownership NFTs

CREATE TYPE listing_status AS ENUM ('active', 'sold', 'cancelled', 'expired');

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id TEXT UNIQUE NOT NULL,
  nft_id UUID NOT NULL REFERENCES vault_nfts(id) ON DELETE CASCADE,
  seller_wallet_address TEXT NOT NULL,
  
  -- Pricing
  price NUMERIC(20, 7) NOT NULL,
  price_asset TEXT NOT NULL DEFAULT 'USDC',
  
  -- Listing details
  status listing_status NOT NULL DEFAULT 'active',
  title TEXT NOT NULL,
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Sale details
  buyer_wallet_address TEXT,
  sale_price NUMERIC(20, 7),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT listing_id_format CHECK (length(listing_id) > 0),
  CONSTRAINT price_positive CHECK (price > 0),
  CONSTRAINT seller_not_empty CHECK (length(seller_wallet_address) > 0),
  CONSTRAINT title_not_empty CHECK (length(title) > 0)
);

-- Indexes for marketplace queries
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_nft_id ON marketplace_listings(nft_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller ON marketplace_listings(seller_wallet_address);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created_at ON marketplace_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_price ON marketplace_listings(price ASC) WHERE status = 'active';

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE marketplace_listings IS 'Active and historical listings for vault NFT sales';
COMMENT ON COLUMN marketplace_listings.price IS 'Listing price in the specified asset';
COMMENT ON COLUMN marketplace_listings.price_asset IS 'Asset code for the listing price (USDC, XLM, etc.)';
COMMENT ON COLUMN marketplace_listings.expires_at IS 'Optional expiration time for the listing';
COMMENT ON COLUMN marketplace_listings.metadata IS 'Additional listing data (featured status, tags, etc.)';
