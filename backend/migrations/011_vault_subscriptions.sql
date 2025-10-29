-- Migration: 011_vault_subscriptions
-- Description: Track vault subscriptions for profit sharing

CREATE TABLE IF NOT EXISTS vault_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  original_vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  subscribed_vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  subscriber_wallet_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  
  -- Profit sharing
  profit_share_percentage NUMERIC(5, 2) NOT NULL,
  
  -- Tracking
  total_profits_shared NUMERIC(20, 7) DEFAULT 0,
  last_profit_share_at TIMESTAMPTZ,
  
  -- Timestamps
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT profit_share_valid CHECK (profit_share_percentage > 0 AND profit_share_percentage <= 100),
  CONSTRAINT different_vaults CHECK (original_vault_id != subscribed_vault_id),
  CONSTRAINT unique_subscription UNIQUE (subscriber_wallet_address, original_vault_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vault_subscriptions_original ON vault_subscriptions(original_vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_subscriptions_subscribed ON vault_subscriptions(subscribed_vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_subscriptions_subscriber ON vault_subscriptions(subscriber_wallet_address);

-- Comments
COMMENT ON TABLE vault_subscriptions IS 'Track vault strategy subscriptions for profit sharing';
COMMENT ON COLUMN vault_subscriptions.original_vault_id IS 'The original vault that was subscribed to';
COMMENT ON COLUMN vault_subscriptions.subscribed_vault_id IS 'The new vault instance created for the subscriber';
COMMENT ON COLUMN vault_subscriptions.profit_share_percentage IS 'Percentage of profits that go to original vault creator';
