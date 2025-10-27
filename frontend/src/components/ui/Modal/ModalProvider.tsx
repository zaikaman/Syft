import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { AlertModal } from './AlertModal.tsx';
import { ConfirmModal } from './ConfirmModal.tsx';
import { PromptModal } from './PromptModal.tsx';
import { MessageModal } from './MessageModal.tsx';

type ModalType = 'alert' | 'confirm' | 'prompt' | 'message';

interface ModalConfig {
  type: ModalType;
  title?: string;
  message?: string;
  text?: string;
  placeholder?: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  resolve?: (value?: any) => void;
  reject?: () => void;
}

interface ModalContextType {
  alert: (message: string, title?: string, variant?: 'info' | 'success' | 'warning' | 'error') => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
  prompt: (message: string, title?: string, defaultValue?: string) => Promise<string | null>;
  message: (title: string, message: string, variant?: 'info' | 'success' | 'warning' | 'error') => Promise<void>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [modals, setModals] = useState<ModalConfig[]>([]);

  const alert = useCallback((
    message: string,
    title?: string,
    variant: 'info' | 'success' | 'warning' | 'error' = 'info'
  ): Promise<void> => {
    return new Promise((resolve) => {
      setModals((prev) => [
        ...prev,
        {
          type: 'alert',
          title,
          message,
          variant,
          resolve: () => {
            setModals((prev) => prev.slice(1));
            resolve();
          },
        },
      ]);
    });
  }, []);

  const confirm = useCallback((
    message: string,
    title?: string
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setModals((prev) => [
        ...prev,
        {
          type: 'confirm',
          title,
          message,
          resolve: (value?: any) => {
            setModals((prev) => prev.slice(1));
            resolve(value as boolean);
          },
        },
      ]);
    });
  }, []);

  const prompt = useCallback((
    message: string,
    title?: string,
    defaultValue?: string
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setModals((prev) => [
        ...prev,
        {
          type: 'prompt',
          title,
          text: message,
          placeholder: defaultValue,
          resolve: (value?: any) => {
            setModals((prev) => prev.slice(1));
            resolve(value as string | null);
          },
        },
      ]);
    });
  }, []);

  const message = useCallback((
    title: string,
    messageText: string,
    variant: 'info' | 'success' | 'warning' | 'error' = 'info'
  ): Promise<void> => {
    return new Promise((resolve) => {
      setModals((prev) => [
        ...prev,
        {
          type: 'message',
          title,
          message: messageText,
          variant,
          resolve: () => {
            setModals((prev) => prev.slice(1));
            resolve();
          },
        },
      ]);
    });
  }, []);

  const currentModal = modals[0];

  return (
    <ModalContext.Provider value={{ alert, confirm, prompt, message }}>
      {children}
      {currentModal && (
        <>
          {currentModal.type === 'alert' && (
            <AlertModal
              isOpen={true}
              title={currentModal.title}
              message={currentModal.message || ''}
              variant={currentModal.variant as any}
              onClose={(confirmed?: boolean) => currentModal.resolve?.(confirmed)}
            />
          )}
          {currentModal.type === 'confirm' && (
            <ConfirmModal
              isOpen={true}
              title={currentModal.title}
              message={currentModal.message || ''}
              onConfirm={() => currentModal.resolve?.(true)}
              onCancel={() => currentModal.resolve?.(false)}
            />
          )}
          {currentModal.type === 'prompt' && (
            <PromptModal
              isOpen={true}
              title={currentModal.title}
              message={currentModal.text || ''}
              placeholder={currentModal.placeholder}
              onSubmit={(value: string) => currentModal.resolve?.(value)}
              onCancel={() => currentModal.resolve?.(null)}
            />
          )}
          {currentModal.type === 'message' && (
            <MessageModal
              isOpen={true}
              title={currentModal.title || 'Message'}
              message={currentModal.message || ''}
              variant={currentModal.variant as any}
              onClose={(confirmed?: boolean) => currentModal.resolve?.(confirmed)}
            />
          )}
        </>
      )}
    </ModalContext.Provider>
  );
};
