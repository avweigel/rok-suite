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

const ZONE_LEADERS: Record<string, number> = {
  'Soutz': 1,
  'Sysstm': 2,
  'Fluffy': 2,
  'Suntzu': 3,
};

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
    roster.push({ name: values[nameIdx].trim(), power: parseInt(values[powerIdx]) || 0 });
  }

  // Sort and take top 30
  const top30 = roster.sort((a, b) => b.power - a.power).slice(0, 30);

  // Build players
  const players: Player[] = [];
  const assignedNames = new Set<string>();
  let id = Date.now();

  // Add leaders first
  for (const entry of top30) {
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

  // Count and assign rest
  const zoneCounts = [0, 0, 0];
  players.forEach(p => zoneCounts[p.team - 1]++);
  let currentZone = 1;

  for (const entry of top30) {
    if (assignedNames.has(entry.name)) continue;
    while (zoneCounts[currentZone - 1] >= 10) {
      currentZone++;
      if (currentZone > 3) currentZone = 1;
    }
    players.push({
      id: id++,
      name: entry.name,
      team: currentZone,
      tags: [],
      power: entry.power,
      assignments: { phase1: '', phase2: '', phase3: '', phase4: '' },
    });
    zoneCounts[currentZone - 1]++;
    assignedNames.add(entry.name);
    currentZone++;
    if (currentZone > 3) currentZone = 1;
  }

  // Add Teleport 1st to top 5 (first obelisk capture = 5 teleports)
  // Add Teleport 2nd to next 5 (positions 6-10)
  const sortedByPower = [...players].sort((a, b) => b.power - a.power);
  const top5 = new Set(sortedByPower.slice(0, 5).map(p => p.name));
  const next5 = new Set(sortedByPower.slice(5, 10).map(p => p.name));
  for (const p of players) {
    if (top5.has(p.name) && !p.tags.includes('Teleport 1st')) {
      p.tags.push('Teleport 1st');
    }
    if (next5.has(p.name) && !p.tags.includes('Teleport 2nd')) {
      p.tags.push('Teleport 2nd');
    }
  }

  // Get existing mapAssignments
  const { data: existingData } = await supabase.from('aoo_strategy').select('*').limit(1).maybeSingle();

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

  // Output SQL - escape single quotes for PostgreSQL
  const jsonStr = JSON.stringify(strategyData).replace(/'/g, "''");
  console.log('-- Copy and run this in Supabase SQL Editor:\n');
  console.log(`UPDATE aoo_strategy SET data = '${jsonStr}'::jsonb WHERE id = 1;`);
}

main();
