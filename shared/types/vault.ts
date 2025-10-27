// Shared vault configuration types

export interface AssetAllocation {
  assetId: string;
  assetCode: string;
  assetIssuer?: string;
  percentage: number; // 0-100
}

export interface RebalanceCondition {
  type: 'time' | 'price' | 'apy' | 'allocation';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  assetId?: string;
}

export interface RebalanceAction {
  type: 'rebalance' | 'stake' | 'unstake' | 'provide_liquidity' | 'remove_liquidity';
  targetAllocations: AssetAllocation[];
  params?: Record<string, any>;
}

export interface RebalanceRule {
  id: string;
  name: string;
  description?: string;
  conditions: RebalanceCondition[];
  actions: RebalanceAction[];
  enabled: boolean;
  priority: number;
}

export interface VaultConfig {
  name: string;
  description?: string;
  owner: string;
  assets: AssetAllocation[];
  rules: RebalanceRule[];
  minDeposit?: number;
  maxDeposit?: number;
  managementFee?: number; // percentage
  performanceFee?: number; // percentage
  isPublic: boolean;
}

export interface VaultState {
  vaultId: string;
  contractAddress: string;
  totalValue: number;
  totalShares: number;
  sharePrice: number;
  lastRebalance: string; // ISO timestamp
  status: 'active' | 'paused' | 'closed';
  currentAllocations: AssetAllocation[];
}

export interface VaultMetrics {
  totalReturn: number; // percentage
  annualizedReturn: number; // percentage
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number; // percentage
  winRate: number; // percentage
  numRebalances: number;
}

export interface UserVaultPosition {
  vaultId: string;
  userAddress: string;
  shares: number;
  initialDeposit: number;
  currentValue: number;
  returnAmount: number;
  returnPercentage: number;
  depositedAt: string;
}

// Visual builder block types
export interface BlockNode {
  id: string;
  type: 'asset' | 'condition' | 'action';
  data: any;
  position: { x: number; y: number };
}

export interface BlockEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface VaultStrategy {
  nodes: BlockNode[];
  edges: BlockEdge[];
  config: VaultConfig;
}
