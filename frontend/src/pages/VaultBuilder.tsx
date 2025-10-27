import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { Save, Play, Undo2, Redo2, FileText, AlertCircle, FolderOpen, X, Clock } from 'lucide-react';
import { Button, useModal } from '../components/ui';
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
  const modal = useModal();
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
      modal.message(`Loaded: ${vault.name}`, 'Vault Loaded', 'success');
    } catch (error) {
      modal.message(
        `Failed to load vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Load Failed',
        'error'
      );
    }
  }, [pushState, modal]);

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
      modal.message('Please connect your wallet first', 'Wallet Required', 'warning');
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
        modal.message('Vault draft saved successfully!', 'Saved', 'success');
      } else {
        throw new Error(data.error || 'Failed to save draft');
      }
    } catch (error) {
      console.error('Error saving vault:', error);
      modal.message(
        `Failed to save vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Save Failed',
        'error'
      );
    } finally {
      setSaving(false);
    }
  }, [nodes, edges, address, modal]);

  // Deploy vault
  const handleDeploy = useCallback(async () => {
    const validationResult = BlockValidator.validateVault(nodes, edges);
    
    if (!validationResult.valid) {
      setActiveTab('validation');
      modal.message('Please fix validation errors before deploying', 'Validation Failed', 'error');
      return;
    }

    if (!address) {
      modal.message('Please connect your wallet first', 'Wallet Required', 'warning');
      return;
    }

    const config = ConfigSerializer.serialize(nodes, edges);
    console.log('Deploying vault with config:', config);

    try {
      setDeploying(true);
      
      // Transform config to match backend expectations
      const backendConfig = {
        owner: address,
        name: `Vault ${new Date().toLocaleDateString()}`,
        assets: config.assets.map(asset => asset.code),
        rules: config.rules.map(rule => ({
          condition_type: rule.condition.type,
          threshold: rule.condition.parameters.threshold || 0,
          action: rule.action.type,
          target_allocation: rule.action.parameters.targetAllocation 
            ? [rule.action.parameters.targetAllocation as number]
            : [0],
        })),
      };

      // Deploy vault using connected wallet (no private key needed)
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/vaults`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: backendConfig,
        }),
      });

      const data = await response.json();

      if (data.success) {
        modal.message(
          `Vault ID: ${data.data.vaultId}\n\nContract: ${data.data.contractAddress}`,
          'Vault Deployed Successfully',
          'success'
        );
        // Navigate to dashboard
        navigate('/dashboard');
      } else {
        throw new Error(data.error || 'Failed to deploy vault');
      }
    } catch (error) {
      console.error('Error deploying vault:', error);
      modal.message(
        `Failed to deploy vault: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Deploy Failed',
        'error'
      );
    } finally {
      setDeploying(false);
    }
  }, [nodes, edges, address, navigate, modal]);

  // Load template
  const handleLoadTemplate = useCallback((templateId: string) => {
    const template = vaultTemplates.find(t => t.id === templateId);
    if (!template) return;

    setNodes(template.nodes);
    setEdges(template.edges);
    pushState(template.nodes, template.edges);
  }, [pushState]);

  return (
    <div className="fixed inset-0 bg-app">
      <div className="h-full flex flex-col">
        {/* Clean Minimal Header */}
        <div className="flex-shrink-0 border-b border-default bg-secondary">
          <div className="px-4 py-2.5">
            <div className="flex items-center justify-between">
              {/* Left: Logo + Title */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  title="Back to Home"
                >
                  <img
                    src="/logo.png"
                    alt="Syft Logo"
                    className="w-7 h-7 object-contain"
                  />
                  <span className="text-base font-semibold text-neutral-50">Syft</span>
                </button>
                <div className="w-px h-5 bg-default"></div>
                <h1 className="text-sm font-medium text-neutral-400">Visual Vault Builder</h1>
              </div>

              {/* Center: Templates */}
              <div className="hidden lg:flex items-center gap-1.5">
                <span className="text-xs text-neutral-500 mr-1">Templates:</span>
                {vaultTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleLoadTemplate(template.id)}
                    className="px-2.5 py-1 text-xs rounded-md bg-neutral-900 hover:bg-neutral-800 border border-default transition-colors text-neutral-300 font-medium"
                  >
                    {template.name}
                  </button>
                ))}
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                {/* History */}
                <div className="hidden md:flex items-center gap-1 mr-1">
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    className="p-1.5 rounded-md hover:bg-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-neutral-400 hover:text-neutral-50"
                    title="Undo"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    className="p-1.5 rounded-md hover:bg-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-neutral-400 hover:text-neutral-50"
                    title="Redo"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-default mx-1"></div>
                </div>

                {/* File Operations */}
                <button
                  onClick={() => setShowLoadModal(true)}
                  className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md hover:bg-neutral-900 border border-default transition-colors text-neutral-300"
                  title="Load"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Load</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md hover:bg-neutral-900 border border-default transition-colors text-neutral-300 disabled:opacity-50"
                  title="Save"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
                </button>

                {/* Deploy Button */}
                <button
                  onClick={handleDeploy}
                  disabled={deploying}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary-500 hover:bg-primary-600 text-dark-950 font-semibold transition-colors disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{deploying ? 'Deploying...' : 'Deploy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Fixed Height */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex">
            {/* Left Sidebar - Block Palette */}
            <div className="w-64 flex-shrink-0 border-r border-default bg-card overflow-hidden">
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
              <div className="h-64 flex-shrink-0 border-t border-default bg-secondary">
                {/* Tab Headers */}
                <div className="flex items-center border-b border-default">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`
                      flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors relative
                      ${activeTab === 'preview' 
                        ? 'text-primary-500' 
                        : 'text-neutral-400 hover:text-neutral-300'
                      }
                    `}
                  >
                    <FileText className="w-4 h-4" />
                    Strategy Preview
                    {activeTab === 'preview' && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                      />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('validation')}
                    className={`
                      flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors relative
                      ${activeTab === 'validation' 
                        ? 'text-primary-500' 
                        : 'text-neutral-400 hover:text-neutral-300'
                      }
                    `}
                  >
                    <AlertCircle className="w-4 h-4" />
                    Validation
                    {(!validation.valid || validation.warnings.length > 0) && (
                      <span className="w-2 h-2 rounded-full bg-error-500" />
                    )}
                    {activeTab === 'validation' && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-default rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-neutral-50">
                  Load Saved Vault
                </h2>
                <button
                  onClick={() => setShowLoadModal(false)}
                  className="p-2 hover:bg-neutral-900 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto">
                {loadingVaults ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-neutral-400">Loading your vaults...</div>
                  </div>
                ) : savedVaults.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderOpen className="w-16 h-16 mx-auto mb-4 text-neutral-600" />
                    <p className="text-neutral-400 mb-2">No saved vaults found</p>
                    <p className="text-sm text-neutral-500">
                      Create and save a vault to see it here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedVaults.map((vault) => (
                      <div
                        key={vault.vault_id}
                        className="bg-neutral-900 border border-default rounded-lg p-4 hover:border-hover transition-all cursor-pointer group"
                        onClick={() => handleLoadVault(vault)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-neutral-50 group-hover:text-primary-500 transition-colors">
                              {vault.name}
                            </h3>
                            {vault.description && (
                              <p className="text-sm text-neutral-400 mt-1">
                                {vault.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(vault.updated_at).toLocaleDateString()}
                              </span>
                              <span className="px-2 py-0.5 bg-warning-500/20 text-warning-400 rounded">
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
              <div className="mt-4 pt-4 border-t border-default flex justify-between">
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
