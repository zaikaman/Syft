import { Handle, Position } from '@xyflow/react';
import { Coins } from 'lucide-react';
import type { AssetBlock as AssetBlockType } from '../../../types/blocks';

interface AssetBlockProps {
  data: AssetBlockType['data'];
  selected?: boolean;
}

const AssetBlock = ({ data, selected }: AssetBlockProps) => {
  const { assetType, assetCode, allocation, icon } = data;

  const displayName = assetType === 'CUSTOM' && assetCode ? assetCode : assetType;

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 
        border-2 rounded-lg shadow-lg 
        min-w-[200px] p-4
        transition-all duration-200
        ${selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 dark:border-gray-600'}
        hover:shadow-xl
      `}
    >
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-green-500 !w-3 !h-3"
        id="asset-out"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {icon ? (
          <img src={icon} alt={displayName} className="w-6 h-6 rounded-full" />
        ) : (
          <Coins className="w-6 h-6 text-blue-500" />
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {displayName}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Asset</p>
        </div>
      </div>

      {/* Allocation display */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Allocation:
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {allocation}%
          </span>
        </div>

        {/* Allocation bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${allocation}%` }}
          />
        </div>
      </div>

      {/* Custom token info */}
      {assetType === 'CUSTOM' && data.assetIssuer && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            Issuer: {data.assetIssuer.slice(0, 8)}...{data.assetIssuer.slice(-8)}
          </p>
        </div>
      )}
    </div>
  );
};

export default AssetBlock;
