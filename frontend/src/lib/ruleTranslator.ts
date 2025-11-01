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
   * Now supports multiple assets connected to the same condition
   * AND multiple conditions connected to the same action
   */
  private static findRuleChains(nodes: Node[], edges: Edge[]): RuleChain[] {
    const chains: RuleChain[] = [];
    const processedConditions = new Set<string>(); // Track processed conditions to avoid duplicates

    // Find all condition nodes
    const conditionBlocks = nodes.filter((n) => n.type === 'condition');

    conditionBlocks.forEach((conditionNode) => {
      // Skip if we already processed this condition
      if (processedConditions.has(conditionNode.id)) return;
      processedConditions.add(conditionNode.id);

      // Find action connected to this condition
      const actionEdge = edges.find((e) => e.source === conditionNode.id);
      if (!actionEdge) return;

      const actionNode = nodes.find((n) => n.id === actionEdge.target);
      if (!actionNode || actionNode.type !== 'action') return;

      // Find ALL assets connected to this condition
      const assetEdges = edges.filter((e) => e.target === conditionNode.id);
      const assetNodes = assetEdges
        .map((edge) => nodes.find((n) => n.id === edge.source))
        .filter((n) => n && n.type === 'asset') as Node[];

      // If we have at least one asset, create a chain
      if (assetNodes.length > 0) {
        chains.push({
          assets: assetNodes,
          condition: conditionNode,
          action: actionNode,
        });
      }
    });

    return chains;
  }

  /**
   * Translate a single rule chain
   * Now handles multiple assets connected to the same condition
   */
  private static translateRuleChain(chain: RuleChain, ruleNumber: number): string {
    const { assets, condition, action } = chain;

    // Translate all assets
    const assetText = assets.length === 1
      ? this.translateAssetNode(assets[0])
      : `**${assets.map(a => {
          const { assetType, assetCode } = a.data;
          return assetType === 'CUSTOM' && assetCode ? assetCode : assetType;
        }).join(', ')}**`;

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
  assets: Node[]; // Changed from single asset to array to support multiple assets per condition
  condition: Node;
  action: Node;
}
