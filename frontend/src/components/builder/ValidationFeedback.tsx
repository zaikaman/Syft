import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ValidationResult } from '../../types/blocks';

interface ValidationFeedbackProps {
  validation: ValidationResult;
}

const ValidationFeedback = ({ validation }: ValidationFeedbackProps) => {
  const { valid, errors, warnings } = validation;

  if (valid && warnings.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="font-semibold text-green-100 text-sm">
            Configuration Valid ✓
          </h3>
          <p className="text-xs text-green-300 mt-1">
            Your vault strategy is ready to deploy!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-2 pr-2">
      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-red-100 text-sm">
                {errors.length} Error{errors.length > 1 ? 's' : ''}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {errors.map((error, index) => (
                  <li
                    key={index}
                    className="text-xs text-red-200 leading-relaxed"
                  >
                    <span className="font-medium">
                      {error.blockId !== 'canvas' ? `Block ${error.blockId}: ` : ''}
                    </span>
                    {error.message}
                    {error.field && (
                      <span className="text-[10px] ml-2 px-1.5 py-0.5 bg-red-500/30 rounded">
                        {error.field}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-yellow-100 text-sm">
                {warnings.length} Warning{warnings.length > 1 ? 's' : ''}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {warnings.map((warning, index) => (
                  <li
                    key={index}
                    className="text-xs text-yellow-200"
                  >
                    <div>
                      <span className="font-medium">
                        {warning.blockId !== 'canvas' ? `Block ${warning.blockId}: ` : ''}
                      </span>
                      {warning.message}
                    </div>
                    {warning.suggestion && (
                      <div className="mt-1 text-[10px] italic text-yellow-300/80">
                        💡 {warning.suggestion}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationFeedback;
