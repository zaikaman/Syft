-- T019: Vault performance tracking for time-series analytics
-- Migration: 003_vault_performance
-- Description: Historical performance data for vault returns and value tracking

CREATE TABLE IF NOT EXISTS vault_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_value NUMERIC(20, 7) NOT NULL,
  share_price NUMERIC(20, 7) NOT NULL,
  returns_24h NUMERIC(10, 4),
  returns_7d NUMERIC(10, 4),
  returns_30d NUMERIC(10, 4),
  returns_all_time NUMERIC(10, 4),
  apy_current NUMERIC(10, 4),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT total_value_positive CHECK (total_value >= 0),
  CONSTRAINT share_price_positive CHECK (share_price > 0)
);

-- Indexes for time-series queries
CREATE INDEX IF NOT EXISTS idx_vault_performance_vault_id ON vault_performance(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_performance_timestamp ON vault_performance(vault_id, timestamp DESC);

-- Unique constraint to prevent duplicate snapshots
CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_performance_unique 
  ON vault_performance(vault_id, timestamp);

-- Comments for documentation
COMMENT ON TABLE vault_performance IS 'Time-series performance snapshots for vaults';
COMMENT ON COLUMN vault_performance.share_price IS 'Current price per vault share token';
COMMENT ON COLUMN vault_performance.returns_24h IS 'Percentage return over last 24 hours';
COMMENT ON COLUMN vault_performance.apy_current IS 'Current annualized percentage yield';
COMMENT ON COLUMN vault_performance.metadata IS 'Additional metrics (volatility, Sharpe ratio, etc.)';
