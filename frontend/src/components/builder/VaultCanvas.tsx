import { useCallback, useRef, useState, useEffect } from 'react';
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
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import AssetBlock from './blocks/AssetBlock';
import ConditionBlock from './blocks/ConditionBlock';
import ActionBlock from './blocks/ActionBlock';
import type { PaletteItem } from '../../types/blocks';

interface VaultCanvasProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
}

// Wrapper components to pass the id prop
const AssetBlockWrapper = (props: NodeProps) => (
  <AssetBlock id={props.id} data={props.data as any} selected={props.selected} />
);

const ConditionBlockWrapper = (props: NodeProps) => (
  <ConditionBlock id={props.id} data={props.data as any} selected={props.selected} />
);

const ActionBlockWrapper = (props: NodeProps) => (
  <ActionBlock id={props.id} data={props.data as any} selected={props.selected} />
);

const nodeTypes: NodeTypes = {
  asset: AssetBlockWrapper,
  condition: ConditionBlockWrapper,
  action: ActionBlockWrapper,
};

const VaultCanvas = ({ initialNodes = [], initialEdges = [], onNodesChange, onEdgesChange }: VaultCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<Edge>(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [nodeId, setNodeId] = useState(0);

  // Track if we're currently syncing from parent to avoid loops
  const isSyncingFromParent = useRef(false);

  // Track previous props to detect external changes
  const prevInitialNodesRef = useRef<Node[]>(initialNodes);
  const prevInitialEdgesRef = useRef<Edge[]>(initialEdges);

  // Update internal state when external props change
  useEffect(() => {
    const nodesChanged = JSON.stringify(initialNodes) !== JSON.stringify(prevInitialNodesRef.current);
    const edgesChanged = JSON.stringify(initialEdges) !== JSON.stringify(prevInitialEdgesRef.current);
    
    if (nodesChanged || edgesChanged) {
      prevInitialNodesRef.current = initialNodes;
      prevInitialEdgesRef.current = initialEdges;
      
      // Set flag to prevent notifying parent of this change
      isSyncingFromParent.current = true;
      
      if (nodesChanged) {
        setNodes(initialNodes);
      }
      if (edgesChanged) {
        setEdges(initialEdges);
      }
      
      // Reset flag after state updates are complete
      setTimeout(() => {
        isSyncingFromParent.current = false;
      }, 0);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

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

  // Notify parent of changes - wrap the parent callbacks to avoid infinite loops
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChangeInternal(changes);
    },
    [onNodesChangeInternal]
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChangeInternal(changes);
    },
    [onEdgesChangeInternal]
  );

  // Sync with parent - only notify when internal changes occur
  useEffect(() => {
    // Skip if we're syncing from parent props
    if (isSyncingFromParent.current) {
      return;
    }

    if (onNodesChange) {
      onNodesChange(nodes);
    }
  }, [nodes, onNodesChange]);

  useEffect(() => {
    // Skip if we're syncing from parent props
    if (isSyncingFromParent.current) {
      return;
    }

    if (onEdgesChange) {
      onEdgesChange(edges);
    }
  }, [edges, onEdgesChange]);

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
