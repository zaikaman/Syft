// T136: Vault detail page showing performance and ownership
// Purpose: Display comprehensive vault information for marketplace listings

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

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

  useEffect(() => {
    loadVaultDetails();
  }, [vaultId]);

  const loadVaultDetails = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
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
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Value</h3>
          <p className="text-3xl font-bold">
            ${(vault.performance?.currentValue || 0).toLocaleString(undefined, { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Performance</h3>
          <p
            className={`text-3xl font-bold ${
              (vault.performance?.returnPercentage || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {(vault.performance?.returnPercentage || 0) >= 0 ? '+' : ''}
            {(vault.performance?.returnPercentage || 0).toFixed(2)}%
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Tokenized</h3>
          <p className="text-3xl font-bold text-blue-600">
            {(totalOwnership / 100).toFixed(1)}%
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {nftHolders.length} NFT{nftHolders.length !== 1 ? 's' : ''}
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
