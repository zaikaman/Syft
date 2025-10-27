import React, { useState } from 'react';
import { Modal } from './Modal';
import { Lock } from 'lucide-react';
import { Button } from '../Button';

interface PromptModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  type?: 'text' | 'password';
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  title = 'Enter value',
  message,
  placeholder,
  defaultValue = '',
  type = 'text',
  onSubmit,
  onCancel,
}) => {
  const [value, setValue] = useState(defaultValue);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = () => {
    onSubmit(value);
    setValue(defaultValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleCancel = () => {
    setValue(defaultValue);
    onCancel();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      size="sm"
      closeButton={true}
    >
      <div className="space-y-4">
        <p className="text-text-secondary text-sm">{message}</p>

        <div className="relative">
          {type === 'password' ? (
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoFocus
                className="w-full px-4 py-2 bg-white text-black border border-gray-300 rounded-lg placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-hover rounded transition-colors"
              >
                <Lock className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoFocus
              className="w-full px-4 py-2 bg-white text-black border border-gray-300 rounded-lg placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
            />
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button
          variant="secondary"
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
        >
          Submit
        </Button>
      </div>
    </Modal>
  );
};
