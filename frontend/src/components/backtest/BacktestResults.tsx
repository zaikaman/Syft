// T103: Backtest results visualization with Recharts
// Purpose: Display backtest performance metrics and charts

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface BacktestMetrics {
  totalReturn: number;
  totalReturnAmount: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  numRebalances: number;
  finalValue: number;
  buyAndHoldReturn: number;
}

interface BacktestResultsProps {
  metrics: BacktestMetrics;
  portfolioValueHistory: { timestamp: string; value: number }[];
  onExport?: () => void;
}

const BacktestResults: React.FC<BacktestResultsProps> = ({
  metrics,
  portfolioValueHistory,
  onExport,
}) => {
  // Format data for charts
  const chartData = portfolioValueHistory.map((point) => ({
    date: new Date(point.timestamp).toLocaleDateString(),
    value: point.value,
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getReturnColor = (value: number) => {
    return value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Backtest Results</h2>
        {onExport && (
          <button
            onClick={onExport}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-sm font-medium transition-colors"
          >
            Export Report
          </button>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Return"
          value={formatPercent(metrics.totalReturn)}
          color={getReturnColor(metrics.totalReturn)}
          subtitle={formatCurrency(metrics.totalReturnAmount)}
        />
        <MetricCard
          label="Annualized Return"
          value={formatPercent(metrics.annualizedReturn)}
          color={getReturnColor(metrics.annualizedReturn)}
        />
        <MetricCard
          label="Max Drawdown"
          value={formatPercent(metrics.maxDrawdown)}
          color="text-orange-600 dark:text-orange-400"
        />
        <MetricCard
          label="Sharpe Ratio"
          value={metrics.sharpeRatio.toFixed(2)}
          color="text-blue-600 dark:text-blue-400"
        />
        <MetricCard label="Win Rate" value={formatPercent(metrics.winRate)} />
        <MetricCard label="Volatility" value={formatPercent(metrics.volatility)} />
        <MetricCard label="Rebalances" value={metrics.numRebalances.toString()} />
        <MetricCard label="Final Value" value={formatCurrency(metrics.finalValue)} />
      </div>

      {/* Performance Comparison */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
          vs. Buy & Hold Strategy
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Your Strategy</p>
            <p className={`text-2xl font-bold ${getReturnColor(metrics.totalReturn)}`}>
              {formatPercent(metrics.totalReturn)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">Difference</p>
            <p className={`text-2xl font-bold ${getReturnColor(metrics.totalReturn - metrics.buyAndHoldReturn)}`}>
              {formatPercent(metrics.totalReturn - metrics.buyAndHoldReturn)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 dark:text-gray-400">Buy & Hold</p>
            <p className={`text-2xl font-bold ${getReturnColor(metrics.buyAndHoldReturn)}`}>
              {formatPercent(metrics.buyAndHoldReturn)}
            </p>
          </div>
        </div>
      </div>

      {/* Portfolio Value Chart */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
          Portfolio Value Over Time
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" tickFormatter={(value) => `$${value.toFixed(0)}`} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#F9FAFB',
              }}
              formatter={(value: number) => [formatCurrency(value), 'Portfolio Value']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Performance Insights */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-100">
          Performance Insights
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          {metrics.totalReturn > metrics.buyAndHoldReturn && (
            <li>✓ Your strategy outperformed buy-and-hold by {formatPercent(metrics.totalReturn - metrics.buyAndHoldReturn)}</li>
          )}
          {metrics.sharpeRatio > 1 && (
            <li>✓ Excellent risk-adjusted returns (Sharpe ratio: {metrics.sharpeRatio.toFixed(2)})</li>
          )}
          {metrics.winRate > 60 && (
            <li>✓ High win rate of {metrics.winRate.toFixed(0)}%</li>
          )}
          {metrics.maxDrawdown < 20 && (
            <li>✓ Low maximum drawdown of {metrics.maxDrawdown.toFixed(2)}%</li>
          )}
          {metrics.volatility < 30 && (
            <li>✓ Relatively low volatility at {metrics.volatility.toFixed(2)}%</li>
          )}
          {metrics.totalReturn < metrics.buyAndHoldReturn && (
            <li>⚠ Strategy underperformed buy-and-hold. Consider adjusting your rules.</li>
          )}
          {metrics.maxDrawdown > 30 && (
            <li>⚠ High maximum drawdown. Consider risk management improvements.</li>
          )}
        </ul>
      </div>
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  label: string;
  value: string;
  color?: string;
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  color = 'text-gray-900 dark:text-white',
  subtitle,
}) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
};

export default BacktestResults;
