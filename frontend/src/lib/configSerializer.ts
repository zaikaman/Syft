import type { Node, Edge } from '@xyflow/react';
import type { VaultConfiguration } from '../types/blocks';

/**
 * Serializes visual block graph into vault configuration for smart contract deployment
 */
export class ConfigSerializer {
  /**
   * Convert visual blocks and edges into deployable vault configuration
   */
  static serialize(nodes: Node[], edges: Edge[]): VaultConfiguration {
    const assets = this.extractAssets(nodes);
    const rules = this.extractRules(nodes, edges);

    return {
      assets,
      rules,
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  }

  /**
   * Extract asset configuration from asset blocks
   */
  private static extractAssets(nodes: Node[]) {
    const assetBlocks = nodes.filter((n) => n.type === 'asset');

    return assetBlocks.map((block) => {
      const { assetType, assetCode, assetIssuer, allocation } = block.data;

      // For native XLM
      if (assetType === 'XLM') {
        return {
          code: 'XLM',
          allocation: typeof allocation === 'number' ? allocation : 0,
        };
      }

      // For USDC (assume Circle's USDC on Stellar)
      if (assetType === 'USDC') {
        return {
          code: 'USDC',
          issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', // Circle's USDC issuer
          allocation: typeof allocation === 'number' ? allocation : 0,
        };
      }

      // For custom tokens
      return {
        code: typeof assetCode === 'string' ? assetCode : 'UNKNOWN',
        issuer: typeof assetIssuer === 'string' ? assetIssuer : '',
        allocation: typeof allocation === 'number' ? allocation : 0,
      };
    });
  }

  /**
   * Extract automation rules from complete chains (Asset -> Condition -> Action)
   */
  private static extractRules(nodes: Node[], edges: Edge[]) {
    const rules: VaultConfiguration['rules'] = [];
    const actionBlocks = nodes.filter((n) => n.type === 'action');

    actionBlocks.forEach((actionNode) => {
      // Find condition connected to this action
      const conditionEdge = edges.find((e) => e.target === actionNode.id);
      if (!conditionEdge) return;

      const conditionNode = nodes.find((n) => n.id === conditionEdge.source);
      if (!conditionNode || conditionNode.type !== 'condition') return;

      // Find asset connected to this condition
      const assetEdge = edges.find((e) => e.target === conditionNode.id);
      if (!assetEdge) return;

      const assetNode = nodes.find((n) => n.id === assetEdge.source);
      if (!assetNode || assetNode.type !== 'asset') return;

      // Build the rule
      const condition = this.serializeCondition(conditionNode, assetNode);
      const action = this.serializeAction(actionNode);

      rules.push({ condition, action });
    });

    return rules;
  }

  /**
   * Serialize condition block to configuration
   */
  private static serializeCondition(conditionNode: Node, assetNode: Node) {
    const { conditionType, operator, threshold, value, timeValue, timeUnit } = conditionNode.data;
    const { assetType, assetCode } = assetNode.data;

    const assetIdentifier = assetType === 'CUSTOM' && assetCode ? assetCode : assetType;

    const parameters: Record<string, unknown> = {
      asset: assetIdentifier,
    };

    switch (conditionType) {
      case 'allocation':
        parameters.operator = operator || 'gt';
        parameters.threshold = threshold || 0;
        break;

      case 'apy_threshold':
        parameters.operator = operator || 'gt';
        parameters.threshold = threshold || 0;
        break;

      case 'time_based':
        parameters.interval = timeValue || 1;
        parameters.unit = timeUnit || 'hours';
        break;

      case 'price_change':
        parameters.operator = operator || 'gt';
        parameters.percentage = value || 0;
        break;

      default:
        // Custom condition - pass all data
        Object.assign(parameters, conditionNode.data);
    }

    return {
      type: typeof conditionType === 'string' ? conditionType : 'custom',
      parameters,
    };
  }

  /**
   * Serialize action block to configuration
   */
  private static serializeAction(actionNode: Node) {
    const { actionType, targetAsset, targetAllocation, protocol, parameters } = actionNode.data;

    const actionParams: Record<string, unknown> = {};

    switch (actionType) {
      case 'rebalance':
        if (targetAsset) {
          actionParams.targetAsset = targetAsset;
        }
        if (targetAllocation !== undefined) {
          actionParams.targetAllocation = targetAllocation;
        }
        break;

      case 'stake':
        if (protocol) {
          actionParams.protocol = protocol;
        }
        break;

      case 'provide_liquidity':
        if (protocol) {
          actionParams.protocol = protocol;
        }
        break;

      case 'swap':
        if (targetAsset) {
          actionParams.targetAsset = targetAsset;
        }
        break;

      default:
        // Custom action - include all parameters
        if (parameters && typeof parameters === 'object') {
          Object.assign(actionParams, parameters);
        }
    }

    return {
      type: typeof actionType === 'string' ? actionType : 'custom',
      parameters: actionParams,
    };
  }

  /**
   * Deserialize vault configuration back into visual blocks
   * Useful for loading saved vaults
   */
  static deserialize(config: VaultConfiguration): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let nodeIdCounter = 0;

    // Create asset blocks
    config.assets.forEach((asset, index) => {
      const assetId = `asset-${nodeIdCounter++}`;
      
      let assetType: 'XLM' | 'USDC' | 'CUSTOM' = 'CUSTOM';
      if (asset.code === 'XLM') {
        assetType = 'XLM';
      } else if (asset.code === 'USDC') {
        assetType = 'USDC';
      }

      nodes.push({
        id: assetId,
        type: 'asset',
        position: { x: 100, y: 100 + index * 150 },
        data: {
          assetType,
          assetCode: asset.code,
          assetIssuer: asset.issuer,
          allocation: asset.allocation,
          label: asset.code,
        },
      });
    });

    // Create condition and action blocks for each rule
    config.rules.forEach((rule, index) => {
      const conditionId = `condition-${nodeIdCounter++}`;
      const actionId = `action-${nodeIdCounter++}`;

      // Find matching asset block
      const assetNode = nodes.find((n) => {
        if (n.type !== 'asset') return false;
        const assetIdentifier = n.data.assetType === 'CUSTOM' ? n.data.assetCode : n.data.assetType;
        return assetIdentifier === rule.condition.parameters.asset;
      });

      // Create condition block
      nodes.push({
        id: conditionId,
        type: 'condition',
        position: { x: 400, y: 100 + index * 150 },
        data: {
          conditionType: rule.condition.type,
          ...rule.condition.parameters,
          label: rule.condition.type,
        },
      });

      // Create action block
      nodes.push({
        id: actionId,
        type: 'action',
        position: { x: 700, y: 100 + index * 150 },
        data: {
          actionType: rule.action.type,
          ...rule.action.parameters,
          label: rule.action.type,
        },
      });

      // Create edges
      if (assetNode) {
        edges.push({
          id: `e-${assetNode.id}-${conditionId}`,
          source: assetNode.id,
          target: conditionId,
          animated: true,
        });
      }

      edges.push({
        id: `e-${conditionId}-${actionId}`,
        source: conditionId,
        target: actionId,
        animated: true,
      });
    });

    return { nodes, edges };
  }

  /**
   * Export configuration as JSON string
   */
  static exportJSON(config: VaultConfiguration): string {
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from JSON string
   */
  static importJSON(json: string): VaultConfiguration {
    try {
      const config = JSON.parse(json);
      // Basic validation
      if (!config.assets || !Array.isArray(config.assets)) {
        throw new Error('Invalid configuration: missing assets array');
      }
      if (!config.rules || !Array.isArray(config.rules)) {
        throw new Error('Invalid configuration: missing rules array');
      }
      return config as VaultConfiguration;
    } catch (error) {
      throw new Error(`Failed to parse configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
