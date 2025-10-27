import { useState } from "react";
import { Text, Modal } from "@stellar/design-system";
import { Wallet, LogOut } from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { connectWallet, disconnectWallet } from "../util/wallet";
import { Button } from "./ui";

export const WalletButton = () => {
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const { address, isPending } = useWallet();
  const { xlm } = useWalletBalance();
  const buttonLabel = isPending ? "Connecting..." : "Connect Wallet";

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
      <div className="hidden md:block px-4 py-2 rounded-lg bg-white/5 border border-white/10">
        <Text as="div" size="sm" className="text-gray-300">
          <span className="text-purple-400 font-semibold">{xlm} XLM</span>
        </Text>
      </div>

      <div id="modalContainer">
        <Modal
          visible={showDisconnectModal}
          onClose={() => setShowDisconnectModal(false)}
          parentId="modalContainer"
        >
          <Modal.Heading>
            Connected as{" "}
            <code style={{ lineBreak: "anywhere" }}>{address}</code>. Do you
            want to disconnect?
          </Modal.Heading>
          <Modal.Footer itemAlignment="stack">
            <Button
              size="md"
              variant="primary"
              leftIcon={<LogOut size={18} />}
              onClick={() => {
                void disconnectWallet().then(() =>
                  setShowDisconnectModal(false),
                );
              }}
            >
              Disconnect
            </Button>
            <Button
              size="md"
              variant="ghost"
              onClick={() => {
                setShowDisconnectModal(false);
              }}
            >
              Cancel
            </Button>
          </Modal.Footer>
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
