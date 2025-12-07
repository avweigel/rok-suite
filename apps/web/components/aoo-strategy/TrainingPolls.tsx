'use client';

import { useState, useEffect, useMemo } from 'react';
import { Clock, Plus, Check, X, Users, ChevronDown, ChevronUp, Trash2, Lock, Unlock, Globe, MapPin, User, Info, Calendar, CheckCircle2 } from 'lucide-react';
import {
  useTrainingPolls,
  useCreatePoll,
  useSubmitAvailability,
  useManagePoll,
  generateTimeSlots,
  generateDateTimeSlots,
  getNextDays,
  getUniqueDates,
  getUniqueTimes,
  parseSlot,
  formatDate,
  utcToLocal,
  type CreatePollInput,
  type PollWithResults,
} from '@/lib/supabase/use-training-polls';
import { useUserRole } from '@/lib/supabase/use-guide';
import { createClient } from '@/lib/supabase/client';

// =============================================================================
// TIME UTILITIES
// =============================================================================

type TimeDisplay = 'utc' | 'local' | 'both';

function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

function getTimezoneAbbr(): string {
  try {
    const date = new Date();
    const timeString = date.toLocaleTimeString('en-US', { timeZoneName: 'short' });
    const match = timeString.match(/[A-Z]{2,5}$/);
    return match ? match[0] : '';
  } catch {
    return '';
  }
}

function formatTimeForDisplay(time: string, mode: TimeDisplay): React.ReactNode {
  const local = utcToLocal(time);
  const tzAbbr = getTimezoneAbbr();

  switch (mode) {
    case 'utc':
      return <span className="font-mono text-sm">{parseSlot(time).time}</span>;
    case 'local':
      return <span className="font-mono text-sm">{local.time} {local.period}</span>;
    case 'both':
    default:
      return (
        <div className="text-center">
          <div className="font-mono text-sm font-medium">{local.time} {local.period}</div>
          <div className="text-[10px] text-stone-500">{parseSlot(time).time} UTC</div>
        </div>
      );
  }
}

// =============================================================================
// TIME DISPLAY TOGGLE
// =============================================================================

interface TimeToggleProps {
  value: TimeDisplay;
  onChange: (value: TimeDisplay) => void;
}

function TimeToggle({ value, onChange }: TimeToggleProps) {
  const tzAbbr = getTimezoneAbbr();

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-md overflow-hidden border border-stone-600">
        <button
          onClick={() => onChange('local')}
          className={`px-2 py-1 text-xs font-medium flex items-center gap-1 transition-colors ${
            value === 'local'
              ? 'bg-emerald-600 text-white'
              : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
          }`}
        >
          <MapPin className="w-3 h-3" />
          {tzAbbr || 'Local'}
        </button>
        <button
          onClick={() => onChange('utc')}
          className={`px-2 py-1 text-xs font-medium flex items-center gap-1 transition-colors ${
            value === 'utc'
              ? 'bg-emerald-600 text-white'
              : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
          }`}
        >
          <Globe className="w-3 h-3" />
          UTC
        </button>
        <button
          onClick={() => onChange('both')}
          className={`px-2 py-1 text-xs font-medium transition-colors ${
            value === 'both'
              ? 'bg-emerald-600 text-white'
              : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
          }`}
        >
          Both
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// CREATE POLL MODAL - Multi-day support with quick selection
// =============================================================================

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreatePollModal({ isOpen, onClose, onCreated }: CreatePollModalProps) {
  const { createPoll, loading, error } = useCreatePoll();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);

  const allTimes = generateTimeSlots();
  const nextDays = getNextDays(14); // Show next 2 weeks

  const toggleDate = (date: string) => {
    setSelectedDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  const toggleTime = (time: string) => {
    setSelectedTimes(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    );
  };

  const selectAllTimes = () => setSelectedTimes(allTimes);
  const selectCommonTimes = () => setSelectedTimes(['12:00', '14:00', '16:00', '18:00', '20:00', '22:00']);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || selectedDates.length === 0 || selectedTimes.length === 0) return;

    const timeSlots = generateDateTimeSlots(selectedDates, selectedTimes);

    const input: CreatePollInput = {
      title,
      description: description || undefined,
      time_slots: timeSlots,
    };

    const result = await createPoll(input);
    if (result) {
      setTitle('');
      setDescription('');
      setSelectedDates([]);
      setSelectedTimes([]);
      onCreated();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-stone-800 rounded-xl border border-stone-600 shadow-xl">
        <div className="p-4 border-b border-stone-700 flex items-center justify-between sticky top-0 bg-stone-800 z-10">
          <h3 className="text-lg font-semibold text-emerald-400">Create Availability Poll</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-700 rounded">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Title & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-stone-400 mb-1">Poll Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Week 12 Training"
                className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded-lg text-stone-200 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-stone-400 mb-1">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Any notes..."
                className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded-lg text-stone-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Date Selection */}
          <div>
            <label className="block text-sm text-stone-400 mb-2">
              Select Dates * <span className="text-stone-500">(tap to toggle)</span>
            </label>
            <div className="grid grid-cols-7 gap-1">
              {nextDays.map(date => {
                const d = new Date(date + 'T00:00:00');
                const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
                const dayNum = d.getDate();
                const isSelected = selectedDates.includes(date);
                const isToday = date === nextDays[0];

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => toggleDate(date)}
                    className={`p-2 rounded-lg text-center transition-all border ${
                      isSelected
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-400'
                        : 'bg-stone-700/50 border-stone-600 text-stone-400 hover:bg-stone-600'
                    }`}
                  >
                    <div className="text-[10px] uppercase">{dayName}</div>
                    <div className={`text-lg font-bold ${isToday ? 'text-amber-400' : ''}`}>{dayNum}</div>
                  </button>
                );
              })}
            </div>
            {selectedDates.length > 0 && (
              <p className="text-xs text-emerald-400 mt-2">{selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected</p>
            )}
          </div>

          {/* Time Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-stone-400">
                Select Times * <span className="text-stone-500">(UTC)</span>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={selectCommonTimes} className="text-xs text-emerald-400 hover:text-emerald-300">
                  Common
                </button>
                <button type="button" onClick={selectAllTimes} className="text-xs text-emerald-400 hover:text-emerald-300">
                  All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {allTimes.map(time => {
                const local = utcToLocal(time);
                const isSelected = selectedTimes.includes(time);
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => toggleTime(time)}
                    className={`p-1.5 rounded-lg text-center transition-all border ${
                      isSelected
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-400'
                        : 'bg-stone-700/50 border-stone-600 text-stone-400 hover:bg-stone-600'
                    }`}
                  >
                    <div className="text-xs font-medium">{local.time}</div>
                    <div className="text-[10px] opacity-60">{time}</div>
                  </button>
                );
              })}
            </div>
            {selectedTimes.length > 0 && (
              <p className="text-xs text-emerald-400 mt-2">{selectedTimes.length} time{selectedTimes.length !== 1 ? 's' : ''} selected</p>
            )}
          </div>

          {/* Summary */}
          {selectedDates.length > 0 && selectedTimes.length > 0 && (
            <div className="p-3 bg-stone-700/50 rounded-lg text-sm text-stone-300">
              This will create <strong className="text-emerald-400">{selectedDates.length * selectedTimes.length}</strong> time slots
              ({selectedDates.length} days x {selectedTimes.length} times per day)
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-stone-600 text-stone-400 hover:bg-stone-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title || selectedDates.length === 0 || selectedTimes.length === 0}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Poll'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// =============================================================================
// AVAILABILITY GRID - Easy multi-day selection
// =============================================================================

interface AvailabilityGridProps {
  poll: PollWithResults;
  selectedSlots: Set<string>;
  onToggle: (slot: string) => void;
  timeDisplay: TimeDisplay;
  isOpen: boolean;
}

function AvailabilityGrid({ poll, selectedSlots, onToggle, timeDisplay, isOpen }: AvailabilityGridProps) {
  const dates = getUniqueDates(poll.time_slots);
  const times = getUniqueTimes(poll.time_slots);
  const maxVotes = Math.max(...Object.values(poll.votes_by_time), 1);

  // If no dates (time-only poll), show simple list
  if (dates.length === 0) {
    return (
      <div className="space-y-1.5">
        {times.map(time => {
          const slot = time;
          const voteCount = poll.votes_by_time[slot] || 0;
          const isSelected = selectedSlots.has(slot);
          const isWinner = poll.selected_time === slot;
          const isBest = voteCount === maxVotes && voteCount > 0;

          return (
            <div
              key={slot}
              onClick={() => isOpen && onToggle(slot)}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                isWinner ? 'bg-emerald-600/20 border-emerald-500' :
                isSelected ? 'bg-stone-700/50 border-emerald-500' :
                isBest ? 'bg-amber-500/10 border-amber-500/50' :
                'bg-stone-800 border-stone-700'
              } ${isOpen ? 'cursor-pointer hover:bg-stone-700/50' : ''}`}
            >
              <div className="flex items-center gap-3">
                {isOpen && (
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-stone-500'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                )}
                {formatTimeForDisplay(slot, timeDisplay)}
                {isWinner && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Selected</span>}
                {isBest && !isWinner && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">Best</span>}
              </div>
              <span className="text-sm text-stone-400">{voteCount} available</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Multi-day grid view
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full border-collapse min-w-[400px]">
        <thead>
          <tr>
            <th className="text-left text-xs text-stone-500 pb-2 pr-2 sticky left-0 bg-stone-800/95">
              {timeDisplay === 'utc' ? 'UTC' : getTimezoneAbbr() || 'Local'}
            </th>
            {dates.map(date => (
              <th key={date} className="text-center text-xs text-stone-400 pb-2 px-1 min-w-[60px]">
                <div>{formatDate(date).split(',')[0]}</div>
                <div className="font-bold">{new Date(date + 'T00:00:00').getDate()}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map(time => (
            <tr key={time}>
              <td className="text-xs text-stone-400 py-1 pr-2 sticky left-0 bg-stone-800/95">
                {timeDisplay === 'utc' ? time : `${utcToLocal(time).time} ${utcToLocal(time).period}`}
              </td>
              {dates.map(date => {
                const slot = `${date} ${time}`;
                if (!poll.time_slots.includes(slot)) {
                  return <td key={slot} className="p-1"><div className="w-full h-10 bg-stone-900/50 rounded" /></td>;
                }

                const voteCount = poll.votes_by_time[slot] || 0;
                const isSelected = selectedSlots.has(slot);
                const isWinner = poll.selected_time === slot;
                const isBest = voteCount === maxVotes && voteCount > 0 && maxVotes > 0;
                const intensity = maxVotes > 0 ? voteCount / maxVotes : 0;

                return (
                  <td key={slot} className="p-0.5">
                    <button
                      onClick={() => isOpen && onToggle(slot)}
                      disabled={!isOpen}
                      className={`w-full h-10 rounded-md flex items-center justify-center text-sm font-medium transition-all border-2 ${
                        isWinner
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : isSelected
                          ? 'bg-emerald-600/40 border-emerald-500 text-emerald-300'
                          : isBest
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : intensity > 0
                          ? 'bg-emerald-600/10 border-stone-600 text-stone-300'
                          : 'bg-stone-700/30 border-stone-700 text-stone-500'
                      } ${isOpen ? 'hover:border-emerald-400 cursor-pointer' : ''}`}
                      title={`${voteCount} available${poll.voters_by_time[slot]?.length ? ': ' + poll.voters_by_time[slot].join(', ') : ''}`}
                    >
                      {isSelected ? <Check className="w-4 h-4" /> : voteCount > 0 ? voteCount : ''}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// AVAILABILITY CARD
// =============================================================================

interface AvailabilityCardProps {
  poll: PollWithResults;
  isLeader: boolean;
  isAuthenticated: boolean;
  userName: string;
  onAvailabilityChange: () => void;
  timeDisplay: TimeDisplay;
}

function AvailabilityCard({ poll, isLeader, isAuthenticated, userName, onAvailabilityChange, timeDisplay }: AvailabilityCardProps) {
  const { submitAvailability, removeAvailability, loading: submitLoading, error: submitError } = useSubmitAvailability();
  const { closePoll, reopenPoll, deletePoll, loading: manageLoading } = useManagePoll();
  const [expanded, setExpanded] = useState(poll.status === 'open');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set(poll.user_vote?.available_times || []));
  const [voterName, setVoterName] = useState(poll.user_vote?.voter_name || userName || '');
  const [hasChanges, setHasChanges] = useState(false);

  // Sync with poll data
  useEffect(() => {
    if (poll.user_vote) {
      setSelectedSlots(new Set(poll.user_vote.available_times));
      setVoterName(poll.user_vote.voter_name || userName || '');
    }
    setHasChanges(false);
  }, [poll.user_vote, userName]);

  const toggleSlot = (slot: string) => {
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
    setHasChanges(true);
  };

  const selectAll = () => {
    setSelectedSlots(new Set(poll.time_slots));
    setHasChanges(true);
  };

  const clearAll = () => {
    setSelectedSlots(new Set());
    setHasChanges(true);
  };

  const handleSubmit = async () => {
    if (selectedSlots.size === 0 || !voterName.trim()) return;

    const success = await submitAvailability({
      poll_id: poll.id,
      voter_name: voterName.trim(),
      available_times: Array.from(selectedSlots),
    });

    if (success) {
      setHasChanges(false);
      onAvailabilityChange();
    }
  };

  const handleRemove = async () => {
    const success = await removeAvailability(poll.id);
    if (success) {
      setSelectedSlots(new Set());
      setHasChanges(false);
      onAvailabilityChange();
    }
  };

  const handleClosePoll = async () => {
    const maxVotes = Math.max(...Object.values(poll.votes_by_time));
    const winningSlot = Object.entries(poll.votes_by_time)
      .find(([, count]) => count === maxVotes)?.[0];
    await closePoll(poll.id, winningSlot);
    onAvailabilityChange();
  };

  // Get best slot info
  const bestSlot = useMemo(() => {
    const entries = Object.entries(poll.votes_by_time);
    if (entries.length === 0) return null;
    const max = Math.max(...entries.map(([, v]) => v));
    if (max === 0) return null;
    const best = entries.find(([, v]) => v === max);
    return best ? { slot: best[0], count: best[1] } : null;
  }, [poll.votes_by_time]);

  const dates = getUniqueDates(poll.time_slots);
  const isOpen = poll.status === 'open';
  const hasExistingVote = !!poll.user_vote;

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isOpen ? 'bg-stone-800/50 border-stone-600' : 'bg-stone-900/50 border-stone-700'
    }`}>
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-stone-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${isOpen ? 'bg-emerald-600/20' : 'bg-stone-700'}`}>
            <Calendar className={`w-5 h-5 ${isOpen ? 'text-emerald-400' : 'text-stone-500'}`} />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-stone-200 truncate">{poll.title}</h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {poll.total_voters} {poll.total_voters === 1 ? 'response' : 'responses'}
              </span>
              {dates.length > 0 && (
                <span>{dates.length} day{dates.length !== 1 ? 's' : ''}</span>
              )}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                isOpen ? 'bg-emerald-600/20 text-emerald-400' : 'bg-stone-700 text-stone-400'
              }`}>
                {poll.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {bestSlot && !poll.selected_time && (
            <div className="hidden sm:block text-xs text-amber-400">
              Best: {bestSlot.count} at {formatTimeForDisplay(bestSlot.slot, timeDisplay)}
            </div>
          )}
          {poll.selected_time && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {formatTimeForDisplay(poll.selected_time, timeDisplay)}
            </div>
          )}
          {expanded ? <ChevronUp className="w-5 h-5 text-stone-500" /> : <ChevronDown className="w-5 h-5 text-stone-500" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-stone-700/50">
          {poll.description && (
            <p className="text-sm text-stone-400 pt-3">{poll.description}</p>
          )}

          {/* Name input */}
          {isOpen && (
            <div className="pt-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="text"
                    value={voterName}
                    onChange={(e) => { setVoterName(e.target.value); setHasChanges(true); }}
                    placeholder="Your in-game name"
                    className="w-full pl-9 pr-3 py-2 bg-stone-700 border border-stone-600 rounded-lg text-stone-200 focus:border-emerald-500 focus:outline-none"
                    disabled={hasExistingVote && !isAuthenticated}
                  />
                </div>
                <button onClick={selectAll} className="px-3 py-2 text-xs text-emerald-400 hover:bg-stone-700 rounded-lg">
                  Select All
                </button>
                {selectedSlots.size > 0 && (
                  <button onClick={clearAll} className="px-3 py-2 text-xs text-stone-400 hover:bg-stone-700 rounded-lg">
                    Clear
                  </button>
                )}
              </div>
              {!isAuthenticated && !hasExistingVote && (
                <p className="text-xs text-amber-500/80 mt-1.5 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  Sign in to edit later. Anonymous responses cannot be changed.
                </p>
              )}
            </div>
          )}

          {/* Instructions */}
          {isOpen && !hasExistingVote && (
            <div className="p-3 bg-emerald-600/10 border border-emerald-600/30 rounded-lg text-sm text-emerald-400">
              <strong>Tap all times you&apos;re available.</strong> We&apos;ll find when most people can make it.
            </div>
          )}

          {/* Availability Grid */}
          <AvailabilityGrid
            poll={poll}
            selectedSlots={selectedSlots}
            onToggle={toggleSlot}
            timeDisplay={timeDisplay}
            isOpen={isOpen}
          />

          {submitError && <p className="text-red-400 text-sm">{submitError}</p>}

          {/* Submit actions */}
          {isOpen && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-sm text-stone-400">
                {hasExistingVote
                  ? <span className="text-emerald-400">{poll.user_vote?.available_times.length} times marked</span>
                  : selectedSlots.size > 0
                  ? <span>{selectedSlots.size} selected</span>
                  : <span>Tap times you can attend</span>
                }
              </div>
              <div className="flex gap-2">
                {hasExistingVote && isAuthenticated && (
                  <button onClick={handleRemove} disabled={submitLoading}
                    className="px-3 py-2 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">
                    Remove
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={submitLoading || selectedSlots.size === 0 || !voterName.trim() || (!hasChanges && hasExistingVote)}
                  className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitLoading ? 'Saving...' : hasExistingVote ? 'Update' : 'Submit'}
                </button>
              </div>
            </div>
          )}

          {/* Leader actions */}
          {isLeader && (
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-700">
              {isOpen ? (
                <button onClick={handleClosePoll} disabled={manageLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Close
                </button>
              ) : (
                <button onClick={() => reopenPoll(poll.id).then(onAvailabilityChange)} disabled={manageLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-stone-700 text-stone-300 hover:bg-stone-600 flex items-center gap-1.5">
                  <Unlock className="w-3.5 h-3.5" /> Reopen
                </button>
              )}
              <button onClick={() => { if (confirm('Delete this poll?')) deletePoll(poll.id).then(onAvailabilityChange); }} disabled={manageLoading}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TrainingPolls() {
  const { polls, loading, error, refetch } = useTrainingPolls();
  const { isLeaderOrAdmin, loading: roleLoading } = useUserRole();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplay>('both');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      if (user?.user_metadata?.name) setUserName(user.user_metadata.name);
      else if (user?.email) setUserName(user.email.split('@')[0]);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('aoo-time-display');
    if (saved && ['utc', 'local', 'both'].includes(saved)) setTimeDisplay(saved as TimeDisplay);
  }, []);

  const handleTimeDisplayChange = (value: TimeDisplay) => {
    setTimeDisplay(value);
    localStorage.setItem('aoo-time-display', value);
  };

  const filteredPolls = polls.filter(poll => filter === 'all' || poll.status === filter);
  const openPolls = polls.filter(p => p.status === 'open');
  const timezone = getUserTimezone();

  if (loading || roleLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-stone-200">Training Availability</h3>
          <p className="text-xs text-stone-500">{timezone}</p>
        </div>
        <div className="flex items-center gap-2">
          <TimeToggle value={timeDisplay} onChange={handleTimeDisplayChange} />
          {isLeaderOrAdmin && (
            <button onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1.5">
        {(['all', 'open', 'closed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-emerald-600 text-white' : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'open' && openPolls.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">{openPolls.length}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">{error}</div>}

      {filteredPolls.length === 0 ? (
        <div className="text-center py-12 text-stone-500">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg">No {filter !== 'all' ? filter : ''} polls</p>
          {isLeaderOrAdmin && filter !== 'closed' && (
            <button onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500">
              Create Poll
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPolls.map(poll => (
            <AvailabilityCard
              key={poll.id}
              poll={poll}
              isLeader={isLeaderOrAdmin}
              isAuthenticated={isAuthenticated}
              userName={userName}
              onAvailabilityChange={refetch}
              timeDisplay={timeDisplay}
            />
          ))}
        </div>
      )}

      <CreatePollModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={refetch} />
    </div>
  );
}
