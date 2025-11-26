'use client';

import React, { useState, useCallback } from 'react';
import { Moon, Sun, Users, Target, MapPin, Eye, EyeOff, Flag, Swords, Shield, Zap } from 'lucide-react';

// Types
type Faction = 'iset' | 'seth';
type SubTeam = 1 | 2 | 3;
type Phase = 'opening' | 'mid' | 'late' | 'all';

interface TeamStrategy {
  team: SubTeam;
  phase: Phase;
  objective: string;
  description: string;
  locations: string[];
  priority: 'primary' | 'secondary' | 'support';
  icon: 'swords' | 'shield' | 'flag' | 'zap';
}

interface MapLocation {
  id: string;
  name: string;
  type: LocationType;
  x: number;
  y: number;
  description: string;
  strategicValue: 'low' | 'medium' | 'high' | 'critical';
  points?: number;
  respawnTime?: string;
}

type LocationType = 
  | 'obelisk' 
  | 'outpost' 
  | 'shrine_war' 
  | 'shrine_life' 
  | 'desert_altar' 
  | 'sky_altar' 
  | 'base'
  | 'central_shrine'
  | 'ark';

// Team colors - colorblind-friendly palette
const teamColors: Record<SubTeam, { primary: string; name: string }> = {
  1: { primary: '#2563EB', name: 'Team 1' },  // Blue
  2: { primary: '#D97706', name: 'Team 2' },  // Orange
  3: { primary: '#7C3AED', name: 'Team 3' },  // Purple
};

// Location configuration
const locationConfig: Record<LocationType, { color: string; darkColor: string; icon: string; label: string }> = {
  obelisk: { color: '#6B7280', darkColor: '#9CA3AF', icon: '🗿', label: 'Obelisk' },
  outpost: { color: '#8B5CF6', darkColor: '#A78BFA', icon: '🏛️', label: 'Outpost' },
  shrine_war: { color: '#EF4444', darkColor: '#F87171', icon: '⚔️', label: 'Shrine of War' },
  shrine_life: { color: '#10B981', darkColor: '#34D399', icon: '💚', label: 'Shrine of Life' },
  desert_altar: { color: '#D97706', darkColor: '#FBBF24', icon: '🏜️', label: 'Desert Altar' },
  sky_altar: { color: '#0EA5E9', darkColor: '#38BDF8', icon: '☁️', label: 'Sky Altar' },
  base: { color: '#1D4ED8', darkColor: '#3B82F6', icon: '🏰', label: 'Base' },
  central_shrine: { color: '#FBBF24', darkColor: '#FCD34D', icon: '👑', label: 'Central Shrine' },
  ark: { color: '#F472B6', darkColor: '#F9A8D4', icon: '📦', label: 'Ark' },
};

// Map locations
const mapLocations: MapLocation[] = [
  { id: 'obelisk-n', name: 'Northern Obelisk', type: 'obelisk', x: 53, y: 15, description: 'Northern vision control point.', strategicValue: 'medium', points: 100 },
  { id: 'obelisk-w', name: 'Western Obelisk', type: 'obelisk', x: 10, y: 43, description: 'Western flank control.', strategicValue: 'medium', points: 100 },
  { id: 'obelisk-e', name: 'Eastern Obelisk', type: 'obelisk', x: 87, y: 43, description: 'Eastern flank control.', strategicValue: 'medium', points: 100 },
  { id: 'obelisk-s', name: 'Southern Obelisk', type: 'obelisk', x: 41, y: 77, description: 'Southern map control.', strategicValue: 'medium', points: 100 },
  { id: 'outpost-nw', name: 'Northwest Outpost', type: 'outpost', x: 17, y: 26, description: 'Forward spawn point.', strategicValue: 'high', respawnTime: '3 min' },
  { id: 'outpost-n', name: 'North Outpost', type: 'outpost', x: 35, y: 18, description: 'Northern staging area.', strategicValue: 'high', respawnTime: '3 min' },
  { id: 'outpost-nc', name: 'North-Central Outpost', type: 'outpost', x: 33, y: 30, description: 'Mid-north control.', strategicValue: 'high', respawnTime: '3 min' },
  { id: 'outpost-c', name: 'Central Outpost', type: 'outpost', x: 62, y: 60, description: 'Central map presence.', strategicValue: 'high', respawnTime: '3 min' },
  { id: 'outpost-e', name: 'East Outpost', type: 'outpost', x: 79, y: 60, description: 'Eastern staging area.', strategicValue: 'high', respawnTime: '3 min' },
  { id: 'outpost-se', name: 'Southeast Outpost', type: 'outpost', x: 63, y: 72, description: 'Southern flank control.', strategicValue: 'high', respawnTime: '3 min' },
  { id: 'shrine-war-w', name: 'Western Shrine of War', type: 'shrine_war', x: 30, y: 48, description: 'Combat buff shrine.', strategicValue: 'critical', points: 200 },
  { id: 'shrine-war-e', name: 'Eastern Shrine of War', type: 'shrine_war', x: 70, y: 42, description: 'Combat buff shrine.', strategicValue: 'critical', points: 200 },
  { id: 'shrine-life-ne', name: 'NE Shrine of Life', type: 'shrine_life', x: 70, y: 16, description: 'Healing buff shrine.', strategicValue: 'high', points: 150 },
  { id: 'shrine-life-sw', name: 'SW Shrine of Life', type: 'shrine_life', x: 22, y: 72, description: 'Healing buff shrine.', strategicValue: 'high', points: 150 },
  { id: 'altar-desert-n', name: 'North Desert Altar', type: 'desert_altar', x: 55, y: 31, description: 'Resource bonus.', strategicValue: 'medium', points: 75 },
  { id: 'altar-desert-s', name: 'South Desert Altar', type: 'desert_altar', x: 42, y: 61, description: 'Resource bonus.', strategicValue: 'medium', points: 75 },
  { id: 'altar-sky-ne', name: 'NE Sky Altar', type: 'sky_altar', x: 85, y: 27, description: 'Vision buff.', strategicValue: 'medium', points: 75 },
  { id: 'altar-sky-sw', name: 'SW Sky Altar', type: 'sky_altar', x: 12, y: 57, description: 'Vision buff.', strategicValue: 'medium', points: 75 },
  { id: 'base-ally', name: 'Allied Base', type: 'base', x: 15, y: 13, description: 'Main spawn point.', strategicValue: 'critical' },
  { id: 'base-enemy', name: 'Enemy Base', type: 'base', x: 85, y: 82, description: 'Enemy spawn.', strategicValue: 'critical' },
  { id: 'central', name: 'Central Shrine', type: 'central_shrine', x: 48, y: 45, description: 'Primary objective.', strategicValue: 'critical', points: 500 },
  { id: 'ark', name: 'The Ark', type: 'ark', x: 50, y: 38, description: 'Retrieve and deliver for massive points.', strategicValue: 'critical', points: 1000 },
];

// Strategy templates per faction
const defaultStrategies: Record<Faction, TeamStrategy[]> = {
  iset: [
    { team: 1, phase: 'opening', objective: 'Rush Central Shrine', description: 'Fast push to contest central shrine. Establish presence before enemy arrives.', locations: ['central', 'shrine-war-w'], priority: 'primary', icon: 'swords' },
    { team: 1, phase: 'mid', objective: 'Hold Central', description: 'Maintain control of central shrine. Rotate to defend against flanks.', locations: ['central', 'shrine-war-w', 'shrine-war-e'], priority: 'primary', icon: 'shield' },
    { team: 1, phase: 'late', objective: 'Push Enemy Base', description: 'With point lead, apply pressure to enemy spawn.', locations: ['base-enemy', 'outpost-e'], priority: 'primary', icon: 'swords' },
    { team: 2, phase: 'opening', objective: 'Secure Ark Route', description: 'Position along ark spawn path. Prepare for retrieval.', locations: ['ark', 'altar-desert-n'], priority: 'primary', icon: 'flag' },
    { team: 2, phase: 'mid', objective: 'Retrieve the Ark', description: 'When ark spawns, secure and escort to scoring zone.', locations: ['ark', 'central'], priority: 'primary', icon: 'flag' },
    { team: 2, phase: 'late', objective: 'Defend Ark Carrier', description: 'Protect ark carrier at all costs. Clear path to objective.', locations: ['ark', 'central', 'outpost-nc'], priority: 'primary', icon: 'shield' },
    { team: 3, phase: 'opening', objective: 'Capture Flanks', description: 'Secure obelisks and altars on flanks. Deny enemy resources.', locations: ['obelisk-w', 'altar-sky-sw', 'shrine-life-sw'], priority: 'secondary', icon: 'zap' },
    { team: 3, phase: 'mid', objective: 'Harass & Reinforce', description: 'Rotate to support Team 1 or 2 as needed. Keep pressure on enemy flanks.', locations: ['obelisk-w', 'obelisk-s', 'shrine-war-w'], priority: 'support', icon: 'zap' },
    { team: 3, phase: 'late', objective: 'Cut Reinforcements', description: 'Intercept enemy respawns. Control southern routes.', locations: ['outpost-se', 'obelisk-s', 'shrine-life-sw'], priority: 'secondary', icon: 'swords' },
  ],
  seth: [
    { team: 1, phase: 'opening', objective: 'Contest Central', description: 'Push to central shrine. Fight for control.', locations: ['central', 'shrine-war-e'], priority: 'primary', icon: 'swords' },
    { team: 1, phase: 'mid', objective: 'Control Shrines', description: 'Secure both war shrines for combat advantage.', locations: ['shrine-war-e', 'shrine-war-w', 'central'], priority: 'primary', icon: 'shield' },
    { team: 1, phase: 'late', objective: 'Siege Enemy', description: 'Full assault on enemy territory.', locations: ['base-ally', 'outpost-nw'], priority: 'primary', icon: 'swords' },
    { team: 2, phase: 'opening', objective: 'Ark Intercept', description: 'Position to contest ark spawn. Deny enemy retrieval.', locations: ['ark', 'altar-desert-n', 'altar-desert-s'], priority: 'primary', icon: 'flag' },
    { team: 2, phase: 'mid', objective: 'Secure the Ark', description: 'Retrieve ark and escort to scoring zone.', locations: ['ark', 'central'], priority: 'primary', icon: 'flag' },
    { team: 2, phase: 'late', objective: 'Ark Delivery', description: 'Final push with ark. Coordinate with all teams.', locations: ['ark', 'central'], priority: 'primary', icon: 'flag' },
    { team: 3, phase: 'opening', objective: 'Eastern Control', description: 'Secure eastern obelisks and altars.', locations: ['obelisk-e', 'altar-sky-ne', 'shrine-life-ne'], priority: 'secondary', icon: 'zap' },
    { team: 3, phase: 'mid', objective: 'Flank Support', description: 'Rotate to reinforce main team or ark team.', locations: ['obelisk-e', 'shrine-war-e', 'outpost-e'], priority: 'support', icon: 'zap' },
    { team: 3, phase: 'late', objective: 'Spawn Control', description: 'Camp enemy spawn routes. Delay reinforcements.', locations: ['outpost-nw', 'outpost-n', 'obelisk-w'], priority: 'secondary', icon: 'swords' },
  ],
};

const strategicValueColors: Record<string, { dark: string; light: string }> = {
  low: { dark: '#6B7280', light: '#9CA3AF' },
  medium: { dark: '#EAB308', light: '#CA8A04' },
  high: { dark: '#F97316', light: '#EA580C' },
  critical: { dark: '#EF4444', light: '#DC2626' },
};

const StrategyIcon = ({ type, className, style }: { type: string; className?: string; style?: React.CSSProperties }) => {
  const props = { className, style };
  switch (type) {
    case 'swords': return <Swords {...props} />;
    case 'shield': return <Shield {...props} />;
    case 'flag': return <Flag {...props} />;
    case 'zap': return <Zap {...props} />;
    default: return <Target {...props} />;
  }
};

export default function AOOInteractiveMap() {
  const [isDark, setIsDark] = useState(true);
  const [faction, setFaction] = useState<Faction>('iset');
  const [selectedTeam, setSelectedTeam] = useState<SubTeam | 'all'>('all');
  const [selectedPhase, setSelectedPhase] = useState<Phase>('all');
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [hoveredLocation, setHoveredLocation] = useState<MapLocation | null>(null);
  const [showStrategyPanel, setShowStrategyPanel] = useState(true);

  const toggleTheme = useCallback(() => setIsDark(prev => !prev), []);

  const activeStrategies = defaultStrategies[faction].filter(s => {
    if (selectedTeam !== 'all' && s.team !== selectedTeam) return false;
    if (selectedPhase !== 'all' && s.phase !== selectedPhase) return false;
    return true;
  });

  const highlightedLocations = new Set(activeStrategies.flatMap(s => s.locations));

  const theme = {
    bg: isDark ? 'bg-zinc-950' : 'bg-slate-50',
    bgSecondary: isDark ? 'bg-zinc-900' : 'bg-white',
    bgTertiary: isDark ? 'bg-zinc-800' : 'bg-slate-100',
    bgHover: isDark ? 'hover:bg-zinc-700' : 'hover:bg-slate-200',
    text: isDark ? 'text-white' : 'text-slate-900',
    textSecondary: isDark ? 'text-zinc-400' : 'text-slate-600',
    textMuted: isDark ? 'text-zinc-500' : 'text-slate-400',
    border: isDark ? 'border-zinc-800' : 'border-slate-200',
    accent: faction === 'iset' ? 'text-blue-400' : 'text-red-400',
    accentBg: faction === 'iset' ? 'bg-blue-500' : 'bg-red-500',
  };

  const getMarkerSize = (type: LocationType) => {
    if (type === 'central_shrine' || type === 'ark') return 44;
    if (type === 'base' || type === 'shrine_war') return 36;
    return 28;
  };

  return (
    <div className={`${theme.bg} min-h-screen transition-colors duration-300`}>
      {/* Header */}
      <header className={`${theme.bgSecondary} border-b ${theme.border} px-4 py-3 sticky top-0 z-50`}>
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className={`text-xl font-bold ${theme.text}`}>AOO Strategy Map</h1>
            
            <div className={`flex rounded-lg ${theme.bgTertiary} p-1`}>
              <button
                onClick={() => setFaction('iset')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  faction === 'iset' ? 'bg-blue-500 text-white shadow-lg' : `${theme.textSecondary} ${theme.bgHover}`
                }`}
              >
                Iset
              </button>
              <button
                onClick={() => setFaction('seth')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  faction === 'seth' ? 'bg-red-500 text-white shadow-lg' : `${theme.textSecondary} ${theme.bgHover}`
                }`}
              >
                Seth
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowStrategyPanel(!showStrategyPanel)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${theme.bgTertiary} ${theme.text} text-sm ${theme.bgHover} transition-colors`}
            >
              {showStrategyPanel ? <EyeOff size={16} /> : <Eye size={16} />}
              <span className="hidden sm:inline">Strategy</span>
            </button>

            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${theme.bgTertiary} ${theme.text} ${theme.bgHover} transition-colors`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          
          {/* Left Panel */}
          <div className="lg:w-64 space-y-4">
            {/* Team Selector */}
            <div className={`${theme.bgSecondary} rounded-xl p-4 border ${theme.border}`}>
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted} mb-3`}>
                Your Team
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedTeam('all')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    selectedTeam === 'all' ? `${theme.accentBg} text-white` : `${theme.bgTertiary} ${theme.text} ${theme.bgHover}`
                  }`}
                >
                  <Users size={18} />
                  <span className="font-medium">All Teams</span>
                </button>
                
                {([1, 2, 3] as SubTeam[]).map((team) => (
                  <button
                    key={team}
                    onClick={() => setSelectedTeam(team)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                      selectedTeam === team ? 'text-white shadow-lg' : `${theme.bgTertiary} ${theme.text} ${theme.bgHover}`
                    }`}
                    style={selectedTeam === team ? { backgroundColor: teamColors[team].primary } : {}}
                  >
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: selectedTeam === team ? 'rgba(255,255,255,0.25)' : teamColors[team].primary }}
                    >
                      {team}
                    </div>
                    <span className="font-medium">{teamColors[team].name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Phase Selector */}
            <div className={`${theme.bgSecondary} rounded-xl p-4 border ${theme.border}`}>
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted} mb-3`}>
                Game Phase
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {(['all', 'opening', 'mid', 'late'] as Phase[]).map((phase) => (
                  <button
                    key={phase}
                    onClick={() => setSelectedPhase(phase)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                      selectedPhase === phase ? `${theme.accentBg} text-white` : `${theme.bgTertiary} ${theme.text} ${theme.bgHover}`
                    }`}
                  >
                    {phase === 'all' ? 'All' : phase}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className={`${theme.bgSecondary} rounded-xl p-4 border ${theme.border}`}>
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted} mb-3`}>
                Location Types
              </h3>
              <div className="space-y-1.5">
                {Object.entries(locationConfig).map(([type, config]) => (
                  <div key={type} className={`flex items-center gap-2 text-sm ${theme.textSecondary}`}>
                    <span>{config.icon}</span>
                    <span>{config.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Map */}
          <div className="flex-1">
            <div className={`${theme.bgSecondary} rounded-xl overflow-hidden border ${theme.border}`}>
              <div className="relative" style={{ paddingBottom: '70%' }}>
                <div 
                  className="absolute inset-0"
                  style={{ backgroundColor: isDark ? '#3D3428' : '#C4A77D' }}
                >
                  <img
                    src="/aoo-map.jpg"
                    alt="AOO Map"
                    className="w-full h-full object-cover"
                    style={{ opacity: isDark ? 0.7 : 1 }}
                  />
                </div>

                {/* Route lines */}
                {selectedTeam !== 'all' && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
                    {activeStrategies.map((strategy, idx) => {
                      const locs = strategy.locations
                        .map(id => mapLocations.find(l => l.id === id))
                        .filter(Boolean) as MapLocation[];
                      if (locs.length < 2) return null;
                      const pathD = locs.map((loc, i) => `${i === 0 ? 'M' : 'L'} ${loc.x}% ${loc.y}%`).join(' ');
                      return (
                        <path
                          key={idx}
                          d={pathD}
                          fill="none"
                          stroke={teamColors[strategy.team].primary}
                          strokeWidth="3"
                          strokeDasharray="8 4"
                          strokeLinecap="round"
                          opacity="0.7"
                        />
                      );
                    })}
                  </svg>
                )}

                {/* Markers */}
                {mapLocations.map((location) => {
                  const config = locationConfig[location.type];
                  const isSelected = selectedLocation?.id === location.id;
                  const isHovered = hoveredLocation?.id === location.id;
                  const isHighlighted = highlightedLocations.has(location.id);
                  const size = getMarkerSize(location.type);
                  const teamsHere = activeStrategies.filter(s => s.locations.includes(location.id)).map(s => s.team);

                  return (
                    <div
                      key={location.id}
                      className="absolute cursor-pointer transition-all duration-200"
                      style={{
                        left: `${location.x}%`,
                        top: `${location.y}%`,
                        transform: `translate(-50%, -50%) scale(${isSelected || isHovered ? 1.2 : 1})`,
                        zIndex: isSelected || isHovered ? 30 : isHighlighted ? 20 : 10,
                      }}
                      onClick={() => setSelectedLocation(isSelected ? null : location)}
                      onMouseEnter={() => setHoveredLocation(location)}
                      onMouseLeave={() => setHoveredLocation(null)}
                    >
                      {isHighlighted && (
                        <div 
                          className="absolute rounded-full"
                          style={{
                            width: size + 12,
                            height: size + 12,
                            left: -6,
                            top: -6,
                            backgroundColor: teamsHere.length > 0 ? teamColors[teamsHere[0]].primary : (faction === 'iset' ? '#2563EB' : '#EF4444'),
                            opacity: 0.25,
                          }}
                        />
                      )}

                      <div
                        className={`rounded-full flex items-center justify-center shadow-lg transition-all`}
                        style={{
                          width: size,
                          height: size,
                          backgroundColor: isDark ? config.darkColor : config.color,
                          boxShadow: isSelected 
                            ? `0 0 0 3px ${faction === 'iset' ? '#3B82F6' : '#EF4444'}` 
                            : isHighlighted && teamsHere.length > 0 
                              ? `0 0 0 2px ${teamColors[teamsHere[0]].primary}`
                              : undefined,
                        }}
                      >
                        <span style={{ fontSize: size * 0.5 }}>{config.icon}</span>
                      </div>

                      {teamsHere.length > 0 && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {[...new Set(teamsHere)].map(t => (
                            <div
                              key={t}
                              className="w-3 h-3 rounded-full text-[8px] font-bold flex items-center justify-center text-white shadow"
                              style={{ backgroundColor: teamColors[t].primary }}
                            >
                              {t}
                            </div>
                          ))}
                        </div>
                      )}

                      {isHovered && !isSelected && (
                        <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap z-50 shadow-xl border ${theme.bgSecondary} ${theme.text} ${theme.border}`}>
                          {location.name}
                          <div 
                            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
                            style={{ borderTopColor: isDark ? '#18181B' : '#FFFFFF' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          {showStrategyPanel && (
            <div className="lg:w-80 space-y-4">
              <div className={`${theme.bgSecondary} rounded-xl p-4 border ${theme.border}`}>
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted} mb-3`}>
                  {selectedTeam === 'all' ? 'All Team Objectives' : `${teamColors[selectedTeam as SubTeam].name} Objectives`}
                </h3>
                
                {activeStrategies.length > 0 ? (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {activeStrategies.map((strategy, idx) => (
                      <div
                        key={idx}
                        className={`${theme.bgTertiary} rounded-lg p-3 border-l-4 transition-all hover:scale-[1.01]`}
                        style={{ borderLeftColor: teamColors[strategy.team].primary }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${teamColors[strategy.team].primary}20` }}>
                            <StrategyIcon type={strategy.icon} className="w-4 h-4" style={{ color: teamColors[strategy.team].primary }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span 
                                className="text-xs font-medium px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: `${teamColors[strategy.team].primary}20`, color: teamColors[strategy.team].primary }}
                              >
                                {teamColors[strategy.team].name}
                              </span>
                              <span className={`text-xs ${theme.textMuted} capitalize`}>{strategy.phase}</span>
                            </div>
                            <h4 className={`font-semibold ${theme.text} mt-1`}>{strategy.objective}</h4>
                            <p className={`text-sm ${theme.textSecondary} mt-1`}>{strategy.description}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {strategy.locations.map(locId => {
                                const loc = mapLocations.find(l => l.id === locId);
                                return loc ? (
                                  <span key={locId} className={`text-xs px-2 py-0.5 rounded-full ${theme.bgSecondary} ${theme.textSecondary}`}>
                                    {locationConfig[loc.type].icon} {loc.name.split(' ').slice(-2).join(' ')}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`text-center py-6 ${theme.textMuted}`}>
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select a team and phase to view objectives</p>
                  </div>
                )}
              </div>

              {selectedLocation && (
                <div className={`${theme.bgSecondary} rounded-xl p-4 border ${theme.border}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{locationConfig[selectedLocation.type].icon}</span>
                      <div>
                        <h3 className={`font-semibold ${theme.text}`}>{selectedLocation.name}</h3>
                        <p className={`text-xs ${theme.textMuted}`}>{locationConfig[selectedLocation.type].label}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedLocation(null)} className={`${theme.textMuted} hover:${theme.text} text-xl leading-none`}>×</button>
                  </div>
                  
                  <p className={`text-sm ${theme.textSecondary} mb-3`}>{selectedLocation.description}</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`${theme.bgTertiary} rounded-lg p-2`}>
                      <p className={`text-xs ${theme.textMuted}`}>Value</p>
                      <p className="font-semibold capitalize text-sm" style={{ color: strategicValueColors[selectedLocation.strategicValue][isDark ? 'dark' : 'light'] }}>
                        {selectedLocation.strategicValue}
                      </p>
                    </div>
                    {selectedLocation.points && (
                      <div className={`${theme.bgTertiary} rounded-lg p-2`}>
                        <p className={`text-xs ${theme.textMuted}`}>Points</p>
                        <p className={`font-semibold text-sm ${theme.accent}`}>{selectedLocation.points}</p>
                      </div>
                    )}
                    {selectedLocation.respawnTime && (
                      <div className={`${theme.bgTertiary} rounded-lg p-2`}>
                        <p className={`text-xs ${theme.textMuted}`}>Respawn</p>
                        <p className="font-semibold text-sm text-green-400">{selectedLocation.respawnTime}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
