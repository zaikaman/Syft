// T136: Vault detail page showing performance and ownership
// Purpose: Display comprehensive vault information for marketplace listings

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { VaultActions } from '../vault/VaultActions';

interface VaultDetailProps {
  vaultId: string;
  listingId?: string;
}

interface VaultData {
  vaultId: string;
  name?: string;
  description?: string;
  contractAddress: string;
  owner: string;
  config: any;
  status: string;
  state?: any;
  performance?: {
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
  };
  createdAt: string;
  updatedAt: string;
}

interface NFTHolder {
  nft_id: string;
  holder_address: string;
  ownership_pct: number;
  metadata: {
    name: string;
  };
}

export function VaultDetail({ vaultId, listingId }: VaultDetailProps) {
  const [vault, setVault] = useState<VaultData | null>(null);
  const [nftHolders, setNftHolders] = useState<NFTHolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [xlmPrice, setXlmPrice] = useState<number>(0.10); // Fallback price
  const [vaultAnalytics, setVaultAnalytics] = useState<any>(null);

  useEffect(() => {
    loadVaultDetails(true); // Initial load with loading state
    fetchXLMPrice();
    fetchVaultAnalytics();

    // Auto-refresh every 10 seconds for real-time updates (without loading state)
    const refreshInterval = setInterval(() => {
      loadVaultDetails(false); // Background refresh without loading state
      fetchVaultAnalytics();
    }, 10000);

    // Refresh XLM price every 60 seconds
    const priceInterval = setInterval(() => {
      fetchXLMPrice();
    }, 60000);

    // Cleanup intervals on unmount
    return () => {
      clearInterval(refreshInterval);
      clearInterval(priceInterval);
    };
  }, [vaultId]);

  const fetchXLMPrice = async () => {
    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/price/xlm`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.price) {
          setXlmPrice(data.price);
          console.log(`[VaultDetail] XLM Price: $${data.price.toFixed(4)}`);
        }
      }
    } catch (err) {
      console.error('[VaultDetail] Failed to fetch XLM price:', err);
      // Keep using fallback price
    }
  };

  const fetchVaultAnalytics = async () => {
    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/analytics/vault/${vaultId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVaultAnalytics(data.data);
          console.log(`[VaultDetail] Analytics:`, data.data);
        }
      }
    } catch (err) {
      console.error('[VaultDetail] Failed to fetch analytics:', err);
    }
  };

  const loadVaultDetails = async (showLoading: boolean = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setError('');

    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      // Load vault data
      const vaultResponse = await fetch(`${backendUrl}/api/vaults/${vaultId}`);
      const vaultData = await vaultResponse.json();

      if (!vaultData.success) {
        throw new Error(vaultData.error || 'Failed to load vault');
      }

      setVault(vaultData.data);

      // Load NFT holders
      const nftResponse = await fetch(`${backendUrl}/api/vaults/${vaultId}/nfts`);
      const nftData = await nftResponse.json();

      if (nftData.success) {
        setNftHolders(nftData.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load vault details');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const totalOwnership = nftHolders.reduce(
    (sum, holder) => sum + holder.ownership_pct,
    0
  );

  // Calculate TVL from vault state in stroops
  const calculateTVL = () => {
    if (!vault?.state?.totalValue) {
      // Fallback to performance data if state is not available
      return vault?.performance?.currentValue || 0;
    }
    
    const stateValue = Number(vault.state.totalValue);
    const xlmAmount = stateValue / 10_000_000; // Convert stroops to XLM
    return xlmAmount * xlmPrice; // Convert to USD
  };

  const tvlValue = calculateTVL();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !vault) {
    return (
      <Card className="p-8 text-center">
        <p className="text-red-600">{error || 'Vault not found'}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{vault.name || vault.config?.name || 'Unnamed Vault'}</h1>
            <p className="text-gray-600">{vault.description || vault.config?.description || 'No description'}</p>
          </div>
          <div className="text-right">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                vault.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {vault.status}
            </span>
          </div>
        </div>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Value Locked</h3>
          <p className="text-3xl font-bold">
            ${tvlValue.toLocaleString(undefined, { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}
          </p>
          {vault?.state?.totalValue && (
            <p className="text-xs text-gray-500 mt-2">
              {(Number(vault.state.totalValue) / 10_000_000).toFixed(7)} XLM @ ${xlmPrice.toFixed(4)}
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Current APY</h3>
          <p
            className={`text-3xl font-bold ${
              (vault.performance?.apyCurrent ?? vaultAnalytics?.apy ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {(vault.performance?.apyCurrent ?? vaultAnalytics?.apy) !== null && 
             (vault.performance?.apyCurrent ?? vaultAnalytics?.apy) !== undefined
              ? `${(vault.performance?.apyCurrent ?? vaultAnalytics?.apy) >= 0 ? '+' : ''}${(vault.performance?.apyCurrent ?? vaultAnalytics?.apy).toFixed(2)}%`
              : 'N/A'}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {(vault.performance?.apyCurrent ?? vaultAnalytics?.apy) ? 'Annualized Yield' : 'Not enough data'}
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Earnings</h3>
          <p className={`text-3xl font-bold ${
            (vaultAnalytics?.totalEarnings || 0) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            ${(vaultAnalytics?.totalEarnings || 0).toFixed(2)}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {vaultAnalytics?.earningsPercentage 
              ? `${vaultAnalytics.earningsPercentage.toFixed(2)}% ROI`
              : 'No earnings yet'}
          </p>
        </Card>
      </div>

      {/* Time-Based Returns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <h3 className="text-xs font-medium text-gray-500 mb-1">24h Return</h3>
          <p
            className={`text-xl font-bold ${
              (vault.performance?.returns24h ?? vaultAnalytics?.tvlChange24h ?? 0) >= 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {(vault.performance?.returns24h ?? vaultAnalytics?.tvlChange24h) !== null &&
             (vault.performance?.returns24h ?? vaultAnalytics?.tvlChange24h) !== undefined
              ? `${(vault.performance?.returns24h ?? vaultAnalytics?.tvlChange24h) >= 0 ? '+' : ''}${(
                  vault.performance?.returns24h ?? vaultAnalytics?.tvlChange24h
                ).toFixed(2)}%`
              : 'N/A'}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-xs font-medium text-gray-500 mb-1">7d Return</h3>
          <p
            className={`text-xl font-bold ${
              (vault.performance?.returns7d ?? vaultAnalytics?.tvlChange7d ?? 0) >= 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {(vault.performance?.returns7d ?? vaultAnalytics?.tvlChange7d) !== null &&
             (vault.performance?.returns7d ?? vaultAnalytics?.tvlChange7d) !== undefined
              ? `${(vault.performance?.returns7d ?? vaultAnalytics?.tvlChange7d) >= 0 ? '+' : ''}${(
                  vault.performance?.returns7d ?? vaultAnalytics?.tvlChange7d
                ).toFixed(2)}%`
              : 'N/A'}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-xs font-medium text-gray-500 mb-1">30d Return</h3>
          <p
            className={`text-xl font-bold ${
              (vault.performance?.returns30d ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {vault.performance?.returns30d !== null && vault.performance?.returns30d !== undefined
              ? `${vault.performance.returns30d >= 0 ? '+' : ''}${vault.performance.returns30d.toFixed(2)}%`
              : 'N/A'}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-xs font-medium text-gray-500 mb-1">All-Time</h3>
          <p
            className={`text-xl font-bold ${
              (vault.performance?.returnsAllTime ?? vault.performance?.returnPercentage ?? 0) >= 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {((vault.performance?.returnsAllTime !== null && vault.performance?.returnsAllTime !== undefined) ||
              (vault.performance?.returnPercentage !== null && vault.performance?.returnPercentage !== undefined))
              ? `${((vault.performance?.returnsAllTime ?? vault.performance?.returnPercentage) ?? 0) >= 0 ? '+' : ''}${((
                  vault.performance?.returnsAllTime ?? vault.performance?.returnPercentage
                ) ?? 0).toFixed(2)}%`
              : 'N/A'}
          </p>
        </Card>
      </div>

      {/* NFT Holders */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">NFT Ownership Distribution</h2>
        <div className="space-y-3">
          {nftHolders.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              No NFTs minted for this vault yet
            </p>
          ) : (
            nftHolders.map((holder) => (
              <div
                key={holder.nft_id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-md"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full" />
                  <div>
                    <p className="font-medium">{holder.metadata.name}</p>
                    <p className="text-sm text-gray-600">
                      {truncateAddress(holder.holder_address)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">
                    {(holder.ownership_pct / 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-600">ownership</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Ownership Progress Bar */}
        {totalOwnership > 0 && (
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Total Tokenized</span>
              <span className="font-medium">{(totalOwnership / 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all"
                style={{ width: `${Math.min(totalOwnership / 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Contract Details */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Contract Details</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Contract Address:</span>
            <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
              {truncateAddress(vault.contractAddress)}
            </code>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Created:</span>
            <span className="font-medium">{formatDate(vault.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Vault ID:</span>
            <code className="font-mono text-sm">{vault.vaultId}</code>
          </div>
        </div>
      </Card>

      {/* Vault Actions - Deposit/Withdraw */}
      <VaultActions 
        vaultId={vaultId}
        contractAddress={vault.contractAddress}
        onActionComplete={(action) => {
          console.log(`${action} completed, reloading vault...`);
          loadVaultDetails(false); // Update without showing loading state
          fetchVaultAnalytics(); // Refresh analytics too
        }}
      />

      {/* Action Button */}
      {listingId && (
        <div className="flex justify-center">
          <Button variant="primary" size="lg">
            View Listing Details
          </Button>
        </div>
      )}
    </div>
  );
}
