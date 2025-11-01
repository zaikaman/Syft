import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { wallet } from "../util/wallet";
import storage from "../util/storage";

export interface WalletContextType {
  address?: string;
  network?: string;
  networkPassphrase?: string;
  isPending: boolean;
  signTransaction?: typeof wallet.signTransaction;
}

const initialState = {
  address: undefined,
  network: undefined,
  networkPassphrase: undefined,
};

const POLL_INTERVAL = 1000;

export const WalletContext = // eslint-disable-line react-refresh/only-export-components
  createContext<WalletContextType>({ isPending: true });

// Export useWallet hook
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] =
    useState<Omit<WalletContextType, "isPending">>(initialState);
  const [isPending] = useState(false);
  const signTransaction = wallet.signTransaction.bind(wallet);

  const nullify = () => {
    updateState(initialState);
    storage.removeItem("walletId");
    storage.removeItem("walletAddress");
    storage.removeItem("walletNetwork");
    storage.removeItem("networkPassphrase");
  };

  const updateState = (newState: Omit<WalletContextType, "isPending">) => {
    setState((prev: Omit<WalletContextType, "isPending">) => {
      if (
        prev.address !== newState.address ||
        prev.network !== newState.network ||
        prev.networkPassphrase !== newState.networkPassphrase
      ) {
        return newState;
      }
      return prev;
    });
  };

  const updateCurrentWalletState = () => {
    // Check storage for wallet data
    const walletId = storage.getItem("walletId");
    const walletAddr = storage.getItem("walletAddress");
    const walletNetworkRaw = storage.getItem("walletNetwork");
    // Normalize network to lowercase (Freighter stores as 'TESTNET', we need 'testnet')
    const walletNetwork = walletNetworkRaw?.toLowerCase();
    const passphrase = storage.getItem("networkPassphrase");

    console.log("[WalletProvider] Polling - Storage:", { walletId, walletAddr, walletNetwork: walletNetworkRaw, passphrase });
    console.log("[WalletProvider] Polling - State:", { address: state.address, network: state.network });
    console.log("[WalletProvider] Normalized network:", walletNetwork);

    // If storage has wallet data, sync it to state
    if (walletId && walletAddr && walletNetwork && passphrase) {
      // User has connected wallet, sync to state
      console.log("[WalletProvider] Storage has wallet data, syncing to state");
      // Update if address, network, or passphrase changed
      if (state.address !== walletAddr || state.network !== walletNetwork || state.networkPassphrase !== passphrase) {
        console.log("[WalletProvider] Updating state - address:", walletAddr, "network:", walletNetwork);
        updateState({
          address: walletAddr,
          network: walletNetwork,
          networkPassphrase: passphrase,
        });
      }
    } else if (state.address) {
      // Storage is empty but state has address = user disconnected
      // Clear the state
      console.log("[WalletProvider] Storage empty but state has address - CLEARING STATE");
      updateState(initialState);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let isMounted = true;

    // Try to restore wallet connection from localStorage on mount
    // This allows the wallet to stay connected across page refreshes
    const restoreWalletConnection = async () => {
      const walletId = storage.getItem("walletId");
      const walletAddr = storage.getItem("walletAddress");
      const walletNetworkRaw = storage.getItem("walletNetwork");
      const walletNetwork = walletNetworkRaw?.toLowerCase();
      const passphrase = storage.getItem("networkPassphrase");

      console.log("[WalletProvider] Attempting to restore wallet connection:", { 
        walletId, 
        walletAddr, 
        walletNetwork,
        passphrase 
      });

      // If we have stored wallet data, try to reconnect
      if (walletId && walletAddr && walletNetwork && passphrase) {
        try {
          // Set the wallet in the kit to restore the connection
          wallet.setWallet(walletId);
          
          // Update state with restored wallet info
          updateState({
            address: walletAddr,
            network: walletNetwork,
            networkPassphrase: passphrase,
          });
          
          console.log("[WalletProvider] Wallet connection restored successfully");
        } catch (error) {
          console.error("[WalletProvider] Failed to restore wallet connection:", error);
          // If restoration fails, clear the storage
          nullify();
        }
      } else {
        console.log("[WalletProvider] No stored wallet data found");
      }
    };

    // Restore connection on mount
    void restoreWalletConnection();

    // Create recursive polling function to check wallet state continuously
    const pollWalletState = () => {
      if (!isMounted) return;

      updateCurrentWalletState();

      if (isMounted) {
        timer = setTimeout(() => void pollWalletState(), POLL_INTERVAL);
      }
    };

    // Start polling after attempting to restore
    timer = setTimeout(() => {
      if (isMounted) {
        pollWalletState();
      }
    }, POLL_INTERVAL);

    // Clear the timeout and stop polling when the component unmounts
    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- it SHOULD only run once per component mount

  const contextValue = useMemo(
    () => ({
      ...state,
      isPending,
      signTransaction,
    }),
    [state, isPending, signTransaction],
  );

  return <WalletContext value={contextValue}>{children}</WalletContext>;
};
