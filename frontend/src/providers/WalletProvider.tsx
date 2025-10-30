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
    const walletNetwork = storage.getItem("walletNetwork");
    const passphrase = storage.getItem("networkPassphrase");

    console.log("[WalletProvider] Polling - Storage:", { walletId, walletAddr, walletNetwork, passphrase });
    console.log("[WalletProvider] Polling - State:", { address: state.address, network: state.network });

    // If storage has wallet data, sync it to state
    if (walletId && walletAddr && walletNetwork && passphrase) {
      // User has connected wallet, sync to state
      console.log("[WalletProvider] Storage has wallet data, syncing to state");
      if (state.address !== walletAddr) {
        console.log("[WalletProvider] Updating state with address:", walletAddr);
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

    // Clear any persisted wallet data on initial mount ONLY
    // This ensures users must manually connect every time they load the page
    nullify();

    // Create recursive polling function to check wallet state continuously
    const pollWalletState = () => {
      if (!isMounted) return;

      updateCurrentWalletState();

      if (isMounted) {
        timer = setTimeout(() => void pollWalletState(), POLL_INTERVAL);
      }
    };

    // Start polling after clearing storage
    // This allows the polling to detect when user connects
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
