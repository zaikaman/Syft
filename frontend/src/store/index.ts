// T035: Zustand store index - Export all stores
// Purpose: Central export point for all Zustand stores

export { useWalletStore } from './walletStore';
export type { WalletBalance } from './walletStore';

export { useVaultStore } from './vaultStore';

export { useUIStore } from './uiStore';
export type { Toast, ToastType } from './uiStore';

// Re-export types from shared
export type {
  VaultConfig,
  VaultState,
  VaultStrategy,
  VaultMetrics,
  UserVaultPosition,
} from '../../../shared/types/vault';

export type {
  VaultTransaction,
  TransactionStatus,
  GasEstimate,
} from '../../../shared/types/transaction';
