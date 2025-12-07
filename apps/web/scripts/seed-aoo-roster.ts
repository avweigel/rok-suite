/**
 * Seed AoO Strategy with top 30 players by power
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL="..." NEXT_PUBLIC_SUPABASE_ANON_KEY="..." npx tsx apps/web/scripts/seed-aoo-roster.ts
 *
 * Ark of Osiris Rules:
 *   - 30 players per alliance
 *   - First obelisk capture gives 5 teleports
 *   - Top 5 players by power should teleport first
 *   - Obelisks generate 2 additional teleports every 5 minutes
 *
 * Leaders:
 *   Zone 1: Soutz
 *   Zone 2: Sysstm & Fluffy (center/flex)
 *   Zone 3: Suntzu
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface RosterEntry {
  name: string;
  power: number;
  rank: string;
}

interface Player {
  id: number;
  name: string;
  team: number;
  tags: string[];
  power: number;
  assignments: { phase1: string; phase2: string; phase3: string; phase4: string };
}

// Zone leaders configuration - these get Rally Leader tag
const ZONE_LEADERS: Record<string, number> = {
  'Soutz': 1,
  'Sysstm': 2,
  'Fluffy': 2,
  'Suntzu': 3,
};

function parseCSV(content: string): RosterEntry[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  const powerIdx = header.indexOf('power');
  const rankIdx = header.indexOf('rank') !== -1 ? header.indexOf('rank') : header.indexOf('role');

  if (nameIdx === -1) {
    throw new Error('CSV must have a "name" column');
  }

  const rows: RosterEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());
    const name = values[nameIdx];
    if (!name) continue;

    rows.push({
      name,
      power: powerIdx !== -1 ? parseInt(values[powerIdx], 10) || 0 : 0,
      rank: rankIdx !== -1 ? values[rankIdx] || '' : '',
    });
  }

  return rows;
}

async function seedRoster() {
  // Read roster CSV
  const csvPath = path.join(__dirname, '../data/roster.csv');
  console.log(`Reading roster from: ${csvPath}`);

  const content = fs.readFileSync(csvPath, 'utf-8');
  const roster = parseCSV(content);

  console.log(`Found ${roster.length} players in roster`);

  // Sort by power descending and take top 30
  const sortedRoster = [...roster].sort((a, b) => b.power - a.power);
  const top30 = sortedRoster.slice(0, 30);

  console.log('\nTop 30 players by power:');
  top30.forEach((p, i) => {
    const powerM = (p.power / 1000000).toFixed(1);
    console.log(`  ${i + 1}. ${p.name}: ${powerM}M`);
  });

  // Assign zones: distribute evenly, but ensure leaders are in their zones
  // Zone 1: 10 players, Zone 2: 10 players (center/flex), Zone 3: 10 players
  const players: Player[] = [];
  const leaderNames = Object.keys(ZONE_LEADERS);

  // First, add leaders to their zones
  const assignedNames = new Set<string>();
  for (const entry of top30) {
    const leaderZone = ZONE_LEADERS[entry.name];
    if (leaderZone !== undefined) {
      players.push({
        id: Date.now() + players.length,
        name: entry.name,
        team: leaderZone,
        tags: ['Rally Leader'],  // Leaders get Rally Leader tag
        power: entry.power,
        assignments: { phase1: '', phase2: '', phase3: '', phase4: '' },
      });
      assignedNames.add(entry.name);
    }
  }

  // Count players per zone
  const zoneCounts = [0, 0, 0];
  players.forEach(p => zoneCounts[p.team - 1]++);

  // Assign remaining players to zones (10 each)
  const TARGET_PER_ZONE = 10;
  let currentZone = 1;

  for (const entry of top30) {
    if (assignedNames.has(entry.name)) continue;

    // Find a zone that needs more players
    while (zoneCounts[currentZone - 1] >= TARGET_PER_ZONE) {
      currentZone++;
      if (currentZone > 3) currentZone = 1;
    }

    players.push({
      id: Date.now() + players.length,
      name: entry.name,
      team: currentZone,
      tags: [],
      power: entry.power,
      assignments: { phase1: '', phase2: '', phase3: '', phase4: '' },
    });
    zoneCounts[currentZone - 1]++;
    assignedNames.add(entry.name);

    // Move to next zone for round-robin distribution
    currentZone++;
    if (currentZone > 3) currentZone = 1;
  }

  // Add "Teleport 1st" tag to top 5 players by power (first obelisk gives 5 teleports)
  const sortedByPower = [...players].sort((a, b) => b.power - a.power);
  const top5Names = new Set(sortedByPower.slice(0, 5).map(p => p.name));

  for (const player of players) {
    if (top5Names.has(player.name)) {
      if (!player.tags.includes('Teleport 1st')) {
        player.tags.push('Teleport 1st');
      }
    }
  }

  console.log('\n🚀 TOP 5 TELEPORT FIRST (first obelisk = 5 teleports):');
  sortedByPower.slice(0, 5).forEach((p, i) => {
    const powerM = (p.power / 1000000).toFixed(1);
    console.log(`  ${i + 1}. ${p.name}: ${powerM}M (Zone ${p.team})`);
  });

  console.log('\nZone assignments (sorted by power):');
  for (let zone = 1; zone <= 3; zone++) {
    const zonePlayers = players.filter(p => p.team === zone).sort((a, b) => b.power - a.power);
    const leader = zonePlayers.find(p => leaderNames.includes(p.name));
    console.log(`\nZone ${zone} (${zonePlayers.length} players):`);
    if (leader) console.log(`  Leader: ${leader.name}`);
    zonePlayers.forEach(p => {
      const powerM = (p.power / 1000000).toFixed(1);
      const isLeader = leaderNames.includes(p.name);
      const isTp1st = top5Names.has(p.name);
      const prefix = isLeader ? '👑 ' : isTp1st ? '🚀 ' : '   ';
      console.log(`    ${prefix}${p.name}: ${powerM}M${p.tags.length ? ` [${p.tags.join(', ')}]` : ''}`);
    });
  }

  // Update Supabase
  console.log('\nUpdating Supabase...');

  // First, get existing strategy data
  const { data: existingData, error: fetchError } = await supabase
    .from('aoo_strategy')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching existing data:', fetchError);
    process.exit(1);
  }

  const strategyData = {
    players,
    teams: [
      { name: 'Zone 1', description: 'Bottom / Left Side' },
      { name: 'Zone 2', description: 'Ark / Center (Flex Support)' },
      { name: 'Zone 3', description: 'Upper / Right Side' },
    ],
    substitutes: [],
    notes: '',
    mapImage: null,
    mapAssignments: existingData?.data?.mapAssignments || {},
  };

  if (existingData) {
    // Update existing record
    const { error } = await supabase
      .from('aoo_strategy')
      .update({ data: strategyData })
      .eq('id', existingData.id);

    if (error) {
      console.error('Error updating data:', error);
      process.exit(1);
    }
    console.log('Updated existing strategy record');
  } else {
    // Insert new record
    const { error } = await supabase
      .from('aoo_strategy')
      .insert([{ data: strategyData }]);

    if (error) {
      console.error('Error inserting data:', error);
      process.exit(1);
    }
    console.log('Created new strategy record');
  }

  console.log('\nDone! 30 players assigned to zones.');
}

seedRoster();
