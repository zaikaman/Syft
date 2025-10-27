import type { Node, Edge } from '@xyflow/react';
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types/blocks';

/**
 * Validates block connections and configurations
 */
export class BlockValidator {
  /**
   * Validate if a connection between two nodes is allowed
   */
  static isValidConnection(
    source: Node,
    target: Node,
    _sourceHandle?: string,
    _targetHandle?: string
  ): { valid: boolean; message?: string } {
    // Asset blocks can only connect to conditions
    if (source.type === 'asset' && target.type !== 'condition') {
      return {
        valid: false,
        message: 'Assets can only connect to Conditions',
      };
    }

    // Conditions can connect to actions or other conditions
    if (source.type === 'condition' && target.type === 'asset') {
      return {
        valid: false,
        message: 'Conditions cannot connect back to Assets',
      };
    }

    // Actions cannot have outputs
    if (source.type === 'action') {
      return {
        valid: false,
        message: 'Actions are terminal blocks and cannot have outputs',
      };
    }

    // Prevent circular dependencies
    // This is a simplified check - a full implementation would need graph traversal
    if (source.id === target.id) {
      return {
        valid: false,
        message: 'Cannot connect a block to itself',
      };
    }

    return { valid: true };
  }

  /**
   * Validate the entire vault configuration
   */
  static validateVault(nodes: Node[], edges: Edge[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if there are any nodes
    if (nodes.length === 0) {
      errors.push({
        blockId: 'canvas',
        message: 'Vault must have at least one block',
      });
      return { valid: false, errors, warnings };
    }

    // Check for asset blocks
    const assetBlocks = nodes.filter((n) => n.type === 'asset');
    if (assetBlocks.length === 0) {
      errors.push({
        blockId: 'canvas',
        message: 'Vault must have at least one asset block',
      });
    }

    // Validate total allocation
    const totalAllocation = assetBlocks.reduce((sum, block) => {
      const allocation = typeof block.data.allocation === 'number' ? block.data.allocation : 0;
      return sum + allocation;
    }, 0);

    if (totalAllocation !== 100 && assetBlocks.length > 0) {
      warnings.push({
        blockId: 'canvas',
        message: `Total allocation is ${totalAllocation}%, should be 100%`,
        suggestion: 'Adjust asset allocations to sum to 100%',
      });
    }

    // Check each asset block
    assetBlocks.forEach((block) => {
      const allocation = typeof block.data.allocation === 'number' ? block.data.allocation : 0;
      
      if (!allocation || allocation <= 0) {
        errors.push({
          blockId: block.id,
          message: 'Asset must have a positive allocation',
          field: 'allocation',
        });
      }

      if (allocation > 100) {
        errors.push({
          blockId: block.id,
          message: 'Asset allocation cannot exceed 100%',
          field: 'allocation',
        });
      }

      // Check custom tokens have required fields
      if (block.data.assetType === 'CUSTOM') {
        if (!block.data.assetCode) {
          errors.push({
            blockId: block.id,
            message: 'Custom asset must have an asset code',
            field: 'assetCode',
          });
        }
        if (!block.data.assetIssuer) {
          errors.push({
            blockId: block.id,
            message: 'Custom asset must have an issuer address',
            field: 'assetIssuer',
          });
        }
      }
    });

    // Check condition blocks
    const conditionBlocks = nodes.filter((n) => n.type === 'condition');
    conditionBlocks.forEach((block) => {
      const { conditionType, operator, threshold, value, timeValue, timeUnit } = block.data;

      if (!conditionType) {
        errors.push({
          blockId: block.id,
          message: 'Condition must have a type',
          field: 'conditionType',
        });
      }

      // Validate based on condition type
      if (conditionType === 'allocation' || conditionType === 'apy_threshold') {
        if (!operator) {
          warnings.push({
            blockId: block.id,
            message: 'Condition should specify an operator',
            suggestion: 'Add a comparison operator (>, <, =, etc.)',
          });
        }
        if (threshold === undefined || threshold === null) {
          errors.push({
            blockId: block.id,
            message: 'Threshold is required for this condition type',
            field: 'threshold',
          });
        }
      }

      if (conditionType === 'time_based') {
        const timeValueNum = typeof timeValue === 'number' ? timeValue : 0;
        if (!timeValue || timeValueNum <= 0) {
          errors.push({
            blockId: block.id,
            message: 'Time value must be positive',
            field: 'timeValue',
          });
        }
        if (!timeUnit) {
          errors.push({
            blockId: block.id,
            message: 'Time unit is required',
            field: 'timeUnit',
          });
        }
      }

      if (conditionType === 'price_change') {
        if (value === undefined || value === null) {
          errors.push({
            blockId: block.id,
            message: 'Value is required for price change condition',
            field: 'value',
          });
        }
      }
    });

    // Check action blocks
    const actionBlocks = nodes.filter((n) => n.type === 'action');
    actionBlocks.forEach((block) => {
      const { actionType, targetAsset, protocol } = block.data;

      if (!actionType) {
        errors.push({
          blockId: block.id,
          message: 'Action must have a type',
          field: 'actionType',
        });
      }

      if (actionType === 'stake' || actionType === 'provide_liquidity') {
        if (!protocol) {
          warnings.push({
            blockId: block.id,
            message: 'Action should specify a protocol',
            suggestion: 'Add the protocol or platform name',
          });
        }
      }

      if (actionType === 'swap') {
        if (!targetAsset) {
          errors.push({
            blockId: block.id,
            message: 'Swap action requires a target asset',
            field: 'targetAsset',
          });
        }
      }
    });

    // Check for disconnected blocks
    const connectedNodeIds = new Set<string>();
    edges.forEach((edge) => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    nodes.forEach((node) => {
      if (!connectedNodeIds.has(node.id) && nodes.length > 1) {
        warnings.push({
          blockId: node.id,
          message: 'Block is not connected to any other blocks',
          suggestion: 'Connect this block to create a rule chain',
        });
      }
    });

    // Check for complete rule chains (Asset -> Condition -> Action)
    const actionNodesWithPaths = actionBlocks.filter((actionNode) => {
      const incomingEdge = edges.find((e) => e.target === actionNode.id);
      if (!incomingEdge) return false;

      const conditionNode = nodes.find((n) => n.id === incomingEdge.source);
      if (!conditionNode || conditionNode.type !== 'condition') return false;

      const conditionIncomingEdge = edges.find((e) => e.target === conditionNode.id);
      if (!conditionIncomingEdge) return false;

      const assetNode = nodes.find((n) => n.id === conditionIncomingEdge.source);
      return assetNode && assetNode.type === 'asset';
    });

    if (actionBlocks.length > 0 && actionNodesWithPaths.length === 0) {
      warnings.push({
        blockId: 'canvas',
        message: 'No complete rule chains found',
        suggestion: 'Create chains following: Asset → Condition → Action',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get a human-readable error message for display
   */
  static formatValidationMessage(result: ValidationResult): string {
    if (result.valid && result.warnings.length === 0) {
      return 'Configuration is valid ✓';
    }

    const messages: string[] = [];

    if (result.errors.length > 0) {
      messages.push(`❌ ${result.errors.length} error(s):`);
      result.errors.forEach((error) => {
        messages.push(`  • ${error.message}`);
      });
    }

    if (result.warnings.length > 0) {
      messages.push(`⚠️ ${result.warnings.length} warning(s):`);
      result.warnings.forEach((warning) => {
        messages.push(`  • ${warning.message}`);
      });
    }

    return messages.join('\n');
  }
}
