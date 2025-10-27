-- T021: AI suggestions for vault strategy optimization
-- Migration: 005_ai_suggestions
-- Description: Store AI-generated strategy improvement recommendations

CREATE TYPE suggestion_status AS ENUM ('pending', 'reviewed', 'applied', 'dismissed');
CREATE TYPE suggestion_type AS ENUM ('allocation', 'rebalance_rule', 'risk_management', 'market_timing', 'diversification');

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id TEXT UNIQUE NOT NULL,
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status suggestion_status NOT NULL DEFAULT 'pending',
  suggestion_type suggestion_type NOT NULL,
  
  -- Suggestion content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reasoning TEXT,
  confidence_score NUMERIC(3, 2),
  
  -- Impact projections
  projected_apy_improvement NUMERIC(10, 4),
  projected_risk_change NUMERIC(10, 4),
  expected_return NUMERIC(10, 4),
  
  -- Suggestion data
  suggestion_data JSONB NOT NULL,
  sentiment_data JSONB,
  market_data JSONB,
  
  -- User interaction
  applied_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  user_feedback TEXT,
  
  -- Constraints
  CONSTRAINT suggestion_id_format CHECK (length(suggestion_id) > 0),
  CONSTRAINT confidence_valid CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT suggestion_data_not_empty CHECK (jsonb_typeof(suggestion_data) = 'object')
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_vault_id ON ai_suggestions(vault_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_created_at ON ai_suggestions(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE ai_suggestions IS 'AI-generated optimization recommendations for vaults';
COMMENT ON COLUMN ai_suggestions.confidence_score IS 'AI confidence in recommendation (0.0 to 1.0)';
COMMENT ON COLUMN ai_suggestions.suggestion_data IS 'Specific configuration changes to apply';
COMMENT ON COLUMN ai_suggestions.sentiment_data IS 'Market sentiment analysis supporting the suggestion';
COMMENT ON COLUMN ai_suggestions.market_data IS 'Historical data and trends supporting the suggestion';
