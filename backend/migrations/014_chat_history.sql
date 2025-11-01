-- Migration: 014_chat_history
-- Description: Store AI chat conversation history for vault builder

CREATE TYPE chat_message_role AS ENUM ('user', 'assistant', 'system');
CREATE TYPE chat_session_status AS ENUM ('active', 'completed', 'abandoned');

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vault_id UUID REFERENCES vaults(id) ON DELETE SET NULL,
  
  -- Session metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status chat_session_status NOT NULL DEFAULT 'active',
  
  -- Session context
  network TEXT, -- 'testnet' or 'mainnet'
  initial_prompt TEXT,
  
  -- Session summary
  total_messages INTEGER NOT NULL DEFAULT 0,
  vault_generated BOOLEAN NOT NULL DEFAULT FALSE,
  vault_deployed BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Constraints
  CONSTRAINT session_id_format CHECK (length(session_id) > 0)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  
  -- Message content
  role chat_message_role NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Message metadata
  tokens_used INTEGER,
  model TEXT,
  
  -- Response metadata (for assistant messages)
  response_type TEXT, -- 'chat' or 'build'
  vault_snapshot JSONB, -- Vault state at this point (nodes/edges)
  market_context TEXT, -- Market data used for response
  web_search_used BOOLEAN DEFAULT FALSE,
  
  -- Ordering
  sequence_number INTEGER NOT NULL,
  
  -- Constraints
  CONSTRAINT message_id_format CHECK (length(message_id) > 0),
  CONSTRAINT content_not_empty CHECK (length(content) > 0),
  CONSTRAINT sequence_positive CHECK (sequence_number >= 0)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_vault_id ON chat_sessions(vault_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sequence ON chat_messages(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions 
  SET updated_at = NOW(),
      total_messages = total_messages + 1
  WHERE id = NEW.session_id;
  RETURN NEW;   
END;
$$ LANGUAGE plpgsql;

-- Trigger to update chat_sessions when new message is added
CREATE TRIGGER chat_message_inserted
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_session_timestamp();

-- Comments for documentation
COMMENT ON TABLE chat_sessions IS 'AI chat conversation sessions in vault builder';
COMMENT ON TABLE chat_messages IS 'Individual messages within chat sessions';
COMMENT ON COLUMN chat_sessions.vault_generated IS 'Whether a vault was successfully generated in this session';
COMMENT ON COLUMN chat_sessions.vault_deployed IS 'Whether the vault was deployed to blockchain';
COMMENT ON COLUMN chat_messages.vault_snapshot IS 'Vault configuration (nodes/edges) at time of message';
COMMENT ON COLUMN chat_messages.market_context IS 'Market data/research used to generate response';
COMMENT ON COLUMN chat_messages.sequence_number IS 'Message order within session (0-indexed)';
