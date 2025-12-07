'use client';

import { useState, useEffect, useMemo } from 'react';
import { Clock, Plus, Check, X, Users, Calendar, ChevronDown, ChevronUp, Trash2, Lock, Unlock, Globe, MapPin, User, Info } from 'lucide-react';
import {
  useTrainingPolls,
  useCreatePoll,
  useSubmitAvailability,
  useManagePoll,
  generateTimeSlots,
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

function utcToLocalTime(utcTime: string): { time: string; period: string } {
  const [hours, minutes] = utcTime.split(':').map(Number);
  const now = new Date();
  const utcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes));

  const localHours = utcDate.getHours();
  const localMinutes = utcDate.getMinutes();
  const period = localHours >= 12 ? 'PM' : 'AM';
  const displayHours = localHours % 12 || 12;

  return {
    time: `${displayHours}:${localMinutes.toString().padStart(2, '0')}`,
    period,
  };
}

function formatTimeDisplay(utcTime: string, mode: TimeDisplay): React.ReactNode {
  const local = utcToLocalTime(utcTime);
  const tzAbbr = getTimezoneAbbr();

  switch (mode) {
    case 'utc':
      return (
        <span className="font-mono">
          <span className="text-lg font-bold">{utcTime}</span>
          <span className="text-xs text-stone-500 ml-1">UTC</span>
        </span>
      );
    case 'local':
      return (
        <span className="font-mono">
          <span className="text-lg font-bold">{local.time}</span>
          <span className="text-xs text-stone-400 ml-1">{local.period}</span>
          {tzAbbr && <span className="text-xs text-stone-500 ml-1">{tzAbbr}</span>}
        </span>
      );
    case 'both':
    default:
      return (
        <div className="flex flex-col">
          <span className="font-mono">
            <span className="text-lg font-bold">{local.time}</span>
            <span className="text-xs text-stone-400 ml-1">{local.period}</span>
            {tzAbbr && <span className="text-xs text-stone-500 ml-1">{tzAbbr}</span>}
          </span>
          <span className="text-xs text-stone-500 font-mono">{utcTime} UTC</span>
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
    <div className="flex items-center gap-2 p-2 bg-stone-800/50 rounded-lg border border-stone-700">
      <span className="text-xs text-stone-500 hidden sm:inline">Show times:</span>
      <div className="flex rounded-md overflow-hidden border border-stone-600">
        <button
          onClick={() => onChange('local')}
          className={`px-2.5 py-1 text-xs font-medium flex items-center gap-1 transition-colors ${
            value === 'local'
              ? 'bg-emerald-600 text-white'
              : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
          }`}
          title="Show in your local time"
        >
          <MapPin className="w-3 h-3" />
          <span className="hidden sm:inline">Local</span>
          {tzAbbr && <span className="text-[10px] opacity-75">({tzAbbr})</span>}
        </button>
        <button
          onClick={() => onChange('utc')}
          className={`px-2.5 py-1 text-xs font-medium flex items-center gap-1 transition-colors ${
            value === 'utc'
              ? 'bg-emerald-600 text-white'
              : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
          }`}
          title="Show in UTC (game time)"
        >
          <Globe className="w-3 h-3" />
          <span className="hidden sm:inline">UTC</span>
        </button>
        <button
          onClick={() => onChange('both')}
          className={`px-2.5 py-1 text-xs font-medium flex items-center gap-1 transition-colors ${
            value === 'both'
              ? 'bg-emerald-600 text-white'
              : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
          }`}
          title="Show both local and UTC"
        >
          <span className="hidden sm:inline">Both</span>
          <span className="sm:hidden">All</span>
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// CREATE POLL MODAL
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
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [trainingDate, setTrainingDate] = useState('');

  const allSlots = generateTimeSlots();

  const toggleSlot = (slot: string) => {
    setSelectedSlots(prev =>
      prev.includes(slot)
        ? prev.filter(s => s !== slot)
        : [...prev, slot]
    );
  };

  const selectAllSlots = () => {
    setSelectedSlots(allSlots);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || selectedSlots.length < 2) return;

    const input: CreatePollInput = {
      title,
      description: description || undefined,
      time_slots: selectedSlots.sort(),
      training_date: trainingDate || undefined,
    };

    const result = await createPoll(input);
    if (result) {
      setTitle('');
      setDescription('');
      setSelectedSlots([]);
      setTrainingDate('');
      onCreated();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto bg-stone-800 rounded-xl border border-stone-600 shadow-xl">
        <div className="p-4 border-b border-stone-700 flex items-center justify-between sticky top-0 bg-stone-800 z-10">
          <h3 className="text-lg font-semibold text-emerald-400">Create Availability Poll</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-700 rounded">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-stone-400 mb-1">Poll Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Week 12 Training Time"
              className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded-lg text-stone-200 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any notes about this training session..."
              className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded-lg text-stone-200 focus:border-emerald-500 focus:outline-none resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Training Date (optional)</label>
            <input
              type="date"
              value={trainingDate}
              onChange={(e) => setTrainingDate(e.target.value)}
              className="w-full px-3 py-2 bg-stone-700 border border-stone-600 rounded-lg text-stone-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-stone-400">
                Select Time Options * <span className="text-stone-500">(pick at least 2)</span>
              </label>
              <button
                type="button"
                onClick={selectAllSlots}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Select All
              </button>
            </div>
            <p className="text-xs text-stone-500 mb-3">
              Choose which times to include in the poll. Members will mark their availability.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {allSlots.map(slot => {
                const local = utcToLocalTime(slot);
                const isSelected = selectedSlots.includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggleSlot(slot)}
                    className={`p-2 rounded-lg text-center transition-all border-2 ${
                      isSelected
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                        : 'bg-stone-700 border-transparent text-stone-400 hover:bg-stone-600 hover:border-stone-500'
                    }`}
                  >
                    <div className="text-sm font-bold">{local.time} {local.period}</div>
                    <div className="text-[10px] opacity-60">{slot} UTC</div>
                  </button>
                );
              })}
            </div>
            {selectedSlots.length > 0 && (
              <p className="text-xs text-emerald-400 mt-2">
                {selectedSlots.length} time{selectedSlots.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-stone-800 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-stone-600 text-stone-400 hover:bg-stone-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title || selectedSlots.length < 2}
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
// AVAILABILITY CARD (replaces PollCard)
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
  const [selectedTimes, setSelectedTimes] = useState<string[]>(poll.user_vote?.available_times || []);
  const [voterName, setVoterName] = useState(poll.user_vote?.voter_name || userName || '');
  const [hasChanges, setHasChanges] = useState(false);
  const [showVoters, setShowVoters] = useState<string | null>(null);

  // Sync with poll data when it changes
  useEffect(() => {
    if (poll.user_vote) {
      setSelectedTimes(poll.user_vote.available_times);
      setVoterName(poll.user_vote.voter_name || userName || '');
    }
    setHasChanges(false);
  }, [poll.user_vote, userName]);

  const toggleTime = (time: string) => {
    setSelectedTimes(prev => {
      const newTimes = prev.includes(time)
        ? prev.filter(t => t !== time)
        : [...prev, time];
      return newTimes;
    });
    setHasChanges(true);
  };

  const handleSubmit = async () => {
    if (selectedTimes.length === 0 || !voterName.trim()) return;

    const success = await submitAvailability({
      poll_id: poll.id,
      voter_name: voterName.trim(),
      available_times: selectedTimes,
    });

    if (success) {
      setHasChanges(false);
      onAvailabilityChange();
    }
  };

  const handleRemove = async () => {
    const success = await removeAvailability(poll.id);
    if (success) {
      setSelectedTimes([]);
      setHasChanges(false);
      onAvailabilityChange();
    }
  };

  const handleClosePoll = async () => {
    const maxVotes = Math.max(...Object.values(poll.votes_by_time));
    const winningTime = Object.entries(poll.votes_by_time)
      .find(([, count]) => count === maxVotes)?.[0];

    await closePoll(poll.id, winningTime);
    onAvailabilityChange();
  };

  const handleReopenPoll = async () => {
    await reopenPoll(poll.id);
    onAvailabilityChange();
  };

  const handleDeletePoll = async () => {
    if (!confirm('Are you sure you want to delete this poll?')) return;
    await deletePoll(poll.id);
    onAvailabilityChange();
  };

  // Sort time slots by availability count
  const sortedSlots = useMemo(() => {
    return [...poll.time_slots].sort((a, b) => {
      const votesA = poll.votes_by_time[a] || 0;
      const votesB = poll.votes_by_time[b] || 0;
      return votesB - votesA;
    });
  }, [poll.time_slots, poll.votes_by_time]);

  const maxVotes = Math.max(...Object.values(poll.votes_by_time), 1);
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
            <Clock className={`w-5 h-5 ${isOpen ? 'text-emerald-400' : 'text-stone-500'}`} />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-stone-200 truncate">{poll.title}</h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {poll.total_voters} {poll.total_voters === 1 ? 'response' : 'responses'}
              </span>
              {poll.training_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(poll.training_date + 'T00:00:00').toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
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
          {poll.selected_time && (
            <div className="hidden sm:block px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded-lg text-sm">
              {formatTimeDisplay(poll.selected_time, timeDisplay)}
            </div>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-stone-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-stone-500" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-stone-700/50">
          {poll.description && (
            <p className="text-sm text-stone-400 pt-3">{poll.description}</p>
          )}

          {/* Name input for voting */}
          {isOpen && (
            <div className="pt-3">
              <label className="block text-sm text-stone-400 mb-1.5">
                Your Name <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="text"
                    value={voterName}
                    onChange={(e) => {
                      setVoterName(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="Enter your in-game name"
                    className="w-full pl-9 pr-3 py-2 bg-stone-700 border border-stone-600 rounded-lg text-stone-200 focus:border-emerald-500 focus:outline-none"
                    disabled={hasExistingVote && !isAuthenticated}
                  />
                </div>
              </div>
              {!isAuthenticated && !hasExistingVote && (
                <p className="text-xs text-amber-500/80 mt-1.5 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  Sign in to edit your response later. Anonymous responses cannot be changed.
                </p>
              )}
            </div>
          )}

          {/* Instructions */}
          {isOpen && !hasExistingVote && (
            <div className="p-3 bg-emerald-600/10 border border-emerald-600/30 rounded-lg">
              <p className="text-sm text-emerald-400">
                <strong>Mark your availability:</strong> Tap all the times you could attend training.
                We&apos;ll find the time that works for the most people.
              </p>
            </div>
          )}

          {/* Time slots */}
          <div className="space-y-2 pt-2">
            {sortedSlots.map((slot, index) => {
              const voteCount = poll.votes_by_time[slot] || 0;
              const percentage = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;
              const isSelected = selectedTimes.includes(slot);
              const isWinner = poll.selected_time === slot;
              const isBestOption = index === 0 && voteCount > 0 && isOpen;
              const voters = poll.voters_by_time[slot] || [];

              return (
                <div key={slot} className="relative">
                  <div
                    className={`relative flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                      isWinner
                        ? 'bg-emerald-600/20 border-emerald-500'
                        : isOpen && isSelected
                        ? 'bg-stone-700/50 border-emerald-500'
                        : isBestOption
                        ? 'bg-stone-700/30 border-amber-500/50'
                        : 'bg-stone-800 border-stone-700'
                    } ${isOpen ? 'cursor-pointer active:scale-[0.99]' : ''}`}
                    onClick={() => isOpen && toggleTime(slot)}
                  >
                    {/* Progress bar background */}
                    <div
                      className={`absolute inset-0 rounded-lg transition-all pointer-events-none ${
                        isWinner ? 'bg-emerald-600/10' : 'bg-emerald-600/5'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />

                    <div className="relative flex items-center gap-3 min-w-0">
                      {isOpen && (
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600'
                            : 'border-stone-500 hover:border-stone-400'
                        }`}>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      )}
                      <div className="min-w-0">
                        {formatTimeDisplay(slot, timeDisplay)}
                      </div>
                      {isWinner && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                          Selected
                        </span>
                      )}
                      {isBestOption && !isWinner && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                          Best Option
                        </span>
                      )}
                    </div>

                    <div className="relative flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowVoters(showVoters === slot ? null : slot);
                        }}
                        className="text-right hover:bg-stone-700/50 px-2 py-1 rounded transition-colors"
                        title="Click to see who's available"
                      >
                        <span className="text-lg font-bold text-stone-200">{voteCount}</span>
                        <span className="text-xs text-stone-500 ml-1">available</span>
                      </button>
                    </div>
                  </div>

                  {/* Voters list dropdown */}
                  {showVoters === slot && voters.length > 0 && (
                    <div className="mt-1 p-2 bg-stone-700 rounded-lg border border-stone-600 text-sm">
                      <div className="text-xs text-stone-400 mb-1">Who&apos;s available:</div>
                      <div className="flex flex-wrap gap-1">
                        {voters.map((name, i) => (
                          <span key={i} className="px-2 py-0.5 bg-stone-600 rounded text-stone-300 text-xs">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit error */}
          {submitError && (
            <p className="text-red-400 text-sm">{submitError}</p>
          )}

          {/* Submit actions */}
          {isOpen && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="text-sm text-stone-400">
                {hasExistingVote ? (
                  <span className="text-emerald-400">
                    You marked {poll.user_vote?.available_times.length} time{(poll.user_vote?.available_times.length || 0) !== 1 ? 's' : ''} as available
                  </span>
                ) : selectedTimes.length > 0 ? (
                  <span>{selectedTimes.length} time{selectedTimes.length !== 1 ? 's' : ''} selected</span>
                ) : (
                  <span>Tap times you can attend</span>
                )}
              </div>
              <div className="flex gap-2">
                {hasExistingVote && isAuthenticated && (
                  <button
                    onClick={handleRemove}
                    disabled={submitLoading}
                    className="flex-1 sm:flex-none px-3 py-2 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Remove
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={submitLoading || selectedTimes.length === 0 || !voterName.trim() || (!hasChanges && hasExistingVote)}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitLoading ? 'Saving...' : hasExistingVote ? 'Update' : 'Submit Availability'}
                </button>
              </div>
            </div>
          )}

          {/* Leader actions */}
          {isLeader && (
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-stone-700">
              {isOpen ? (
                <button
                  onClick={handleClosePoll}
                  disabled={manageLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 flex items-center gap-1.5 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Close Poll
                </button>
              ) : (
                <button
                  onClick={handleReopenPoll}
                  disabled={manageLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-stone-700 text-stone-300 hover:bg-stone-600 flex items-center gap-1.5 transition-colors"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Reopen
                </button>
              )}
              <button
                onClick={handleDeletePoll}
                disabled={manageLoading}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
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

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      if (user?.user_metadata?.name) {
        setUserName(user.user_metadata.name);
      } else if (user?.email) {
        setUserName(user.email.split('@')[0]);
      }
    };
    checkAuth();
  }, []);

  // Load saved time preference
  useEffect(() => {
    const saved = localStorage.getItem('aoo-time-display');
    if (saved && ['utc', 'local', 'both'].includes(saved)) {
      setTimeDisplay(saved as TimeDisplay);
    }
  }, []);

  // Save time preference
  const handleTimeDisplayChange = (value: TimeDisplay) => {
    setTimeDisplay(value);
    localStorage.setItem('aoo-time-display', value);
  };

  const filteredPolls = polls.filter(poll => {
    if (filter === 'all') return true;
    return poll.status === filter;
  });

  const openPolls = polls.filter(p => p.status === 'open');

  const timezone = getUserTimezone();

  if (loading || roleLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-500">Loading polls...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-200">Training Availability</h3>
          <p className="text-sm text-stone-500">
            Find the best time for training. Your timezone: <span className="text-stone-400">{timezone}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimeToggle value={timeDisplay} onChange={handleTimeDisplayChange} />
          {isLeaderOrAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Poll</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'open', 'closed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-emerald-600 text-white'
                : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'open' && openPolls.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                {openPolls.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Polls list */}
      {filteredPolls.length === 0 ? (
        <div className="text-center py-12 text-stone-500">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg">No {filter !== 'all' ? filter : ''} polls yet</p>
          <p className="text-sm mt-1">
            {isLeaderOrAdmin
              ? 'Create a poll to find when everyone is available for training.'
              : 'Check back later for new polls.'}
          </p>
          {isLeaderOrAdmin && filter !== 'closed' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors"
            >
              Create First Poll
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

      {/* Create modal */}
      <CreatePollModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={refetch}
      />
    </div>
  );
}
