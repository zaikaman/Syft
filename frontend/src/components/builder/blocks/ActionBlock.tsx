import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Repeat, Lock, Droplet, ArrowLeftRight } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import type { ActionBlock as ActionBlockType } from '../../../types/blocks';

interface ActionBlockProps {
  id: string;
  data: ActionBlockType['data'];
  selected?: boolean;
}

const ActionBlock = ({ id, data, selected }: ActionBlockProps) => {
  const { actionType, targetAsset, targetAllocation, protocol } = data;
  const { updateNodeData } = useReactFlow();

  const [localTargetAsset, setLocalTargetAsset] = useState(targetAsset || '');
  const [localTargetAllocation, setLocalTargetAllocation] = useState(targetAllocation || 0);
  const [localProtocol, setLocalProtocol] = useState(protocol || '');

  useEffect(() => {
    setLocalTargetAsset(targetAsset || '');
    setLocalTargetAllocation(targetAllocation || 0);
    setLocalProtocol(protocol || '');
  }, [targetAsset, targetAllocation, protocol]);

  const handleTargetAssetChange = useCallback((value: string) => {
    setLocalTargetAsset(value);
    updateNodeData(id, { targetAsset: value });
  }, [id, updateNodeData]);

  const handleTargetAllocationChange = useCallback((value: number) => {
    const clampedValue = Math.min(100, Math.max(0, value));
    setLocalTargetAllocation(clampedValue);
    updateNodeData(id, { targetAllocation: clampedValue });
  }, [id, updateNodeData]);

  const handleProtocolChange = useCallback((value: string) => {
    setLocalProtocol(value);
    updateNodeData(id, { protocol: value });
  }, [id, updateNodeData]);

  const getIcon = () => {
    switch (actionType) {
      case 'rebalance':
        return <Repeat className="w-6 h-6 text-orange-500" />;
      case 'stake':
        return <Lock className="w-6 h-6 text-orange-500" />;
      case 'provide_liquidity':
        return <Droplet className="w-6 h-6 text-orange-500" />;
      case 'swap':
        return <ArrowLeftRight className="w-6 h-6 text-orange-500" />;
      default:
        return <Repeat className="w-6 h-6 text-orange-500" />;
    }
  };

  const getDisplayTitle = () => {
    switch (actionType) {
      case 'rebalance':
        return 'Rebalance Portfolio';
      case 'stake':
        return 'Stake Assets';
      case 'provide_liquidity':
        return 'Provide Liquidity';
      case 'swap':
        return 'Swap Assets';
      default:
        return 'Custom Action';
    }
  };

  const renderActionInputs = () => {
    switch (actionType) {
      case 'rebalance':
        return (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                Target Asset (Optional)
              </label>
              <input
                type="text"
                value={localTargetAsset}
                onChange={(e) => handleTargetAssetChange(e.target.value)}
                placeholder="e.g. XLM, USDC"
                className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
              />
            </div>
            {localTargetAsset && (
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                  Target Allocation (%)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={localTargetAllocation}
                    onChange={(e) => handleTargetAllocationChange(parseFloat(e.target.value) || 0)}
                    className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
                  />
                  <span className="flex items-center text-sm text-gray-600 dark:text-gray-400">%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={localTargetAllocation}
                  onChange={(e) => handleTargetAllocationChange(parseFloat(e.target.value))}
                  className="w-full mt-1"
                  style={{
                    background: `linear-gradient(to right, #f97316 0%, #f97316 ${localTargetAllocation}%, #e5e7eb ${localTargetAllocation}%, #e5e7eb 100%)`
                  }}
                />
              </div>
            )}
          </div>
        );

      case 'stake':
      case 'provide_liquidity':
        return (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                Protocol
              </label>
              <input
                type="text"
                value={localProtocol}
                onChange={(e) => handleProtocolChange(e.target.value)}
                placeholder="e.g. Aqua, Soroswap"
                className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
              />
            </div>
            {actionType === 'stake' && (
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                  Asset to Stake
                </label>
                <input
                  type="text"
                  value={localTargetAsset}
                  onChange={(e) => handleTargetAssetChange(e.target.value)}
                  placeholder="e.g. XLM"
                  className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
                />
              </div>
            )}
          </div>
        );

      case 'swap':
        return (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                Target Asset
              </label>
              <input
                type="text"
                value={localTargetAsset}
                onChange={(e) => handleTargetAssetChange(e.target.value)}
                placeholder="e.g. USDC"
                className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                Protocol (Optional)
              </label>
              <input
                type="text"
                value={localProtocol}
                onChange={(e) => handleProtocolChange(e.target.value)}
                placeholder="e.g. Soroswap"
                className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getDescription = () => {
    switch (actionType) {
      case 'rebalance':
        return localTargetAsset && localTargetAllocation
          ? `Rebalance ${localTargetAsset} to ${localTargetAllocation}%`
          : 'Rebalance to target allocations';
      case 'stake':
        return localProtocol
          ? `Stake ${localTargetAsset || 'assets'} on ${localProtocol}`
          : 'Stake assets';
      case 'provide_liquidity':
        return localProtocol
          ? `Add liquidity to ${localProtocol}`
          : 'Add liquidity to pool';
      case 'swap':
        return localTargetAsset
          ? `Swap to ${localTargetAsset}${localProtocol ? ` via ${localProtocol}` : ''}`
          : 'Swap assets';
      default:
        return 'Execute action';
    }
  };

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 
        border-2 rounded-lg shadow-lg 
        min-w-[260px] p-4
        transition-all duration-200
        ${selected ? 'border-orange-500 ring-2 ring-orange-300' : 'border-gray-300 dark:border-gray-600'}
        hover:shadow-xl
      `}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-orange-500 !w-3 !h-3"
        id="action-in"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {getIcon()}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {getDisplayTitle()}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Action</p>
        </div>
      </div>

      {/* Action inputs */}
      <div className="mb-3">
        {renderActionInputs()}
      </div>

      {/* Display summary */}
      <div className="bg-orange-50 dark:bg-orange-900/20 rounded p-3">
        <p className="text-sm text-gray-900 dark:text-white">
          {getDescription()}
        </p>
      </div>
    </div>
  );
};

export default ActionBlock;
