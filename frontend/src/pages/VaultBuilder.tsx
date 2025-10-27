import { motion } from 'framer-motion';
import { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Save, Play, Sparkles } from 'lucide-react';
import { Button, Card, GradientText } from '../components/ui';

const VaultBuilder = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const blockTypes = [
    {
      category: 'Assets',
      blocks: [
        { id: 'xlm', label: 'XLM', color: 'from-purple-600 to-blue-600' },
        { id: 'usdc', label: 'USDC', color: 'from-blue-600 to-cyan-600' },
        { id: 'btc', label: 'BTC', color: 'from-orange-600 to-yellow-600' },
      ],
    },
    {
      category: 'Conditions',
      blocks: [
        { id: 'apy_threshold', label: 'APY Threshold', color: 'from-green-600 to-emerald-600' },
        { id: 'allocation', label: 'Allocation %', color: 'from-teal-600 to-cyan-600' },
        { id: 'time_based', label: 'Time Based', color: 'from-indigo-600 to-purple-600' },
      ],
    },
    {
      category: 'Actions',
      blocks: [
        { id: 'rebalance', label: 'Rebalance', color: 'from-pink-600 to-rose-600' },
        { id: 'stake', label: 'Stake', color: 'from-violet-600 to-purple-600' },
        { id: 'swap', label: 'Swap', color: 'from-fuchsia-600 to-pink-600' },
      ],
    },
  ];

  const addNode = (blockType: string, label: string, color: string) => {
    const newNode: Node = {
      id: `${blockType}_${Date.now()}`,
      type: 'default',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { 
        label: (
          <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${color} text-white font-semibold shadow-lg`}>
            {label}
          </div>
        ) 
      },
    };
    setNodes((nds: Node[]) => [...nds, newNode] as Node[]);
  };

  const handleSave = () => {
    console.log('Saving vault configuration:', { nodes, edges });
    // TODO: Save to backend
  };

  const handleDeploy = () => {
    console.log('Deploying vault...', { nodes, edges });
    // TODO: Deploy to Stellar
  };

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
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
              <Button variant="outline" leftIcon={<Save />} onClick={handleSave}>
                Save Draft
              </Button>
              <Button variant="gradient" leftIcon={<Play />} onClick={handleDeploy}>
                Deploy Vault
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-12 gap-6">
          {/* Block Palette */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="col-span-12 lg:col-span-3"
          >
            <Card className="p-6 sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-bold">Block Palette</h2>
              </div>

              <div className="space-y-6">
                {blockTypes.map((category) => (
                  <div key={category.category}>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">
                      {category.category}
                    </h3>
                    <div className="space-y-2">
                      {category.blocks.map((block) => (
                        <button
                          key={block.id}
                          onClick={() => addNode(block.id, block.label, block.color)}
                          className={`w-full px-4 py-3 rounded-lg bg-gradient-to-r ${block.color} text-white font-semibold shadow-lg hover:scale-105 transition-transform flex items-center justify-between group`}
                        >
                          <span>{block.label}</span>
                          <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-lg bg-purple-600/10 border border-purple-500/20">
                <p className="text-sm text-gray-300">
                  <span className="font-semibold text-purple-400">Tip:</span> Click on blocks to add them to your canvas, then connect them to create your strategy flow.
                </p>
              </div>
            </Card>
          </motion.div>

          {/* Canvas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="col-span-12 lg:col-span-9"
          >
            <div className="rounded-xl overflow-hidden border border-white/10 backdrop-blur-md bg-[var(--color-bg-card)]" style={{ height: '700px' }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                className="bg-[var(--color-bg-secondary)]"
              >
                <Controls className="bg-[var(--color-bg-card)] border border-white/10 rounded-lg" />
                <MiniMap
                  className="bg-[var(--color-bg-card)] border border-white/10 rounded-lg"
                  nodeColor={() => '#8b5cf6'}
                />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#ffffff20" />
              </ReactFlow>
            </div>

            {/* Strategy Preview */}
            {nodes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6"
              >
                <Card gradient className="p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Strategy Preview
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    Your vault will automatically manage{' '}
                    <span className="text-purple-400 font-semibold">{nodes.length} blocks</span>
                    {' '}with{' '}
                    <span className="text-blue-400 font-semibold">{edges.length} connections</span>.
                    Deploy to start earning!
                  </p>
                </Card>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default VaultBuilder;
