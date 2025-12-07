'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from './client';

// =============================================================================
// TYPES
// =============================================================================

export interface TrainingPoll {
  id: string;
  title: string;
  description: string | null;
  poll_type: 'training' | 'event' | 'other';
  time_slots: string[];
  training_date: string | null;
  status: 'open' | 'closed' | 'cancelled';
  closes_at: string | null;
  selected_time: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingPollVote {
  id: string;
  poll_id: string;
  voter_id: string | null;
  voter_name: string | null;
  available_times: string[];
  preferred_time: string | null;
  voted_at: string;
}

export interface PollWithResults extends TrainingPoll {
  total_voters: number;
  votes_by_time: Record<string, number>;
  voters_by_time: Record<string, string[]>; // Names of voters for each time slot
  user_vote?: TrainingPollVote;
}

export interface CreatePollInput {
  title: string;
  description?: string;
  poll_type?: 'training' | 'event' | 'other';
  time_slots: string[];
  training_date?: string;
  closes_at?: string;
}

export interface AvailabilityInput {
  poll_id: string;
  voter_name: string; // Required - either from auth or entered manually
  available_times: string[];
  preferred_time?: string;
}

// =============================================================================
// FETCH ALL POLLS HOOK
// =============================================================================

export function useTrainingPolls(status?: 'open' | 'closed' | 'cancelled') {
  const [polls, setPolls] = useState<PollWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolls = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    try {
      // Get current user (may be null for anonymous)
      const { data: { user } } = await supabase.auth.getUser();

      // Build query
      let query = supabase
        .from('training_polls')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: pollsData, error: pollsError } = await query;

      if (pollsError) throw pollsError;

      // Get vote counts and user's vote for each poll
      const pollsWithResults: PollWithResults[] = await Promise.all(
        (pollsData || []).map(async (poll) => {
          // Get all votes for this poll
          const { data: votes } = await supabase
            .from('training_poll_votes')
            .select('*')
            .eq('poll_id', poll.id);

          // Calculate votes by time slot and collect voter names
          const votesByTime: Record<string, number> = {};
          const votersByTime: Record<string, string[]> = {};
          poll.time_slots.forEach((slot: string) => {
            votesByTime[slot] = 0;
            votersByTime[slot] = [];
          });

          (votes || []).forEach((vote) => {
            const voterName = vote.voter_name || 'Anonymous';
            vote.available_times.forEach((time: string) => {
              if (votesByTime[time] !== undefined) {
                votesByTime[time]++;
                votersByTime[time].push(voterName);
              }
            });
          });

          // Find user's vote (only for authenticated users)
          const userVote = user
            ? votes?.find((v) => v.voter_id === user.id)
            : undefined;

          return {
            ...poll,
            total_voters: votes?.length || 0,
            votes_by_time: votesByTime,
            voters_by_time: votersByTime,
            user_vote: userVote,
          };
        })
      );

      setPolls(pollsWithResults);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch polls');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  return { polls, loading, error, refetch: fetchPolls };
}

// =============================================================================
// SINGLE POLL HOOK
// =============================================================================

export function useTrainingPoll(pollId: string) {
  const [poll, setPoll] = useState<PollWithResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPoll = useCallback(async () => {
    if (!pollId) return;

    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: pollData, error: pollError } = await supabase
        .from('training_polls')
        .select('*')
        .eq('id', pollId)
        .single();

      if (pollError) throw pollError;

      // Get votes
      const { data: votes } = await supabase
        .from('training_poll_votes')
        .select('*')
        .eq('poll_id', pollId);

      // Calculate votes by time and collect voter names
      const votesByTime: Record<string, number> = {};
      const votersByTime: Record<string, string[]> = {};
      pollData.time_slots.forEach((slot: string) => {
        votesByTime[slot] = 0;
        votersByTime[slot] = [];
      });

      (votes || []).forEach((vote) => {
        const voterName = vote.voter_name || 'Anonymous';
        vote.available_times.forEach((time: string) => {
          if (votesByTime[time] !== undefined) {
            votesByTime[time]++;
            votersByTime[time].push(voterName);
          }
        });
      });

      const userVote = user
        ? votes?.find((v) => v.voter_id === user.id)
        : undefined;

      setPoll({
        ...pollData,
        total_voters: votes?.length || 0,
        votes_by_time: votesByTime,
        voters_by_time: votersByTime,
        user_vote: userVote,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch poll');
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  return { poll, loading, error, refetch: fetchPoll };
}

// =============================================================================
// CREATE POLL HOOK
// =============================================================================

export function useCreatePoll() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPoll = useCallback(async (input: CreatePollInput): Promise<TrainingPoll | null> => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be logged in to create a poll');

      const { data, error: insertError } = await supabase
        .from('training_polls')
        .insert({
          title: input.title,
          description: input.description || null,
          poll_type: input.poll_type || 'training',
          time_slots: input.time_slots,
          training_date: input.training_date || null,
          closes_at: input.closes_at || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create poll';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createPoll, loading, error };
}

// =============================================================================
// SUBMIT AVAILABILITY HOOK (Supports anonymous voting)
// =============================================================================

export function useSubmitAvailability() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitAvailability = useCallback(async (input: AvailabilityInput): Promise<boolean> => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      if (!input.voter_name.trim()) {
        throw new Error('Please enter your name');
      }

      if (input.available_times.length === 0) {
        throw new Error('Please select at least one available time');
      }

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Authenticated user - check for existing vote to update
        const { data: existing } = await supabase
          .from('training_poll_votes')
          .select('id')
          .eq('poll_id', input.poll_id)
          .eq('voter_id', user.id)
          .single();

        if (existing) {
          // Update existing vote
          const { error: updateError } = await supabase
            .from('training_poll_votes')
            .update({
              voter_name: input.voter_name,
              available_times: input.available_times,
              preferred_time: input.preferred_time || null,
              voted_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;
        } else {
          // Insert new vote for authenticated user
          const { error: insertError } = await supabase
            .from('training_poll_votes')
            .insert({
              poll_id: input.poll_id,
              voter_id: user.id,
              voter_name: input.voter_name,
              available_times: input.available_times,
              preferred_time: input.preferred_time || null,
            });

          if (insertError) throw insertError;
        }
      } else {
        // Anonymous user - just insert (no update capability)
        const { error: insertError } = await supabase
          .from('training_poll_votes')
          .insert({
            poll_id: input.poll_id,
            voter_id: null,
            voter_name: input.voter_name,
            available_times: input.available_times,
            preferred_time: input.preferred_time || null,
          });

        if (insertError) throw insertError;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit availability';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeAvailability = useCallback(async (pollId: string): Promise<boolean> => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be signed in to remove your availability');

      const { error: deleteError } = await supabase
        .from('training_poll_votes')
        .delete()
        .eq('poll_id', pollId)
        .eq('voter_id', user.id);

      if (deleteError) throw deleteError;

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove availability';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submitAvailability, removeAvailability, loading, error };
}

// =============================================================================
// CLOSE/SELECT POLL HOOK (Leaders only)
// =============================================================================

export function useManagePoll() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closePoll = useCallback(async (pollId: string, selectedTime?: string): Promise<boolean> => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('training_polls')
        .update({
          status: 'closed',
          selected_time: selectedTime || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pollId);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to close poll';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reopenPoll = useCallback(async (pollId: string): Promise<boolean> => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('training_polls')
        .update({
          status: 'open',
          selected_time: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pollId);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reopen poll';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePoll = useCallback(async (pollId: string): Promise<boolean> => {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('training_polls')
        .delete()
        .eq('id', pollId);

      if (deleteError) throw deleteError;

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete poll';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { closePoll, reopenPoll, deletePoll, loading, error };
}

// =============================================================================
// TIME UTILITIES
// =============================================================================

/**
 * Convert UTC time string to user's local time
 */
export function utcToLocal(utcTime: string): string {
  const [hours, minutes] = utcTime.split(':').map(Number);
  const now = new Date();
  const utcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes));
  return utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Convert local time to UTC time string
 */
export function localToUtc(localTime: string): string {
  const [time, period] = localTime.split(' ');
  let [hours, minutes] = time.split(':').map(Number);

  if (period?.toLowerCase() === 'pm' && hours !== 12) hours += 12;
  if (period?.toLowerCase() === 'am' && hours === 12) hours = 0;

  const now = new Date();
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  const utcHours = localDate.getUTCHours().toString().padStart(2, '0');
  const utcMinutes = localDate.getUTCMinutes().toString().padStart(2, '0');

  return `${utcHours}:${utcMinutes}`;
}

/**
 * Generate common time slots for AoO (every 2 hours)
 */
export function generateTimeSlots(): string[] {
  return [
    '00:00', '02:00', '04:00', '06:00', '08:00', '10:00',
    '12:00', '14:00', '16:00', '18:00', '20:00', '22:00',
  ];
}

/**
 * Format UTC time for display with local equivalent
 */
export function formatTimeWithLocal(utcTime: string): string {
  const local = utcToLocal(utcTime);
  return `${utcTime} UTC (${local} local)`;
}
