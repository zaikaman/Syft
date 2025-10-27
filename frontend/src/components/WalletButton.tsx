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
        variant="primary" 
        size="md" 
        onClick={() => void connectWallet()}
        isLoading={isPending}
      >
        {buttonLabel}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-neutral-900 border border-default text-sm">
        <Text as="div" size="sm" className="text-neutral-300">
          {isLoadingBalance ? (
            <span className="text-neutral-400">Loading...</span>
          ) : balanceError ? (
            <span className="text-error-400" title={balanceError.message}>Error</span>
          ) : (
            <span className="text-neutral-50 font-medium">{xlm} XLM</span>
          )}
        </Text>
        <button
          onClick={() => void updateBalance()}
          disabled={isLoadingBalance}
          className="p-0.5 hover:bg-neutral-800 rounded transition-colors disabled:opacity-50"
          title="Refresh balance"
        >
          <RefreshCw size={12} className={isLoadingBalance ? "animate-spin" : ""} />
        </button>
      </div>

      <div id="modalContainer">
        <Modal
          visible={showDisconnectModal}
          onClose={() => setShowDisconnectModal(false)}
          parentId="modalContainer"
        >
          <div className="w-full max-w-sm p-6 rounded-lg bg-card border border-default shadow-lg">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary-500/10 border border-primary-500/20 mb-4">
                <Wallet className="w-6 h-6 text-primary-500" />
              </div>
              <h2 className="text-xl font-bold text-neutral-50 mb-2">Connected Wallet</h2>
              <p className="text-sm text-neutral-400">You are connected to your Stellar wallet</p>
            </div>

            {/* Address Card */}
            <div className="mb-4 p-4 rounded-lg bg-neutral-900 border border-default">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Wallet Address</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="flex-1 text-xs font-mono text-neutral-50 break-all">
                  {address}
                </code>
                <button
                  onClick={handleCopyAddress}
                  className="p-1.5 rounded-md hover:bg-neutral-800 transition-colors flex-shrink-0"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-success-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-neutral-400 hover:text-neutral-50" />
                  )}
                </button>
              </div>
            </div>

            {/* Balance Section */}
            <div className="mb-4 p-4 rounded-lg bg-neutral-900 border border-default">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-400">XLM Balance</span>
                <button
                  onClick={() => void updateBalance()}
                  disabled={isLoadingBalance}
                  className="p-1 hover:bg-neutral-800 rounded transition-colors disabled:opacity-50"
                  title="Refresh balance"
                >
                  <RefreshCw size={14} className={isLoadingBalance ? "animate-spin" : ""} />
                </button>
              </div>
              <div className="mt-2">
                {isLoadingBalance ? (
                  <div className="text-sm text-neutral-400">Loading...</div>
                ) : balanceError ? (
                  <div className="text-sm text-error-400">Error loading balance</div>
                ) : (
                  <div className="text-2xl font-bold text-primary-500">{xlm} XLM</div>
                )}
              </div>
            </div>

            {/* Status Indicator */}
            <div className="mb-6 p-3 rounded-lg bg-success-500/10 border border-success-500/20 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-success-400" />
              <span className="text-sm text-success-400 font-medium">Connected & Active</span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
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
        className="px-3 py-1.5 rounded-md bg-card border border-default hover:bg-hover hover:border-hover transition-all flex items-center gap-2"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-success-400" />
        <span className="text-sm font-medium text-neutral-50">
          {address.slice(0, 4)}...{address.slice(-4)}
        </span>
      </button>
    </div>
  );
};
