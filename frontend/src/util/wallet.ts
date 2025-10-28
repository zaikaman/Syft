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
  await kit.openModal({
    modalTitle: "Connect to your wallet",
    onWalletSelected: (option: ISupportedWallet) => {
      const selectedId = option.id;
      kit.setWallet(selectedId);

      // Now open selected wallet's login flow by calling `getAddress` --
      // Yes, it's strange that a getter has a side effect of opening a modal
      void kit.getAddress().then((address) => {
        // Once `getAddress` returns successfully, we know they actually
        // connected the selected wallet, and we set our localStorage
        if (address.address) {
          storage.setItem("walletId", selectedId);
          storage.setItem("walletAddress", address.address);
        } else {
          storage.setItem("walletId", "");
          storage.setItem("walletAddress", "");
        }
      });
      if (selectedId == "freighter" || selectedId == "hot-wallet") {
        void kit.getNetwork().then((network) => {
          if (network.network && network.networkPassphrase) {
            storage.setItem("walletNetwork", network.network);
            storage.setItem("networkPassphrase", network.networkPassphrase);
          } else {
            storage.setItem("walletNetwork", "");
            storage.setItem("networkPassphrase", "");
          }
        });
      }
    },
  });
};

export const disconnectWallet = async () => {
  await kit.disconnect();
  storage.removeItem("walletId");
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
