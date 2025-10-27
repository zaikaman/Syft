/**
 * Builder Toolbar Component (T121)
 * Toolbar for vault builder with "Get AI Suggestions" button
 */

import styles from './BuilderToolbar.module.css';

interface BuilderToolbarProps {
  vaultId?: string;
  onGetSuggestions?: () => void;
  onSave?: () => void;
  onValidate?: () => void;
  onClear?: () => void;
  hasChanges?: boolean;
  isValid?: boolean;
}

export function BuilderToolbar({
  vaultId,
  onGetSuggestions,
  onSave,
  onValidate,
  onClear,
  hasChanges = false,
  isValid = true,
}: BuilderToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.leftSection}>
        <h2 className={styles.title}>Vault Strategy Builder</h2>
        {hasChanges && <span className={styles.badge}>Unsaved Changes</span>}
      </div>

      <div className={styles.rightSection}>
        {/* AI Suggestions Button - Main feature of T121 */}
        {onGetSuggestions && vaultId && (
          <button
            className={styles.aiButton}
            onClick={onGetSuggestions}
            title="Get AI-powered strategy suggestions"
          >
            <span className={styles.aiIcon}>✨</span>
            <span>Get AI Suggestions</span>
          </button>
        )}

        {/* Validate Button */}
        {onValidate && (
          <button
            className={styles.validateButton}
            onClick={onValidate}
            title="Validate current strategy"
          >
            <span className={styles.icon}>✓</span>
            <span>Validate</span>
          </button>
        )}

        {/* Clear Button */}
        {onClear && (
          <button
            className={styles.clearButton}
            onClick={onClear}
            title="Clear all blocks"
            disabled={!hasChanges}
          >
            <span className={styles.icon}>🗑️</span>
            <span>Clear</span>
          </button>
        )}

        {/* Save Button */}
        {onSave && (
          <button
            className={styles.saveButton}
            onClick={onSave}
            disabled={!hasChanges || !isValid}
            title={
              !isValid
                ? 'Fix validation errors before saving'
                : !hasChanges
                ? 'No changes to save'
                : 'Save strategy'
            }
          >
            <span className={styles.icon}>💾</span>
            <span>Save</span>
          </button>
        )}
      </div>
    </div>
  );
}
