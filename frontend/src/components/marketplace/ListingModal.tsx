import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ShoppingBag, AlertCircle, Package } from 'lucide-react';

interface ListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultId: string;
  vaultName: string;
  vaultDescription?: string;
  contractAddress: string;
  onSuccess: () => void;
}

export function ListingModal({ 
  isOpen, 
  onClose, 
  vaultId, 
  vaultName,
  onSuccess 
}: ListingModalProps) {
  const [listingType, setListingType] = useState<'profit_share' | 'fixed_price'>('profit_share');
  const [profitSharePct, setProfitSharePct] = useState(5);
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('XLM');
  const [nfts, setNfts] = useState<any[]>([]);
  const [selectedNftId, setSelectedNftId] = useState<string>('');
  const [isListing, setIsListing] = useState(false);
  const [error, setError] = useState('');
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchVaultNFTs();
    }
  }, [isOpen, vaultId]);

  const fetchVaultNFTs = async () => {
    setIsLoadingNfts(true);
    try {
      const walletAddress = localStorage.getItem('walletAddress');
      if (!walletAddress) return;

      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/vaults/${vaultId}/nfts`);
      const data = await response.json();

      if (data.success) {
        // Filter to only show NFTs owned by current user
        const userNfts = data.data.filter((nft: any) => nft.holder_address === walletAddress);
        setNfts(userNfts);
        if (userNfts.length > 0) {
          setSelectedNftId(userNfts[0].nft_id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch NFTs:', err);
    } finally {
      setIsLoadingNfts(false);
    }
  };

  const handleList = async () => {
    setError('');
    setIsListing(true);

    try {
      // Get wallet address
      const walletAddress = localStorage.getItem('walletAddress');
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      // Validate based on listing type
      if (listingType === 'fixed_price') {
        if (!price || parseFloat(price) <= 0) {
          throw new Error('Valid price is required');
        }
      } else {
        if (profitSharePct <= 0 || profitSharePct > 100) {
          throw new Error('Profit share percentage must be between 1 and 100');
        }
      }

      // Check if NFT is selected
      if (!selectedNftId && nfts.length > 0) {
        throw new Error('Please select an NFT to list');
      }

      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      // Prepare listing data
      const listingData: any = {
        sellerAddress: walletAddress,
      };

      // If NFT selected, list the NFT
      if (selectedNftId) {
        listingData.nftId = selectedNftId;
      }

      if (listingType === 'fixed_price') {
        listingData.price = parseFloat(price);
        listingData.currency = currency;
      } else {
        listingData.profitSharePercentage = profitSharePct;
      }

      const response = await fetch(`${backendUrl}/api/marketplace/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(listingData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create listing');
      }

      // Success
      setPrice('');
      setProfitSharePct(5);
      setSelectedNftId('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setIsListing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Card className="bg-secondary border-default">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-500/10 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-50">List on Marketplace</h2>
              <p className="text-sm text-neutral-400">{vaultName}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* NFT Selection */}
            {isLoadingNfts ? (
              <div className="p-4 bg-app border border-default rounded-lg text-center">
                <p className="text-neutral-400">Loading your NFTs...</p>
              </div>
            ) : nfts.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Select NFT to List
                </label>
                <select
                  value={selectedNftId}
                  onChange={(e) => setSelectedNftId(e.target.value)}
                  className="w-full px-4 py-2 bg-app border border-default rounded-lg text-neutral-50 focus:outline-none focus:border-primary-500"
                >
                  {nfts.map((nft) => (
                    <option key={nft.nft_id} value={nft.nft_id}>
                      {nft.metadata?.name || nft.nft_id} ({nft.ownership_percentage}% ownership)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                <Package className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-400 font-medium mb-1">No NFTs found</p>
                  <p className="text-xs text-yellow-400/80">
                    You need to mint an NFT for this vault before listing on the marketplace.
                  </p>
                </div>
              </div>
            )}

            {/* Listing Type */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Listing Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setListingType('profit_share')}
                  className={`p-3 rounded-lg border transition-all ${
                    listingType === 'profit_share'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-default bg-app hover:border-primary-500/50'
                  }`}
                >
                  <p className="font-medium text-neutral-50 text-sm">Profit Share</p>
                  <p className="text-xs text-neutral-500 mt-1">Share future profits</p>
                </button>
                <button
                  onClick={() => setListingType('fixed_price')}
                  className={`p-3 rounded-lg border transition-all ${
                    listingType === 'fixed_price'
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-default bg-app hover:border-primary-500/50'
                  }`}
                >
                  <p className="font-medium text-neutral-50 text-sm">Fixed Price</p>
                  <p className="text-xs text-neutral-500 mt-1">Sell for set amount</p>
                </button>
              </div>
            </div>

            {/* Profit Share Input */}
            {listingType === 'profit_share' && (
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Profit Share Percentage
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={profitSharePct}
                    onChange={(e) => setProfitSharePct(Number(e.target.value))}
                    className="flex-1"
                  />
                  <div className="w-20 px-3 py-2 bg-app border border-default rounded-lg text-center">
                    <span className="text-lg font-bold text-primary-500">{profitSharePct}%</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  Buyers will receive {profitSharePct}% of vault profits
                </p>
              </div>
            )}

            {/* Fixed Price Input */}
            {listingType === 'fixed_price' && (
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Price
                </label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="flex-1 px-4 py-2 bg-app border border-default rounded-lg text-neutral-50 placeholder-neutral-500 focus:outline-none focus:border-primary-500"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-24 px-3 py-2 bg-app border border-default rounded-lg text-neutral-50 focus:outline-none focus:border-primary-500"
                  >
                    <option value="XLM">XLM</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={isListing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleList}
              variant="primary"
              disabled={isListing || nfts.length === 0}
              className="flex-1"
            >
              {isListing ? 'Listing...' : 'Create Listing'}
            </Button>
          </div>
        </div>
      </Card>
    </Modal>
  );
}
