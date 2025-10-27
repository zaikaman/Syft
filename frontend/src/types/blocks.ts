// Block types for the visual vault builder

export type BlockType = 'asset' | 'condition' | 'action';

export type AssetType = 'XLM' | 'USDC' | 'CUSTOM';

export type ConditionType = 'allocation' | 'apy_threshold' | 'time_based' | 'price_change';

export type ActionType = 'rebalance' | 'stake' | 'provide_liquidity' | 'swap';

// Base block interface
export interface BaseBlock {
  id: string;
  type: BlockType;
  label: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

// Asset Block - represents tokens in the vault
export interface AssetBlock extends BaseBlock {
  type: 'asset';
  data: {
    assetType: AssetType;
    assetCode?: string; // For custom tokens
    assetIssuer?: string; // For custom tokens
    allocation: number; // Percentage 0-100
    icon?: string;
  };
}

// Condition Block - represents rules that trigger actions
export interface ConditionBlock extends BaseBlock {
  type: 'condition';
  data: {
    conditionType: ConditionType;
    operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'; // greater than, less than, etc.
    value?: number;
    threshold?: number;
    timeUnit?: 'minutes' | 'hours' | 'days' | 'weeks';
    timeValue?: number;
    description?: string;
  };
}

// Action Block - represents what happens when conditions are met
export interface ActionBlock extends BaseBlock {
  type: 'action';
  data: {
    actionType: ActionType;
    targetAsset?: string;
    targetAllocation?: number;
    protocol?: string; // For stake/liquidity actions
    parameters?: Record<string, unknown>;
  };
}

// Union type for all blocks
export type VaultBlock = AssetBlock | ConditionBlock | ActionBlock;

// Connection between blocks
export interface BlockConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: 'default' | 'smoothstep' | 'step';
  animated?: boolean;
  style?: Record<string, unknown>;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  blockId: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  blockId: string;
  message: string;
  suggestion?: string;
}

// Vault configuration output
export interface VaultConfiguration {
  assets: {
    code: string;
    issuer?: string;
    allocation: number;
  }[];
  rules: {
    condition: {
      type: string;
      parameters: Record<string, unknown>;
    };
    action: {
      type: string;
      parameters: Record<string, unknown>;
    };
  }[];
  metadata: {
    createdAt: string;
    version: string;
  };
}

// Block palette item
export interface PaletteItem {
  id: string;
  type: BlockType;
  label: string;
  description: string;
  icon?: string;
  defaultData: Record<string, unknown>;
  category: 'assets' | 'conditions' | 'actions';
}
