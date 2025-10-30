// T134: Marketplace listing creation form
// Purpose: Allow NFT holders to list their NFTs for sale with profit-sharing model

import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

interface NFT {
  nft_id: string;
  vault_id: string;
  ownership_pct: number;
  metadata: {
    name: string;
    description: string;
    imageUrl?: string;
  };
}

interface CreateListingProps {
  nftId?: string;
  onListingCreated?: (listingId: string) => void;
}

export function CreateListing({ nftId, onListingCreated }: CreateListingProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userNFTs, setUserNFTs] = useState<NFT[]>([]);
  const [selectedNFT, setSelectedNFT] = useState<string>(nftId || '');
  const [profitSharePercentage, setProfitSharePercentage] = useState('10');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && !nftId) {
      loadUserNFTs();
    }
  }, [isOpen, nftId]);

  const loadUserNFTs = async () => {
    try {
      const walletAddress = localStorage.getItem('walletAddress');
      if (!walletAddress) return;

      // Fetch user's NFTs
      const response = await fetch(`/api/wallet/${walletAddress}/nfts`);
      const data = await response.json();

      if (data.success) {
        setUserNFTs(data.data);
      }
    } catch (err) {
      console.error('Error loading NFTs:', err);
    }
  };

  const handleCreateListing = async () => {
    setError('');
    setIsLoading(true);

    try {
      const walletAddress = localStorage.getItem('walletAddress');
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      if (!selectedNFT) {
        throw new Error('Please select an NFT');
      }

      const profitShareNum = parseFloat(profitSharePercentage);
      if (isNaN(profitShareNum) || profitShareNum <= 0 || profitShareNum > 100) {
        throw new Error('Please enter a valid profit share percentage (1-100)');
      }

      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/marketplace/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nftId: selectedNFT,
          profitSharePercentage: profitShareNum,
          sellerAddress: walletAddress,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create listing');
      }

      // Success
      setIsOpen(false);
      setSelectedNFT('');
      setProfitSharePercentage('10');

      if (onListingCreated) {
        onListingCreated(data.data.listing_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedNFTData = userNFTs.find(nft => nft.nft_id === selectedNFT);

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="primary">
        List NFT for Sale
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Create Marketplace Listing"
      >
        <Card className="p-6">
          <div className="space-y-4">
            {/* NFT Selection */}
            {!nftId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select NFT *
                </label>
                <select
                  value={selectedNFT}
                  onChange={(e) => setSelectedNFT(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select an NFT --</option>
                  {userNFTs.map((nft) => (
                    <option key={nft.nft_id} value={nft.nft_id}>
                      {nft.metadata.name} ({nft.ownership_pct / 100}% ownership)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* NFT Preview */}
            {selectedNFTData && (
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex items-start gap-4">
                  {selectedNFTData.metadata.imageUrl && (
                    <img
                      src={selectedNFTData.metadata.imageUrl}
                      alt={selectedNFTData.metadata.name}
                      className="w-20 h-20 rounded-md object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium">{selectedNFTData.metadata.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedNFTData.metadata.description}
                    </p>
                    <p className="text-sm font-medium text-blue-600 mt-2">
                      {selectedNFTData.ownership_pct / 100}% Ownership
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Profit Share Percentage Input */}
            <div>
              <label className="block text-sm font-medium text-neutral-200 mb-1">
                Profit Share Percentage *
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={profitSharePercentage}
                  onChange={(e) => setProfitSharePercentage(e.target.value)}
                  placeholder="10"
                  step="1"
                  min="1"
                  max="100"
                  className="flex-1 px-3 py-2 bg-neutral-900 border border-default rounded-md text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-neutral-400 text-sm">%</span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Percentage of profits subscribers will share with you (1-100%)
              </p>
            </div>

            {/* Profit Sharing Model Info */}
            <div className="bg-primary-500/10 border border-primary-500/30 p-4 rounded-md">
              <h4 className="font-medium text-sm mb-2 text-neutral-50">Profit Sharing Model</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Your profit share:</span>
                  <span className="font-medium text-primary-400">{profitSharePercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Subscriber keeps:</span>
                  <span className="font-medium text-neutral-50">{100 - parseFloat(profitSharePercentage || '0')}%</span>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-3">
                Subscribers will clone your vault strategy and share {profitSharePercentage}% of their profits with you ongoing.
              </p>
            </div>

            {/* Terms */}
            <div className="text-xs text-neutral-500">
              <p>
                By listing your NFT, you agree to our marketplace terms. Subscribers will clone your vault strategy and share profits with you.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-error-500/10 border border-error-500/30 text-error-400 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setIsOpen(false)}
                variant="outline"
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateListing}
                variant="primary"
                disabled={isLoading || !selectedNFT || !profitSharePercentage}
                className="flex-1"
              >
                {isLoading ? 'Creating...' : 'Create Listing'}
              </Button>
            </div>
          </div>
        </Card>
      </Modal>
    </>
  );
}
