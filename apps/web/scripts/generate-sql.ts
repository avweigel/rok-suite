/**
 * Generate SQL to update aoo_strategy table
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Player {
  id: number;
  name: string;
  team: number;
  tags: string[];
  power: number;
  assignments: { phase1: string; phase2: string; phase3: string; phase4: string };
}

// Zone leaders configuration
const ZONE_LEADERS: Record<string, number> = {
  'Soutz': 1,
  'Sysstm': 2,
  'Fluffy': 2,
  'Suntzu': 3,
};

// Manual zone overrides (player name -> zone number)
const ZONE_OVERRIDES: Record<string, number> = {
  'aubs': 1,      // Put aubs on Soutz's team (Zone 1)
  'BBQSGE': 3,    // Put BBQSGE on Suntzu's team (Zone 3)
  'Calca': 3,     // Swap Calca to Zone 3 with Suntzu
  'Vaelstrom': 1, // Swap Vaelstrom to Zone 1
};

// Players to exclude from main roster (moved to substitutes or removed)
const EXCLUDE_FROM_ROSTER = new Set(['KKTowMater2', 'bear']);

// Players to add as substitutes (not removed, just benched)
const ADD_TO_SUBSTITUTES = new Set(['KKTowMater2']);

// Players removed from alliance entirely
const REMOVED_FROM_ALLIANCE = new Set(['bear']);

// Manual first teleport additions (use this to force specific players into 1st wave)
const FORCE_TELEPORT_1ST = new Set<string>(['Calca']);

// Players to exclude from first teleport (bumped to 2nd wave)
const EXCLUDE_FROM_TELEPORT_1ST = new Set<string>(['SmokinLizard']);

async function main() {
  // Parse CSV
  const csvPath = path.join(__dirname, '../data/roster.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  const powerIdx = header.indexOf('power');

  const roster: { name: string; power: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].trim().split(',');
    if (!values[nameIdx]) continue;
    const name = values[nameIdx].trim();
    // Skip players removed from alliance
    if (REMOVED_FROM_ALLIANCE.has(name)) continue;
    roster.push({ name, power: parseInt(values[powerIdx]) || 0 });
  }

  // Sort by power
  const sortedRoster = roster.sort((a, b) => b.power - a.power);

  // Take top 30 for main roster, excluding substitutes
  const mainRoster = sortedRoster.filter(p => !ADD_TO_SUBSTITUTES.has(p.name)).slice(0, 30);

  // Substitutes: players marked for substitutes + next players after 30
  const substituteEntries = sortedRoster.filter(p => ADD_TO_SUBSTITUTES.has(p.name));
  const additionalSubs = sortedRoster.filter(p => !ADD_TO_SUBSTITUTES.has(p.name)).slice(30, 40);
  const allSubEntries = [...substituteEntries, ...additionalSubs].sort((a, b) => b.power - a.power);

  // Build players
  const players: Player[] = [];
  const assignedNames = new Set<string>();
  let id = Date.now();

  // Add leaders first
  for (const entry of mainRoster) {
    if (ZONE_LEADERS[entry.name] !== undefined) {
      players.push({
        id: id++,
        name: entry.name,
        team: ZONE_LEADERS[entry.name],
        tags: ['Rally Leader'],
        power: entry.power,
        assignments: { phase1: '', phase2: '', phase3: '', phase4: '' },
      });
      assignedNames.add(entry.name);
    }
  }

  // Zone 2 is ONLY for Sysstm and Fluffy
  // All other players go to Zone 1 or Zone 3 (14 each)
  const zone1Target = 14;
  const zone3Target = 14;
  let zone1Count = players.filter(p => p.team === 1).length;
  let zone3Count = players.filter(p => p.team === 3).length;
  let currentZone = 1; // Alternate between 1 and 3

  for (const entry of mainRoster) {
    if (assignedNames.has(entry.name)) continue;

    // Check for manual zone override
    if (ZONE_OVERRIDES[entry.name] !== undefined) {
      const zone = ZONE_OVERRIDES[entry.name];
      players.push({
        id: id++,
        name: entry.name,
        team: zone,
        tags: [],
        power: entry.power,
        assignments: { phase1: '', phase2: '', phase3: '', phase4: '' },
      });
      if (zone === 1) zone1Count++;
      else if (zone === 3) zone3Count++;
      assignedNames.add(entry.name);
      continue;
    }

    // Assign to Zone 1 or Zone 3 (skip Zone 2)
    if (currentZone === 1 && zone1Count < zone1Target) {
      players.push({
        id: id++,
        name: entry.name,
        team: 1,
        tags: [],
        power: entry.power,
        assignments: { phase1: '', phase2: '', phase3: '', phase4: '' },
      });
      zone1Count++;
      currentZone = 3;
    } else if (zone3Count < zone3Target) {
      players.push({
        id: id++,
        name: entry.name,
        team: 3,
        tags: [],
        power: entry.power,
        assignments: { phase1: '', phase2: '', phase3: '', phase4: '' },
      });
      zone3Count++;
      currentZone = 1;
    } else if (zone1Count < zone1Target) {
      players.push({
        id: id++,
        name: entry.name,
        team: 1,
        tags: [],
        power: entry.power,
        assignments: { phase1: '', phase2: '', phase3: '', phase4: '' },
      });
      zone1Count++;
    }
    assignedNames.add(entry.name);
  }

  // Add Teleport 1st to top 8 (first obelisk capture = 8 teleports per patch 1.0.42)
  // Add Teleport 2nd to next 8 (positions 9-16)
  // Respect FORCE_TELEPORT_1ST and EXCLUDE_FROM_TELEPORT_1ST overrides
  const sortedByPower = [...players].sort((a, b) => b.power - a.power);

  // Build top 8: start with power ranking, remove exclusions, add forced
  const top8Names = new Set<string>();
  let added = 0;
  for (const p of sortedByPower) {
    if (added >= 8) break;
    if (EXCLUDE_FROM_TELEPORT_1ST.has(p.name)) continue;
    top8Names.add(p.name);
    added++;
  }
  // Add forced first teleporters
  FORCE_TELEPORT_1ST.forEach(name => top8Names.add(name));

  // Build next 8: those excluded from 1st + next by power
  const next8Names = new Set<string>();
  // Add excluded players to 2nd wave
  EXCLUDE_FROM_TELEPORT_1ST.forEach(name => next8Names.add(name));
  // Fill remaining spots from power ranking
  for (const p of sortedByPower) {
    if (next8Names.size >= 8) break;
    if (top8Names.has(p.name)) continue;
    if (next8Names.has(p.name)) continue;
    next8Names.add(p.name);
  }

  for (const p of players) {
    if (top8Names.has(p.name) && !p.tags.includes('Teleport 1st')) {
      p.tags.push('Teleport 1st');
    }
    if (next8Names.has(p.name) && !p.tags.includes('Teleport 2nd')) {
      p.tags.push('Teleport 2nd');
    }
  }

  // Build substitutes list
  const substitutes: Player[] = allSubEntries.map(entry => ({
    id: id++,
    name: entry.name,
    team: 0,
    tags: [],
    power: entry.power,
    assignments: { phase1: '', phase2: '', phase3: '', phase4: '' },
  }));

  // Get existing mapAssignments
  const { data: existingData } = await supabase.from('aoo_strategy').select('*').limit(1).maybeSingle();

  const strategyData = {
    players,
    teams: [
      { name: 'Zone 1', description: 'Bottom / Left Side' },
      { name: 'Zone 2', description: 'Ark / Center (Flex Support)' },
      { name: 'Zone 3', description: 'Upper / Right Side' },
    ],
    substitutes,
    notes: '',
    mapImage: null,
    mapAssignments: existingData?.data?.mapAssignments || {},
  };

  // Output SQL - escape single quotes for PostgreSQL
  const jsonStr = JSON.stringify(strategyData).replace(/'/g, "''");
  console.log('-- Copy and run this in Supabase SQL Editor:\n');
  console.log(`UPDATE aoo_strategy SET data = '${jsonStr}'::jsonb WHERE id = 1;`);
}

main();
