// T104: Timeline view showing rule triggers and actions
// Purpose: Visualize when rules triggered during backtest

import React, { useState } from 'react';

interface AssetAllocation {
  assetCode: string;
  percentage: number;
}

interface BacktestTransaction {
  timestamp: string;
  type: 'deposit' | 'withdraw' | 'rebalance' | 'fee';
  description: string;
  portfolioValue: number;
  allocations: AssetAllocation[];
  triggeredRule?: string;
}

interface BacktestTimelineProps {
  timeline: BacktestTransaction[];
  maxItems?: number;
}

const BacktestTimeline: React.FC<BacktestTimelineProps> = ({ timeline, maxItems = 20 }) => {
  const [showAll, setShowAll] = useState(false);

  const displayedTimeline = showAll ? timeline : timeline.slice(0, maxItems);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return '💰';
      case 'withdraw':
        return '📤';
      case 'rebalance':
        return '⚖️';
      case 'fee':
        return '💸';
      default:
        return '📊';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
      case 'withdraw':
        return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
      case 'rebalance':
        return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
      case 'fee':
        return 'bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-700';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-700';
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Transaction Timeline
      </h2>

      <div className="space-y-4">
        {displayedTimeline.map((transaction, index) => (
          <div
            key={`${transaction.timestamp}-${index}`}
            className={`border-l-4 rounded-lg p-4 ${getTypeColor(transaction.type)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <span className="text-2xl">{getTypeIcon(transaction.type)}</span>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white capitalize">
                      {transaction.type}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(transaction.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    {transaction.description}
                  </p>
                  
                  {/* Show allocations for rebalance transactions */}
                  {transaction.type === 'rebalance' && transaction.allocations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {transaction.allocations.map((allocation) => (
                        <span
                          key={allocation.assetCode}
                          className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs font-medium"
                        >
                          {allocation.assetCode}: {allocation.percentage.toFixed(1)}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Portfolio Value</p>
                <p className="font-bold text-gray-900 dark:text-white">
                  {formatCurrency(transaction.portfolioValue)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show More/Less button */}
      {timeline.length > maxItems && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-4 w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-sm font-medium transition-colors"
        >
          {showAll ? 'Show Less' : `Show All (${timeline.length} transactions)`}
        </button>
      )}

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <StatCard
          label="Total Transactions"
          value={timeline.length.toString()}
        />
        <StatCard
          label="Rebalances"
          value={timeline.filter((t) => t.type === 'rebalance').length.toString()}
        />
        <StatCard
          label="Deposits"
          value={timeline.filter((t) => t.type === 'deposit').length.toString()}
        />
        <StatCard
          label="Withdrawals"
          value={timeline.filter((t) => t.type === 'withdraw').length.toString()}
        />
      </div>
    </div>
  );
};

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value }) => {
  return (
    <div className="text-center">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
};

export default BacktestTimeline;
