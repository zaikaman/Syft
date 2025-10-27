import { Handle, Position } from '@xyflow/react';
import { Repeat, Lock, Droplet, ArrowLeftRight } from 'lucide-react';
import type { ActionBlock as ActionBlockType } from '../../../types/blocks';

interface ActionBlockProps {
  data: ActionBlockType['data'];
  selected?: boolean;
}

const ActionBlock = ({ data, selected }: ActionBlockProps) => {
  const { actionType, targetAsset, targetAllocation, protocol, parameters } = data;

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

  const getDescription = () => {
    switch (actionType) {
      case 'rebalance':
        return targetAsset && targetAllocation
          ? `Rebalance ${targetAsset} to ${targetAllocation}%`
          : 'Rebalance to target allocations';
      case 'stake':
        return protocol
          ? `Stake assets on ${protocol}`
          : 'Stake assets';
      case 'provide_liquidity':
        return protocol
          ? `Add liquidity to ${protocol}`
          : 'Add liquidity to pool';
      case 'swap':
        return targetAsset
          ? `Swap to ${targetAsset}`
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
        min-w-[220px] p-4
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

      {/* Action details */}
      <div className="space-y-2">
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded p-3">
          <p className="text-sm text-gray-900 dark:text-white">
            {getDescription()}
          </p>
        </div>

        {/* Additional parameters */}
        <div className="space-y-1">
          {targetAsset && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Target:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {targetAsset}
              </span>
            </div>
          )}
          {targetAllocation !== undefined && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Allocation:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {targetAllocation}%
              </span>
            </div>
          )}
          {protocol && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Protocol:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {protocol}
              </span>
            </div>
          )}
          {parameters && Object.keys(parameters).length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Additional Parameters:
              </p>
              {Object.entries(parameters).map(([key, value]) => (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                  <span className="text-gray-900 dark:text-white font-mono">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionBlock;
