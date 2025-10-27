import React, { useState } from 'react';
import { useWallet } from '../../hooks/useWallet';
import { useModal } from '../ui';

interface VaultActionsProps {
  vaultId: string;
  contractAddress: string;
  onActionComplete?: (action: string, result: any) => void;
}

export const VaultActions: React.FC<VaultActionsProps> = ({
  vaultId,
  onActionComplete,
}) => {
  const { address } = useWallet();
  const modal = useModal();
  const [amount, setAmount] = useState('');
  const [shares, setShares] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleDeposit = async () => {
    if (!address || !amount) {
      modal.message('Please enter an amount', 'Invalid Input', 'warning');
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // Use connected wallet to sign transaction - no private key needed
      const response = await fetch(
        `http://localhost:3001/api/vaults/${vaultId}/deposit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userAddress: address,
            amount,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Deposit failed');
      }

      setMessage({
        type: 'success',
        text: `Successfully deposited ${amount}! Received ${data.data.shares} shares.`,
      });
      modal.message(
        `Successfully deposited ${amount}!\n\nReceived ${data.data.shares} shares.`,
        'Deposit Complete',
        'success'
      );
      setAmount('');
      onActionComplete?.('deposit', data.data);
    } catch (error) {
      const errorText = error instanceof Error ? error.message : 'Deposit failed';
      setMessage({
        type: 'error',
        text: errorText,
      });
      modal.message(errorText, 'Deposit Failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!address || !shares) {
      modal.message('Please enter shares amount', 'Invalid Input', 'warning');
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // Use connected wallet to sign transaction - no private key needed
      const response = await fetch(
        `http://localhost:3001/api/vaults/${vaultId}/withdraw`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userAddress: address,
            shares,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Withdrawal failed');
      }

      setMessage({
        type: 'success',
        text: `Successfully withdrawn! Received ${data.data.amount} tokens for ${shares} shares.`,
      });
      modal.message(
        `Successfully withdrawn!\n\nReceived ${data.data.amount} tokens for ${shares} shares.`,
        'Withdrawal Complete',
        'success'
      );
      setShares('');
      onActionComplete?.('withdraw', data.data);
    } catch (error) {
      const errorText = error instanceof Error ? error.message : 'Withdrawal failed';
      setMessage({
        type: 'error',
        text: errorText,
      });
      modal.message(errorText, 'Withdrawal Failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!address) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600 text-center">
          Please connect your wallet to interact with the vault
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Vault Actions</h2>

      {/* Message Display */}
      {message && (
        <div
          className={`mb-4 p-4 rounded ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Deposit Section */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Deposit Assets</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            />
            <button
              onClick={handleDeposit}
              disabled={isProcessing || !amount}
              className={`px-6 py-2 rounded-lg font-semibold text-white transition-colors ${
                isProcessing || !amount
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Deposit
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Deposit assets to receive vault shares
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200"></div>

        {/* Withdraw Section */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Withdraw Assets</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="Enter shares"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            />
            <button
              onClick={handleWithdraw}
              disabled={isProcessing || !shares}
              className={`px-6 py-2 rounded-lg font-semibold text-white transition-colors ${
                isProcessing || !shares
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Withdraw
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Burn vault shares to withdraw your assets
          </p>
        </div>
      </div>

      {isProcessing && (
        <div className="mt-4 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-2">Processing transaction...</p>
        </div>
      )}
    </div>
  );
};
