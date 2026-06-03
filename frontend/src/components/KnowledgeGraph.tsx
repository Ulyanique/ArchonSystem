import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import toast from 'react-hot-toast';
import { GraphData } from '../types';
import { linksApi } from '../api';

export type GraphViewType = 'knowledge' | 'space';

const nodeColors: Record<string, { bg: string; border: string; text: string }> = {
  character: { bg: '#3b82f6', border: '#1d4ed8', text: '#ffffff' },
  location: { bg: '#10b981', border: '#047857', text: '#ffffff' },
  chapter: { bg: '#f59e0b', border: '#b45309', text: '#ffffff' },
  note: { bg: '#8b5cf6', border: '#6d28d9', text: '#ffffff' },
  universe: { bg: '#6366f1', border: '#4f46e5', text: '#ffffff' },
  galaxy: { bg: '#7c3aed', border: '#5b21b6', text: '#ffffff' },
  star_system: { bg: '#ea580c', border: '#c2410c', text: '#ffffff' },
  celestial_body: { bg: '#0891b2', border: '#0e7490', text: '#ffffff' },
};

const nodeIcons: Record<string, string> = {
  character: '👤',
  location: '🗺️',
  chapter: '📖',
  note: '📝',
  universe: '🌌',
  galaxy: '🌀',
  star_system: '⭐',
  celestial_body: '🪐',
};

interface KnowledgeGraphProps {
  data: GraphData;
  universeId?: number;
  onNodeClick?: (node: Node) => void;
  graphView?: GraphViewType;
}

function buildNodesFromData(data: GraphData, graphView: GraphViewType = 'knowledge'): Node[] {
  const centerX = 500;
  const centerY = 400;
  const radius = Math.min(300, Math.max(150, Math.sqrt(data.nodes.length) * 80));
  return data.nodes.map((node, index) => {
    const saved = node.position;
    const useSavedPosition = graphView === 'space' && saved != null && typeof saved.x === 'number' && typeof saved.y === 'number';
    const angle = (2 * Math.PI * index) / Math.max(data.nodes.length, 1);
    const x = useSavedPosition ? saved.x! : (saved?.x ?? centerX + radius * Math.cos(angle));
    const y = useSavedPosition ? saved.y! : (saved?.y ?? centerY + radius * Math.sin(angle));
    const color = nodeColors[node.type] || nodeColors.character;
    const icon = nodeIcons[node.type] || '📌';
    return {
      id: node.id,
      type: 'default',
      position: { x, y },
      data: {
        label: (
          <div
            style={{
              padding: '8px 12px',
              background: color.bg,
              border: `2px solid ${color.border}`,
              borderRadius: '8px',
              color: color.text,
              minWidth: '120px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{node.label}</div>
            <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '4px' }}>{node.type}</div>
          </div>
        ),
      },
    };
  });
}

function buildEdgesFromData(data: GraphData): Edge[] {
  return data.links.map((link) => ({
    id: `${link.source}-${link.target}`,
    source: link.source,
    target: link.target,
    label: link.label.replace(/👤|🗺️|📖|📝/g, '').trim(),
    style: { stroke: '#64748b', strokeWidth: 2 },
    labelStyle: { fill: '#64748b', fontWeight: 500, fontSize: '11px' },
    labelBgStyle: { fill: '#f1f5f9' },
    labelBgPadding: [8, 4] as const,
    labelBgBorderRadius: 4,
  }));
}

export default function KnowledgeGraph({ data, universeId, onNodeClick, graphView = 'knowledge' }: KnowledgeGraphProps) {
  const initialNodes = useMemo(() => buildNodesFromData(data, graphView), [data, graphView]);
  const initialEdges = useMemo(() => buildEdgesFromData(data), [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(buildNodesFromData(data, graphView));
    setEdges(buildEdgesFromData(data));
  }, [data, graphView, setNodes, setEdges]);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, __: Node, nodesList: Node[]) => {
      if (graphView === 'knowledge' && universeId != null && nodesList.length > 0) {
        linksApi
          .saveLayout(
            universeId,
            nodesList.map((n) => ({ id: n.id, position: n.position }))
          )
          .catch(() => toast.error('Не удалось сохранить позицию графа'));
      }
    },
    [universeId, graphView]
  );

  const onNodeClickHandler = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeClick) onNodeClick(node);
    },
    [onNodeClick]
  );

  return (
    <div style={{ width: '100%', height: '600px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
      <p className="text-xs text-dark-500 mb-1">Перетащите узлы; позиция сохранится.</p>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        onNodeDragStop={onNodeDragStop}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <Background color="#e2e8f0" gap={20} />
      </ReactFlow>
    </div>
  );
}
