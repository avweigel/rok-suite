// Copied from rok-bot/rok_commanders/types.ts (2026-11-11): the record format is the tool's, keep it as is (format 1).
// rok_commanders — the record of one shared commander (format 1), as stored in public.commander_shares.record.
// Produced by rok-bot (rokscan/scan/heroexport.py). Every name and number is already resolved from the game's own data;
// icons are NAMES: render them from /commanders/icons/<name>.png. Texts coming from players (player) are untrusted: let React escape them.

export type StatLine = {
  id: number;
  name: string;               // e.g. "Cavalry Defense"
  value: number | null;       // 11 = +11% when percent, +3 when not
  percent: boolean;
  icon: string | null;        // tinted with `color` through a CSS mask, as the game does
  color: string | null;       // "#03a90a"
  talent_bonus?: number;      // green "+3.5%": only present when the commander has the piece's special talent
};

export type Gear = {
  slot: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;       // 1 Weapon, 2 Helm, 3 Chest, 4 Gloves, 5 Legs, 6 Boots, 7 Accessory 1 (ring side), 8 Accessory 2
  slot_name: string;
  id: string;                                // "20008_71"
  name: string;
  quality: 1 | 2 | 3 | 4 | 5 | null;         // Normal, Advanced, Elite, Epic, Legendary
  quality_name: string | null;
  icon: string | null;
  level: number | null;                      // "Equipment Level 45"
  iconic_level: 0 | 1 | 2 | 3 | 4 | 5;       // 0 = not awakened; >0 = gold frame + plate with the roman numeral
  special_talent: { tag: number; name: string; icon: string; active: boolean } | null;   // badge on the tile (e.g. red horse = Cavalry)
  stats: StatLine[];                         // "Equipment Attributes"
  iconic: { level: number; active: boolean; stat?: StatLine; skill?: string }[];       // "Iconic Attributes" I..V (inactive = greyed)
  set: { id: number; name: string; worn: number; pieces: number;
         steps: { pieces: number; active: boolean; bonuses: StatLine[] }[] } | null;   // "Set Effects"
};

export type Armament = {
  type: 1 | 2 | 3 | 4;                       // 1 Scroll, 2 Instrument, 3 Flag, 4 Emblem
  kind: string;
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  id: string;
  name: string;
  rarity: string | null;                     // "Legendary" | "Epic"
  quality: 4 | 5 | null;
  icon: string | null;
  formation: string | null;                  // "Delta Formation II" -> "For Delta Formation II"
  stats: StatLine[];                         // "Armament Attributes"
  inscriptions: { name: string; kind: 'special' | 'rare' | 'common'; effect: string }[];   // pills: gold / blue / white, effect on hover
};

export type CommanderRecord = {
  format: 1;
  key: string;                               // snapshot_share_<pid>_hero_<ms>
  pid: number;                               // governor ID of the sharer
  player: string | null;
  shared_ms: number;
  shared_at: string;                         // ISO, UTC
  received_at: string;
  hero: {
    id: number;
    name: string | null;
    rarity: number | null;                   // 5 legendary, 4 epic ...
    avatar: string | null;                   // portrait icon, shown below the armaments
    level: number;
    stars: number;
    talent_points: number | null;
    skill_levels: string;                    // "5555", "5451" (the expertise is never written)
    skills: { slot: number; id: number; name: string | null; level: number }[];
    expertise: { id: number; name: string | null } | null;
    sculptures_to_5555: { count: number; kind: string } | null;   // { 360, "GH" }; count 0 = maxed
  };
  gear: Gear[];
  armaments: Armament[];
  formation: { id: number; name: string | null; level: number; icon: string | null; bonuses: StatLine[] } | null;
  recap: {
    rows: (Omit<StatLine, 'value' | 'talent_bonus'> & { gear: number | null; armaments: number | null; total: number })[];
    iconic_skills: string[];
  };
  changes: string;                           // vs the previous version of the same pid x hero ("" for the first one)
};

// sample/ui.json: the layout constants (same for every record)
export type CommanderUI = {
  format: 1;
  gear_slots: Record<string, string>;
  gear_positions: Record<string, [number, number]>;          // tile units: x in -0.6 | 0 | 0.6, y 0 .. 3.15 (we draw 72 px per unit, tiles 64 px)
  armament_corners: Record<string, Armament['corner']>;
  armament_placeholders: Record<string, string>;             // empty armament slot silhouettes
  formation_placeholder: string;
  slot_placeholders: Record<string, string>;                 // empty gear slot silhouettes (img_EquipSlotIcon0x)
  iconic_frame: string;                                      // img_AwakenFrame (rotated 45deg with the tile)
  iconic_plate: string;                                      // img_AwakenNameplate1 (under the tile, roman numeral on it)
  quality_colors: Record<string, string>;
};
