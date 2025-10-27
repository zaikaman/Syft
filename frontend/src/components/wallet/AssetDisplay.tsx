// T043: AssetDisplay component showing user balances
// Purpose: Display wallet assets with real-time balances from Horizon

import { useState, useEffect } from 'react';
import { Coins, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useWallet } from '../../hooks/useWallet';

interface AssetBalance {
  asset_code: string;
  asset_issuer?: string;
  asset_type: string;
  balance: string;
  limit?: string;
}

interface WalletAssets {
  address: string;
  balances: AssetBalance[];
  totalAssets: number;
  nativeBalance: string;
  fetchedAt: string;
}

export const AssetDisplay = () => {
  const { address } = useWallet();
  const [assets, setAssets] = useState<WalletAssets | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchAssets = async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/wallet/${address}/assets`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Account not funded yet');
        }
        throw new Error('Failed to fetch assets');
      }

      const data = await response.json();
      
      if (data.success) {
        setAssets(data.data);
        setLastFetch(new Date());
      } else {
        throw new Error(data.error || 'Failed to fetch assets');
      }
    } catch (err: any) {
      console.error('Asset fetch error:', err);
      setError(err.message || 'Failed to load asset balances');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch assets on mount and when address changes
  useEffect(() => {
    if (address) {
      fetchAssets();
    }
  }, [address]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!address) return;

    const interval = setInterval(() => {
      fetchAssets();
    }, 30000);

    return () => clearInterval(interval);
  }, [address]);

  if (!address) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-400">
          <Coins className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Connect your wallet to view assets</p>
        </div>
      </Card>
    );
  }

  if (isLoading && !assets) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
          <p className="text-red-400 mb-4">{error}</p>
          <Button variant="outline" onClick={fetchAssets}>
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  if (!assets) return null;

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.01) return num.toFixed(7);
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 7 
    });
  };

  const getAssetDisplay = (asset: AssetBalance) => {
    if (asset.asset_type === 'native') {
      return { code: 'XLM', name: 'Stellar Lumens' };
    }
    return { code: asset.asset_code, name: asset.asset_code };
  };

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Coins className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Your Assets</h2>
            <p className="text-sm text-gray-400">
              {assets.totalAssets} {assets.totalAssets === 1 ? 'asset' : 'assets'}
            </p>
          </div>
        </div>

        {/* Refresh button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchAssets}
          disabled={isLoading}
          title="Refresh balances"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Asset list */}
      <div className="space-y-3">
        {assets.balances.map((asset, index) => {
          const display = getAssetDisplay(asset);
          const balance = formatBalance(asset.balance);
          const isNative = asset.asset_type === 'native';

          return (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all duration-200"
            >
              {/* Asset info */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                  isNative ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {display.code.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-white">{display.code}</div>
                  <div className="text-xs text-gray-400">{display.name}</div>
                </div>
              </div>

              {/* Balance */}
              <div className="text-right">
                <div className="font-mono text-lg font-semibold text-white">
                  {balance}
                </div>
                {!isNative && asset.limit && (
                  <div className="text-xs text-gray-500">
                    Limit: {formatBalance(asset.limit)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {assets.balances.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No assets found in this wallet</p>
        </div>
      )}

      {/* Last updated */}
      {lastFetch && (
        <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500 text-center">
          Last updated: {lastFetch.toLocaleTimeString()}
        </div>
      )}
    </Card>
  );
};
