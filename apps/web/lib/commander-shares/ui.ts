// Layout constants of the shared-commander card: rok-bot/rok_commanders/sample/ui.json (format 1, the same for every record).

import type { Armament, CommanderUI } from './types';

export const UI: CommanderUI = {
  format: 1,
  gear_slots: { 1: 'Weapon', 2: 'Helm', 3: 'Chest', 4: 'Gloves', 5: 'Legs', 6: 'Boots', 7: 'Accessory 1', 8: 'Accessory 2' },
  gear_positions: { 2: [0, 0], 3: [0, 1.05], 1: [-0.6, 1.58], 4: [0.6, 1.58], 5: [0, 2.1], 7: [-0.6, 2.63], 8: [0.6, 2.63], 6: [0, 3.15] },
  armament_corners: { 1: 'top-left', 2: 'top-right', 4: 'bottom-left', 3: 'bottom-right' },
  armament_placeholders: {
    1: 'img_FormationSettingPattern_1',
    2: 'img_FormationSettingPattern_4',
    3: 'img_FormationSettingPattern_3',
    4: 'img_FormationSettingPattern_2',
  },
  formation_placeholder: 'img_FormationSettingPattern_0',
  iconic_frame: 'img_AwakenFrame',
  iconic_plate: 'img_AwakenNameplate1',
  quality_colors: { 1: '#9aa0a6', 2: '#4caf50', 3: '#3d8bfd', 4: '#a052e0', 5: '#f0a020' },
  slot_placeholders: {
    1: 'img_EquipSlotIcon03',
    2: 'img_EquipSlotIcon01',
    3: 'img_EquipSlotIcon02',
    4: 'img_EquipSlotIcon04',
    5: 'img_EquipSlotIcon05',
    6: 'img_EquipSlotIcon08',
    7: 'img_EquipSlotIcon06',
    8: 'img_EquipSlotIcon07',
  },
};

/** Armament kind by type (the game's names), for an empty corner. */
export const ARMAMENT_KINDS: Record<Armament['type'], string> = { 1: 'Scroll', 2: 'Instrument', 3: 'Flag', 4: 'Emblem' };

/** The reference draws 72 px per tile unit and 64 px tiles. */
export const TILE_UNIT = 72;

/** An icon name from the record → its file, or null (missing / unexpected names draw nothing, never a broken image). */
export function iconUrl(name: string | null | undefined): string | null {
  return name && /^[A-Za-z0-9_]{1,80}$/.test(name) ? `/commanders/icons/${name}.png` : null;
}

export function qualityColor(quality: number | null | undefined): string | undefined {
  return quality ? UI.quality_colors[String(quality)] : undefined;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
export const roman = (n: number) => ROMAN[n] ?? String(n);

/** 2.5 → "2.5", 3 → "3", 9.600000001 → "9.6". */
export function num(v: number): string {
  return String(Math.round(v * 100) / 100);
}

export function signed(v: number | null | undefined, percent: boolean): string {
  if (v === null || v === undefined) return '';
  return `${v < 0 ? '' : '+'}${num(v)}${percent ? '%' : ''}`;
}
