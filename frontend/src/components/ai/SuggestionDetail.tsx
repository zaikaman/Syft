/**
 * Suggestion Detail View Component (T118)
 * Displays detailed information about a suggestion with supporting data visualizations
 */

import { useState } from 'react';
import { Suggestion } from '../../types/suggestion';
import styles from './SuggestionDetail.module.css';

interface SuggestionDetailProps {
  suggestion: Suggestion;
  onClose: () => void;
  onApply?: (suggestion: Suggestion) => void;
}

export function SuggestionDetail({ suggestion, onClose, onApply }: SuggestionDetailProps) {
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (!onApply) return;

    setApplying(true);
    try {
      await onApply(suggestion);
      onClose();
    } catch (error) {
      console.error('Error applying suggestion:', error);
    } finally {
      setApplying(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const typeLabels: Record<string, string> = {
    rebalance: 'Rebalance Portfolio',
    add_asset: 'Add New Asset',
    remove_asset: 'Remove Asset',
    adjust_rule: 'Adjust Rebalancing Rule',
    risk_adjustment: 'Risk Management',
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.typeLabel}>{typeLabels[suggestion.type]}</div>
            <h2 className={styles.title}>{suggestion.title}</h2>
            <div className={styles.meta}>
              <span className={`${styles.priority} ${styles[`priority${suggestion.priority}`]}`}>
                {suggestion.priority.toUpperCase()} PRIORITY
              </span>
              <span className={styles.date}>
                Created {formatDate(suggestion.createdAt)}
              </span>
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {/* Description Section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Overview</h3>
            <p className={styles.description}>{suggestion.description}</p>
          </section>

          {/* Expected Impact */}
          {suggestion.expectedImpact && Object.keys(suggestion.expectedImpact).length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Expected Impact</h3>
              <div className={styles.impactGrid}>
                {suggestion.expectedImpact.returnIncrease && (
                  <div className={styles.impactCard}>
                    <div className={styles.impactIcon}>📈</div>
                    <div className={styles.impactLabel}>Return Increase</div>
                    <div className={styles.impactValue}>
                      +{suggestion.expectedImpact.returnIncrease}%
                    </div>
                  </div>
                )}
                {suggestion.expectedImpact.riskReduction && (
                  <div className={styles.impactCard}>
                    <div className={styles.impactIcon}>🛡️</div>
                    <div className={styles.impactLabel}>Risk Reduction</div>
                    <div className={styles.impactValue}>
                      -{suggestion.expectedImpact.riskReduction}%
                    </div>
                  </div>
                )}
                {suggestion.expectedImpact.efficiencyGain && (
                  <div className={styles.impactCard}>
                    <div className={styles.impactIcon}>⚡</div>
                    <div className={styles.impactLabel}>Efficiency Gain</div>
                    <div className={styles.impactValue}>
                      +{suggestion.expectedImpact.efficiencyGain}%
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Rationale */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Why This Helps</h3>
            <p className={styles.rationale}>{suggestion.rationale}</p>
          </section>

          {/* Implementation Steps */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Implementation Steps</h3>
            <ol className={styles.stepsList}>
              {suggestion.implementation.steps.map((step, index) => (
                <li key={index} className={styles.step}>
                  <span className={styles.stepNumber}>{index + 1}</span>
                  <span className={styles.stepText}>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Implementation Details */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Implementation Details</h3>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Difficulty</span>
                <span className={`${styles.detailValue} ${styles[suggestion.implementation.difficulty]}`}>
                  {suggestion.implementation.difficulty}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Estimated Time</span>
                <span className={styles.detailValue}>
                  {suggestion.implementation.estimatedTime}
                </span>
              </div>
            </div>
          </section>

          {/* Supporting Data */}
          {suggestion.dataSupport && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Supporting Data</h3>
              <div className={styles.dataSupport}>
                {suggestion.dataSupport.analysis && (
                  <div className={styles.dataCard}>
                    <div className={styles.dataCardTitle}>Strategy Analysis</div>
                    <div className={styles.dataCardContent}>
                      <div className={styles.dataItem}>
                        <span>Overall Score:</span>
                        <span className={styles.dataValue}>
                          {suggestion.dataSupport.analysis.overallScore}/100
                        </span>
                      </div>
                      <div className={styles.dataItem}>
                        <span>Risk Level:</span>
                        <span className={`${styles.dataValue} ${styles[`risk${suggestion.dataSupport.analysis.riskLevel}`]}`}>
                          {suggestion.dataSupport.analysis.riskLevel}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {suggestion.dataSupport.sentiment && (
                  <div className={styles.dataCard}>
                    <div className={styles.dataCardTitle}>Sentiment Analysis</div>
                    <div className={styles.dataCardContent}>
                      {Object.entries(suggestion.dataSupport.sentiment).map(([asset, data]: [string, any]) => (
                        <div key={asset} className={styles.dataItem}>
                          <span>{asset}:</span>
                          <span className={styles.dataValue}>
                            {data.overallSentiment || 'N/A'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose}>
            Close
          </button>
          {onApply && (
            <button
              className={styles.applyButton}
              onClick={handleApply}
              disabled={applying}
            >
              {applying ? 'Applying...' : 'Apply This Suggestion'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
