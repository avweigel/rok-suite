'use client';

import { useState, useEffect } from 'react';
import { X, Search, Star, Loader2 } from 'lucide-react';
import { Commander, CommanderRarity, fetchCommanders } from '@/lib/sunset-canyon/commanders';

interface AddCommanderModalProps {
  onAdd: (commander: Commander, level: number, skillLevels: number[], stars: number) => void;
  onClose: () => void;
}

export function AddCommanderModal({ onAdd, onClose }: AddCommanderModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommander, setSelectedCommander] = useState<Commander | null>(null);
  const [level, setLevel] = useState(60);
  const [skillLevels, setSkillLevels] = useState([5, 5, 5, 5]);
  const [stars, setStars] = useState(5);
  const [filterRarity, setFilterRarity] = useState<CommanderRarity | 'all'>('all');
  const [commanders, setCommanders] = useState<Commander[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadCommanders() {
      setIsLoading(true);
      const data = await fetchCommanders();
      setCommanders(data);
      setIsLoading(false);
    }
    loadCommanders();
  }, []);

  const filteredCommanders = commanders.filter((c) => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterRarity !== 'all' && c.rarity !== filterRarity) return false;
    return true;
  });

  const handleAdd = () => {
    if (selectedCommander) {
      onAdd(selectedCommander, level, skillLevels, stars);
    }
  };

  const updateSkillLevel = (index: number, value: number) => {
    const newLevels = [...skillLevels];
    newLevels[index] = Math.max(1, Math.min(5, value));
    setSkillLevels(newLevels);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
      
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-3xl max-h-[90vh] overflow-hidden rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-600/20">
        <div className="flex items-center justify-between p-4 border-b border-stone-700">
          <h2 className="text-xl font-semibold text-amber-500">Add Commander</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-700 transition-colors"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
              <p className="text-stone-400">Loading commanders...</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                    <input
                      type="text"
                      placeholder="Search..."
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
                    <option value="all">All</option>
                    <option value="legendary">Legendary</option>
                    <option value="epic">Epic</option>
                  </select>
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                  {filteredCommanders.map((commander) => (
                    <div
                      key={commander.id}
                      onClick={() => setSelectedCommander(commander)}
                      className={`
                        p-3 rounded-lg cursor-pointer transition-all
                        ${selectedCommander?.id === commander.id
                          ? 'bg-amber-600/20 border border-amber-500'
                          : 'bg-stone-700/50 border border-transparent hover:border-amber-600/30'}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-stone-200">{commander.name}</span>
                        <span className={`text-xs uppercase ${
                          commander.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                        }`}>
                          {commander.rarity}
                        </span>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {commander.role.map((role) => (
                          <span key={role} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-600 text-stone-300">
                            {role}
                          </span>
                        ))}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          commander.troopType === 'infantry' ? 'bg-blue-900/50 text-blue-300' :
                          commander.troopType === 'cavalry' ? 'bg-red-900/50 text-red-300' :
                          commander.troopType === 'archer' ? 'bg-green-900/50 text-green-300' :
                          'bg-amber-900/50 text-amber-300'
                        }`}>
                          {commander.troopType}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {selectedCommander ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-stone-700/50 border border-stone-600">
                      <h3 className={`text-lg font-semibold ${
                        selectedCommander.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                      }`}>
                        {selectedCommander.name}
                      </h3>
                      <p className="text-sm text-stone-400">{selectedCommander.troopType} specialist</p>
                      {selectedCommander.specialties && selectedCommander.specialties.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {selectedCommander.specialties.map((spec) => (
                            <span key={spec} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400">
                              {spec}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-amber-500 mb-2">
                        Level: {level}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="60"
                        value={level}
                        onChange={(e) => setLevel(parseInt(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                      <div className="flex justify-between text-xs text-stone-500">
                        <span>1</span>
                        <span>60</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-amber-500 mb-2">
                        Stars (Sculptures)
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            onClick={() => setStars(s)}
                            className={`p-2 rounded-lg transition-all ${
                              stars >= s
                                ? 'bg-yellow-500/20 text-yellow-500'
                                : 'bg-stone-700 text-stone-500'
                            }`}
                          >
                            <Star className={`w-5 h-5 ${stars >= s ? 'fill-current' : ''}`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-amber-500 mb-2">
                        Skill Levels
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {['1st', '2nd', '3rd', '4th'].map((label, i) => (
                          <div key={i} className="text-center">
                            <input
                              type="number"
                              min="1"
                              max="5"
                              value={skillLevels[i]}
                              onChange={(e) => updateSkillLevel(i, parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-2 rounded-lg bg-stone-700 border border-stone-600 text-stone-200 text-center focus:outline-none focus:border-amber-600"
                            />
                            <span className="text-xs text-stone-500">{label}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setSkillLevels([5, 5, 5, 5])}
                        className="mt-2 text-xs text-amber-500 hover:underline"
                      >
                        Set all to max (5)
                      </button>
                    </div>

                    <div className="p-3 rounded-lg bg-stone-700/50">
                      <h4 className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-2">
                        Base Stats
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-stone-400">Attack</span>
                          <span className="text-stone-200">{selectedCommander.baseStats.attack}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Defense</span>
                          <span className="text-stone-200">{selectedCommander.baseStats.defense}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Health</span>
                          <span className="text-stone-200">{selectedCommander.baseStats.health}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">Speed</span>
                          <span className="text-stone-200">{selectedCommander.baseStats.marchSpeed}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-stone-500">
                    Select a commander from the list
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-stone-700">
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-lg border border-amber-600 text-amber-500 hover:bg-amber-600/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedCommander}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-500 hover:to-amber-600 transition-all"
          >
            Add Commander
          </button>
        </div>
      </div>
    </>
  );
}
