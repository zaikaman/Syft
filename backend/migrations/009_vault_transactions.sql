-- Migration: 009_vault_transactions
-- Description: Track individual deposit/withdrawal transactions with entry prices
-- This enables accurate earnings calculation for trading vaults

CREATE TABLE IF NOT EXISTS vault_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  user_address TEXT NOT NULL,
  
  -- Transaction details
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount_xlm NUMERIC(20, 7) NOT NULL CHECK (amount_xlm > 0),
  amount_usd NUMERIC(20, 7) NOT NULL CHECK (amount_usd > 0),
  shares NUMERIC(30, 0) NOT NULL CHECK (shares > 0),
  
  -- Price tracking at transaction time
  xlm_price NUMERIC(10, 7) NOT NULL CHECK (xlm_price > 0),
  share_price NUMERIC(20, 10) NOT NULL CHECK (share_price > 0),
  
  -- Blockchain reference
  transaction_hash TEXT,
  block_number BIGINT,
  
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_vault_transactions_vault_id ON vault_transactions(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_transactions_user_address ON vault_transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_vault_transactions_type ON vault_transactions(type);
CREATE INDEX IF NOT EXISTS idx_vault_transactions_timestamp ON vault_transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vault_transactions_tx_hash ON vault_transactions(transaction_hash);

-- Composite index for user's vault activity
CREATE INDEX IF NOT EXISTS idx_vault_transactions_user_vault ON vault_transactions(user_address, vault_id, timestamp DESC);

-- Comments
COMMENT ON TABLE vault_transactions IS 'Historical record of all vault deposits and withdrawals';
COMMENT ON COLUMN vault_transactions.amount_xlm IS 'Amount in XLM deposited/withdrawn';
COMMENT ON COLUMN vault_transactions.amount_usd IS 'USD value at time of transaction (amount_xlm * xlm_price)';
COMMENT ON COLUMN vault_transactions.shares IS 'Vault shares minted (deposit) or burned (withdrawal)';
COMMENT ON COLUMN vault_transactions.xlm_price IS 'XLM/USD price at transaction time';
COMMENT ON COLUMN vault_transactions.share_price IS 'Price per share at transaction time (for calculating cost basis)';
