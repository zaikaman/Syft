/**
 * Natural Language Vault Builder Component
 * Chat interface for creating vaults using AI
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2, AlertCircle, CheckCircle2, Bot, User, History, Plus } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { useWallet } from '../../providers/WalletProvider';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  vaultPreview?: {
    nodes: Node[];
    edges: Edge[];
  };
  marketContext?: string;
  suggestions?: string[];
}

interface NaturalLanguageBuilderProps {
  onVaultGenerated: (nodes: Node[], edges: Edge[], explanation: string) => void;
  network?: string;
  currentNodes?: Node[];
  currentEdges?: Edge[];
}

export function NaturalLanguageBuilder({ onVaultGenerated, network, currentNodes = [], currentEdges = [] }: NaturalLanguageBuilderProps) {
  const { address: walletAddress } = useWallet(); // Get connected wallet address
  
  console.log('[NaturalLanguageBuilder] Wallet address:', walletAddress);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Helper to get welcome message
  const getWelcomeMessage = (): Message => ({
    id: 'welcome',
    role: 'assistant',
    content: 'Hi! I\'m your AI vault architect for Stellar blockchain. I can help you in three ways:\n\n💬 Chat & Advice: Ask me questions about DeFi strategies, Stellar assets, or vault optimization. I\'ll search the web for current market data when needed.\n\n🏗️ Build Vaults: When you\'re ready, tell me what you want and I\'ll generate a complete vault configuration.\n\n✏️ Edit Vaults: If you have a vault in the visual builder, I can see it and help you modify it!\n\nTry asking:\n• "What are the best performing Stellar assets right now?"\n• "Explain how rebalancing strategies work"\n• "Create a balanced portfolio with 60% USDC and 40% XLM"\n• "Add a weekly rebalancing rule to my vault"\n\nWhat would you like to do?',
    timestamp: new Date(),
  });

  // Helper to summarize current vault for AI context
  const summarizeVault = (nodes: Node[], _edges: Edge[]): string => {
    if (nodes.length === 0) return 'No vault currently built.';

    const assets = nodes.filter(n => n.type === 'asset');
    const conditions = nodes.filter(n => n.type === 'condition');
    const actions = nodes.filter(n => n.type === 'action');

    let summary = 'Current vault configuration:\n\n';
    
    if (assets.length > 0) {
      summary += 'Assets:\n';
      assets.forEach(asset => {
        summary += `- ${asset.data.assetCode || asset.data.label}: ${asset.data.allocation}%\n`;
      });
    }

    if (conditions.length > 0) {
      summary += '\nConditions:\n';
      conditions.forEach(condition => {
        summary += `- ${condition.data.label || condition.data.conditionType}\n`;
      });
    }

    if (actions.length > 0) {
      summary += '\nActions:\n';
      actions.forEach(action => {
        summary += `- ${action.data.label || action.data.actionType}\n`;
      });
    }

    return summary;
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load current session on mount
  useEffect(() => {
    const loadCurrentSession = async () => {
      setIsLoadingSession(true);
      
      try {
        // Try to get session ID from localStorage
        const storedSessionId = localStorage.getItem('syft_current_chat_session');
        const storedWalletAddress = localStorage.getItem('syft_chat_wallet_address');
        
        // If wallet address changed, clear the stored session
        if (storedWalletAddress && storedWalletAddress !== walletAddress) {
          console.log('[Chat] Wallet address changed, clearing stored session');
          localStorage.removeItem('syft_current_chat_session');
          localStorage.removeItem('syft_chat_wallet_address');
          setMessages([getWelcomeMessage()]);
        } else if (storedSessionId) {
          console.log('[Chat] Loading session from localStorage:', storedSessionId);
          await loadSession(storedSessionId);
        } else {
          // No stored session, show welcome message
          console.log('[Chat] No stored session, showing welcome message');
          setMessages([getWelcomeMessage()]);
        }
        
        // Store current wallet address for future comparison
        if (walletAddress) {
          localStorage.setItem('syft_chat_wallet_address', walletAddress);
        }
      } catch (error) {
        console.error('[Chat] Error loading session:', error);
        setMessages([getWelcomeMessage()]);
      } finally {
        setIsLoadingSession(false);
      }
    };

    loadCurrentSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]); // Re-run when wallet address changes

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Create a new chat session
  const createNewSession = async (initialPrompt?: string) => {
    try {
      console.log('[Chat] Creating session with wallet:', walletAddress);
      
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress, // Include wallet address
          network: network || 'testnet',
          initialPrompt,
        }),
      });

      const data = await response.json();
      console.log('[Chat] Session creation response:', data);

      if (data.success && data.data.sessionId) {
        const sessionId = data.data.sessionId;
        setCurrentSessionId(sessionId);
        // Save to localStorage for persistence
        localStorage.setItem('syft_current_chat_session', sessionId);
        console.log('[Chat] Created new session:', sessionId);
        return sessionId;
      }
    } catch (err) {
      console.error('Error creating session:', err);
    }
    return null;
  };

  // Load a previous chat session
  const loadSession = async (sessionId: string) => {
    try {
      console.log('[Chat] Fetching messages for session:', sessionId);
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/chat/sessions/${sessionId}/messages`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        console.log('[Chat] Received', data.data.length, 'messages');
        
        // Convert backend messages to UI messages
        const loadedMessages: Message[] = data.data.map((msg: any) => ({
          id: msg.messageId,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.createdAt),
          vaultPreview: msg.vaultSnapshot,
          marketContext: msg.marketContext,
        }));

        // If no messages, add welcome message
        if (loadedMessages.length === 0) {
          console.log('[Chat] No messages in session, adding welcome message');
          loadedMessages.unshift(getWelcomeMessage());
        }

        setMessages(loadedMessages);
        setCurrentSessionId(sessionId);
        localStorage.setItem('syft_current_chat_session', sessionId);
        console.log('[Chat] Successfully loaded session with', loadedMessages.length, 'messages');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('[Chat] Error loading session:', err);
      // On error, show welcome message and clear session
      setMessages([getWelcomeMessage()]);
      setCurrentSessionId(null);
      localStorage.removeItem('syft_current_chat_session');
    }
  };

  // Start a new chat (reset messages)
  const handleNewChat = () => {
    setMessages([getWelcomeMessage()]);
    setCurrentSessionId(null);
    setIsHistoryOpen(false);
    // Clear localStorage
    localStorage.removeItem('syft_current_chat_session');
    // Keep wallet address tracking
    if (walletAddress) {
      localStorage.setItem('syft_chat_wallet_address', walletAddress);
    }
    console.log('[Chat] Started new chat session');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isGenerating) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsGenerating(true);
    setError(null);

    try {
      // Create session if this is the first message
      let sessionId = currentSessionId;
      if (!sessionId) {
        console.log('[Chat] No session exists, creating new one...');
        sessionId = await createNewSession(userMessage.content);
        if (!sessionId) {
          console.error('[Chat] Failed to create session');
          throw new Error('Failed to create chat session');
        }
        console.log('[Chat] Created session:', sessionId);
      } else {
        console.log('[Chat] Using existing session:', sessionId);
      }

      // Build conversation history for context
      const conversationHistory = messages
        .filter(m => m.id !== 'welcome') // Exclude welcome message
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      // Prepare current vault context if exists
      const hasCurrentVault = currentNodes.length > 0 || currentEdges.length > 0;
      let currentVaultContext = null;
      
      if (hasCurrentVault) {
        currentVaultContext = {
          nodes: currentNodes,
          edges: currentEdges,
          summary: summarizeVault(currentNodes, currentEdges),
        };
      }

      // Call backend API to generate vault
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      console.log('[Chat] Sending request to backend with sessionId:', sessionId);
      const response = await fetch(`${backendUrl}/api/vaults/generate-from-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userPrompt: userMessage.content,
          conversationHistory,
          currentVault: currentVaultContext,
          network: network || 'testnet',
          sessionId, // Include session ID for history tracking
        }),
      });

      console.log('[Chat] Backend response status:', response.status);
      const data = await response.json();
      console.log('[Chat] Backend response data:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate vault');
      }

      const { nodes, edges, explanation, marketContext, suggestions, responseType } = data.data;

      // Check if AI just wants to chat or if it built a vault
      const isVaultBuilt = responseType === 'build' && nodes && nodes.length > 0;

      // Create assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: explanation,
        timestamp: new Date(),
        vaultPreview: isVaultBuilt ? { nodes, edges } : undefined,
        marketContext,
        suggestions,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Only update parent component if vault was actually built
      if (isVaultBuilt) {
        onVaultGenerated(nodes, edges, explanation);
      }

    } catch (err) {
      console.error('Error generating vault:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate vault');
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again or rephrase your request.`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-default bg-neutral-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-50">AI Vault Builder</h2>
              <p className="text-sm text-neutral-400">Describe your strategy in plain English</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-default text-neutral-300 hover:text-neutral-50 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
              title="Start new chat"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-default text-neutral-300 hover:text-neutral-50 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
              title="View chat history"
            >
              <History className="w-4 h-4" />
              History
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {isLoadingSession ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Loading conversation...</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user' 
                  ? 'bg-primary-500/20' 
                  : 'bg-neutral-800 border border-default'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4 text-primary-400" />
                ) : (
                  <Bot className="w-4 h-4 text-neutral-400" />
                )}
              </div>

              {/* Message Content */}
              <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary-500 text-dark-950'
                    : 'bg-neutral-900 border border-default text-neutral-50'
                }`}>
                  <div 
                    className="text-sm whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ 
                      __html: message.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/\n/g, '<br />')
                    }}
                  />
                </div>

                {/* Market Context */}
                {message.marketContext && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 p-3 bg-neutral-800 border border-default rounded-lg"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs font-semibold text-primary-400">Market Context</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">{message.marketContext}</p>
                  </motion.div>
                )}

                {/* Suggestions */}
                {message.suggestions && message.suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 space-y-1.5"
                  >
                    <span className="text-xs font-semibold text-neutral-400">Suggestions:</span>
                    {message.suggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2 bg-neutral-800 border border-default rounded text-xs text-neutral-300"
                      >
                        <CheckCircle2 className="w-3 h-3 text-success-400 flex-shrink-0 mt-0.5" />
                        <span>{suggestion}</span>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Timestamp */}
                <p className="text-xs text-neutral-500 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        )}

        {/* Loading Indicator */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-800 border border-default flex items-center justify-center">
              <Bot className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-neutral-900 border border-default rounded-lg">
              <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
              <span className="text-sm text-neutral-400">Thinking...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0 mx-6 mb-4 p-4 bg-error-500/10 border border-error-500/30 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-error-400">Error</p>
              <p className="text-xs text-error-300 mt-1">{error}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-default bg-neutral-900 px-6 py-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your vault strategy... (Press Enter to send, Shift+Enter for new line)"
            disabled={isGenerating}
            rows={3}
            className="flex-1 px-4 py-3 bg-neutral-800 border border-default rounded-lg text-neutral-50 placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isGenerating}
            className="flex-shrink-0 w-12 h-12 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors self-end"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 text-dark-950 animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-dark-950" />
            )}
          </button>
        </form>

        {/* Quick Examples */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-neutral-500">Try:</span>
          {[
            currentNodes.length > 0 
              ? 'Change XLM allocation to 70%' 
              : 'What are current Stellar DeFi trends?',
            currentNodes.length > 0
              ? 'Add a weekly rebalancing rule'
              : 'Create a conservative vault with 60% USDC, 40% XLM',
            'How should I diversify my portfolio?',
          ].map((example, idx) => (
            <button
              key={idx}
              onClick={() => setInputValue(example)}
              disabled={isGenerating}
              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 border border-default rounded text-xs text-neutral-400 hover:text-neutral-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              "{example.substring(0, 40)}{example.length > 40 ? '...' : ''}"
            </button>
          ))}
        </div>
      </div>

      {/* Chat History Panel */}
      <ChatHistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onNewChat={handleNewChat}
        onLoadSession={loadSession}
        currentSessionId={currentSessionId || undefined}
        walletAddress={walletAddress || undefined}
      />
    </div>
  );
}
