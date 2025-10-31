import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { Save, Play, Undo2, Redo2, FileText, AlertCircle, FolderOpen, X, Clock, CheckCircle, Eye, EyeOff } from 'lucide-react';
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
  
  // Vault metadata state
  const [vaultName, setVaultName] = useState('');
  const [vaultDescription, setVaultDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  
  // Post-deployment state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [deployedVaultData, setDeployedVaultData] = useState<{
    vaultId: string;
    contractAddress: string;
    transactionHash: string;
  } | null>(null);

  const { address, network, networkPassphrase } = useWallet();
  const navigate = useNavigate();
  const modal = useModal();
  const { canUndo, canRedo, undo, redo, pushState } = useBuilderHistory(nodes, edges);

  // Load user's saved vaults when component mounts
  useEffect(() => {
    if (address) {
      loadSavedVaults();
    }
  }, [address, network]); // Reload when network changes

  // Map Freighter network names to our backend format
  const normalizeNetwork = (net?: string, passphrase?: string): string => {
    if (!net) return 'testnet';
    
    // Check network passphrase for accurate detection
    if (passphrase) {
      if (passphrase.includes('Test SDF Future')) return 'futurenet';
      if (passphrase.includes('Test SDF Network')) return 'testnet';
      if (passphrase.includes('Public Global')) return 'mainnet';
    }
    
    // Fallback to network name mapping
    const normalized = net.toLowerCase();
    if (normalized === 'standalone' || normalized === 'futurenet') return 'futurenet';
    if (normalized === 'testnet') return 'testnet';
    if (normalized === 'mainnet' || normalized === 'public') return 'mainnet';
    
    return 'testnet'; // Default fallback
  };

  // Load saved vaults from backend
  const loadSavedVaults = async () => {
    if (!address) return;

    try {
      setLoadingVaults(true);
      const normalizedNetwork = normalizeNetwork(network, networkPassphrase);
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/vaults/user/${address}?status=draft&network=${normalizedNetwork}`);
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
      
      // Load metadata
      setVaultName(vault.name || '');
      setVaultDescription(vault.description || '');
      setIsPublic(vault.config?.isPublic ?? true);
      
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
    // Update nodes without triggering another render cycle
    setNodes(updatedNodes);
  }, []);

  // Handle edges change  
  const handleEdgesChange = useCallback((updatedEdges: Edge[]) => {
    // Update edges without triggering another render cycle
    setEdges(updatedEdges);
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
    
    if (!vaultName.trim()) {
      modal.message('Please enter a vault name before saving', 'Name Required', 'warning');
      return;
    }

    try {
      setSaving(true);
      
      // Add metadata to config
      const configWithMetadata = {
        ...config,
        isPublic,
      };
      
      // Save to localStorage as backup
      localStorage.setItem('vault_draft', JSON.stringify(configWithMetadata));
      
      // Save to backend
      const normalizedNetwork = normalizeNetwork(network, networkPassphrase);
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/vaults/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: address,
          name: vaultName,
          description: vaultDescription,
          config: configWithMetadata,
          network: normalizedNetwork,
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
  }, [nodes, edges, address, vaultName, vaultDescription, isPublic, network, networkPassphrase, modal]);

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
    
    if (!vaultName.trim()) {
      modal.message('Please enter a vault name before deploying', 'Name Required', 'warning');
      return;
    }

    const config = ConfigSerializer.serialize(nodes, edges);
    console.log('Deploying vault with config:', config);

    try {
      setDeploying(true);
      
      // Transform config to match backend expectations
      const backendConfig = {
        owner: address,
        name: vaultName,
        description: vaultDescription,
        isPublic,
        assets: config.assets.map(asset => {
          // If issuer exists (contract address or classic issuer), use it; otherwise use code
          // Backend accepts contract addresses (C...) or known symbols (XLM, USDC, etc.)
          return asset.issuer || asset.code;
        }),
        rules: config.rules.map(rule => ({
          condition_type: rule.condition.type,
          threshold: rule.condition.parameters.threshold || 0,
          action: rule.action.type,
          target_allocation: rule.action.parameters.targetAllocation 
            ? [rule.action.parameters.targetAllocation as number]
            : [0],
        })),
      };

      const normalizedNetwork = normalizeNetwork(network, networkPassphrase);
      console.log(`[VaultBuilder] Deploying vault on network: ${normalizedNetwork}`);
      
      const backendUrl = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      // Step 1: Build unsigned transaction from backend
      console.log(`[VaultBuilder] Building unsigned deployment transaction...`);
      const buildResponse = await fetch(`${backendUrl}/api/vaults/build-deployment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: backendConfig,
          userAddress: address,
          network: normalizedNetwork,
        }),
      });

      const buildData = await buildResponse.json();

      if (!buildData.success) {
        throw new Error(buildData.error || 'Failed to build deployment transaction');
      }

      const { xdr, vaultId } = buildData.data;
      console.log(`[VaultBuilder] Transaction built (Vault ID: ${vaultId}), requesting wallet signature...`);

      // Step 2: Sign transaction with user's wallet
      const { wallet } = await import('../util/wallet');
      const { signedTxXdr } = await wallet.signTransaction(xdr, {
        networkPassphrase: networkPassphrase || 'Test SDF Network ; September 2015',
      });

      console.log(`[VaultBuilder] Transaction signed, submitting...`);

      // Step 3: Submit signed transaction
      const submitResponse = await fetch(`${backendUrl}/api/vaults/submit-deployment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signedXDR: signedTxXdr,
          vaultId,
          config: backendConfig,
          network: normalizedNetwork,
        }),
      });

      const submitData = await submitResponse.json();

      // Handle timeout - transaction might still succeed
      if (submitData.timeout) {
        const txHash = submitData.transactionHash;
        const stellarExpertUrl = normalizedNetwork === 'mainnet' 
          ? `https://stellar.expert/explorer/public/tx/${txHash}`
          : `https://stellar.expert/explorer/testnet/tx/${txHash}`;
        
        modal.message(
          `${submitData.error}\n\nTransaction Hash: ${txHash}\n\nView on Stellar Expert: ${stellarExpertUrl}\n\nNote: ${submitData.message}`,
          'Transaction Timeout (Not a Failure)',
          'warning'
        );
        
        // Still try to save the vault to database with pending status
        try {
          await fetch(`${backendUrl}/api/vaults/drafts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              owner: address,
              name: vaultName,
              description: vaultDescription + '\n\n⚠️ Deployment timed out but may have succeeded. TX: ' + txHash,
              config: {
                ...ConfigSerializer.serialize(nodes, edges),
                isPublic,
                pendingTxHash: txHash,
                contractAddress: submitData.contractAddress,
              },
              network: normalizedNetwork,
            }),
          });
        } catch (e) {
          console.error('Failed to save timeout vault draft:', e);
        }
        
        return;
      }

      if (submitData.success) {
        const { vaultId, contractAddress, transactionHash } = submitData.data;
        console.log(`[VaultBuilder] ✅ Vault deployed: ${contractAddress}`);
        console.log(`[VaultBuilder] TX Hash: ${transactionHash}`);
        
        // Step 4: Initialize the vault contract (if not already initialized by backend)
        try {
          console.log(`[VaultBuilder] Checking if vault needs initialization...`);
          
          // Build initialization transaction
          const initBuildResponse = await fetch(`${backendUrl}/api/vaults/build-initialize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contractAddress,
              config: backendConfig,
              sourceAddress: address,
              network: normalizedNetwork,
            }),
          });

          const initBuildData = await initBuildResponse.json();

          if (!initBuildData.success) {
            // Check if already initialized (Error #1 = AlreadyInitialized)
            if (initBuildData.error?.includes('Error(Contract, #1)') || 
                initBuildData.error?.includes('AlreadyInitialized')) {
              console.log(`[VaultBuilder] ✅ Vault already initialized by backend`);
              // Skip initialization - already done
            } else {
              throw new Error(initBuildData.error || 'Failed to build initialization transaction');
            }
          } else {

            console.log(`[VaultBuilder] Initialization transaction built, requesting wallet signature...`);

            // Sign initialization transaction
            const { wallet } = await import('../util/wallet');
            const { signedTxXdr: signedInitXdr } = await wallet.signTransaction(initBuildData.data.xdr, {
              networkPassphrase: networkPassphrase || 'Test SDF Network ; September 2015',
            });

            console.log(`[VaultBuilder] Initialization transaction signed, submitting...`);

            // Submit initialization transaction
            const initSubmitResponse = await fetch(`${backendUrl}/api/vaults/submit-initialize`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                signedXDR: signedInitXdr,
                contractAddress,
                network: normalizedNetwork,
              }),
            });

            const initSubmitData = await initSubmitResponse.json();

            if (initSubmitData.success) {
              console.log(`[VaultBuilder] ✅ Vault initialized successfully`);
            } else {
              console.warn(`[VaultBuilder] ⚠️ Vault deployed but initialization failed:`, initSubmitData.error);
              modal.message(
                `Vault deployed but initialization failed. You may need to initialize manually.\n\nContract: ${contractAddress}`,
                'Initialization Failed',
                'warning'
              );
              return;
            }
          }
        } catch (initError) {
          console.error(`[VaultBuilder] Error during initialization:`, initError);
          modal.message(
            `Vault deployed but initialization failed. You may need to initialize manually.\n\nContract: ${contractAddress}`,
            'Initialization Failed',
            'warning'
          );
          return;
        }

        // Step 5: Set router address for auto-swap functionality
        try {
          console.log(`[VaultBuilder] Setting up router for auto-swap...`);
          
          // Build set_router transaction
          const routerBuildResponse = await fetch(`${backendUrl}/api/vaults/build-set-router`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contractAddress,
              ownerAddress: address,
              network: normalizedNetwork,
            }),
          });

          const routerBuildData = await routerBuildResponse.json();

          if (!routerBuildData.success) {
            console.warn(`[VaultBuilder] ⚠️ Router setup failed:`, routerBuildData.error);
            // Don't fail the deployment, just warn the user
            modal.message(
              `Vault deployed successfully but router setup failed. Auto-swap may not work.\n\nYou can set the router manually later.`,
              'Router Setup Failed',
              'warning'
            );
          } else {
            console.log(`[VaultBuilder] Router transaction built, requesting wallet signature...`);

            // Sign router transaction
            const { wallet } = await import('../util/wallet');
            const { signedTxXdr: signedRouterXdr } = await wallet.signTransaction(routerBuildData.data.xdr, {
              networkPassphrase: networkPassphrase || 'Test SDF Network ; September 2015',
            });

            console.log(`[VaultBuilder] Router transaction signed, submitting...`);

            // Submit router transaction
            const routerSubmitResponse = await fetch(`${backendUrl}/api/vaults/submit-set-router`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                signedXDR: signedRouterXdr,
                contractAddress,
                network: normalizedNetwork,
              }),
            });

            const routerSubmitData = await routerSubmitResponse.json();

            if (routerSubmitData.success) {
              console.log(`[VaultBuilder] ✅ Router configured successfully! Auto-swap enabled.`);
            } else {
              console.warn(`[VaultBuilder] ⚠️ Router submission failed:`, routerSubmitData.error);
            }
          }
        } catch (routerError) {
          console.error(`[VaultBuilder] Error setting up router:`, routerError);
          // Don't fail the deployment if router setup fails
          console.warn(`[VaultBuilder] Continuing without router - auto-swap will not work`);
        }

        // Success - deployment, initialization, and router setup complete
        setDeployedVaultData({
          vaultId,
          contractAddress,
          transactionHash,
        });
        setShowSuccessModal(true);
      } else {
        throw new Error(submitData.error || 'Failed to deploy vault');
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
  }, [nodes, edges, address, vaultName, vaultDescription, isPublic, network, networkPassphrase, modal]);

  // Load template
  const handleLoadTemplate = useCallback((templateId: string) => {
    const template = vaultTemplates.find(t => t.id === templateId);
    if (!template) return;

    setNodes(template.nodes);
    setEdges(template.edges);
    pushState(template.nodes, template.edges);
  }, [pushState]);

  return (
    <div className="h-full bg-app flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-default bg-secondary">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Title & Vault Name */}
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-neutral-50">Vault Builder</h1>
              <div className="h-6 w-px bg-default"></div>
              <input
                type="text"
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                placeholder="Enter vault name..."
                className="px-3 py-1.5 bg-neutral-900 border border-default rounded-md text-neutral-50 placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64"
              />
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* History */}
              <div className="flex items-center gap-1 mr-1">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="p-2 rounded-md hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-neutral-400 hover:text-neutral-50"
                  title="Undo"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="p-2 rounded-md hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-neutral-400 hover:text-neutral-50"
                  title="Redo"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>

              <div className="w-px h-6 bg-default"></div>

              {/* File Operations */}
              <button
                onClick={() => setShowLoadModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-neutral-800 border border-default transition-colors text-neutral-300"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Load</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-neutral-800 border border-default transition-colors text-neutral-300 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Draft'}</span>
              </button>

              <div className="w-px h-6 bg-default"></div>

              {/* Deploy Button */}
              <button
                onClick={handleDeploy}
                disabled={deploying || !validation.valid}
                className="flex items-center gap-2 px-4 py-1.5 text-sm rounded-md bg-primary-500 hover:bg-primary-600 text-dark-950 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                <span>{deploying ? 'Deploying...' : 'Deploy Vault'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Sidebar - Block Palette */}
        <div className="w-72 flex-shrink-0 border-r border-default bg-card overflow-hidden flex flex-col">
          {/* <div className="p-4 border-b border-default">
            <h2 className="text-sm font-semibold text-neutral-50 mb-1">Block Palette</h2>
            <p className="text-xs text-neutral-500">Drag blocks to canvas</p>
          </div> */}
          <div className="flex-1 overflow-y-auto">
            <BlockPalette onBlockSelect={handleBlockSelect} />
          </div>
          
          {/* Quick Templates */}
          <div className="border-t border-default p-3 bg-neutral-900">
            <h3 className="text-xs font-semibold text-neutral-400 mb-2">Quick Start Templates</h3>
            <div className="space-y-1.5">
              {vaultTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleLoadTemplate(template.id)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-md bg-neutral-800 hover:bg-neutral-700 border border-default transition-colors text-neutral-300 text-left"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center - Canvas Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <VaultCanvas
            initialNodes={nodes}
            initialEdges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
          />
        </div>

        {/* Right Sidebar - Vault Settings & Validation */}
        <div className="w-80 flex-shrink-0 border-l border-default bg-card overflow-hidden flex flex-col">
          {/* Vault Settings */}
          <div className="border-b border-default">
            <div className="p-4 bg-neutral-900">
              <h2 className="text-sm font-semibold text-neutral-50 mb-3">Vault Settings</h2>
              
              {/* Description */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                  Description
                </label>
                <textarea
                  value={vaultDescription}
                  onChange={(e) => setVaultDescription(e.target.value)}
                  placeholder="Describe your vault strategy..."
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2 bg-neutral-800 border border-default rounded-md text-neutral-50 placeholder-neutral-500 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
                <div className="flex justify-end mt-1">
                  <span className="text-xs text-neutral-500">
                    {vaultDescription.length}/500
                  </span>
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                  Visibility
                </label>
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={`
                    w-full px-3 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-between
                    ${isPublic 
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50 hover:bg-primary-500/30' 
                      : 'bg-neutral-800 text-neutral-400 border border-default hover:bg-neutral-700'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    {isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span>{isPublic ? 'Public' : 'Private'}</span>
                  </div>
                  <span className="text-xs opacity-70">
                    {isPublic ? 'Visible on marketplace' : 'Only you can see'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Validation & Preview Tabs */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex border-b border-default bg-neutral-900">
              <button
                onClick={() => setActiveTab('preview')}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors relative
                  ${activeTab === 'preview' 
                    ? 'text-primary-500 bg-card' 
                    : 'text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800'
                  }
                `}
              >
                <FileText className="w-4 h-4" />
                <span>Preview</span>
              </button>
              <button
                onClick={() => setActiveTab('validation')}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors relative
                  ${activeTab === 'validation' 
                    ? 'text-primary-500 bg-card' 
                    : 'text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800'
                  }
                `}
              >
                <AlertCircle className="w-4 h-4" />
                <span>Validation</span>
                {(!validation.valid || validation.warnings.length > 0) && (
                  <span className="w-2 h-2 rounded-full bg-error-500" />
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <AnimatePresence mode="wait">
                {activeTab === 'preview' ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <StrategyPreview nodes={nodes} edges={edges} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="validation"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ValidationFeedback validation={validation} />
                  </motion.div>
                )}
              </AnimatePresence>
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

      {/* Deployment Success Modal */}
      <AnimatePresence>
        {showSuccessModal && deployedVaultData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowSuccessModal(false);
              navigate('/app/dashboard');
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-default rounded-lg p-6 max-w-lg w-full"
            >
              {/* Success Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-success-500/20 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-success-400" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-neutral-50 text-center mb-2">
                Vault Deployed Successfully!
              </h2>
              <p className="text-neutral-400 text-center mb-6">
                Your vault is now active and ready to use
              </p>

              {/* Vault Details */}
              <div className="space-y-3 mb-6 p-4 bg-neutral-900 rounded-lg">
                <div>
                  <span className="text-xs text-neutral-500">Vault Name</span>
                  <p className="text-sm text-neutral-50 font-medium">{vaultName}</p>
                </div>
                <div>
                  <span className="text-xs text-neutral-500">Vault ID</span>
                  <p className="text-sm text-neutral-50 font-mono">{deployedVaultData.vaultId}</p>
                </div>
                <div>
                  <span className="text-xs text-neutral-500">Contract Address</span>
                  <p className="text-sm text-neutral-50 font-mono break-all">
                    {deployedVaultData.contractAddress}
                  </p>
                </div>
                {isPublic && (
                  <div className="pt-2 border-t border-default">
                    <span className="text-xs text-success-400 flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      Public vault - visible in marketplace
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate(`/app/vaults/${deployedVaultData.vaultId}`);
                  }}
                >
                  View Vault Details
                </Button>
                
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/app/dashboard');
                  }}
                >
                  Go to Dashboard
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setShowSuccessModal(false);
                    // Reset builder for new vault
                    setNodes([]);
                    setEdges([]);
                    setVaultName('');
                    setVaultDescription('');
                    setIsPublic(true);
                  }}
                >
                  Create Another Vault
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
