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
  const [vaultData, setVaultData] = useState<{
    config: any;
    state: VaultState | null;
    performance: VaultPerformance;
  } | null>(null);

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
    fetchVaultData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchVaultData, 30000);
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
            Total Value
          </h3>
          <p className="text-3xl font-bold text-gray-900">
            {state
              ? parseFloat(state.totalValue).toLocaleString()
              : performance.currentValue.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {state?.totalShares || '0'} shares
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Net Return
          </h3>
          <p
            className={`text-3xl font-bold ${
              performance.netReturn >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {performance.netReturn >= 0 ? '+' : ''}
            {performance.netReturn.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {performance.returnPercentage >= 0 ? '+' : ''}
            {performance.returnPercentage.toFixed(2)}%
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
