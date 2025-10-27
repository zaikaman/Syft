import React from 'react';
import { Modal } from './Modal';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Button } from '../Button';

interface AlertModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  onClose: (confirmed?: boolean) => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  variant = 'info',
  onClose,
}) => {
  const iconVariants = {
    info: <Info className="w-6 h-6 text-info-400" />,
    success: <CheckCircle className="w-6 h-6 text-success-400" />,
    warning: <AlertTriangle className="w-6 h-6 text-warning-400" />,
    error: <AlertCircle className="w-6 h-6 text-error-400" />,
  };

  const bgVariants = {
    info: 'bg-info-400/10 border-info-400/20',
    success: 'bg-success-400/10 border-success-400/20',
    warning: 'bg-warning-400/10 border-warning-400/20',
    error: 'bg-error-400/10 border-error-400/20',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => onClose(false)}
      title={title}
      size="sm"
      closeButton={true}
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          {iconVariants[variant]}
        </div>
        <div className={`flex-1 p-4 rounded-lg border ${bgVariants[variant]}`}>
          <p className="text-text-primary text-sm leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button
          variant="primary"
          onClick={() => onClose(true)}
        >
          OK
        </Button>
      </div>
    </Modal>
  );
};
