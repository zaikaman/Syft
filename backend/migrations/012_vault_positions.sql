-- Migration: Add staking and liquidity positions tracking
-- Description: Track staking positions (e.g., stXLM) and liquidity pool positions

-- Staking positions table
CREATE TABLE IF NOT EXISTS vault_staking_positions (
  id SERIAL PRIMARY KEY,
  vault_id VARCHAR(255) NOT NULL,
  contract_address VARCHAR(56) NOT NULL,
  staking_pool VARCHAR(56) NOT NULL,
  original_token VARCHAR(56) NOT NULL,
  staked_amount BIGINT NOT NULL,
  st_token_amount BIGINT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_vault_staking
    FOREIGN KEY(vault_id) 
    REFERENCES vaults(vault_id)
    ON DELETE CASCADE
);

-- Liquidity positions table
CREATE TABLE IF NOT EXISTS vault_liquidity_positions (
  id SERIAL PRIMARY KEY,
  vault_id VARCHAR(255) NOT NULL,
  contract_address VARCHAR(56) NOT NULL,
  pool_address VARCHAR(56) NOT NULL,
  token_a VARCHAR(56) NOT NULL,
  token_b VARCHAR(56) NOT NULL,
  lp_tokens BIGINT NOT NULL,
  amount_a_provided BIGINT NOT NULL,
  amount_b_provided BIGINT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_vault_liquidity
    FOREIGN KEY(vault_id) 
    REFERENCES vaults(vault_id)
    ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staking_vault_id ON vault_staking_positions(vault_id);
CREATE INDEX IF NOT EXISTS idx_staking_contract ON vault_staking_positions(contract_address);
CREATE INDEX IF NOT EXISTS idx_liquidity_vault_id ON vault_liquidity_positions(vault_id);
CREATE INDEX IF NOT EXISTS idx_liquidity_contract ON vault_liquidity_positions(contract_address);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vault_staking_positions_updated_at
BEFORE UPDATE ON vault_staking_positions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vault_liquidity_positions_updated_at
BEFORE UPDATE ON vault_liquidity_positions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
