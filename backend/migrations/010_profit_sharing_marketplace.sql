-- Migration: 010_profit_sharing_marketplace
-- Description: Update marketplace to support profit-sharing model instead of direct sales

-- Add profit_share_percentage column
ALTER TABLE marketplace_listings 
  ADD COLUMN IF NOT EXISTS profit_share_percentage NUMERIC(5, 2) DEFAULT 0;

-- Make price optional (for profit-sharing listings)
ALTER TABLE marketplace_listings 
  ALTER COLUMN price DROP NOT NULL;

-- Remove price_positive constraint and add new constraint for profit sharing
ALTER TABLE marketplace_listings 
  DROP CONSTRAINT IF EXISTS price_positive;

-- Add constraint: either price OR profit_share_percentage must be set
ALTER TABLE marketplace_listings 
  ADD CONSTRAINT price_or_profit_share CHECK (
    (price IS NOT NULL AND price > 0) OR 
    (profit_share_percentage IS NOT NULL AND profit_share_percentage > 0 AND profit_share_percentage <= 100)
  );

-- Update listing_status enum to include 'subscribed'
ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'subscribed';

-- Add index for profit share queries
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_profit_share 
  ON marketplace_listings(profit_share_percentage) 
  WHERE status = 'active' AND profit_share_percentage IS NOT NULL;

-- Comments
COMMENT ON COLUMN marketplace_listings.profit_share_percentage IS 'Percentage of profits that go to vault creator (0-100%)';
