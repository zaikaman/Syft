import React from 'react';
import { Modal } from './Modal';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Button } from '../Button';

interface MessageModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  onClose: (confirmed?: boolean) => void;
}

export const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  title,
  message,
  variant = 'info',
  onClose,
}) => {
  const iconVariants = {
    info: <Info className="w-8 h-8 text-info-400" />,
    success: <CheckCircle className="w-8 h-8 text-success-400" />,
    warning: <AlertTriangle className="w-8 h-8 text-warning-400" />,
    error: <AlertCircle className="w-8 h-8 text-error-400" />,
  };

  const textColorVariants = {
    info: 'text-info-400',
    success: 'text-success-400',
    warning: 'text-warning-400',
    error: 'text-error-400',
  };

  const buttonVariants = {
    info: 'primary',
    success: 'primary',
    warning: 'warning',
    error: 'error',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => onClose(false)}
      title={title}
      size="md"
      closeButton={true}
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div className={textColorVariants[variant]}>
          {iconVariants[variant]}
        </div>
        <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
          {message}
        </p>
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <Button
          variant={buttonVariants[variant] as any}
          onClick={() => onClose(true)}
        >
          OK
        </Button>
      </div>
    </Modal>
  );
};
