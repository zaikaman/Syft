/**
 * Apply Suggestion Component (T119)
 * Handles the flow of applying a suggestion to update vault configuration
 */

import { useState } from 'react';
import { Suggestion } from '../../types/suggestion';
import { VaultConfig } from '../../../../shared/types/vault';
import styles from './ApplySuggestion.module.css';

interface ApplySuggestionProps {
  suggestion: Suggestion;
  currentConfig: VaultConfig;
  onApply: (updatedConfig: VaultConfig) => Promise<void>;
  onCancel: () => void;
}

export function ApplySuggestion({
  suggestion,
  currentConfig,
  onApply,
  onCancel,
}: ApplySuggestionProps) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'review' | 'confirm' | 'applying' | 'success'>('review');

  const getUpdatedConfig = (): VaultConfig => {
    if (suggestion.configChanges) {
      return {
        ...currentConfig,
        ...suggestion.configChanges,
      };
    }
    return currentConfig;
  };

  const updatedConfig = getUpdatedConfig();

  const handleConfirm = () => {
    setStep('confirm');
  };

  const handleApply = async () => {
    setStep('applying');
    setApplying(true);
    setError(null);

    try {
      await onApply(updatedConfig);
      setStep('success');
    } catch (err) {
      console.error('Error applying suggestion:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply suggestion');
      setStep('review');
    } finally {
      setApplying(false);
    }
  };

  const renderConfigChanges = () => {
    if (!suggestion.configChanges) {
      return (
        <div className={styles.noChanges}>
          <p>This suggestion requires manual implementation following the steps provided.</p>
        </div>
      );
    }

    const changes = [];

    if (suggestion.configChanges.assets) {
      changes.push({
        label: 'Asset Allocations',
        before: currentConfig.assets,
        after: suggestion.configChanges.assets,
      });
    }

    if (suggestion.configChanges.rules) {
      changes.push({
        label: 'Rebalancing Rules',
        before: currentConfig.rules?.length || 0,
        after: suggestion.configChanges.rules?.length || 0,
      });
    }

    return (
      <div className={styles.changes}>
        {changes.map((change, index) => (
          <div key={index} className={styles.changeItem}>
            <div className={styles.changeLabel}>{change.label}</div>
            <div className={styles.changeComparison}>
              <div className={styles.before}>
                <span className={styles.changeTag}>Current</span>
                <pre className={styles.changeCode}>
                  {JSON.stringify(change.before, null, 2)}
                </pre>
              </div>
              <div className={styles.arrow}>→</div>
              <div className={styles.after}>
                <span className={styles.changeTag}>New</span>
                <pre className={styles.changeCode}>
                  {JSON.stringify(change.after, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (step === 'success') {
    return (
      <div className={styles.container}>
        <div className={styles.success}>
          <div className={styles.successIcon}>✓</div>
          <h2 className={styles.successTitle}>Suggestion Applied Successfully!</h2>
          <p className={styles.successMessage}>
            Your vault configuration has been updated with the recommended changes.
          </p>
          <button className={styles.doneButton} onClick={onCancel}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Apply Suggestion</h2>
        <p className={styles.subtitle}>{suggestion.title}</p>
      </div>

      {error && (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {step === 'review' && (
        <>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Configuration Changes</h3>
            {renderConfigChanges()}
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Implementation Steps</h3>
            <ol className={styles.stepsList}>
              {suggestion.implementation.steps.map((stepText, index) => (
                <li key={index} className={styles.step}>
                  {stepText}
                </li>
              ))}
            </ol>
          </div>

          <div className={styles.warning}>
            <span className={styles.warningIcon}>⚠️</span>
            <div>
              <strong>Important:</strong> Applying this suggestion will update your vault's
              configuration. Make sure you understand the changes before proceeding.
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.cancelButton} onClick={onCancel} disabled={applying}>
              Cancel
            </button>
            <button className={styles.continueButton} onClick={handleConfirm} disabled={applying}>
              Continue
            </button>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <div className={styles.confirmSection}>
            <div className={styles.confirmIcon}>🔔</div>
            <h3 className={styles.confirmTitle}>Confirm Changes</h3>
            <p className={styles.confirmMessage}>
              Are you sure you want to apply these changes to your vault? This action will:
            </p>
            <ul className={styles.confirmList}>
              <li>Update your vault's asset allocations</li>
              <li>Modify rebalancing rules if applicable</li>
              <li>Trigger a rebalance if needed</li>
            </ul>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.cancelButton}
              onClick={() => setStep('review')}
              disabled={applying}
            >
              Go Back
            </button>
            <button className={styles.applyButton} onClick={handleApply} disabled={applying}>
              {applying ? 'Applying...' : 'Apply Changes'}
            </button>
          </div>
        </>
      )}

      {step === 'applying' && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Applying changes to your vault...</p>
        </div>
      )}
    </div>
  );
}
