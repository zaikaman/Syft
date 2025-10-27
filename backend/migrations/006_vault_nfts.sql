-- T022: Vault NFTs for fractional ownership and profit sharing
-- Migration: 006_vault_nfts
-- Description: Track NFT-based vault ownership shares

CREATE TABLE IF NOT EXISTS vault_nfts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nft_id TEXT UNIQUE NOT NULL,
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  token_id TEXT UNIQUE NOT NULL,
  contract_address TEXT NOT NULL,
  
  -- Ownership details
  ownership_percentage NUMERIC(5, 2) NOT NULL,
  original_owner TEXT NOT NULL,
  current_holder TEXT NOT NULL,
  
  -- NFT metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_transfer_at TIMESTAMPTZ,
  
  -- Profit tracking
  total_profits_earned NUMERIC(20, 7) DEFAULT 0,
  last_profit_distribution TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT nft_id_format CHECK (length(nft_id) > 0),
  CONSTRAINT token_id_format CHECK (length(token_id) > 0),
  CONSTRAINT ownership_valid CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
  CONSTRAINT addresses_not_empty CHECK (
    length(original_owner) > 0 AND 
    length(current_holder) > 0 AND 
    length(contract_address) > 0
  )
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vault_nfts_vault_id ON vault_nfts(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_nfts_current_holder ON vault_nfts(current_holder);
CREATE INDEX IF NOT EXISTS idx_vault_nfts_original_owner ON vault_nfts(original_owner);
CREATE INDEX IF NOT EXISTS idx_vault_nfts_contract_address ON vault_nfts(contract_address);

-- Comments for documentation
COMMENT ON TABLE vault_nfts IS 'NFT shares representing fractional vault ownership';
COMMENT ON COLUMN vault_nfts.ownership_percentage IS 'Percentage of vault profits this NFT entitles holder to (0-100)';
COMMENT ON COLUMN vault_nfts.original_owner IS 'Wallet address of vault creator who minted the NFT';
COMMENT ON COLUMN vault_nfts.current_holder IS 'Current NFT owner wallet address';
COMMENT ON COLUMN vault_nfts.total_profits_earned IS 'Cumulative profits distributed to this NFT holder';
