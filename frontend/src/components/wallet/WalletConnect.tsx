// T037, T044, T046: WalletConnect component with Stellar Wallet Kit
// Purpose: One-click wallet connection with error handling and disconnect functionality

import { useState } from 'react';
import { Wallet, LogOut, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { WalletSelector } from './WalletSelector';
import { useWallet } from '../../hooks/useWallet';
import { wallet } from '../../util/wallet';
import sessionManager from '../../lib/sessionManager';

export const WalletConnect = () => {
  const { address, network, isPending } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleConnect = () => {
    setError(null);
    setIsModalOpen(true);
  };

  const handleWalletSelect = async (walletId: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      // Set the selected wallet
      wallet.setWallet(walletId);

      // Request address and network from wallet
      const [addressData, networkData] = await Promise.all([
        wallet.getAddress(),
        wallet.getNetwork(),
      ]);

      if (!addressData.address) {
        throw new Error('Failed to get wallet address. Please make sure your wallet is unlocked.');
      }

      // Save session
      sessionManager.saveWalletSession({
        walletId,
        walletAddress: addressData.address,
        walletNetwork: networkData.network,
        networkPassphrase: networkData.networkPassphrase,
      });

      // Close modal on success
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      
      // User-friendly error messages
      let errorMessage = 'Failed to connect wallet. ';
      
      if (err.message?.includes('User rejected')) {
        errorMessage += 'You rejected the connection request.';
      } else if (err.message?.includes('not installed')) {
        errorMessage += 'Wallet extension not found. Please install it first.';
      } else if (err.message?.includes('unlocked')) {
        errorMessage += 'Please unlock your wallet and try again.';
      } else if (err.message?.includes('timeout')) {
        errorMessage += 'Connection timed out. Please try again.';
      } else {
        errorMessage += err.message || 'An unexpected error occurred.';
      }
      
      setError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setError(null);

    try {
      // Clear session storage
      sessionManager.clearWalletSession();

      // Optional: Disconnect from wallet if supported
      // Note: StellarWalletsKit doesn't have a disconnect method,
      // so we just clear our local state
      
      // Force page reload to reset state
      window.location.reload();
    } catch (err: any) {
      console.error('Disconnect error:', err);
      setError('Failed to disconnect wallet. Please try again.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getNetworkDisplay = () => {
    if (!network) return '';
    
    const networkMap: Record<string, string> = {
      FUTURENET: 'Futurenet',
      TESTNET: 'Testnet',
      PUBLIC: 'Mainnet',
    };
    
    return networkMap[network] || network;
  };

  // Show connecting state
  if (isConnecting || isPending) {
    return (
      <Button variant="outline" size="md" disabled>
        <Wallet className="w-4 h-4" />
        Connecting...
      </Button>
    );
  }

  // Show connected state
  if (address && !isPending) {
    return (
      <div className="flex items-center gap-3">
        {/* Network indicator */}
        <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{getNetworkDisplay()}</span>
          </div>
        </div>

        {/* Connected wallet address */}
        <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-white">
            <Wallet className="w-4 h-4 text-purple-400" />
            <span className="font-mono">{formatAddress(address)}</span>
          </div>
        </div>

        {/* Disconnect button */}
        <Button
          variant="ghost"
          size="md"
          onClick={handleDisconnect}
          isLoading={isDisconnecting}
          title="Disconnect wallet"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Show connect button
  return (
    <>
      <Button
        variant="gradient"
        size="md"
        onClick={handleConnect}
        leftIcon={<Wallet className="w-4 h-4" />}
      >
        Connect Wallet
      </Button>

      {/* Error message */}
      {error && (
        <div className="absolute top-full mt-2 right-0 max-w-md p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Wallet selector modal */}
      <WalletSelector
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleWalletSelect}
        error={error}
      />
    </>
  );
};
