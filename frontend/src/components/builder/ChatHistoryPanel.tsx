/**
 * Chat History Panel Component
 * Shows previous chat sessions and allows loading them
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, MessageSquare, Plus, Trash2, Calendar, Loader2, X } from 'lucide-react';

interface ChatSession {
  sessionId: string;
  initialPrompt?: string;
  createdAt: string;
  updatedAt: string;
  totalMessages: number;
  vaultGenerated: boolean;
  status: string;
}

interface ChatHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onLoadSession: (sessionId: string) => void;
  currentSessionId?: string;
  walletAddress?: string; // Add wallet address prop
}

export function ChatHistoryPanel({
  isOpen,
  onClose,
  onNewChat,
  onLoadSession,
  currentSessionId,
  walletAddress, // Destructure wallet address
}: ChatHistoryPanelProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      // Filter by wallet address if available
      const url = walletAddress 
        ? `${backendUrl}/api/chat/sessions?walletAddress=${encodeURIComponent(walletAddress)}`
        : `${backendUrl}/api/chat/sessions`;
      
      console.log('[ChatHistory] Loading sessions from:', url);
      console.log('[ChatHistory] Wallet address:', walletAddress);
        
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      console.log('[ChatHistory] Response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to load chat history');
      }

      console.log('[ChatHistory] Loaded sessions:', data.data.length);
      setSessions(data.data);
    } catch (err) {
      console.error('Error loading chat history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chat history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this chat session?')) {
      return;
    }

    try {
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete session');
      }

      // Remove from list
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));

      // If deleting current session, start new chat
      if (sessionId === currentSessionId) {
        onNewChat();
      }
    } catch (err) {
      console.error('Error deleting session:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete session');
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-neutral-900 border border-default rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-default">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-primary-400" />
              <h2 className="text-lg font-bold text-neutral-50">Chat History</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onNewChat}
                className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-dark-950 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 hover:bg-neutral-800 rounded-lg flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">Loading chat history...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-error-400">
                <p className="text-sm">{error}</p>
                <button
                  onClick={loadSessions}
                  className="mt-3 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-sm transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">No chat history yet</p>
                <p className="text-xs mt-1">Start a new conversation to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <motion.button
                    key={session.sessionId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      onLoadSession(session.sessionId);
                      onClose();
                    }}
                    className={`w-full p-4 rounded-lg border text-left transition-colors ${
                      session.sessionId === currentSessionId
                        ? 'bg-primary-500/10 border-primary-500/30'
                        : 'bg-neutral-800 border-default hover:bg-neutral-750'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                          <p className="text-sm font-semibold text-neutral-50 truncate">
                            {session.initialPrompt 
                              ? truncateText(session.initialPrompt, 50)
                              : 'Untitled conversation'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-neutral-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(session.updatedAt)}
                          </span>
                          <span>{session.totalMessages} messages</span>
                          {session.vaultGenerated && (
                            <span className="px-1.5 py-0.5 bg-success-500/20 text-success-400 rounded text-[10px] font-semibold">
                              VAULT
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.sessionId, e)}
                        className="flex-shrink-0 w-7 h-7 hover:bg-error-500/20 text-neutral-500 hover:text-error-400 rounded flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
