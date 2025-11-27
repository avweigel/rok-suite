'use client';

import { useState, useMemo } from 'react';
import { X, Search, Shield, Sword, Heart, Zap, Ban, Star } from 'lucide-react';
import { UserCommander, CommanderRole, CommanderRarity, TroopType } from '@/lib/sunset-canyon/commanders';

interface CommanderSelectorProps {
    commanders: UserCommander[];
    onSelect: (primary: UserCommander, secondary?: UserCommander) => void;
    onClose: () => void;
    usedCommanderIds: string[];
}

const roleIcons: Record<CommanderRole, typeof Shield> = {
    tank: Shield,
    nuker: Sword,
    healer: Heart,
    support: Zap,
    disabler: Ban,
};

const roleColors: Record<CommanderRole, string> = {
    tank: 'bg-blue-500/20 text-blue-400',
    nuker: 'bg-red-500/20 text-red-400',
    healer: 'bg-pink-500/20 text-pink-400',
    support: 'bg-green-500/20 text-green-400',
    disabler: 'bg-purple-500/20 text-purple-400',
};

export function CommanderSelector({
    commanders,
    onSelect,
    onClose,
    usedCommanderIds,
}: CommanderSelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPrimary, setSelectedPrimary] = useState<UserCommander | null>(null);
    const [selectedSecondary, setSelectedSecondary] = useState<UserCommander | null>(null);
    const [filterRarity, setFilterRarity] = useState<CommanderRarity | 'all'>('all');
    const [filterRole, setFilterRole] = useState<CommanderRole | 'all'>('all');
    const [filterTroop, setFilterTroop] = useState<TroopType | 'all'>('all');

    const availableCommanders = useMemo(() => {
        return commanders.filter((c) => {
            if (usedCommanderIds.includes(c.uniqueId)) return false;
            if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }
            if (filterRarity !== 'all' && c.rarity !== filterRarity) return false;
            if (filterRole !== 'all' && !c.role.includes(filterRole)) return false;
            if (filterTroop !== 'all' && c.troopType !== filterTroop) return false;
            return true;
        });
    }, [commanders, usedCommanderIds, searchQuery, filterRarity, filterRole, filterTroop]);

    const handleConfirm = () => {
        if (selectedPrimary) {
            onSelect(selectedPrimary, selectedSecondary || undefined);
        }
    };

    const renderCommanderCard = (commander: UserCommander, isPrimarySelection: boolean) => {
        const isSelected = isPrimarySelection
            ? selectedPrimary?.uniqueId === commander.uniqueId
            : selectedSecondary?.uniqueId === commander.uniqueId;
        const isUsedAsPrimary = selectedPrimary?.uniqueId === commander.uniqueId;
        const isDisabled = !isPrimarySelection && isUsedAsPrimary;

        return (
            <div
                key={commander.uniqueId}
                onClick={() => {
                    if (isDisabled) return;
                    if (isPrimarySelection) {
                        setSelectedPrimary(commander);
                        if (selectedSecondary?.uniqueId === commander.uniqueId) {
                            setSelectedSecondary(null);
                        }
                    } else {
                        setSelectedSecondary(isSelected ? null : commander);
                    }
                }}
                className={`
          relative p-3 rounded-lg cursor-pointer transition-all duration-200
          ${commander.rarity === 'legendary'
                        ? 'bg-gradient-to-br from-yellow-900/20 to-stone-800'
                        : 'bg-gradient-to-br from-purple-900/20 to-stone-800'}
          border ${isSelected
                        ? 'border-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.3)]'
                        : 'border-stone-700 hover:border-amber-600/50'}
          ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
        `}
            >
                {/* Rarity indicator */}
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-semibold uppercase ${commander.rarity === 'legendary' ? 'text-yellow-500' :
                            commander.rarity === 'epic' ? 'text-purple-400' :
                                commander.rarity === 'elite' ? 'text-blue-400' : 'text-green-400'
                        }`}>
                        {commander.rarity}
                    </span>
                    <div className="flex items-center gap-0.5">
                        {Array.from({ length: commander.stars }).map((_, i) => (
                            <Star key={i} className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
                        ))}
                    </div>
                </div>

                {/* Commander name */}
                <h4 className="font-semibold text-stone-200 text-sm mb-1">{commander.name}</h4>

                {/* Level and troop type */}
                <div className="flex items-center justify-between text-xs text-stone-400 mb-2">
                    <span>Level {commander.level}</span>
                    <span className={`
            ${commander.troopType === 'infantry' ? 'text-blue-400' :
                            commander.troopType === 'cavalry' ? 'text-red-400' :
                                commander.troopType === 'archer' ? 'text-green-400' : 'text-amber-400'}
          `}>
                        {commander.troopType}
                    </span>
                </div>

                {/* Roles */}
                <div className="flex flex-wrap gap-1">
                    {commander.role.map((role) => {
                        const Icon = roleIcons[role];
                        return (
                            <span key={role} className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 ${roleColors[role]}`}>
                                <Icon className="w-2.5 h-2.5" />
                                {role}
                            </span>
                        );
                    })}
                </div>

                {/* Skills preview */}
                <div className="mt-2 pt-2 border-t border-stone-700">
                    <div className="flex items-center gap-1 text-xs text-stone-500">
                        <span>Skills:</span>
                        {commander.skillLevels.map((level, i) => (
                            <span
                                key={i}
                                className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-medium ${level === 5 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-stone-700 text-stone-400'
                                    }`}
                            >
                                {level}
                            </span>
                        ))}
                    </div>
                </div>

                {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-stone-900">✓</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />

            {/* Modal */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-600/20">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-stone-700">
                    <h2 className="text-xl font-semibold text-amber-500">Select Commanders</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-stone-700 transition-colors"
                    >
                        <X className="w-5 h-5 text-stone-400" />
                    </button>
                </div>

                {/* Search and Filters */}
                <div className="p-4 border-b border-stone-700">
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                            <input
                                type="text"
                                placeholder="Search commanders..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-lg bg-stone-700 border border-stone-600 text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-600"
                            />
                        </div>

                        <select
                            value={filterRarity}
                            onChange={(e) => setFilterRarity(e.target.value as CommanderRarity | 'all')}
                            className="px-3 py-2 rounded-lg bg-stone-700 border border-stone-600 text-stone-200 focus:outline-none focus:border-amber-600"
                        >
                            <option value="all">All Rarities</option>
                            <option value="legendary">Legendary</option>
                            <option value="epic">Epic</option>
                        </select>

                        <select
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value as CommanderRole | 'all')}
                            className="px-3 py-2 rounded-lg bg-stone-700 border border-stone-600 text-stone-200 focus:outline-none focus:border-amber-600"
                        >
                            <option value="all">All Roles</option>
                            <option value="tank">Tank</option>
                            <option value="nuker">Nuker</option>
                            <option value="support">Support</option>
                            <option value="healer">Healer</option>
                            <option value="disabler">Disabler</option>
                        </select>

                        <select
                            value={filterTroop}
                            onChange={(e) => setFilterTroop(e.target.value as TroopType | 'all')}
                            className="px-3 py-2 rounded-lg bg-stone-700 border border-stone-600 text-stone-200 focus:outline-none focus:border-amber-600"
                        >
                            <option value="all">All Troops</option>
                            <option value="infantry">Infantry</option>
                            <option value="cavalry">Cavalry</option>
                            <option value="archer">Archer</option>
                            <option value="mixed">Mixed</option>
                        </select>
                    </div>
                </div>

                {/* Selection sections */}
                <div className="p-4 overflow-y-auto max-h-[50vh]">
                    {/* Primary Commander Selection */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-3">
                            Primary Commander {selectedPrimary && `(${selectedPrimary.name})`}
                        </h3>
                        {availableCommanders.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {availableCommanders.map((c) => renderCommanderCard(c, true))}
                            </div>
                        ) : (
                            <p className="text-center text-stone-500 py-8">
                                No commanders available. Add commanders first!
                            </p>
                        )}
                    </div>

                    {/* Secondary Commander Selection */}
                    {selectedPrimary && (
                        <div>
                            <h3 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-3">
                                Secondary Commander (Optional) {selectedSecondary && `(${selectedSecondary.name})`}
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {availableCommanders
                                    .filter((c) => c.uniqueId !== selectedPrimary.uniqueId)
                                    .map((c) => renderCommanderCard(c, false))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-stone-700">
                    <div className="text-sm text-stone-400">
                        {selectedPrimary ? (
                            <span>
                                Selected: <strong className="text-amber-500">{selectedPrimary.name}</strong>
                                {selectedSecondary && (
                                    <> + <strong className="text-amber-500">{selectedSecondary.name}</strong></>
                                )}
                            </span>
                        ) : (
                            <span>Select a primary commander</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-amber-600 text-amber-500 hover:bg-amber-600/10 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedPrimary}
                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-500 hover:to-amber-600 transition-all"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}