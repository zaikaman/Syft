// T138: Co-ownership dashboard showing shared vaults
// Purpose: Display all vaults where user holds NFT shares

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface NFTHolding {
  nft_id: string;
  vault_id: string;
  ownership_pct: number;
  metadata: {
    name: string;
    description: string;
    imageUrl?: string;
  };
  minted_at: string;
  vaults: {
    vault_id: string;
    name: string;
    description: string;
    total_value: number;
    performance: number;
    status: string;
  };
}

interface CoOwnershipDashboardProps {
  walletAddress?: string;
}

export function CoOwnershipDashboard({ walletAddress }: CoOwnershipDashboardProps) {
  const [holdings, setHoldings] = useState<NFTHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalEarnings, setTotalEarnings] = useState(0);

  useEffect(() => {
    loadHoldings();
  }, [walletAddress]);

  const loadHoldings = async () => {
    setIsLoading(true);
    setError('');

    try {
      const address = walletAddress || localStorage.getItem('walletAddress');
      if (!address) {
        throw new Error('Wallet not connected');
      }

      // Fetch NFT holdings
      const response = await fetch(`/api/wallet/${address}/nfts`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load holdings');
      }

      setHoldings(data.data);

      // Fetch total earnings
      const earningsResponse = await fetch(`/api/wallet/${address}/earnings`);
      const earningsData = await earningsResponse.json();

      if (earningsData.success) {
        setTotalEarnings(earningsData.data.totalEarnings);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load co-ownership data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const totalPortfolioValue = holdings.reduce((sum, holding) => {
    return sum + (holding.vaults.total_value * holding.ownership_pct) / 10000;
  }, 0);

  const avgPerformance =
    holdings.length > 0
      ? holdings.reduce((sum, h) => sum + h.vaults.performance, 0) / holdings.length
      : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-red-600">{error}</p>
        <Button onClick={loadHoldings} className="mt-4" variant="outline">
          Try Again
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Co-Ownership Portfolio</h2>
        <p className="text-gray-600 mt-1">
          Vaults where you hold fractional ownership through NFTs
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Holdings</h3>
          <p className="text-3xl font-bold">{holdings.length}</p>
          <p className="text-sm text-gray-500 mt-1">NFT{holdings.length !== 1 ? 's' : ''}</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Portfolio Value</h3>
          <p className="text-3xl font-bold">${totalPortfolioValue.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">Across all vaults</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Avg Performance</h3>
          <p
            className={`text-3xl font-bold ${
              avgPerformance >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {avgPerformance >= 0 ? '+' : ''}
            {avgPerformance.toFixed(2)}%
          </p>
          <p className="text-sm text-gray-500 mt-1">Weighted average</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Earnings</h3>
          <p className="text-3xl font-bold text-green-600">
            ${totalEarnings.toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mt-1">All-time</p>
        </Card>
      </div>

      {/* Holdings List */}
      {holdings.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <h3 className="text-xl font-bold mb-2">No NFT Holdings Yet</h3>
            <p className="text-gray-600 mb-6">
              Start building your portfolio by purchasing vault NFTs from the marketplace
            </p>
            <Button variant="primary">Browse Marketplace</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {holdings.map((holding) => (
            <Card key={holding.nft_id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-6">
                {/* NFT Image */}
                {holding.metadata.imageUrl ? (
                  <img
                    src={holding.metadata.imageUrl}
                    alt={holding.metadata.name}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500" />
                )}

                {/* Info */}
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{holding.metadata.name}</h3>
                      <p className="text-gray-600">{holding.vaults.name}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        holding.vaults.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {holding.vaults.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-gray-600">Ownership</p>
                      <p className="font-bold text-blue-600">
                        {(holding.ownership_pct / 100).toFixed(2)}%
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Your Share Value</p>
                      <p className="font-bold">
                        $
                        {(
                          (holding.vaults.total_value * holding.ownership_pct) /
                          10000
                        ).toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Vault Performance</p>
                      <p
                        className={`font-bold ${
                          holding.vaults.performance >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {holding.vaults.performance >= 0 ? '+' : ''}
                        {holding.vaults.performance.toFixed(2)}%
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">Acquired</p>
                      <p className="font-bold">{formatDate(holding.minted_at)}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <Button variant="outline" size="sm">
                      View Vault
                    </Button>
                    <Button variant="outline" size="sm">
                      Sell NFT
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
