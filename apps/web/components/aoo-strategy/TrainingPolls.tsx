'use client';

import { useState, useEffect } from 'react';
import { Clock, Plus, Check, X, Users, Calendar, ChevronDown, ChevronUp, Trash2, Lock, Unlock } from 'lucide-react';
import {
  useTrainingPolls,
  useCreatePoll,
  useVote,
  useManagePoll,
  utcToLocal,
  generateTimeSlots,
  type CreatePollInput,
  type PollWithResults,
} from '@/lib/supabase/use-training-polls';
import { useUserRole } from '@/lib/supabase/use-guide';

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
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-lg bg-stone-800 rounded-xl border border-stone-600 shadow-xl">
        <div className="p-4 border-b border-stone-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-emerald-400">Create Training Poll</h3>
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
            <label className="block text-sm text-stone-400 mb-2">
              Select Time Options * <span className="text-stone-500">(min 2, all times in UTC)</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {allSlots.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => toggleSlot(slot)}
                  className={`px-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedSlots.includes(slot)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
                  }`}
                >
                  <div>{slot}</div>
                  <div className="text-[10px] opacity-70">{utcToLocal(slot)}</div>
                </button>
              ))}
            </div>
            {selectedSlots.length > 0 && (
              <p className="text-xs text-stone-500 mt-2">
                {selectedSlots.length} time{selectedSlots.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
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
// POLL CARD
// =============================================================================

interface PollCardProps {
  poll: PollWithResults;
  isLeader: boolean;
  onVoteChange: () => void;
}

function PollCard({ poll, isLeader, onVoteChange }: PollCardProps) {
  const { vote, removeVote, loading: voteLoading } = useVote();
  const { closePoll, deletePoll, loading: manageLoading } = useManagePoll();
  const [expanded, setExpanded] = useState(poll.status === 'open');
  const [selectedTimes, setSelectedTimes] = useState<string[]>(poll.user_vote?.available_times || []);
  const [preferredTime, setPreferredTime] = useState<string | null>(poll.user_vote?.preferred_time || null);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync with poll data
  useEffect(() => {
    setSelectedTimes(poll.user_vote?.available_times || []);
    setPreferredTime(poll.user_vote?.preferred_time || null);
    setHasChanges(false);
  }, [poll.user_vote]);

  const toggleTime = (time: string) => {
    setSelectedTimes(prev => {
      const newTimes = prev.includes(time)
        ? prev.filter(t => t !== time)
        : [...prev, time];

      // Clear preferred if it's no longer selected
      if (preferredTime && !newTimes.includes(preferredTime)) {
        setPreferredTime(null);
      }

      return newTimes;
    });
    setHasChanges(true);
  };

  const setAsPreferred = (time: string) => {
    if (!selectedTimes.includes(time)) return;
    setPreferredTime(prev => prev === time ? null : time);
    setHasChanges(true);
  };

  const handleVote = async () => {
    if (selectedTimes.length === 0) return;

    const success = await vote({
      poll_id: poll.id,
      available_times: selectedTimes,
      preferred_time: preferredTime || undefined,
    });

    if (success) {
      setHasChanges(false);
      onVoteChange();
    }
  };

  const handleRemoveVote = async () => {
    const success = await removeVote(poll.id);
    if (success) {
      setSelectedTimes([]);
      setPreferredTime(null);
      setHasChanges(false);
      onVoteChange();
    }
  };

  const handleClosePoll = async () => {
    // Find the time with most votes
    const maxVotes = Math.max(...Object.values(poll.votes_by_time));
    const winningTime = Object.entries(poll.votes_by_time)
      .find(([, count]) => count === maxVotes)?.[0];

    await closePoll(poll.id, winningTime);
    onVoteChange();
  };

  const handleDeletePoll = async () => {
    if (!confirm('Are you sure you want to delete this poll?')) return;
    await deletePoll(poll.id);
    onVoteChange();
  };

  const maxVotes = Math.max(...Object.values(poll.votes_by_time), 1);
  const isOpen = poll.status === 'open';

  return (
    <div className={`rounded-xl border ${
      isOpen ? 'bg-stone-800/50 border-stone-600' : 'bg-stone-900/50 border-stone-700'
    }`}>
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isOpen ? 'bg-emerald-600/20' : 'bg-stone-700'}`}>
            <Clock className={`w-5 h-5 ${isOpen ? 'text-emerald-400' : 'text-stone-500'}`} />
          </div>
          <div>
            <h4 className="font-medium text-stone-200">{poll.title}</h4>
            <div className="flex items-center gap-3 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {poll.total_voters} vote{poll.total_voters !== 1 ? 's' : ''}
              </span>
              {poll.training_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(poll.training_date).toLocaleDateString()}
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
        <div className="flex items-center gap-2">
          {poll.selected_time && (
            <span className="px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded-lg text-sm font-medium">
              {poll.selected_time} UTC
            </span>
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
        <div className="px-4 pb-4 space-y-4">
          {poll.description && (
            <p className="text-sm text-stone-400">{poll.description}</p>
          )}

          {/* Time slots */}
          <div className="space-y-2">
            {poll.time_slots.map(slot => {
              const voteCount = poll.votes_by_time[slot] || 0;
              const percentage = (voteCount / maxVotes) * 100;
              const isSelected = selectedTimes.includes(slot);
              const isPreferred = preferredTime === slot;
              const isWinner = poll.selected_time === slot;

              return (
                <div key={slot} className="relative">
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      isWinner
                        ? 'bg-emerald-600/20 border-emerald-500'
                        : isOpen && isSelected
                        ? 'bg-stone-700 border-emerald-500'
                        : 'bg-stone-800 border-stone-700'
                    } ${isOpen ? 'cursor-pointer hover:border-stone-500' : ''}`}
                    onClick={() => isOpen && toggleTime(slot)}
                  >
                    {/* Progress bar background */}
                    <div
                      className={`absolute inset-0 rounded-lg transition-all ${
                        isWinner ? 'bg-emerald-600/10' : 'bg-stone-600/20'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />

                    <div className="relative flex items-center gap-3">
                      {isOpen && (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600'
                            : 'border-stone-500'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-stone-200">{slot} UTC</span>
                        <span className="text-xs text-stone-500 ml-2">({utcToLocal(slot)} local)</span>
                      </div>
                      {isPreferred && (
                        <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px] font-medium">
                          PREFERRED
                        </span>
                      )}
                      {isWinner && (
                        <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-medium">
                          SELECTED
                        </span>
                      )}
                    </div>

                    <div className="relative flex items-center gap-2">
                      <span className="text-sm font-medium text-stone-300">
                        {voteCount} vote{voteCount !== 1 ? 's' : ''}
                      </span>
                      {isOpen && isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAsPreferred(slot);
                          }}
                          className={`p-1 rounded ${
                            isPreferred
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'hover:bg-stone-600 text-stone-500'
                          }`}
                          title="Mark as preferred"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vote actions */}
          {isOpen && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-stone-500">
                {poll.user_vote
                  ? `You voted for ${poll.user_vote.available_times.length} time${poll.user_vote.available_times.length !== 1 ? 's' : ''}`
                  : 'Select times you can attend'}
              </div>
              <div className="flex gap-2">
                {poll.user_vote && (
                  <button
                    onClick={handleRemoveVote}
                    disabled={voteLoading}
                    className="px-3 py-1.5 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    Remove Vote
                  </button>
                )}
                <button
                  onClick={handleVote}
                  disabled={voteLoading || selectedTimes.length === 0 || !hasChanges}
                  className="px-4 py-1.5 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {voteLoading ? 'Saving...' : poll.user_vote ? 'Update Vote' : 'Submit Vote'}
                </button>
              </div>
            </div>
          )}

          {/* Leader actions */}
          {isLeader && (
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-700">
              {isOpen ? (
                <button
                  onClick={handleClosePoll}
                  disabled={manageLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Close Poll
                </button>
              ) : (
                <button
                  onClick={async () => {
                    const { reopenPoll } = useManagePoll();
                    await reopenPoll(poll.id);
                    onVoteChange();
                  }}
                  disabled={manageLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-stone-700 text-stone-300 hover:bg-stone-600 flex items-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Reopen
                </button>
              )}
              <button
                onClick={handleDeletePoll}
                disabled={manageLoading}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 flex items-center gap-1.5"
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

  const filteredPolls = polls.filter(poll => {
    if (filter === 'all') return true;
    return poll.status === filter;
  });

  const openPolls = polls.filter(p => p.status === 'open');
  const closedPolls = polls.filter(p => p.status === 'closed');

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-200">Training Time Polls</h3>
          <p className="text-sm text-stone-500">
            Vote for times that work for you (all times in UTC)
          </p>
        </div>
        {isLeaderOrAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Poll
          </button>
        )}
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
          <p>No {filter !== 'all' ? filter : ''} polls yet</p>
          {isLeaderOrAdmin && filter !== 'closed' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-3 text-emerald-400 hover:text-emerald-300"
            >
              Create the first poll
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPolls.map(poll => (
            <PollCard
              key={poll.id}
              poll={poll}
              isLeader={isLeaderOrAdmin}
              onVoteChange={refetch}
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
