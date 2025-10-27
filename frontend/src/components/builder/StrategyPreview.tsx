import { useEffect, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { RuleTranslator } from '../../lib/ruleTranslator';
import { FileText, TrendingUp } from 'lucide-react';

interface StrategyPreviewProps {
  nodes: Node[];
  edges: Edge[];
}

const StrategyPreview = ({ nodes, edges }: StrategyPreviewProps) => {
  const [rules, setRules] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>('');

  useEffect(() => {
    const translatedRules = RuleTranslator.translateToPlainLanguage(nodes, edges);
    const strategySummary = RuleTranslator.generateSummary(nodes, edges);
    
    setRules(translatedRules);
    setSummary(strategySummary);
  }, [nodes, edges]);

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering for bold text
    return text.split('**').map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index}>{part}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Strategy Preview
          </h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <TrendingUp className="w-4 h-4" />
          <span>{summary}</span>
        </div>
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Add blocks to the canvas to see your strategy description</p>
          </div>
        ) : (
          rules.map((rule, index) => {
            // Determine if this is a portfolio allocation or a rule
            const isAllocation = rule.startsWith('📊');
            const isWarning = rule.startsWith('⚠️');
            
            return (
              <div
                key={index}
                className={`
                  p-4 rounded-lg border
                  ${isAllocation ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}
                  ${isWarning ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' : ''}
                  ${!isAllocation && !isWarning ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700' : ''}
                `}
              >
                <p className={`
                  text-sm leading-relaxed
                  ${isAllocation ? 'text-blue-900 dark:text-blue-100' : ''}
                  ${isWarning ? 'text-yellow-900 dark:text-yellow-100' : ''}
                  ${!isAllocation && !isWarning ? 'text-gray-900 dark:text-white' : ''}
                `}>
                  {renderMarkdown(rule)}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Info footer */}
      {rules.length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            💡 This is how your vault strategy will behave. Review carefully before deploying.
          </p>
        </div>
      )}
    </div>
  );
};

export default StrategyPreview;
