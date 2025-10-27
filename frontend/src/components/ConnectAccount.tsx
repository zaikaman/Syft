import React from "react";
import { WalletButton } from "./WalletButton";
import NetworkPill from "./NetworkPill";

const ConnectAccount: React.FC = () => {
  return (
    <div className="flex flex-row items-center gap-3">
      <WalletButton />
      <NetworkPill />
    </div>
  );
};

export default ConnectAccount;
