// T035: Zustand store for wallet state management
// Purpose: Global state for wallet connection and authentication

import { create } from 'zustand';

export interface WalletBalance {
  assetCode: string;
  assetIssuer?: string;
  balance: string;
  limit?: string;
}

interface WalletState {
  // Connection state
  isConnected: boolean;
  address: string | null;
  publicKey: string | null;
  walletType: string | null; // 'freighter', 'albedo', etc.
  
  // Balance state
  balances: WalletBalance[];
  nativeBalance: string;
  
  // Loading states
  isConnecting: boolean;
  isLoadingBalances: boolean;
  
  // Actions
  connect: (address: string, walletType: string) => void;
  disconnect: () => void;
  setBalances: (balances: WalletBalance[]) => void;
  updateBalance: (assetCode: string, balance: string) => void;
  setLoadingBalances: (loading: boolean) => void;
}

export const useWalletStore = create<WalletState>()((set) => ({
  // Initial state
  isConnected: false,
  address: null,
  publicKey: null,
  walletType: null,
  balances: [],
  nativeBalance: '0',
  isConnecting: false,
  isLoadingBalances: false,

  // Actions
  connect: (address, walletType) =>
    set({
      isConnected: true,
      address,
      publicKey: address,
      walletType,
      isConnecting: false,
    }),

  disconnect: () =>
    set({
      isConnected: false,
      address: null,
      publicKey: null,
      walletType: null,
      balances: [],
      nativeBalance: '0',
    }),

  setBalances: (balances) => {
    // Extract native balance (XLM)
    const nativeAsset = balances.find((b) => b.assetCode === 'native' || b.assetCode === 'XLM');
    set({
      balances,
      nativeBalance: nativeAsset?.balance || '0',
      isLoadingBalances: false,
    });
  },

  updateBalance: (assetCode, balance) =>
    set((state) => ({
      balances: state.balances.map((b) =>
        b.assetCode === assetCode ? { ...b, balance } : b
      ),
      nativeBalance: assetCode === 'XLM' || assetCode === 'native' ? balance : state.nativeBalance,
    })),

  setLoadingBalances: (loading) =>
    set({ isLoadingBalances: loading }),
}));
