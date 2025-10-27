// T134: Marketplace listing creation form
// Purpose: Allow NFT holders to list their NFTs for sale

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
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('XLM');
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

      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        throw new Error('Please enter a valid price');
      }

      const response = await fetch('/api/marketplace/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nftId: selectedNFT,
          price: priceNum,
          currency,
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
      setPrice('');

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

            {/* Price Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="XLM">XLM</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>

            {/* Listing Fee Info */}
            <div className="bg-blue-50 p-4 rounded-md">
              <h4 className="font-medium text-sm mb-2">Listing Details</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Platform Fee:</span>
                  <span className="font-medium">2.5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">You'll receive:</span>
                  <span className="font-medium">
                    {price ? (parseFloat(price) * 0.975).toFixed(2) : '0.00'} {currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="text-xs text-gray-600">
              <p>
                By listing your NFT, you agree to our marketplace terms. Your NFT will be
                locked until sold or you cancel the listing.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
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
                disabled={isLoading || !selectedNFT || !price}
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
