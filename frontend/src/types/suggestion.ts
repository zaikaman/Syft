/**
 * Suggestion types for AI-powered recommendations
 */

import { VaultConfig } from '../../../shared/types/vault';

export interface Suggestion {
  id: string;
  vaultId: string;
  type: 'rebalance' | 'add_asset' | 'remove_asset' | 'adjust_rule' | 'risk_adjustment';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  rationale: string;
  expectedImpact: {
    returnIncrease?: number;
    riskReduction?: number;
    efficiencyGain?: number;
  };
  implementation: {
    steps: string[];
    difficulty: 'easy' | 'moderate' | 'advanced';
    estimatedTime: string;
  };
  dataSupport?: {
    sentiment?: any;
    forecast?: any;
    analysis?: any;
  };
  configChanges?: Partial<VaultConfig>;
  createdAt: string;
  expiresAt?: string;
}
