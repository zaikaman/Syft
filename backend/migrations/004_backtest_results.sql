-- T020: Backtest results storage for historical strategy validation
-- Migration: 004_backtest_results
-- Description: Store simulation results for vault strategies against historical data

CREATE TYPE backtest_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS backtest_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backtest_id TEXT UNIQUE NOT NULL,
  vault_id UUID REFERENCES vaults(id) ON DELETE SET NULL,
  vault_config JSONB NOT NULL,
  timeframe_start TIMESTAMPTZ NOT NULL,
  timeframe_end TIMESTAMPTZ NOT NULL,
  status backtest_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Performance results
  total_return NUMERIC(10, 4),
  annualized_return NUMERIC(10, 4),
  volatility NUMERIC(10, 4),
  sharpe_ratio NUMERIC(10, 4),
  max_drawdown NUMERIC(10, 4),
  win_rate NUMERIC(5, 2),
  
  -- Comparison metrics
  benchmark_return NUMERIC(10, 4),
  alpha NUMERIC(10, 4),
  beta NUMERIC(10, 4),
  
  -- Detailed data
  results JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  
  -- Constraints
  CONSTRAINT backtest_id_format CHECK (length(backtest_id) > 0),
  CONSTRAINT timeframe_valid CHECK (timeframe_end > timeframe_start),
  CONSTRAINT vault_config_not_empty CHECK (jsonb_typeof(vault_config) = 'object')
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_backtest_results_vault_id ON backtest_results(vault_id);
CREATE INDEX IF NOT EXISTS idx_backtest_results_status ON backtest_results(status);
CREATE INDEX IF NOT EXISTS idx_backtest_results_created_at ON backtest_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backtest_results_timeframe ON backtest_results(timeframe_start, timeframe_end);

-- Comments for documentation
COMMENT ON TABLE backtest_results IS 'Historical backtesting results for vault strategies';
COMMENT ON COLUMN backtest_results.vault_config IS 'Snapshot of vault configuration used for backtest';
COMMENT ON COLUMN backtest_results.sharpe_ratio IS 'Risk-adjusted return metric';
COMMENT ON COLUMN backtest_results.max_drawdown IS 'Largest peak-to-trough decline during backtest period';
COMMENT ON COLUMN backtest_results.results IS 'Detailed time-series data, trade log, and event timeline';
COMMENT ON COLUMN backtest_results.benchmark_return IS 'Buy-and-hold strategy return for comparison';
