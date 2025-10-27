// T035: Zustand store for vault management
// Purpose: Global state for vaults, builder, and deployment

import { create } from 'zustand';
import type { VaultConfig, VaultState, VaultStrategy } from '../../../shared/types/vault';

interface VaultStoreState {
  // Vault list
  vaults: VaultState[];
  isLoadingVaults: boolean;
  
  // Current vault being viewed/edited
  currentVault: VaultState | null;
  currentVaultConfig: VaultConfig | null;
  
  // Builder state
  builderStrategy: VaultStrategy | null;
  isDirty: boolean; // Has unsaved changes
  
  // Deployment state
  isDeploying: boolean;
  deploymentProgress: number;
  deploymentError: string | null;
  
  // Actions - Vault List
  setVaults: (vaults: VaultState[]) => void;
  addVault: (vault: VaultState) => void;
  updateVault: (vaultId: string, updates: Partial<VaultState>) => void;
  removeVault: (vaultId: string) => void;
  setLoadingVaults: (loading: boolean) => void;
  
  // Actions - Current Vault
  setCurrentVault: (vault: VaultState | null) => void;
  setCurrentVaultConfig: (config: VaultConfig | null) => void;
  
  // Actions - Builder
  setBuilderStrategy: (strategy: VaultStrategy | null) => void;
  updateBuilderStrategy: (updates: Partial<VaultStrategy>) => void;
  setDirty: (dirty: boolean) => void;
  clearBuilder: () => void;
  
  // Actions - Deployment
  setDeploying: (deploying: boolean) => void;
  setDeploymentProgress: (progress: number) => void;
  setDeploymentError: (error: string | null) => void;
  resetDeployment: () => void;
}

export const useVaultStore = create<VaultStoreState>((set) => ({
  // Initial state
  vaults: [],
  isLoadingVaults: false,
  currentVault: null,
  currentVaultConfig: null,
  builderStrategy: null,
  isDirty: false,
  isDeploying: false,
  deploymentProgress: 0,
  deploymentError: null,

  // Vault List Actions
  setVaults: (vaults) => set({ vaults, isLoadingVaults: false }),
  
  addVault: (vault) =>
    set((state) => ({ vaults: [...state.vaults, vault] })),
  
  updateVault: (vaultId, updates) =>
    set((state) => ({
      vaults: state.vaults.map((v) =>
        v.vaultId === vaultId ? { ...v, ...updates } : v
      ),
      currentVault:
        state.currentVault?.vaultId === vaultId
          ? { ...state.currentVault, ...updates }
          : state.currentVault,
    })),
  
  removeVault: (vaultId) =>
    set((state) => ({
      vaults: state.vaults.filter((v) => v.vaultId !== vaultId),
      currentVault:
        state.currentVault?.vaultId === vaultId ? null : state.currentVault,
    })),
  
  setLoadingVaults: (loading) => set({ isLoadingVaults: loading }),

  // Current Vault Actions
  setCurrentVault: (vault) => set({ currentVault: vault }),
  setCurrentVaultConfig: (config) => set({ currentVaultConfig: config }),

  // Builder Actions
  setBuilderStrategy: (strategy) => set({ builderStrategy: strategy, isDirty: false }),
  
  updateBuilderStrategy: (updates) =>
    set((state) => ({
      builderStrategy: state.builderStrategy
        ? { ...state.builderStrategy, ...updates }
        : null,
      isDirty: true,
    })),
  
  setDirty: (dirty) => set({ isDirty: dirty }),
  
  clearBuilder: () =>
    set({
      builderStrategy: null,
      isDirty: false,
    }),

  // Deployment Actions
  setDeploying: (deploying) => set({ isDeploying: deploying }),
  setDeploymentProgress: (progress) => set({ deploymentProgress: progress }),
  setDeploymentError: (error) => set({ deploymentError: error }),
  
  resetDeployment: () =>
    set({
      isDeploying: false,
      deploymentProgress: 0,
      deploymentError: null,
    }),
}));
