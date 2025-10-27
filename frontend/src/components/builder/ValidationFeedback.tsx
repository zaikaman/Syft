import { AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { ValidationResult } from '../../types/blocks';

interface ValidationFeedbackProps {
  validation: ValidationResult;
  onClose?: () => void;
}

const ValidationFeedback = ({ validation, onClose }: ValidationFeedbackProps) => {
  const { valid, errors, warnings } = validation;

  if (valid && warnings.length === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900 dark:text-green-100">
              Configuration Valid
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Your vault strategy is ready to deploy!
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-100">
                {errors.length} Error{errors.length > 1 ? 's' : ''} Found
              </h3>
              <ul className="mt-2 space-y-2">
                {errors.map((error, index) => (
                  <li
                    key={index}
                    className="text-sm text-red-700 dark:text-red-300"
                  >
                    <span className="font-medium">
                      {error.blockId !== 'canvas' ? `Block ${error.blockId}: ` : ''}
                    </span>
                    {error.message}
                    {error.field && (
                      <span className="text-xs ml-2 px-2 py-0.5 bg-red-200 dark:bg-red-800 rounded">
                        {error.field}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                {warnings.length} Warning{warnings.length > 1 ? 's' : ''}
              </h3>
              <ul className="mt-2 space-y-2">
                {warnings.map((warning, index) => (
                  <li
                    key={index}
                    className="text-sm text-yellow-700 dark:text-yellow-300"
                  >
                    <div>
                      <span className="font-medium">
                        {warning.blockId !== 'canvas' ? `Block ${warning.blockId}: ` : ''}
                      </span>
                      {warning.message}
                    </div>
                    {warning.suggestion && (
                      <div className="mt-1 text-xs italic text-yellow-600 dark:text-yellow-400">
                        💡 {warning.suggestion}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationFeedback;
