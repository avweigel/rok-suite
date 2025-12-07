'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Moon, Sun, RotateCcw, RotateCw } from 'lucide-react';
import type { Player, MapAssignments, MapAssignment } from '@/lib/aoo-strategy/types';

type TeamNumber = 1 | 2 | 3 | null;

interface Building {
  id: string;
  name: string;
  shortName: string;
  x: number;
  y: number;
}

interface Props {
  initialAssignments?: MapAssignments;
  onSave?: (assignments: MapAssignments) => void;
  isEditor?: boolean;
  players?: Player[];
}

// Re-export for backward compatibility
export type { MapAssignments };

// All buildings on the map with positions (percentages based on new map)
const buildings: Building[] = [
  // Obelisks
  { id: 'obelisk-1', name: 'Obelisk (Upper)', shortName: 'Ob-Upper', x: 50, y: 12 },
  { id: 'obelisk-2', name: 'Obelisk (Left)', shortName: 'Ob-Left', x: 10, y: 40 },
  { id: 'obelisk-3', name: 'Obelisk (Right)', shortName: 'Ob-Right', x: 90, y: 40 },
  { id: 'obelisk-4', name: 'Obelisk (Lower)', shortName: 'Ob-Lower', x: 42, y: 78 },
  
  // Outposts of Iset (your side - upper left)
  { id: 'iset-1', name: 'Outpost of Iset 1', shortName: 'Iset-1', x: 35, y: 15 },
  { id: 'iset-2', name: 'Outpost of Iset 2', shortName: 'Iset-2', x: 15, y: 24 },
  { id: 'iset-3', name: 'Outpost of Iset 3', shortName: 'Iset-3', x: 35, y: 28 },
  
  // Outposts of Seth (enemy side - lower right)
  { id: 'seth-1', name: 'Outpost of Seth 1', shortName: 'Seth-1', x: 65, y: 60 },
  { id: 'seth-2', name: 'Outpost of Seth 2', shortName: 'Seth-2', x: 85, y: 60 },
  { id: 'seth-3', name: 'Outpost of Seth 3', shortName: 'Seth-3', x: 65, y: 73 },
  
  // Shrines of War
  { id: 'war-1', name: 'Shrine of War (Left)', shortName: 'War-L', x: 28, y: 46 },
  { id: 'war-2', name: 'Shrine of War (Right)', shortName: 'War-R', x: 72, y: 38 },
  
  // Shrines of Life
  { id: 'life-1', name: 'Shrine of Life (Right)', shortName: 'Life-R', x: 72, y: 18 },
  { id: 'life-2', name: 'Shrine of Life (Left)', shortName: 'Life-L', x: 22, y: 73 },
  
  // Desert Altars
  { id: 'desert-1', name: 'Desert Altar (Right)', shortName: 'Des-R', x: 55, y: 28 },
  { id: 'desert-2', name: 'Desert Altar (Left)', shortName: 'Des-L', x: 42, y: 60 },
  
  // Sky Altars
  { id: 'sky-1', name: 'Sky Altar (Right)', shortName: 'Sky-R', x: 88, y: 25 },
  { id: 'sky-2', name: 'Sky Altar (Left)', shortName: 'Sky-L', x: 10, y: 58 },
  
  // Ark (center)
  { id: 'ark', name: 'Ark', shortName: 'Ark', x: 48, y: 43 },
];

// Zone colors - colorblind friendly
const teamColors: Record<number, { bg: string; text: string; name: string }> = {
  1: { bg: '#2563EB', text: 'white', name: 'Zone 1' },
  2: { bg: '#D97706', text: 'white', name: 'Zone 2' },
  3: { bg: '#7C3AED', text: 'white', name: 'Zone 3' },
};

const getDefaultAssignments = (): MapAssignments => {
  const initial: MapAssignments = {};
  buildings.forEach(b => {
    initial[b.id] = { team: 0, order: 0 };
  });
  return initial;
};

export default function AOOInteractiveMap({ initialAssignments, onSave, isEditor = true, players = [] }: Props) {
  const [isDark, setIsDark] = useState(true);
  const [assignments, setAssignments] = useState<MapAssignments>(() => {
    return initialAssignments || getDefaultAssignments();
  });
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [filterTeam, setFilterTeam] = useState<TeamNumber | 'all'>('all');
  const [swapCorners, setSwapCorners] = useState(false);
  const [hoveredBuilding, setHoveredBuilding] = useState<Building | null>(null);

  // Get teleporters for each zone dynamically from player data
  const teleportersByZone = useMemo(() => {
    const result: Record<number, { first: string[]; second: string[] }> = {
      1: { first: [], second: [] },
      2: { first: [], second: [] },
      3: { first: [], second: [] },
    };
    players.forEach(p => {
      if (p.team >= 1 && p.team <= 3) {
        if (p.tags.includes('Teleport 1st')) {
          result[p.team].first.push(p.name);
        } else if (p.tags.includes('Teleport 2nd')) {
          result[p.team].second.push(p.name);
        }
      }
    });
    return result;
  }, [players]);

  // Update assignments when initialAssignments changes
  useEffect(() => {
    if (initialAssignments) {
      setAssignments(initialAssignments);
    }
  }, [initialAssignments]);

  const theme = {
    bg: isDark ? 'bg-zinc-950' : 'bg-slate-50',
    bgSecondary: isDark ? 'bg-zinc-900' : 'bg-white',
    bgTertiary: isDark ? 'bg-zinc-800' : 'bg-slate-100',
    text: isDark ? 'text-white' : 'text-slate-900',
    textSecondary: isDark ? 'text-zinc-400' : 'text-slate-600',
    textMuted: isDark ? 'text-zinc-500' : 'text-slate-400',
    border: isDark ? 'border-zinc-800' : 'border-slate-200',
  };

  const updateAssignments = (newAssignments: MapAssignments) => {
    setAssignments(newAssignments);
    if (onSave) {
      onSave(newAssignments);
    }
  };

  const assignTeam = (buildingId: string, team: TeamNumber) => {
    if (!isEditor) return;
    
    const newAssignments = { ...assignments };
    if (team === null) {
      newAssignments[buildingId] = { team: 0, order: 0 };
    } else {
      // Get next order number for this team
      const teamBuildings = Object.entries(assignments)
        .filter(([, a]) => a.team === team)
        .map(([, a]) => a.order || 0);
      const nextOrder = teamBuildings.length > 0 ? Math.max(...teamBuildings) + 1 : 1;
      newAssignments[buildingId] = { team, order: nextOrder };
    }
    updateAssignments(newAssignments);
  };

  const clearAll = () => {
    if (!isEditor) return;
    updateAssignments(getDefaultAssignments());
  };

  const getTeamBuildings = (team: number) => {
    return buildings
      .filter(b => assignments[b.id]?.team === team)
      .sort((a, b) => (assignments[a.id]?.order || 0) - (assignments[b.id]?.order || 0));
  };

  const moveOrder = (buildingId: string, direction: 'up' | 'down') => {
    if (!isEditor) return;
    
    const assignment = assignments[buildingId];
    if (!assignment.team || !assignment.order) return;

    const teamBuildings = getTeamBuildings(assignment.team);
    const currentIndex = teamBuildings.findIndex(b => b.id === buildingId);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (swapIndex < 0 || swapIndex >= teamBuildings.length) return;

    const swapBuilding = teamBuildings[swapIndex];
    
    updateAssignments({
      ...assignments,
      [buildingId]: { ...assignments[buildingId], order: assignments[swapBuilding.id].order },
      [swapBuilding.id]: { ...assignments[swapBuilding.id], order: assignments[buildingId].order },
    });
  };

  const setOrder = (buildingId: string, newOrder: number) => {
    if (!isEditor) return;
    if (newOrder < 1) return;
    
    updateAssignments({
      ...assignments,
      [buildingId]: { ...assignments[buildingId], order: newOrder },
    });
  };

  return (
    <div className={`${theme.bg} min-h-screen transition-colors`}>
      {/* Header */}
      <header className={`${theme.bgSecondary} border-b ${theme.border} px-4 py-3 sticky top-0 z-50`}>
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <h1 className={`text-xl font-bold ${theme.text}`}>AOO Strategy Map</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSwapCorners(!swapCorners)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${theme.bgTertiary} ${theme.text} text-sm hover:opacity-80`}
              title="Swap start/enemy corners"
            >
              <RotateCw size={16} />
              {swapCorners ? 'Start: Bottom-Right' : 'Start: Top-Left'}
            </button>
            {isEditor && (
              <button
                onClick={clearAll}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${theme.bgTertiary} ${theme.text} text-sm hover:opacity-80`}
              >
                <RotateCcw size={16} />
                Clear
              </button>
            )}
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg ${theme.bgTertiary} ${theme.text} hover:opacity-80`}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          
          {/* Left Panel - Zone Filter & Assignment (hidden on mobile, shown on desktop) */}
          <div className="hidden lg:block lg:w-72 space-y-4">
            {/* Filter by Zone */}
            <div className={`${theme.bgSecondary} rounded-xl p-4 border ${theme.border}`}>
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted} mb-3`}>
                View Zone
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFilterTeam('all')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterTeam === 'all' ? 'bg-emerald-600 text-white' : `${theme.bgTertiary} ${theme.text}`
                  }`}
                >
                  All
                </button>
                {[1, 2, 3].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterTeam(t as TeamNumber)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all`}
                    style={filterTeam === t ? { backgroundColor: teamColors[t].bg, color: 'white' } : {}}
                  >
                    Zone {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Zone Attack Orders */}
            {[1, 2, 3].map(team => {
              const teamBuildings = getTeamBuildings(team);
              if (filterTeam !== 'all' && filterTeam !== team) return null;
              
              return (
                <div key={team} className={`${theme.bgSecondary} rounded-xl p-4 border ${theme.border}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: teamColors[team].bg }}
                    />
                    <h3 className={`text-sm font-semibold ${theme.text}`}>
                      {teamColors[team].name} Attack Order
                    </h3>
                    <span className={`text-xs ${theme.textMuted}`}>({teamBuildings.length})</span>
                  </div>
                  
                  {teamBuildings.length === 0 ? (
                    <p className={`text-sm ${theme.textMuted}`}>No buildings assigned</p>
                  ) : (
                    <div className="space-y-1">
                      {teamBuildings.map((building) => (
                        <div 
                          key={building.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded ${theme.bgTertiary} cursor-pointer hover:opacity-80`}
                          onClick={() => setSelectedBuilding(building)}
                        >
                          {isEditor ? (
                            <input
                              type="number"
                              min="1"
                              value={assignments[building.id]?.order || 1}
                              onChange={(e) => setOrder(building.id, parseInt(e.target.value) || 1)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-8 h-6 rounded text-center text-xs font-bold text-white border-0 focus:ring-2 focus:ring-white"
                              style={{ backgroundColor: teamColors[team].bg }}
                            />
                          ) : (
                            <span 
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ backgroundColor: teamColors[team].bg }}
                            >
                              {assignments[building.id]?.order || 1}
                            </span>
                          )}
                          <span className={`flex-1 text-sm ${theme.text}`}>{building.name}</span>
                          {isEditor && (
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setOrder(building.id, (assignments[building.id]?.order || 1) - 1); }}
                                disabled={(assignments[building.id]?.order || 1) <= 1}
                                className={`text-xs px-1 ${(assignments[building.id]?.order || 1) <= 1 ? 'opacity-30' : 'hover:opacity-70'} ${theme.textSecondary}`}
                              >
                                ▲
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setOrder(building.id, (assignments[building.id]?.order || 1) + 1); }}
                                className={`text-xs px-1 hover:opacity-70 ${theme.textSecondary}`}
                              >
                                ▼
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Center - Map (shown first on mobile) */}
          <div className="flex-1 order-first lg:order-none">
            <div className={`${theme.bgSecondary} rounded-xl overflow-hidden border ${theme.border}`}>
              <div className="relative w-full" style={{ aspectRatio: '1275 / 891' }}>
                {/* Map Background */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/aoo-strategy/aoo-map.jpg"
                  alt="AOO Map"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ opacity: isDark ? 0.8 : 1 }}
                />

                {/* START Marker - position swaps based on swapCorners */}
                <div
                  className="absolute flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg border-2 border-emerald-400"
                  style={{
                    left: swapCorners ? '88%' : '12%',
                    top: swapCorners ? '94%' : '6%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 20,
                  }}
                >
                  <span>⚔️</span>
                  <span>START</span>
                </div>

                {/* ENEMY Marker - position swaps based on swapCorners */}
                <div
                  className="absolute flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold text-sm shadow-lg border-2 border-red-400"
                  style={{
                    left: swapCorners ? '12%' : '88%',
                    top: swapCorners ? '6%' : '94%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 20,
                  }}
                >
                  <span>☠️</span>
                  <span>ENEMY</span>
                </div>

                {/* RUSH indicators showing which zone goes where */}
                {/* Zone 3 rushes Obelisk 1 (upper) or Obelisk 4 (lower) based on swap */}
                <div
                  className="absolute px-1.5 py-0.5 rounded bg-purple-600 text-white text-[10px] font-bold shadow"
                  style={{
                    left: swapCorners ? '42%' : '50%',
                    top: swapCorners ? '85%' : '5%',
                    transform: 'translate(-50%, 0)',
                    zIndex: 15
                  }}
                >
                  Z3 RUSH {swapCorners ? '↑' : '↓'}
                </div>
                {/* Teleport indicator for Zone 3 obelisk - dynamic from roster */}
                {teleportersByZone[3].first.length > 0 && (
                  <div
                    className="absolute px-1.5 py-0.5 rounded bg-purple-800/80 text-purple-200 text-[9px] font-medium shadow"
                    style={{
                      left: swapCorners ? '50%' : '58%',
                      top: swapCorners ? '73%' : '10%',
                      transform: 'translate(-50%, 0)',
                      zIndex: 15
                    }}
                  >
                    ⚡ TP: {teleportersByZone[3].first.slice(0, 3).join(', ')}
                  </div>
                )}

                {/* Zone 1 rushes Obelisk 2 (left) or Obelisk 3 (right) based on swap */}
                <div
                  className="absolute px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold shadow"
                  style={{
                    left: swapCorners ? '98%' : '2%',
                    top: '40%',
                    transform: swapCorners ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
                    zIndex: 15
                  }}
                >
                  {swapCorners ? '← ' : ''}Z1 RUSH{swapCorners ? '' : ' →'}
                </div>
                {/* Teleport indicator for Zone 1 obelisk - dynamic from roster */}
                {teleportersByZone[1].first.length > 0 && (
                  <div
                    className="absolute px-1.5 py-0.5 rounded bg-blue-800/80 text-blue-200 text-[9px] font-medium shadow"
                    style={{
                      left: swapCorners ? '90%' : '10%',
                      top: '48%',
                      transform: 'translate(-50%, 0)',
                      zIndex: 15
                    }}
                  >
                    ⚡ TP: {teleportersByZone[1].first.slice(0, 3).join(', ')}
                  </div>
                )}

                {/* Building Markers */}
                {buildings.map(building => {
                  const assignment = assignments[building.id];
                  const isSelected = selectedBuilding?.id === building.id;
                  const isHovered = hoveredBuilding?.id === building.id;
                  const isFiltered = filterTeam !== 'all' && assignment?.team !== filterTeam;

                  if (isFiltered && !assignment?.team) return null;

                  // Get building type for tooltip - swap "Your side" / "Enemy side" labels when swapped
                  const getBuildingInfo = () => {
                    if (building.id.includes('obelisk')) return { type: 'Obelisk', points: '+100 pts/tick', info: 'Teleport source' };
                    if (building.id.includes('iset')) return { type: 'Outpost of Iset', points: '+50 pts/tick', info: swapCorners ? 'Enemy side' : 'Your side' };
                    if (building.id.includes('seth')) return { type: 'Outpost of Seth', points: '+50 pts/tick', info: swapCorners ? 'Your side' : 'Enemy side' };
                    if (building.id.includes('war')) return { type: 'Shrine of War', points: '+25 pts/tick', info: '+5% ATK buff' };
                    if (building.id.includes('life')) return { type: 'Shrine of Life', points: '+25 pts/tick', info: '+5% HP buff' };
                    if (building.id.includes('desert')) return { type: 'Desert Altar', points: '+25 pts/tick', info: 'Relic spawn' };
                    if (building.id.includes('sky')) return { type: 'Sky Altar', points: '+25 pts/tick', info: 'Relic spawn' };
                    if (building.id === 'ark') return { type: 'Ark', points: '+200 pts/tick', info: 'Main objective' };
                    return { type: 'Building', points: '', info: '' };
                  };
                  const buildingInfo = getBuildingInfo();

                  return (
                    <div
                      key={building.id}
                      className={`absolute cursor-pointer transition-all duration-150 ${isFiltered ? 'opacity-30' : ''}`}
                      style={{
                        left: `${building.x}%`,
                        top: `${building.y}%`,
                        transform: `translate(-50%, -50%) scale(${isSelected || isHovered ? 1.15 : 1})`,
                        zIndex: isSelected ? 30 : isHovered ? 25 : 10,
                      }}
                      onClick={() => setSelectedBuilding(isSelected ? null : building)}
                      onMouseEnter={() => setHoveredBuilding(building)}
                      onMouseLeave={() => setHoveredBuilding(null)}
                    >
                      {/* Marker */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 ${
                          assignment?.team
                            ? 'border-white'
                            : isDark ? 'border-zinc-600 bg-zinc-700' : 'border-slate-400 bg-slate-200'
                        }`}
                        style={assignment?.team ? { backgroundColor: teamColors[assignment.team].bg } : {}}
                      >
                        {assignment?.team && assignment?.order ? (
                          <span className="text-white font-bold text-sm">{assignment.order}</span>
                        ) : (
                          <span className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                            {building.shortName}
                          </span>
                        )}
                      </div>

                      {/* Tooltip on hover - shows building name and info */}
                      {(isHovered || isSelected) && (
                        <div
                          className={`absolute left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap ${theme.bgSecondary} ${theme.text} shadow-xl border ${theme.border} pointer-events-none`}
                          style={{
                            top: building.y < 30 ? '100%' : 'auto',
                            bottom: building.y >= 30 ? '100%' : 'auto',
                            marginTop: building.y < 30 ? '4px' : 0,
                            marginBottom: building.y >= 30 ? '4px' : 0,
                          }}
                        >
                          <div className="font-semibold">{building.name}</div>
                          <div className={`text-[10px] ${theme.textMuted} flex items-center gap-2`}>
                            <span>{buildingInfo.points}</span>
                            {buildingInfo.info && <span>• {buildingInfo.info}</span>}
                          </div>
                          {assignment?.team && (
                            <div className="text-[10px] mt-0.5" style={{ color: teamColors[assignment.team].bg }}>
                              {teamColors[assignment.team].name} • Phase {assignment.order || 1}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Map Legend */}
            <div className={`mt-3 p-3 rounded-lg ${theme.bgTertiary} text-xs`}>
              <div className="flex flex-wrap gap-4 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">⚔️ START</span>
                  <span className={theme.textMuted}>Your spawn</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold">☠️ ENEMY</span>
                  <span className={theme.textMuted}>Enemy spawn</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-blue-500/50 border border-blue-500"></span>
                  <span className={theme.textMuted}>Zone 1 (Lower)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-orange-500/50 border border-orange-500"></span>
                  <span className={theme.textMuted}>Zone 2 (Middle)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-purple-500/50 border border-purple-500"></span>
                  <span className={theme.textMuted}>Zone 3 (Upper)</span>
                </div>
              </div>
              <div className={`flex flex-wrap gap-3 pt-2 border-t ${theme.border}`}>
                <span className={`${theme.textMuted} font-medium`}>Phases:</span>
                <span className={theme.textMuted}><strong>1</strong> = Rush (Obelisks)</span>
                <span className={theme.textMuted}><strong>2</strong> = Secure (Outposts)</span>
                <span className={theme.textMuted}><strong>3</strong> = Expand (Shrines/Altars/Ark)</span>
                <span className={theme.textMuted}><strong>4</strong> = Contest (Enemy territory)</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Selected Building */}
          <div className="lg:w-72">
            {selectedBuilding ? (
              <div className={`${theme.bgSecondary} rounded-xl p-4 border ${theme.border}`}>
                <div className="flex items-center gap-2 mb-3">
                  {assignments[selectedBuilding.id]?.team && (
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: teamColors[assignments[selectedBuilding.id].team!].bg }}
                    />
                  )}
                  <h3 className={`font-semibold ${theme.text}`}>{selectedBuilding.name}</h3>
                </div>
                
                {assignments[selectedBuilding.id]?.team ? (
                  <div className="space-y-3">
                    {/* Zone & Phase info */}
                    <div className={`p-2 rounded-lg ${theme.bgTertiary}`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${theme.textMuted}`}>Assigned to:</span>
                        <span 
                          className="text-sm font-bold px-2 py-0.5 rounded"
                          style={{ backgroundColor: teamColors[assignments[selectedBuilding.id].team!].bg, color: 'white' }}
                        >
                          {teamColors[assignments[selectedBuilding.id].team!].name}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className={`text-sm ${theme.textMuted}`}>Phase:</span>
                        <span className={`text-sm font-bold ${theme.text}`}>
                          {assignments[selectedBuilding.id].order || 1}
                        </span>
                      </div>
                    </div>

                    {/* Player Assignments for this building */}
                    {players.length > 0 && (() => {
                      const buildingName = selectedBuilding.name;
                      const shortName = selectedBuilding.shortName;
                      const buildingId = selectedBuilding.id;
                      const assignedTeam = assignments[selectedBuilding.id]?.team;
                      
                      // Create search terms for this building
                      const searchTerms: string[] = [
                        buildingName.toLowerCase(),
                        shortName.toLowerCase(),
                      ];
                      
                      // Add common variations
                      if (buildingId === 'obelisk-1') searchTerms.push('obelisk 1', 'ob1', 'obelisk (upper)', 'ob-upper', 'upper');
                      if (buildingId === 'obelisk-2') searchTerms.push('obelisk 2', 'ob2', 'obelisk (left)', 'ob-left', 'left');
                      if (buildingId === 'obelisk-3') searchTerms.push('obelisk 3', 'ob3', 'obelisk (right)', 'ob-right', 'right');
                      if (buildingId === 'obelisk-4') searchTerms.push('obelisk 4', 'ob4', 'obelisk (lower)', 'ob-lower', 'lower');
                      if (buildingId.includes('iset')) searchTerms.push('iset', 'outpost of iset');
                      if (buildingId.includes('seth')) searchTerms.push('seth', 'outpost of seth', 'seth outpost');
                      if (buildingId === 'war-1') searchTerms.push('shrine of war', 'war', 'war (left)', 'war-l');
                      if (buildingId === 'war-2') searchTerms.push('shrine of war', 'war', 'war (right)', 'war-r');
                      if (buildingId === 'life-1') searchTerms.push('shrine of life', 'life', 'life (right)', 'life-r');
                      if (buildingId === 'life-2') searchTerms.push('shrine of life', 'life', 'life (left)', 'life-l');
                      if (buildingId === 'desert-1') searchTerms.push('desert altar', 'desert', 'desert (right)', 'des-r');
                      if (buildingId === 'desert-2') searchTerms.push('desert altar', 'desert', 'desert (left)', 'des-l');
                      if (buildingId === 'sky-1') searchTerms.push('sky altar', 'sky', 'sky (right)', 'sky-r');
                      if (buildingId === 'sky-2') searchTerms.push('sky altar', 'sky', 'sky (left)', 'sky-l');
                      if (buildingId === 'ark') searchTerms.push('ark');
                      
                      // Find players assigned to this building
                      const getPlayersForRole = (role: string) => {
                        return players.filter(p => {
                          if (p.team !== assignedTeam) return false;
                          if (!p.assignments) return false;
                          const allAssignments = Object.values(p.assignments).join(' ').toLowerCase();
                          return searchTerms.some(term => allAssignments.includes(term));
                        }).filter(p => p.tags.includes(role));
                      };
                      
                      // Also get teleporters for obelisks
                      const getTeleporters = () => {
                        if (!buildingId.includes('obelisk')) return { first: [], second: [] };
                        return {
                          first: players.filter(p => p.team === assignedTeam && p.tags.includes('Teleport 1st')),
                          second: players.filter(p => p.team === assignedTeam && p.tags.includes('Teleport 2nd'))
                        };
                      };

                      const conquerors = getPlayersForRole('Conquer');
                      const garrisons = getPlayersForRole('Garrison');
                      const rallyLeaders = getPlayersForRole('Rally Leader');
                      const teleporters = getTeleporters();
                      const allAssigned = [...new Set([...conquerors, ...garrisons, ...rallyLeaders, ...teleporters.first, ...teleporters.second])];

                      if (allAssigned.length === 0) {
                        return (
                          <p className={`text-xs ${theme.textMuted}`}>No specific player assignments</p>
                        );
                      }

                      return (
                        <div className="space-y-2">
                          <h4 className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}>
                            Assigned Players
                          </h4>
                          
                          {rallyLeaders.length > 0 && (
                            <div className={`p-2 rounded ${theme.bgTertiary}`}>
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-red-500">🎯</span>
                                <span className={`text-xs font-medium ${theme.textMuted}`}>Rally Leader</span>
                              </div>
                              {rallyLeaders.map(p => (
                                <div key={p.id} className={`text-sm ${theme.text}`}>{p.name}</div>
                              ))}
                            </div>
                          )}
                          
                          {conquerors.length > 0 && (
                            <div className={`p-2 rounded ${theme.bgTertiary}`}>
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-purple-500">🏃</span>
                                <span className={`text-xs font-medium ${theme.textMuted}`}>Conquer (T1 Cav)</span>
                              </div>
                              {conquerors.map(p => (
                                <div key={p.id} className={`text-sm ${theme.text}`}>{p.name}</div>
                              ))}
                            </div>
                          )}
                          
                          {garrisons.length > 0 && (
                            <div className={`p-2 rounded ${theme.bgTertiary}`}>
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-orange-500">🛡️</span>
                                <span className={`text-xs font-medium ${theme.textMuted}`}>Garrison</span>
                              </div>
                              {garrisons.map(p => (
                                <div key={p.id} className={`text-sm ${theme.text}`}>{p.name}</div>
                              ))}
                            </div>
                          )}
                          
                          {/* Teleport info for obelisks */}
                          {buildingId.includes('obelisk') && (teleporters.first.length > 0 || teleporters.second.length > 0) && (
                            <>
                              {teleporters.first.length > 0 && (
                                <div className={`p-2 rounded ${theme.bgTertiary}`}>
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="text-blue-500">⚡</span>
                                    <span className={`text-xs font-medium ${theme.textMuted}`}>Teleport 1st (Immediate)</span>
                                  </div>
                                  <div className={`text-xs ${theme.text}`}>
                                    {teleporters.first.map(p => p.name).join(', ')}
                                  </div>
                                </div>
                              )}
                              {teleporters.second.length > 0 && (
                                <div className={`p-2 rounded ${theme.bgTertiary}`}>
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="text-cyan-500">⚡</span>
                                    <span className={`text-xs font-medium ${theme.textMuted}`}>Teleport 2nd (When Called)</span>
                                  </div>
                                  <div className={`text-xs ${theme.text}`}>
                                    {teleporters.second.map(p => p.name).join(', ')}
                                  </div>
                                </div>
                              )}
                              <div className={`p-2 rounded border ${theme.border} text-xs ${theme.textMuted}`}>
                                <p className="font-medium mb-1">📍 Teleport Rules:</p>
                                <ul className="space-y-0.5">
                                  <li>• First capture: 5-8 teleports earned</li>
                                  <li>• Obelisks generate more over time</li>
                                  <li>• Troops must be in city or buildings</li>
                                </ul>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {isEditor && (
                      <button
                        onClick={() => assignTeam(selectedBuilding.id, null)}
                        className={`w-full px-3 py-2 rounded-lg text-sm ${theme.textSecondary} hover:opacity-70 border ${theme.border}`}
                      >
                        Remove Assignment
                      </button>
                    )}
                  </div>
                ) : isEditor ? (
                  <>
                    <p className={`text-sm ${theme.textMuted} mb-4`}>Assign to a zone:</p>
                    <div className="space-y-2">
                      {[1, 2, 3].map(team => (
                        <button
                          key={team}
                          onClick={() => assignTeam(selectedBuilding.id, team as TeamNumber)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all`}
                          style={{ 
                            backgroundColor: isDark ? '#27272a' : '#f1f5f9',
                            color: isDark ? 'white' : '#1e293b'
                          }}
                        >
                          <div 
                            className="w-5 h-5 rounded-full"
                            style={{ backgroundColor: teamColors[team].bg }}
                          />
                          <span className="font-medium">{teamColors[team].name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className={`text-sm ${theme.textMuted}`}>Not assigned to any zone</p>
                )}
              </div>
            ) : (
              <div className={`${theme.bgSecondary} rounded-xl p-4 border ${theme.border}`}>
                <p className={`text-sm ${theme.textMuted} text-center py-4`}>
                  Click a building on the map to {isEditor ? 'assign it to a zone' : 'view details'}
                </p>
              </div>
            )}
            
            {/* Mobile Zone Filter */}
            <div className={`lg:hidden mt-4 ${theme.bgSecondary} rounded-xl p-4 border ${theme.border}`}>
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted} mb-3`}>
                Filter Zone
              </h3>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setFilterTeam('all')}
                  className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    filterTeam === 'all' ? 'bg-emerald-600 text-white' : `${theme.bgTertiary} ${theme.text}`
                  }`}
                >
                  All
                </button>
                {[1, 2, 3].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterTeam(t as TeamNumber)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all`}
                    style={filterTeam === t ? { backgroundColor: teamColors[t].bg, color: 'white' } : {}}
                  >
                    Z{t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
