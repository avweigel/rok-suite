'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import { createClient } from './client';
import { Commander, UserCommander } from '@/lib/sunset-canyon/commanders';

interface UseCommandersReturn {
  commanders: UserCommander[];
  loading: boolean;
  error: string | null;
  cityHallLevel: number;
  setCityHallLevel: (level: number) => Promise<void>;
  addCommander: (commander: Commander, level: number, skillLevels: number[], stars: number) => Promise<void>;
  updateCommander: (uniqueId: string, updates: { level?: number; skillLevels?: number[]; stars?: number }) => Promise<void>;
  removeCommander: (uniqueId: string) => Promise<void>;
  clearAllCommanders: () => Promise<void>;
  refreshCommanders: () => Promise<void>;
}

// For non-logged-in users, use localStorage
const LOCAL_STORAGE_KEY = 'sunset-canyon-commanders';
const LOCAL_STORAGE_SETTINGS_KEY = 'sunset-canyon-settings';

export function useCommanders(): UseCommandersReturn {
  const { user } = useAuth();
  const [commanders, setCommanders] = useState<UserCommander[]>([]);
  const [cityHallLevel, setCityHallLevelState] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Load commanders from Supabase or localStorage
  const loadCommanders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (user) {
        // Load from Supabase
        const { data: commandersData, error: commandersError } = await supabase
          .from('user_commanders')
          .select('*')
          .eq('user_id', user.id);

        if (commandersError) throw commandersError;

        const mapped: UserCommander[] = (commandersData || []).map((c) => ({
          uniqueId: c.id,
          id: c.commander_id,
          name: c.name,
          rarity: c.rarity as 'legendary' | 'epic' | 'elite' | 'advanced',
          troopType: c.troop_type as 'infantry' | 'cavalry' | 'archer' | 'mixed',
          level: c.level,
          stars: c.stars,
          skillLevels: c.skill_levels,
          role: c.role || [],
          baseStats: { attack: 0, defense: 0, health: 0, marchSpeed: 0 },
          skills: [],
          synergies: [],
          talentPoints: 0,
          equipmentBonus: { attack: 0, defense: 0, health: 0 },
        }));

        setCommanders(mapped);

        // Load profile for city hall level
        const { data: profile } = await supabase
          .from('profiles')
          .select('city_hall_level')
          .eq('id', user.id)
          .single();

        if (profile?.city_hall_level) {
          setCityHallLevelState(profile.city_hall_level);
        }
      } else {
        // Load from localStorage
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          setCommanders(JSON.parse(stored));
        }
        const settings = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
        if (settings) {
          const parsed = JSON.parse(settings);
          setCityHallLevelState(parsed.cityHallLevel || 25);
        }
      }
    } catch (err) {
      console.error('Failed to load commanders:', err);
      setError('Failed to load commanders');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadCommanders();
  }, [loadCommanders]);

  // Save to localStorage when commanders change (for non-logged-in users)
  useEffect(() => {
    if (!user && !loading) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(commanders));
    }
  }, [commanders, user, loading]);

  const setCityHallLevel = async (level: number) => {
    setCityHallLevelState(level);

    if (user) {
      await supabase
        .from('profiles')
        .update({ city_hall_level: level })
        .eq('id', user.id);
    } else {
      const settings = { cityHallLevel: level };
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    }
  };

  const addCommander = async (
    commander: Commander,
    level: number,
    skillLevels: number[],
    stars: number
  ) => {
    const newCommander: UserCommander = {
      ...commander,
      uniqueId: `${commander.id}-${Date.now()}`,
      level,
      skillLevels,
      stars,
      talentPoints: 0,
      equipmentBonus: { attack: 0, defense: 0, health: 0 },
    };

    if (user) {
      const { data, error } = await supabase
        .from('user_commanders')
        .insert({
          user_id: user.id,
          commander_id: commander.id,
          name: commander.name,
          rarity: commander.rarity,
          troop_type: commander.troopType,
          level,
          stars,
          skill_levels: skillLevels,
          role: commander.role,
        })
        .select()
        .single();

      if (error) {
        // If duplicate, just log warning
        if (error.code === '23505') {
          console.warn('Commander already exists');
          return;
        }
        throw error;
      }

      newCommander.uniqueId = data.id;
    }

    setCommanders((prev) => [...prev, newCommander]);
  };

  const updateCommander = async (
    uniqueId: string,
    updates: { level?: number; skillLevels?: number[]; stars?: number }
  ) => {
    setCommanders((prev) =>
      prev.map((c) => (c.uniqueId === uniqueId ? { ...c, ...updates } : c))
    );

    if (user) {
      const supabaseUpdates: Record<string, unknown> = {};
      if (updates.level !== undefined) supabaseUpdates.level = updates.level;
      if (updates.skillLevels !== undefined) supabaseUpdates.skill_levels = updates.skillLevels;
      if (updates.stars !== undefined) supabaseUpdates.stars = updates.stars;

      await supabase
        .from('user_commanders')
        .update(supabaseUpdates)
        .eq('id', uniqueId);
    }
  };

  const removeCommander = async (uniqueId: string) => {
    setCommanders((prev) => prev.filter((c) => c.uniqueId !== uniqueId));

    if (user) {
      await supabase.from('user_commanders').delete().eq('id', uniqueId);
    }
  };

  const clearAllCommanders = async () => {
    setCommanders([]);

    if (user) {
      await supabase.from('user_commanders').delete().eq('user_id', user.id);
    }
  };

  return {
    commanders,
    loading,
    error,
    cityHallLevel,
    setCityHallLevel,
    addCommander,
    updateCommander,
    removeCommander,
    clearAllCommanders,
    refreshCommanders: loadCommanders,
  };
}
