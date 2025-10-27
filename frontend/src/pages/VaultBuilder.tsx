import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { Save, Play, Undo2, Redo2, Download, Upload, Sparkles, FileText, AlertCircle, FolderOpen, X, Clock } from 'lucide-react';
import { Button, GradientText } from '../components/ui';
import BlockPalette from '../components/builder/BlockPalette';
import VaultCanvas from '../components/builder/VaultCanvas';
import ValidationFeedback from '../components/builder/ValidationFeedback';
import StrategyPreview from '../components/builder/StrategyPreview';
import { BlockValidator } from '../lib/blockValidator';
import { ConfigSerializer } from '../lib/configSerializer';
import { useBuilderHistory } from '../hooks/useBuilderHistory';
import { vaultTemplates } from '../data/vaultTemplates';
import { useWallet } from '../providers/WalletProvider';
import { useNavigate } from 'react-router-dom';
import type { PaletteItem, ValidationResult } from '../types/blocks';

interface SavedVault {
  vault_id: string;
  name: string;
  description: string;
  config: any;
  status: string;
  created_at: string;
  updated_at: string;
}


const VaultBuilder = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [validation, setValidation] = useState<ValidationResult>({
    valid: true,
    errors: [],
    warnings: [],
  });
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'validation'>('preview');
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedVaults, setSavedVaults] = useState<SavedVault[]>([]);
  const [loadingVaults, setLoadingVaults] = useState(false);

  const { address } = useWallet();
  const navigate = useNavigate();
  const { canUndo, canRedo, undo, redo, pushState } = useBuilderHistory(nodes, edges);

  // Load user's saved vaults when component mounts
  useEffect(() => {
    if (address) {
      loadSavedVaults();
    }
  }, [address]);

  // Load saved vaults from backend
  const loadSavedVaults = async () => {
    if (!address) return;

    try {
      setLoadingVaults(true);
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/vaults/user/${address}?status=draft`);
      const data = await response.json();

      if (data.success) {
        setSavedVaults(data.data);
        // Auto-show modal if user has saved drafts
        if (data.data.length > 0 && nodes.length === 0) {
          setShowLoadModal(true);
        }
      }
    } catch (error) {
      console.error('Error loading saved vaults:', error);
    } finally {
      setLoadingVaults(false);
    }
  };

  // Load a specific vault into the builder
  const handleLoadVault = useCallback((vault: SavedVault) => {
    try {
      const { nodes: importedNodes, edges: importedEdges } = ConfigSerializer.deserialize(vault.config);
      setNodes(importedNodes);
      setEdges(importedEdges);
      pushState(importedNodes, importedEdges);
      setShowLoadModal(false);
      alert(`Loaded: ${vault.name}`);
    } catch (error) {
      alert(`Failed to load vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [pushState]);

  // Validate on changes
  useEffect(() => {
    const result = BlockValidator.validateVault(nodes, edges);
    setValidation(result);
  }, [nodes, edges]);

  // Handle block selection from palette
  const handleBlockSelect = useCallback((item: PaletteItem) => {
    // Block will be added via drag and drop
    console.log('Block selected:', item);
  }, []);

  // Handle nodes change
  const handleNodesChange = useCallback((updatedNodes: Node[]) => {
    setNodes(updatedNodes);
    // Only push to history after a debounce to avoid too many history entries
  }, []);

  // Handle edges change  
  const handleEdgesChange = useCallback((updatedEdges: Edge[]) => {
    setEdges(updatedEdges);
    // Only push to history after a debounce to avoid too many history entries
  }, []);

  // Debounced history update - only save to history after user stops making changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nodes.length > 0 || edges.length > 0) {
        pushState(nodes, edges);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Save vault configuration
  const handleSave = useCallback(async () => {
    const config = ConfigSerializer.serialize(nodes, edges);
    console.log('Saving vault configuration:', config);
    
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setSaving(true);
      
      // Save to localStorage as backup
      localStorage.setItem('vault_draft', JSON.stringify(config));
      
      // Save to backend
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/vaults/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: address,
          config,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Vault draft saved successfully!');
      } else {
        throw new Error(data.error || 'Failed to save draft');
      }
    } catch (error) {
      console.error('Error saving vault:', error);
      alert(`Failed to save vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [nodes, edges, address]);

  // Deploy vault
  const handleDeploy = useCallback(async () => {
    const validationResult = BlockValidator.validateVault(nodes, edges);
    
    if (!validationResult.valid) {
      setActiveTab('validation');
      alert('Please fix validation errors before deploying');
      return;
    }

    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    const config = ConfigSerializer.serialize(nodes, edges);
    console.log('Deploying vault with config:', config);

    try {
      setDeploying(true);
      
      // Note: This is a simplified version. In production, you would:
      // 1. Get user to sign transaction via their wallet
      // 2. Submit signed transaction to backend
      // 3. Backend would deploy to Stellar network
      
      const privateKey = prompt(
        'Enter your wallet private key (for testing only - in production this would use your wallet extension):\n\nWARNING: Never share your private key on mainnet!'
      );
      
      if (!privateKey) {
        setDeploying(false);
        return;
      }

      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/vaults`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            owner: address,
            ...config,
          },
          privateKey,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Vault deployed successfully!\n\nVault ID: ${data.data.vaultId}\nContract: ${data.data.contractAddress}`);
        // Navigate to dashboard
        navigate('/dashboard');
      } else {
        throw new Error(data.error || 'Failed to deploy vault');
      }
    } catch (error) {
      console.error('Error deploying vault:', error);
      alert(`Failed to deploy vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeploying(false);
    }
  }, [nodes, edges, address, navigate]);

  // Export configuration
  const handleExport = useCallback(() => {
    const config = ConfigSerializer.serialize(nodes, edges);
    const json = ConfigSerializer.exportJSON(config);
    
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vault-config-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  // Import configuration
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          const config = ConfigSerializer.importJSON(json);
          const { nodes: importedNodes, edges: importedEdges } = ConfigSerializer.deserialize(config);
          
          setNodes(importedNodes);
          setEdges(importedEdges);
          pushState(importedNodes, importedEdges);
          
          alert('Configuration imported successfully!');
        } catch (error) {
          alert(`Failed to import: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }, [pushState]);

  // Load template
  const handleLoadTemplate = useCallback((templateId: string) => {
    const template = vaultTemplates.find(t => t.id === templateId);
    if (!template) return;

    setNodes(template.nodes);
    setEdges(template.edges);
    pushState(template.nodes, template.edges);
  }, [pushState]);

  return (
    <div className="fixed inset-0 bg-[var(--color-bg)]">
      <div className="h-full flex flex-col">
        {/* Compact Header with Syft Logo */}
        <div className="flex-shrink-0 border-b border-white/10 bg-[var(--color-bg-card)]/50 backdrop-blur-md">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Logo and Title Section */}
              <div className="flex items-center gap-6">
                {/* Syft Logo - Clickable to go home */}
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
                  title="Back to Home"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <span className="text-white font-bold text-xl">S</span>
                    </div>
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 blur-md opacity-50 group-hover:opacity-70 transition-opacity -z-10"></div>
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Syft
                  </span>
                </button>

                {/* Divider */}
                <div className="w-px h-8 bg-white/10"></div>

                <div>
                  <h1 className="text-2xl font-bold">
                    <GradientText>Visual Vault Builder</GradientText>
                  </h1>
                </div>
                
                {/* Quick Templates - Inline */}
                <div className="hidden xl:flex items-center gap-2 pl-4 border-l border-white/10">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-gray-400">Templates:</span>
                  {vaultTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleLoadTemplate(template.id)}
                      className="px-2 py-1 text-xs rounded bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-colors"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons - Compact */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Undo2 className="w-4 h-4" />}
                  onClick={undo}
                  disabled={!canUndo}
                  className="hidden md:flex"
                />
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Redo2 className="w-4 h-4" />}
                  onClick={redo}
                  disabled={!canRedo}
                  className="hidden md:flex"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  leftIcon={<FolderOpen className="w-4 h-4" />} 
                  onClick={() => setShowLoadModal(true)}
                  className="hidden lg:flex"
                >
                  Load
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  leftIcon={<Download className="w-4 h-4" />} 
                  onClick={handleExport}
                  className="hidden lg:flex"
                >
                  Export
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  leftIcon={<Upload className="w-4 h-4" />} 
                  onClick={handleImport}
                  className="hidden lg:flex"
                >
                  Import
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  leftIcon={<Save className="w-4 h-4" />} 
                  onClick={handleSave} 
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button 
                  variant="gradient" 
                  size="sm" 
                  leftIcon={<Play className="w-4 h-4" />} 
                  onClick={handleDeploy} 
                  disabled={deploying}
                >
                  {deploying ? 'Deploying...' : 'Deploy'}
                </Button>
              </div>
            </div>

            {/* Templates for smaller screens */}
            <div className="xl:hidden mt-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2 flex-wrap">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-gray-400">Quick Start:</span>
                {vaultTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleLoadTemplate(template.id)}
                    className="px-2 py-1 text-xs rounded bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-colors"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Fixed Height */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex">
            {/* Left Sidebar - Block Palette */}
            <div className="w-64 flex-shrink-0 border-r border-white/10 bg-[var(--color-bg-card)]/30 backdrop-blur-sm overflow-hidden">
              <div className="h-full overflow-y-auto">
                <BlockPalette onBlockSelect={handleBlockSelect} />
              </div>
            </div>

            {/* Center - Canvas Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Canvas */}
              <div className="flex-1 overflow-hidden">
                <VaultCanvas
                  initialNodes={nodes}
                  initialEdges={edges}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                />
              </div>

              {/* Bottom Panel - Tabbed Preview/Validation */}
              <div className="h-64 flex-shrink-0 border-t border-white/10 bg-[var(--color-bg-card)]/50 backdrop-blur-md">
                {/* Tab Headers */}
                <div className="flex items-center border-b border-white/10">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`
                      flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors relative
                      ${activeTab === 'preview' 
                        ? 'text-purple-400' 
                        : 'text-gray-400 hover:text-gray-300'
                      }
                    `}
                  >
                    <FileText className="w-4 h-4" />
                    Strategy Preview
                    {activeTab === 'preview' && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
                      />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('validation')}
                    className={`
                      flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors relative
                      ${activeTab === 'validation' 
                        ? 'text-purple-400' 
                        : 'text-gray-400 hover:text-gray-300'
                      }
                    `}
                  >
                    <AlertCircle className="w-4 h-4" />
                    Validation
                    {(!validation.valid || validation.warnings.length > 0) && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                    {activeTab === 'validation' && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
                      />
                    )}
                  </button>
                </div>

                {/* Tab Content */}
                <div className="h-[calc(100%-41px)] overflow-y-auto">
                  <AnimatePresence mode="wait">
                    {activeTab === 'preview' ? (
                      <motion.div
                        key="preview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="p-4"
                      >
                        <StrategyPreview nodes={nodes} edges={edges} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="validation"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="p-4"
                      >
                        <ValidationFeedback validation={validation} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Load Saved Vaults Modal */}
      <AnimatePresence>
        {showLoadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowLoadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--color-bg-card)] border border-white/10 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">
                  <GradientText>Load Saved Vault</GradientText>
                </h2>
                <button
                  onClick={() => setShowLoadModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto">
                {loadingVaults ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-gray-400">Loading your vaults...</div>
                  </div>
                ) : savedVaults.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400 mb-2">No saved vaults found</p>
                    <p className="text-sm text-gray-500">
                      Create and save a vault to see it here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedVaults.map((vault) => (
                      <div
                        key={vault.vault_id}
                        className="bg-[var(--color-bg-secondary)] border border-white/10 rounded-lg p-4 hover:border-purple-500/50 transition-all cursor-pointer group"
                        onClick={() => handleLoadVault(vault)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                              {vault.name}
                            </h3>
                            {vault.description && (
                              <p className="text-sm text-gray-400 mt-1">
                                {vault.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(vault.updated_at).toLocaleDateString()}
                              </span>
                              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                                {vault.status}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="ml-4"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLoadVault(vault);
                            }}
                          >
                            Load
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="mt-4 pt-4 border-t border-white/10 flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadSavedVaults}
                  disabled={loadingVaults}
                >
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLoadModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VaultBuilder;
