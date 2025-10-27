import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env'
  );
}

// Create a single supabase client for interacting with your database
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Database table types (will be expanded as we define schemas in Phase 2)
export interface User {
  wallet_address: string;
  created_at: string;
  profile?: Record<string, any>;
}

export interface Vault {
  vault_id: string;
  owner: string;
  contract_address: string;
  config: Record<string, any>;
  status: 'active' | 'inactive' | 'paused';
  created_at: string;
  updated_at: string;
}

export interface VaultPerformance {
  id: number;
  vault_id: string;
  timestamp: string;
  value: number;
  returns: number;
}

export interface BacktestResult {
  backtest_id: string;
  vault_id: string;
  timeframe: string;
  results: Record<string, any>;
  created_at: string;
}

export interface AISuggestion {
  suggestion_id: string;
  vault_id: string;
  suggestion_data: Record<string, any>;
  applied: boolean;
  created_at: string;
}

export interface VaultNFT {
  nft_id: string;
  vault_id: string;
  ownership_pct: number;
  holder: string;
  created_at: string;
}

export interface MarketplaceListing {
  listing_id: string;
  nft_id: string;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  created_at: string;
}

export default supabase;
