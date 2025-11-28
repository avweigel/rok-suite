'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun, RotateCcw } from 'lucide-react';

type TeamNumber = 1 | 2 | 3 | null;

interface Building {
  id: string;
  name: string;
  shortName: string;
  x: number;
  y: number;
}

interface Assignment {
  team: TeamNumber;
  order: number | null;
}

export type MapAssignments = Record<string, Assignment>;

interface Props {
  initialAssignments?: MapAssignments;
  onSave?: (assignments: MapAssignments) => void;
  isEditor?: boolean;
}

// All buildings on the map with positions (percentages)
const buildings: Building[] = [
  // Obelisks
  { id: 'obelisk-1', name: 'Obelisk 1', shortName: 'Ob1', x: 53, y: 15 },
  { id: 'obelisk-2', name: 'Obelisk 2', shortName: 'Ob2', x: 10, y: 43 },
  { id: 'obelisk-3', name: 'Obelisk 3', shortName: 'Ob3', x: 87, y: 43 },
  { id: 'obelisk-4', name: 'Obelisk 4', shortName: 'Ob4', x: 41, y: 77 },
  
  // Outposts of Iset (our side)
  { id: 'iset-1', name: 'Outpost of Iset 1', shortName: 'Iset1', x: 35, y: 18 },
  { id: 'iset-2', name: 'Outpost of Iset 2', shortName: 'Iset2', x: 17, y: 26 },
  { id: 'iset-3', name: 'Outpost of Iset 3', shortName: 'Iset3', x: 33, y: 30 },
  
  // Outposts of Seth (enemy side)
  { id: 'seth-1', name: 'Outpost of Seth 1', shortName: 'Seth1', x: 62, y: 60 },
  { id: 'seth-2', name: 'Outpost of Seth 2', shortName: 'Seth2', x: 79, y: 60 },
  { id: 'seth-3', name: 'Outpost of Seth 3', shortName: 'Seth3', x: 63, y: 72 },
  
  // Shrines of War
  { id: 'war-1', name: 'Shrine of War 1', shortName: 'War1', x: 30, y: 48 },
  { id: 'war-2', name: 'Shrine of War 2', shortName: 'War2', x: 70, y: 42 },
  
  // Shrines of Life
  { id: 'life-1', name: 'Shrine of Life 1', shortName: 'Life1', x: 70, y: 16 },
  { id: 'life-2', name: 'Shrine of Life 2', shortName: 'Life2', x: 22, y: 72 },
  
  // Desert Altars
  { id: 'desert-1', name: 'Desert Altar 1', shortName: 'Des1', x: 55, y: 31 },
  { id: 'desert-2', name: 'Desert Altar 2', shortName: 'Des2', x: 42, y: 61 },
  
  // Sky Altars
  { id: 'sky-1', name: 'Sky Altar 1', shortName: 'Sky1', x: 85, y: 27 },
  { id: 'sky-2', name: 'Sky Altar 2', shortName: 'Sky2', x: 12, y: 57 },
  
  // Ark
  { id: 'ark', name: 'Ark', shortName: 'Ark', x: 48, y: 45 },
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
    initial[b.id] = { team: null, order: null };
  });
  return initial;
};

export default function AOOInteractiveMap({ initialAssignments, onSave, isEditor = true }: Props) {
  const [isDark, setIsDark] = useState(true);
  const [assignments, setAssignments] = useState<MapAssignments>(() => {
    return initialAssignments || getDefaultAssignments();
  });
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [filterTeam, setFilterTeam] = useState<TeamNumber | 'all'>('all');

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
      newAssignments[buildingId] = { team: null, order: null };
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

  return (
    <div className={`${theme.bg} min-h-screen transition-colors`}>
      {/* Header */}
      <header className={`${theme.bgSecondary} border-b ${theme.border} px-4 py-3 sticky top-0 z-50`}>
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <h1 className={`text-xl font-bold ${theme.text}`}>AOO Strategy Map</h1>
          <div className="flex items-center gap-2">
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
          
          {/* Left Panel - Zone Filter & Assignment */}
          <div className="lg:w-72 space-y-4">
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
                      {teamBuildings.map((building, idx) => (
                        <div 
                          key={building.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded ${theme.bgTertiary}`}
                        >
                          <span 
                            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ backgroundColor: teamColors[team].bg }}
                          >
                            {idx + 1}
                          </span>
                          <span className={`flex-1 text-sm ${theme.text}`}>{building.name}</span>
                          {isEditor && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => moveOrder(building.id, 'up')}
                                disabled={idx === 0}
                                className={`text-xs px-1 ${idx === 0 ? 'opacity-30' : 'hover:opacity-70'} ${theme.textSecondary}`}
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => moveOrder(building.id, 'down')}
                                disabled={idx === teamBuildings.length - 1}
                                className={`text-xs px-1 ${idx === teamBuildings.length - 1 ? 'opacity-30' : 'hover:opacity-70'} ${theme.textSecondary}`}
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

          {/* Map */}
          <div className="flex-1">
            <div className={`${theme.bgSecondary} rounded-xl overflow-hidden border ${theme.border}`}>
              <div className="relative w-full" style={{ aspectRatio: '1275 / 891' }}>
                {/* Map Background */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/aoo-map.jpg"
                  alt="AOO Map"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ opacity: isDark ? 0.8 : 1 }}
                />

                {/* Building Markers */}
                {buildings.map(building => {
                  const assignment = assignments[building.id];
                  const isSelected = selectedBuilding?.id === building.id;
                  const isFiltered = filterTeam !== 'all' && assignment?.team !== filterTeam;
                  
                  if (isFiltered && !assignment?.team) return null;

                  return (
                    <div
                      key={building.id}
                      className={`absolute cursor-pointer transition-all duration-150 ${isFiltered ? 'opacity-30' : ''}`}
                      style={{
                        left: `${building.x}%`,
                        top: `${building.y}%`,
                        transform: `translate(-50%, -50%) scale(${isSelected ? 1.2 : 1})`,
                        zIndex: isSelected ? 30 : 10,
                      }}
                      onClick={() => setSelectedBuilding(isSelected ? null : building)}
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

                      {/* Label on hover/select */}
                      {isSelected && (
                        <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded text-xs whitespace-nowrap ${theme.bgSecondary} ${theme.text} shadow-lg border ${theme.border}`}>
                          {building.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel - Selected Building */}
          <div className="lg:w-64">
            {selectedBuilding ? (
              <div className={`${theme.bgSecondary} rounded-xl p-4 border ${theme.border}`}>
                <h3 className={`font-semibold ${theme.text} mb-3`}>{selectedBuilding.name}</h3>
                
                {isEditor ? (
                  <>
                    <p className={`text-sm ${theme.textMuted} mb-4`}>Assign to a zone:</p>
                    
                    <div className="space-y-2">
                      {[1, 2, 3].map(team => {
                        const isAssigned = assignments[selectedBuilding.id]?.team === team;
                        return (
                          <button
                            key={team}
                            onClick={() => assignTeam(selectedBuilding.id, isAssigned ? null : team as TeamNumber)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                              isAssigned ? 'ring-2 ring-white' : ''
                            }`}
                            style={{ 
                              backgroundColor: isAssigned ? teamColors[team].bg : isDark ? '#27272a' : '#f1f5f9',
                              color: isAssigned ? 'white' : isDark ? 'white' : '#1e293b'
                            }}
                          >
                            <div 
                              className="w-5 h-5 rounded-full"
                              style={{ backgroundColor: teamColors[team].bg }}
                            />
                            <span className="font-medium">{teamColors[team].name}</span>
                            {isAssigned && <span className="ml-auto">✓</span>}
                          </button>
                        );
                      })}
                      
                      {assignments[selectedBuilding.id]?.team && (
                        <button
                          onClick={() => assignTeam(selectedBuilding.id, null)}
                          className={`w-full px-3 py-2 rounded-lg text-sm ${theme.textSecondary} hover:opacity-70`}
                        >
                          Remove Assignment
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className={`text-sm ${theme.textMuted}`}>
                    {assignments[selectedBuilding.id]?.team 
                      ? `Assigned to Zone ${assignments[selectedBuilding.id].team}`
                      : 'Not assigned'}
                  </p>
                )}
              </div>
            ) : (
              <div className={`${theme.bgSecondary} rounded-xl p-4 border ${theme.border}`}>
                <p className={`text-sm ${theme.textMuted} text-center py-4`}>
                  Click a building on the map to {isEditor ? 'assign it to a zone' : 'view details'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
