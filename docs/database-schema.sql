-- ============================================
-- SYFT DEFI PLATFORM - DATABASE SCHEMA
-- ============================================
-- Migration 001: Users table
-- Purpose: Store user profiles and wallet information

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  wallet_address VARCHAR(56) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  profile JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================
-- Migration 002: Vaults table
-- Purpose: Store vault configurations and metadata

CREATE TABLE IF NOT EXISTS vaults (
  id BIGSERIAL PRIMARY KEY,
  vault_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  owner VARCHAR(56) NOT NULL REFERENCES users(wallet_address),
  contract_address VARCHAR(56) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'inactive', -- inactive, active, paused, closed
  total_value NUMERIC(30, 7) DEFAULT 0,
  total_shares NUMERIC(30, 7) DEFAULT 0,
  share_price NUMERIC(30, 7) DEFAULT 1,
  last_rebalance TIMESTAMP,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vaults_owner ON vaults(owner);
CREATE INDEX idx_vaults_status ON vaults(status);
CREATE INDEX idx_vaults_contract_address ON vaults(contract_address);
CREATE INDEX idx_vaults_created_at ON vaults(created_at);
CREATE INDEX idx_vaults_is_public ON vaults(is_public);

-- ============================================
-- Migration 003: Vault Performance table
-- Purpose: Track vault performance metrics over time

CREATE TABLE IF NOT EXISTS vault_performance (
  id BIGSERIAL PRIMARY KEY,
  vault_id UUID NOT NULL REFERENCES vaults(vault_id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  total_value NUMERIC(30, 7) NOT NULL,
  returns NUMERIC(20, 7) NOT NULL DEFAULT 0,
  return_percentage NUMERIC(10, 7) NOT NULL DEFAULT 0,
  allocations JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vault_performance_vault_id ON vault_performance(vault_id);
CREATE INDEX idx_vault_performance_timestamp ON vault_performance(timestamp);
CREATE INDEX idx_vault_performance_vault_timestamp ON vault_performance(vault_id, timestamp);

-- ============================================
-- Migration 004: Backtest Results table
-- Purpose: Store backtest simulation results

CREATE TABLE IF NOT EXISTS backtest_results (
  id BIGSERIAL PRIMARY KEY,
  backtest_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  vault_id UUID REFERENCES vaults(vault_id) ON DELETE CASCADE,
  user_wallet VARCHAR(56) REFERENCES users(wallet_address),
  timeframe VARCHAR(50) NOT NULL, -- e.g., "3m", "1y", "2y"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  metrics JSONB NOT NULL, -- total_return, volatility, sharpe_ratio, max_drawdown, etc.
  timeline JSONB, -- array of daily/monthly snapshots
  comparison JSONB, -- buy-and-hold comparison
  status VARCHAR(50) DEFAULT 'completed', -- pending, running, completed, failed
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_backtest_results_vault_id ON backtest_results(vault_id);
CREATE INDEX idx_backtest_results_user ON backtest_results(user_wallet);
CREATE INDEX idx_backtest_results_created_at ON backtest_results(created_at);

-- ============================================
-- Migration 005: AI Suggestions table
-- Purpose: Store AI-generated strategy suggestions

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id BIGSERIAL PRIMARY KEY,
  suggestion_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(vault_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  suggestion_data JSONB NOT NULL,
  expected_impact VARCHAR(255),
  risk_level VARCHAR(50), -- low, medium, high
  priority INTEGER,
  applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_suggestions_vault_id ON ai_suggestions(vault_id);
CREATE INDEX idx_ai_suggestions_applied ON ai_suggestions(applied);
CREATE INDEX idx_ai_suggestions_created_at ON ai_suggestions(created_at);

-- ============================================
-- Migration 006: Vault NFTs table
-- Purpose: Track fractional ownership NFTs for vaults

CREATE TABLE IF NOT EXISTS vault_nfts (
  id BIGSERIAL PRIMARY KEY,
  nft_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(vault_id) ON DELETE CASCADE,
  owner VARCHAR(56) NOT NULL REFERENCES users(wallet_address),
  ownership_percentage NUMERIC(10, 7) NOT NULL,
  contract_address VARCHAR(56),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vault_nfts_vault_id ON vault_nfts(vault_id);
CREATE INDEX idx_vault_nfts_owner ON vault_nfts(owner);
CREATE INDEX idx_vault_nfts_contract_address ON vault_nfts(contract_address);

-- ============================================
-- Migration 007: Marketplace Listings table
-- Purpose: Track NFT marketplace listings

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id BIGSERIAL PRIMARY KEY,
  listing_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  nft_id UUID NOT NULL REFERENCES vault_nfts(nft_id) ON DELETE CASCADE,
  vault_id UUID NOT NULL REFERENCES vaults(vault_id) ON DELETE CASCADE,
  seller VARCHAR(56) NOT NULL REFERENCES users(wallet_address),
  price NUMERIC(30, 7) NOT NULL,
  currency VARCHAR(50) DEFAULT 'USDC',
  status VARCHAR(50) DEFAULT 'active', -- active, sold, cancelled
  buyer VARCHAR(56),
  sold_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_marketplace_listings_vault_id ON marketplace_listings(vault_id);
CREATE INDEX idx_marketplace_listings_seller ON marketplace_listings(seller);
CREATE INDEX idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX idx_marketplace_listings_nft_id ON marketplace_listings(nft_id);

-- ============================================
-- Migration 008: User Positions table
-- Purpose: Track individual user positions in vaults

CREATE TABLE IF NOT EXISTS user_vault_positions (
  id BIGSERIAL PRIMARY KEY,
  user_wallet VARCHAR(56) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  vault_id UUID NOT NULL REFERENCES vaults(vault_id) ON DELETE CASCADE,
  shares NUMERIC(30, 7) NOT NULL DEFAULT 0,
  initial_deposit NUMERIC(30, 7) NOT NULL,
  current_value NUMERIC(30, 7) DEFAULT 0,
  deposited_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_positions_user_wallet ON user_vault_positions(user_wallet);
CREATE INDEX idx_user_positions_vault_id ON user_vault_positions(vault_id);
CREATE INDEX idx_user_positions_user_vault ON user_vault_positions(user_wallet, vault_id);
CREATE UNIQUE INDEX idx_user_vault_position_unique ON user_vault_positions(user_wallet, vault_id);

-- ============================================
-- Migration 009: Transaction History table
-- Purpose: Track all vault-related transactions

CREATE TABLE IF NOT EXISTS vault_transactions (
  id BIGSERIAL PRIMARY KEY,
  transaction_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(vault_id) ON DELETE CASCADE,
  user_wallet VARCHAR(56) REFERENCES users(wallet_address),
  type VARCHAR(50) NOT NULL, -- deposit, withdraw, rebalance, deployment
  amount NUMERIC(30, 7),
  shares NUMERIC(30, 7),
  status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed
  hash VARCHAR(256),
  ledger BIGINT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vault_transactions_vault_id ON vault_transactions(vault_id);
CREATE INDEX idx_vault_transactions_user ON vault_transactions(user_wallet);
CREATE INDEX idx_vault_transactions_type ON vault_transactions(type);
CREATE INDEX idx_vault_transactions_status ON vault_transactions(status);
CREATE INDEX idx_vault_transactions_created_at ON vault_transactions(created_at);

-- ============================================
-- Enable Real-time
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE vaults;
ALTER PUBLICATION supabase_realtime ADD TABLE vault_performance;
ALTER PUBLICATION supabase_realtime ADD TABLE vault_transactions;
