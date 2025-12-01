'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Castle, Clock, Coins, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';

// Placeholder data structure for building requirements
// TODO: Move to shared-data package when populating with real game data
interface BuildingLevel {
  level: number;
  power: number;
  requirements: {
    food: number;
    wood: number;
    stone: number;
    gold: number;
    time: number; // in seconds
  };
  prerequisites: string[];
}

interface Building {
  id: string;
  name: string;
  category: 'military' | 'economy' | 'development' | 'decoration';
  maxLevel: number;
  levels: BuildingLevel[];
}

// Sample data for City Hall (to be replaced with full data)
const SAMPLE_BUILDINGS: Building[] = [
  {
    id: 'city_hall',
    name: 'City Hall',
    category: 'development',
    maxLevel: 25,
    levels: [
      { level: 1, power: 10, requirements: { food: 0, wood: 0, stone: 0, gold: 0, time: 0 }, prerequisites: [] },
      { level: 2, power: 25, requirements: { food: 100, wood: 100, stone: 0, gold: 0, time: 60 }, prerequisites: [] },
      { level: 3, power: 50, requirements: { food: 500, wood: 500, stone: 0, gold: 0, time: 180 }, prerequisites: [] },
      // More levels would be added here...
    ],
  },
];

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours < 24) return `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export default function UpgradeCalculator() {
  const [darkMode, setDarkMode] = useState(true);
  const [currentCityHall, setCurrentCityHall] = useState(1);
  const [targetCityHall, setTargetCityHall] = useState(25);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const theme = {
    bg: darkMode ? 'bg-zinc-950' : 'bg-gray-50',
    card: darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200',
    cardHover: darkMode ? 'hover:border-blue-500/50' : 'hover:border-blue-400',
    text: darkMode ? 'text-zinc-100' : 'text-gray-900',
    textMuted: darkMode ? 'text-zinc-400' : 'text-gray-500',
    textAccent: darkMode ? 'text-blue-400' : 'text-blue-600',
    border: darkMode ? 'border-zinc-800' : 'border-gray-200',
    input: darkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-white border-gray-300 text-gray-900',
    button: darkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900',
    buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors duration-200`}>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <header className={`flex items-center justify-between mb-8 pb-4 border-b ${theme.border}`}>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className={`p-2 rounded-lg ${theme.button} transition-colors`}
              title="Back to home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Upgrade Calculator</h1>
              <p className={`text-sm ${theme.textMuted}`}>Plan your path to power</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${theme.button} transition-colors`}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <UserMenu />
          </div>
        </header>

        {/* City Hall Range Selector */}
        <section className={`${theme.card} border rounded-xl p-6 mb-6`}>
          <div className="flex items-center gap-3 mb-4">
            <Castle className={`w-6 h-6 ${theme.textAccent}`} />
            <h2 className="text-lg font-semibold">City Hall Upgrade Path</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
                Current Level
              </label>
              <select
                value={currentCityHall}
                onChange={(e) => setCurrentCityHall(Number(e.target.value))}
                className={`w-full px-4 py-2.5 rounded-lg border ${theme.input} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              >
                {Array.from({ length: 25 }, (_, i) => i + 1).map((level) => (
                  <option key={level} value={level}>
                    City Hall {level}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center">
              <ChevronRight className={`w-8 h-8 ${theme.textMuted}`} />
            </div>

            <div>
              <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
                Target Level
              </label>
              <select
                value={targetCityHall}
                onChange={(e) => setTargetCityHall(Number(e.target.value))}
                className={`w-full px-4 py-2.5 rounded-lg border ${theme.input} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              >
                {Array.from({ length: 25 }, (_, i) => i + 1)
                  .filter((level) => level > currentCityHall)
                  .map((level) => (
                    <option key={level} value={level}>
                      City Hall {level}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </section>

        {/* Resource Summary */}
        <section className={`${theme.card} border rounded-xl p-6 mb-6`}>
          <h2 className="text-lg font-semibold mb-4">Total Resources Needed</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${theme.textMuted} mb-1`}>Food</div>
              <div className="text-xl font-bold text-green-500">--</div>
            </div>
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${theme.textMuted} mb-1`}>Wood</div>
              <div className="text-xl font-bold text-amber-500">--</div>
            </div>
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${theme.textMuted} mb-1`}>Stone</div>
              <div className="text-xl font-bold text-stone-400">--</div>
            </div>
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
              <div className={`text-sm ${theme.textMuted} mb-1`}>Gold</div>
              <div className="text-xl font-bold text-yellow-500">--</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'} flex items-center gap-3`}>
              <Clock className={`w-5 h-5 ${theme.textAccent}`} />
              <div>
                <div className={`text-sm ${theme.textMuted}`}>Total Build Time</div>
                <div className="text-lg font-bold">--</div>
              </div>
            </div>
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'} flex items-center gap-3`}>
              <Package className={`w-5 h-5 ${theme.textAccent}`} />
              <div>
                <div className={`text-sm ${theme.textMuted}`}>Speedups Needed</div>
                <div className="text-lg font-bold">--</div>
              </div>
            </div>
          </div>
        </section>

        {/* Advanced Options */}
        <section className={`${theme.card} border rounded-xl overflow-hidden mb-6`}>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`w-full p-4 flex items-center justify-between ${darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'} transition-colors`}
          >
            <span className="font-semibold">Advanced Options</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className={`p-4 border-t ${theme.border}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
                    VIP Level
                  </label>
                  <select className={`w-full px-4 py-2.5 rounded-lg border ${theme.input}`}>
                    {Array.from({ length: 18 }, (_, i) => i).map((level) => (
                      <option key={level} value={level}>VIP {level}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
                    Construction Speed Bonus %
                  </label>
                  <input
                    type="number"
                    defaultValue={0}
                    className={`w-full px-4 py-2.5 rounded-lg border ${theme.input}`}
                    placeholder="e.g., 25"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
                    Research Speed Bonus %
                  </label>
                  <input
                    type="number"
                    defaultValue={0}
                    className={`w-full px-4 py-2.5 rounded-lg border ${theme.input}`}
                    placeholder="e.g., 15"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
                    Builder Huts
                  </label>
                  <select className={`w-full px-4 py-2.5 rounded-lg border ${theme.input}`}>
                    <option value={1}>1 Builder</option>
                    <option value={2}>2 Builders</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Coming Soon Notice */}
        <section className={`${theme.card} border rounded-xl p-6 text-center`}>
          <div className={`text-4xl mb-4`}>🚧</div>
          <h3 className="text-lg font-semibold mb-2">Under Construction</h3>
          <p className={`${theme.textMuted} max-w-md mx-auto`}>
            This calculator is being built! Soon you&apos;ll be able to plan your upgrade path
            from one City Hall level to another, with detailed resource and speedup requirements.
          </p>
          <div className={`mt-4 p-3 rounded-lg ${darkMode ? 'bg-zinc-800' : 'bg-gray-100'} inline-block`}>
            <p className={`text-sm ${theme.textMuted}`}>
              Features coming: Building prerequisites, optimal upgrade order, resource gathering estimates
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className={`mt-12 pt-8 border-t ${theme.border} text-center`}>
          <p className={`text-xs ${theme.textMuted}`}>
            Angmar Alliance • Rise of Kingdoms
          </p>
        </footer>
      </div>
    </div>
  );
}
