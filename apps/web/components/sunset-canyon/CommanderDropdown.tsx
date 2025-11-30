'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { Commander } from '@/lib/sunset-canyon/commanders';

interface CommanderDropdownProps {
  commanders: Commander[];
  value: Commander | null;
  onChange: (commander: Commander | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CommanderDropdown({
  commanders,
  value,
  onChange,
  placeholder = 'Search commanders...',
  disabled = false,
  className = '',
}: CommanderDropdownProps) {
  const [search, setSearch] = useState(value?.name || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync search with value changes
  useEffect(() => {
    setSearch(value?.name || '');
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        // Reset search to current value if nothing selected
        if (!value) {
          setSearch('');
        } else {
          setSearch(value.name);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const filteredCommanders = useMemo(() => {
    if (!search.trim()) return commanders;
    const searchLower = search.toLowerCase();
    return commanders.filter(c =>
      c.name.toLowerCase().includes(searchLower) ||
      c.id.toLowerCase().includes(searchLower)
    );
  }, [commanders, search]);

  const handleSelect = (commander: Commander) => {
    onChange(commander);
    setSearch(commander.name);
    setShowDropdown(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearch('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(true);
            if (value && e.target.value !== value.name) {
              onChange(null);
            }
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-10 pr-16 py-2 rounded-lg bg-stone-700 border border-stone-600 text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500 disabled:opacity-50 text-sm"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              onClick={handleClear}
              className="p-1 rounded hover:bg-stone-600 transition-colors"
            >
              <X className="w-3 h-3 text-stone-400" />
            </button>
          )}
          <ChevronDown className="w-4 h-4 text-stone-500" />
        </div>
      </div>

      {showDropdown && !disabled && (
        <div className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto rounded-lg bg-stone-800 border border-stone-600 shadow-xl">
          {filteredCommanders.length === 0 ? (
            <div className="p-3 text-center text-stone-500 text-sm">No commanders found</div>
          ) : (
            filteredCommanders.slice(0, 20).map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => handleSelect(cmd)}
                className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-stone-700 transition-colors ${
                  value?.id === cmd.id ? 'bg-amber-600/20' : ''
                }`}
              >
                <span className={`font-medium text-sm ${
                  cmd.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                }`}>
                  {cmd.name}
                </span>
                <span className="text-xs text-stone-500 capitalize">
                  {cmd.troopType}
                </span>
              </button>
            ))
          )}
          {filteredCommanders.length > 20 && (
            <div className="p-2 text-center text-stone-500 text-xs border-t border-stone-700">
              Type to narrow results...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
