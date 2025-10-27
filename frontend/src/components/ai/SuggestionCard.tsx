/**
 * Suggestion Card Component
 * Displays individual AI suggestion with details
 */

import { useState } from 'react';
import { Suggestion } from '../../types/suggestion';
import styles from './SuggestionCard.module.css';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onApply?: (suggestion: Suggestion) => void;
}

export function SuggestionCard({ suggestion, onApply }: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [applying, setApplying] = useState(false);

  const priorityColors = {
    low: styles.priorityLow,
    medium: styles.priorityMedium,
    high: styles.priorityHigh,
  };

  const typeIcons = {
    rebalance: '⚖️',
    add_asset: '➕',
    remove_asset: '➖',
    adjust_rule: '⚙️',
    risk_adjustment: '🛡️',
  };

  const handleApply = async () => {
    if (!onApply) return;

    setApplying(true);
    try {
      await onApply(suggestion);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={`${styles.card} ${priorityColors[suggestion.priority]}`}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <span className={styles.icon}>{typeIcons[suggestion.type]}</span>
          <h3 className={styles.title}>{suggestion.title}</h3>
        </div>
        <span className={`${styles.priority} ${priorityColors[suggestion.priority]}`}>
          {suggestion.priority.toUpperCase()}
        </span>
      </div>

      <p className={styles.description}>{suggestion.description}</p>

      {suggestion.expectedImpact && (
        <div className={styles.impact}>
          {suggestion.expectedImpact.returnIncrease && (
            <div className={styles.impactItem}>
              <span className={styles.impactIcon}>📈</span>
              <span>+{suggestion.expectedImpact.returnIncrease}% Return</span>
            </div>
          )}
          {suggestion.expectedImpact.riskReduction && (
            <div className={styles.impactItem}>
              <span className={styles.impactIcon}>🛡️</span>
              <span>-{suggestion.expectedImpact.riskReduction}% Risk</span>
            </div>
          )}
          {suggestion.expectedImpact.efficiencyGain && (
            <div className={styles.impactItem}>
              <span className={styles.impactIcon}>⚡</span>
              <span>+{suggestion.expectedImpact.efficiencyGain}% Efficiency</span>
            </div>
          )}
        </div>
      )}

      <button
        className={styles.expandButton}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Show Less' : 'Show Details'}
        <span className={expanded ? styles.arrowUp : styles.arrowDown}>▼</span>
      </button>

      {expanded && (
        <div className={styles.details}>
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Rationale</h4>
            <p className={styles.sectionContent}>{suggestion.rationale}</p>
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Implementation Steps</h4>
            <ol className={styles.stepsList}>
              {suggestion.implementation.steps.map((step, index) => (
                <li key={index} className={styles.step}>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className={styles.meta}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Difficulty:</span>
              <span className={styles.metaValue}>
                {suggestion.implementation.difficulty}
              </span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Est. Time:</span>
              <span className={styles.metaValue}>
                {suggestion.implementation.estimatedTime}
              </span>
            </div>
          </div>

          {onApply && (
            <button
              className={styles.applyButton}
              onClick={handleApply}
              disabled={applying}
            >
              {applying ? 'Applying...' : 'Apply Suggestion'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
