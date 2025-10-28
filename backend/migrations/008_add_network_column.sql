-- Add network column to vaults table
-- This allows filtering vaults by network (testnet, futurenet, mainnet)

ALTER TABLE vaults 
ADD COLUMN network TEXT NOT NULL DEFAULT 'testnet';

-- Add index for network filtering
CREATE INDEX IF NOT EXISTS idx_vaults_network ON vaults(network);

-- Add composite index for owner + network queries
CREATE INDEX IF NOT EXISTS idx_vaults_owner_network ON vaults(owner_wallet_address, network);

COMMENT ON COLUMN vaults.network IS 'Stellar network where the vault is deployed (testnet, futurenet, mainnet)';
