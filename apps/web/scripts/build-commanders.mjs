#!/usr/bin/env node
// Builds public/commanders/commanders.json: every commander of the game with its skills at max level
// (texts with their numbers), the talent trees with every talent at max level, and what a primary commander
// wears and carries: equipment (with its sets), formations and the inscriptions of the armaments. Everything
// comes from the game's own files, pulled from the device by the rok-bot tooling; nothing is typed in by hand.
//
//   node scripts/build-commanders.mjs <rok-bot dir> [--verbose]
//
// Reads, under <rok-bot dir>:
//   game_pull/unpacked/exceldata.bin.bin   the configuration tables (which skills a commander has, the numbers)
//   hero_texts_game.json                   skill, talent and inscription names and descriptions (hero_codex.py, from lc_hero.dat)
//   hero_codex_game.json                   commander names and nicknames (same)
//   game_pull/lc_pull_*/lc_<table>.dat     the game's text tables, read directly: lc_hero (formation names), lc_equipment
//                                          (equipment names, sets, special skills); lc_store, lc_formation, lc_map, lc_common
//                                          and lc_build for a few names. The newest pull that has a table is used. Pull with
//                                          adb -s <serial> pull /sdcard/Android/data/com.lilithgame.roc.gp/files/GLGData/com_lilithgame_roc_gp/doc/lc_equipment.dat
// Run it again after a game update that adds commanders (pull the files again first), then commit the JSON.
//
// A text table (lc_<table>.dat) is a ZIP of <table>.idx (the keys, without their LC_<TABLE>_ prefix) and one
// <table>_<lang>.bin per language (the texts, in the same order). Both are a 2-byte header and then records of
// u16 length + UTF-8 bytes, every byte XORed with one key byte per table (see rok-bot's rokscan/scan/lcdata.py).
//
// The format of exceldata.bin.bin, worked out on 2026-11-09 (it tiles the whole file):
//   u32 n, then n strings (u16 length + UTF-8): one pool for the whole file. Table by table it holds the
//     table's name, the names of its columns, then the strings of its cells in order of first use.
//   then, per table: u32 c + c int64   the table's own pool of values
//                    u32 k + k u32     the columns: (index of the name in the string pool << 2) | type
//                                      type 0 integer, 1 double (the 8 bytes of the pool entry), 2 string (pool entry = string index)
//                    u32 r             rows, each k cells; a cell is an index into the table's pool (u16, u32 when c > 65536)
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const botDir = args.find((a) => !a.startsWith('--'));
if (!botDir) {
  console.error('usage: node scripts/build-commanders.mjs <rok-bot dir> [--verbose]');
  process.exit(1);
}
const EXCEL = join(botDir, 'game_pull', 'unpacked', 'exceldata.bin.bin');
const TEXTS = join(botDir, 'hero_texts_game.json');
const CODEX = join(botDir, 'hero_codex_game.json');
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'commanders', 'commanders.json');

// ---- the configuration tables ------------------------------------------------------------------------------
function readExcel(buf) {
  let off = 0;
  const n = buf.readUInt32LE(off);
  off += 4;
  const strs = new Array(n);
  for (let i = 0; i < n; i++) {
    const len = buf.readUInt16LE(off);
    off += 2;
    strs[i] = buf.toString('utf8', off, off + len);
    off += len;
  }
  const tables = new Map();
  let seen = -1;                                                  // highest string index used so far: the next table's name follows it
  while (off < buf.length) {
    const c = buf.readUInt32LE(off);
    const poolOff = off + 4;
    off = poolOff + 8 * c;
    const k = buf.readUInt32LE(off);
    off += 4;
    if (k > 4000 || off + 4 * k > buf.length) throw new Error(`exceldata: bad table header at ${poolOff - 4}`);
    const cols = [];
    for (let i = 0; i < k; i++) {
      const d = buf.readUInt32LE(off);
      off += 4;
      cols.push({ idx: d >>> 2, name: strs[d >>> 2], type: d & 3 });
    }
    const rows = buf.readUInt32LE(off);
    off += 4;
    const w = c <= 0x10000 ? 2 : 4;
    const rowsOff = off;
    off += rows * k * w;
    if (off > buf.length) throw new Error(`exceldata: table at ${poolOff - 4} runs past the end of the file`);
    const cell = w === 2 ? (r, i) => buf.readUInt16LE(rowsOff + (r * k + i) * 2) : (r, i) => buf.readUInt32LE(rowsOff + (r * k + i) * 4);
    const int = (p) => Number(buf.readBigInt64LE(poolOff + 8 * p));
    const fresh = cols.map((x) => x.idx).filter((x) => x > seen);
    // the name sits just before the table's first new column name; when every column was seen before, just after the last string used
    const nameIdx = fresh.length ? Math.min(...fresh) - 1 : seen + 1;
    const name = strs[nameIdx] ?? `?${tables.size}`;
    let max = Math.max(seen, nameIdx, ...cols.map((x) => x.idx));
    cols.forEach((col, i) => {
      if (col.type !== 2) return;
      for (let r = 0; r < rows; r++) {
        const v = int(cell(r, i));
        if (v > max) max = v;
      }
    });
    seen = max;
    tables.set(name, {
      name, cols, rows,
      *[Symbol.iterator]() {
        for (let r = 0; r < rows; r++) {
          const o = {};
          cols.forEach((col, i) => {
            const p = cell(r, i);
            o[col.name] = col.type === 1 ? buf.readDoubleLE(poolOff + 8 * p) : col.type === 2 ? strs[int(p)] ?? '' : int(p);
          });
          yield o;
        }
      },
    });
  }
  return { strs, tables };
}

function table(excel, name, columns) {
  const t = excel.tables.get(name);
  if (!t) throw new Error(`exceldata: no table ${name} (the format or the game changed)`);
  const have = new Set(t.cols.map((c) => c.name));
  const missing = columns.filter((c) => !have.has(c));
  if (missing.length) throw new Error(`exceldata: table ${name} has no column ${missing.join(', ')}`);
  return [...t];
}

// ---- the game's text tables --------------------------------------------------------------------------------
/** The files of a ZIP: name -> bytes. */
function unzip(buf, path) {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error(`${path}: not a ZIP file`);
  const files = new Map();
  let p = buf.readUInt32LE(end + 16);
  for (let i = buf.readUInt16LE(end + 10); i > 0; i--) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`${path}: bad ZIP directory`);
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files.set(name, method === 0 ? raw : inflateRawSync(raw));
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return files;
}

/** One text table for a language: key (without its LC_<TABLE>_ prefix) -> text. */
function readLc(path, lang = 'en') {
  const files = unzip(readFileSync(path), path);
  const idxName = [...files.keys()].find((n) => n.endsWith('.idx'));
  const txt = idxName && files.get(`${idxName.slice(0, -4)}_${lang}.bin`);
  if (!idxName || !txt) throw new Error(`${path}: no keys or no ${lang} texts in it`);
  const idx = files.get(idxName);
  /** The records of a file under a key; `whole`: they tile it exactly. */
  const records = (b, key, decode) => {
    const out = [];
    let pos = 2;
    while (pos + 2 <= b.length) {
      const len = (b[pos] ^ key) | ((b[pos + 1] ^ key) << 8);
      if (pos + 2 + len > b.length) return { out, whole: false };
      if (decode) {
        const s = Buffer.allocUnsafe(len);
        for (let i = 0; i < len; i++) s[i] = b[pos + 2 + i] ^ key;
        out.push(s.toString('utf8'));
      } else out.push(null);
      pos += 2 + len;
    }
    return { out, whole: pos === b.length };
  };
  // the key byte is the one under which the key file tiles exactly and reads as keys
  const keys = [];
  for (let k = 0; k < 256; k++) {
    const walk = records(idx, k, false);
    if (!walk.whole || walk.out.length < 10) continue;
    const got = records(idx, k, true).out;
    if (got.slice(0, 200).every((s) => /^[A-Za-z0-9_.-]*$/.test(s))) keys.push({ k, got });
  }
  if (keys.length !== 1) throw new Error(`${path}: the key of the table was not found (${keys.length} candidates)`);
  // (the last text of some tables is cut short: every one before it is whole)
  const texts = records(txt, keys[0].k, true).out;
  const map = new Map();
  keys[0].got.forEach((key, i) => {
    if (i < texts.length) map.set(key, texts[i]);
  });
  return map;
}

/** `text('LC_EQUIPMENT_N_7')`: the English text of a key, from the newest pull of its table; null when there is none. */
function lcReader(dir, note) {
  const root = join(dir, 'game_pull');
  const pulls = existsSync(root) ? readdirSync(root).filter((d) => /^lc_pull_/.test(d)).sort().reverse().map((d) => join(root, d)) : [];
  const tables = new Map();
  const used = new Map();
  const load = (name) => {
    if (tables.has(name)) return tables.get(name);
    const path = [...pulls, root].map((d) => join(d, `lc_${name}.dat`)).find((p) => existsSync(p));
    let t = null;
    if (path) {
      try {
        t = readLc(path);
        used.set(name, path);
      } catch (e) {
        note(`text table lc_${name}.dat could not be read: ${e.message}`);
      }
    } else note(`text table lc_${name}.dat was not pulled: its names are left out`);
    tables.set(name, t);
    return t;
  };
  const text = (key) => {
    const m = /^LC_([A-Z0-9]+)_(.+)$/.exec(key ?? '');
    if (!m) return null;
    const v = load(m[1].toLowerCase())?.get(m[2]);
    return typeof v === 'string' && v.trim() ? v : null;
  };
  text.used = used;
  return text;
}

// ---- texts -------------------------------------------------------------------------------------------------
const clean = (s) =>
  s
    .replace(/<\/?(?:href|color|b|i|size|u)(?:=[^>]*)?>/gi, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

/** 0.07 * 100 is 7.000000000000001: numbers are kept to 4 decimals. */
const num = (v) => Math.round(v * 1e4) / 1e4;

function main() {
  const excel = readExcel(readFileSync(EXCEL));
  const texts = JSON.parse(readFileSync(TEXTS, 'utf8'));
  const codex = JSON.parse(readFileSync(CODEX, 'utf8'));
  const notes = [];
  const note = (m) => notes.push(m);
  const lc = lcReader(botDir, note);
  const T = (key) => {
    const t = lc(key);
    return t == null ? null : clean(t);
  };

  const skillText = (key, what) => {
    // an awakened skill may take its name from the expertise names (LC_HERO_EXSKILL_NAME_<n>)
    const ex = /^LC_HERO_EXSKILL_NAME_(\d+)$/.exec(key ?? '');
    if (ex && what === 'name') return typeof texts.expertise?.[ex[1]] === 'string' ? texts.expertise[ex[1]].trim() || null : null;
    const m = /^LC_HERO_SKILL_(?:NAME|DESC)_(\d+)(?:_(.+))?$/.exec(key ?? '');
    if (!m) return null;
    const e = texts.skills[m[1]];
    if (!e) return null;
    if (what === 'name') return e.name?.trim() || null;
    return e.desc?.[m[2] ?? ''] ?? null;
  };

  // The skills, at their highest level. Active ones: one row per level, Id = Class * 100 + Level. Passive ones: Id is the skill, Level apart.
  const top = (rows, key) => {
    const best = new Map();
    for (const r of rows) {
      const cur = best.get(r[key]);
      if (!cur || r.Level > cur.Level) best.set(r[key], r);
    }
    return best;
  };
  const activeRows = table(excel, 'skill_Skill', ['Id', 'Class', 'Level', 'MaxLevel', 'LC_N', 'LC_D', 'LC_D_REFINE', 'Param1', 'Param10', 'ShowEffect', 'TargetTag']);
  const passiveRows = table(excel, 'skill_Passive', ['Id', 'Level', 'MaxLevel', 'LC_N', 'LC_D', 'LC_D_REFINE', 'Param1', 'Param10', 'ShowEffect']);
  const actives = top(activeRows, 'Class');
  const passives = top(passiveRows, 'Id');
  /** Every level of a skill, lowest first. */
  const byLevel = (rows, key) => {
    const all = new Map();
    for (const r of rows) all.set(r[key], [...(all.get(r[key]) ?? []), r]);
    for (const list of all.values()) list.sort((x, y) => x.Level - y.Level);
    return all;
  };
  const activeLevels = byLevel(activeRows, 'Class');
  const passiveLevels = byLevel(passiveRows, 'Id');
  // The game's own words for a skill card: the names of the numbers in "Upgrade Preview" (one list for the file, the
  // skills point into it) and the underlined keywords with what they mean.
  const labels = [];
  const labelAt = new Map();
  const labelOf = (text) => {
    if (!labelAt.has(text)) labelAt.set(text, labels.push(text) - 1);
    return labelAt.get(text);
  };
  const words = {};

  const kinds = new Map();
  const skillOf = (id, slot) => {
    const a = actives.get(id);
    const p = passives.get(id);
    if (a && p) note(`skill ${id} is both an active and a passive skill: the ${slot === 1 ? 'active' : 'passive'} one is used`);
    const row = a && p ? (slot === 1 ? a : p) : a ?? p;
    if (!row) return null;
    const active = row === a;
    const name = skillText(row.LC_N, 'name');
    const raw = skillText(row.LC_D, 'desc');
    if (!name || raw == null) return null;
    const desc = clean(raw);
    const vals = {};
    for (const m of desc.matchAll(/\{([a-zA-Z]+)(\d+)\}/g)) {
      const [, kind, n] = m;
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
      const v = row[`Param${n}`];
      if (typeof v !== 'number') {
        note(`skill ${id} (${name}): {${kind}${n}} has no parameter`);
        continue;
      }
      vals[`${kind}${n}`] = num(kind === 's' ? v * 100 : v);
    }
    const brief = clean(skillText(row.LC_D_REFINE, 'desc') ?? '');
    const out = { id, name, active, desc, vals };
    // Param1 of an active skill is the Rage it costs, when the text does not use it for something else.
    if (active && !('p1' in vals) && !('s1' in vals) && row.Param1 >= 100 && row.Param1 <= 3000) out.rage = num(row.Param1);
    if (brief && brief !== desc) out.brief = brief;
    // "Target Type" of an active skill: 1 single, 2 area, 3 both (the game's TargetTag)
    if (active && row.TargetTag >= 1 && row.TargetTag <= 3) out.target = row.TargetTag;
    // "Upgrade Preview": ShowEffect is "<param>,<1 number | 2 percent>,<name key>;..." and each level has its row
    const levels = (active ? activeLevels.get(id) : passiveLevels.get(id)) ?? [row];
    const up = [];
    for (const part of String(row.ShowEffect ?? '').split(';')) {
      const m = /^(\d+),(\d),?(LC_[A-Z0-9_]+)$/.exec(part.trim());
      const label = m && T(m[3]);
      if (!m || !label) continue;
      const v = levels.map((r) => r[`Param${m[1]}`]).filter((x) => typeof x === 'number').map((x) => num(m[2] === '2' ? x * 100 : x));
      // n: the parameter, {p<n>} or {s<n>} in the text, so that the skill can be read at any level
      if (v.length > 1) up.push({ l: labelOf(label), n: Number(m[1]), v, ...(m[2] === '2' ? { p: 1 } : {}) });
    }
    if (up.length) out.up = up;
    // the underlined words: <href=LC_HERO_KEYWORD_EXP_<n>:1><color=color1>word</color></href>
    const kw = [];
    for (const m of raw.matchAll(/<href=LC_HERO_KEYWORD_EXP_(\d+)[^>]*>([\s\S]*?)<\/href>/g)) {
      const word = clean(m[2]);
      const meaning = T(`LC_HERO_KEYWORD_EXP_${m[1]}`);
      if (!word || !meaning || kw.some(([w]) => w === word)) continue;
      words[m[1]] = meaning;
      kw.push([word, Number(m[1])]);
    }
    if (kw.length) out.kw = kw;
    return out;
  };

  // The commanders: one row per star; the six-star row has every skill. Awakening (expertise) replaces a skill or adds a fifth.
  const heroRows = top(table(excel, 'hero_Hero', ['HeroID', 'Star', 'Tag', 'Rare', 'Display', 'Prime', 'Skill1', 'Skill2', 'Skill3', 'Skill4', 'Country', 'SortOrder']).map((h) => ({ ...h, Level: h.Star })), 'HeroID');
  const awake = new Map();
  for (const a of table(excel, 'hero_Awake', ['HeroID', 'Skill', 'AwakeTarget', 'Skill2', 'AwakeTarget2', 'Skill3', 'AwakeTarget3'])) {
    if (awake.has(a.HeroID)) note(`commander ${a.HeroID} has more than one awakening row: the last one is used`);
    awake.set(a.HeroID, a);
  }

  const commanders = [];
  let unnamed = 0;
  for (const h of [...heroRows.values()].sort((x, y) => x.HeroID - y.HeroID)) {
    if (h.Display !== 1) continue;
    const who = codex[String(h.HeroID)];
    if (!who?.name) {
      unnamed++;
      continue;
    }
    const slots = [h.Skill1, h.Skill2, h.Skill3, h.Skill4].map((id, i) => (id ? { id, slot: i + 1, awake: false } : null));
    const aw = awake.get(h.HeroID);
    if (aw) {
      for (const [sk, target] of [[aw.Skill, aw.AwakeTarget], [aw.Skill2, aw.AwakeTarget2], [aw.Skill3, aw.AwakeTarget3]]) {
        if (!sk) continue;
        // (an expertise that replaces a skill keeps the skill it replaces, for a commander without the expertise)
        if (target >= 1 && target <= 4) slots[target - 1] = { id: sk, slot: target, awake: true, before: slots[target - 1]?.id };
        else slots.push({ id: sk, slot: slots.length + 1, awake: true });
      }
    }
    const skills = [];
    for (const s of slots) {
      if (!s) continue;
      const sk = skillOf(s.id, s.slot);
      if (!sk) {
        note(`${who.name} (${h.HeroID}): skill ${s.id} has no text, left out`);
        continue;
      }
      const before = s.before && s.before !== s.id ? skillOf(s.before, s.slot) : null;
      skills.push({ ...sk, slot: s.slot, ...(s.awake ? { awake: true } : {}), ...(before ? { before } : {}) });
    }
    if (skills.length === 0) continue;
    const tags = String(h.Tag).split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
    const expertise = typeof texts.expertise?.[String(h.HeroID)] === 'string' ? texts.expertise[String(h.HeroID)].trim() : '';
    commanders.push({
      id: h.HeroID,
      name: who.name.trim(),
      ...(who.nickname?.trim() ? { nick: who.nickname.trim() } : {}),
      rarity: h.Rare,
      tags,
      ...(h.Prime ? { prime: true } : {}),
      civ: String(h.Country).replace(/^LC_COMMON_|^LC_HERO_CIVILIZATION_/, '').toLowerCase(),
      ...(expertise ? { expertise } : {}),
      skills,
    });
  }

  // The talent trees: one per talent tag. talent_map places the nodes of a tree (which talent, how many levels, what it
  // needs before it); talent_node has the numbers of a talent per level. Each node is given at its max level.
  const nodeTop = new Map();
  for (const n of table(excel, 'talent_node', ['ID', 'Lv', 'TextParam1', 'TextParam2', 'TextParam3', 'TextParam4'])) {
    const levels = nodeTop.get(n.ID) ?? new Map();
    levels.set(n.Lv, n);
    nodeTop.set(n.ID, levels);
  }
  const used = new Set(commanders.flatMap((c) => c.tags));
  const talents = {};
  let talentCount = 0;
  for (const m of table(excel, 'talent_map', ['ID', 'Node', 'Core', 'MaxLv', 'Condition', 'TreeIndex', 'TreeType']).sort((x, y) => x.ID - y.ID)) {
    if (!used.has(m.TreeType)) continue;
    const t = texts.talents?.[String(m.Node)];
    const row = nodeTop.get(m.Node)?.get(m.MaxLv);
    // (a "2" text, where there is one, is another wording of the same talent, not a second effect)
    const raw = t?.desc?.['1_UPDATE01'] ?? t?.desc?.['1'] ?? t?.desc?.['2'] ?? '';
    if (!t?.name || !raw || !row) {
      note(`talent ${m.ID} (node ${m.Node}) of tree ${m.TreeType} has no text or no numbers: kept as an empty step of the tree`);
    }
    const desc = clean(raw);
    const valsAt = (r, warn) => {
      const vals = {};
      for (const p of desc.matchAll(/\{([a-zA-Z]+)(\d+)\}/g)) {
        const v = r?.[`TextParam${p[2]}`];
        if (typeof v === 'number') vals[`${p[1]}${p[2]}`] = num(p[1] === 's' ? v * 100 : v);
        else if (warn) note(`talent ${m.ID} (${t?.name}): {${p[1]}${p[2]}} has no number`);
      }
      return vals;
    };
    const vals = valsAt(row, true);
    // the numbers at every level, for a tree where points are spent one by one
    const levels = m.MaxLv > 1 ? Array.from({ length: m.MaxLv }, (_, i) => valsAt(nodeTop.get(m.Node)?.get(i + 1), false)) : null;
    (talents[m.TreeType] ??= []).push({
      id: m.ID,
      name: t?.name?.trim() ?? '',
      ...(m.Core ? { core: true } : {}),
      max: m.MaxLv,
      needs: String(m.Condition).split(';').map(Number).filter((n) => n > 0),
      desc,
      vals,
      ...(levels && Object.keys(vals).length ? { levels } : {}),
    });
    talentCount++;
  }

  // ---- what the primary commander wears and carries -------------------------------------------------------
  // A bonus is a pair [buff id, value]: the id is the game's (3002 cavalry Attack, 10007 skill damage...), the value a
  // percentage. `buffs` keeps the game's name of every id used. Flat bonuses (base stats, a number of units) are left out.
  const buffRows = new Map(table(excel, 'buffcount_BuffCount', ['BuffId', 'Key', 'LC_N', 'Op']).map((b) => [b.BuffId, b]));
  const buffs = {};
  const bonus = (id, value) => {
    const row = buffRows.get(id);
    if (!id || !row || row.Op !== 2 || typeof value !== 'number' || value === 0) return null;      // (ids from 80000 up are skills and markers, not bonuses)
    buffs[id] ??= T(row.LC_N) ?? (row.Key !== 'none' ? row.Key.replace(/_/g, ' ') : `Buff ${id}`);
    return [id, num(value * 100)];
  };
  const bonuses = (row, n) => {
    const list = [];
    for (let i = 1; i <= n; i++) {
      const b = bonus(row[`BuffType${i}`], row[`BuffValue${i}`]);
      if (b) list.push(b);
    }
    return list;
  };
  /** A text with numbers of its own: "icon,colour,id,LC_KEY,number,number...". */
  const described = (spec, what) => {
    const parts = String(spec ?? '').split(',');
    const at = parts.findIndex((x) => /^LC_/.test(x));
    if (at < 0) return null;
    const raw = T(parts[at]);
    if (!raw) {
      note(`${what}: no text for ${parts[at]}`);
      return null;
    }
    // (equipment texts write "a {s1} chance": there the percent sign is part of the number)
    const desc = raw.replace(/\{s(\d+)\}(?!%)/g, '{s$1}%');
    const vals = {};
    for (const m of desc.matchAll(/\{([sp])(\d+)\}/g)) {
      const v = Number(parts[at + Number(m[2])]);
      if (Number.isFinite(v)) vals[`${m[1]}${m[2]}`] = num(m[1] === 's' ? v * 100 : v);
      else note(`${what}: {${m[1]}${m[2]}} has no number`);
    }
    return { desc, vals };
  };
  const filled = (raw, row, what, prefix = 'Param') => {
    const desc = clean(raw);
    const vals = {};
    for (const m of desc.matchAll(/\{([sp])(\d+)\}/g)) {
      const v = row[`${prefix}${m[2]}`];
      if (typeof v === 'number') vals[`${m[1]}${m[2]}`] = num(m[1] === 's' ? v * 100 : v);
      else note(`${what}: {${m[1]}${m[2]}} has no number`);
    }
    return { desc, vals };
  };

  // Equipment: legendary and epic pieces, as they come and with their special talent (30% more), with what each level
  // of awakening adds (the numbers again without and with the special talent).
  const withTalent = new Map(table(excel, 'equipment_talent', ['ID', 'BuffType1', 'BuffValue1', 'Skill_D']).map((r) => [r.ID, r]));
  const awakened = new Map();
  for (const a of table(excel, 'equipment_Awakebuff', ['EquipmentID', 'AwakeNum', 'BuffType', 'BlankBuffValue', 'TalentBuffValue', 'BlankSkill_D', 'TalentSkill_D', 'LC_Title'])) {
    const list = awakened.get(a.EquipmentID) ?? [];
    list.push(a);
    awakened.set(a.EquipmentID, list);
  }
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const gear = [];
  let unnamedGear = 0;
  for (const e of table(excel, 'equipment_equipment', ['ID', 'LC_N', 'Type', 'Quality', 'IsVisible', 'SuitGroup', 'ValidAwakeNum', 'BuffType1', 'BuffValue1', 'Skill_D', 'Skill_D2']).sort((x, y) => x.ID - y.ID)) {
    if (!e.IsVisible || e.Quality < 4) continue;
    const name = T(e.LC_N);
    if (!name) {
      unnamedGear++;
      continue;
    }
    // an artifact or a curio, worn by the secondary commander: it changes which unit type that commander's skills are for
    const marker = [1, 2, 3].map((i) => (e[`BuffType${i}`] === 80000 || e[`BuffType${i}`] === 80001 ? e[`BuffValue${i}`] : 0)).find(Boolean);
    const special = marker ? null : withTalent.get(e.ID) ?? null;
    const item = { id: e.ID, name, slot: e.Type, rarity: e.Quality, stats: bonuses(e, 3) };
    if (special) {
      const statsT = bonuses(special, 3);
      if (!same(statsT, item.stats)) item.statsT = statsT;
    }
    if (e.SuitGroup) item.set = e.SuitGroup;
    if (marker) item.second = marker;
    const skill = [described(e.Skill_D, name), described(e.Skill_D2, name)].filter(Boolean);
    if (skill.length > 1) note(`${name}: two skill texts, the first is kept`);
    if (skill.length) item.skill = skill[0];
    const skillT = special ? described(special.Skill_D, name) : null;
    if (skillT && !same(skillT, item.skill)) item.skillT = skillT;
    // (a piece can be awakened only up to its own number of levels: one for the gathering sets)
    if (e.ValidAwakeNum > 0) item.awakeMax = e.ValidAwakeNum;
    for (const a of (awakened.get(e.ID) ?? []).filter((x) => x.AwakeNum <= e.ValidAwakeNum).sort((x, y) => x.AwakeNum - y.AwakeNum)) {
      const plain = bonus(a.BuffType, a.BlankBuffValue);
      const better = bonus(a.BuffType, a.TalentBuffValue);
      if (plain && better) (item.awake ??= []).push([a.AwakeNum, plain[0], plain[1], better[1]]);
      else if (a.BuffType === 90000) {
        const p = described(a.BlankSkill_D, `${name} (awakened)`);
        const t = described(a.TalentSkill_D, `${name} (awakened)`);
        if (p || t) item.awakeSkill = { level: a.AwakeNum, name: T(a.LC_Title) ?? 'Awakened', plain: p ?? t, talent: t ?? p };
      }
    }
    gear.push(item);
  }
  const sets = [];
  for (const s of table(excel, 'equipment_suit', ['SuitGroup', 'SuitNum', 'LC_N', 'BuffType1', 'BuffValue1']).sort((x, y) => x.SuitGroup - y.SuitGroup || x.SuitNum - y.SuitNum)) {
    const name = T(s.LC_N);
    if (!name || !gear.some((g) => g.set === s.SuitGroup)) continue;
    let set = sets.find((x) => x.id === s.SuitGroup);
    if (!set) sets.push((set = { id: s.SuitGroup, name, steps: [] }));
    set.steps.push([s.SuitNum, bonuses(s, 3)]);
  }
  const gearSlots = {};
  for (const t of table(excel, 'equipment_type', ['ID', 'LC_N', 'Type'])) gearSlots[t.Type] ??= T(t.LC_N) ?? `Slot ${t.Type}`;

  // Formations, and the inscriptions of the armaments made for each of them.
  const formations = [];
  for (const f of table(excel, 'formation_formation', ['ID', 'Name', 'Desc', 'Show', 'Param1', 'Param2', 'Param3']).sort((x, y) => x.ID - y.ID)) {
    if (!f.Show) continue;
    const name = T(f.Name);
    const raw = T(f.Desc);
    if (!name || !raw) continue;
    // a second formation shown under a name already used is its newer set of armaments
    const again = formations.filter((x) => x.name === name || x.name.startsWith(`${name} `)).length;
    formations.push({ id: f.ID, name: again ? `${name} ${['II', 'III', 'IV'][again - 1] ?? again + 1}` : name, ...filled(raw, f, name) });
  }
  const shown = new Set(formations.map((f) => f.id));
  const inscriptions = [];
  for (const a of table(excel, 'formation_affix', ['Id', 'Type', 'Name', 'Desc', 'Rank', 'Slot', 'Show', 'Formation_Id', 'Param1', 'Param7']).sort((x, y) => x.Id - y.Id)) {
    if (!a.Show) continue;
    // Type 1 special, 2 rare (one of each per formation and armament), 0 common. Rank 0 commons are those of epic armaments.
    if (a.Type === 0 ? a.Rank !== 1 : !shown.has(a.Formation_Id)) continue;
    const m = /^LC_HERO_AFFIX_(\d+)_DESC(?:_(.+))?$/.exec(a.Desc);
    const t = m && texts.affixes?.[m[1]];
    const raw = t?.desc?.[m[2] ?? ''];
    if (!t?.name || !raw) {
      note(`inscription ${a.Id}: no text for ${a.Desc}, left out`);
      continue;
    }
    inscriptions.push({ id: a.Id, name: t.name.trim(), kind: a.Type === 1 ? 'special' : a.Type === 2 ? 'rare' : 'common', slot: a.Slot, ...(a.Formation_Id ? { formation: a.Formation_Id } : {}), ...filled(raw, a, t.name) });
  }
  // The three attribute lines of a legendary armament, per armament type: what each line can roll, at its highest.
  const pools = new Map();
  for (const g of table(excel, 'formation_gacha', ['PoolId', 'BuffType', 'BuffVal'])) {
    const p = pools.get(g.PoolId) ?? new Map();
    p.set(g.BuffType, Math.max(p.get(g.BuffType) ?? 0, g.BuffVal));
    pools.set(g.PoolId, p);
  }
  const lines = {};
  for (const w of table(excel, 'formation_warbook', ['Type', 'Quality', 'Formation', 'BuffPool1', 'BuffPool2', 'BuffPool3'])) {
    if (w.Quality !== 5 || !shown.has(w.Formation)) continue;
    const mine = (lines[w.Type] ??= [new Map(), new Map(), new Map()]);
    [w.BuffPool1, w.BuffPool2, w.BuffPool3].forEach((pool, i) => {
      for (const [id, v] of pools.get(pool) ?? []) mine[i].set(id, Math.max(mine[i].get(id) ?? 0, v));
    });
  }
  for (const slot of Object.keys(lines)) lines[slot] = lines[slot].map((line) => [...line].map(([id, v]) => bonus(id, v)).filter(Boolean).sort((x, y) => x[0] - y[0]));
  // (the game's own keys for the four armament types: book, instrument, flag, medal)
  const armamentSlots = { 1: 'Scroll', 2: 'Instrument', 3: 'Flag', 4: 'Emblem' };
  // ---- civilizations -------------------------------------------------------------------------------------------
  // A civilization brings a buff (its own, or another one chosen in the game) and its special units, which take the
  // place of the T4 and T5 of one unit type with stats of their own. The T5 of every unit type, for comparison.
  const training = new Map(table(excel, 'training_Training', ['Id', 'Hp', 'Atk', 'Def', 'Type', 'Tier', 'Speed', 'LC_N']).map((r) => [r.Id, r]));
  const statsOf = (r) => [r.Atk, r.Def, r.Hp, r.Speed];
  const t5 = {};
  for (const r of training.values()) if (r.Tier === 5 && r.Id < 100 && r.Type >= 1 && r.Type <= 4 && !t5[r.Type]) t5[r.Type] = statsOf(r);
  const civUnits = new Map();
  for (const u of table(excel, 'civilization_CivUnits', ['CivID', 'OriginalUnits', 'TargetUnits'])) {
    const r = training.get(u.TargetUnits);
    if (r?.Tier === 5) civUnits.set(u.CivID, { type: r.Type, name: T(r.LC_N) ?? `Unit ${r.Id}`, t5: statsOf(r) });
  }
  const civNames = new Map(table(excel, 'CivilizationChoose_Info', ['Id', 'Name', 'DefaultCivBuff']).map((r) => [r.Id, r]));
  const civs = [];
  for (const b of table(excel, 'civilization_CivBuff', ['ID', 'CivID', 'BuffTitle', 'BuffType1', 'BuffValue1', 'BuffType2', 'BuffValue2', 'BuffType3', 'BuffValue3', 'BuffType4', 'BuffValue4'])) {
    const info = civNames.get(b.CivID);
    const bonuses = [1, 2, 3, 4].map((i) => bonus(b[`BuffType${i}`], b[`BuffValue${i}`])).filter(Boolean);
    civs.push({ id: b.CivID, name: (info && T(info.Name)) ?? T(b.BuffTitle) ?? `Civilization ${b.CivID}`, buff: { title: T(b.BuffTitle) ?? '', bonuses }, ...(civUnits.get(b.CivID) ? { unit: civUnits.get(b.CivID) } : {}) });
  }

  const kit = { gearSlots, gear, sets, formations, armamentSlots, inscriptions, lines, buffs, civs, t5 };

  const day = (p) => statSync(p).mtime.toISOString().slice(0, 10);
  const out = {
    v: 3,
    generated: new Date().toISOString().slice(0, 16),
    sources: { config: day(EXCEL), texts: day(TEXTS) },
    commanders,
    talents,
    kit,
    labels,
    words,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));

  const by = (f) => commanders.reduce((m, c) => m.set(f(c), (m.get(f(c)) ?? 0) + 1), new Map());
  console.log(`${excel.tables.size} tables read; ${commanders.length} commanders (${unnamed} shown by the game but without an English name were left out), ${Object.keys(talents).length} talent trees with ${talentCount} talents`);
  console.log('by rarity:', Object.fromEntries([...by((c) => c.rarity)].sort()), '| skills per commander:', Object.fromEntries([...by((c) => c.skills.length)].sort()));
  console.log('placeholders:', Object.fromEntries(kinds));
  console.log(`kit: ${gear.length} pieces of equipment (${unnamedGear} without an English name left out), ${sets.length} sets, ${formations.length} formations, ${inscriptions.length} inscriptions, ${Object.keys(buffs).length} kinds of bonus`);
  console.log('text tables:', [...lc.used].map(([name, path]) => `lc_${name} (${path.replace(/\\/g, '/').split('/').slice(-2, -1)[0]})`).join(', ') || 'none');
  console.log(`${notes.length} notes` + (verbose || notes.length <= 12 ? ':' : ' (--verbose lists them all), the first 12:'));
  for (const m of verbose ? notes : notes.slice(0, 12)) console.log('  -', m);
  console.log(`-> ${OUT} (${Math.round(statSync(OUT).size / 1024)} KB)`);
}

main();
