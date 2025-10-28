import React, { useEffect, useState } from 'react';

interface VaultState {
  totalShares: string;
  totalValue: string;
  lastRebalance: number;
  assetBalances: Array<{
    asset: string;
    balance: string;
    value: string;
  }>;
}

interface VaultPerformance {
  currentValue: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netReturn: number;
  returnPercentage: number;
  lastUpdated: string;
  returns24h?: number | null;
  returns7d?: number | null;
  returns30d?: number | null;
  returnsAllTime?: number | null;
  apyCurrent?: number | null;
}

interface VaultDashboardProps {
  vaultId: string;
  onRefresh?: () => void;
}

export const VaultDashboard: React.FC<VaultDashboardProps> = ({
  vaultId,
  onRefresh,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [xlmPrice, setXlmPrice] = useState<number>(0.10); // Fallback price
  const [vaultData, setVaultData] = useState<{
    config: any;
    state: VaultState | null;
    performance: VaultPerformance;
  } | null>(null);

  const fetchXLMPrice = async () => {
    try {
      const backendUrl = 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/price/xlm`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.price) {
          setXlmPrice(data.price);
        }
      }
    } catch (err) {
      console.error('[VaultDashboard] Failed to fetch XLM price:', err);
    }
  };

  const fetchVaultData = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `http://localhost:3001/api/vaults/${vaultId}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch vault data');
      }

      setVaultData({
        config: data.data.config,
        state: data.data.state,
        performance: data.data.performance,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vault data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchXLMPrice();
    fetchVaultData();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchXLMPrice();
      fetchVaultData();
    }, 30000);
    return () => clearInterval(interval);
  }, [vaultId]);

  const handleRefresh = () => {
    fetchVaultData();
    onRefresh?.();
  };

  if (loading && !vaultData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!vaultData) {
    return null;
  }

  const { config, state, performance } = vaultData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{config.name || 'Vault'}</h1>
            <p className="text-gray-600">Vault ID: {vaultId}</p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Total Value Locked
          </h3>
          <p className="text-3xl font-bold text-gray-900">
            ${state
              ? ((Number(state.totalValue) / 10_000_000) * xlmPrice).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : performance.currentValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {state ? (Number(state.totalValue) / 10_000_000).toFixed(7) : '0'} XLM @ ${xlmPrice.toFixed(4)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Current APY
          </h3>
          <p
            className={`text-3xl font-bold ${
              (performance.apyCurrent ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {performance.apyCurrent !== null && performance.apyCurrent !== undefined
              ? `${performance.apyCurrent >= 0 ? '+' : ''}${performance.apyCurrent.toFixed(2)}%`
              : 'N/A'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Annualized Yield
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Last Rebalance
          </h3>
          <p className="text-xl font-bold text-gray-900">
            {state?.lastRebalance
              ? new Date(state.lastRebalance).toLocaleDateString()
              : 'Never'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {state?.lastRebalance
              ? new Date(state.lastRebalance).toLocaleTimeString()
              : '—'}
          </p>
        </div>
      </div>

      {/* Time-Based Returns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            24h Return
          </h3>
          <p
            className={`text-2xl font-bold ${
              (performance.returns24h ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {performance.returns24h !== null && performance.returns24h !== undefined
              ? `${performance.returns24h >= 0 ? '+' : ''}${performance.returns24h.toFixed(2)}%`
              : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            7d Return
          </h3>
          <p
            className={`text-2xl font-bold ${
              (performance.returns7d ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {performance.returns7d !== null && performance.returns7d !== undefined
              ? `${performance.returns7d >= 0 ? '+' : ''}${performance.returns7d.toFixed(2)}%`
              : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            30d Return
          </h3>
          <p
            className={`text-2xl font-bold ${
              (performance.returns30d ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {performance.returns30d !== null && performance.returns30d !== undefined
              ? `${performance.returns30d >= 0 ? '+' : ''}${performance.returns30d.toFixed(2)}%`
              : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            All-Time Return
          </h3>
          <p
            className={`text-2xl font-bold ${
              (performance.returnsAllTime ?? performance.returnPercentage ?? 0) >= 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {(performance.returnsAllTime !== null && performance.returnsAllTime !== undefined
              ? performance.returnsAllTime
              : performance.returnPercentage
            ) !== undefined
              ? `${(performance.returnsAllTime ?? performance.returnPercentage) >= 0 ? '+' : ''}${(
                  performance.returnsAllTime ?? performance.returnPercentage
                ).toFixed(2)}%`
              : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Since inception</p>
        </div>
      </div>

      {/* Asset Balances */}
      {state && state.assetBalances && state.assetBalances.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Asset Allocation</h2>
          <div className="space-y-3">
            {state.assetBalances.map((asset, index) => {
              const totalValue = parseFloat(state.totalValue);
              const assetValue = parseFloat(asset.value);
              const percentage =
                totalValue > 0 ? (assetValue / totalValue) * 100 : 0;

              return (
                <div key={index} className="border-b pb-3 last:border-b-0">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">{asset.asset}</span>
                    <span className="text-sm text-gray-600">
                      {percentage.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Balance: {parseFloat(asset.balance).toLocaleString()}</span>
                    <span>Value: {parseFloat(asset.value).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strategy Rules */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Strategy Rules</h2>
        {config.rules && config.rules.length > 0 ? (
          <div className="space-y-3">
            {config.rules.map((rule: any, index: number) => (
              <div key={index} className="bg-gray-50 rounded p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold">Rule {index + 1}:</span>
                    <span className="ml-2">{rule.condition_type}</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {rule.action}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Threshold: {rule.threshold}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No rules configured</p>
        )}
      </div>
    </div>
  );
};
