import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import AssetBlock from './blocks/AssetBlock';
import ConditionBlock from './blocks/ConditionBlock';
import ActionBlock from './blocks/ActionBlock';
import type { PaletteItem } from '../../types/blocks';

interface VaultCanvasProps {
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
}

const nodeTypes: NodeTypes = {
  asset: AssetBlock,
  condition: ConditionBlock,
  action: ActionBlock,
};

const VaultCanvas = ({ onNodesChange, onEdgesChange }: VaultCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [nodeId, setNodeId] = useState(0);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true } as Edge, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const paletteItemData = event.dataTransfer.getData('application/reactflow');

      if (!paletteItemData) return;

      const paletteItem: PaletteItem = JSON.parse(paletteItemData);
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: `${paletteItem.type}-${nodeId}`,
        type: paletteItem.type,
        position,
        data: {
          ...paletteItem.defaultData,
          label: paletteItem.label,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setNodeId((id) => id + 1);
    },
    [reactFlowInstance, nodeId, setNodes]
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      console.log('Nodes deleted:', deleted);
    },
    []
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      console.log('Edges deleted:', deleted);
    },
    []
  );

  // Notify parent of changes
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChangeInternal(changes);
      if (onNodesChange) {
        onNodesChange(nodes);
      }
    },
    [nodes, onNodesChange, onNodesChangeInternal]
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChangeInternal(changes);
      if (onEdgesChange) {
        onEdgesChange(edges);
      }
    },
    [edges, onEdgesChange, onEdgesChangeInternal]
  );

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50 dark:bg-gray-900"
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'asset':
                return '#3b82f6'; // blue
              case 'condition':
                return '#a855f7'; // purple
              case 'action':
                return '#f97316'; // orange
              default:
                return '#6b7280'; // gray
            }
          }}
          className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
        />
      </ReactFlow>
    </div>
  );
};

export default VaultCanvas;
