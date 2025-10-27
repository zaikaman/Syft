-- T018: Vaults table for storing deployed vault configurations
-- Migration: 002_vaults
-- Description: Core vault registry with owner, contract address, and configuration

CREATE TYPE vault_status AS ENUM ('draft', 'deploying', 'active', 'paused', 'closed');

CREATE TABLE IF NOT EXISTS vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id TEXT UNIQUE NOT NULL,
  owner_wallet_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  contract_address TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status vault_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deployed_at TIMESTAMPTZ,
  total_value_locked NUMERIC(20, 7) DEFAULT 0,
  
  -- Constraints
  CONSTRAINT vault_id_format CHECK (length(vault_id) > 0),
  CONSTRAINT config_not_empty CHECK (jsonb_typeof(config) = 'object')
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vaults_owner ON vaults(owner_wallet_address);
CREATE INDEX IF NOT EXISTS idx_vaults_status ON vaults(status);
CREATE INDEX IF NOT EXISTS idx_vaults_contract_address ON vaults(contract_address);
CREATE INDEX IF NOT EXISTS idx_vaults_created_at ON vaults(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_vaults_updated_at
  BEFORE UPDATE ON vaults
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE vaults IS 'Registry of all yield vaults created on the platform';
COMMENT ON COLUMN vaults.vault_id IS 'Human-readable unique identifier for the vault';
COMMENT ON COLUMN vaults.contract_address IS 'Deployed Soroban contract address (null until deployed)';
COMMENT ON COLUMN vaults.config IS 'JSON configuration including rebalancing rules, asset allocations, etc.';
COMMENT ON COLUMN vaults.status IS 'Current lifecycle status of the vault';
COMMENT ON COLUMN vaults.total_value_locked IS 'Current TVL in USD equivalent';
