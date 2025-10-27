import { useState, useEffect } from "react";
import { Text, Modal } from "@stellar/design-system";
import { Wallet, LogOut, RefreshCw, Copy, Check } from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { connectWallet, disconnectWallet } from "../util/wallet";
import { Button } from "./ui";

export const WalletButton = () => {
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const { address, isPending } = useWallet();
  const { xlm, isLoading: isLoadingBalance, error: balanceError, updateBalance } = useWalletBalance();
  const buttonLabel = isPending ? "Connecting..." : "Connect Wallet";
  
  // Log balance state for debugging
  console.log("[WalletButton] Balance state:", { xlm, isLoadingBalance, balanceError, address });

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Style to override Modal backdrop opacity
  useEffect(() => {
    if (showDisconnectModal) {
      const style = document.createElement('style');
      style.textContent = `
        #modalContainer + * > div:first-child {
          background-color: rgba(0, 0, 0, 0.3) !important;
          backdrop-filter: blur(4px) !important;
        }
      `;
      style.id = 'modal-backdrop-style';
      document.head.appendChild(style);
      return () => {
        const existingStyle = document.getElementById('modal-backdrop-style');
        if (existingStyle) existingStyle.remove();
      };
    }
  }, [showDisconnectModal]);

  if (!address) {
    return (
      <Button 
        variant="gradient" 
        size="md" 
        onClick={() => void connectWallet()}
        leftIcon={<Wallet size={18} />}
        isLoading={isPending}
      >
        {buttonLabel}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
        <Text as="div" size="sm" className="text-gray-300">
          {isLoadingBalance ? (
            <span className="text-gray-400">Loading...</span>
          ) : balanceError ? (
            <span className="text-red-400" title={balanceError.message}>Error loading balance</span>
          ) : (
            <span className="text-purple-400 font-semibold">{xlm} XLM</span>
          )}
        </Text>
        <button
          onClick={() => void updateBalance()}
          disabled={isLoadingBalance}
          className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
          title="Refresh balance"
        >
          <RefreshCw size={14} className={isLoadingBalance ? "animate-spin" : ""} />
        </button>
      </div>

      <div id="modalContainer">
        <Modal
          visible={showDisconnectModal}
          onClose={() => setShowDisconnectModal(false)}
          parentId="modalContainer"
        >
          <div className="w-full max-w-sm p-6 rounded-2xl bg-gradient-to-b from-gray-900/95 to-black/95 backdrop-blur-sm border border-white/10 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/30 mb-4">
                <Wallet className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Connected Wallet</h2>
              <p className="text-sm text-gray-400">You are connected to your Stellar wallet</p>
            </div>

            {/* Address Card */}
            <div className="mb-6 p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Wallet Address</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="flex-1 text-sm font-mono text-white break-all">
                  {address}
                </code>
                <button
                  onClick={handleCopyAddress}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white" />
                  )}
                </button>
              </div>
            </div>

            {/* Balance Section */}
            <div className="mb-6 p-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-400">XLM Balance</span>
                <button
                  onClick={() => void updateBalance()}
                  disabled={isLoadingBalance}
                  className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                  title="Refresh balance"
                >
                  <RefreshCw size={14} className={isLoadingBalance ? "animate-spin" : ""} />
                </button>
              </div>
              <div className="mt-2">
                {isLoadingBalance ? (
                  <div className="text-sm text-gray-400">Loading...</div>
                ) : balanceError ? (
                  <div className="text-sm text-red-400">Error loading balance</div>
                ) : (
                  <div className="text-2xl font-bold text-purple-400">{xlm} XLM</div>
                )}
              </div>
            </div>

            {/* Status Indicator */}
            <div className="mb-6 p-3 rounded-lg bg-green-500/10 border border-green-500/20 backdrop-blur-sm flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-green-400 font-medium">Connected & Active</span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                size="md"
                variant="primary"
                className="w-full justify-center"
                leftIcon={<LogOut size={18} />}
                onClick={() => {
                  void disconnectWallet().then(() =>
                    setShowDisconnectModal(false),
                  );
                }}
              >
                Disconnect Wallet
              </Button>
              <Button
                size="md"
                variant="ghost"
                className="w-full justify-center"
                onClick={() => {
                  setShowDisconnectModal(false);
                }}
              >
                Keep Connected
              </Button>
            </div>
          </div>
        </Modal>
      </div>

      <button
        onClick={() => setShowDisconnectModal(true)}
        className="px-4 py-2 rounded-lg bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 transition-all flex items-center gap-2 group"
      >
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm font-medium text-white">
          {address.slice(0, 4)}...{address.slice(-4)}
        </span>
      </button>
    </div>
  );
};
