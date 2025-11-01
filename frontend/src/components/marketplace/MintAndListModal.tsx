import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Image, ShoppingBag, AlertCircle, Package, Check, X } from 'lucide-react';

interface MintAndListModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultId: string;
  vaultName: string;
  vaultDescription?: string;
  contractAddress: string;
  onSuccess: () => void;
}

export function MintAndListModal({ 
  isOpen, 
  onClose, 
  vaultId, 
  vaultName,
  vaultDescription: _vaultDescription,
  contractAddress: _contractAddress,
  onSuccess 
}: MintAndListModalProps) {
  // Step 1: Mint NFT, Step 2: List on Marketplace
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  
  // Mint NFT State
  const [nftName, setNftName] = useState('');
  const [description, setDescription] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  const [mintedNftId, setMintedNftId] = useState<string | null>(null);
  
  // Listing State
  const [profitSharePct, setProfitSharePct] = useState(5);
  const [existingNfts, setExistingNfts] = useState<any[]>([]);
  const [selectedNftId, setSelectedNftId] = useState<string>('');
  const [isListing, setIsListing] = useState(false);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
  
  const [error, setError] = useState('');
  const [skipMint, setSkipMint] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchExistingNFTs();
    }
  }, [isOpen, vaultId]);

  // Auto-select newly minted NFT
  useEffect(() => {
    if (mintedNftId) {
      setSelectedNftId(mintedNftId);
    }
  }, [mintedNftId]);

  const fetchExistingNFTs = async () => {
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
        setExistingNfts(userNfts);
        
        // If user has existing NFTs, allow skipping mint step
        if (userNfts.length > 0) {
          setSkipMint(true);
          setSelectedNftId(userNfts[0].nft_id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch NFTs:', err);
    } finally {
      setIsLoadingNfts(false);
    }
  };

  const handleMint = async () => {
    setError('');
    setIsMinting(true);

    try {
      const walletAddress = localStorage.getItem('walletAddress');
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      if (!nftName.trim()) {
        throw new Error('NFT name is required');
      }

      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/nfts/${vaultId}/nft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata: {
            name: nftName,
            description: description || `${vaultName} Strategy NFT`,
            imageUrl: '',
            vaultPerformance: 0,
            customPrompt: customPrompt || undefined,
          },
          walletAddress,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to mint NFT');
      }

      // Store the minted NFT ID and proceed to listing step
      setMintedNftId(data.data.nftId || data.data.id);
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to mint NFT');
    } finally {
      setIsMinting(false);
    }
  };

  const handleList = async () => {
    setError('');
    setIsListing(true);

    try {
      const walletAddress = localStorage.getItem('walletAddress');
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      if (profitSharePct <= 0 || profitSharePct > 100) {
        throw new Error('Profit share percentage must be between 1 and 100');
      }

      // Use minted NFT or selected existing NFT
      const nftToList = mintedNftId || selectedNftId;
      if (!nftToList) {
        throw new Error('Please select an NFT to list');
      }

      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/marketplace/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sellerAddress: walletAddress,
          profitSharePercentage: profitSharePct,
          nftId: nftToList,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create listing');
      }

      // Success - reset and close
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setIsListing(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setNftName('');
    setDescription('');
    setCustomPrompt('');
    setProfitSharePct(5);
    setMintedNftId(null);
    setSelectedNftId('');
    setError('');
    setSkipMint(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const goToListingStep = () => {
    setCurrentStep(2);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" closeButton={false}>
      <div className="bg-secondary border border-default rounded-lg">
        {/* Custom Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-neutral-800 rounded-lg transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-neutral-400 hover:text-neutral-200" />
        </button>

        <div className="p-5">
          {/* Compact Header */}
          <div className="mb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-500/10 rounded-lg flex-shrink-0">
                {currentStep === 1 ? (
                  <Image className="w-5 h-5 text-primary-500" />
                ) : (
                  <ShoppingBag className="w-5 h-5 text-primary-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-neutral-50 truncate">
                  {currentStep === 1 ? 'Mint NFT & List' : 'List on Marketplace'}
                </h2>
                <p className="text-xs text-neutral-400 truncate">{vaultName}</p>
              </div>
            </div>

            {/* Compact Step Progress */}
            <div className="flex items-center gap-2 mt-3">
              <div className={`flex items-center gap-1.5 flex-1 ${
                currentStep === 1 ? 'opacity-100' : 'opacity-50'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  mintedNftId || skipMint
                    ? 'bg-success-400 text-dark-950'
                    : currentStep === 1
                    ? 'bg-primary-500 text-dark-950'
                    : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {mintedNftId || (skipMint && existingNfts.length > 0) ? <Check className="w-3 h-3" /> : '1'}
                </div>
                <span className="text-xs font-medium text-neutral-300 truncate">Mint</span>
              </div>
              <div className="h-0.5 w-8 bg-neutral-700 flex-shrink-0"></div>
              <div className={`flex items-center gap-1.5 flex-1 ${
                currentStep === 2 ? 'opacity-100' : 'opacity-50'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  currentStep === 2
                    ? 'bg-primary-500 text-dark-950'
                    : 'bg-neutral-800 text-neutral-400'
                }`}>
                  2
                </div>
                <span className="text-xs font-medium text-neutral-300 truncate">List</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Step 1: Mint NFT */}
          {currentStep === 1 && (
            <div className="space-y-2.5">
              {/* Option to skip if NFTs exist */}
              {existingNfts.length > 0 && !isLoadingNfts && (
                <div className="p-2.5 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <Package className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-xs mb-0.5 text-neutral-50">
                        {existingNfts.length} existing NFT{existingNfts.length > 1 ? 's' : ''}
                      </h4>
                      <p className="text-xs text-neutral-400">
                        List existing or mint new
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={goToListingStep}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Skip to Listing
                  </Button>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  NFT Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nftName}
                  onChange={(e) => setNftName(e.target.value)}
                  placeholder="e.g., Vault Strategy Share #1"
                  className="w-full px-3 py-1.5 text-sm bg-app border border-default rounded-lg text-neutral-50 placeholder-neutral-500 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm bg-app border border-default rounded-lg text-neutral-50 placeholder-neutral-500 focus:outline-none focus:border-primary-500 resize-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Custom Image Prompt (Optional)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g., 'Add golden accents...'"
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm bg-app border border-default rounded-lg text-neutral-50 placeholder-neutral-500 focus:outline-none focus:border-primary-500 resize-none transition-colors"
                />
              </div>

              <div className="bg-neutral-900/50 border border-default p-2.5 rounded-md">
                <h4 className="font-medium text-xs mb-1 text-neutral-50 flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-primary-500" />
                  About Strategy NFTs
                </h4>
                <p className="text-xs text-neutral-400 leading-snug">
                  List this NFT on the marketplace with profit-sharing. Subscribers copy your strategy and share profits.
                </p>
              </div>

              <div className="flex gap-2 pt-1.5">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  disabled={isMinting}
                  className="flex-1"
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleMint}
                  variant="primary"
                  disabled={isMinting || !nftName.trim()}
                  isLoading={isMinting}
                  className="flex-1"
                  size="sm"
                >
                  {isMinting ? 'Minting...' : 'Mint & Continue'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: List on Marketplace */}
          {currentStep === 2 && (
            <div className="space-y-2.5">
              {/* Success message if just minted */}
              {mintedNftId && (
                <div className="p-2.5 bg-success-400/10 border border-success-400/30 rounded-lg flex items-start gap-2">
                  <Check className="w-4 h-4 text-success-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-success-400 font-medium">NFT Minted!</p>
                    <p className="text-xs text-success-400/80">Now list it on marketplace</p>
                  </div>
                </div>
              )}

              {/* NFT Selection */}
              {isLoadingNfts ? (
                <div className="p-2.5 bg-app border border-default rounded-lg text-center">
                  <p className="text-xs text-neutral-400">Loading...</p>
                </div>
              ) : (existingNfts.length > 0 || mintedNftId) ? (
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Select NFT to List
                  </label>
                  <select
                    value={selectedNftId}
                    onChange={(e) => setSelectedNftId(e.target.value)}
                    disabled={!!mintedNftId}
                    className="w-full px-3 py-1.5 text-sm bg-app border border-default rounded-lg text-neutral-50 focus:outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {mintedNftId && (
                      <option value={mintedNftId}>
                        {nftName} (Just Minted)
                      </option>
                    )}
                    {!mintedNftId && existingNfts.map((nft) => (
                      <option key={nft.nft_id} value={nft.nft_id}>
                        {nft.metadata?.name || nft.nft_id}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                  <Package className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-yellow-400 font-medium mb-0.5">No NFTs Available</p>
                    <p className="text-xs text-yellow-400/80">
                      Go back and mint an NFT first
                    </p>
                  </div>
                </div>
              )}

              {/* Profit Share Input */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Profit Share Percentage
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={profitSharePct}
                    onChange={(e) => setProfitSharePct(Number(e.target.value))}
                    className="flex-1 cursor-pointer"
                  />
                  <div className="w-14 px-2 py-1 bg-app border border-default rounded-lg text-center">
                    <span className="text-sm font-bold text-primary-500">{profitSharePct}%</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  You receive {profitSharePct}% of subscribers' profits
                </p>
              </div>

              {/* Info about listing */}
              <div className="bg-neutral-900/50 border border-default p-2.5 rounded-md">
                <h4 className="font-medium text-xs mb-1 text-neutral-50 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-primary-500" />
                  Marketplace Listing
                </h4>
                <p className="text-xs text-neutral-400 leading-snug">
                  Your strategy will be listed. Subscribers copy your vault and share {profitSharePct}% of their profits.
                </p>
              </div>

              <div className="flex gap-2 pt-1.5">
                <Button
                  onClick={() => setCurrentStep(1)}
                  variant="outline"
                  disabled={isListing}
                  className="flex-1"
                  size="sm"
                >
                  Back
                </Button>
                <Button
                  onClick={handleList}
                  variant="primary"
                  disabled={isListing || (!mintedNftId && !selectedNftId)}
                  isLoading={isListing}
                  className="flex-1"
                  size="sm"
                >
                  {isListing ? 'Creating...' : 'Create Listing'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
