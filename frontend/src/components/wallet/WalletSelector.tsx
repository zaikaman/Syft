// T038: Wallet selection modal
// Purpose: Modal showing supported Stellar wallets (Freighter, Albedo, etc.)

import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ExternalLink, AlertCircle } from 'lucide-react';

interface WalletOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  installUrl?: string;
}

const SUPPORTED_WALLETS: WalletOption[] = [
  {
    id: 'freighter',
    name: 'Freighter',
    description: 'The most popular Stellar wallet browser extension',
    icon: '🚀',
    installUrl: 'https://www.freighter.app/',
  },
  {
    id: 'xbull',
    name: 'xBull',
    description: 'Feature-rich Stellar wallet with mobile support',
    icon: '🐂',
    installUrl: 'https://xbull.app/',
  },
  {
    id: 'albedo',
    name: 'Albedo',
    description: 'Web-based Stellar wallet, no installation needed',
    icon: '⭐',
  },
  {
    id: 'lobstr',
    name: 'LOBSTR',
    description: 'Mobile-first Stellar wallet with WalletConnect',
    icon: '🦞',
    installUrl: 'https://lobstr.co/',
  },
];

interface WalletSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (walletId: string) => Promise<void>;
  error?: string | null;
}

export const WalletSelector = ({ isOpen, onClose, onSelect, error }: WalletSelectorProps) => {
  const handleSelect = async (walletId: string) => {
    await onSelect(walletId);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect Wallet">
      <div className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Info message */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-300">
            Select a wallet to connect to Syft. Make sure your wallet is unlocked and connected to the correct network.
          </p>
        </div>

        {/* Wallet options */}
        <div className="space-y-3">
          {SUPPORTED_WALLETS.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => handleSelect(wallet.id)}
              className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-lg transition-all duration-200 text-left group"
            >
              <div className="flex items-center gap-4">
                {/* Wallet icon */}
                <div className="text-4xl">{wallet.icon}</div>

                {/* Wallet info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white group-hover:text-purple-400 transition-colors">
                    {wallet.name}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">{wallet.description}</p>
                </div>

                {/* Install link */}
                {wallet.installUrl && (
                  <a
                    href={wallet.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                    title="Install wallet"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Help text */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-gray-500 text-center">
            New to Stellar wallets?{' '}
            <a
              href="https://www.stellar.org/learn/wallets"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Learn more
            </a>
          </p>
        </div>

        {/* Cancel button */}
        <Button variant="outline" fullWidth onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
};
