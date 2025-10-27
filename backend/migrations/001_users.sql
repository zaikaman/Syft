-- T017: Users table for storing wallet-connected user profiles
-- Migration: 001_users
-- Description: Core user authentication and profile management

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  network TEXT DEFAULT 'futurenet',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  profile JSONB DEFAULT '{}'::jsonb,
  
  -- Indexes for common queries
  CONSTRAINT wallet_address_format CHECK (length(wallet_address) > 0)
);

-- Index for wallet address lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores user profiles linked to Stellar wallet addresses';
COMMENT ON COLUMN users.wallet_address IS 'Unique Stellar public key (G...)';
COMMENT ON COLUMN users.network IS 'Stellar network the user is connected to (testnet, futurenet, mainnet)';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of the most recent wallet connection';
COMMENT ON COLUMN users.profile IS 'Flexible JSON field for user preferences, display name, etc.';
