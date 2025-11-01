import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Image, AlertCircle } from 'lucide-react';

interface MintNFTModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultId: string;
  vaultName: string;
  onSuccess: () => void;
}

export function MintNFTModal({ isOpen, onClose, vaultId, vaultName, onSuccess }: MintNFTModalProps) {
  const [nftName, setNftName] = useState('');
  const [description, setDescription] = useState('');
  const [ownershipPct, setOwnershipPct] = useState(10);
  const [imageUrl, setImageUrl] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState('');

  const handleMint = async () => {
    setError('');
    setIsMinting(true);

    try {
      // Get wallet address
      const walletAddress = localStorage.getItem('walletAddress');
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      // Validate fields
      if (!nftName.trim()) {
        throw new Error('NFT name is required');
      }

      if (ownershipPct <= 0 || ownershipPct > 100) {
        throw new Error('Ownership percentage must be between 1 and 100');
      }

      // Convert percentage to basis points (10% = 1000)
      const ownershipBasisPoints = ownershipPct * 100;

      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/nfts/${vaultId}/nft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownershipPercentage: ownershipBasisPoints,
          metadata: {
            name: nftName,
            description: description || `${ownershipPct}% ownership of ${vaultName}`,
            imageUrl: imageUrl || '', // Backend will generate AI image if empty
            vaultPerformance: 0,
          },
          walletAddress,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to mint NFT');
      }

      // Success
      setNftName('');
      setDescription('');
      setImageUrl('');
      setOwnershipPct(10);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to mint NFT');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Card className="bg-secondary border-default">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-500/10 rounded-lg">
              <Image className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-50">Mint Vault NFT</h2>
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
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                NFT Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nftName}
                onChange={(e) => setNftName(e.target.value)}
                placeholder="e.g., Vault Strategy Share #1"
                className="w-full px-4 py-2 bg-app border border-default rounded-lg text-neutral-50 placeholder-neutral-500 focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description for this NFT"
                rows={3}
                className="w-full px-4 py-2 bg-app border border-default rounded-lg text-neutral-50 placeholder-neutral-500 focus:outline-none focus:border-primary-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Ownership Percentage <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={ownershipPct}
                  onChange={(e) => setOwnershipPct(Number(e.target.value))}
                  className="flex-1"
                />
                <div className="w-20 px-3 py-2 bg-app border border-default rounded-lg text-center">
                  <span className="text-lg font-bold text-primary-500">{ownershipPct}%</span>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                This NFT will represent {ownershipPct}% ownership of the vault
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Image URL (Optional)
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                className="w-full px-4 py-2 bg-app border border-default rounded-lg text-neutral-50 placeholder-neutral-500 focus:outline-none focus:border-primary-500"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Leave empty to use auto-generated image
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              onClick={onClose}
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
  );
}
