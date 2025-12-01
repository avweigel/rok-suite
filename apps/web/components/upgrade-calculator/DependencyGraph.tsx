'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Check, Minus, Plus, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { BUILDINGS_DATA, type CurrentBuildingLevels } from '@/lib/upgrade-calculator/buildings';

interface GraphNode {
  id: string;
  name: string;
  category: 'military' | 'economy' | 'development' | 'other';
  requiredLevel: number;
  currentLevel: number;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

interface DependencyGraphProps {
  requirements: { buildingId: string; requiredLevel: number }[];
  currentLevels: CurrentBuildingLevels;
  onLevelChange: (buildingId: string, level: number) => void;
  targetCityHall: number;
}

// Category colors
const CATEGORY_COLORS = {
  military: {
    fill: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.6)',
    text: '#fca5a5',
  },
  economy: {
    fill: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.6)',
    text: '#6ee7b7',
  },
  development: {
    fill: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.15)',
    border: 'rgba(59, 130, 246, 0.6)',
    text: '#93c5fd',
  },
  other: {
    fill: '#71717a',
    bg: 'rgba(113, 113, 122, 0.15)',
    border: 'rgba(113, 113, 122, 0.6)',
    text: '#a1a1aa',
  },
};

const MET_COLORS = {
  fill: '#10b981',
  bg: 'rgba(16, 185, 129, 0.2)',
  border: 'rgba(16, 185, 129, 0.8)',
  text: '#6ee7b7',
};

export function DependencyGraph({
  requirements,
  currentLevels,
  onLevelChange,
  targetCityHall,
}: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Build graph data from requirements
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    const edgeSet = new Set<string>();
    const edges: GraphEdge[] = [];

    // Add City Hall as the root
    nodeMap.set('city_hall', {
      id: 'city_hall',
      name: 'City Hall',
      category: 'development',
      requiredLevel: targetCityHall,
      currentLevel: targetCityHall - 1,
      x: 0,
      y: 0,
    });

    // Process all requirements and build the graph
    function processBuilding(buildingId: string, requiredLevel: number) {
      if (buildingId === 'city_hall') return;

      const building = BUILDINGS_DATA[buildingId];
      if (!building) return;

      // Add or update node
      const existing = nodeMap.get(buildingId);
      if (!existing || existing.requiredLevel < requiredLevel) {
        nodeMap.set(buildingId, {
          id: buildingId,
          name: building.name,
          category: building.category,
          requiredLevel,
          currentLevel: currentLevels[buildingId] || 0,
          x: 0,
          y: 0,
        });
      }

      // Get prerequisites and add edges
      for (let lvl = 1; lvl <= requiredLevel; lvl++) {
        const levelData = building.levels.find(l => l.level === lvl);
        if (levelData) {
          for (const prereq of levelData.prerequisites) {
            if (prereq.buildingId !== 'city_hall') {
              const edgeKey = `${prereq.buildingId}->${buildingId}`;
              if (!edgeSet.has(edgeKey)) {
                edgeSet.add(edgeKey);
                edges.push({ from: prereq.buildingId, to: buildingId });
              }
              processBuilding(prereq.buildingId, prereq.level);
            }
          }
        }
      }
    }

    // Process direct City Hall requirements
    for (const req of requirements) {
      const edgeKey = `${req.buildingId}->city_hall`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edges.push({ from: req.buildingId, to: 'city_hall' });
      }
      processBuilding(req.buildingId, req.requiredLevel);
    }

    // Layout nodes in a hierarchical/radial pattern
    const nodes = Array.from(nodeMap.values());

    // Calculate levels (distance from City Hall)
    const levels = new Map<string, number>();
    levels.set('city_hall', 0);

    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of edges) {
        const toLevel = levels.get(edge.to);
        if (toLevel !== undefined) {
          const fromLevel = levels.get(edge.from);
          if (fromLevel === undefined || fromLevel <= toLevel) {
            levels.set(edge.from, toLevel + 1);
            changed = true;
          }
        }
      }
    }

    // Group nodes by level
    const nodesByLevel = new Map<number, GraphNode[]>();
    for (const node of nodes) {
      const level = levels.get(node.id) || 0;
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(node);
    }

    // Position nodes
    const maxLevel = Math.max(...Array.from(levels.values()));
    const centerX = 400;
    const centerY = 300;
    const levelSpacing = 140;

    for (const [level, levelNodes] of nodesByLevel.entries()) {
      const radius = level * levelSpacing;
      const angleStep = (2 * Math.PI) / Math.max(levelNodes.length, 1);
      const startAngle = -Math.PI / 2; // Start from top

      if (level === 0) {
        // City Hall at center
        levelNodes[0].x = centerX;
        levelNodes[0].y = centerY;
      } else {
        // Arrange nodes in a circle around the center
        levelNodes.forEach((node, i) => {
          const angle = startAngle + i * angleStep;
          node.x = centerX + radius * Math.cos(angle);
          node.y = centerY + radius * Math.sin(angle);
        });
      }
    }

    return { nodes, edges };
  }, [requirements, currentLevels, targetCityHall]);

  // Mouse handlers for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.3, Math.min(2, z * delta)));
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Get node by ID
  const getNode = useCallback((id: string) => nodes.find(n => n.id === id), [nodes]);

  // Calculate SVG viewBox based on nodes
  const viewBox = useMemo(() => {
    if (nodes.length === 0) return '0 0 800 600';
    const padding = 100;
    const minX = Math.min(...nodes.map(n => n.x)) - padding;
    const maxX = Math.max(...nodes.map(n => n.x)) + padding;
    const minY = Math.min(...nodes.map(n => n.y)) - padding;
    const maxY = Math.max(...nodes.map(n => n.y)) + padding;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [nodes]);

  const selectedNodeData = selectedNode ? getNode(selectedNode) : null;

  return (
    <div className="relative">
      {/* Graph container */}
      <div
        ref={containerRef}
        className="relative w-full h-[400px] md:h-[500px] bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-800"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg
          className="w-full h-full"
          viewBox={viewBox}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center',
          }}
        >
          {/* Gradient definitions */}
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#52525b" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge, i) => {
            const fromNode = getNode(edge.from);
            const toNode = getNode(edge.to);
            if (!fromNode || !toNode) return null;

            // Calculate edge path with curve
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Offset from node centers
            const nodeRadius = 45;
            const fromX = fromNode.x + (dx / dist) * nodeRadius;
            const fromY = fromNode.y + (dy / dist) * nodeRadius;
            const toX = toNode.x - (dx / dist) * (nodeRadius + 5);
            const toY = toNode.y - (dy / dist) * (nodeRadius + 5);

            // Control point for curve
            const midX = (fromX + toX) / 2;
            const midY = (fromY + toY) / 2;
            const perpX = -(toY - fromY) * 0.1;
            const perpY = (toX - fromX) * 0.1;

            const isMet = fromNode.currentLevel >= fromNode.requiredLevel;

            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={`M ${fromX} ${fromY} Q ${midX + perpX} ${midY + perpY} ${toX} ${toY}`}
                fill="none"
                stroke={isMet ? '#10b981' : '#52525b'}
                strokeWidth={isMet ? 2.5 : 2}
                strokeOpacity={isMet ? 0.8 : 0.5}
                markerEnd="url(#arrowhead)"
                className="transition-all duration-300"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const isMet = node.currentLevel >= node.requiredLevel;
            const isSelected = selectedNode === node.id;
            const colors = isMet ? MET_COLORS : CATEGORY_COLORS[node.category];
            const isCityHall = node.id === 'city_hall';

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => !isCityHall && setSelectedNode(isSelected ? null : node.id)}
                className="cursor-pointer"
                style={{ filter: isSelected ? 'url(#glow)' : undefined }}
              >
                {/* Node background */}
                <circle
                  r={isCityHall ? 55 : 45}
                  fill={colors.bg}
                  stroke={colors.border}
                  strokeWidth={isSelected ? 3 : 2}
                  className="transition-all duration-200"
                />

                {/* Inner circle */}
                <circle
                  r={isCityHall ? 48 : 38}
                  fill="rgba(24, 24, 27, 0.9)"
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeOpacity={0.3}
                />

                {/* Building name */}
                <text
                  y={isCityHall ? -8 : -6}
                  textAnchor="middle"
                  fill={colors.text}
                  fontSize={isCityHall ? 11 : 10}
                  fontWeight="600"
                  className="select-none"
                >
                  {node.name.length > 12 ? node.name.slice(0, 10) + '...' : node.name}
                </text>

                {/* Level display */}
                <text
                  y={12}
                  textAnchor="middle"
                  fill={isMet ? '#6ee7b7' : '#fbbf24'}
                  fontSize={isCityHall ? 18 : 16}
                  fontWeight="700"
                  className="select-none"
                >
                  {isCityHall ? node.requiredLevel : `${node.currentLevel}/${node.requiredLevel}`}
                </text>

                {/* Check mark for met requirements */}
                {isMet && !isCityHall && (
                  <circle
                    cx={30}
                    cy={-30}
                    r={10}
                    fill="#10b981"
                  />
                )}
                {isMet && !isCityHall && (
                  <path
                    d="M 25 -30 L 29 -26 L 36 -34"
                    fill="none"
                    stroke="white"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex gap-1">
          <button
            onClick={() => setZoom(z => Math.min(2, z * 1.2))}
            className="p-2 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.3, z * 0.8))}
            className="p-2 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="p-2 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2 text-[10px]">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800/90">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-zinc-400">Military</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800/90">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-400">Economy</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800/90">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-zinc-400">Development</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-3 left-3 text-[10px] text-zinc-500">
          Drag to pan • Scroll to zoom • Click node to edit
        </div>
      </div>

      {/* Selected node editor */}
      {selectedNodeData && selectedNodeData.id !== 'city_hall' && (
        <div className="mt-3 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`font-semibold ${
                selectedNodeData.currentLevel >= selectedNodeData.requiredLevel
                  ? 'text-emerald-400'
                  : CATEGORY_COLORS[selectedNodeData.category].text
              }`}>
                {selectedNodeData.name}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {selectedNodeData.currentLevel >= selectedNodeData.requiredLevel
                  ? 'Requirement met!'
                  : `Need ${selectedNodeData.requiredLevel - selectedNodeData.currentLevel} more level${selectedNodeData.requiredLevel - selectedNodeData.currentLevel > 1 ? 's' : ''}`
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onLevelChange(selectedNodeData.id, selectedNodeData.currentLevel - 1)}
                disabled={selectedNodeData.currentLevel <= 0}
                className="w-10 h-10 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xl font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="w-20 text-center">
                <div className={`text-2xl font-bold ${
                  selectedNodeData.currentLevel >= selectedNodeData.requiredLevel
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}>
                  {selectedNodeData.currentLevel}
                </div>
                <div className="text-xs text-zinc-500">
                  / {selectedNodeData.requiredLevel} required
                </div>
              </div>
              <button
                onClick={() => onLevelChange(selectedNodeData.id, selectedNodeData.currentLevel + 1)}
                disabled={selectedNodeData.currentLevel >= 25}
                className="w-10 h-10 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xl font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
          {selectedNodeData.currentLevel < selectedNodeData.requiredLevel && (
            <button
              onClick={() => onLevelChange(selectedNodeData.id, selectedNodeData.requiredLevel)}
              className="mt-3 w-full py-2 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 transition-colors text-sm font-medium"
            >
              Set to {selectedNodeData.requiredLevel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
