'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from './client';
import type {
  EventCategory,
  GameEvent,
  EventWithDetails,
  EventStrategy,
  EventChecklist,
  ChecklistItem,
  AlliancePage,
  GuardianSchedule,
  UserChecklistProgress,
  CreateEventInput,
  UpdateEventInput,
  CreateStrategyInput,
  UpdateStrategyInput,
  CreateChecklistInput,
  UpdateAlliancePageInput,
  UpdateGuardianScheduleInput,
  Profile,
  UserRole,
} from './types';

// =============================================================================
// USER ROLE HOOK
// =============================================================================

export function useUserRole() {
  const [role, setRole] = useState<UserRole>('member');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRole('member');
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setRole((profile?.role as UserRole) || 'member');
      setLoading(false);
    }

    fetchRole();
  }, []);

  const isLeaderOrAdmin = role === 'leader' || role === 'admin';
  const isOfficerOrAbove = role === 'officer' || isLeaderOrAdmin;

  return { role, loading, isLeaderOrAdmin, isOfficerOrAbove };
}

// =============================================================================
// EVENT CATEGORIES HOOK
// =============================================================================

export function useEventCategories() {
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchCategories() {
      const { data, error } = await supabase
        .from('event_categories')
        .select('*')
        .order('sort_order');

      if (error) {
        setError(error.message);
      } else {
        setCategories(data || []);
      }
      setLoading(false);
    }

    fetchCategories();
  }, []);

  return { categories, loading, error };
}

// =============================================================================
// EVENTS HOOK
// =============================================================================

export function useEvents(categorySlug?: string) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchEvents() {
      let query = supabase
        .from('events')
        .select(`
          *,
          category:event_categories(*)
        `)
        .order('sort_order');

      if (categorySlug) {
        // First get the category ID
        const { data: category } = await supabase
          .from('event_categories')
          .select('id')
          .eq('slug', categorySlug)
          .single();

        if (category) {
          query = query.eq('category_id', category.id);
        }
      }

      const { data, error } = await query;

      if (error) {
        setError(error.message);
      } else {
        setEvents(data || []);
      }
      setLoading(false);
    }

    fetchEvents();
  }, [categorySlug]);

  return { events, loading, error };
}

// =============================================================================
// SINGLE EVENT HOOK
// =============================================================================

export function useEvent(slug: string) {
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        category:event_categories(*),
        strategies:event_strategies(*),
        checklists:event_checklists(
          *,
          items:checklist_items(*)
        )
      `)
      .eq('slug', slug)
      .single();

    if (error) {
      setError(error.message);
      setEvent(null);
    } else {
      setEvent(data as EventWithDetails);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { event, loading, error, refresh };
}

// =============================================================================
// EVENT MUTATIONS
// =============================================================================

export function useEventMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEvent = useCallback(async (input: CreateEventInput) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('events')
      .insert(input)
      .select()
      .single();

    setLoading(false);
    if (error) {
      setError(error.message);
      return null;
    }
    return data as GameEvent;
  }, []);

  const updateEvent = useCallback(async (id: string, input: UpdateEventInput) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('events')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    setLoading(false);
    if (error) {
      setError(error.message);
      return null;
    }
    return data as GameEvent;
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    setLoading(false);
    if (error) {
      setError(error.message);
      return false;
    }
    return true;
  }, []);

  return { createEvent, updateEvent, deleteEvent, loading, error };
}

// =============================================================================
// STRATEGY MUTATIONS
// =============================================================================

export function useStrategyMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createStrategy = useCallback(async (input: CreateStrategyInput) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('event_strategies')
      .insert({
        ...input,
        author_id: user?.id,
      })
      .select()
      .single();

    setLoading(false);
    if (error) {
      setError(error.message);
      return null;
    }
    return data as EventStrategy;
  }, []);

  const updateStrategy = useCallback(async (id: string, input: UpdateStrategyInput) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('event_strategies')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    setLoading(false);
    if (error) {
      setError(error.message);
      return null;
    }
    return data as EventStrategy;
  }, []);

  const deleteStrategy = useCallback(async (id: string) => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    const { error } = await supabase
      .from('event_strategies')
      .delete()
      .eq('id', id);

    setLoading(false);
    if (error) {
      setError(error.message);
      return false;
    }
    return true;
  }, []);

  return { createStrategy, updateStrategy, deleteStrategy, loading, error };
}

// =============================================================================
// CHECKLIST HOOKS
// =============================================================================

export function useChecklistProgress(checklistId: string) {
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchProgress() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('user_checklist_progress')
        .select('checklist_item_id')
        .eq('user_id', user.id);

      if (data) {
        setCompletedItems(new Set(data.map(p => p.checklist_item_id)));
      }
      setLoading(false);
    }

    fetchProgress();
  }, [checklistId]);

  const toggleItem = useCallback(async (itemId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isCompleted = completedItems.has(itemId);

    if (isCompleted) {
      await supabase
        .from('user_checklist_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('checklist_item_id', itemId);

      setCompletedItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    } else {
      await supabase
        .from('user_checklist_progress')
        .insert({
          user_id: user.id,
          checklist_item_id: itemId,
        });

      setCompletedItems(prev => new Set(prev).add(itemId));
    }
  }, [completedItems]);

  const resetChecklist = useCallback(async (itemIds: string[]) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('user_checklist_progress')
      .delete()
      .eq('user_id', user.id)
      .in('checklist_item_id', itemIds);

    setCompletedItems(new Set());
  }, []);

  return { completedItems, loading, toggleItem, resetChecklist };
}

// =============================================================================
// ALLIANCE PAGES HOOK
// =============================================================================

export function useAlliancePages() {
  const [pages, setPages] = useState<AlliancePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchPages() {
      const { data, error } = await supabase
        .from('alliance_pages')
        .select('*')
        .order('sort_order');

      if (error) {
        setError(error.message);
      } else {
        setPages(data || []);
      }
      setLoading(false);
    }

    fetchPages();
  }, []);

  return { pages, loading, error };
}

export function useAlliancePage(slug: string) {
  const [page, setPage] = useState<AlliancePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    const { data, error } = await supabase
      .from('alliance_pages')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      setError(error.message);
      setPage(null);
    } else {
      setPage(data as AlliancePage);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updatePage = useCallback(async (input: UpdateAlliancePageInput) => {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('alliance_pages')
      .update({
        ...input,
        author_id: user?.id,
      })
      .eq('slug', slug)
      .select()
      .single();

    if (error) {
      setError(error.message);
      return null;
    }

    setPage(data as AlliancePage);
    return data as AlliancePage;
  }, [slug]);

  return { page, loading, error, refresh, updatePage };
}

// =============================================================================
// GUARDIAN SCHEDULE HOOK
// =============================================================================

export function useGuardianSchedule() {
  const [schedule, setSchedule] = useState<GuardianSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    const { data, error } = await supabase
      .from('guardian_schedule')
      .select('*')
      .single();

    if (error) {
      setError(error.message);
      setSchedule(null);
    } else {
      setSchedule(data as GuardianSchedule);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateSchedule = useCallback(async (input: UpdateGuardianScheduleInput) => {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('guardian_schedule')
      .update({
        ...input,
        updated_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      return null;
    }

    setSchedule(data as GuardianSchedule);
    return data as GuardianSchedule;
  }, []);

  return { schedule, loading, error, refresh, updateSchedule };
}
