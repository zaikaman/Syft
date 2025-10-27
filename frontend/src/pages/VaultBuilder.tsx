import { motion } from 'framer-motion';
import { useState, useCallback, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { Save, Play, Undo2, Redo2, Download, Upload, Sparkles } from 'lucide-react';
import { Button, Card, GradientText } from '../components/ui';
import BlockPalette from '../components/builder/BlockPalette';
import VaultCanvas from '../components/builder/VaultCanvas';
import ValidationFeedback from '../components/builder/ValidationFeedback';
import StrategyPreview from '../components/builder/StrategyPreview';
import { BlockValidator } from '../lib/blockValidator';
import { ConfigSerializer } from '../lib/configSerializer';
import { useBuilderHistory } from '../hooks/useBuilderHistory';
import { vaultTemplates } from '../data/vaultTemplates';
import type { PaletteItem, ValidationResult } from '../types/blocks';


const VaultBuilder = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [validation, setValidation] = useState<ValidationResult>({
    valid: true,
    errors: [],
    warnings: [],
  });
  const [showValidation, setShowValidation] = useState(false);

  const { canUndo, canRedo, undo, redo, pushState } = useBuilderHistory(nodes, edges);

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
    pushState(updatedNodes, edges);
  }, [edges, pushState]);

  // Handle edges change
  const handleEdgesChange = useCallback((updatedEdges: Edge[]) => {
    setEdges(updatedEdges);
    pushState(nodes, updatedEdges);
  }, [nodes, pushState]);

  // Save vault configuration
  const handleSave = useCallback(() => {
    const config = ConfigSerializer.serialize(nodes, edges);
    console.log('Saving vault configuration:', config);
    
    // Save to localStorage for now
    localStorage.setItem('vault_draft', JSON.stringify(config));
    
    // TODO: Save to backend/Supabase
    alert('Vault draft saved!');
  }, [nodes, edges]);

  // Deploy vault
  const handleDeploy = useCallback(() => {
    const validationResult = BlockValidator.validateVault(nodes, edges);
    
    if (!validationResult.valid) {
      setShowValidation(true);
      alert('Please fix validation errors before deploying');
      return;
    }

    const config = ConfigSerializer.serialize(nodes, edges);
    console.log('Deploying vault with config:', config);
    
    // TODO: Deploy to Stellar blockchain
    alert('Vault deployment initiated! (Integration pending)');
  }, [nodes, edges]);

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
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <GradientText>Visual Vault Builder</GradientText>
              </h1>
              <p className="text-gray-400 text-lg">
                Drag and drop blocks to create your yield strategy
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                leftIcon={<Undo2 />}
                onClick={undo}
                disabled={!canUndo}
                className="hidden md:flex"
              >
                Undo
              </Button>
              <Button
                variant="outline"
                leftIcon={<Redo2 />}
                onClick={redo}
                disabled={!canRedo}
                className="hidden md:flex"
              >
                Redo
              </Button>
              <Button variant="outline" leftIcon={<Download />} onClick={handleExport}>
                Export
              </Button>
              <Button variant="outline" leftIcon={<Upload />} onClick={handleImport}>
                Import
              </Button>
              <Button variant="outline" leftIcon={<Save />} onClick={handleSave}>
                Save Draft
              </Button>
              <Button variant="gradient" leftIcon={<Play />} onClick={handleDeploy}>
                Deploy Vault
              </Button>
            </div>
          </div>

          {/* Validation feedback */}
          {showValidation && (!validation.valid || validation.warnings.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <ValidationFeedback
                validation={validation}
                onClose={() => setShowValidation(false)}
              />
            </motion.div>
          )}

          {/* Template selector */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-4"
          >
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-semibold">Quick Start:</span>
                <div className="flex gap-2 flex-wrap">
                  {vaultTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleLoadTemplate(template.id)}
                      className="px-3 py-1 text-sm rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 transition-colors"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-12 gap-6">
          {/* Block Palette - Left Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="col-span-12 lg:col-span-3"
          >
            <div className="sticky top-24">
              <BlockPalette onBlockSelect={handleBlockSelect} />
            </div>
          </motion.div>

          {/* Canvas - Center */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="col-span-12 lg:col-span-9 space-y-6"
          >
            {/* Canvas */}
            <div className="rounded-xl overflow-hidden border border-white/10 backdrop-blur-md bg-[var(--color-bg-card)]" style={{ height: '600px' }}>
              <VaultCanvas
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
              />
            </div>

            {/* Strategy Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <StrategyPreview nodes={nodes} edges={edges} />
            </motion.div>

            {/* Real-time validation (bottom) */}
            {!showValidation && (!validation.valid || validation.warnings.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ValidationFeedback validation={validation} />
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default VaultBuilder;
