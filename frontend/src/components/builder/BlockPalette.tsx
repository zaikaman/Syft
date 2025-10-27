import { useState } from 'react';
import { Coins, TrendingUp, Repeat, ChevronDown, ChevronUp } from 'lucide-react';
import type { PaletteItem } from '../../types/blocks';

interface BlockPaletteProps {
  onBlockSelect: (item: PaletteItem) => void;
}

const BlockPalette = ({ onBlockSelect }: BlockPaletteProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['assets', 'conditions', 'actions'])
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const paletteItems: PaletteItem[] = [
    // Assets
    {
      id: 'asset-xlm',
      type: 'asset',
      label: 'XLM',
      description: 'Stellar Lumens native token',
      category: 'assets',
      defaultData: {
        assetType: 'XLM',
        allocation: 50,
      },
    },
    {
      id: 'asset-usdc',
      type: 'asset',
      label: 'USDC',
      description: 'USD Coin stablecoin',
      category: 'assets',
      defaultData: {
        assetType: 'USDC',
        allocation: 50,
      },
    },
    {
      id: 'asset-custom',
      type: 'asset',
      label: 'Custom Token',
      description: 'Any Stellar token',
      category: 'assets',
      defaultData: {
        assetType: 'CUSTOM',
        assetCode: '',
        assetIssuer: '',
        allocation: 0,
      },
    },
    // Conditions
    {
      id: 'condition-allocation',
      type: 'condition',
      label: 'Allocation Check',
      description: 'Trigger when allocation exceeds threshold',
      category: 'conditions',
      defaultData: {
        conditionType: 'allocation',
        operator: 'gt',
        threshold: 60,
      },
    },
    {
      id: 'condition-apy',
      type: 'condition',
      label: 'APY Threshold',
      description: 'Trigger based on yield rate',
      category: 'conditions',
      defaultData: {
        conditionType: 'apy_threshold',
        operator: 'lt',
        threshold: 5,
      },
    },
    {
      id: 'condition-time',
      type: 'condition',
      label: 'Time-Based',
      description: 'Trigger at regular intervals',
      category: 'conditions',
      defaultData: {
        conditionType: 'time_based',
        timeValue: 24,
        timeUnit: 'hours',
      },
    },
    {
      id: 'condition-price',
      type: 'condition',
      label: 'Price Change',
      description: 'Trigger on price movement',
      category: 'conditions',
      defaultData: {
        conditionType: 'price_change',
        operator: 'gt',
        value: 10,
      },
    },
    // Actions
    {
      id: 'action-rebalance',
      type: 'action',
      label: 'Rebalance',
      description: 'Rebalance portfolio to target allocations',
      category: 'actions',
      defaultData: {
        actionType: 'rebalance',
      },
    },
    {
      id: 'action-stake',
      type: 'action',
      label: 'Stake',
      description: 'Stake assets in protocol',
      category: 'actions',
      defaultData: {
        actionType: 'stake',
        protocol: '',
      },
    },
    {
      id: 'action-liquidity',
      type: 'action',
      label: 'Provide Liquidity',
      description: 'Add liquidity to DEX pool',
      category: 'actions',
      defaultData: {
        actionType: 'provide_liquidity',
        protocol: '',
      },
    },
    {
      id: 'action-swap',
      type: 'action',
      label: 'Swap',
      description: 'Swap between assets',
      category: 'actions',
      defaultData: {
        actionType: 'swap',
        targetAsset: '',
      },
    },
  ];

  const categories = [
    { id: 'assets', label: 'Assets', icon: Coins, color: 'text-blue-500' },
    { id: 'conditions', label: 'Conditions', icon: TrendingUp, color: 'text-purple-500' },
    { id: 'actions', label: 'Actions', icon: Repeat, color: 'text-orange-500' },
  ];

  const handleDragStart = (event: React.DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Block Palette
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Drag blocks onto the canvas
        </p>
      </div>

      <div className="p-2">
        {categories.map((category) => {
          const Icon = category.icon;
          const isExpanded = expandedCategories.has(category.id);
          const categoryItems = paletteItems.filter(
            (item) => item.category === category.id
          );

          return (
            <div key={category.id} className="mb-2">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${category.color}`} />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {category.label}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {isExpanded && (
                <div className="ml-2 mt-1 space-y-1">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      onClick={() => onBlockSelect(item)}
                      className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded cursor-move hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all"
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white">
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {item.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-4">
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <p><strong>Tip:</strong> Drag blocks to the canvas</p>
          <p>Connect blocks to create rules</p>
          <p>Asset → Condition → Action</p>
        </div>
      </div>
    </div>
  );
};

export default BlockPalette;
