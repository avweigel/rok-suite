'use client';

import { Shield, Crosshair, Plus, X, User } from 'lucide-react';
import { Army } from '@/lib/sunset-canyon/simulation';

interface FormationGridProps {
    formation: (Army | null)[];
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
    const isAttack = type === 'attack';
    const frontRow = formation.slice(0, 4);
    const backRow = formation.slice(4, 8);

    const renderSlot = (army: Army | null, index: number) => {
        const isSelected = selectedSlot === index;
        const isFilled = army !== null;

        return (
            <div
        key= {`${type}-${index}`
    }
    onClick = {() => onSlotClick(index)
}
className = {`
          relative h-28 cursor-pointer rounded-lg border-2 border-dashed transition-all duration-300
          ${isFilled
        ? 'border-solid border-amber-600 bg-gradient-to-br from-stone-800 to-stone-900'
        : 'border-amber-600/30 bg-gradient-to-br from-stone-800/80 to-stone-900/60 hover:border-amber-600'}
          ${isSelected ? 'border-amber-400 shadow-[0_0_20px_rgba(217,119,6,0.3)]' : ''}
        `}
      >
{
    army?(
          <div className = "absolute inset-0 p-2 flex flex-col" >
            {/* Remove button */ }
            < button
              onClick = {(e) => {
            e.stopPropagation();
    onRemoveArmy(index);
}}
className = "absolute top-1 right-1 w-5 h-5 rounded-full bg-red-900 hover:bg-red-800 flex items-center justify-center transition-colors z-10"
    >
    <X className="w-3 h-3 text-white" />
        </button>

{/* Commander info */ }
<div className="flex-1 flex flex-col justify-center items-center text-center" >
    <div
                className={
    `
                  w-10 h-10 rounded-full flex items-center justify-center mb-1
                  ${army.primaryCommander.rarity === 'legendary'
            ? 'bg-gradient-to-br from-yellow-500/30 to-amber-700/30 border border-yellow-500/50'
            : 'bg-gradient-to-br from-purple-500/30 to-purple-900/30 border border-purple-500/50'}
                `}
              >
    <User className={ `w-5 h-5 ${army.primaryCommander.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'}` } />
        </div>
        < span className = {`text-xs font-semibold truncate w-full ${army.primaryCommander.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
            }`}>
                { army.primaryCommander.name }
                </span>
{
    army.secondaryCommander && (
        <span className="text-[10px] text-stone-500 truncate w-full" >
            + { army.secondaryCommander.name }
            </span>
              )
}
<span className="text-[10px] text-amber-600 mt-0.5" >
    Lv.{ army.primaryCommander.level }
</span>
    </div>

{/* Troop type indicator */ }
<div className={
    `absolute bottom-1 left-1 text-[10px] font-medium ${army.troopType === 'infantry' ? 'text-blue-400' :
        army.troopType === 'cavalry' ? 'text-red-400' :
            army.troopType === 'archer' ? 'text-green-400' : 'text-amber-400'
        }`
}>
    { army.troopType.charAt(0).toUpperCase() }
    </div>
    </div>
        ) : (
    <div className= "absolute inset-0 flex items-center justify-center" >
    <Plus className="w-6 h-6 text-amber-600/30" />
        </div>
        )}
</div>
    );
  };

return (
    <div className= "rounded-xl p-4 bg-gradient-to-br from-stone-800/90 to-stone-900/80 border border-amber-600/20" >
    {/* Header */ }
    < div className = "flex items-center gap-3 mb-4" >
        {
            isAttack?(
          <Crosshair className = "w-5 h-5 text-red-500" />
        ): (
                    <Shield className = "w-5 h-5 text-blue-500" />
        )}
<h3 className="text-base font-semibold text-amber-500" > { label } </h3>
    < span className = "text-sm text-stone-500" >
        ({ formation.filter(Boolean).length } / 5 armies)
</span>
    </div>

{/* Formation Grid */ }
<div className="space-y-3" >
    {/* Back Row Label */ }
    < div className = "flex items-center gap-2 mb-1" >
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-600/30 to-transparent" />
            <span className="text-[10px] text-stone-500 uppercase tracking-wider" > Back Row(AoE / Support) </span>
                < div className = "h-px flex-1 bg-gradient-to-r from-transparent via-amber-600/30 to-transparent" />
                    </div>

{/* Back Row */ }
<div className="grid grid-cols-4 gap-2" >
    { backRow.map((army, i) => renderSlot(army, i + 4)) }
    </div>

{/* Front Row Label */ }
<div className="flex items-center gap-2 mt-4 mb-1" >
    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-600/30 to-transparent" />
        <span className="text-[10px] text-stone-500 uppercase tracking-wider" > Front Row(Tanks) </span>
            < div className = "h-px flex-1 bg-gradient-to-r from-transparent via-amber-600/30 to-transparent" />
                </div>

{/* Front Row */ }
<div className="grid grid-cols-4 gap-2" >
    { frontRow.map((army, i) => renderSlot(army, i)) }
    </div>
    </div>

{/* Battle Direction Indicator */ }
<div className="mt-4 flex items-center justify-center gap-2 text-xs text-stone-500" >
{
    isAttack?(
          <>
    <span>Your Forces </span>
        <span>→</span>
            < span > Enemy </span>
            </>
        ) : (
    <>
    <span>Enemy </span>
    <span>→</span>
        < span > Your Forces </span>
            </>
        )}
</div>
    </div>
  );
}