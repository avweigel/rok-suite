'use client';

import { useState, useEffect, useMemo } from 'react';
import { Clock, Plus, Check, X, Users, ChevronDown, ChevronUp, Trash2, Lock, Unlock, Globe, MapPin, User, Info, Calendar, CheckCircle2, Eye, EyeOff, Download } from 'lucide-react';
import { useRef, useCallback } from 'react';
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

  switch (mode) {
    case 'utc':
      return <span className="font-mono text-sm">{parseSlot(time).time}</span>;
    case 'local':
      return (
        <span className="font-mono text-sm">
          {local.time} <span className={`font-bold ${local.period === 'AM' ? 'text-sky-400' : 'text-amber-400'}`}>{local.period}</span>
        </span>
      );
    case 'both':
    default:
      return (
        <div className="text-center">
          <div className="font-mono text-sm font-medium">
            {local.time} <span className={`font-bold ${local.period === 'AM' ? 'text-sky-400' : 'text-amber-400'}`}>{local.period}</span>
          </div>
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
  const clearTimes = () => setSelectedTimes([]);

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
                <button type="button" onClick={clearTimes} className="text-xs text-stone-400 hover:text-stone-300">
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {allTimes.map(time => {
                const local = utcToLocal(time);
                const isSelected = selectedTimes.includes(time);
                const isAM = local.period === 'AM';
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
                    <div className="text-xs font-medium">
                      {local.time} <span className={`font-bold ${isAM ? 'text-sky-400' : 'text-amber-400'}`}>{local.period}</span>
                    </div>
                    <div className="text-[10px] opacity-60">{time} UTC</div>
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
// AVAILABILITY GRID - Easy multi-day selection with row/column helpers + drag
// =============================================================================

interface AvailabilityGridProps {
  poll: PollWithResults;
  selectedSlots: Set<string>;
  onToggle: (slot: string) => void;
  onToggleMany: (slots: string[]) => void;
  timeDisplay: TimeDisplay;
  isOpen: boolean;
  voterName: string;
}

function AvailabilityGrid({ poll, selectedSlots, onToggle, onToggleMany, timeDisplay, isOpen, voterName }: AvailabilityGridProps) {
  const dates = getUniqueDates(poll.time_slots);
  const times = getUniqueTimes(poll.time_slots);
  const maxVotes = Math.max(...Object.values(poll.votes_by_time), 1);

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');
  const [draggedSlots, setDraggedSlots] = useState<Set<string>>(new Set());

  // Get all slots for a given date (column)
  const getSlotsForDate = (date: string) => poll.time_slots.filter(s => s.startsWith(date));
  // Get all slots for a given time (row)
  const getSlotsForTime = (time: string) => poll.time_slots.filter(s => s.endsWith(time));

  // Check if all slots in a set are selected
  const allSelected = (slots: string[]) => slots.every(s => selectedSlots.has(s));

  // Drag handlers
  const handleDragStart = (slot: string) => {
    if (!isOpen) return;
    setIsDragging(true);
    // If slot is already selected, we're deselecting; otherwise selecting
    const mode = selectedSlots.has(slot) ? 'deselect' : 'select';
    setDragMode(mode);
    setDraggedSlots(new Set([slot]));
    onToggle(slot);
  };

  const handleDragEnter = (slot: string) => {
    if (!isDragging || !isOpen) return;
    if (draggedSlots.has(slot)) return; // Already processed this slot

    setDraggedSlots(prev => new Set([...prev, slot]));

    // Apply the drag mode
    const isCurrentlySelected = selectedSlots.has(slot);
    if (dragMode === 'select' && !isCurrentlySelected) {
      onToggle(slot);
    } else if (dragMode === 'deselect' && isCurrentlySelected) {
      onToggle(slot);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedSlots(new Set());
  };

  // Global mouse up listener to end drag
  useEffect(() => {
    const handleGlobalUp = () => {
      if (isDragging) handleDragEnd();
    };
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isDragging]);

  // Build tooltip for a cell
  const getCellTooltip = (slot: string, voteCount: number, voters: string[]) => {
    const lines: string[] = [];
    if (voteCount > 0) {
      lines.push(`${voteCount} available: ${voters.join(', ')}`);
    }
    if (isOpen) {
      lines.push('Click to toggle • Drag to select multiple');
    }
    return lines.join('\n');
  };

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

  // Multi-day grid view with clickable headers
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full border-collapse min-w-[400px]">
        <thead>
          <tr>
            <th className="text-left text-xs text-stone-500 pb-2 pr-2 sticky left-0 bg-stone-800/95 z-10">
              <div>{getTimezoneAbbr() || 'Local'}</div>
              <div className="text-[10px] text-stone-600">UTC</div>
            </th>
            {dates.map(date => {
              const dateSlots = getSlotsForDate(date);
              const isAllSelected = allSelected(dateSlots);
              const someSelected = dateSlots.some(s => selectedSlots.has(s));
              const selectedCount = dateSlots.filter(s => selectedSlots.has(s)).length;
              const d = new Date(date + 'T00:00:00');
              return (
                <th key={date} className="text-center pb-2 px-0.5 min-w-[52px]">
                  <button
                    onClick={() => isOpen && onToggleMany(dateSlots)}
                    disabled={!isOpen}
                    className={`w-full px-1 py-1 rounded-lg transition-all border ${
                      isOpen ? 'hover:bg-emerald-600/10 hover:border-emerald-500/50 cursor-pointer' : ''
                    } ${isAllSelected ? 'bg-emerald-600/20 border-emerald-500/50' : someSelected ? 'border-emerald-500/30' : 'border-transparent'}`}
                    title={isOpen
                      ? `Click to ${isAllSelected ? 'deselect' : 'select'} all ${dateSlots.length} times on ${formatDate(date)}${selectedCount > 0 ? ` (${selectedCount} selected)` : ''}`
                      : formatDate(date)}
                  >
                    <div className="text-[10px] text-stone-500 uppercase">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                    <div className={`text-sm font-bold ${isAllSelected ? 'text-emerald-400' : 'text-stone-400'}`}>{d.getDate()}</div>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {times.map(time => {
            const local = utcToLocal(time);
            const timeSlots = getSlotsForTime(time);
            const isAllSelected = allSelected(timeSlots);
            const someSelected = timeSlots.some(s => selectedSlots.has(s));
            const selectedCount = timeSlots.filter(s => selectedSlots.has(s)).length;
            const isAM = local.period === 'AM';

            return (
              <tr key={time}>
                <td className="py-0.5 pr-1 sticky left-0 bg-stone-800/95 z-10">
                  <button
                    onClick={() => isOpen && onToggleMany(timeSlots)}
                    disabled={!isOpen}
                    className={`w-full text-left px-1.5 py-1 rounded-lg transition-all text-xs border ${
                      isOpen ? 'hover:bg-emerald-600/10 hover:border-emerald-500/50 cursor-pointer' : ''
                    } ${isAllSelected ? 'bg-emerald-600/20 border-emerald-500/50' : someSelected ? 'border-emerald-500/30' : 'border-transparent'}`}
                    title={isOpen
                      ? `Click to ${isAllSelected ? 'deselect' : 'select'} ${local.time} ${local.period} on all ${timeSlots.length} days${selectedCount > 0 ? ` (${selectedCount} selected)` : ''}`
                      : `${local.time} ${local.period} (${time} UTC)`}
                  >
                    <div className={isAllSelected ? 'text-emerald-400' : 'text-stone-300'}>
                      {local.time} <span className={`font-bold ${isAM ? 'text-sky-400' : 'text-amber-400'}`}>{local.period}</span>
                    </div>
                    <div className={`text-[10px] ${isAllSelected ? 'text-emerald-400/60' : 'text-stone-500'}`}>
                      {time} UTC
                    </div>
                  </button>
                </td>
                {dates.map(date => {
                  const slot = `${date} ${time}`;
                  if (!poll.time_slots.includes(slot)) {
                    return <td key={slot} className="p-0.5"><div className="w-full h-9 bg-stone-900/30 rounded" /></td>;
                  }

                  const voteCount = poll.votes_by_time[slot] || 0;
                  const isSelected = selectedSlots.has(slot);
                  const isWinner = poll.selected_time === slot;
                  const isBest = voteCount === maxVotes && voteCount > 0;
                  const voters = poll.voters_by_time[slot] || [];

                  // Calculate display count (include user's pending vote)
                  const displayCount = isSelected && !voters.includes(voterName)
                    ? voteCount + 1
                    : voteCount;

                  // Gray gradient for others' votes based on intensity
                  const getGrayIntensity = () => {
                    if (maxVotes === 0) return 'bg-stone-800/60';
                    const intensity = voteCount / maxVotes;
                    if (intensity >= 0.8) return 'bg-stone-500';
                    if (intensity >= 0.6) return 'bg-stone-600';
                    if (intensity >= 0.4) return 'bg-stone-700';
                    if (intensity > 0) return 'bg-stone-700/70';
                    return 'bg-stone-800/60';
                  };

                  // Cell styling
                  const getCellStyle = () => {
                    if (isWinner) return 'bg-emerald-500 text-white ring-2 ring-emerald-400';
                    if (isSelected) return 'bg-emerald-600 text-white';
                    if (isBest) return 'bg-amber-500/30 text-amber-300';
                    if (voteCount > 0) return `${getGrayIntensity()} text-stone-300`;
                    return 'bg-stone-800/60 text-stone-600';
                  };

                  return (
                    <td key={slot} className="p-0.5">
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleDragStart(slot); }}
                        onMouseEnter={() => handleDragEnter(slot)}
                        onTouchStart={(e) => { e.preventDefault(); handleDragStart(slot); }}
                        onTouchMove={(e) => {
                          const touch = e.touches[0];
                          const element = document.elementFromPoint(touch.clientX, touch.clientY);
                          const slotAttr = element?.closest('[data-slot]')?.getAttribute('data-slot');
                          if (slotAttr) handleDragEnter(slotAttr);
                        }}
                        data-slot={slot}
                        disabled={!isOpen}
                        className={`w-full h-9 rounded flex items-center justify-center text-xs font-medium transition-all select-none ${getCellStyle()} ${isOpen ? 'hover:ring-1 hover:ring-white/30 cursor-pointer' : ''}`}
                        title={getCellTooltip(slot, voteCount, voters)}
                      >
                        {displayCount > 0 ? displayCount : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-stone-500">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-emerald-600 text-[9px] text-white flex items-center justify-center font-medium">2</span>
          your picks
        </span>
        <span className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            <span className="w-3 h-4 rounded-sm bg-stone-700/70"></span>
            <span className="w-3 h-4 rounded-sm bg-stone-600"></span>
            <span className="w-3 h-4 rounded-sm bg-stone-500"></span>
          </div>
          more votes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-amber-500/30"></span>
          best
        </span>
        {isOpen && <span className="text-stone-600">• click or drag to select</span>}
      </div>
    </div>
  );
}

// =============================================================================
// BEST TIMES SUMMARY - Shows optimal times ranked by availability
// =============================================================================

interface BestTimesSummaryProps {
  poll: PollWithResults;
  timeDisplay: TimeDisplay;
}

function BestTimesSummary({ poll, timeDisplay }: BestTimesSummaryProps) {
  // Get all time slots sorted by vote count (descending)
  const rankedTimes = useMemo(() => {
    const entries = Object.entries(poll.votes_by_time)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    return entries.map(([slot, count]) => ({
      slot,
      count,
      voters: poll.voters_by_time[slot] || [],
      percentage: Math.round((count / poll.total_voters) * 100),
    }));
  }, [poll.votes_by_time, poll.voters_by_time, poll.total_voters]);

  if (rankedTimes.length === 0) return null;

  // Get top 3 times
  const topTimes = rankedTimes.slice(0, 3);
  const maxVotes = topTimes[0]?.count || 0;

  return (
    <div className="rounded-lg bg-stone-900/80 border border-stone-700 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-stone-800/50 border-b border-stone-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Top Times</span>
        <span className="text-xs text-stone-500">{poll.total_voters} voted</span>
      </div>

      {/* Top times list */}
      <div className="divide-y divide-stone-700/50">
        {topTimes.map(({ slot, count, voters, percentage }, idx) => {
          const parsed = parseSlot(slot);
          const local = utcToLocal(parsed.time);
          const isAM = local.period === 'AM';
          const isBest = count === maxVotes;

          return (
            <div key={slot} className={`px-3 py-2.5 flex items-center gap-3 ${isBest ? 'bg-amber-500/10' : ''}`}>
              {/* Rank */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isBest ? 'bg-amber-500 text-stone-900' : 'bg-stone-700 text-stone-400'
              }`}>
                {idx + 1}
              </div>

              {/* Time */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-base font-bold ${isBest ? 'text-amber-300' : 'text-stone-200'}`}>
                    {local.time}
                  </span>
                  <span className={`text-sm font-medium ${isAM ? 'text-sky-400' : 'text-amber-400'}`}>
                    {local.period}
                  </span>
                  {parsed.date && (
                    <span className="text-xs text-stone-500 ml-1">{formatDate(parsed.date)}</span>
                  )}
                </div>
                <div className="text-[10px] text-stone-500 truncate" title={voters.join(', ')}>
                  {voters.join(', ')}
                </div>
              </div>

              {/* Vote count */}
              <div className="text-right shrink-0">
                <div className={`text-lg font-bold ${isBest ? 'text-amber-400' : 'text-stone-300'}`}>{count}</div>
                <div className="text-[10px] text-stone-500">{percentage}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// EXPORT POLL IMAGE - Creates a shareable snapshot of poll results
// =============================================================================

interface ExportPollImageProps {
  poll: PollWithResults;
}

function ExportPollImage({ poll }: ExportPollImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const exportImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get dates and filter times to only those with votes
    const dates = getUniqueDates(poll.time_slots);
    const allTimes = getUniqueTimes(poll.time_slots);

    // Filter to times that have at least one vote
    const timesWithVotes = allTimes.filter(time => {
      return dates.some(date => {
        const slot = dates.length > 0 ? `${date} ${time}` : time;
        return (poll.votes_by_time[slot] || 0) > 0;
      });
    });

    // If no votes, use all times
    const times = timesWithVotes.length > 0 ? timesWithVotes : allTimes;

    // Get top times for summary
    const rankedTimes = Object.entries(poll.votes_by_time)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Canvas dimensions
    const cellWidth = 50;
    const cellHeight = 32;
    const headerHeight = 40;
    const timeColWidth = 70;
    const padding = 20;
    const titleHeight = 50;
    const summaryHeight = rankedTimes.length > 0 ? 30 + rankedTimes.length * 24 : 0;

    const width = timeColWidth + (dates.length || 1) * cellWidth + padding * 2;
    const height = titleHeight + headerHeight + times.length * cellHeight + summaryHeight + padding * 2;

    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#1c1917'; // stone-900
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#fafaf9'; // stone-50
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(poll.title, padding, padding + 20);

    ctx.fillStyle = '#78716c'; // stone-500
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${poll.total_voters} responses`, padding, padding + 38);

    const tableTop = padding + titleHeight;

    // Date headers
    ctx.fillStyle = '#a8a29e'; // stone-400
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';

    if (dates.length > 0) {
      dates.forEach((date, i) => {
        const x = padding + timeColWidth + i * cellWidth + cellWidth / 2;
        const d = new Date(date + 'T00:00:00');
        const dayStr = d.toLocaleDateString(undefined, { weekday: 'short' });
        const dateStr = d.getDate().toString();
        ctx.fillText(dayStr, x, tableTop + 14);
        ctx.fillText(dateStr, x, tableTop + 28);
      });
    }

    // Time rows (UTC only)
    ctx.textAlign = 'left';
    times.forEach((time, rowIdx) => {
      const y = tableTop + headerHeight + rowIdx * cellHeight;

      // Time label
      ctx.fillStyle = '#d6d3d1'; // stone-300
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(`${time} UTC`, padding + 4, y + 20);

      // Cells
      const cols = dates.length > 0 ? dates : [''];
      cols.forEach((date, colIdx) => {
        const slot = date ? `${date} ${time}` : time;
        const voteCount = poll.votes_by_time[slot] || 0;
        const x = padding + timeColWidth + colIdx * cellWidth;

        // Cell background based on votes
        const maxVotes = Math.max(...Object.values(poll.votes_by_time), 1);
        const intensity = voteCount / maxVotes;

        if (voteCount > 0) {
          if (intensity >= 0.8) ctx.fillStyle = '#78716c'; // stone-500
          else if (intensity >= 0.6) ctx.fillStyle = '#57534e'; // stone-600
          else if (intensity >= 0.4) ctx.fillStyle = '#44403c'; // stone-700
          else ctx.fillStyle = '#292524'; // stone-800
        } else {
          ctx.fillStyle = '#1c1917'; // stone-900
        }

        ctx.fillRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4);

        // Vote count
        if (voteCount > 0) {
          ctx.fillStyle = '#fafaf9';
          ctx.font = 'bold 12px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(voteCount.toString(), x + cellWidth / 2, y + 20);
          ctx.textAlign = 'left';
        }
      });
    });

    // Best times summary at bottom
    if (rankedTimes.length > 0) {
      const summaryY = tableTop + headerHeight + times.length * cellHeight + 16;

      ctx.fillStyle = '#fbbf24'; // amber-400
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('TOP TIMES:', padding, summaryY);

      rankedTimes.forEach(([slot, count], idx) => {
        const parsed = parseSlot(slot);
        const timeStr = parsed.date
          ? `${parsed.time} UTC - ${formatDate(parsed.date)}`
          : `${parsed.time} UTC`;

        ctx.fillStyle = idx === 0 ? '#fbbf24' : '#d6d3d1'; // amber-400 or stone-300
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(`${idx + 1}. ${timeStr} (${count} votes)`, padding + 10, summaryY + 18 + idx * 24);
      });
    }

    // Download
    const link = document.createElement('a');
    link.download = `${poll.title.replace(/\s+/g, '-').toLowerCase()}-results.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [poll]);

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <button
        onClick={exportImage}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-stone-400 hover:text-stone-300 hover:bg-stone-700/50 rounded transition-colors"
        title="Export as image"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>
    </>
  );
}

// =============================================================================
// VIEW RESPONSES - Shows all voters and their selections
// =============================================================================

interface ViewResponsesProps {
  poll: PollWithResults;
  timeDisplay: TimeDisplay;
}

function ViewResponses({ poll, timeDisplay }: ViewResponsesProps) {
  const dates = getUniqueDates(poll.time_slots);
  const times = getUniqueTimes(poll.time_slots);

  if (poll.all_votes.length === 0) {
    return (
      <div className="text-center py-4 text-stone-500 text-sm">
        No responses yet
      </div>
    );
  }

  // Sort votes by name
  const sortedVotes = [...poll.all_votes].sort((a, b) =>
    (a.voter_name || 'Anonymous').localeCompare(b.voter_name || 'Anonymous')
  );

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-400">{poll.all_votes.length} response{poll.all_votes.length !== 1 ? 's' : ''}</span>
        <span className="text-stone-500 text-xs">
          {dates.length > 0 ? `${dates.length} days × ${times.length} times` : `${times.length} time slots`}
        </span>
      </div>

      {/* Voter list */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {sortedVotes.map((vote) => {
          const voterName = vote.voter_name || 'Anonymous';
          const availableCount = vote.available_times.length;
          const totalSlots = poll.time_slots.length;
          const percentage = Math.round((availableCount / totalSlots) * 100);

          return (
            <div
              key={vote.id}
              className="p-3 rounded-lg bg-stone-700/30 border border-stone-700"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-stone-500" />
                  <span className="font-medium text-stone-200">{voterName}</span>
                </div>
                <div className="text-xs text-stone-500">
                  {availableCount}/{totalSlots} slots ({percentage}%)
                </div>
              </div>

              {/* Availability summary */}
              {dates.length > 0 ? (
                // Multi-day: show compact grid
                <div className="flex flex-wrap gap-1">
                  {dates.map(date => {
                    const d = new Date(date + 'T00:00:00');
                    const dayAbbr = d.toLocaleDateString(undefined, { weekday: 'short' });
                    const availableForDate = vote.available_times.filter(t => t.startsWith(date)).length;
                    const totalForDate = times.length;
                    const hasAny = availableForDate > 0;
                    const hasAll = availableForDate === totalForDate;

                    return (
                      <div
                        key={date}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          hasAll
                            ? 'bg-emerald-600/30 text-emerald-400'
                            : hasAny
                            ? 'bg-emerald-600/10 text-emerald-400/70'
                            : 'bg-stone-800 text-stone-600'
                        }`}
                        title={`${availableForDate}/${totalForDate} times on ${formatDate(date)}`}
                      >
                        {dayAbbr} {availableForDate > 0 && <span className="opacity-70">({availableForDate})</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Time-only: show list of times
                <div className="flex flex-wrap gap-1">
                  {vote.available_times.map(slot => (
                    <span
                      key={slot}
                      className="px-2 py-0.5 rounded text-xs bg-emerald-600/20 text-emerald-400"
                    >
                      {formatTimeForDisplay(slot, timeDisplay)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
  const [showResponses, setShowResponses] = useState(false);
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

  const toggleMany = (slots: string[]) => {
    setSelectedSlots(prev => {
      const next = new Set(prev);
      // If all are selected, deselect all. Otherwise, select all.
      const allSelected = slots.every(s => next.has(s));
      if (allSelected) {
        slots.forEach(s => next.delete(s));
      } else {
        slots.forEach(s => next.add(s));
      }
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
            onToggleMany={toggleMany}
            timeDisplay={timeDisplay}
            isOpen={isOpen}
            voterName={voterName}
          />

          {/* Best Times Summary - at bottom for easy scanning */}
          {poll.total_voters > 0 && (
            <BestTimesSummary poll={poll} timeDisplay={timeDisplay} />
          )}

          {/* View Responses Toggle & Export */}
          {poll.total_voters > 0 && (
            <div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowResponses(!showResponses)}
                  className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-400 transition-colors"
                >
                  {showResponses ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showResponses ? 'Hide' : 'View'} individual responses
                </button>
                <ExportPollImage poll={poll} />
              </div>

              {showResponses && (
                <div className="mt-3 p-3 rounded-lg bg-stone-900/50 border border-stone-700">
                  <ViewResponses poll={poll} timeDisplay={timeDisplay} />
                </div>
              )}
            </div>
          )}

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
