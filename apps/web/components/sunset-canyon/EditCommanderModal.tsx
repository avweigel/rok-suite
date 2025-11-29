'use client';

import { useState } from 'react';
import { X, Star, Save } from 'lucide-react';
import { UserCommander } from '@/lib/sunset-canyon/commanders';

interface EditCommanderModalProps {
  commander: UserCommander;
  onSave: (uniqueId: string, level: number, skillLevels: number[], stars: number) => void;
  onClose: () => void;
}

export function EditCommanderModal({ commander, onSave, onClose }: EditCommanderModalProps) {
  const [level, setLevel] = useState(commander.level);
  const [skillLevels, setSkillLevels] = useState([...commander.skillLevels]);
  const [stars, setStars] = useState(commander.stars);

  const handleSave = () => {
    onSave(commander.uniqueId, level, skillLevels, stars);
  };

  const updateSkillLevel = (index: number, value: number) => {
    const newLevels = [...skillLevels];
    newLevels[index] = Math.max(1, Math.min(5, value));
    setSkillLevels(newLevels);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-xl rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-amber-600/20">
        <div className="flex items-center justify-between p-4 border-b border-stone-700">
          <h2 className="text-xl font-semibold text-amber-500">Edit Commander</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-700 transition-colors"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Commander Info */}
          <div className="p-4 rounded-lg bg-stone-700/50 border border-stone-600">
            <h3 className={`text-lg font-semibold ${
              commander.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
            }`}>
              {commander.name}
            </h3>
            <p className="text-sm text-stone-400">{commander.troopType} specialist</p>
            {commander.specialties && commander.specialties.length > 0 && (
              <div className="flex gap-1 mt-2">
                {commander.specialties.map((spec) => (
                  <span key={spec} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400">
                    {spec}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Level */}
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
            <div className="flex justify-between text-xs text-stone-500 mt-1">
              <span>1</span>
              <input
                type="number"
                min="1"
                max="60"
                value={level}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setLevel(Math.max(1, Math.min(60, val)));
                }}
                className="w-16 px-2 py-1 rounded bg-stone-700 border border-stone-600 text-stone-200 text-center"
              />
              <span>60</span>
            </div>
          </div>

          {/* Stars */}
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

          {/* Skill Levels */}
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
                  <span className="text-xs text-stone-500 mt-1 block">{label}</span>
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

          {/* Base Stats (read-only) */}
          <div className="p-3 rounded-lg bg-stone-700/50">
            <h4 className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-2">
              Base Stats
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-400">Attack</span>
                <span className="text-stone-200">{commander.baseStats.attack}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Defense</span>
                <span className="text-stone-200">{commander.baseStats.defense}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Health</span>
                <span className="text-stone-200">{commander.baseStats.health}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Speed</span>
                <span className="text-stone-200">{commander.baseStats.marchSpeed}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-stone-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-stone-600 text-stone-400 hover:bg-stone-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold hover:from-amber-500 hover:to-amber-600 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
}
