import { Handle, Position, useReactFlow } from '@xyflow/react';
import { TrendingUp, Clock, Percent, DollarSign } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import type { ConditionBlock as ConditionBlockType } from '../../../types/blocks';

interface ConditionBlockProps {
  id: string;
  data: ConditionBlockType['data'];
  selected?: boolean;
}

const ConditionBlock = ({ id, data, selected }: ConditionBlockProps) => {
  const { conditionType, operator, value, threshold, timeUnit, timeValue, description } = data;
  const { updateNodeData } = useReactFlow();

  const [localOperator, setLocalOperator] = useState(operator || 'gt');
  const [localThreshold, setLocalThreshold] = useState(threshold || 0);
  const [localValue, setLocalValue] = useState(value || 0);
  const [localTimeValue, setLocalTimeValue] = useState(timeValue || 1);
  const [localTimeUnit, setLocalTimeUnit] = useState(timeUnit || 'hours');

  useEffect(() => {
    setLocalOperator(operator || 'gt');
    setLocalThreshold(threshold || 0);
    setLocalValue(value || 0);
    setLocalTimeValue(timeValue || 1);
    setLocalTimeUnit(timeUnit || 'hours');
  }, [operator, threshold, value, timeValue, timeUnit]);

  const handleOperatorChange = useCallback((newOperator: string) => {
    setLocalOperator(newOperator as any);
    updateNodeData(id, { operator: newOperator });
  }, [id, updateNodeData]);

  const handleThresholdChange = useCallback((newThreshold: number) => {
    setLocalThreshold(newThreshold);
    updateNodeData(id, { threshold: newThreshold });
  }, [id, updateNodeData]);

  const handleValueChange = useCallback((newValue: number) => {
    setLocalValue(newValue);
    updateNodeData(id, { value: newValue });
  }, [id, updateNodeData]);

  const handleTimeValueChange = useCallback((newTimeValue: number) => {
    setLocalTimeValue(newTimeValue);
    updateNodeData(id, { timeValue: newTimeValue });
  }, [id, updateNodeData]);

  const handleTimeUnitChange = useCallback((newTimeUnit: string) => {
    setLocalTimeUnit(newTimeUnit as any);
    updateNodeData(id, { timeUnit: newTimeUnit });
  }, [id, updateNodeData]);

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

  const getOperatorDisplay = (op: string) => {
    switch (op) {
      case 'gt': return '>';
      case 'lt': return '<';
      case 'gte': return '≥';
      case 'lte': return '≤';
      case 'eq': return '=';
      default: return op;
    }
  };

  const renderConditionInputs = () => {
    switch (conditionType) {
      case 'allocation':
      case 'apy_threshold':
        return (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                Operator
              </label>
              <select
                value={localOperator}
                onChange={(e) => handleOperatorChange(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
              >
                <option value="gt">Greater than (&gt;)</option>
                <option value="gte">Greater or equal (≥)</option>
                <option value="lt">Less than (&lt;)</option>
                <option value="lte">Less or equal (≤)</option>
                <option value="eq">Equal (=)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                Threshold (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={localThreshold}
                onChange={(e) => handleThresholdChange(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        );

      case 'time_based':
        return (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                Interval
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={localTimeValue}
                  onChange={(e) => handleTimeValueChange(parseInt(e.target.value) || 1)}
                  className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
                />
                <select
                  value={localTimeUnit}
                  onChange={(e) => handleTimeUnitChange(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'price_change':
        return (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                Operator
              </label>
              <select
                value={localOperator}
                onChange={(e) => handleOperatorChange(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
              >
                <option value="gt">Greater than (&gt;)</option>
                <option value="gte">Greater or equal (≥)</option>
                <option value="lt">Less than (&lt;)</option>
                <option value="lte">Less or equal (≤)</option>
                <option value="eq">Equal (=)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                Price Change (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={localValue}
                onChange={(e) => handleValueChange(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getDisplayText = () => {
    if (description) return description;

    switch (conditionType) {
      case 'allocation':
        return `Allocation ${getOperatorDisplay(localOperator)} ${localThreshold}%`;
      case 'apy_threshold':
        return `APY ${getOperatorDisplay(localOperator)} ${localThreshold}%`;
      case 'time_based':
        return `Every ${localTimeValue} ${localTimeUnit}`;
      case 'price_change':
        return `Price change ${getOperatorDisplay(localOperator)} ${localValue}%`;
      default:
        return 'Custom condition';
    }
  };

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 
        border-2 rounded-lg shadow-lg 
        min-w-[260px] p-4
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

      {/* Condition inputs */}
      <div className="mb-3">
        {renderConditionInputs()}
      </div>

      {/* Display summary */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-3">
        <p className="text-sm text-gray-900 dark:text-white font-medium">
          {getDisplayText()}
        </p>
      </div>
    </div>
  );
};

export default ConditionBlock;
