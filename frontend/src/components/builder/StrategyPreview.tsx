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
    <div className="h-full flex flex-col">
      {/* Compact Header */}
      <div className="flex-shrink-0 flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold">
            Your Strategy
          </h3>
        </div>
        {summary && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <TrendingUp className="w-3 h-3" />
            <span>{summary}</span>
          </div>
        )}
      </div>

      {/* Rules list - Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FileText className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Add blocks to see your strategy</p>
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
                  p-2.5 rounded border text-xs leading-relaxed
                  ${isAllocation ? 'bg-blue-500/10 border-blue-500/30 text-blue-100' : ''}
                  ${isWarning ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-100' : ''}
                  ${!isAllocation && !isWarning ? 'bg-white/5 border-white/10' : ''}
                `}
              >
                {renderMarkdown(rule)}
              </div>
            );
          })
        )}
      </div>

      {/* Compact Footer */}
      {rules.length > 0 && (
        <div className="flex-shrink-0 pt-2 mt-2 border-t border-white/10">
          <p className="text-[10px] text-gray-400">
            💡 Review carefully before deploying
          </p>
        </div>
      )}
    </div>
  );
};

export default StrategyPreview;
