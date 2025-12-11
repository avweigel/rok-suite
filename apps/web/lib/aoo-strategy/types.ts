export type EventMode = 'main' | 'training';

export interface PlayerAssignments {
  phase1: string;
  phase2: string;
  phase3: string;
  phase4: string;
}

export interface Player {
  id: number;
  name: string;
  team: number;
  tags: string[];
  power?: number;
  assignments?: PlayerAssignments;
}

export interface Team {
  name: string;
  description: string;
}

export interface MapAssignment {
  team: number;
  order: number;
}

export interface MapAssignments {
  [key: string]: MapAssignment;
}

export interface StrategyData {
  players: Player[];
  teams: Team[];
  substitutes: Player[];
  notes: string;
  mapImage: string | null;
  mapAssignments: MapAssignments;
}
