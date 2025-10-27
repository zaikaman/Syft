// T035: Zustand store for UI state management
// Purpose: Global state for UI elements (modals, toasts, etc.)

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface Modal {
  id: string;
  component: string;
  props?: any;
}

interface UIStoreState {
  // Toast notifications
  toasts: Toast[];
  
  // Modals
  modals: Modal[];
  
  // Loading states
  globalLoading: boolean;
  loadingMessage: string | null;
  
  // Sidebar/Navigation
  sidebarOpen: boolean;
  
  // Actions - Toasts
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  
  // Actions - Modals
  openModal: (modal: Omit<Modal, 'id'>) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  
  // Actions - Loading
  setGlobalLoading: (loading: boolean, message?: string) => void;
  
  // Actions - Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  // Initial state
  toasts: [],
  modals: [],
  globalLoading: false,
  loadingMessage: null,
  sidebarOpen: true,

  // Toast Actions
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: Toast = { id, ...toast };
    
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    
    // Auto-remove after duration (default 5s)
    const duration = toast.duration || 5000;
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },
  
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  
  clearToasts: () => set({ toasts: [] }),

  // Modal Actions
  openModal: (modal) => {
    const id = Math.random().toString(36).substring(7);
    const newModal: Modal = { id, ...modal };
    set((state) => ({ modals: [...state.modals, newModal] }));
  },
  
  closeModal: (id) =>
    set((state) => ({
      modals: state.modals.filter((m) => m.id !== id),
    })),
  
  closeAllModals: () => set({ modals: [] }),

  // Loading Actions
  setGlobalLoading: (loading, message) =>
    set({ globalLoading: loading, loadingMessage: message || null }),

  // Sidebar Actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
