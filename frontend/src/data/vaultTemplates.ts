import type { Node, Edge } from '@xyflow/react';

export interface VaultTemplate {
  id: string;
  name: string;
  description: string;
  category: 'conservative' | 'balanced' | 'aggressive' | 'custom';
  nodes: Node[];
  edges: Edge[];
  estimatedAPY?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export const vaultTemplates: VaultTemplate[] = [
  {
    id: 'stable-balance',
    name: 'Stable Balance',
    description: 'Conservative strategy with 70% USDC and 30% XLM, rebalances when allocation drifts by 10%',
    category: 'conservative',
    estimatedAPY: '3-5%',
    riskLevel: 'low',
    nodes: [
      {
        id: 'asset-0',
        type: 'asset',
        position: { x: 100, y: 100 },
        data: {
          assetType: 'USDC',
          allocation: 70,
          label: 'USDC',
        },
      },
      {
        id: 'asset-1',
        type: 'asset',
        position: { x: 100, y: 280 },
        data: {
          assetType: 'XLM',
          allocation: 30,
          label: 'XLM',
        },
      },
      {
        id: 'condition-0',
        type: 'condition',
        position: { x: 400, y: 100 },
        data: {
          conditionType: 'allocation',
          operator: 'gt',
          threshold: 75,
          label: 'Allocation Check',
        },
      },
      {
        id: 'action-0',
        type: 'action',
        position: { x: 700, y: 100 },
        data: {
          actionType: 'rebalance',
          label: 'Rebalance',
        },
      },
    ],
    edges: [
      {
        id: 'e-asset-0-condition-0',
        source: 'asset-0',
        target: 'condition-0',
        animated: true,
      },
      {
        id: 'e-condition-0-action-0',
        source: 'condition-0',
        target: 'action-0',
        animated: true,
      },
    ],
  },
  {
    id: 'balanced-growth',
    name: 'Balanced Growth',
    description: '50/50 split between USDC and XLM with daily rebalancing and APY monitoring',
    category: 'balanced',
    estimatedAPY: '5-8%',
    riskLevel: 'medium',
    nodes: [
      {
        id: 'asset-0',
        type: 'asset',
        position: { x: 100, y: 100 },
        data: {
          assetType: 'USDC',
          allocation: 50,
          label: 'USDC',
        },
      },
      {
        id: 'asset-1',
        type: 'asset',
        position: { x: 100, y: 280 },
        data: {
          assetType: 'XLM',
          allocation: 50,
          label: 'XLM',
        },
      },
      {
        id: 'condition-0',
        type: 'condition',
        position: { x: 400, y: 100 },
        data: {
          conditionType: 'time_based',
          timeValue: 24,
          timeUnit: 'hours',
          label: 'Daily Check',
        },
      },
      {
        id: 'condition-1',
        type: 'condition',
        position: { x: 400, y: 280 },
        data: {
          conditionType: 'apy_threshold',
          operator: 'lt',
          threshold: 4,
          label: 'APY Monitor',
        },
      },
      {
        id: 'action-0',
        type: 'action',
        position: { x: 700, y: 100 },
        data: {
          actionType: 'rebalance',
          label: 'Rebalance',
        },
      },
      {
        id: 'action-1',
        type: 'action',
        position: { x: 700, y: 280 },
        data: {
          actionType: 'swap',
          targetAsset: 'XLM',
          label: 'Swap to XLM',
        },
      },
    ],
    edges: [
      {
        id: 'e-asset-0-condition-0',
        source: 'asset-0',
        target: 'condition-0',
        animated: true,
      },
      {
        id: 'e-condition-0-action-0',
        source: 'condition-0',
        target: 'action-0',
        animated: true,
      },
      {
        id: 'e-asset-1-condition-1',
        source: 'asset-1',
        target: 'condition-1',
        animated: true,
      },
      {
        id: 'e-condition-1-action-1',
        source: 'condition-1',
        target: 'action-1',
        animated: true,
      },
    ],
  },
  {
    id: 'xlm-maximizer',
    name: 'XLM Maximizer',
    description: 'Aggressive strategy with 80% XLM allocation, reacts to price movements',
    category: 'aggressive',
    estimatedAPY: '10-15%',
    riskLevel: 'high',
    nodes: [
      {
        id: 'asset-0',
        type: 'asset',
        position: { x: 100, y: 100 },
        data: {
          assetType: 'XLM',
          allocation: 80,
          label: 'XLM',
        },
      },
      {
        id: 'asset-1',
        type: 'asset',
        position: { x: 100, y: 280 },
        data: {
          assetType: 'USDC',
          allocation: 20,
          label: 'USDC',
        },
      },
      {
        id: 'condition-0',
        type: 'condition',
        position: { x: 400, y: 100 },
        data: {
          conditionType: 'price_change',
          operator: 'lt',
          value: -5,
          label: 'Price Drop',
        },
      },
      {
        id: 'condition-1',
        type: 'condition',
        position: { x: 400, y: 280 },
        data: {
          conditionType: 'price_change',
          operator: 'gt',
          value: 10,
          label: 'Price Surge',
        },
      },
      {
        id: 'action-0',
        type: 'action',
        position: { x: 700, y: 100 },
        data: {
          actionType: 'swap',
          targetAsset: 'USDC',
          label: 'Swap to USDC',
        },
      },
      {
        id: 'action-1',
        type: 'action',
        position: { x: 700, y: 280 },
        data: {
          actionType: 'rebalance',
          targetAsset: 'XLM',
          targetAllocation: 90,
          label: 'Increase XLM',
        },
      },
    ],
    edges: [
      {
        id: 'e-asset-0-condition-0',
        source: 'asset-0',
        target: 'condition-0',
        animated: true,
      },
      {
        id: 'e-condition-0-action-0',
        source: 'condition-0',
        target: 'action-0',
        animated: true,
      },
      {
        id: 'e-asset-0-condition-1',
        source: 'asset-0',
        target: 'condition-1',
        animated: true,
      },
      {
        id: 'e-condition-1-action-1',
        source: 'condition-1',
        target: 'action-1',
        animated: true,
      },
    ],
  },
  {
    id: 'simple-hodl',
    name: 'Simple HODL',
    description: 'Basic buy-and-hold strategy with weekly rebalancing',
    category: 'conservative',
    estimatedAPY: '2-4%',
    riskLevel: 'low',
    nodes: [
      {
        id: 'asset-0',
        type: 'asset',
        position: { x: 100, y: 150 },
        data: {
          assetType: 'XLM',
          allocation: 100,
          label: 'XLM',
        },
      },
      {
        id: 'condition-0',
        type: 'condition',
        position: { x: 400, y: 150 },
        data: {
          conditionType: 'time_based',
          timeValue: 7,
          timeUnit: 'days',
          label: 'Weekly',
        },
      },
      {
        id: 'action-0',
        type: 'action',
        position: { x: 700, y: 150 },
        data: {
          actionType: 'rebalance',
          label: 'Rebalance',
        },
      },
    ],
    edges: [
      {
        id: 'e-asset-0-condition-0',
        source: 'asset-0',
        target: 'condition-0',
        animated: true,
      },
      {
        id: 'e-condition-0-action-0',
        source: 'condition-0',
        target: 'action-0',
        animated: true,
      },
    ],
  },
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): VaultTemplate | undefined {
  return vaultTemplates.find((t) => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: VaultTemplate['category']): VaultTemplate[] {
  return vaultTemplates.filter((t) => t.category === category);
}

/**
 * Get templates by risk level
 */
export function getTemplatesByRisk(riskLevel: VaultTemplate['riskLevel']): VaultTemplate[] {
  return vaultTemplates.filter((t) => t.riskLevel === riskLevel);
}
