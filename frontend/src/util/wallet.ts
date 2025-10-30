import storage from "./storage";
import {
  ISupportedWallet,
  StellarWalletsKit,
  WalletNetwork,
  sep43Modules,
} from "@creit.tech/stellar-wallets-kit";
import { Horizon } from "@stellar/stellar-sdk";
import { networkPassphrase, stellarNetwork, horizonUrl } from "../contracts/util";

const kit: StellarWalletsKit = new StellarWalletsKit({
  network: networkPassphrase as WalletNetwork,
  modules: sep43Modules(),
});

export const connectWallet = async () => {
  console.log("[connectWallet] Starting connection...");
  await kit.openModal({
    modalTitle: "Connect to your wallet",
    onWalletSelected: (option: ISupportedWallet) => {
      const selectedId = option.id;
      console.log("[connectWallet] Wallet selected:", selectedId);
      kit.setWallet(selectedId);

      // Now open selected wallet's login flow by calling `getAddress` --
      // Yes, it's strange that a getter has a side effect of opening a modal
      void kit.getAddress().then((address) => {
        // Once `getAddress` returns successfully, we know they actually
        // connected the selected wallet, and we set our localStorage
        console.log("[connectWallet] Got address:", address.address);
        if (address.address) {
          storage.setItem("walletId", selectedId);
          storage.setItem("walletAddress", address.address);
          console.log("[connectWallet] Saved walletId and address to storage");
        }
      });
      if (selectedId == "freighter" || selectedId == "hot-wallet") {
        void kit.getNetwork().then((network) => {
          console.log("[connectWallet] Got network:", network.network);
          if (network.network && network.networkPassphrase) {
            storage.setItem("walletNetwork", network.network);
            storage.setItem("networkPassphrase", network.networkPassphrase);
            console.log("[connectWallet] Saved network info to storage");
          }
        });
      }
    },
  });
};

export const disconnectWallet = async () => {
  console.log("[disconnectWallet] Starting disconnect...");
  
  // Disconnect from the wallet kit
  await kit.disconnect();
  
  // Clear all wallet-related storage
  console.log("[disconnectWallet] Clearing storage...");
  storage.removeItem("walletId");
  storage.removeItem("walletAddress");
  storage.removeItem("walletNetwork");
  storage.removeItem("networkPassphrase");
  
  // Verify storage is cleared
  console.log("[disconnectWallet] After clearing - walletId:", storage.getItem("walletId"));
  console.log("[disconnectWallet] After clearing - walletAddress:", storage.getItem("walletAddress"));
  console.log("[disconnectWallet] Disconnect complete");
};

export const fetchBalance = async (address: string, network?: string) => {
  // Determine Horizon URL based on network
  let networkHorizonUrl = horizonUrl;
  
  if (network) {
    const normalizedNetwork = network.toLowerCase();
    if (normalizedNetwork === 'futurenet' || normalizedNetwork === 'standalone') {
      networkHorizonUrl = 'https://horizon-futurenet.stellar.org';
    } else if (normalizedNetwork === 'testnet') {
      networkHorizonUrl = 'https://horizon-testnet.stellar.org';
    } else if (normalizedNetwork === 'mainnet' || normalizedNetwork === 'public') {
      networkHorizonUrl = 'https://horizon.stellar.org';
    }
  }
  
  console.log("[fetchBalance] Fetching balance for:", address);
  console.log("[fetchBalance] Using Horizon URL:", networkHorizonUrl);
  console.log("[fetchBalance] Network:", network || stellarNetwork);
  
  const horizon = new Horizon.Server(networkHorizonUrl, {
    allowHttp: (network || stellarNetwork) === "LOCAL" || networkHorizonUrl.startsWith("http://"),
  });

  try {
    const account = await horizon.accounts().accountId(address).call();
    console.log("[fetchBalance] Account data:", account);
    return account.balances;
  } catch (error) {
    console.error("[fetchBalance] Error fetching account:", error);
    throw error;
  }
};

export type Balance = Awaited<ReturnType<typeof fetchBalance>>[number];

export const wallet = kit;
