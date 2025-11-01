// T137: NFT purchase flow with profit share information
// Purpose: Handle NFT subscription with profit share information

import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface PurchaseNFTProps {
  listingId: string;
  nftName: string;
  vaultName: string;
  profitSharePercentage: number;
  vaultPerformance: number;
  vaultTotalValue: number;
  onPurchaseSuccess?: () => void;
}

export function PurchaseNFT({
  listingId,
  nftName,
  vaultName,
  profitSharePercentage,
  vaultPerformance,
  vaultTotalValue,
  onPurchaseSuccess,
}: PurchaseNFTProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Calculate profit share potential
  const monthlyProjection = (vaultTotalValue * (vaultPerformance / 100)) / 12;

  const handlePurchase = async () => {
    setError('');
    setIsPurchasing(true);

    try {
      const walletAddress = localStorage.getItem('walletAddress');
      if (!walletAddress) {
        throw new Error('Please connect your wallet first');
      }

      // In production, this would trigger a wallet transaction
      // For now, we'll just call the API
      const response = await fetch('/api/marketplace/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId,
          buyerAddress: walletAddress,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Purchase failed');
      }

      // Success
      setIsOpen(false);
      if (onPurchaseSuccess) {
        onPurchaseSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to purchase NFT');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="primary" size="lg">
        Buy NFT
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Purchase Vault NFT"
      >
        <Card className="p-6">
          <div className="space-y-6">
            {/* NFT Info */}
            <div>
              <h3 className="text-xl font-bold mb-2">{nftName}</h3>
              <p className="text-gray-600">{vaultName}</p>
            </div>

            {/* Subscription Details */}
            <div className="border-t border-b py-4 space-y-3">
              <h4 className="font-bold">Subscription Details</h4>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Profit Share to Creator:</span>
                <span className="font-bold text-blue-600">
                  {profitSharePercentage}%
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">You Keep:</span>
                <span className="font-bold text-green-600">
                  {100 - profitSharePercentage}%
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Current Vault Value:</span>
                <span className="font-medium">
                  ${vaultTotalValue.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Vault Performance:</span>
                <span
                  className={`font-medium ${
                    vaultPerformance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {vaultPerformance >= 0 ? '+' : ''}
                  {vaultPerformance.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Profit Projection */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
              <h4 className="font-bold mb-3">Estimated Monthly Returns</h4>
              <p className="text-sm text-gray-600 mb-2">
                Based on current vault performance (you keep {100 - profitSharePercentage}%)
              </p>
              <p className="text-2xl font-bold text-blue-600">
                ${(monthlyProjection * (100 - profitSharePercentage) / 100) >= 0 ? (monthlyProjection * (100 - profitSharePercentage) / 100).toFixed(2) : '0.00'}
                <span className="text-sm text-gray-600 ml-2">/ month</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                * Past performance does not guarantee future results
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm">Benefits of Subscription</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Copy proven vault strategies automatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Automatic yield distribution</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Tradeable on marketplace anytime</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Transparent on-chain ownership</span>
                </li>
              </ul>
            </div>

            {/* Agreement Checkbox */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="agreement"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="agreement" className="text-sm text-gray-600 cursor-pointer">
                I understand that cryptocurrency investments carry risk, and past performance
                does not guarantee future results. I have reviewed the vault details and
                agree to the purchase terms.
              </label>
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
                disabled={isPurchasing}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePurchase}
                variant="primary"
                disabled={isPurchasing || !agreed}
                className="flex-1"
              >
                {isPurchasing ? 'Processing...' : 'Subscribe to Strategy'}
              </Button>
            </div>
          </div>
        </Card>
      </Modal>
    </>
  );
}
