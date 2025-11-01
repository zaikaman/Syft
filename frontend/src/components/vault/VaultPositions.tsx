import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Loader2, TrendingUp, Droplets, Coins } from 'lucide-react';

interface StakingPosition {
  id: number;
  vault_id: string;
  contract_address: string;
  staking_pool: string;
  original_token: string;
  staked_amount: string;
  st_token_amount: string;
  timestamp: string;
  created_at: string;
}

interface LiquidityPosition {
  id: number;
  vault_id: string;
  contract_address: string;
  pool_address: string;
  token_a: string;
  token_b: string;
  lp_tokens: string;
  amount_a_provided: string;
  amount_b_provided: string;
  timestamp: string;
  created_at: string;
}

interface VaultPositionsProps {
  vaultId: string;
}

export const VaultPositions: React.FC<VaultPositionsProps> = ({ vaultId }) => {
  const [loading, setLoading] = useState(true);
  const [stakingPositions, setStakingPositions] = useState<StakingPosition[]>([]);
  const [liquidityPositions, setLiquidityPositions] = useState<LiquidityPosition[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPositions();
  }, [vaultId]);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/vaults/${vaultId}/positions`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch positions');
      }

      const result = await response.json();
      
      if (result.success) {
        setStakingPositions(result.data.staking || []);
        setLiquidityPositions(result.data.liquidity || []);
      }
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load positions');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: string, decimals: number = 7): string => {
    try {
      const num = parseInt(amount) / Math.pow(10, decimals);
      return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    } catch {
      return '0';
    }
  };

  const formatDate = (timestamp: string): string => {
    try {
      return new Date(timestamp).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const shortenAddress = (address: string): string => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-600">Loading positions...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-red-600">
          <p>Error: {error}</p>
          <button
            onClick={fetchPositions}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  const hasPositions = stakingPositions.length > 0 || liquidityPositions.length > 0;

  if (!hasPositions) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-gray-500">
          <Coins className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No active positions</p>
          <p className="text-sm mt-2">
            Create rules with "stake" or "liquidity" actions to see positions here
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Staking Positions */}
      {stakingPositions.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <TrendingUp className="h-5 w-5 text-purple-500 mr-2" />
            <h3 className="text-lg font-semibold">Staking Positions</h3>
            <span className="ml-auto bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">
              {stakingPositions.length} Active
            </span>
          </div>

          <div className="space-y-4">
            {stakingPositions.map((position) => (
              <div
                key={position.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Staked Amount</p>
                    <p className="font-semibold">
                      {formatAmount(position.staked_amount)} {shortenAddress(position.original_token)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Liquid Staking Tokens</p>
                    <p className="font-semibold text-purple-600">
                      {formatAmount(position.st_token_amount)} stTokens
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Staking Pool</p>
                    <p className="text-sm font-mono">{shortenAddress(position.staking_pool)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Staked On</p>
                    <p className="text-sm">{formatDate(position.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Liquidity Positions */}
      {liquidityPositions.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <Droplets className="h-5 w-5 text-blue-500 mr-2" />
            <h3 className="text-lg font-semibold">Liquidity Positions</h3>
            <span className="ml-auto bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
              {liquidityPositions.length} Active
            </span>
          </div>

          <div className="space-y-4">
            {liquidityPositions.map((position) => (
              <div
                key={position.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Token A Provided</p>
                    <p className="font-semibold">
                      {formatAmount(position.amount_a_provided)} {shortenAddress(position.token_a)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Token B Provided</p>
                    <p className="font-semibold">
                      {formatAmount(position.amount_b_provided)} {shortenAddress(position.token_b)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">LP Tokens</p>
                    <p className="text-sm font-semibold text-blue-600">
                      {formatAmount(position.lp_tokens)} LP
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Pool Address</p>
                    <p className="text-sm font-mono">{shortenAddress(position.pool_address)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Provided On</p>
                    <p className="text-sm">{formatDate(position.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default VaultPositions;
