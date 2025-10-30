import { useState } from "react";
import { createPortal } from "react-dom";
import { Text } from "@stellar/design-system";
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

  if (!address) {
    return (
      <Button 
        variant="primary" 
        size="md" 
        onClick={() => void connectWallet()}
        isLoading={isPending}
        className="inline-flex items-center gap-2 bg-[#dce85d] hover:bg-[#e8f06d] text-[#090a0a] px-4 py-2 rounded-lg text-sm font-medium transition"
      >
        <Wallet size={16} />
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

      {showDisconnectModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowDisconnectModal(false)}
          />
          
          {/* Modal Content */}
          <div 
            className="relative w-full max-w-sm mx-4 p-6 rounded-lg bg-card border border-default shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
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
                  void disconnectWallet().then(() => {
                    setShowDisconnectModal(false);
                    // Force page reload to ensure clean state
                    window.location.reload();
                  });
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
        </div>,
        document.body
      )}

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
