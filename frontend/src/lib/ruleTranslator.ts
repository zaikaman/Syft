import type { Node, Edge } from '@xyflow/react';

/**
 * Translates visual block graphs into human-readable strategy descriptions
 */
export class RuleTranslator {
  /**
   * Generate a plain-language description of the vault strategy
   */
  static translateToPlainLanguage(nodes: Node[], edges: Edge[]): string[] {
    const rules: string[] = [];

    // Get asset summary
    const assetBlocks = nodes.filter((n) => n.type === 'asset');
    if (assetBlocks.length > 0) {
      rules.push(this.translateAssets(assetBlocks));
    }

    // Find complete rule chains (Asset -> Condition -> Action)
    const ruleChains = this.findRuleChains(nodes, edges);
    ruleChains.forEach((chain, index) => {
      rules.push(this.translateRuleChain(chain, index + 1));
    });

    // If no complete chains, list orphaned conditions and actions
    if (ruleChains.length === 0) {
      const conditions = nodes.filter((n) => n.type === 'condition');
      const actions = nodes.filter((n) => n.type === 'action');

      if (conditions.length > 0 || actions.length > 0) {
        rules.push('⚠️ No complete rule chains found. Connect Asset → Condition → Action blocks.');
      }
    }

    return rules.length > 0 ? rules : ['No rules defined yet. Start by adding blocks to the canvas.'];
  }

  /**
   * Translate asset allocations
   */
  private static translateAssets(assetBlocks: Node[]): string {
    const assetDescriptions = assetBlocks.map((block) => {
      const { assetType, assetCode, allocation } = block.data;
      const name = assetType === 'CUSTOM' && assetCode ? assetCode : assetType;
      return `${name} (${allocation}%)`;
    });

    return `📊 **Portfolio Allocation**: ${assetDescriptions.join(', ')}`;
  }

  /**
   * Find complete rule chains in the graph
   */
  private static findRuleChains(nodes: Node[], edges: Edge[]): RuleChain[] {
    const chains: RuleChain[] = [];
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

      chains.push({
        asset: assetNode,
        condition: conditionNode,
        action: actionNode,
      });
    });

    return chains;
  }

  /**
   * Translate a single rule chain
   */
  private static translateRuleChain(chain: RuleChain, ruleNumber: number): string {
    const { asset, condition, action } = chain;

    const assetText = this.translateAssetNode(asset);
    const conditionText = this.translateConditionNode(condition);
    const actionText = this.translateActionNode(action);

    return `🔗 **Rule ${ruleNumber}**: When ${assetText} ${conditionText}, then ${actionText}`;
  }

  /**
   * Translate asset node to text
   */
  private static translateAssetNode(node: Node): string {
    const { assetType, assetCode } = node.data;
    const name = assetType === 'CUSTOM' && assetCode ? assetCode : assetType;
    return `**${name}**`;
  }

  /**
   * Translate condition node to text
   */
  private static translateConditionNode(node: Node): string {
    const { conditionType, operator, threshold, value, timeValue, timeUnit } = node.data;
    const operatorStr = typeof operator === 'string' ? operator : undefined;

    switch (conditionType) {
      case 'allocation':
        return `allocation ${this.operatorToText(operatorStr)} ${threshold}%`;
      
      case 'apy_threshold':
        return `APY ${this.operatorToText(operatorStr)} ${threshold}%`;
      
      case 'time_based':
        return `every ${timeValue} ${timeUnit}`;
      
      case 'price_change':
        return `price changes ${this.operatorToText(operatorStr)} ${value}%`;
      
      default:
        return 'meets custom condition';
    }
  }

  /**
   * Translate action node to text
   */
  private static translateActionNode(node: Node): string {
    const { actionType, targetAsset, targetAllocation, protocol } = node.data;

    switch (actionType) {
      case 'rebalance':
        if (targetAsset && targetAllocation) {
          return `rebalance **${targetAsset}** to ${targetAllocation}%`;
        }
        return 'rebalance portfolio to target allocations';
      
      case 'stake':
        if (protocol) {
          return `stake assets on **${protocol}**`;
        }
        return 'stake assets';
      
      case 'provide_liquidity':
        if (protocol) {
          return `provide liquidity to **${protocol}**`;
        }
        return 'add liquidity to pool';
      
      case 'swap':
        if (targetAsset) {
          return `swap to **${targetAsset}**`;
        }
        return 'swap assets';
      
      default:
        return 'execute action';
    }
  }

  /**
   * Convert operator to readable text
   */
  private static operatorToText(operator: string | undefined): string {
    switch (operator) {
      case 'gt':
        return 'exceeds';
      case 'lt':
        return 'falls below';
      case 'gte':
        return 'is at least';
      case 'lte':
        return 'is at most';
      case 'eq':
        return 'equals';
      default:
        return 'is';
    }
  }

  /**
   * Generate a concise summary of the strategy
   */
  static generateSummary(nodes: Node[], edges: Edge[]): string {
    const assetCount = nodes.filter((n) => n.type === 'asset').length;
    const ruleCount = this.findRuleChains(nodes, edges).length;

    if (assetCount === 0) {
      return 'No assets configured';
    }

    if (ruleCount === 0) {
      return `${assetCount} asset${assetCount > 1 ? 's' : ''} configured, no automation rules`;
    }

    return `${assetCount} asset${assetCount > 1 ? 's' : ''}, ${ruleCount} automation rule${ruleCount > 1 ? 's' : ''}`;
  }
}

interface RuleChain {
  asset: Node;
  condition: Node;
  action: Node;
}
