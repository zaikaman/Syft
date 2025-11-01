// T133: NFT minting interface in vault dashboard
// Purpose: Allow vault owners to mint NFTs for marketplace listing

import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

interface MintNFTProps {
  vaultId: string;
  vaultName: string;
  vaultPerformance: number;
  onMintSuccess?: (nftId: string) => void;
}

export function MintNFT({ vaultId, vaultName, vaultPerformance, onMintSuccess }: MintNFTProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [nftName, setNftName] = useState('');
  const [description, setDescription] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [error, setError] = useState('');

  const handleMint = async () => {
    setError('');
    setIsMinting(true);

    try {
      // Get wallet address from context or localStorage
      const walletAddress = localStorage.getItem('walletAddress');
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      // Validate fields
      if (!nftName.trim()) {
        throw new Error('NFT name is required');
      }

      const response = await fetch(`/api/vaults/${vaultId}/nft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata: {
            name: nftName,
            description: description || `${vaultName} Strategy NFT`,
            imageUrl: '', // Always let backend generate AI image
            vaultPerformance: vaultPerformance,
            customPrompt: customPrompt || undefined, // Include custom prompt if provided
          },
          walletAddress,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to mint NFT');
      }

      // Success
      setIsOpen(false);
      setNftName('');
      setDescription('');
      setCustomPrompt('');

      if (onMintSuccess) {
        onMintSuccess(data.data.nftId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to mint NFT');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="primary"
      >
        Mint Vault NFT
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Mint Vault NFT"
      >
        <Card className="p-6">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Create an NFT representing your vault strategy. You can list this on the marketplace
              to let others subscribe to your strategy with profit sharing.
            </p>

            {/* NFT Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NFT Name *
              </label>
              <input
                type="text"
                value={nftName}
                onChange={(e) => setNftName(e.target.value)}
                placeholder={`${vaultName} Strategy NFT`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description for the NFT"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Custom Image Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom Image Prompt (Optional)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="E.g., 'Add golden accents and futuristic holographic displays' or leave empty for auto-generated vault imagery"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Customize the AI-generated vault image. Leave empty for automatic vault-themed artwork.
              </p>
            </div>

            {/* Performance Info */}
            <div className="bg-blue-50 p-4 rounded-md">
              <h4 className="font-medium text-sm mb-2">Vault Performance</h4>
              <p className="text-2xl font-bold text-blue-600">
                {vaultPerformance >= 0 ? '+' : ''}{vaultPerformance.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">
                This will be displayed in your NFT metadata
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
                disabled={isMinting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleMint}
                variant="primary"
                disabled={isMinting || !nftName.trim()}
                className="flex-1"
              >
                {isMinting ? 'Minting...' : 'Mint NFT'}
              </Button>
            </div>
          </div>
        </Card>
      </Modal>
    </>
  );
}
