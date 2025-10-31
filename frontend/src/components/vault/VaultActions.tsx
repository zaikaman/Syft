import React, { useState } from 'react';
import { useWallet } from '../../hooks/useWallet';
import { useWalletBalance } from '../../hooks/useWalletBalance';
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
  const { address, network, networkPassphrase } = useWallet();
  const { updateBalance } = useWalletBalance();
  const modal = useModal();
  const [amount, setAmount] = useState('');
  const [shares, setShares] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Map Freighter network names to our backend format
  const normalizeNetwork = (net?: string, passphrase?: string): string => {
    if (!net) return 'testnet';
    
    // Check network passphrase for accurate detection
    if (passphrase) {
      if (passphrase.includes('Test SDF Future')) return 'futurenet';
      if (passphrase.includes('Test SDF Network')) return 'testnet';
      if (passphrase.includes('Public Global')) return 'mainnet';
    }
    
    // Fallback to network name mapping
    const normalized = net.toLowerCase();
    if (normalized === 'standalone' || normalized === 'futurenet') return 'futurenet';
    if (normalized === 'testnet') return 'testnet';
    if (normalized === 'mainnet' || normalized === 'public') return 'mainnet';
    
    return 'testnet'; // Default fallback
  };

  const handleDeposit = async () => {
    if (!address || !amount) {
      modal.message('Please enter an amount', 'Invalid Input', 'warning');
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // Convert XLM to stroops (1 XLM = 10,000,000 stroops)
      const amountInStroops = Math.floor(parseFloat(amount) * 10_000_000).toString();
      
      // Normalize the network name for backend
      const normalizedNetwork = normalizeNetwork(network, networkPassphrase);
      console.log(`[VaultActions] Using network: ${normalizedNetwork} (raw: ${network}, passphrase: ${networkPassphrase})`);
      
      // Get XLM token address for the network (user is depositing XLM)
      const xlmAddresses: { [key: string]: string } = {
        'testnet': 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        'futurenet': 'CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT',
        'mainnet': 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
      };
      const depositToken = xlmAddresses[normalizedNetwork] || xlmAddresses['testnet'];
      console.log(`[VaultActions] Depositing with token: ${depositToken} (XLM)`);
      
      // Step 1: Build unsigned transaction from backend
      console.log(`[VaultActions] Building unsigned deposit transaction...`);
      const buildResponse = await fetch(
        `http://localhost:3001/api/vaults/${vaultId}/build-deposit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userAddress: address,
            amount: amountInStroops,
            network: normalizedNetwork,
            depositToken: depositToken,
          }),
        }
      );

      const buildData = await buildResponse.json();

      if (!buildResponse.ok || !buildData.success) {
        throw new Error(buildData.error || 'Failed to build transaction');
      }

      const { xdr } = buildData.data;
      console.log(`[VaultActions] Transaction built, requesting wallet signature...`);

      // Step 2: Sign transaction with user's wallet
      const { wallet } = await import('../../util/wallet');
      const { signedTxXdr } = await wallet.signTransaction(xdr, {
        networkPassphrase: networkPassphrase || 'Test SDF Network ; September 2015',
      });

      console.log(`[VaultActions] Transaction signed, submitting...`);

      // Step 3: Submit signed transaction
      const submitResponse = await fetch(
        `http://localhost:3001/api/vaults/${vaultId}/submit-deposit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            signedXDR: signedTxXdr,
            network: normalizedNetwork,
            userAddress: address,
            amount: amountInStroops,
          }),
        }
      );

      const submitData = await submitResponse.json();

      if (!submitResponse.ok || !submitData.success) {
        throw new Error(submitData.error || 'Failed to submit transaction');
      }

      console.log(`[VaultActions] ✅ Deposit successful! TX: ${submitData.data.transactionHash}`);

      setMessage({
        type: 'success',
        text: `Successfully deposited ${amount} XLM!`,
      });
      modal.message(
        `Successfully deposited ${amount} XLM!`,
        'Deposit Complete',
        'success'
      );
      setAmount('');
      
      // Refresh wallet balance immediately and again after a delay
      await updateBalance();
      setTimeout(async () => {
        await updateBalance();
      }, 3000);
      
      onActionComplete?.('deposit', submitData.data);
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
      // Convert shares to stroops (1 share = 10,000,000 stroops, same as XLM)
      const sharesInStroops = Math.floor(parseFloat(shares) * 10_000_000).toString();
      
      // Normalize the network name for backend
      const normalizedNetwork = normalizeNetwork(network, networkPassphrase);
      console.log(`[VaultActions] Withdraw using network: ${normalizedNetwork}`);
      console.log(`[VaultActions] Withdrawing ${shares} shares (${sharesInStroops} stroops)`);
      
      // Step 1: Build unsigned transaction from backend
      console.log(`[VaultActions] Building unsigned withdrawal transaction...`);
      const buildResponse = await fetch(
        `http://localhost:3001/api/vaults/${vaultId}/build-withdraw`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userAddress: address,
            shares: sharesInStroops,
            network: normalizedNetwork,
          }),
        }
      );

      const buildData = await buildResponse.json();

      if (!buildResponse.ok || !buildData.success) {
        throw new Error(buildData.error || 'Failed to build transaction');
      }

      const { xdr } = buildData.data;
      console.log(`[VaultActions] Transaction built, requesting wallet signature...`);

      // Step 2: Sign transaction with user's wallet
      const { wallet } = await import('../../util/wallet');
      const { signedTxXdr } = await wallet.signTransaction(xdr, {
        networkPassphrase: networkPassphrase || 'Test SDF Network ; September 2015',
      });

      console.log(`[VaultActions] Transaction signed, submitting...`);

      // Step 3: Submit signed transaction
      const submitResponse = await fetch(
        `http://localhost:3001/api/vaults/${vaultId}/submit-withdraw`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            signedXDR: signedTxXdr,
            network: normalizedNetwork,
            userAddress: address,
            shares: sharesInStroops,
          }),
        }
      );

      const submitData = await submitResponse.json();

      if (!submitResponse.ok || !submitData.success) {
        throw new Error(submitData.error || 'Failed to submit transaction');
      }

      console.log(`[VaultActions] ✅ Withdrawal successful! TX: ${submitData.data.transactionHash}`);

      setMessage({
        type: 'success',
        text: `Successfully withdrawn ${shares} shares!`,
      });
      modal.message(
        `Successfully withdrawn ${shares} shares!`,
        'Withdrawal Complete',
        'success'
      );
      setShares('');
      
      // Refresh wallet balance immediately and again after a delay
      await updateBalance();
      setTimeout(async () => {
        await updateBalance();
      }, 3000);
      
      onActionComplete?.('withdraw', submitData.data);
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
      <div className="bg-card border border-default rounded-lg p-6">
        <p className="text-neutral-400 text-center">
          Please connect your wallet to interact with the vault
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-default rounded-lg p-6">
      <h2 className="text-xl font-bold mb-6 text-neutral-50">Vault Actions</h2>

      {/* Message Display */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-success-400/10 border-success-400 text-success-400'
              : 'bg-error-400/10 border-error-400 text-error-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Deposit Section */}
        <div>
          <h3 className="text-base font-semibold mb-3 text-neutral-50">Deposit Assets</h3>
          <div className="flex gap-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="flex-1 px-4 py-3 bg-input border border-default rounded-lg text-neutral-50 placeholder:text-neutral-500 focus:outline-none focus:border-primary-500 transition-colors"
              disabled={isProcessing}
            />
            <button
              onClick={handleDeposit}
              disabled={isProcessing || !amount}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                isProcessing || !amount
                  ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                  : 'bg-primary-500 text-dark-950 hover:bg-primary-600 hover:shadow-lg'
              }`}
            >
              Deposit
            </button>
          </div>
          <p className="text-sm text-neutral-400 mt-2">
            Deposit assets to receive vault shares
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-default"></div>

        {/* Withdraw Section */}
        <div>
          <h3 className="text-base font-semibold mb-3 text-neutral-50">Withdraw Assets</h3>
          <div className="flex gap-3">
            <input
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="Enter shares"
              className="flex-1 px-4 py-3 bg-input border border-default rounded-lg text-neutral-50 placeholder:text-neutral-500 focus:outline-none focus:border-primary-500 transition-colors"
              disabled={isProcessing}
            />
            <button
              onClick={handleWithdraw}
              disabled={isProcessing || !shares}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                isProcessing || !shares
                  ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                  : 'bg-error-400 text-white hover:bg-error-500 hover:shadow-lg'
              }`}
            >
              Withdraw
            </button>
          </div>
          <p className="text-sm text-neutral-400 mt-2">
            Burn vault shares to withdraw your assets
          </p>
        </div>
      </div>

      {isProcessing && (
        <div className="mt-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <p className="text-neutral-400 mt-2">Processing transaction...</p>
        </div>
      )}
    </div>
  );
};
