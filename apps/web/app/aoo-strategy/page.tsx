'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import type { MapAssignments, Player, Team, StrategyData as ImportedStrategyData, EventMode } from '@/lib/aoo-strategy/types';
import { defaultStrategyData } from '@/lib/aoo-strategy/strategy-data';
import { TrainingPolls } from '@/components/aoo-strategy/TrainingPolls';
import { useAllianceRoster, formatPower } from '@/lib/supabase/use-alliance-roster';

// Dynamic import to avoid SSR issues with the map
const AOOInteractiveMap = dynamic(() => import('@/components/aoo-strategy/AOOInteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  ),
});

// Use TeamInfo as an alias for Team for backward compatibility
type TeamInfo = Team;

// Use imported StrategyData type
type StrategyData = ImportedStrategyData;

const DEFAULT_TEAMS: TeamInfo[] = [
    { name: 'Zone 1', description: 'Ark' },
    { name: 'Zone 2', description: 'Upper' },
    { name: 'Zone 3', description: 'Lower' },
];

const AVAILABLE_TAGS = ['Rally Leader', 'Coordinator', 'Teleport 1st', 'Teleport 2nd', 'Hold Obelisks', 'Garrison', 'Farm', 'Conquer', 'Confirmed'];

// Simplified tag colors - muted to not compete with zone colors
// Zone colors: Z1=blue, Z2=orange, Z3=purple (match in-game)
const TAG_COLORS: Record<string, string> = {
    'Rally Leader': 'bg-stone-700 text-white',
    'Coordinator': 'bg-stone-600 text-white',
    'Teleport 1st': 'bg-emerald-700 text-white',
    'Teleport 2nd': 'bg-emerald-600/70 text-white',
    'Hold Obelisks': 'bg-stone-600 text-stone-200',
    'Garrison': 'bg-stone-600 text-stone-200',
    'Farm': 'bg-stone-500 text-white',
    'Conquer': 'bg-stone-600 text-stone-200',
    'Confirmed': 'bg-green-600 text-white',
};

// Zone colors matching in-game
const ZONE_COLORS: Record<number, { bg: string; border: string; text: string }> = {
    1: { bg: 'bg-blue-600', border: 'border-blue-500', text: 'text-blue-400' },
    2: { bg: 'bg-orange-600', border: 'border-orange-500', text: 'text-orange-400' },
    3: { bg: 'bg-purple-600', border: 'border-purple-500', text: 'text-purple-400' },
};

export default function AooStrategyPage() {
    // Fetch roster from Supabase
    const { rosterNames, powerByName, loading: rosterLoading } = useAllianceRoster();
    const [activeTab, setActiveTab] = useState<'map' | 'roster' | 'lookup' | 'quickref' | 'schedule'>('lookup');
    const [players, setPlayers] = useState<Player[]>([]);
    const [substitutes, setSubstitutes] = useState<Player[]>([]);
    const [teams, setTeams] = useState<TeamInfo[]>(DEFAULT_TEAMS);
    const [mapImage, setMapImage] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [mapAssignments, setMapAssignments] = useState<MapAssignments | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditor, setIsEditor] = useState(false);
    const [editorPassword, setEditorPassword] = useState('');
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [strategyId, setStrategyId] = useState<number | null>(null);
    const [darkMode, setDarkMode] = useState(true);
    const [strategyExpanded, setStrategyExpanded] = useState(false);
    const [eventMode, setEventMode] = useState<EventMode>('main');

    const [playerSearch, setPlayerSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [newPlayerTeam, setNewPlayerTeam] = useState(1);
    const [newPlayerTags, setNewPlayerTags] = useState<string[]>([]);
    const [useCustomName, setUseCustomName] = useState(false);
    const [lookupSearch, setLookupSearch] = useState('');
    const [rosterSort, setRosterSort] = useState<'power' | 'teleport' | 'name'>('teleport');
    const [copySuccess, setCopySuccess] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const rosterGridRef = useRef<HTMLDivElement>(null);
    const rosterCanvasRef = useRef<HTMLCanvasElement>(null);

    const EDITOR_PASSWORD = 'carn-dum';

    useEffect(() => {
        // Load data for the initial event mode (check URL or localStorage)
        const savedMode = localStorage.getItem('aoo-event-mode') as EventMode | null;
        const initialMode = savedMode || 'main';
        setEventMode(initialMode);
        loadData(initialMode);
        const savedTheme = localStorage.getItem('aoo-theme');
        if (savedTheme) setDarkMode(savedTheme === 'dark');
    }, []);

    // Handle event mode changes
    const handleEventModeChange = (newMode: EventMode) => {
        if (newMode === eventMode) return;
        setEventMode(newMode);
        localStorage.setItem('aoo-event-mode', newMode);
        loadData(newMode);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleTheme = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        localStorage.setItem('aoo-theme', newMode ? 'dark' : 'light');
    };

    const loadData = async (mode: EventMode = eventMode) => {
        setIsLoading(true);
        try {
            // Query for the specific event mode, fall back to any record for backwards compatibility
            const { data, error } = await supabase
                .from('aoo_strategy')
                .select('*')
                .eq('event_mode', mode)
                .limit(1)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                // PGRST116 = column doesn't exist (migration not run yet)
                console.error('Error loading data:', error);
            }

            if (data) {
                setStrategyId(data.id);
                const strategyData = data.data as StrategyData;
                setPlayers(strategyData?.players || []);
                setSubstitutes(strategyData?.substitutes || []);
                setTeams(strategyData?.teams || DEFAULT_TEAMS);
                setMapImage(strategyData?.mapImage || null);
                setNotes(strategyData?.notes || '');
                setMapAssignments(strategyData?.mapAssignments || undefined);
            } else {
                // No data for this mode - reset to defaults
                setStrategyId(null);
                setPlayers([]);
                setSubstitutes([]);
                setTeams(DEFAULT_TEAMS);
                setMapImage(null);
                setNotes('');
                setMapAssignments(undefined);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
        setIsLoading(false);
    };

    const saveData = async (updatedData: Partial<StrategyData>) => {
        const data: StrategyData = {
            players: updatedData.players ?? players,
            teams: updatedData.teams ?? teams,
            mapImage: updatedData.mapImage ?? mapImage,
            notes: updatedData.notes ?? notes,
            mapAssignments: updatedData.mapAssignments ?? mapAssignments ?? {},
            substitutes: updatedData.substitutes ?? substitutes,
        };
        try {
            if (strategyId) {
                const { error } = await supabase.from('aoo_strategy').update({ data }).eq('id', strategyId);
                if (error) throw error;
            } else {
                const { data: newData, error } = await supabase
                    .from('aoo_strategy')
                    .insert([{ data, event_mode: eventMode }])
                    .select()
                    .single();
                if (error) throw error;
                if (newData) setStrategyId(newData.id);
            }
        } catch (error) {
            console.error('Error saving data:', error);
            alert('Error saving data. Please try again.');
        }
    };

    const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isEditor) return;
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const newMapImage = event.target?.result as string;
                setMapImage(newMapImage);
                saveData({ mapImage: newMapImage });
            };
            reader.readAsDataURL(file);
        }
    };

    const assignedNames = [...players, ...substitutes].map(p => p.name.toLowerCase());
    const filteredRoster = rosterNames.filter(name =>
        name.toLowerCase().includes(playerSearch.toLowerCase()) &&
        !assignedNames.includes(name.toLowerCase())
    );

    const addPlayer = (name: string) => {
        if (!isEditor || !name.trim()) return;
        if ([...players, ...substitutes].some(p => p.name.toLowerCase() === name.toLowerCase())) {
            alert('Player already assigned!');
            return;
        }
        const newPlayer: Player = { id: Date.now(), name: name.trim(), team: newPlayerTeam, tags: newPlayerTags, power: 0, assignments: { phase1: "", phase2: "", phase3: "", phase4: "" } };
        
        if (newPlayerTeam === 0) {
            // Add to substitutes
            const updatedSubs = [...substitutes, newPlayer];
            setSubstitutes(updatedSubs);
            saveData({ substitutes: updatedSubs });
        } else {
            // Add to players
            const updatedPlayers = [...players, newPlayer];
            setPlayers(updatedPlayers);
            saveData({ players: updatedPlayers });
        }
        
        setPlayerSearch('');
        setNewPlayerTags([]);
        setShowDropdown(false);
        setUseCustomName(false);
    };

    const removePlayer = (id: number) => {
        if (!isEditor) return;
        const updatedPlayers = players.filter(p => p.id !== id);
        setPlayers(updatedPlayers);
        saveData({ players: updatedPlayers });
    };

    const togglePlayerTag = (playerId: number, tag: string) => {
        if (!isEditor) return;
        const updatedPlayers = players.map(p => {
            if (p.id === playerId) {
                const newTags = p.tags.includes(tag) ? p.tags.filter(t => t !== tag) : [...p.tags, tag];
                return { ...p, tags: newTags };
            }
            return p;
        });
        setPlayers(updatedPlayers);
        saveData({ players: updatedPlayers });
    };

    const updateTeamDescription = (teamIndex: number, description: string) => {
        if (!isEditor) return;
        const updatedTeams = teams.map((t, i) => i === teamIndex ? { ...t, description } : t);
        setTeams(updatedTeams);
        saveData({ teams: updatedTeams });
    };

    const movePlayer = (playerId: number, newTeam: number) => {
        if (!isEditor) return;
        const updatedPlayers = players.map(p => p.id === playerId ? { ...p, team: newTeam } : p);
        setPlayers(updatedPlayers);
        saveData({ players: updatedPlayers });
    };

    const handlePasswordSubmit = () => {
        if (editorPassword === EDITOR_PASSWORD) {
            setIsEditor(true);
            setShowPasswordPrompt(false);
            setEditorPassword('');
        } else {
            alert('Incorrect password');
            setEditorPassword('');
        }
    };

    const getTeamPlayers = (teamNum: number) => {
        const teamPlayers = players.filter(p => p.team === teamNum);
        return sortPlayers(teamPlayers);
    };

    const sortPlayers = (playerList: Player[]) => {
        return [...playerList].sort((a, b) => {
            // Rally Leaders always at top
            const aIsLeader = a.tags.includes('Rally Leader');
            const bIsLeader = b.tags.includes('Rally Leader');
            if (aIsLeader && !bIsLeader) return -1;
            if (!aIsLeader && bIsLeader) return 1;

            switch (rosterSort) {
                case 'power':
                    const powerA = a.power || powerByName[a.name] || 0;
                    const powerB = b.power || powerByName[b.name] || 0;
                    return powerB - powerA; // Descending
                case 'teleport':
                    // Teleport order: 1st > 2nd > none, then by power within group
                    const getTeleportOrder = (p: Player) => {
                        if (p.tags.includes('Teleport 1st')) return 0;
                        if (p.tags.includes('Teleport 2nd')) return 1;
                        return 2;
                    };
                    const orderA = getTeleportOrder(a);
                    const orderB = getTeleportOrder(b);
                    if (orderA !== orderB) return orderA - orderB;
                    // Same teleport group, sort by power
                    return (b.power || powerByName[b.name] || 0) - (a.power || powerByName[a.name] || 0);
                case 'name':
                    return a.name.localeCompare(b.name); // Alphabetical
                default:
                    return 0;
            }
        });
    };

    const handleMapSave = (newAssignments: MapAssignments) => {
        setMapAssignments(newAssignments);
        saveData({ mapAssignments: newAssignments });
    };

    // Generate zone roster text for copying to clipboard (newline separated)
    const generateZoneText = useCallback((zoneNum: number) => {
        const formatPlayerTags = (p: Player) => {
            const tags: string[] = [];
            if (p.tags.includes('Rally Leader')) tags.push('Leader');
            if (p.tags.includes('Coordinator')) tags.push('Coordinator');
            if (p.tags.includes('Teleport 1st')) tags.push('1st Teleport');
            if (p.tags.includes('Teleport 2nd')) tags.push('2nd Teleport');
            return tags.length > 0 ? ` (${tags.join(', ')})` : '';
        };

        const zonePlayers = sortPlayers(players.filter(p => p.team === zoneNum));
        const zoneName = teams[zoneNum - 1]?.name || `Zone ${zoneNum}`;
        const zoneDesc = teams[zoneNum - 1]?.description || '';

        const header = `${zoneName} - ${zoneDesc}`;
        const playerLines = zonePlayers.map(p => `${p.name}${formatPlayerTags(p)}`);

        return `${header}\n${playerLines.join('\n')}`;
    }, [players, teams, sortPlayers]);

    const copyZoneToClipboard = useCallback(async (zoneNum: number) => {
        const text = generateZoneText(zoneNum);
        try {
            await navigator.clipboard.writeText(text);
            setCopySuccess(zoneNum);
            setTimeout(() => setCopySuccess(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [generateZoneText]);

    const exportRosterImage = useCallback(() => {
        const canvas = rosterCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Canvas settings
        const padding = 40;
        const zoneWidth = 400;
        const playerHeight = 28;
        const headerHeight = 50;
        const zoneGap = 30;
        const subsHeight = substitutes.length > 0 ? 60 + Math.ceil(substitutes.length / 6) * 24 : 0;

        // Calculate dimensions
        const zonePlayers = [1, 2, 3].map(z => sortPlayers(players.filter(p => p.team === z)));
        const maxPlayers = Math.max(...zonePlayers.map(z => z.length));
        const canvasWidth = (zoneWidth * 3) + (zoneGap * 2) + (padding * 2);
        const canvasHeight = headerHeight + (maxPlayers * playerHeight) + (padding * 2) + 60 + subsHeight;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Background
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Title
        ctx.fillStyle = '#fafafa';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const titleText = eventMode === 'training'
            ? 'Ark of Osiris - Training Match'
            : 'Ark of Osiris - Zone Assignments';
        ctx.fillText(titleText, canvasWidth / 2, padding + 10);

        // Zone colors matching in-game (Z1=blue, Z2=orange, Z3=purple)
        const zoneHexColors: Record<number, string> = {
            1: '#2563eb', // blue-600
            2: '#ea580c', // orange-600
            3: '#9333ea', // purple-600
        };

        // Draw each zone
        [1, 2, 3].forEach((zoneNum, idx) => {
            const x = padding + (idx * (zoneWidth + zoneGap));
            const y = padding + headerHeight;
            const zonePlayersList = zonePlayers[idx];
            const zoneName = teams[zoneNum - 1]?.name || `Zone ${zoneNum}`;
            const zoneDesc = teams[zoneNum - 1]?.description || '';

            // Zone header with colored left border
            ctx.fillStyle = '#27272a';
            ctx.fillRect(x, y, zoneWidth, 36);
            // Left color stripe
            ctx.fillStyle = zoneHexColors[zoneNum];
            ctx.fillRect(x, y, 4, 36);
            ctx.fillStyle = zoneHexColors[zoneNum];
            ctx.font = 'bold 14px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${zoneName} - ${zoneDesc}`, x + 12, y + 24);
            ctx.fillStyle = '#a1a1aa';
            ctx.font = '12px system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${zonePlayersList.length} players`, x + zoneWidth - 12, y + 24);

            // Players
            zonePlayersList.forEach((p, pIdx) => {
                const py = y + 40 + (pIdx * playerHeight);

                // Alternating row background
                ctx.fillStyle = pIdx % 2 === 0 ? '#1f1f23' : '#18181b';
                ctx.fillRect(x, py, zoneWidth, playerHeight);

                // Player name
                ctx.fillStyle = '#fafafa';
                ctx.font = '13px system-ui, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(p.name, x + 12, py + 18);

                // Tags - muted colors to not compete with zone colors
                let tagX = x + 140;
                const tagColors: Record<string, string> = {
                    'Rally Leader': '#44403c',  // stone-700
                    'Coordinator': '#57534e',   // stone-600
                    'Teleport 1st': '#047857',  // emerald-700
                    'Teleport 2nd': '#059669',  // emerald-600
                };

                p.tags.forEach(tag => {
                    if (tagColors[tag]) {
                        const shortTag = tag === 'Rally Leader' ? 'Leader' :
                                        tag === 'Coordinator' ? 'Coord' :
                                        tag === 'Teleport 1st' ? '1st' :
                                        tag === 'Teleport 2nd' ? '2nd' : tag;
                        ctx.fillStyle = tagColors[tag];
                        const tagWidth = ctx.measureText(shortTag).width + 12;
                        ctx.beginPath();
                        ctx.roundRect(tagX, py + 4, tagWidth, 18, 4);
                        ctx.fill();
                        ctx.fillStyle = '#fff';
                        ctx.font = '11px system-ui, sans-serif';
                        ctx.fillText(shortTag, tagX + 6, py + 16);
                        tagX += tagWidth + 4;
                    }
                });

                // Power
                const power = p.power || powerByName[p.name] || 0;
                if (power > 0) {
                    ctx.fillStyle = '#71717a';
                    ctx.font = '11px system-ui, sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(formatPower(power), x + zoneWidth - 12, py + 18);
                }
            });
        });

        // Substitutes section
        if (substitutes.length > 0) {
            const subsY = padding + headerHeight + (maxPlayers * playerHeight) + 60;

            // Subs header
            ctx.fillStyle = '#a1a1aa';
            ctx.font = 'bold 12px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`SUBSTITUTES (${substitutes.length})`, padding, subsY);

            // Draw subs in a grid (6 per row)
            const subsPerRow = 6;
            const subWidth = (canvasWidth - padding * 2) / subsPerRow;
            substitutes.forEach((sub, idx) => {
                const row = Math.floor(idx / subsPerRow);
                const col = idx % subsPerRow;
                const sx = padding + (col * subWidth);
                const sy = subsY + 16 + (row * 24);

                ctx.fillStyle = '#71717a';
                ctx.font = '12px system-ui, sans-serif';
                ctx.textAlign = 'left';
                const power = sub.power || powerByName[sub.name] || 0;
                const powerStr = power > 0 ? ` (${formatPower(power)})` : '';
                ctx.fillText(`${sub.name}${powerStr}`, sx, sy);
            });
        }

        // Download
        const link = document.createElement('a');
        link.download = eventMode === 'training' ? 'aoo-training-roster.png' : 'aoo-roster.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }, [players, teams, substitutes, sortPlayers, powerByName, eventMode]);

    const theme = {
        bg: darkMode ? 'bg-zinc-950' : 'bg-gray-50',
        card: darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200',
        text: darkMode ? 'text-zinc-100' : 'text-gray-900',
        textMuted: darkMode ? 'text-zinc-400' : 'text-gray-500',
        textAccent: darkMode ? 'text-emerald-400' : 'text-emerald-600',
        border: darkMode ? 'border-zinc-800' : 'border-gray-200',
        input: darkMode ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
        button: darkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900',
        buttonPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        tag: darkMode ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700',
        tagActive: 'bg-emerald-600 text-white',
        dropdown: darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-300',
        dropdownHover: darkMode ? 'hover:bg-zinc-700' : 'hover:bg-gray-100',
        tabActive: darkMode ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 shadow',
        tabInactive: darkMode ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-700',
    };

    if (isLoading) {
        return (
            <div className={`min-h-screen ${theme.bg} ${theme.text} flex items-center justify-center`}>
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className={theme.textMuted}>Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors duration-200`}>
            {/* Header */}
            <header className={`${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'} border-b sticky top-0 z-40`}>
                <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <a 
                                href="/"
                                className={`p-2 rounded-lg ${theme.button} hover:opacity-80 transition-opacity`}
                                title="Back to Home"
                            >
                                ←
                            </a>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Ark of Osiris</h1>
                                    {eventMode === 'training' && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-600 text-white rounded-full">
                                            Training
                                        </span>
                                    )}
                                </div>
                                <p className={`text-sm ${theme.textMuted}`}>
                                    {eventMode === 'training' ? 'Training Match Roster' : '30v30 Strategy Planner'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            {/* Event Mode Toggle */}
                            <div className={`flex rounded-lg p-0.5 ${darkMode ? 'bg-zinc-800' : 'bg-gray-200'}`}>
                                <button
                                    onClick={() => handleEventModeChange('main')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        eventMode === 'main'
                                            ? 'bg-emerald-600 text-white'
                                            : darkMode ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-600 hover:text-gray-800'
                                    }`}
                                >
                                    Main
                                </button>
                                <button
                                    onClick={() => handleEventModeChange('training')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        eventMode === 'training'
                                            ? 'bg-amber-600 text-white'
                                            : darkMode ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-600 hover:text-gray-800'
                                    }`}
                                >
                                    Training
                                </button>
                            </div>
                            <button onClick={toggleTheme} className={`p-2 rounded-lg ${theme.button}`}>
                                {darkMode ? '☀️' : '🌙'}
                            </button>
                            {!isEditor ? (
                                <button onClick={() => setShowPasswordPrompt(true)} className={`px-4 py-2 rounded-lg text-sm font-medium ${theme.button}`}>
                                    Edit Mode
                                </button>
                            ) : (
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${theme.tagActive}`}>Editing</span>
                            )}
                        </div>
                    </div>

                    {/* Tabs - Find My Role first */}
                    <div className="flex gap-1 mt-4 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('lookup')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                activeTab === 'lookup' ? theme.tabActive : theme.tabInactive
                            }`}
                        >
                            🔍 Find My Role
                        </button>
                        <button
                            onClick={() => setActiveTab('quickref')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                activeTab === 'quickref' ? theme.tabActive : theme.tabInactive
                            }`}
                        >
                            ⚡ Quick Guide
                        </button>
                        <button
                            onClick={() => setActiveTab('map')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                activeTab === 'map' ? theme.tabActive : theme.tabInactive
                            }`}
                        >
                            🗺️ Strategy Map
                        </button>
                        <button
                            onClick={() => setActiveTab('roster')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                activeTab === 'roster' ? theme.tabActive : theme.tabInactive
                            }`}
                        >
                            👥 Zone Roster
                        </button>
                        <button
                            onClick={() => setActiveTab('schedule')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                activeTab === 'schedule' ? theme.tabActive : theme.tabInactive
                            }`}
                        >
                            📅 Schedule
                        </button>
                    </div>
                </div>
            </header>

            {/* Password Prompt Modal */}
            {showPasswordPrompt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className={`${theme.card} border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl`}>
                        <h2 className="text-lg font-semibold mb-4">Enter Password</h2>
                        <input type="password" value={editorPassword} onChange={(e) => setEditorPassword(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()} placeholder="Password"
                            className={`w-full px-3 py-2 rounded-lg border ${theme.input} mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500`} autoFocus />
                        <div className="flex gap-2">
                            <button onClick={handlePasswordSubmit} className={`flex-1 py-2 rounded-lg font-medium ${theme.buttonPrimary}`}>Submit</button>
                            <button onClick={() => setShowPasswordPrompt(false)} className={`flex-1 py-2 rounded-lg font-medium ${theme.button}`}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Content */}
            {activeTab === 'map' && (
                <AOOInteractiveMap 
                    initialAssignments={mapAssignments}
                    onSave={handleMapSave}
                    isEditor={isEditor}
                    players={players}
                />
            )}

            {activeTab === 'roster' && (
                /* Roster Tab */
                <div className="max-w-7xl mx-auto p-4 md:p-6">
                    {/* Strategy Overview */}
                    <section className={`${theme.card} border-2 border-emerald-500 rounded-xl mb-6 p-4`}>
                        <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 text-emerald-500`}>📋 Strategy Overview</h2>

                        {/* Key Rules */}
                        <div className={`grid md:grid-cols-2 gap-4 mb-4`}>
                            <div className={`p-3 rounded-lg ${darkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'}`}>
                                <h3 className={`font-bold text-emerald-500 text-sm mb-2`}>📌 IMPORTANT</h3>
                                <ul className={`text-xs space-y-1 ${theme.text}`}>
                                    <li>• Pay attention to your lane assignment</li>
                                    <li>• Everyone rush their obelisk first</li>
                                    <li>• Rally leaders TP first</li>
                                    <li>• Move down ONLY after garrisoning</li>
                                    <li>• Only rally occupied buildings</li>
                                    <li>• Work as a unit, not individual</li>
                                </ul>
                            </div>
                            <div className={`p-3 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                                <h3 className={`font-bold ${theme.textMuted} text-sm mb-2`}>🎯 TROOP DEPLOYMENT</h3>
                                <ul className={`text-xs space-y-1 ${theme.text}`}>
                                    <li>🐴 <strong>Cavalry</strong> → For rallies</li>
                                    <li>🛡️ <strong>Infantry</strong> → To garrison</li>
                                    <li>🌾 <strong>Else</strong> → Gather tiles</li>
                                </ul>
                            </div>
                        </div>

                        {/* Expandable Notes */}
                        <button
                            onClick={() => setStrategyExpanded(!strategyExpanded)}
                            className={`w-full p-2 flex items-center justify-between hover:opacity-80 transition-opacity border-t ${theme.border}`}
                        >
                            <span className={`text-xs ${theme.textMuted}`}>{isEditor ? 'Edit Notes' : 'Additional Notes'}</span>
                            <span className={`text-sm ${theme.textMuted}`}>{strategyExpanded ? '▼' : '▶'}</span>
                        </button>
                        {strategyExpanded && (
                            <div className={`pt-2`}>
                                {isEditor ? (
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        onBlur={() => saveData({ notes })}
                                        placeholder="Add strategy notes..."
                                        className={`w-full min-h-[150px] px-3 py-2 rounded-lg border ${theme.input} focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y font-mono text-sm`}
                                    />
                                ) : (
                                    <div className={`whitespace-pre-wrap font-mono text-sm ${theme.text}`}>
                                        {notes || 'No additional notes'}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {isEditor && (
                        <section className={`${theme.card} border rounded-xl p-4 mb-6`}>
                            <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${theme.textMuted}`}>Add Player</h2>
                            <div className="flex flex-wrap gap-3 items-end">
                                <div className="flex-1 min-w-[200px] relative" ref={dropdownRef}>
                                    <div className="flex gap-2 mb-2">
                                        <button onClick={() => setUseCustomName(false)} className={`text-xs px-2 py-1 rounded ${!useCustomName ? theme.tagActive : theme.tag}`}>
                                            From Roster
                                        </button>
                                        <button onClick={() => setUseCustomName(true)} className={`text-xs px-2 py-1 rounded ${useCustomName ? theme.tagActive : theme.tag}`}>
                                            Custom Name
                                        </button>
                                    </div>
                                    <input type="text" value={playerSearch} onChange={(e) => { setPlayerSearch(e.target.value); setShowDropdown(true); }}
                                        onFocus={() => !useCustomName && setShowDropdown(true)}
                                        placeholder={useCustomName ? "Enter custom name" : "Search roster..."}
                                        className={`w-full px-3 py-2 rounded-lg border ${theme.input} focus:outline-none focus:ring-2 focus:ring-emerald-500`} />
                                    {showDropdown && !useCustomName && filteredRoster.length > 0 && (
                                        <div className={`absolute z-10 w-full mt-1 ${theme.dropdown} border rounded-lg shadow-lg max-h-48 overflow-y-auto`}>
                                            {filteredRoster.slice(0, 10).map(name => (
                                                <button key={name} onClick={() => addPlayer(name)}
                                                    className={`w-full text-left px-3 py-2 text-sm ${theme.dropdownHover} ${theme.text}`}>
                                                    {name}
                                                </button>
                                            ))}
                                            {filteredRoster.length > 10 && (
                                                <div className={`px-3 py-2 text-xs ${theme.textMuted}`}>+{filteredRoster.length - 10} more...</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="w-48">
                                    <select value={newPlayerTeam} onChange={(e) => setNewPlayerTeam(Number(e.target.value))}
                                        className={`w-full px-3 py-2 rounded-lg border ${theme.input} focus:outline-none focus:ring-2 focus:ring-emerald-500`}>
                                        <option value={1}>Zone 1 ({getTeamPlayers(1).length})</option>
                                        <option value={2}>Zone 2 ({getTeamPlayers(2).length})</option>
                                        <option value={3}>Zone 3 ({getTeamPlayers(3).length})</option>
                                        <option value={0}>Substitute ({substitutes.length})</option>
                                    </select>
                                </div>
                                {useCustomName && (
                                    <button onClick={() => addPlayer(playerSearch)} className={`px-6 py-2 rounded-lg font-medium ${theme.buttonPrimary}`}>Add</button>
                                )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {AVAILABLE_TAGS.map(tag => (
                                    <button key={tag} onClick={() => setNewPlayerTags(newPlayerTags.includes(tag) ? newPlayerTags.filter(t => t !== tag) : [...newPlayerTags, tag])}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${newPlayerTags.includes(tag) ? TAG_COLORS[tag] : theme.tag}`}>
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Sort Controls and Export */}
                    <div className={`flex flex-wrap items-center justify-between gap-3 mb-4`}>
                        <div className="flex items-center gap-4">
                            <h2 className={`text-sm font-semibold uppercase tracking-wider ${theme.textMuted}`}>Zone Assignments</h2>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                <span className={`text-xs ${theme.textMuted}`}>= confirmed</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Sort options */}
                            <div className="flex items-center gap-2">
                                <span className={`text-xs ${theme.textMuted}`}>Sort:</span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setRosterSort('power')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${rosterSort === 'power' ? theme.tagActive : theme.tag}`}
                                    >
                                        Power
                                    </button>
                                    <button
                                        onClick={() => setRosterSort('teleport')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${rosterSort === 'teleport' ? theme.tagActive : theme.tag}`}
                                    >
                                        Teleport
                                    </button>
                                    <button
                                        onClick={() => setRosterSort('name')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${rosterSort === 'name' ? theme.tagActive : theme.tag}`}
                                    >
                                        Name
                                    </button>
                                </div>
                            </div>
                            {/* Export action */}
                            <button
                                onClick={exportRosterImage}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme.button}`}
                            >
                                📷 Export
                            </button>
                        </div>
                    </div>
                    {/* Hidden canvas for export */}
                    <canvas ref={rosterCanvasRef} style={{ display: 'none' }} />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {[1, 2, 3].map((teamNum) => {
                            const teamInfo = teams[teamNum - 1];
                            const teamPlayers = getTeamPlayers(teamNum);
                            const zoneTotalPower = teamPlayers.reduce((sum, p) => sum + (p.power || powerByName[p.name] || 0), 0);
                            const zoneColor = ZONE_COLORS[teamNum as keyof typeof ZONE_COLORS];
                            return (
                                <section key={teamNum} className={`${theme.card} border-l-4 ${zoneColor.border} rounded-xl p-4`}>
                                    <div className={`mb-4 pb-3 border-b ${theme.border}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <h3 className={`font-semibold ${zoneColor.text}`}>{teamInfo.name}</h3>
                                                <button
                                                    onClick={() => copyZoneToClipboard(teamNum)}
                                                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${copySuccess === teamNum ? 'bg-emerald-600 text-white' : theme.tag} hover:opacity-80`}
                                                    title={`Copy ${teamInfo.name} roster`}
                                                >
                                                    {copySuccess === teamNum ? '✓' : '📋'}
                                                </button>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-xs ${theme.textMuted}`}>{teamPlayers.length} players</span>
                                                {zoneTotalPower > 0 && (
                                                    <p className={`text-xs ${theme.textAccent}`}>{formatPower(zoneTotalPower)}</p>
                                                )}
                                            </div>
                                        </div>
                                        {isEditor ? (
                                            <input type="text" value={teamInfo.description} onChange={(e) => updateTeamDescription(teamNum - 1, e.target.value)}
                                                placeholder="Role description" className={`mt-2 w-full px-2 py-1 rounded text-sm border ${theme.input} focus:outline-none focus:ring-1 focus:ring-emerald-500`} />
                                        ) : (
                                            <p className={`text-sm ${theme.textAccent} mt-1`}>{teamInfo.description || '—'}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {teamPlayers.length === 0 ? (
                                            <p className={`text-sm ${theme.textMuted} text-center py-6`}>No players</p>
                                        ) : (
                                            teamPlayers.map((player) => (
                                                <div key={player.id} className={`rounded-lg p-3 ${darkMode ? 'bg-zinc-800/50' : 'bg-gray-50'}`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            {player.tags.includes('Confirmed') && (
                                                                <span className="w-2 h-2 rounded-full bg-green-500" title="Confirmed" />
                                                            )}
                                                            <span className="font-medium text-sm">{player.name}</span>
                                                            {(player.power || powerByName[player.name]) && (
                                                                <span className={`text-xs ${theme.textMuted}`}>
                                                                    {formatPower(player.power || powerByName[player.name])}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isEditor && (
                                                            <div className="flex items-center gap-2">
                                                                <select value={player.team} onChange={(e) => movePlayer(player.id, Number(e.target.value))}
                                                                    className={`text-xs px-2 py-1 rounded border ${theme.input}`}>
                                                                    <option value={1}>Z1</option><option value={2}>Z2</option><option value={3}>Z3</option>
                                                                </select>
                                                                <button onClick={() => removePlayer(player.id)} className="text-red-500 hover:text-red-400 text-sm">✕</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {isEditor ? (
                                                            AVAILABLE_TAGS.map(tag => (
                                                                <button key={tag} onClick={() => togglePlayerTag(player.id, tag)}
                                                                    className={`px-2 py-0.5 rounded text-xs transition-colors ${player.tags.includes(tag) ? TAG_COLORS[tag] : theme.tag}`}>
                                                                    {tag}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            player.tags.filter(tag => tag !== 'Confirmed').length > 0 ? player.tags.filter(tag => tag !== 'Confirmed').map(tag => (
                                                                <span key={tag} className={`px-2 py-0.5 rounded text-xs ${TAG_COLORS[tag]}`}>{tag}</span>
                                                            )) : <span className={`text-xs ${theme.textMuted}`}>No tags</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </section>
                            );
                        })}
                    </div>

                    {/* Substitutes Section */}
                    <section className={`${theme.card} border rounded-xl p-4 mt-6`}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className={`text-sm font-semibold uppercase tracking-wider ${theme.textMuted}`}>Substitutes</h2>
                            <span className={`text-xs ${theme.textMuted}`}>{substitutes.length} players</span>
                        </div>
                        {isEditor && (
                            <div className="flex gap-2 mb-4">
                                <input 
                                    type="text" 
                                    placeholder="Add substitute name..."
                                    className={`flex-1 px-3 py-2 rounded-lg border ${theme.input} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            const input = e.target as HTMLInputElement;
                                            if (input.value.trim()) {
                                                const newSub: Player = { id: Date.now(), name: input.value.trim(), team: 0, tags: [], power: 0, assignments: { phase1: "", phase2: "", phase3: "", phase4: "" } };
                                                const updatedSubs = [...substitutes, newSub];
                                                setSubstitutes(updatedSubs);
                                                saveData({ substitutes: updatedSubs });
                                                input.value = '';
                                            }
                                        }
                                    }}
                                />
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {substitutes.length === 0 ? (
                                <p className={`text-sm ${theme.textMuted}`}>No substitutes added</p>
                            ) : (
                                substitutes.map(sub => (
                                    <div key={sub.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                                        <span className="text-sm">{sub.name}</span>
                                        {isEditor && (
                                            <button 
                                                onClick={() => {
                                                    const updatedSubs = substitutes.filter(s => s.id !== sub.id);
                                                    setSubstitutes(updatedSubs);
                                                    saveData({ substitutes: updatedSubs });
                                                }}
                                                className="text-red-500 hover:text-red-400 text-xs"
                                            >✕</button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <footer className={`mt-8 pt-4 border-t ${theme.border} text-center`}>
                        <p className={`text-xs ${theme.textMuted}`}>Angmar • Rise of Kingdoms</p>
                        <p className={`text-[10px] ${theme.textMuted} mt-1 opacity-50`}>🥙 Kebab (BBQ) provides the snacks • Moon provides unsolicited advice</p>
                    </footer>
                </div>
            )}

            {/* Lookup Tab */}
            {activeTab === 'lookup' && (
                <div className="max-w-3xl mx-auto p-4 md:p-6">
                    {/* Key Instructions */}
                    <section className={`${theme.card} border-4 border-emerald-500 rounded-xl p-6 mb-6`}>
                        <h2 className={`text-xl font-bold text-center mb-4 text-emerald-500`}>⚔️ Battle Instructions</h2>

                        {/* Important Rules */}
                        <div className={`p-4 rounded-lg ${darkMode ? 'bg-emerald-900/30' : 'bg-emerald-50'} border-2 border-emerald-500 mb-4`}>
                            <h3 className="font-bold text-emerald-500 mb-3">📌 IMPORTANT</h3>
                            <ul className={`space-y-2 ${theme.text}`}>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-500 font-bold">•</span>
                                    <span><strong>Pay attention to your lane assignment.</strong></span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-500 font-bold">•</span>
                                    <span><strong>Everyone rush their obelisk first.</strong> Rally leaders TP first.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-500 font-bold">•</span>
                                    <span><strong>Move down the field ONLY after fully occupying and garrisoning a building.</strong></span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-500 font-bold">•</span>
                                    <span><strong>Only use rallies to overtake already occupied buildings.</strong></span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-500 font-bold">•</span>
                                    <span><strong>Work as a unit, not individual.</strong></span>
                                </li>
                            </ul>
                        </div>

                        {/* Troop Deployment */}
                        <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                            <h3 className={`font-bold ${theme.textMuted} mb-3`}>🎯 IF YOU CAN</h3>
                            <div className="grid grid-cols-3 gap-3 text-center text-sm">
                                <div className={`p-3 rounded-lg ${darkMode ? 'bg-red-900/30' : 'bg-red-50'} border border-red-500/50`}>
                                    <div className="text-2xl mb-1">🐴</div>
                                    <div className="font-bold text-red-500">Cavalry</div>
                                    <div className={`text-xs ${theme.textMuted}`}>For rallies</div>
                                </div>
                                <div className={`p-3 rounded-lg ${darkMode ? 'bg-blue-900/30' : 'bg-blue-50'} border border-blue-500/50`}>
                                    <div className="text-2xl mb-1">🛡️</div>
                                    <div className="font-bold text-blue-500">Infantry</div>
                                    <div className={`text-xs ${theme.textMuted}`}>To garrison</div>
                                </div>
                                <div className={`p-3 rounded-lg ${darkMode ? 'bg-yellow-900/30' : 'bg-yellow-50'} border border-yellow-500/50`}>
                                    <div className="text-2xl mb-1">🌾</div>
                                    <div className="font-bold text-yellow-600">Else</div>
                                    <div className={`text-xs ${theme.textMuted}`}>Gather tiles</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Player Lookup */}
                    <section className={`${theme.card} border rounded-xl p-6`}>
                        <h2 className={`text-xl font-semibold mb-4 text-center`}>🔍 Find Your Role</h2>
                        <p className={`text-sm ${theme.textMuted} text-center mb-6`}>Enter your in-game name to see your assignments for each phase</p>
                        
                        <input 
                            type="text" 
                            value={lookupSearch}
                            onChange={(e) => setLookupSearch(e.target.value)}
                            placeholder="Enter your name..."
                            className={`w-full px-4 py-3 rounded-lg border ${theme.input} focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg text-center`}
                        />

                        {lookupSearch.trim() && (() => {
                            const searchLower = lookupSearch.toLowerCase().trim();
                            const foundPlayer = players.find(p => p.name.toLowerCase().includes(searchLower));
                            const foundSub = substitutes.find(s => s.name.toLowerCase().includes(searchLower));
                            
                            if (foundPlayer) {
                                const teamInfo = teams[foundPlayer.team - 1];
                                const playerPower = foundPlayer.power || powerByName[foundPlayer.name];
                                const zoneColors: Record<number, string> = {
                                    1: 'text-blue-500',
                                    2: 'text-orange-500',
                                    3: 'text-purple-500'
                                };
                                const zoneBgColors: Record<number, string> = {
                                    1: darkMode ? 'bg-blue-900/30 border-blue-500/50' : 'bg-blue-100 border-blue-300',
                                    2: darkMode ? 'bg-orange-900/30 border-orange-500/50' : 'bg-orange-100 border-orange-300',
                                    3: darkMode ? 'bg-purple-900/30 border-purple-500/50' : 'bg-purple-100 border-purple-300'
                                };
                                return (
                                    <div className={`mt-6 p-6 rounded-xl ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                                        {/* Print Button */}
                                        <div className="flex justify-end mb-4">
                                            <button
                                                onClick={() => window.print()}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium ${theme.buttonPrimary} flex items-center gap-2`}
                                            >
                                                🖨️ Print Quick Reference
                                            </button>
                                        </div>

                                        {/* Player header */}
                                        <div className="text-center mb-6">
                                            <h3 className={`text-2xl md:text-3xl font-bold ${zoneColors[foundPlayer.team]}`}>{foundPlayer.name}</h3>
                                            {playerPower && (
                                                <p className={`text-sm ${theme.textMuted}`}>⚔️ {formatPower(playerPower)} Power</p>
                                            )}
                                            <p className={`text-lg md:text-xl font-semibold mt-1 ${zoneColors[foundPlayer.team]}`}>
                                                {teamInfo?.name || `Zone ${foundPlayer.team}`}
                                                {teamInfo?.description && <span className={theme.textMuted}> • {teamInfo.description}</span>}
                                            </p>
                                        </div>
                                        
                                        {/* Role tags */}
                                        {foundPlayer.tags.length > 0 && (
                                            <div className="mb-6 text-center">
                                                <div className="flex flex-wrap gap-2 justify-center">
                                                    {foundPlayer.tags.map(tag => (
                                                        <span key={tag} className={`px-3 py-1.5 rounded-full text-sm font-medium ${TAG_COLORS[tag]}`}>{tag}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Phase-by-phase assignments - ENHANCED */}
                                        {foundPlayer.assignments && (
                                            <div className={`p-6 rounded-xl border-4 ${zoneBgColors[foundPlayer.team]} mb-6`}>
                                                <h4 className={`text-lg font-bold uppercase tracking-wider mb-6 text-center ${zoneColors[foundPlayer.team]}`}>
                                                    📋 YOUR BATTLE PLAN
                                                </h4>
                                                <div className="grid gap-4">
                                                    <div className={`p-4 rounded-xl ${darkMode ? 'bg-zinc-900' : 'bg-white'} border-4 border-yellow-500 shadow-lg`}>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-3xl">🏃</span>
                                                                <div>
                                                                    <div className="text-yellow-500 font-bold text-lg">PHASE 1</div>
                                                                    <div className={`text-xs ${theme.textMuted}`}>RUSH • 0:00</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <p className={`font-semibold text-base ${theme.text}`}>{foundPlayer.assignments.phase1}</p>
                                                    </div>
                                                    <div className={`p-4 rounded-xl ${darkMode ? 'bg-zinc-900' : 'bg-white'} border-4 border-yellow-600 shadow-lg`}>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-3xl">📍</span>
                                                                <div>
                                                                    <div className="text-yellow-600 font-bold text-lg">PHASE 2</div>
                                                                    <div className={`text-xs ${theme.textMuted}`}>SECURE • ~5:00</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <p className={`font-semibold text-base ${theme.text}`}>{foundPlayer.assignments.phase2}</p>
                                                    </div>
                                                    <div className={`p-4 rounded-xl ${darkMode ? 'bg-zinc-900' : 'bg-white'} border-4 border-orange-500 shadow-lg`}>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-3xl">⚔️</span>
                                                                <div>
                                                                    <div className="text-orange-500 font-bold text-lg">PHASE 3</div>
                                                                    <div className={`text-xs ${theme.textMuted}`}>EXPAND • ~15:00</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <p className={`font-semibold text-base ${theme.text}`}>{foundPlayer.assignments.phase3}</p>
                                                    </div>
                                                    <div className={`p-4 rounded-xl ${darkMode ? 'bg-zinc-900' : 'bg-white'} border-4 border-red-500 shadow-lg`}>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-3xl">💥</span>
                                                                <div>
                                                                    <div className="text-red-500 font-bold text-lg">PHASE 4</div>
                                                                    <div className={`text-xs ${theme.textMuted}`}>CONTEST • ~45:00</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <p className={`font-semibold text-base ${theme.text}`}>{foundPlayer.assignments.phase4}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Mini Map showing assigned buildings */}
                                        <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}>
                                            <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${theme.textMuted}`}>🗺️ Your Buildings</h4>
                                            <div className="relative w-full rounded-lg overflow-hidden" style={{ aspectRatio: '1275 / 891' }}>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src="/aoo-strategy/aoo-map.jpg"
                                                    alt="AOO Map"
                                                    className="absolute inset-0 w-full h-full object-cover"
                                                    style={{ opacity: darkMode ? 0.6 : 0.8 }}
                                                />
                                                {/* Highlight assigned buildings */}
                                                {foundPlayer.assignments && (() => {
                                                    const buildingPositions: Record<string, {x: number, y: number, name: string}> = {
                                                        'obelisk (upper)': {x: 50, y: 12, name: 'Obelisk (Upper)'},
                                                        'obelisk (left)': {x: 10, y: 40, name: 'Obelisk (Left)'},
                                                        'obelisk (right)': {x: 90, y: 40, name: 'Obelisk (Right)'},
                                                        'obelisk (lower)': {x: 42, y: 78, name: 'Obelisk (Lower)'},
                                                        'outpost of iset 1': {x: 35, y: 15, name: 'Iset 1'},
                                                        'outpost of iset 2': {x: 15, y: 24, name: 'Iset 2'},
                                                        'outpost of iset 3': {x: 35, y: 28, name: 'Iset 3'},
                                                        'outpost of seth 1': {x: 65, y: 60, name: 'Seth 1'},
                                                        'outpost of seth 2': {x: 85, y: 60, name: 'Seth 2'},
                                                        'outpost of seth 3': {x: 65, y: 73, name: 'Seth 3'},
                                                        'shrine of war (left)': {x: 28, y: 46, name: 'War-L'},
                                                        'shrine of war (right)': {x: 72, y: 38, name: 'War-R'},
                                                        'shrine of life (right)': {x: 72, y: 18, name: 'Life-R'},
                                                        'shrine of life (left)': {x: 22, y: 73, name: 'Life-L'},
                                                        'desert altar (right)': {x: 55, y: 28, name: 'Des-R'},
                                                        'desert altar (left)': {x: 42, y: 60, name: 'Des-L'},
                                                        'sky altar (right)': {x: 88, y: 25, name: 'Sky-R'},
                                                        'sky altar (left)': {x: 10, y: 58, name: 'Sky-L'},
                                                        'ark': {x: 48, y: 43, name: 'Ark'},
                                                    };
                                                    
                                                    const allAssignments = Object.values(foundPlayer.assignments).join(' ').toLowerCase();
                                                    const assignedBuildings = Object.entries(buildingPositions).filter(([key]) => 
                                                        allAssignments.includes(key)
                                                    );
                                                    
                                                    const zoneMarkerColors: Record<number, string> = {
                                                        1: '#2563EB',
                                                        2: '#D97706', 
                                                        3: '#7C3AED'
                                                    };
                                                    
                                                    return assignedBuildings.map(([key, pos]) => (
                                                        <div
                                                            key={key}
                                                            className="absolute flex flex-col items-center"
                                                            style={{
                                                                left: `${pos.x}%`,
                                                                top: `${pos.y}%`,
                                                                transform: 'translate(-50%, -50%)',
                                                            }}
                                                        >
                                                            <div 
                                                                className="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse"
                                                                style={{ backgroundColor: zoneMarkerColors[foundPlayer.team] }}
                                                            >
                                                                <span className="text-white text-[8px] font-bold">★</span>
                                                            </div>
                                                            <span className="text-[8px] font-bold text-white bg-black/70 px-1 rounded mt-0.5">{pos.name}</span>
                                                        </div>
                                                    ));
                                                })()}
                                                {/* START marker */}
                                                <div
                                                    className="absolute px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[8px] font-bold"
                                                    style={{ left: '12%', top: '6%', transform: 'translate(-50%, -50%)' }}
                                                >
                                                    START
                                                </div>
                                            </div>
                                            <p className={`text-xs ${theme.textMuted} mt-2 text-center`}>
                                                ★ = Your assigned buildings across all phases
                                            </p>
                                        </div>

                                        {/* Role instructions */}
                                        <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}>
                                            <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${theme.textMuted}`}>💡 Role Tips</h4>
                                            <ul className={`space-y-2 text-sm ${theme.text}`}>
                                                {foundPlayer.tags.includes('Rally Leader') && (
                                                    <li>🎯 <strong>Rally Leader:</strong> Use strongest commanders (Guan Yu, Martel, YSG). Start rallies early!</li>
                                                )}
                                                {foundPlayer.tags.includes('Teleport 1st') && (
                                                    <li>⚡ <strong>Teleport 1st:</strong> You are Fluffy, Sysstm, or Suntzu. Teleport IMMEDIATELY!</li>
                                                )}
                                                {foundPlayer.tags.includes('Hold Obelisks') && (
                                                    <li>🏰 <strong>Hold Obelisks:</strong> Send 1 troop to EACH Obelisk 3&4. Once first wave TPs, join rallies!</li>
                                                )}
                                                {foundPlayer.tags.includes('Garrison') && (
                                                    <li>🛡️ <strong>Garrison:</strong> Use infantry commanders. Stay in buildings to defend!</li>
                                                )}
                                                {foundPlayer.tags.includes('Farm') && (
                                                    <>
                                                        <li>🌾 <strong>Farm:</strong> Gather constantly from start to finish!</li>
                                                        <li>📍 <strong>Where:</strong> Start near your zone&apos;s obelisk, move to resource nodes near captured buildings</li>
                                                        <li>💰 <strong>Points:</strong> Can earn 13,000+ points - almost as much as 4 Ark captures!</li>
                                                        <li>⚠️ <strong>Safety:</strong> Stay in friendly territory, avoid enemy marches</li>
                                                    </>
                                                )}
                                                {foundPlayer.tags.includes('Conquer') && (
                                                    <li>🏃 <strong>Conquer:</strong> Use T1 cavalry for speed. Capture undefended buildings fast!</li>
                                                )}
                                            </ul>
                                        </div>

                                        {/* March Deployment Guide */}
                                        <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}>
                                            <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${theme.textMuted}`}>🎖️ March Deployment</h4>
                                            <div className={`space-y-3 text-sm ${theme.text}`}>
                                                <div className={`p-2 rounded ${darkMode ? 'bg-zinc-800' : 'bg-gray-50'}`}>
                                                    <p className="font-medium mb-1">Recommended: 3 Marches</p>
                                                    <ul className={`text-xs ${theme.textMuted} space-y-1`}>
                                                        <li>• <strong>March 1:</strong> In a building (garrison/obelisk)</li>
                                                        <li>• <strong>March 2:</strong> In another building or rally</li>
                                                        <li>• <strong>March 3:</strong> Mobile - support rallies or Ark</li>
                                                    </ul>
                                                </div>
                                                {foundPlayer.tags.includes('Rally Leader') && (
                                                    <div className={`p-2 rounded border-l-2 border-red-500 ${darkMode ? 'bg-red-900/20' : 'bg-red-50'}`}>
                                                        <p className="font-medium text-red-500">Rally Leader Marches:</p>
                                                        <ul className={`text-xs ${theme.textMuted}`}>
                                                            <li>• Lead rally with your strongest march</li>
                                                            <li>• Keep 1-2 marches for garrison backup</li>
                                                        </ul>
                                                    </div>
                                                )}
                                                {foundPlayer.tags.includes('Garrison') && (
                                                    <div className={`p-2 rounded border-l-2 border-orange-500 ${darkMode ? 'bg-orange-900/20' : 'bg-orange-50'}`}>
                                                        <p className="font-medium text-orange-500">Garrison Marches:</p>
                                                        <ul className={`text-xs ${theme.textMuted}`}>
                                                            <li>• Keep marches IN buildings at all times</li>
                                                            <li>• Use infantry for better defense</li>
                                                            <li>• Switch buildings as we capture more</li>
                                                        </ul>
                                                    </div>
                                                )}
                                                {foundPlayer.tags.includes('Conquer') && (
                                                    <div className={`p-2 rounded border-l-2 border-purple-500 ${darkMode ? 'bg-purple-900/20' : 'bg-purple-50'}`}>
                                                        <p className="font-medium text-purple-500">Conquer Marches:</p>
                                                        <ul className={`text-xs ${theme.textMuted}`}>
                                                            <li>• March 1: T1 cavalry (fastest) for captures</li>
                                                            <li>• March 2-3: Support or fill rallies</li>
                                                        </ul>
                                                    </div>
                                                )}
                                                {foundPlayer.tags.includes('Farm') && (
                                                    <div className={`p-2 rounded border-l-2 border-yellow-500 ${darkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
                                                        <p className="font-medium text-yellow-600">Farmer Marches:</p>
                                                        <ul className={`text-xs ${theme.textMuted}`}>
                                                            <li>• All 5 marches gathering resources</li>
                                                            <li>• Spread across multiple nodes</li>
                                                            <li>• Don&apos;t return home - go node to node</li>
                                                        </ul>
                                                    </div>
                                                )}
                                                {foundPlayer.tags.includes('Teleport 1st') && (
                                                    <div className={`p-2 rounded border-l-2 border-blue-500 ${darkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                                                        <p className="font-medium text-blue-500">Teleport Marches:</p>
                                                        <ul className={`text-xs ${theme.textMuted}`}>
                                                            <li>• Before teleport: All troops in city OR in buildings</li>
                                                            <li>• After teleport: Rally altars &amp; fill rallies</li>
                                                        </ul>
                                                    </div>
                                                )}
                                                {foundPlayer.tags.includes('Hold Obelisks') && (
                                                    <div className={`p-2 rounded border-l-2 border-cyan-500 ${darkMode ? 'bg-cyan-900/20' : 'bg-cyan-50'}`}>
                                                        <p className="font-medium text-cyan-600">Hold Strategy:</p>
                                                        <ul className={`text-xs ${theme.textMuted}`}>
                                                            <li>• Send 1 troop (any type) to Obelisk 3</li>
                                                            <li>• Send 1 troop (any type) to Obelisk 4</li>
                                                            <li>• Once Fluffy/Sysstm/Suntzu TP, join rallies!</li>
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            } else if (foundSub) {
                                const subPower = foundSub.power || powerByName[foundSub.name];
                                return (
                                    <div className={`mt-6 p-6 rounded-xl ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'} text-center`}>
                                        <h3 className="text-2xl font-bold text-yellow-500">{foundSub.name}</h3>
                                        {subPower && (
                                            <p className={`text-sm ${theme.textMuted}`}>⚔️ {formatPower(subPower)} Power</p>
                                        )}
                                        <p className={`text-lg ${theme.textMuted} mt-2`}>📋 Substitute</p>
                                        <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-zinc-900' : 'bg-white'}`}>
                                            <p className={theme.text}>You are on the substitute list.</p>
                                            <p className={`mt-2 text-sm ${theme.textMuted}`}>Be ready to join if a spot opens up! Make sure you:</p>
                                            <ul className={`mt-2 text-sm ${theme.textMuted} text-left max-w-xs mx-auto`}>
                                                <li>• Clear your hospital before battle</li>
                                                <li>• Have troops ready in your city</li>
                                                <li>• Stay available on Discord</li>
                                            </ul>
                                        </div>
                                    </div>
                                );
                            } else {
                                return (
                                    <div className={`mt-6 p-6 rounded-xl ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'} text-center`}>
                                        <p className={`text-lg ${theme.textMuted}`}>❌ Player not found</p>
                                        <p className={`mt-2 text-sm ${theme.textMuted}`}>Try checking the Zone Roster tab or contact your alliance leader.</p>
                                    </div>
                                );
                            }
                        })()}
                    </section>

                    <footer className={`mt-8 pt-4 border-t ${theme.border} text-center`}>
                        <p className={`text-xs ${theme.textMuted}`}>Angmar • Rise of Kingdoms</p>
                        <p className={`text-[10px] ${theme.textMuted} mt-1 opacity-50`}>🐰 Led by Fluffy • Suntzu is charming the enemy (again)</p>
                    </footer>
                </div>
            )}

            {/* Quick Reference Guide Tab */}
            {activeTab === 'quickref' && (
                <div className="max-w-5xl mx-auto p-4 md:p-6">
                    <h1 className="text-3xl font-bold text-center mb-2">⚡ Quick Battle Guide</h1>
                    <p className={`text-center ${theme.textMuted} mb-6`}>Simplified strategy for all players</p>

                    {/* Core Instructions - Same as main page */}
                    <section className={`${theme.card} border-4 border-emerald-500 rounded-xl p-6 mb-6`}>
                        <h2 className="text-xl font-bold text-center mb-4 text-emerald-500">📌 IMPORTANT</h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <ul className={`space-y-3 ${theme.text}`}>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-500 font-bold text-lg">1.</span>
                                        <span><strong>Pay attention to your lane assignment.</strong></span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-500 font-bold text-lg">2.</span>
                                        <span><strong>Everyone rush their obelisk first.</strong> Rally leaders TP first.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-500 font-bold text-lg">3.</span>
                                        <span><strong>Move down the field ONLY after fully occupying and garrisoning.</strong></span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-500 font-bold text-lg">4.</span>
                                        <span><strong>Only use rallies to overtake occupied buildings.</strong></span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-500 font-bold text-lg">5.</span>
                                        <span><strong>Work as a unit, not individual.</strong></span>
                                    </li>
                                </ul>
                            </div>
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                                <h3 className={`font-bold ${theme.textMuted} mb-3`}>🎯 TROOP DEPLOYMENT</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🐴</span>
                                        <div>
                                            <div className="font-bold text-red-500">Cavalry</div>
                                            <div className={`text-sm ${theme.textMuted}`}>For rallies</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🛡️</span>
                                        <div>
                                            <div className="font-bold text-blue-500">Infantry</div>
                                            <div className={`text-sm ${theme.textMuted}`}>To garrison buildings</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🌾</span>
                                        <div>
                                            <div className="font-bold text-yellow-600">Everything Else</div>
                                            <div className={`text-sm ${theme.textMuted}`}>Gather resource tiles</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Zone Assignment Overview */}
                    <section className={`${theme.card} border rounded-xl p-6 mb-6`}>
                        <h2 className="text-xl font-bold text-center mb-4">👑 Zone Leaders</h2>
                        <div className="grid md:grid-cols-3 gap-4">
                            {/* Zone 1 */}
                            <div className={`p-4 rounded-xl border-4 ${darkMode ? 'bg-blue-900/20 border-blue-500' : 'bg-blue-50 border-blue-400'}`}>
                                <div className="text-center">
                                    <div className="text-3xl mb-1">🔵</div>
                                    <h3 className="text-xl font-bold text-blue-500">ZONE 1</h3>
                                    <p className={`text-sm ${theme.textMuted} mb-2`}>Left Side → Push Down</p>
                                    <div className={`p-2 rounded-lg ${darkMode ? 'bg-blue-800/50' : 'bg-blue-200'}`}>
                                        <div className="font-bold text-blue-300">👑 FnDuke</div>
                                    </div>
                                    <div className={`text-xs ${theme.textMuted} mt-2`}>
                                        Rush: Obelisk Left<br />
                                        Then: War-L, Sky-L
                                    </div>
                                </div>
                            </div>

                            {/* Zone 2 */}
                            <div className={`p-4 rounded-xl border-4 ${darkMode ? 'bg-orange-900/20 border-orange-500' : 'bg-orange-50 border-orange-400'}`}>
                                <div className="text-center">
                                    <div className="text-3xl mb-1">🟠</div>
                                    <h3 className="text-xl font-bold text-orange-500">ZONE 2</h3>
                                    <p className={`text-sm ${theme.textMuted} mb-2`}>Center / Flex Support</p>
                                    <div className={`p-2 rounded-lg ${darkMode ? 'bg-orange-800/50' : 'bg-orange-200'}`}>
                                        <div className="font-bold text-orange-300">👑 Sysstm & Fluffy</div>
                                    </div>
                                    <div className={`text-xs ${theme.textMuted} mt-2`}>
                                        Rush: Iset-1 + Iset-2 (split)<br />
                                        Then: Iset-3, Ark
                                    </div>
                                </div>
                            </div>

                            {/* Zone 3 */}
                            <div className={`p-4 rounded-xl border-4 ${darkMode ? 'bg-purple-900/20 border-purple-500' : 'bg-purple-50 border-purple-400'}`}>
                                <div className="text-center">
                                    <div className="text-3xl mb-1">🟣</div>
                                    <h3 className="text-xl font-bold text-purple-500">ZONE 3</h3>
                                    <p className={`text-sm ${theme.textMuted} mb-2`}>Upper Side → Push Down</p>
                                    <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-800/50' : 'bg-purple-200'}`}>
                                        <div className="font-bold text-purple-300">👑 Suntzu</div>
                                    </div>
                                    <div className={`text-xs ${theme.textMuted} mt-2`}>
                                        Rush: Obelisk Upper<br />
                                        Then: Life-R, Desert-1
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Simplified Battle Flow */}
                    <section className={`${theme.card} border rounded-xl p-6 mb-6`}>
                        <h2 className="text-xl font-bold text-center mb-4">📅 Battle Flow</h2>
                        <div className="space-y-4">
                            {/* Rush */}
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-yellow-900/30' : 'bg-yellow-50'} border-l-4 border-yellow-500`}>
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🏃</span>
                                    <div>
                                        <div className="font-bold text-yellow-500 text-lg">START → RUSH OBELISK</div>
                                        <div className={`text-sm ${theme.text}`}>Everyone sprint to your zone&apos;s obelisk. Rally leaders TP when available.</div>
                                    </div>
                                </div>
                            </div>

                            {/* Garrison */}
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-green-900/30' : 'bg-green-50'} border-l-4 border-green-500`}>
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🛡️</span>
                                    <div>
                                        <div className="font-bold text-green-500 text-lg">CAPTURE → GARRISON</div>
                                        <div className={`text-sm ${theme.text}`}>Infantry stays in building. Don&apos;t move until fully garrisoned!</div>
                                    </div>
                                </div>
                            </div>

                            {/* Push */}
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-orange-900/30' : 'bg-orange-50'} border-l-4 border-orange-500`}>
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">⚔️</span>
                                    <div>
                                        <div className="font-bold text-orange-500 text-lg">SECURE → PUSH DOWN</div>
                                        <div className={`text-sm ${theme.text}`}>Move to next building. Only rally if enemy is garrisoned there.</div>
                                    </div>
                                </div>
                            </div>

                            {/* Farm */}
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'} border-l-4 border-gray-500`}>
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🌾</span>
                                    <div>
                                        <div className={`font-bold ${theme.textMuted} text-lg`}>EXTRA TROOPS → GATHER</div>
                                        <div className={`text-sm ${theme.text}`}>Send remaining marches to gather tiles for points.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Quick Role Reference */}
                    <section className={`${theme.card} border rounded-xl p-6 mb-6`}>
                        <h2 className="text-xl font-bold text-center mb-4">🎭 Role Quick Reference</h2>
                        <div className="grid md:grid-cols-3 gap-4">
                            {/* Rally Leader */}
                            <div className={`p-4 rounded-xl ${darkMode ? 'bg-red-900/30 border-2 border-red-500' : 'bg-red-50 border-2 border-red-400'}`}>
                                <div className="text-2xl mb-1">🎯</div>
                                <h3 className="font-bold text-red-500 mb-2">Rally Leader</h3>
                                <ul className={`text-sm ${theme.text} space-y-1`}>
                                    <li>• Lead rallies on occupied buildings</li>
                                    <li>• Use cavalry commanders</li>
                                    <li>• TP first when available</li>
                                </ul>
                            </div>

                            {/* Garrison */}
                            <div className={`p-4 rounded-xl ${darkMode ? 'bg-blue-900/30 border-2 border-blue-500' : 'bg-blue-50 border-2 border-blue-400'}`}>
                                <div className="text-2xl mb-1">🛡️</div>
                                <h3 className="font-bold text-blue-500 mb-2">Garrison</h3>
                                <ul className={`text-sm ${theme.text} space-y-1`}>
                                    <li>• Stay IN buildings</li>
                                    <li>• Use infantry commanders</li>
                                    <li>• Defend at all costs</li>
                                </ul>
                            </div>

                            {/* Farm */}
                            <div className={`p-4 rounded-xl ${darkMode ? 'bg-yellow-900/30 border-2 border-yellow-500' : 'bg-yellow-50 border-2 border-yellow-400'}`}>
                                <div className="text-2xl mb-1">🌾</div>
                                <h3 className="font-bold text-yellow-600 mb-2">Farm</h3>
                                <ul className={`text-sm ${theme.text} space-y-1`}>
                                    <li>✓ Support rallies FIRST</li>
                                    <li>✓ Then gather with remaining marches</li>
                                    <li>✓ Stay in safe territory</li>
                                    <li>✓ Can earn 13,000+ points!</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* In-Game Chat Messages - COPY/PASTE READY */}
                    <section className={`${theme.card} border-4 border-emerald-500 rounded-xl p-6 mb-6`}>
                        <h2 className="text-2xl font-bold text-center mb-2">💬 Copy for In-Game Chat</h2>
                        <p className={`text-center ${theme.textMuted} mb-6 text-sm`}>Click any message to copy it</p>

                        <div className="space-y-4 max-w-3xl mx-auto">
                            {/* Pre-Battle Message */}
                            <div>
                                <div className={`text-sm font-semibold mb-2 ${theme.text}`}>📋 BEFORE BATTLE (send 30 mins before):</div>
                                <div
                                    onClick={(e) => {
                                        const text = e.currentTarget.textContent || '';
                                        navigator.clipboard.writeText(text);
                                        alert('Copied to clipboard!');
                                    }}
                                    className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-gray-100 hover:bg-gray-200'} cursor-pointer border-2 border-emerald-500/30 transition-colors`}
                                >
                                    <div className={`font-mono text-sm ${theme.text} whitespace-pre-line`}>
{`⚔️ AOO IN 30 MIN ⚔️
✓ Clear hospital
✓ Check your zone: rok-suite.vercel.app/aoo-strategy
Z1 (Blue) • Z2 (Orange) • Z3 (Purple)`}
                                    </div>
                                </div>
                            </div>

                            {/* Strategy Reminder */}
                            <div>
                                <div className={`text-sm font-semibold mb-2 ${theme.text}`}>🎯 STRATEGY (send at start):</div>
                                <div
                                    onClick={(e) => {
                                        const text = e.currentTarget.textContent || '';
                                        navigator.clipboard.writeText(text);
                                        alert('Copied to clipboard!');
                                    }}
                                    className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-gray-100 hover:bg-gray-200'} cursor-pointer border-2 border-emerald-500/30 transition-colors`}
                                >
                                    <div className={`font-mono text-sm ${theme.text} whitespace-pre-line`}>
{`📌 IMPORTANT:
1. Stay in your lane
2. Rush obelisk first - leaders TP first
3. Garrison BEFORE moving on
4. Only rally OCCUPIED buildings
5. Work as a unit!

🐴 Cav = rallies | 🛡️ Inf = garrison | 🌾 Else = gather`}
                                    </div>
                                </div>
                            </div>

                            {/* Zone Assignments */}
                            <div>
                                <div className={`text-sm font-semibold mb-2 ${theme.text}`}>🏃 ZONE TARGETS:</div>
                                <div
                                    onClick={(e) => {
                                        const text = e.currentTarget.textContent || '';
                                        navigator.clipboard.writeText(text);
                                        alert('Copied to clipboard!');
                                    }}
                                    className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-gray-100 hover:bg-gray-200'} cursor-pointer border-2 border-yellow-500/50 transition-colors`}
                                >
                                    <div className={`font-mono text-sm ${theme.text} whitespace-pre-line`}>
{`🔵 Z1 → Obelisk LEFT → War-L, Sky-L
🟠 Z2 → Iset-1 + Iset-2 → Iset-3, Ark
🟣 Z3 → Obelisk UPPER → Life-R, Desert-1

Garrison each building before moving!`}
                                    </div>
                                </div>
                            </div>

                            {/* Emergency Reminder */}
                            <div>
                                <div className={`text-sm font-semibold mb-2 ${theme.text}`}>⚠️ DURING BATTLE (as needed):</div>
                                <div
                                    onClick={(e) => {
                                        const text = e.currentTarget.textContent || '';
                                        navigator.clipboard.writeText(text);
                                        alert('Copied to clipboard!');
                                    }}
                                    className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-gray-100 hover:bg-gray-200'} cursor-pointer border-2 border-red-500/50 transition-colors`}
                                >
                                    <div className={`font-mono text-sm ${theme.text} whitespace-pre-line`}>
{`🚨 FILL RALLIES NOW!
⚔️ Rally on [building name]
Need ALL zones to support!`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Pre-Battle Checklist */}
                    <section className={`${theme.card} border rounded-xl p-6`}>
                        <h2 className="text-2xl font-bold text-center mb-6">✅ Pre-Battle Checklist</h2>
                        <ul className={`space-y-2 ${theme.text} max-w-2xl mx-auto`}>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-500 font-bold">✓</span>
                                <span>Clear your hospital completely</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-500 font-bold">✓</span>
                                <span>Know your zone assignment</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-500 font-bold">✓</span>
                                <span>Know your role (Rally/Teleport/Garrison/Conquer/Farm)</span>
                            </li>
                        </ul>
                    </section>

                    <footer className={`mt-8 pt-4 border-t ${theme.border} text-center`}>
                        <p className={`text-xs ${theme.textMuted}`}>Angmar • Rise of Kingdoms</p>
                        <p className={`text-[10px] ${theme.textMuted} mt-1 opacity-50`}>🐇 Hop to it! • Don Juan sends his regards</p>
                    </footer>
                </div>
            )}

            {/* Schedule Tab - Training Time Polls */}
            {activeTab === 'schedule' && (
                <div className="max-w-3xl mx-auto p-4 md:p-6">
                    <h1 className="text-3xl font-bold text-center mb-2">📅 Training Schedule</h1>
                    <p className={`text-center ${theme.textMuted} mb-8`}>Vote for training times that work for you</p>

                    <TrainingPolls />

                    <footer className={`mt-8 pt-4 border-t ${theme.border} text-center`}>
                        <p className={`text-xs ${theme.textMuted}`}>Angmar • Rise of Kingdoms</p>
                        <p className={`text-[10px] ${theme.textMuted} mt-1 opacity-50`}>All times are in UTC</p>
                    </footer>
                </div>
            )}
        </div>
    );
}
