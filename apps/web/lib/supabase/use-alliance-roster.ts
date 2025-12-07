import { useState, useEffect, useCallback } from 'react';
import { createClient } from './client';

export interface RosterMember {
  id: string;
  name: string;
  power: number;
  kills: number;
  deads: number;
  tier: string | null;
  role: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UseAllianceRosterReturn {
  roster: RosterMember[];
  rosterNames: string[];
  powerByName: Record<string, number>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAllianceRoster(): UseAllianceRosterReturn {
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('alliance_roster')
        .select('*')
        .eq('is_active', true)
        .order('power', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setRoster(data || []);
    } catch (err) {
      console.error('Error fetching roster:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch roster');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  // Compute derived values
  const rosterNames = roster
    .map((m) => m.name)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const powerByName = roster.reduce(
    (acc, member) => {
      acc[member.name] = member.power;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    roster,
    rosterNames,
    powerByName,
    loading,
    error,
    refetch: fetchRoster,
  };
}

// Utility to format power with M suffix
export const formatPower = (power: number): string => {
  if (power >= 1000000) {
    return (power / 1000000).toFixed(1) + 'M';
  }
  return power.toLocaleString();
};
