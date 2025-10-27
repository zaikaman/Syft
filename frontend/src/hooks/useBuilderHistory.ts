import { useCallback, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface UseBuilderHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushState: (nodes: Node[], edges: Edge[]) => void;
  clearHistory: () => void;
}

/**
 * Hook for managing undo/redo functionality in the vault builder
 */
export function useBuilderHistory(
  initialNodes: Node[] = [],
  initialEdges: Edge[] = []
): UseBuilderHistoryReturn {
  const [history, setHistory] = useState<HistoryState[]>([
    { nodes: initialNodes, edges: initialEdges },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  /**
   * Undo to previous state
   */
  const undo = useCallback(() => {
    if (canUndo) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [canUndo]);

  /**
   * Redo to next state
   */
  const redo = useCallback(() => {
    if (canRedo) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [canRedo]);

  /**
   * Push a new state to history
   */
  const pushState = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      // Remove any states after current index (when user makes a new change after undoing)
      const newHistory = history.slice(0, currentIndex + 1);

      // Add new state
      newHistory.push({
        nodes: JSON.parse(JSON.stringify(nodes)), // Deep clone
        edges: JSON.parse(JSON.stringify(edges)),
      });

      // Limit history size to prevent memory issues (keep last 50 states)
      const maxHistorySize = 50;
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        setHistory(newHistory);
        setCurrentIndex(newHistory.length - 1);
      } else {
        setHistory(newHistory);
        setCurrentIndex(newHistory.length - 1);
      }
    },
    [history, currentIndex]
  );

  /**
   * Clear history and reset to initial state
   */
  const clearHistory = useCallback(() => {
    setHistory([{ nodes: [], edges: [] }]);
    setCurrentIndex(0);
  }, []);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    pushState,
    clearHistory,
  };
}

/**
 * Get current state from history
 */
export function useCurrentHistoryState(
  history: HistoryState[],
  currentIndex: number
): HistoryState {
  return history[currentIndex] || { nodes: [], edges: [] };
}
