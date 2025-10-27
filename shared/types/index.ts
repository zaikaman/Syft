// Shared types index - re-export all types
export * from './vault';
export * from './transaction';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Backtest types
export interface BacktestConfig {
  vaultConfig: any;
  startDate: string;
  endDate: string;
  initialCapital: number;
}

export interface BacktestResult {
  backtestId: string;
  vaultId?: string;
  config: BacktestConfig;
  metrics: {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    numTrades: number;
    winRate: number;
  };
  timeline: {
    timestamp: string;
    portfolioValue: number;
    allocations: { assetCode: string; value: number }[];
    action?: string;
  }[];
  comparison?: {
    buyAndHold: {
      totalReturn: number;
      finalValue: number;
    };
  };
  createdAt: string;
}

// AI Suggestion types
export interface AISuggestion {
  suggestionId: string;
  vaultId: string;
  title: string;
  description: string;
  expectedImpact?: string;
  riskLevel: 'low' | 'medium' | 'high';
  implementation: string;
  priority: number;
  applied: boolean;
  createdAt: string;
  appliedAt?: string;
}

// NFT types
export interface VaultNFTMetadata {
  name: string;
  description: string;
  imageUrl: string;
  vaultPerformance: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
  };
  ownershipPercentage: number;
}

export interface MarketplaceListing {
  listingId: string;
  nftId: string;
  vaultId: string;
  seller: string;
  price: number;
  currency: string;
  ownershipPercentage: number;
  status: 'active' | 'sold' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}
