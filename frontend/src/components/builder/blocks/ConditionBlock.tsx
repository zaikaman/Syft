import { Handle, Position } from '@xyflow/react';
import { TrendingUp, Clock, Percent, DollarSign } from 'lucide-react';
import type { ConditionBlock as ConditionBlockType } from '../../../types/blocks';

interface ConditionBlockProps {
  data: ConditionBlockType['data'];
  selected?: boolean;
}

const ConditionBlock = ({ data, selected }: ConditionBlockProps) => {
  const { conditionType, operator, value, threshold, timeUnit, timeValue, description } = data;

  const getIcon = () => {
    switch (conditionType) {
      case 'allocation':
        return <Percent className="w-6 h-6 text-purple-500" />;
      case 'apy_threshold':
        return <TrendingUp className="w-6 h-6 text-purple-500" />;
      case 'time_based':
        return <Clock className="w-6 h-6 text-purple-500" />;
      case 'price_change':
        return <DollarSign className="w-6 h-6 text-purple-500" />;
      default:
        return <TrendingUp className="w-6 h-6 text-purple-500" />;
    }
  };

  const getDisplayText = () => {
    if (description) return description;

    switch (conditionType) {
      case 'allocation':
        return `Allocation ${operator || 'gt'} ${threshold || 0}%`;
      case 'apy_threshold':
        return `APY ${operator || 'gt'} ${threshold || 0}%`;
      case 'time_based':
        return `Every ${timeValue || 1} ${timeUnit || 'hours'}`;
      case 'price_change':
        return `Price change ${operator || 'gt'} ${value || 0}%`;
      default:
        return 'Custom condition';
    }
  };

  const getOperatorDisplay = () => {
    switch (operator) {
      case 'gt':
        return '>';
      case 'lt':
        return '<';
      case 'gte':
        return '≥';
      case 'lte':
        return '≤';
      case 'eq':
        return '=';
      default:
        return operator;
    }
  };

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 
        border-2 rounded-lg shadow-lg 
        min-w-[220px] p-4
        transition-all duration-200
        ${selected ? 'border-purple-500 ring-2 ring-purple-300' : 'border-gray-300 dark:border-gray-600'}
        hover:shadow-xl
      `}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-purple-500 !w-3 !h-3"
        id="condition-in"
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-purple-500 !w-3 !h-3"
        id="condition-out"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {getIcon()}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {conditionType.split('_').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Condition</p>
        </div>
      </div>

      {/* Condition details */}
      <div className="space-y-2">
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-3">
          <p className="text-sm text-gray-900 dark:text-white font-medium">
            {getDisplayText()}
          </p>
        </div>

        {/* Additional details for complex conditions */}
        {(operator || threshold !== undefined || value !== undefined) && (
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            {operator && (
              <span className="flex items-center gap-1">
                <span className="font-semibold">Operator:</span>
                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  {getOperatorDisplay()}
                </span>
              </span>
            )}
            {(threshold !== undefined || value !== undefined) && (
              <span className="flex items-center gap-1">
                <span className="font-semibold">Value:</span>
                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  {threshold || value}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConditionBlock;
