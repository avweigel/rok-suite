'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Player {
    id: number;
    name: string;
    team: number;
    tags: string[];
}

interface TeamInfo {
    name: string;
    description: string;
}

interface StrategyData {
    players: Player[];
    teams: TeamInfo[];
    mapImage: string | null;
    notes: string;
}

const DEFAULT_TEAMS: TeamInfo[] = [
    { name: 'Team 1', description: 'Ark' },
    { name: 'Team 2', description: 'Upper' },
    { name: 'Team 3', description: 'Lower' },
];

const AVAILABLE_TAGS = [
    'Rally Leader',
    'Tank',
    'Support',
    'Scout',
    'Flag Runner',
    'Garrison',
    'Reinforcer',
    'Crystal',
];

export default function AooStrategyPage() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [teams, setTeams] = useState<TeamInfo[]>(DEFAULT_TEAMS);
    const [mapImage, setMapImage] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isEditor, setIsEditor] = useState(false);
    const [editorPassword, setEditorPassword] = useState('');
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [strategyId, setStrategyId] = useState<number | null>(null);
    const [darkMode, setDarkMode] = useState(true);

    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerTeam, setNewPlayerTeam] = useState(1);
    const [newPlayerTags, setNewPlayerTags] = useState<string[]>([]);

    const EDITOR_PASSWORD = 'carn-dum';

    useEffect(() => {
        loadData();
        const savedTheme = localStorage.getItem('aoo-theme');
        if (savedTheme) setDarkMode(savedTheme === 'dark');
    }, []);

    const toggleTheme = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        localStorage.setItem('aoo-theme', newMode ? 'dark' : 'light');
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('aoo_strategy')
                .select('*')
                .limit(1)
                .maybeSingle();
            if (error) console.error('Error loading data:', error);
            if (data) {
                setStrategyId(data.id);
                const strategyData = data.data as StrategyData;
                setPlayers(strategyData?.players || []);
                setTeams(strategyData?.teams || DEFAULT_TEAMS);
                setMapImage(strategyData?.mapImage || null);
                setNotes(strategyData?.notes || '');
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
        };
        try {
            if (strategyId) {
                const { error } = await supabase.from('aoo_strategy').update({ data }).eq('id', strategyId);
                if (error) throw error;
            } else {
                const { data: newData, error } = await supabase.from('aoo_strategy').insert([{ data }]).select().single();
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

    const addPlayer = () => {
        if (!isEditor || !newPlayerName.trim()) return;
        const teamCount = players.filter(p => p.team === newPlayerTeam).length;
        if (teamCount >= 10) {
            alert(`Team ${newPlayerTeam} already has 10 players!`);
            return;
        }
        const newPlayer: Player = { id: Date.now(), name: newPlayerName.trim(), team: newPlayerTeam, tags: newPlayerTags };
        const updatedPlayers = [...players, newPlayer];
        setPlayers(updatedPlayers);
        saveData({ players: updatedPlayers });
        setNewPlayerName('');
        setNewPlayerTags([]);
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
        const teamCount = players.filter(p => p.team === newTeam && p.id !== playerId).length;
        if (teamCount >= 10) {
            alert(`Team ${newTeam} already has 10 players!`);
            return;
        }
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

    const getTeamPlayers = (teamNum: number) => players.filter(p => p.team === teamNum);

    // Theme classes
    const theme = {
        bg: darkMode ? 'bg-zinc-950' : 'bg-gray-50',
        card: darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200',
        cardHover: darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-50',
        text: darkMode ? 'text-zinc-100' : 'text-gray-900',
        textMuted: darkMode ? 'text-zinc-400' : 'text-gray-500',
        textAccent: darkMode ? 'text-emerald-400' : 'text-emerald-600',
        border: darkMode ? 'border-zinc-800' : 'border-gray-200',
        input: darkMode ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
        button: darkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900',
        buttonPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        tag: darkMode ? 'bg-zinc-800 text-zinc-300' : 'bg-gray-100 text-gray-700',
        tagActive: 'bg-emerald-600 text-white',
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
            <div className="max-w-7xl mx-auto p-4 md:p-6">
                {/* Header */}
                <header className={`flex items-center justify-between mb-6 pb-4 border-b ${theme.border}`}>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Ark of Osiris</h1>
                        <p className={`text-sm ${theme.textMuted}`}>30v30 Strategy Planner</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleTheme}
                            className={`p-2 rounded-lg ${theme.button} transition-colors`}
                            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {darkMode ? '☀️' : '🌙'}
                        </button>
                        {!isEditor ? (
                            <button
                                onClick={() => setShowPasswordPrompt(true)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium ${theme.button} transition-colors`}
                            >
                                Edit Mode
                            </button>
                        ) : (
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${theme.tagActive}`}>
                                Editing
                            </span>
                        )}
                    </div>
                </header>

                {/* Password Modal */}
                {showPasswordPrompt && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className={`${theme.card} border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl`}>
                            <h2 className="text-lg font-semibold mb-4">Enter Password</h2>
                            <input
                                type="password"
                                value={editorPassword}
                                onChange={(e) => setEditorPassword(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                                placeholder="Password"
                                className={`w-full px-3 py-2 rounded-lg border ${theme.input} mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button onClick={handlePasswordSubmit} className={`flex-1 py-2 rounded-lg font-medium ${theme.buttonPrimary}`}>
                                    Submit
                                </button>
                                <button onClick={() => setShowPasswordPrompt(false)} className={`flex-1 py-2 rounded-lg font-medium ${theme.button}`}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Map Section */}
                <section className={`${theme.card} border rounded-xl p-4 mb-6`}>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold uppercase tracking-wider ${theme.textMuted}">Battle Map</h2>
                        {isEditor && (
                            <label className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${theme.buttonPrimary}`}>
                                Upload
                                <input type="file" accept="image/*" onChange={handleMapUpload} className="hidden" />
                            </label>
                        )}
                    </div>
                    <div className={`rounded-lg overflow-hidden ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'} min-h-[200px] flex items-center justify-center`}>
                        {mapImage ? (
                            <img src={mapImage} alt="Strategy Map" className="max-w-full h-auto" />
                        ) : (
                            <span className={theme.textMuted}>No map uploaded</span>
                        )}
                    </div>
                </section>

                {/* Add Player Form */}
                {isEditor && (
                    <section className={`${theme.card} border rounded-xl p-4 mb-6`}>
                        <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${theme.textMuted}`}>Add Player</h2>
                        <div className="flex flex-wrap gap-3 items-end">
                            <div className="flex-1 min-w-[180px]">
                                <input
                                    type="text"
                                    value={newPlayerName}
                                    onChange={(e) => setNewPlayerName(e.target.value)}
                                    placeholder="Player name"
                                    className={`w-full px-3 py-2 rounded-lg border ${theme.input} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                                />
                            </div>
                            <div className="w-40">
                                <select
                                    value={newPlayerTeam}
                                    onChange={(e) => setNewPlayerTeam(Number(e.target.value))}
                                    className={`w-full px-3 py-2 rounded-lg border ${theme.input} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                                >
                                    <option value={1}>Team 1 ({getTeamPlayers(1).length}/10)</option>
                                    <option value={2}>Team 2 ({getTeamPlayers(2).length}/10)</option>
                                    <option value={3}>Team 3 ({getTeamPlayers(3).length}/10)</option>
                                </select>
                            </div>
                            <button onClick={addPlayer} className={`px-6 py-2 rounded-lg font-medium ${theme.buttonPrimary}`}>
                                Add
                            </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {AVAILABLE_TAGS.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setNewPlayerTags(newPlayerTags.includes(tag) ? newPlayerTags.filter(t => t !== tag) : [...newPlayerTags, tag])}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${newPlayerTags.includes(tag) ? theme.tagActive : theme.tag}`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* Teams Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {[1, 2, 3].map((teamNum) => {
                        const teamInfo = teams[teamNum - 1];
                        const teamPlayers = getTeamPlayers(teamNum);
                        return (
                            <section key={teamNum} className={`${theme.card} border rounded-xl p-4`}>
                                <div className={`mb-4 pb-3 border-b ${theme.border}`}>
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold">{teamInfo.name}</h3>
                                        <span className={`text-xs ${theme.textMuted}`}>{teamPlayers.length}/10</span>
                                    </div>
                                    {isEditor ? (
                                        <input
                                            type="text"
                                            value={teamInfo.description}
                                            onChange={(e) => updateTeamDescription(teamNum - 1, e.target.value)}
                                            placeholder="Role description"
                                            className={`mt-2 w-full px-2 py-1 rounded text-sm border ${theme.input} focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                                        />
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
                                                    <span className="font-medium text-sm">{player.name}</span>
                                                    {isEditor && (
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={player.team}
                                                                onChange={(e) => movePlayer(player.id, Number(e.target.value))}
                                                                className={`text-xs px-2 py-1 rounded border ${theme.input}`}
                                                            >
                                                                <option value={1}>T1</option>
                                                                <option value={2}>T2</option>
                                                                <option value={3}>T3</option>
                                                            </select>
                                                            <button onClick={() => removePlayer(player.id)} className="text-red-500 hover:text-red-400 text-sm">✕</button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {isEditor ? (
                                                        AVAILABLE_TAGS.map(tag => (
                                                            <button
                                                                key={tag}
                                                                onClick={() => togglePlayerTag(player.id, tag)}
                                                                className={`px-2 py-0.5 rounded text-xs transition-colors ${player.tags.includes(tag) ? theme.tagActive : theme.tag}`}
                                                            >
                                                                {tag}
                                                            </button>
                                                        ))
                                                    ) : (
                                                        player.tags.length > 0 ? (
                                                            player.tags.map(tag => (
                                                                <span key={tag} className={`px-2 py-0.5 rounded text-xs ${theme.tagActive}`}>{tag}</span>
                                                            ))
                                                        ) : (
                                                            <span className={`text-xs ${theme.textMuted}`}>No tags</span>
                                                        )
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

                {/* Strategy Notes */}
                <section className={`${theme.card} border rounded-xl p-4`}>
                    <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${theme.textMuted}`}>Strategy Notes</h2>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        onBlur={() => isEditor && saveData({ notes })}
                        placeholder={isEditor ? 'Add notes...' : 'No notes'}
                        disabled={!isEditor}
                        className={`w-full min-h-[120px] px-3 py-2 rounded-lg border ${theme.input} focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 resize-y`}
                    />
                </section>

                {/* Footer */}
                <footer className={`mt-8 pt-4 border-t ${theme.border} text-center`}>
                    <p className={`text-xs ${theme.textMuted}`}>Angmar Legion • Rise of Kingdoms</p>
                </footer>
            </div>
        </div>
    );
}