'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Plus, ChevronDown } from 'lucide-react';
import { Commander, fetchCommanders } from '@/lib/sunset-canyon/commanders';

interface QuickAddCommanderProps {
  onAdd: (commander: Commander, level: number, skillLevels: number[], stars: number) => void;
  onClose: () => void;
  existingCommanderIds?: string[];
}

export function QuickAddCommander({ onAdd, onClose, existingCommanderIds = [] }: QuickAddCommanderProps) {
  const [commanders, setCommanders] = useState<Commander[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCommander, setSelectedCommander] = useState<Commander | null>(null);
  const [level, setLevel] = useState(60);
  const [stars, setStars] = useState(5);
  const [skills, setSkills] = useState([5, 5, 5, 5]);
  const [keepOpen, setKeepOpen] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCommanders().then(data => {
      setCommanders(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!loading && searchRef.current) {
      searchRef.current.focus();
    }
  }, [loading]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCommanders = useMemo(() => {
    if (!search.trim()) return commanders;
    const searchLower = search.toLowerCase();
    return commanders.filter(c =>
      c.name.toLowerCase().includes(searchLower) ||
      c.id.toLowerCase().includes(searchLower)
    );
  }, [commanders, search]);

  const handleSelectCommander = (commander: Commander) => {
    setSelectedCommander(commander);
    setSearch(commander.name);
    setShowDropdown(false);
    // Set default stars based on rarity
    setStars(commander.rarity === 'legendary' ? 5 : 4);
    // Reset skills to reasonable defaults
    setSkills([5, 5, 5, 5]);
  };

  const handleAdd = () => {
    if (!selectedCommander) return;
    onAdd(selectedCommander, level, skills, stars);

    if (keepOpen) {
      // Reset for next commander
      setSelectedCommander(null);
      setSearch('');
      setLevel(60);
      setStars(5);
      setSkills([5, 5, 5, 5]);
      searchRef.current?.focus();
    } else {
      onClose();
    }
  };

  const updateSkill = (index: number, value: number) => {
    const newSkills = [...skills];
    newSkills[index] = Math.max(0, Math.min(5, value));
    setSkills(newSkills);
  };

  const isAlreadyAdded = selectedCommander && existingCommanderIds.includes(selectedCommander.id);

  if (loading) {
    return (
      <>
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-600/20 p-8">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-600/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-700">
          <h2 className="text-lg font-semibold text-amber-500">Quick Add Commander</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-700 transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Commander Search */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-medium text-stone-300 mb-1.5">
              Commander
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowDropdown(true);
                  if (selectedCommander && e.target.value !== selectedCommander.name) {
                    setSelectedCommander(null);
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search commanders..."
                className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-stone-700 border border-stone-600 text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto rounded-lg bg-stone-800 border border-stone-600 shadow-xl">
                {filteredCommanders.length === 0 ? (
                  <div className="p-3 text-center text-stone-500">No commanders found</div>
                ) : (
                  filteredCommanders.map((cmd) => {
                    const alreadyAdded = existingCommanderIds.includes(cmd.id);
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => handleSelectCommander(cmd)}
                        disabled={alreadyAdded}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-stone-700 transition-colors ${
                          alreadyAdded ? 'opacity-50 cursor-not-allowed' : ''
                        } ${selectedCommander?.id === cmd.id ? 'bg-amber-600/20' : ''}`}
                      >
                        <div>
                          <span className={`font-medium ${
                            cmd.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                          }`}>
                            {cmd.name}
                          </span>
                          <span className="ml-2 text-xs text-stone-500 capitalize">
                            {cmd.troopType}
                          </span>
                        </div>
                        {alreadyAdded && (
                          <span className="text-xs text-stone-500">Added</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Selected Commander Info */}
          {selectedCommander && (
            <div className={`p-3 rounded-lg border ${
              selectedCommander.rarity === 'legendary'
                ? 'bg-yellow-900/20 border-yellow-600/30'
                : 'bg-purple-900/20 border-purple-600/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${
                  selectedCommander.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                }`}>
                  {selectedCommander.name}
                </span>
                <span className="text-xs text-stone-400 capitalize">
                  {selectedCommander.rarity} • {selectedCommander.troopType}
                </span>
              </div>
            </div>
          )}

          {/* Level and Stars */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1.5">
                Level
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={level}
                onChange={(e) => setLevel(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2.5 rounded-lg bg-stone-700 border border-stone-600 text-stone-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1.5">
                Stars
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStars(s)}
                    className={`flex-1 py-2.5 rounded-lg text-lg transition-all ${
                      s <= stars
                        ? 'bg-yellow-500/30 text-yellow-500'
                        : 'bg-stone-700 text-stone-600'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1.5">
              Skills <span className="text-stone-500 font-normal">(0 = not unlocked)</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {skills.map((skill, i) => (
                <div key={i} className="relative">
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={skill}
                    onChange={(e) => updateSkill(i, parseInt(e.target.value) || 0)}
                    className={`w-full px-3 py-2.5 rounded-lg border text-center font-semibold focus:outline-none focus:border-amber-500 ${
                      skill === 5
                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500'
                        : skill === 0
                        ? 'bg-stone-800 border-stone-700 text-stone-500'
                        : 'bg-stone-700 border-stone-600 text-stone-200'
                    }`}
                  />
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-stone-600 text-[10px] flex items-center justify-center text-stone-400">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
            {/* Quick skill presets */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setSkills([5, 5, 5, 5])}
                className="px-2 py-1 text-xs rounded bg-stone-700 text-stone-400 hover:bg-stone-600"
              >
                5/5/5/5
              </button>
              <button
                onClick={() => setSkills([5, 5, 1, 1])}
                className="px-2 py-1 text-xs rounded bg-stone-700 text-stone-400 hover:bg-stone-600"
              >
                5/5/1/1
              </button>
              <button
                onClick={() => setSkills([5, 1, 1, 1])}
                className="px-2 py-1 text-xs rounded bg-stone-700 text-stone-400 hover:bg-stone-600"
              >
                5/1/1/1
              </button>
              <button
                onClick={() => setSkills([1, 0, 0, 0])}
                className="px-2 py-1 text-xs rounded bg-stone-700 text-stone-400 hover:bg-stone-600"
              >
                1/0/0/0
              </button>
            </div>
          </div>

          {/* Keep open toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={keepOpen}
              onChange={(e) => setKeepOpen(e.target.checked)}
              className="w-4 h-4 rounded bg-stone-700 border-stone-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-stone-800"
            />
            <span className="text-sm text-stone-400">Keep open to add more</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-stone-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-stone-600 text-stone-400 hover:bg-stone-700 transition-colors"
          >
            {keepOpen ? 'Done' : 'Cancel'}
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedCommander || !!isAlreadyAdded}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-500 hover:to-amber-600 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Commander
          </button>
        </div>
      </div>
    </>
  );
}
