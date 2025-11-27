'use client';

import { X, Plus, Shield, Swords } from 'lucide-react';
import { FormationArmy } from '@/lib/sunset-canyon/store';

interface FormationGridProps {
  formation: (FormationArmy | null)[];
  type: 'attack' | 'defense';
  selectedSlot: number | null;
  onSlotClick: (index: number) => void;
  onRemoveArmy: (index: number) => void;
  label: string;
}

export function FormationGrid({
  formation,
  type,
  selectedSlot,
  onSlotClick,
  onRemoveArmy,
  label,
}: FormationGridProps) {
  const frontRow = formation.slice(0, 4);
  const backRow = formation.slice(4, 8);

  const renderSlot = (army: FormationArmy | null, index: number, row: 'front' | 'back') => {
    const isSelected = selectedSlot === index;
    const actualIndex = row === 'front' ? index : index + 4;

    return (
      <div
        key={actualIndex}
        onClick={() => onSlotClick(actualIndex)}
        className={`
          relative aspect-square rounded-lg cursor-pointer transition-all
          ${isSelected ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-stone-900' : ''}
          ${army
            ? 'bg-gradient-to-br from-stone-700 to-stone-800 border border-amber-600/30'
            : 'bg-stone-800/50 border-2 border-dashed border-stone-600 hover:border-amber-600/50'
          }
        `}
      >
        {army ? (
          <>
            <div className="absolute inset-0 p-2 flex flex-col justify-between">
              <div>
                <p className={`text-xs font-semibold truncate ${
                  army.primaryCommander.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                }`}>
                  {army.primaryCommander.name}
                </p>
                {army.secondaryCommander && (
                  <p className={`text-[10px] truncate ${
                    army.secondaryCommander.rarity === 'legendary' ? 'text-yellow-500/70' : 'text-purple-400/70'
                  }`}>
                    + {army.secondaryCommander.name}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] px-1 py-0.5 rounded ${
                  army.primaryCommander.troopType === 'infantry' ? 'bg-blue-900/50 text-blue-300' :
                  army.primaryCommander.troopType === 'cavalry' ? 'bg-red-900/50 text-red-300' :
                  army.primaryCommander.troopType === 'archer' ? 'bg-green-900/50 text-green-300' :
                  'bg-amber-900/50 text-amber-300'
                }`}>
                  {army.primaryCommander.troopType}
                </span>
                <span className="text-[10px] text-stone-400">
                  Lv.{army.primaryCommander.level}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveArmy(actualIndex);
              }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-500 transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Plus className="w-6 h-6 text-stone-600" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl p-4 bg-gradient-to-br from-stone-800/90 to-stone-900/80 border border-amber-600/20">
      <div className="flex items-center gap-2 mb-4">
        {type === 'attack' ? (
          <Swords className="w-5 h-5 text-amber-500" />
        ) : (
          <Shield className="w-5 h-5 text-amber-500" />
        )}
        <h3 className="text-lg font-semibold text-amber-500">{label}</h3>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-stone-500 mb-2 uppercase tracking-wider">Back Row (Damage)</p>
          <div className="grid grid-cols-4 gap-2">
            {backRow.map((army, index) => renderSlot(army, index, 'back'))}
          </div>
        </div>

        <div>
          <p className="text-xs text-stone-500 mb-2 uppercase tracking-wider">Front Row (Tanks)</p>
          <div className="grid grid-cols-4 gap-2">
            {frontRow.map((army, index) => renderSlot(army, index, 'front'))}
          </div>
        </div>
      </div>
    </div>
  );
}
