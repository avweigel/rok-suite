'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/lib/supabase';
import {
  useMgeEvents,
  createMgeEventFull,
  deleteMgeEvent,
  type MgeEvent,
} from '@/lib/supabase/use-mge';
import { Shield, Plus, Crown, Trash2, CheckSquare, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MgeEventCard } from '@/components/mge/MgeEventCard';
import { MgeEventSetup } from '@/components/mge/MgeEventSetup';
import { tierSortValue } from '@/lib/mge/helpers';

import { AuthGate } from '@/components/AuthGate';
import { meetsRole, useAuthRole } from '@/lib/auth-role';

interface RosterMember {
  id: string;
  name: string;
  alliance: string | null;
  power: number;
}

const KINGDOM_HEADER = `<size=30px><color=#4d0000>KINGDOM 3923</color> <color=#cc0000>—</color> <color=#4d0000>A</color><color=#660000>N</color><color=#800000>G</color><color=#990000>M</color><color=#b30000>A</color><color=#cc0000>R</color> <color=#4d0000>N</color><color=#660000>A</color><color=#800000>Z</color><color=#990000>G</color><color=#b30000>U</color><color=#cc0000>L</color> <color=#e60000>G</color><color=#ff0000>U</color><color=#ff0000>A</color><color=#cc0000>R</color><color=#990000>D</color><color=#800000>S</color></size>`;
const KINGDOM_DIVIDER = '►═════════❂❂❂═════════◄';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPower(power: number): string {
  if (power >= 1_000_000) return `${(power / 1_000_000).toFixed(1)}M`;
  if (power >= 1_000) return `${(power / 1_000).toFixed(0)}K`;
  return power.toString();
}

function formatPointsCap(points: number): string {
  return points.toLocaleString('en-US');
}

function generateApplicationsMail(evt: MgeEvent): string {
  const commanders = evt.mge_event_commanders.length > 0
    ? evt.mge_event_commanders.map(c => c.commander_name)
    : evt.focused_commander.split(',').map(c => c.trim());
  const focusCommander = evt.mge_event_commanders.find(c => c.is_focus)?.commander_name
    || commanders[0] || '';

  const lines: string[] = [];
  lines.push(KINGDOM_HEADER);
  lines.push(KINGDOM_DIVIDER);
  lines.push('');
  lines.push(`<b><color=#ff3333>MGE — APPLICATIONS OPEN</color></b>`);
  lines.push('');
  lines.push(`<b>Commander:</b> ${commanders.join(', ')}`);
  lines.push(`<b>Date:</b> ${formatDate(evt.event_date)}`);
  if (evt.application_deadline) {
    lines.push(`<b>Deadline:</b> ${formatDate(evt.application_deadline)}`);
  }
  lines.push('');
  if (evt.notes) {
    lines.push(evt.notes);
    lines.push('');
  }

  if (evt.mge_rank_tiers.length > 0) {
    lines.push('<b>Available Ranks:</b>');
    for (const tier of evt.mge_rank_tiers) {
      const cap = tier.point_cap ? ` — ${formatPointsCap(tier.point_cap)} points` : '';
      const ffa = tier.is_ffa ? ' (free for all)' : '';
      lines.push(`${tier.tier_label}${cap}${ffa}`);
    }
    lines.push('');
  }

  lines.push(`If you want to compete for a ranking spot, submit your <b>${focusCommander}</b> stats at:`);
  lines.push(`<b>https://rok-suite.vercel.app/mge</b>`);
  lines.push('');
  lines.push(KINGDOM_DIVIDER);
  lines.push(`<b><color=#800000>— King Fluffy</color></b>`);

  return lines.join('\n');
}

function generateRankingsMail(evt: MgeEvent): string {
  // Build a unified rankings list from finalized selections + approved pending assignments
  const tierCapMap = new Map(evt.mge_rank_tiers.map(t => [t.tier_label, t.point_cap]));

  interface RankEntry { tier: string; name: string; pointCap: number | null; isFfa: boolean; sortVal: number }
  const entries: RankEntry[] = [];

  // Finalized selections
  for (const sel of evt.mge_selections) {
    const isFfa = sel.member_name === 'Free for All';
    entries.push({
      tier: sel.ranking_tier,
      name: isFfa ? 'Free for all' : sel.member_name,
      pointCap: sel.power_cap || tierCapMap.get(sel.ranking_tier) || null,
      isFfa,
      sortVal: sel.sort_order,
    });
  }

  // Approved applications with assigned tiers (not yet finalized)
  const selNames = new Set(evt.mge_selections.map(s => s.member_name.toLowerCase()));
  for (const app of evt.mge_applications || []) {
    if (app.status === 'approved' && app.assigned_tier && !selNames.has(app.applicant_name.toLowerCase())) {
      entries.push({
        tier: app.assigned_tier,
        name: app.applicant_name,
        pointCap: tierCapMap.get(app.assigned_tier) || null,
        isFfa: false,
        sortVal: tierSortValue(app.assigned_tier),
      });
    }
  }

  // Sort by tier order
  entries.sort((a, b) => a.sortVal - b.sortVal);

  // Also include FFA tiers that have no one assigned (just show the cap)
  const usedTiers = new Set(entries.map(e => e.tier));
  for (const tier of evt.mge_rank_tiers) {
    if (tier.is_ffa && !usedTiers.has(tier.tier_label)) {
      entries.push({
        tier: tier.tier_label,
        name: 'Free for all',
        pointCap: tier.point_cap,
        isFfa: true,
        sortVal: tier.sort_order,
      });
    }
  }
  entries.sort((a, b) => a.sortVal - b.sortVal);

  const lines: string[] = [];
  lines.push(KINGDOM_HEADER);
  lines.push(KINGDOM_DIVIDER);
  lines.push('');
  lines.push(`<b><color=#ff3333>MGE RANKINGS UPDATE</color></b>`);
  lines.push('');

  const commanders = evt.mge_event_commanders.length > 0
    ? evt.mge_event_commanders.map(c => c.commander_name)
    : evt.focused_commander.split(',').map(c => c.trim());
  lines.push(`<b>Commander:</b> ${commanders.join(', ')}`);
  lines.push('');

  if (evt.notes) {
    lines.push(evt.notes);
    lines.push('');
  }

  let lowestCap = 0;
  for (const entry of entries) {
    const tier = entry.isFfa ? entry.tier.replace(' Place', '+') : `<b>${entry.tier}</b>`;
    const pts = entry.pointCap ? ` - <b>${formatPointsCap(entry.pointCap)}</b> points${entry.isFfa ? ' max' : ''}` : '';
    lines.push(`${tier} - ${entry.name}${pts}`);
    if (entry.pointCap && (lowestCap === 0 || entry.pointCap < lowestCap)) {
      lowestCap = entry.pointCap;
    }
  }

  lines.push('');
  if (lowestCap > 0) {
    lines.push(`<b>Do not exceed your limit. If you're not on this list, stay under ${formatPointsCap(lowestCap)} to avoid unpleasant consequences</b>`);
    lines.push('');
  }
  lines.push(KINGDOM_DIVIDER);
  lines.push(`<b><color=#800000>— King Fluffy</color></b>`);

  return lines.join('\n');
}

type StatusFilter = 'all' | 'active' | 'past';

export default function MgePage() {
  return (
    <AuthGate require="power" sidebar title="MGE">
      <MgePageInner />
    </AuthGate>
  );
}

function MgePageInner() {
  const t = useTranslations('mge');
  const { events, loading, error, refetch } = useMgeEvents();

  // Two levels, from the site's sign-in: officers manage, admins also create and delete.
  const { role } = useAuthRole();
  const isAdmin = meetsRole(role, 'admin');
  const isOfficer = meetsRole(role, 'officer');

  // New event form
  const [showNewForm, setShowNewForm] = useState(false);

  // Expanded events
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(() => new Set());

  // Status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  // Bulk-select mode for admin cleanup. Designed so the typical past-event
  // cleanup flow is one click ("Manage events" → switches to Past filter, lets
  // admin tick boxes, then bulk delete) instead of expanding each event and
  // trash-iconing one by one.
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Roster for member autocomplete (shared across cards)
  const [roster, setRoster] = useState<RosterMember[]>([]);

  useEffect(() => {
    async function fetchRoster() {
      const { data } = await supabase
        .from('alliance_roster')
        .select('id, name, alliance, power')
        .eq('is_active', true)
        .order('power', { ascending: false });
      setRoster(data || []);
    }
    fetchRoster();
  }, []);

  // Auto-expand the newest event (skip while bulk-selecting — the click target
  // is repurposed for selection in that mode, so auto-expanding adds noise).
  useEffect(() => {
    if (bulkMode) return;
    if (events.length > 0 && expandedEvents.size === 0) {
      setExpandedEvents(new Set([events[0].id]));
    }
  }, [events, expandedEvents.size, bulkMode]);

  // Restrict to publicly-visible events for non-admins. Bulk-mode cleanup is
  // an admin-only operation so the same restriction applies there.
  const baseEvents = useMemo(
    () =>
      isAdmin
        ? events
        : events.filter(e => e.is_published || e.status === 'open' || e.status === 'reviewing'),
    [events, isAdmin],
  );

  const isActiveStatus = (s: string | null | undefined) =>
    ['draft', 'open', 'reviewing', 'finalized'].includes(s || '');

  // Per-bucket counts so the filter pills can show "Active (3)" / "Past (12)"
  // — naive users couldn't tell what was hidden behind the default filter.
  const counts = useMemo(() => {
    let active = 0, past = 0;
    for (const e of baseEvents) {
      if (e.status === 'completed') past += 1;
      else if (isActiveStatus(e.status)) active += 1;
    }
    return { active, past, all: baseEvents.length };
  }, [baseEvents]);

  const visibleEvents = useMemo(() => {
    if (statusFilter === 'active') return baseEvents.filter(e => isActiveStatus(e.status));
    if (statusFilter === 'past') return baseEvents.filter(e => e.status === 'completed');
    return baseEvents;
  }, [baseEvents, statusFilter]);

  // Drop selected ids that are no longer visible (filter switched, refetch
  // dropped a row, etc.) so the bulk-delete count stays honest.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visibleSet = new Set(visibleEvents.map(e => e.id));
    let changed = false;
    const next = new Set<number>();
    for (const id of selectedIds) {
      if (visibleSet.has(id)) next.add(id);
      else changed = true;
    }
    if (changed) setSelectedIds(next);
  }, [visibleEvents, selectedIds]);

  const handleCreateEvent = async (data: {
    date: string;
    commanders: { name: string; isFocus: boolean }[];
    tiers: { label: string; pointCap: number | null; isFfa: boolean; rewardHeads?: number | null }[];
    notes: string;
    deadline: string;
  }) => {
    const result = await createMgeEventFull(
      data.date,
      data.commanders,
      data.tiers,
      data.notes || undefined,
      data.deadline || undefined,
    );
    if (result) {
      setShowNewForm(false);
      refetch();
    }
  };

  const handleGenerateMail = (evt: MgeEvent, type: 'applications' | 'rankings') => {
    const content = type === 'applications' ? generateApplicationsMail(evt) : generateRankingsMail(evt);
    localStorage.setItem('rok-mail-draft', content);
    window.location.href = '/rok-mail';
  };

  const toggleEvent = (id: number) => {
    const next = new Set(expandedEvents);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedEvents(next);
  };

  const enterCleanupMode = () => {
    setStatusFilter('past');
    setBulkMode(true);
    setSelectedIds(new Set());
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
    setShowBulkConfirm(false);
  };

  const toggleSelected = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => setSelectedIds(new Set(visibleEvents.map(e => e.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      // Sequential deletes — bulk size is small (handfuls of past events) and
      // serial keeps error reporting straightforward if one fails mid-flight.
      for (const id of selectedIds) {
        await deleteMgeEvent(id);
      }
      exitBulkMode();
      refetch();
    } finally {
      setBulkDeleting(false);
    }
  };

  // Cards we'd be deleting — used for the confirm panel preview.
  const selectedEvents = useMemo(
    () => visibleEvents.filter(e => selectedIds.has(e.id)),
    [visibleEvents, selectedIds],
  );

  const btnPrimary = 'px-4 py-2 rounded-md text-sm font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-fast';

  return (
    <AppSidebar>
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield size={28} className="text-blue-500" />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              {t('title')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={() => setShowNewForm(true)} className={btnPrimary}>
                <span className="flex items-center gap-1.5"><Plus size={16} /> {t('newEvent')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mode banner */}
        {isOfficer && (
          <div className="mb-4 px-4 py-2 rounded-lg border flex items-center gap-2 text-sm bg-blue-500/10 border-blue-500/30">
            <span className="font-medium text-blue-400">{isAdmin ? t('adminMode') : t('officerMode')}</span>
            <span style={{ color: 'var(--text-muted)' }}>—</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {isAdmin ? t('adminAccess') : t('officerAccess')}
            </span>
          </div>
        )}

        {/* Status filter pills + cleanup entry. Pills show counts so a naive
            user can see at a glance what's hidden behind the active filter. */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {([
            { key: 'active', label: t('filters.active'), count: counts.active },
            { key: 'past', label: t('filters.past'), count: counts.past },
            { key: 'all', label: t('filters.all'), count: counts.all },
          ] as { key: StatusFilter; label: string; count: number }[]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 text-sm rounded-md transition-fast ${
                statusFilter === key ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-[var(--background-secondary)]'
              }`}
              style={statusFilter !== key ? { color: 'var(--text-muted)' } : undefined}
            >
              {label} <span className="opacity-70">({count})</span>
            </button>
          ))}
          {isAdmin && !bulkMode && counts.all > 0 && (
            <>
              <div className="flex-1" />
              <button
                onClick={enterCleanupMode}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-fast text-zinc-400 hover:text-zinc-200 hover:bg-[var(--background-secondary)]"
                title="Bulk-delete past events"
              >
                <Trash2 size={14} />
                Clean up past events
              </button>
            </>
          )}
        </div>

        {/* Hint when Active filter hides past/draft events. Mirrors the Zero
            List "hidden" hint so the same naive user pattern works here. */}
        {!bulkMode && statusFilter === 'active' && counts.past > 0 && (
          <div className="mb-3 px-3 py-2 rounded-md text-xs flex flex-wrap items-center gap-2"
            style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <span>Hidden by &quot;Active&quot; filter:</span>
            <button onClick={() => setStatusFilter('past')} className="text-blue-400 hover:underline">
              {counts.past} past event{counts.past === 1 ? '' : 's'}
            </button>
            <span className="ml-auto">
              <button onClick={() => setStatusFilter('all')} className="text-[var(--text-secondary)] hover:underline">
                Show all
              </button>
            </span>
          </div>
        )}

        {/* Bulk-select toolbar — only when admin enters cleanup mode. Sticky-ish
            so it stays in view while the user scrolls a long past-event list. */}
        {bulkMode && isAdmin && (
          <div className="mb-3 rounded-lg border bg-blue-500/5 border-blue-500/30 px-3 py-2.5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-blue-300">Bulk select mode</span>
              <span className="text-xs text-[var(--text-muted)]">
                Click any event below to tick / untick it.
              </span>
              <div className="flex-1" />
              <button onClick={exitBulkMode}
                className="px-2.5 py-1 text-xs rounded-md hover:bg-[var(--background-secondary)] text-[var(--text-secondary)]">
                Cancel
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={selectedIds.size === visibleEvents.length && visibleEvents.length > 0 ? clearSelection : selectAllVisible}
                disabled={visibleEvents.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-[var(--border)] hover:bg-[var(--background-secondary)] disabled:opacity-40"
                style={{ color: 'var(--text-secondary)' }}
              >
                {selectedIds.size === visibleEvents.length && visibleEvents.length > 0
                  ? <><CheckSquare size={13} /> Clear selection</>
                  : <><Square size={13} /> Select all ({visibleEvents.length})</>}
              </button>
              <span className="text-xs text-[var(--text-secondary)]">
                <strong className="text-blue-300">{selectedIds.size}</strong> selected
              </span>
              <div className="flex-1" />
              <button
                onClick={() => setShowBulkConfirm(true)}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md font-medium bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} /> Delete {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}event{selectedIds.size === 1 ? '' : 's'}
              </button>
            </div>
            {showBulkConfirm && (
              <div className="mt-2 p-3 rounded-md border border-red-500/40 bg-red-500/5">
                <p className="text-sm text-red-300 font-medium mb-1">
                  Permanently delete {selectedIds.size} event{selectedIds.size === 1 ? '' : 's'}?
                </p>
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  This also removes their applications, selections, and tier rewards. Cannot be undone.
                </p>
                <ul className="text-xs space-y-0.5 mb-3 max-h-40 overflow-auto pr-1" style={{ color: 'var(--text-secondary)' }}>
                  {selectedEvents.map(e => {
                    const cmds = e.mge_event_commanders.length > 0
                      ? e.mge_event_commanders.map(c => c.commander_name).join(', ')
                      : e.focused_commander;
                    return (
                      <li key={e.id} className="truncate">
                        • {formatDate(e.event_date)} — {cmds || '(no commander)'}
                      </li>
                    );
                  })}
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="px-3 py-1.5 text-sm rounded-md font-medium bg-red-500/25 text-red-300 hover:bg-red-500/35 disabled:opacity-50"
                  >
                    {bulkDeleting ? 'Deleting…' : `Yes, delete ${selectedIds.size}`}
                  </button>
                  <button
                    onClick={() => setShowBulkConfirm(false)}
                    disabled={bulkDeleting}
                    className="px-3 py-1.5 text-sm rounded-md hover:bg-[var(--background-secondary)] disabled:opacity-50"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Keep them
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* New event form */}
        {showNewForm && isAdmin && (
          <MgeEventSetup
            onSave={handleCreateEvent}
            onCancel={() => setShowNewForm(false)}
          />
        )}

        {/* Loading / Error */}
        {loading && (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            {t('loadingEvents')}
          </div>
        )}
        {error && (
          <div className="p-4 rounded-lg text-red-400 bg-red-500/10 border border-red-500/20 mb-4">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && visibleEvents.length === 0 && (
          <div className="text-center py-16 rounded-lg border"
            style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
            <Crown size={48} className="mx-auto mb-4 text-blue-500/30" />
            <p className="text-lg font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('noEvents')}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {isAdmin ? t('noEventsAdmin') : t('noEventsViewer')}
            </p>
          </div>
        )}

        {/* Event list */}
        <div className="space-y-4">
          {visibleEvents.map(evt => (
            <MgeEventCard
              key={evt.id}
              event={evt}
              isAdmin={isAdmin}
              isOfficer={isOfficer}
              isExpanded={expandedEvents.has(evt.id)}
              onToggle={() => toggleEvent(evt.id)}
              onRefetch={refetch}
              onGenerateMail={handleGenerateMail}
              roster={roster}
              bulkMode={bulkMode && isAdmin}
              isSelected={selectedIds.has(evt.id)}
              onToggleSelect={() => toggleSelected(evt.id)}
            />
          ))}
        </div>
      </div>
    </AppSidebar>
  );
}
