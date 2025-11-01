-- Migration: 013_remove_ownership_percentage
-- Description: Remove ownership_percentage concept from vault_nfts
-- NFTs represent subscriptions with profit sharing, not vault ownership

-- Drop the ownership validation constraint
ALTER TABLE vault_nfts 
  DROP CONSTRAINT IF EXISTS ownership_valid;

-- Remove the ownership_percentage column
ALTER TABLE vault_nfts 
  DROP COLUMN IF EXISTS ownership_percentage;

-- Update comments to reflect correct usage
COMMENT ON TABLE vault_nfts IS 'NFT tokens representing vault strategy subscriptions with profit sharing';
COMMENT ON COLUMN vault_nfts.total_profits_earned IS 'Cumulative profit-share payments received by this NFT holder from subscriptions';
