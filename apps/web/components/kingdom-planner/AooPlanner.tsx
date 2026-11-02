'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import type { MapAssignments, Player, Team, StrategyData as ImportedStrategyData, EventMode, AooTeam } from '@/lib/aoo-strategy/types';
import { defaultStrategyData } from '@/lib/aoo-strategy/strategy-data';
import { useScanRoster, formatPower, RosterMember } from '@/lib/supabase/use-alliance-roster';
import { usePlayerDrawer } from '@/lib/roster/player-drawer-context';
import { getAllMemberStats, MemberEventStats } from '@/lib/supabase/use-event-participation';
import { useAuth } from '@/lib/supabase/auth-context';
import { Swords, Plus, Link as LinkIcon, Copy, Check, Lock, Unlock } from 'lucide-react';
import { OFFICER_PASSWORD } from '@/lib/auth-passwords';
import { allianceDisplay } from '@/lib/alliances';
import { matchesSearch as matchesSearchUtil } from '@/lib/search';

// Generate a random 8-character share ID
function generateShareId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Dynamic imports
const RegistrationTab = dynamic(() => import('@/components/aoo-strategy/RegistrationTab'), { ssr: false });
const AOOInteractiveMap = dynamic(() => import('@/components/aoo-strategy/AOOInteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-5 h-5 border border-[#4318ff] border-t-transparent rounded-full animate-spin"></div>
    </div>
  ),
});

// Use TeamInfo as an alias for Team for backward compatibility
type TeamInfo = Team;

// Use imported StrategyData type
type StrategyData = ImportedStrategyData;

const DEFAULT_TEAMS: TeamInfo[] = [
    { name: 'Top Lane', description: 'Top' },
    { name: 'Mid Lane', description: 'Ark' },
    { name: 'Bottom Lane', description: 'Bottom' },
];

// Zone display names: 1=Top, 2=Mid (Ark), 3=Bottom
const ZONE_NAMES: Record<number, string> = {
    1: 'Top Lane',
    2: 'Mid Lane (Ark)',
    3: 'Bottom Lane',
};

const AVAILABLE_TAGS = ['Rally Leader', 'Garrison', 'Ark Carrier', 'Coordinator', 'Teleport 1st', 'Teleport 2nd', 'Hold Obelisks', 'Farm', 'Conquer', 'Confirmed'];

// Simplified tag colors - muted to not compete with zone colors
// Zone colors: Z1=blue, Z2=orange, Z3=purple (match in-game)
const TAG_COLORS: Record<string, string> = {
    'Rally Leader': 'bg-stone-700 text-white',
    'Garrison': 'bg-cyan-800 text-white',
    'Ark Carrier': 'bg-amber-700 text-white',
    'Coordinator': 'bg-stone-600 text-white',
    'Teleport 1st': 'bg-emerald-700 text-white',
    'Teleport 2nd': 'bg-emerald-600/70 text-white',
    'Hold Obelisks': 'bg-stone-600 text-stone-200',
    'Farm': 'bg-stone-500 text-white',
    'Conquer': 'bg-stone-600 text-stone-200',
    'Confirmed': 'bg-green-600 text-white',
};

// Zone colors matching in-game
const ZONE_COLORS: Record<number, { bg: string; border: string; text: string }> = {
    1: { bg: 'bg-blue-600', border: 'border-blue-500', text: 'text-blue-400' },
    2: { bg: 'bg-orange-600', border: 'border-orange-500', text: 'text-orange-400' },
    3: { bg: 'bg-purple-600', border: 'border-purple-500', text: 'text-purple-400' },
};

// Available alliances for team builder
const ALLIANCES = ['ANG', '23KK', 'KNG', 'EQ'] as const;

// RoK-mail alliance header presets. ANG / MNG / KNG are the kingdom's main
// alliances and use the canonical gradient markup from
// lib/rok-mail/alliance-descriptions.ts. Empty string = no header line.
const MAIL_HEADER_PRESETS: Record<string, { label: string; markup: string }> = {
    ANG: {
        label: 'ANG — Angmar Nazgul Guards',
        markup: `<size=30><color=#4d0000>A</color><color=#660000>N</color><color=#800000>G</color><color=#990000>M</color><color=#b30000>A</color><color=#cc0000>R</color> <color=#4d0000>N</color><color=#660000>A</color><color=#800000>Z</color><color=#990000>G</color><color=#b30000>U</color><color=#cc0000>L</color> <color=#e60000>G</color><color=#ff0000>U</color><color=#ff0000>A</color><color=#cc0000>R</color><color=#990000>D</color><color=#800000>S</color></size>`,
    },
    MNG: {
        label: 'MNG — Mithril Noble Guard',
        markup: `<size=30><color=#004d1a>M</color><color=#006622>I</color><color=#008030>T</color><color=#009939>H</color><color=#00b342>R</color><color=#00cc4d>I</color><color=#00e659>L</color> <color=#004d1a>N</color><color=#006622>O</color><color=#008030>B</color><color=#009939>L</color><color=#00b342>E</color> <color=#00cc4d>G</color><color=#00e659>U</color><color=#00ff66>A</color><color=#66ff99>R</color><color=#99ffbb>D</color></size>`,
    },
    KNG: {
        label: 'KNG — Keepers of Noble Guards',
        markup: `<size=30><color=#003366>K</color><color=#004080>E</color><color=#004d99>E</color><color=#0059b3>P</color><color=#0066cc>E</color><color=#0073e6>R</color><color=#0080ff>S</color> <color=#003366>O</color><color=#004d99>F</color> <color=#003366>N</color><color=#004080>O</color><color=#004d99>B</color><color=#0059b3>L</color><color=#0066cc>E</color> <color=#0073e6>G</color><color=#0080ff>U</color><color=#3399ff>A</color><color=#66b3ff>R</color><color=#99ccff>D</color><color=#cce6ff>S</color></size>`,
    },
    none: { label: 'No header', markup: '' },
};

// Confirmation status for team builder
type ConfirmationStatus = 'confirmed' | 'maybe' | 'none';

// Team number type
type TeamNumber = 1 | 2 | 3;

// Per-team state types
type ConfirmationsByTeam = Record<TeamNumber, Record<string, ConfirmationStatus>>;
type ZonesByTeam = Record<TeamNumber, Record<number, { name: string; power: number; kills: number }[]>>;
type RallyLeadsByTeam = Record<TeamNumber, Record<number, string>>;
type GarrisonLeadsByTeam = Record<TeamNumber, Record<number, string>>;
type ArkCarriersByTeam = Record<TeamNumber, string>; // One ark carrier per team (mid lane)
type TeleportFirstByTeam = Record<TeamNumber, Set<string>>;
type ZoneSizesByTeam = Record<TeamNumber, Record<number, string>>;
// Spreadsheet lane locks: name -> forced zone (1|2|3). Survives Distribute.
type LockedLanesByTeam = Record<TeamNumber, Record<string, number>>;

// Power-balanced distribution algorithm (includes kills for tracking)
function distributeByPowerWithKills(players: { name: string; power: number; kills: number }[]): Record<number, { name: string; power: number; kills: number }[]> {
    // Sort by power descending
    const sorted = [...players].sort((a, b) => b.power - a.power);

    // Greedy assignment: add to zone with lowest total power
    const zones: Record<number, { name: string; power: number; kills: number }[]> = { 1: [], 2: [], 3: [] };
    const zonePower: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

    for (const player of sorted) {
        // Find zone with minimum power
        const minZone = Object.entries(zonePower)
            .sort(([, a], [, b]) => a - b)[0][0];
        const zoneNum = parseInt(minZone);
        zones[zoneNum].push(player);
        zonePower[zoneNum] += player.power;
    }

    return zones;
}

// Team Builder Tab Component
interface PendingMember {
    name: string;
    power: number;
    kills: number;
    governorId?: string;
    isPending: true;
}

interface TeamBuilderTabProps {
    roster: { name: string; power: number; kills: number; alliance: string | null }[];
    powerByName: Record<string, number>;
    killsByName: Record<string, number>;
    allianceByName: Record<string, string | null>;
    alliances: string[];
    builderAlliance: string;
    setBuilderAlliance: (a: string) => void;
    teamCount: TeamNumber;
    setTeamCount: (c: TeamNumber) => void;
    activeTeam: TeamNumber;
    setActiveTeam: (t: TeamNumber) => void;
    // Per-team state
    confirmationsByTeam: ConfirmationsByTeam;
    setConfirmationsByTeam: (c: ConfirmationsByTeam) => void;
    builderStep: 'select' | 'distribute';
    setBuilderStep: (s: 'select' | 'distribute') => void;
    suggestedZonesByTeam: ZonesByTeam;
    setSuggestedZonesByTeam: (z: ZonesByTeam) => void;
    selectedRallyLeadsByTeam: RallyLeadsByTeam;
    setSelectedRallyLeadsByTeam: (r: RallyLeadsByTeam) => void;
    selectedRallyLeadsSecondaryByTeam: RallyLeadsByTeam;
    setSelectedRallyLeadsSecondaryByTeam: (r: RallyLeadsByTeam) => void;
    selectedGarrisonLeadsByTeam: GarrisonLeadsByTeam;
    setSelectedGarrisonLeadsByTeam: (g: GarrisonLeadsByTeam) => void;
    selectedArkCarriersByTeam: ArkCarriersByTeam;
    setSelectedArkCarriersByTeam: (a: ArkCarriersByTeam) => void;
    selectedTeleportFirstByTeam: TeleportFirstByTeam;
    setSelectedTeleportFirstByTeam: (t: TeleportFirstByTeam) => void;
    coordinatorsByTeam: Record<TeamNumber, Set<string>>;
    setCoordinatorsByTeam: (c: Record<TeamNumber, Set<string>>) => void;
    subsByTeam: Record<TeamNumber, Set<string>>;
    setSubsByTeam: (s: Record<TeamNumber, Set<string>>) => void;
    leagueTeamNumber: TeamNumber | null;
    zoneSizesByTeam: ZoneSizesByTeam;
    setZoneSizesByTeam: (z: ZoneSizesByTeam) => void;
    lockedLanesByTeam: LockedLanesByTeam;
    setLockedLanesByTeam: (l: LockedLanesByTeam) => void;
    lockedTeams: Set<TeamNumber>;
    setLockedTeams: (s: Set<TeamNumber>) => void;
    mailHeader: string;
    setMailHeader: (h: string) => void;
    pendingAdditions: PendingMember[];
    setPendingAdditions: (p: PendingMember[]) => void;
    onSavePendingAdditions: (additions: PendingMember[]) => Promise<void>;
    onConfirm: () => void;
    theme: Record<string, string>;
    formatPower: (p: number | null | undefined) => string;
    user: { id: string } | null;
    scanLabel: string | null;
    autoDistributeToken?: number; // Increment to trigger auto-distribute from parent
}

function TeamBuilderTab({
    roster,
    powerByName,
    killsByName,
    allianceByName,
    alliances,
    builderAlliance,
    setBuilderAlliance,
    teamCount,
    setTeamCount,
    activeTeam,
    setActiveTeam,
    confirmationsByTeam,
    setConfirmationsByTeam,
    builderStep,
    setBuilderStep,
    suggestedZonesByTeam,
    setSuggestedZonesByTeam,
    selectedRallyLeadsByTeam,
    setSelectedRallyLeadsByTeam,
    selectedRallyLeadsSecondaryByTeam,
    setSelectedRallyLeadsSecondaryByTeam,
    selectedGarrisonLeadsByTeam,
    setSelectedGarrisonLeadsByTeam,
    selectedArkCarriersByTeam,
    setSelectedArkCarriersByTeam,
    selectedTeleportFirstByTeam,
    setSelectedTeleportFirstByTeam,
    coordinatorsByTeam,
    setCoordinatorsByTeam,
    subsByTeam,
    setSubsByTeam,
    leagueTeamNumber,
    zoneSizesByTeam,
    setZoneSizesByTeam,
    lockedLanesByTeam,
    setLockedLanesByTeam,
    lockedTeams,
    setLockedTeams,
    mailHeader,
    setMailHeader,
    pendingAdditions,
    setPendingAdditions,
    onSavePendingAdditions,
    onConfirm,
    theme,
    formatPower,
    user,
    scanLabel,
    autoDistributeToken,
}: TeamBuilderTabProps) {
    const t = useTranslations('aoo.builder');
    const tz = useTranslations('aoo.zones');
    const tlb = useTranslations('aoo.builder.league');
    const ZONE_NAMES_T: Record<number, string> = {
        1: tz('topLane'),
        2: tz('midLaneArk'),
        3: tz('bottomLane'),
    };
    // Local state for search and add member form
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberPower, setNewMemberPower] = useState('');
    const [newMemberGovId, setNewMemberGovId] = useState('');
    const [showAutoComplete, setShowAutoComplete] = useState(false);
    const [builderSort, setBuilderSort] = useState<'power' | 'kp' | 't1' | 't2' | 'name'>('power');
    const [builderFilter, setBuilderFilter] = useState<'all' | 'confirmed' | 'maybe' | 'none'>('all');
    const [useCustomSizes, setUseCustomSizes] = useState(true); // Default to custom sizes
    const [copiedSummary, setCopiedSummary] = useState(false);
    const [copiedMail, setCopiedMail] = useState(false);
    const [distributeAddSearch, setDistributeAddSearch] = useState('');
    const [distributeAddZone, setDistributeAddZone] = useState(0);
    const coordinators = coordinatorsByTeam[activeTeam] || new Set<string>();
    const setCoordinators = (c: Set<string>) => setCoordinatorsByTeam({ ...coordinatorsByTeam, [activeTeam]: c });
    const { openPlayer } = usePlayerDrawer();

    // === Per-team lock + one-step undo ===
    const isTeamLocked = (t: TeamNumber) => lockedTeams.has(t);
    const isActiveLocked = isTeamLocked(activeTeam);
    const toggleTeamLock = (t: TeamNumber) => {
        const next = new Set(lockedTeams);
        if (next.has(t)) next.delete(t);
        else next.add(t);
        setLockedTeams(next);
    };

    // Snapshot used for the one-step Undo. Captures every map a Distribute or
    // per-player mutation could touch. We deep-clone on capture (shallow per
    // team key + new Set instances for the Set-valued maps) so future mutations
    // don't mutate the snapshot in place.
    type BuilderSnapshot = {
        confirmationsByTeam: ConfirmationsByTeam;
        suggestedZonesByTeam: ZonesByTeam;
        selectedRallyLeadsByTeam: RallyLeadsByTeam;
        selectedGarrisonLeadsByTeam: GarrisonLeadsByTeam;
        selectedArkCarriersByTeam: ArkCarriersByTeam;
        selectedTeleportFirstByTeam: TeleportFirstByTeam;
        coordinatorsByTeam: Record<TeamNumber, Set<string>>;
        zoneSizesByTeam: ZoneSizesByTeam;
        lockedLanesByTeam: LockedLanesByTeam;
        builderStep: 'select' | 'distribute';
        // Label shown on the Undo button so the user knows what they'll revert.
        label: string;
    };
    const [lastSnapshot, setLastSnapshot] = useState<BuilderSnapshot | null>(null);

    const captureSnapshot = (label: string) => {
        setLastSnapshot({
            confirmationsByTeam: {
                1: { ...(confirmationsByTeam[1] || {}) },
                2: { ...(confirmationsByTeam[2] || {}) },
                3: { ...(confirmationsByTeam[3] || {}) },
            },
            suggestedZonesByTeam: {
                1: { ...(suggestedZonesByTeam[1] || {}) },
                2: { ...(suggestedZonesByTeam[2] || {}) },
                3: { ...(suggestedZonesByTeam[3] || {}) },
            },
            selectedRallyLeadsByTeam: {
                1: { ...(selectedRallyLeadsByTeam[1] || {}) },
                2: { ...(selectedRallyLeadsByTeam[2] || {}) },
                3: { ...(selectedRallyLeadsByTeam[3] || {}) },
            },
            selectedGarrisonLeadsByTeam: {
                1: { ...(selectedGarrisonLeadsByTeam[1] || {}) },
                2: { ...(selectedGarrisonLeadsByTeam[2] || {}) },
                3: { ...(selectedGarrisonLeadsByTeam[3] || {}) },
            },
            selectedArkCarriersByTeam: { ...selectedArkCarriersByTeam },
            selectedTeleportFirstByTeam: {
                1: new Set(selectedTeleportFirstByTeam[1] || []),
                2: new Set(selectedTeleportFirstByTeam[2] || []),
                3: new Set(selectedTeleportFirstByTeam[3] || []),
            },
            coordinatorsByTeam: {
                1: new Set(coordinatorsByTeam[1] || []),
                2: new Set(coordinatorsByTeam[2] || []),
                3: new Set(coordinatorsByTeam[3] || []),
            },
            zoneSizesByTeam: {
                1: { ...(zoneSizesByTeam[1] || { 0: '', 1: '', 2: '', 3: '' }) },
                2: { ...(zoneSizesByTeam[2] || { 0: '', 1: '', 2: '', 3: '' }) },
                3: { ...(zoneSizesByTeam[3] || { 0: '', 1: '', 2: '', 3: '' }) },
            },
            lockedLanesByTeam: {
                1: { ...(lockedLanesByTeam[1] || {}) },
                2: { ...(lockedLanesByTeam[2] || {}) },
                3: { ...(lockedLanesByTeam[3] || {}) },
            },
            builderStep,
            label,
        });
    };

    const undoLastChange = () => {
        const snap = lastSnapshot;
        if (!snap) return;
        setConfirmationsByTeam(snap.confirmationsByTeam);
        setSuggestedZonesByTeam(snap.suggestedZonesByTeam);
        setSelectedRallyLeadsByTeam(snap.selectedRallyLeadsByTeam);
        setSelectedGarrisonLeadsByTeam(snap.selectedGarrisonLeadsByTeam);
        setSelectedArkCarriersByTeam(snap.selectedArkCarriersByTeam);
        setSelectedTeleportFirstByTeam(snap.selectedTeleportFirstByTeam);
        setCoordinatorsByTeam(snap.coordinatorsByTeam);
        setZoneSizesByTeam(snap.zoneSizesByTeam);
        setLockedLanesByTeam(snap.lockedLanesByTeam);
        setBuilderStep(snap.builderStep);
        setLastSnapshot(null);
    };

    // Generate exportable summary text for all teams (no emojis for in-game compatibility)
    const generateSummary = () => {
        const lines: string[] = [];
        lines.push('=========================================');
        lines.push('         AoO TEAM ASSIGNMENTS');
        lines.push('=========================================');
        lines.push('');

        for (const team of [1, 2, 3] as TeamNumber[]) {
            if (team > teamCount) continue;

            const zones = suggestedZonesByTeam[team] || {};
            const rallyLeads = selectedRallyLeadsByTeam[team] || {};
            const garrisonLeads = selectedGarrisonLeadsByTeam[team] || {};
            const arkCarrier = selectedArkCarriersByTeam[team] || '';
            const teleportFirst = selectedTeleportFirstByTeam[team] || new Set<string>();
            const teamCoordinators = coordinatorsByTeam[team] || new Set<string>();

            // Check if this team has any players
            const totalPlayers = (zones[1]?.length || 0) + (zones[2]?.length || 0) + (zones[3]?.length || 0);
            if (totalPlayers === 0) continue;

            lines.push(`>> TEAM ${team}`);
            lines.push('-----------------------------------------');

            if (teamCoordinators.size > 0) {
                lines.push(`\nCoordinators: ${[...teamCoordinators].join(', ')}`);
            }

            for (const zoneNum of [1, 2, 3]) {
                const zonePlayers = zones[zoneNum] || [];
                if (zonePlayers.length === 0) continue;

                lines.push(`\n[${ZONE_NAMES[zoneNum]}] - ${zonePlayers.length} players`);

                // Sort by power descending
                const sorted = [...zonePlayers].sort((a, b) => b.power - a.power);
                for (const p of sorted) {
                    const isRallyLead = rallyLeads[zoneNum] === p.name;
                    const isGarrisonLead = garrisonLeads[zoneNum] === p.name;
                    const isArkCarrier = zoneNum === 2 && arkCarrier === p.name;
                    const isTeleport = teleportFirst.has(p.name);
                    const isCoordinator = teamCoordinators.has(p.name);
                    const badges = [];
                    if (isCoordinator) badges.push('Coord');
                    if (isRallyLead) badges.push('Rally Lead');
                    if (isGarrisonLead) badges.push('Garrison Lead');
                    if (isArkCarrier) badges.push('Ark Carrier');
                    if (isTeleport) badges.push('TP First');
                    const badgeStr = badges.length > 0 ? ` [${badges.join(', ')}]` : '';
                    lines.push(`  - ${p.name} (${formatPower(p.power)})${badgeStr}`);
                }
            }

            // Substitutes
            const subs = zones[0] || [];
            if (subs.length > 0) {
                lines.push(`\n[Substitutes] - ${subs.length}`);
                for (const p of subs) {
                    lines.push(`  - ${p.name} (${formatPower(p.power)})`);
                }
            }

            // Bench
            const bench = zones[-1] || [];
            if (bench.length > 0) {
                lines.push(`\n[Bench] - ${bench.length}`);
                for (const p of bench) {
                    lines.push(`  - ${p.name} (${formatPower(p.power)})`);
                }
            }

            lines.push('');
        }

        lines.push('=========================================');

        return lines.join('\n');
    };

    // Generate RoK mail format for a specific team
    const generateMail = (team: TeamNumber) => {
        // Header preset — picked from the dropdown. 'none' skips the line.
        const headerMarkup = MAIL_HEADER_PRESETS[mailHeader]?.markup ?? '';
        const DIVIDER = '►═════════❂❂❂═════════◄';
        const SECTION = '━━━━━━━━━━━━━━━━━━━━';
        // League team gets a softer "Reminders" section + no coordinators list
        // + no leadership signoff. Weekend teams keep the strict rules variant.
        const isLeague = team === leagueTeamNumber;

        const zones = suggestedZonesByTeam[team] || {};
        const rallyLeads = selectedRallyLeadsByTeam[team] || {};
        const garrisonLeads = selectedGarrisonLeadsByTeam[team] || {};
        const arkCarrier = selectedArkCarriersByTeam[team] || '';
        const teleportFirst = selectedTeleportFirstByTeam[team] || new Set<string>();
        const teamCoords = coordinatorsByTeam[team] || new Set<string>();

        const lines: string[] = [];
        if (headerMarkup) lines.push(headerMarkup);
        lines.push(DIVIDER);
        lines.push('');
        lines.push(`<b><color=#ff3333>${isLeague ? 'Osiris League' : `AoO Team ${team}`}</color></b>`);
        lines.push('');
        lines.push('Find your name, know your lane.');
        lines.push('');
        if (isLeague) {
            lines.push('<b>Reminders</b>');
            lines.push('- Switch your gear and commanders to KvK2 setup.');
            lines.push('- <b>Do NOT</b> teleport immediately unless you have been assigned.');
            lines.push('- Garrison the obelisk fully before advancing.');
            lines.push('- We push with rallies.');
            lines.push('- Stay in your assigned lane.');
        } else {
            lines.push('<b>!! NON-NEGOTIABLE RULES !!</b>');
            lines.push('- <b>Do NOT</b> teleport immediately unless you have been assigned.');
            lines.push('- The obelisk is <b>ALWAYS</b> fully garrisoned before you advance.');
            lines.push('- We attack with rallies.');
            lines.push('- Stay in your assigned lane.');
            lines.push('- <b>Do NOT</b> move down the field until your building is secured.');
            lines.push('- <b>Do NOT</b> lose an obelisk or building from poor garrisoning.');
        }

        const zoneConfig = [
            { num: 1, label: 'TOP LANE', color: '#3399ff' },
            { num: 2, label: 'MID LANE — ARK', color: '#cc6600' },
            { num: 3, label: 'BOTTOM LANE', color: '#9933cc' },
        ];

        for (const zone of zoneConfig) {
            const players = zones[zone.num] || [];
            if (players.length === 0) continue;

            const isMid = zone.num === 2;
            const rally = rallyLeads[zone.num];
            const garrison = garrisonLeads[zone.num];
            const carrier = isMid ? arkCarrier : '';
            const tpPlayers = players.filter(p => teleportFirst.has(p.name));
            // "Team:" lists everyone except the rally lead, garrison lead, and ark carrier
            // (those are already called out by name in their own lines above).
            // TP-first players stay in the team list — they're just also listed on the TP line.
            const namedLeaders = new Set([rally, garrison, carrier].filter(Boolean));
            const regularPlayers = players.filter(p => !namedLeaders.has(p.name));

            // Build zone leader label
            const leaderNames = isMid
                ? (carrier || 'TBD')
                : [rally, garrison].filter(Boolean).join(' & ') || 'TBD';

            lines.push('');
            lines.push(SECTION);
            lines.push(`<b><color=${zone.color}>${zone.label} (${leaderNames})</color></b>`);

            if (isMid) {
                if (carrier) lines.push(`<b>Ark Carrier:</b> ${carrier}`);
            } else {
                if (rally) lines.push(`<b>Rally Lead:</b> ${rally}`);
                if (garrison) lines.push(`<b>Garrison Lead:</b> ${garrison}`);
            }

            if (tpPlayers.length > 0) {
                lines.push(`<b>1st Teleport:</b> ${tpPlayers.map(p => p.name).join(', ')}`);
            }

            if (regularPlayers.length > 0) {
                lines.push(`<b>Team:</b> ${regularPlayers.map(p => p.name).join(', ')}`);
            }
        }

        // Subs
        const subs = zones[0] || [];
        if (subs.length > 0) {
            lines.push('');
            lines.push(SECTION);
            lines.push(`<b>Subs:</b> ${subs.map(p => p.name).join(', ')}`);
        }

        // Coordinators + leadership signoff: weekend teams only. The league
        // template drops both per its stripped-down format.
        if (!isLeague) {
            if (teamCoords.size > 0) {
                lines.push('');
                lines.push(`<b>Coordinators:</b> ${[...teamCoords].join(', ')}`);
            }

            lines.push('');
            lines.push(DIVIDER);
            lines.push(`<b><color=#800000>— Leadership</color></b>`);
        }

        return lines.join('\n');
    };

    // Store mail as a draft and open RoK Mail in a new tab with it pre-loaded.
    const copyMailToClipboard = async (team: TeamNumber) => {
        const mail = generateMail(team);
        localStorage.setItem('rok-mail-draft', mail);
        window.open('/rok-mail', '_blank');
        setCopiedMail(true);
        setTimeout(() => setCopiedMail(false), 2000);
    };

    // Copy summary to clipboard
    const copySummaryToClipboard = async () => {
        try {
            const summary = generateSummary();
            await navigator.clipboard.writeText(summary);
            setCopiedSummary(true);
            setTimeout(() => setCopiedSummary(false), 2000);
        } catch {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = generateSummary();
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopiedSummary(true);
            setTimeout(() => setCopiedSummary(false), 2000);
        }
    };

    // Helper to get a player's team assignment
    const getPlayerTeamAssignment = (name: string): { team: TeamNumber; status: ConfirmationStatus } | null => {
        for (const team of [1, 2, 3] as TeamNumber[]) {
            const status = confirmationsByTeam[team]?.[name];
            if (status && status !== 'none') {
                return { team, status };
            }
        }
        return null;
    };

    // Get player's overall status for filtering (confirmed/maybe/none across any team)
    const getPlayerOverallStatus = (name: string): ConfirmationStatus => {
        const assignment = getPlayerTeamAssignment(name);
        return assignment?.status || 'none';
    };

    // Set player's team assignment (clears from other teams)
    const setPlayerTeamAssignment = (name: string, team: TeamNumber, status: ConfirmationStatus) => {
        // Refuse to mutate a locked team — neither the source (the team currently
        // holding this player) nor the target may be locked.
        if (lockedTeams.has(team)) {
            alert(`Team ${team} is locked. Unfreeze it first.`);
            return;
        }
        for (const t of [1, 2, 3] as TeamNumber[]) {
            if (confirmationsByTeam[t]?.[name] && lockedTeams.has(t)) {
                alert(`Team ${t} is locked (${name} can't be moved out).`);
                return;
            }
        }
        captureSnapshot(`Change ${name} on T${team}`);
        const newConfirmations = { ...confirmationsByTeam };
        // Clear from all teams first
        for (const t of [1, 2, 3] as TeamNumber[]) {
            if (newConfirmations[t]?.[name]) {
                newConfirmations[t] = { ...newConfirmations[t] };
                delete newConfirmations[t][name];
            }
        }
        // Set on the specified team if not 'none'
        if (status !== 'none') {
            newConfirmations[team] = { ...newConfirmations[team], [name]: status };
        }
        setConfirmationsByTeam(newConfirmations);
    };

    // Current team's data (for distribute step)
    const currentTeamConfirmations = confirmationsByTeam[activeTeam] || {};
    const suggestedZones = suggestedZonesByTeam[activeTeam] || {};
    const selectedRallyLeads = selectedRallyLeadsByTeam[activeTeam] || {};
    const selectedRallyLeadsSecondary = selectedRallyLeadsSecondaryByTeam[activeTeam] || {};
    const setSelectedRallyLeadsSecondary = (r: Record<number, string>) =>
        setSelectedRallyLeadsSecondaryByTeam({ ...selectedRallyLeadsSecondaryByTeam, [activeTeam]: r });
    const selectedTeleportFirst = selectedTeleportFirstByTeam[activeTeam] || new Set<string>();
    const zoneSizes = zoneSizesByTeam[activeTeam] || { 0: '', 1: '', 2: '', 3: '' };

    // Per-zone sort mode: 'default' = rally→tp→power, 'power' = power desc, 'kp' = kill points desc, 'name' = alphabetical
    const [zoneSortModes, setZoneSortModes] = useState<Record<number, string>>({});

    const sortZonePlayers = (players: { name: string; power: number; kills: number }[], zone: number) => {
        const mode = zoneSortModes[zone] || 'default';
        const sorted = [...players];
        const rallyLead = selectedRallyLeads[zone] || '';

        sorted.sort((a, b) => {
            // Rally leader always first
            if (a.name === rallyLead) return -1;
            if (b.name === rallyLead) return 1;

            if (mode === 'power') return b.power - a.power;
            if (mode === 'kp') return (b.kills || killsByName[b.name] || 0) - (a.kills || killsByName[a.name] || 0);
            if (mode === 'name') return a.name.localeCompare(b.name);

            // Default: TP first, then power desc
            const aTP = selectedTeleportFirst.has(a.name) ? 1 : 0;
            const bTP = selectedTeleportFirst.has(b.name) ? 1 : 0;
            if (aTP !== bTP) return bTP - aTP;
            return b.power - a.power;
        });
        return sorted;
    };

    // Current team's garrison leads and ark carrier
    const selectedGarrisonLeads = selectedGarrisonLeadsByTeam[activeTeam] || {};
    const selectedArkCarrier = selectedArkCarriersByTeam[activeTeam] || '';

    // Setters for current team
    const setSuggestedZones = (zones: Record<number, { name: string; power: number; kills: number }[]>) => {
        setSuggestedZonesByTeam({ ...suggestedZonesByTeam, [activeTeam]: zones });
    };
    const setSelectedRallyLeads = (leads: Record<number, string>) => {
        setSelectedRallyLeadsByTeam({ ...selectedRallyLeadsByTeam, [activeTeam]: leads });
    };
    const setSelectedGarrisonLeads = (leads: Record<number, string>) => {
        setSelectedGarrisonLeadsByTeam({ ...selectedGarrisonLeadsByTeam, [activeTeam]: leads });
    };
    const setSelectedArkCarrier = (carrier: string) => {
        setSelectedArkCarriersByTeam({ ...selectedArkCarriersByTeam, [activeTeam]: carrier });
    };
    const setSelectedTeleportFirst = (first: Set<string>) => {
        setSelectedTeleportFirstByTeam({ ...selectedTeleportFirstByTeam, [activeTeam]: first });
    };
    const setZoneSizes = (sizes: Record<number, string>) => {
        setZoneSizesByTeam({ ...zoneSizesByTeam, [activeTeam]: sizes });
    };

    // Event participation stats for AoO history
    const [eventStats, setEventStats] = useState<Map<string, MemberEventStats>>(new Map());

    // Load event stats on mount
    useEffect(() => {
        getAllMemberStats().then(stats => setEventStats(stats));
    }, []);

    // Filter roster by alliance
    const baseRoster = builderAlliance === 'all'
        ? roster
        : roster.filter(m => m.alliance === builderAlliance);

    // Combine with pending additions
    const combinedRoster = [
        ...baseRoster.map(m => ({ ...m, isPending: false as const })),
        ...pendingAdditions, // Always show pending additions (manually added or imported from registration)
    ];

    // Autocomplete suggestions from full roster (independent of alliance filter)
    const autocompleteSuggestions = newMemberName.trim().length >= 2
        ? roster.filter(m =>
            m.name.toLowerCase().includes(newMemberName.toLowerCase()) &&
            !combinedRoster.some(c => c.name === m.name) // Exclude already in current list
          ).slice(0, 8)
        : [];

    // Select autocomplete suggestion
    const handleSelectSuggestion = (member: typeof roster[0]) => {
        setNewMemberName(member.name);
        setNewMemberPower(member.power?.toString() || '');
        setShowAutoComplete(false);
    };

    // Apply search and confirmation status filter
    const filteredRoster = combinedRoster
        .filter(m => {
            // Search filter
            if (searchTerm.trim()) {
                if (!matchesSearchUtil(searchTerm, m.name, 'governorId' in m && m.governorId ? parseInt(m.governorId) : null)) return false;
            }
            // Confirmation status filter (across all teams)
            if (builderFilter !== 'all') {
                const status = getPlayerOverallStatus(m.name);
                if (builderFilter !== status) return false;
            }
            return true;
        })
        .sort((a, b) => {
            // Sort logic
            const aStats = eventStats.get(a.name)?.aoo;
            const bStats = eventStats.get(b.name)?.aoo;
            switch (builderSort) {
                case 'power':
                    return (b.power || 0) - (a.power || 0);
                case 'kp':
                    const aKp = a.kills || killsByName[a.name] || 0;
                    const bKp = b.kills || killsByName[b.name] || 0;
                    return bKp - aKp;
                case 't1': {
                    // Sort by: rate desc, then total assignments desc (2/2 > 1/1), then participated desc
                    const aT1Rate = aStats && aStats.team1Count > 0 ? aStats.team1Participated / aStats.team1Count : -1;
                    const bT1Rate = bStats && bStats.team1Count > 0 ? bStats.team1Participated / bStats.team1Count : -1;
                    if (bT1Rate !== aT1Rate) return bT1Rate - aT1Rate;
                    // Same rate - prefer more assignments (2/2 > 1/1)
                    const aT1Count = aStats?.team1Count || 0;
                    const bT1Count = bStats?.team1Count || 0;
                    if (bT1Count !== aT1Count) return bT1Count - aT1Count;
                    return (bStats?.team1Participated || 0) - (aStats?.team1Participated || 0);
                }
                case 't2': {
                    const aT2Rate = aStats && aStats.team2Count > 0 ? aStats.team2Participated / aStats.team2Count : -1;
                    const bT2Rate = bStats && bStats.team2Count > 0 ? bStats.team2Participated / bStats.team2Count : -1;
                    if (bT2Rate !== aT2Rate) return bT2Rate - aT2Rate;
                    const aT2Count = aStats?.team2Count || 0;
                    const bT2Count = bStats?.team2Count || 0;
                    if (bT2Count !== aT2Count) return bT2Count - aT2Count;
                    return (bStats?.team2Participated || 0) - (aStats?.team2Participated || 0);
                }
                case 'name':
                    return a.name.localeCompare(b.name);
                default:
                    return 0;
            }
        });

    // Check if search term matches nothing in roster (for showing "add" option)
    const noResults = searchTerm.trim().length > 0 && filteredRoster.length === 0;

    // Add a new pending member
    const handleAddMember = () => {
        if (!newMemberName.trim()) return;

        const newMember: PendingMember = {
            name: newMemberName.trim(),
            power: parseInt(newMemberPower) || 0,
            kills: 0,
            governorId: newMemberGovId.trim() || undefined,
            isPending: true,
        };

        setPendingAdditions([...pendingAdditions, newMember]);
        setNewMemberName('');
        setNewMemberPower('');
        setNewMemberGovId('');
        setShowAddForm(false);
        setSearchTerm('');

        // Auto-confirm the new member on team 1
        setPlayerTeamAssignment(newMember.name, 1, 'confirmed');
    };

    // Count confirmations for CURRENT team (used in distribute step)
    // Build from confirmation dict, then look up player data from combinedRoster.
    // This ensures imported registrations are always counted even if their names
    // don't exactly match a combinedRoster entry.
    const combinedByName = new Map(combinedRoster.map(m => [m.name, m]));
    const confirmedPlayers = Object.entries(currentTeamConfirmations)
        .filter(([, v]) => v === 'confirmed')
        .map(([name]) => combinedByName.get(name) || { name, power: 0, kills: 0, isPending: true as const });
    const maybePlayers = Object.entries(currentTeamConfirmations)
        .filter(([, v]) => v === 'maybe')
        .map(([name]) => combinedByName.get(name) || { name, power: 0, kills: 0, isPending: true as const });
    const confirmedPower = confirmedPlayers.reduce((sum: number, p) => sum + (p.power || 0), 0);
    const maybePower = maybePlayers.reduce((sum: number, p) => sum + (p.power || 0), 0);

    // Count per team (for display in select step)
    // Count directly from confirmation dict — not from combinedRoster — to ensure
    // imported registrations are always reflected accurately in the badge counts.
    const getTeamCounts = (team: TeamNumber) => {
        const teamConf = confirmationsByTeam[team] || {};
        const values = Object.values(teamConf);
        const confirmed = values.filter(v => v === 'confirmed').length;
        const maybe = values.filter(v => v === 'maybe').length;
        return { confirmed, maybe, total: confirmed + maybe };
    };

    // Auto-calculate zone sizes ONLY when the active team has no sizes set yet.
    // Once the user has entered any value (or a saved plan loads with values),
    // never overwrite them — that's what was wiping 10/10/9 → 10/10/10 on refresh.
    useEffect(() => {
        const totalPlayers = confirmedPlayers.length + maybePlayers.length;
        if (totalPlayers === 0) return;

        // Skip if the user (or a saved plan) has already populated lane sizes.
        const existingTotal = (parseInt(zoneSizes[1]) || 0) + (parseInt(zoneSizes[2]) || 0) + (parseInt(zoneSizes[3]) || 0);
        if (existingTotal > 0) return;

        // Default: split evenly across 3 lanes, capped at 30 (game limit).
        const laneTotal = Math.min(totalPlayers, 30);
        const basePerZone = Math.floor(laneTotal / 3);
        const remainder = laneTotal % 3;

        setZoneSizes({
            0: zoneSizes[0] || '0',
            1: String(basePerZone + (remainder >= 1 ? 1 : 0)),
            2: String(basePerZone + (remainder >= 2 ? 1 : 0)),
            3: String(basePerZone),
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [confirmedPlayers.length, maybePlayers.length, activeTeam]);

    // Toggle confirmation status for a specific team
    const toggleTeamConfirmation = (name: string, team: TeamNumber) => {
        const teamConf = confirmationsByTeam[team] || {};
        const current = teamConf[name] || 'none';
        // Cycle: none -> confirmed -> maybe -> none
        const next: ConfirmationStatus = current === 'none' ? 'confirmed' : current === 'confirmed' ? 'maybe' : 'none';
        setPlayerTeamAssignment(name, team, next);
    };

    // Suggest rally leads based on power AND kills (KP)
    // Score = power * 0.4 + kills * 0.6 (weighted towards fighting capability)
    const getRallyScore = (name: string) => {
        const power = powerByName[name] || 0;
        const kills = killsByName[name] || 0;
        return power * 0.4 + kills * 0.6;
    };

    // Distribute players by custom zone sizes with power balancing
    const distributeByZoneSizes = (
        players: { name: string; power: number; kills: number }[],
        sizes: Record<number, number>
    ): Record<number, { name: string; power: number; kills: number }[]> => {
        // Sort by power descending
        const sorted = [...players].sort((a, b) => b.power - a.power);
        const zones: Record<number, { name: string; power: number; kills: number }[]> = { 1: [], 2: [], 3: [] };
        const zonePower: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

        // Greedy assignment: assign each player to the zone with lowest power that still has room
        for (const player of sorted) {
            // Find zones that still have room
            const availableZones = [1, 2, 3].filter(z => zones[z].length < sizes[z]);

            if (availableZones.length === 0) {
                // All zones full, skip (or could add to overflow)
                continue;
            }

            // Pick the zone with lowest total power among available zones
            const targetZone = availableZones.reduce((min, z) =>
                zonePower[z] < zonePower[min] ? z : min, availableZones[0]);

            zones[targetZone].push(player);
            zonePower[targetZone] += player.power;
        }

        return zones;
    };

    // Handle distribute button — re-balances ONLY the listed teams (defaults to
    // the active team) and preserves every other team's existing zones/leads.
    // Priority order honored per team:
    //   1. Spreadsheet locks (lockedLanesByTeam, rallyLeader/garrisonLeader from sheet)
    //   2. Site-selected rally/garrison leads (already populated in state)
    //   3. Lane number suggestions (zoneSizesByTeam)
    //   4. Auto-balance the rest by power
    const handleDistribute = (targetTeams?: TeamNumber[], bypassLocks = false) => {
        // Skip locked teams unless bypassLocks is set. The bypass is used by the
        // post-import auto-distribute path: a fresh sheet import is an explicit
        // user action, so silently doing nothing because a previous user locked
        // the team would just leave empty lanes (which has been the bug).
        // Manual Re-balance keeps the lock check so it still prevents accidents.
        const requested = targetTeams ?? [activeTeam];
        const teams = bypassLocks ? requested : requested.filter(t => !isTeamLocked(t));
        if (teams.length === 0) {
            if (requested.length === 1 && isTeamLocked(requested[0])) {
                alert(`Team ${requested[0]} is locked. Click the lock icon to unfreeze it before redistributing.`);
            }
            return;
        }

        captureSnapshot(teams.length === 1 ? `Distribute T${teams[0]}` : `Distribute T${teams.join(', T')}`);

        // Per-team accumulators — committed in one batch at the end so distributing
        // multiple teams in a single call doesn't suffer stale-state clobbering.
        const zonesUpdates: Partial<Record<TeamNumber, Record<number, { name: string; power: number; kills: number }[]>>> = {};
        const rallyUpdates: Partial<Record<TeamNumber, Record<number, string>>> = {};
        const rallySecondaryUpdates: Partial<Record<TeamNumber, Record<number, string>>> = {};
        const garrisonUpdates: Partial<Record<TeamNumber, Record<number, string>>> = {};
        const arkUpdates: Partial<Record<TeamNumber, string>> = {};
        const teleportUpdates: Partial<Record<TeamNumber, Set<string>>> = {};
        const sizeUpdates: Partial<Record<TeamNumber, Record<number, string>>> = {};

        let processedAny = false;

        for (const team of teams) {

        // subCap only governs the LEAGUE team, which caps auto-overflow subs at
        // 15 and benches the rest (zone -1). Weekend teams take their subs solely
        // from the sheet's Sub column and never bench (see the overflow branches
        // below), so this cap doesn't apply to them.
        const subCap = team === leagueTeamNumber ? 15 : 10;

        const teamConf = confirmationsByTeam[team] || {};
        const confirmedList = Object.entries(teamConf)
            .filter(([, v]) => v === 'confirmed')
            .map(([name]) => {
                const m = combinedByName.get(name);
                return { name, power: m?.power || 0, kills: m?.kills || killsByName[name] || 0 };
            });
        const maybeList = Object.entries(teamConf)
            .filter(([, v]) => v === 'maybe')
            .map(([name]) => {
                const m = combinedByName.get(name);
                return { name, power: m?.power || 0, kills: m?.kills || killsByName[name] || 0 };
            });

        const totalPlayers = confirmedList.length + maybeList.length;
        if (totalPlayers < 1) {
            // Skip empty teams when batching; only error if the only requested team is empty.
            continue;
        }
        processedAny = true;

        let teamZoneSizes = zoneSizesByTeam[team] || { 0: '', 1: '', 2: '', 3: '' };

        // If zone sizes haven't been set yet, compute defaults inline
        const parsedSizeTotal = (parseInt(teamZoneSizes[1]) || 0) + (parseInt(teamZoneSizes[2]) || 0) + (parseInt(teamZoneSizes[3]) || 0);
        if (parsedSizeTotal === 0) {
            const laneTotal = Math.min(totalPlayers, 30);
            const base = Math.floor(laneTotal / 3);
            const rem = laneTotal % 3;
            teamZoneSizes = {
                0: '',
                1: String(base + (rem >= 1 ? 1 : 0)),
                2: String(base + (rem >= 2 ? 1 : 0)),
                3: String(base),
            };
            sizeUpdates[team] = teamZoneSizes;
        }

        // Combine all players, sorted by power descending
        const allPlayers = [...confirmedList, ...maybeList].sort((a, b) => b.power - a.power);

        // === Priority 1: spreadsheet lane locks ===
        // Pull players with a forced lane out of the auto-balance pool first.
        // Lock value 0 means "explicit sub" — they go into zones[0] regardless
        // of how many lane slots are open. The Main/Sub toggle on the league
        // team updates subsByTeam (not lockedLanesByTeam), so we union both:
        // a name is a locked sub if either source flags it. Without this, a
        // weekly sub swap on league would be silently re-shuffled to a lane.
        const teamLocks = lockedLanesByTeam[team] || {};
        const teamSubSet = subsByTeam[team] || new Set<string>();
        const lockedZones: Record<number, { name: string; power: number; kills: number }[]> = { 1: [], 2: [], 3: [] };
        const lockedSubs: { name: string; power: number; kills: number }[] = [];
        const flexPool: { name: string; power: number; kills: number }[] = [];
        for (const p of allPlayers) {
            const lock = teamLocks[p.name];
            if (lock === 1 || lock === 2 || lock === 3) {
                lockedZones[lock].push(p);
            } else if (lock === 0 || teamSubSet.has(p.name)) {
                lockedSubs.push(p);
            } else {
                flexPool.push(p);
            }
        }

        let zones: Record<number, { name: string; power: number; kills: number }[]>;

        if (useCustomSizes) {
            // === Priority 3: lane number suggestions ===
            // Sizes set by the user. Fill remaining slots after locks.
            const sizes = {
                1: parseInt(teamZoneSizes[1]) || 0,
                2: parseInt(teamZoneSizes[2]) || 0,
                3: parseInt(teamZoneSizes[3]) || 0,
            };
            const laneSlots = sizes[1] + sizes[2] + sizes[3];

            if (laneSlots === 0) {
                // No sizes set — auto-balance everything (locks honored)
                const balancedFlex = distributeByPowerWithKills(flexPool);
                zones = {
                    1: [...lockedZones[1], ...balancedFlex[1]],
                    2: [...lockedZones[2], ...balancedFlex[2]],
                    3: [...lockedZones[3], ...balancedFlex[3]],
                };
                zones[0] = [...lockedSubs];
                zones[-1] = [];
            } else {
                // Remaining slots after locks
                const remainingSizes = {
                    1: Math.max(0, sizes[1] - lockedZones[1].length),
                    2: Math.max(0, sizes[2] - lockedZones[2].length),
                    3: Math.max(0, sizes[3] - lockedZones[3].length),
                };
                const remainingSlots = remainingSizes[1] + remainingSizes[2] + remainingSizes[3];
                const forLanes = flexPool.slice(0, remainingSlots);
                const remainder = flexPool.slice(remainingSlots);

                const filled = distributeByZoneSizes(forLanes, remainingSizes);
                zones = {
                    1: [...lockedZones[1], ...filled[1]],
                    2: [...lockedZones[2], ...filled[2]],
                    3: [...lockedZones[3], ...filled[3]],
                };
                if (team === leagueTeamNumber) {
                    // League (OL): locked subs stay in zone 0, auto-overflow fills the
                    // rest up to subCap, and anything beyond that is benched (zone -1).
                    const subRoom = Math.max(0, subCap - lockedSubs.length);
                    zones[0] = [...lockedSubs, ...remainder.slice(0, subRoom)];
                    zones[-1] = remainder.slice(subRoom);
                } else {
                    // Weekend teams: subs come only from the sheet's Sub column and
                    // there is no bench. Any rare overflow stays as subs so no one is
                    // dropped.
                    zones[0] = [...lockedSubs, ...remainder];
                    zones[-1] = [];
                }
            }
        } else {
            // Auto-balance by power (equal distribution across 3 lanes, max 30 in lanes)
            const lockedTotal = lockedZones[1].length + lockedZones[2].length + lockedZones[3].length;
            const flexLaneSlots = Math.max(0, 30 - lockedTotal);
            const forLanes = flexPool.slice(0, flexLaneSlots);
            const remainder = flexPool.slice(flexLaneSlots);
            const balancedFlex = distributeByPowerWithKills(forLanes);
            zones = {
                1: [...lockedZones[1], ...balancedFlex[1]],
                2: [...lockedZones[2], ...balancedFlex[2]],
                3: [...lockedZones[3], ...balancedFlex[3]],
            };
            if (team === leagueTeamNumber) {
                const subRoom = Math.max(0, subCap - lockedSubs.length);
                zones[0] = [...lockedSubs, ...remainder.slice(0, subRoom)];
                zones[-1] = remainder.slice(subRoom);
            } else {
                // Weekend teams: subs come only from the sheet's Sub column, no bench.
                zones[0] = [...lockedSubs, ...remainder];
                zones[-1] = [];
            }
        }

        // === Priority 2: respect existing UI-selected rally/garrison leads ===
        // Start from existing selections; only fill empty slots automatically.
        const existingRally = selectedRallyLeadsByTeam[team] || {};
        const existingRally2 = selectedRallyLeadsSecondaryByTeam[team] || {};
        const existingGarrison = selectedGarrisonLeadsByTeam[team] || {};
        const existingArk = selectedArkCarriersByTeam[team] || '';

        const leads: Record<number, string> = { ...existingRally };
        const leads2: Record<number, string> = { ...existingRally2 };
        const garrisonLeads: Record<number, string> = { ...existingGarrison };
        const isLeague = team === leagueTeamNumber;

        for (const [zone, players] of Object.entries(zones)) {
            const zoneNum = parseInt(zone);
            if (zoneNum <= 0 || zoneNum === 2 || players.length === 0) continue;

            const inZone = (name: string) => players.some(p => p.name === name);
            // If existing rally/garrison lead isn't in this zone anymore, clear it for re-pick
            if (leads[zoneNum] && !inZone(leads[zoneNum])) delete leads[zoneNum];
            if (leads2[zoneNum] && !inZone(leads2[zoneNum])) delete leads2[zoneNum];
            if (garrisonLeads[zoneNum] && !inZone(garrisonLeads[zoneNum])) delete garrisonLeads[zoneNum];

            const sorted = [...players].sort((a, b) => getRallyScore(b.name) - getRallyScore(a.name));
            // Only auto-fill if no UI selection exists for this zone
            if (!leads[zoneNum]) leads[zoneNum] = sorted[0].name;
            // Secondary rally lead is sheet-driven only — populated from
            // selectedRallyLeadsSecondaryByTeam at import time when the sheet
            // marks two rally leaders for the same lane. We deliberately don't
            // auto-pick here: if the sheet only lists one, the mail shows one.
            if (!garrisonLeads[zoneNum]) {
                const taken = new Set([leads[zoneNum], leads2[zoneNum]].filter(Boolean));
                const next = sorted.find(p => !taken.has(p.name));
                if (next) garrisonLeads[zoneNum] = next.name;
            }
        }

        // Pre-select ark carrier for mid lane (zone 2) — keep existing if still in zone
        let arkCarrier = existingArk;
        const midPlayers = zones[2] || [];
        if (arkCarrier && !midPlayers.some(p => p.name === arkCarrier)) arkCarrier = '';
        if (!arkCarrier && midPlayers.length > 0) {
            const sorted = [...midPlayers].sort((a, b) => getRallyScore(b.name) - getRallyScore(a.name));
            arkCarrier = sorted[0].name;
        }

        // Pre-select 16 teleport-first slots distributed across lanes (top/bottom
        // heavier than mid, mirroring the 3:2:3 → 6:4:6 split).
        // Priority: rally leads and garrison leads first, then by rally score.
        const TELEPORT_TOTAL = 16;
        const teleport = new Set<string>();
        const slotsPerLane: Record<number, number> = { 1: 6, 2: 4, 3: 6 };
        for (const zoneNum of [1, 2, 3]) {
            const lanePlayers = zones[zoneNum] || [];
            if (lanePlayers.length === 0) continue;
            const slots = slotsPerLane[zoneNum];
            const priority = new Set<string>();
            if (leads[zoneNum]) priority.add(leads[zoneNum]);
            if (garrisonLeads[zoneNum]) priority.add(garrisonLeads[zoneNum]);
            if (zoneNum === 2 && arkCarrier) priority.add(arkCarrier);
            for (const name of priority) {
                if (teleport.size < TELEPORT_TOTAL) teleport.add(name);
            }
            const sorted = [...lanePlayers].sort((a, b) => getRallyScore(b.name) - getRallyScore(a.name));
            let added = [...priority].filter(n => sorted.some(p => p.name === n)).length;
            for (const p of sorted) {
                if (added >= slots || teleport.size >= TELEPORT_TOTAL) break;
                if (!teleport.has(p.name)) {
                    teleport.add(p.name);
                    added++;
                }
            }
        }

        // Stage updates for this team — the loop's batched commit below merges them
        // with all other teams in one render, so multi-team calls don't stale-state clobber.
        zonesUpdates[team] = zones;
        rallyUpdates[team] = leads;
        rallySecondaryUpdates[team] = leads2;
        garrisonUpdates[team] = garrisonLeads;
        arkUpdates[team] = arkCarrier;
        teleportUpdates[team] = teleport;

        } // end for team of teams

        if (!processedAny) {
            alert(t('needPlayers'));
            return;
        }

        // Single batched commit — every team not in `teams` keeps its existing state.
        if (Object.keys(sizeUpdates).length > 0) {
            setZoneSizesByTeam({ ...zoneSizesByTeam, ...sizeUpdates });
        }
        setSuggestedZonesByTeam({ ...suggestedZonesByTeam, ...zonesUpdates });
        setSelectedRallyLeadsByTeam({ ...selectedRallyLeadsByTeam, ...rallyUpdates });
        setSelectedRallyLeadsSecondaryByTeam({ ...selectedRallyLeadsSecondaryByTeam, ...rallySecondaryUpdates });
        setSelectedGarrisonLeadsByTeam({ ...selectedGarrisonLeadsByTeam, ...garrisonUpdates });
        setSelectedArkCarriersByTeam({ ...selectedArkCarriersByTeam, ...arkUpdates });
        setSelectedTeleportFirstByTeam({ ...selectedTeleportFirstByTeam, ...teleportUpdates });

        setBuilderStep('distribute');
    };

    // Auto-distribute when triggered by parent (e.g. after sheet import)
    // lastRef starts at 0 so if component mounts with token > 0, it detects it
    const lastAutoDistributeRef = useRef(0);
    const totalConfirmed = Object.values(confirmationsByTeam).reduce(
        (sum, teamConf) => sum + Object.values(teamConf).filter(v => v === 'confirmed' || v === 'maybe').length, 0
    );
    useEffect(() => {
        if (autoDistributeToken && autoDistributeToken !== lastAutoDistributeRef.current && totalConfirmed > 0) {
            lastAutoDistributeRef.current = autoDistributeToken;
            // After registration import, distribute every team that has confirmed/maybe
            // players in one batched call (preserves the prior multi-team auto-distribute UX).
            const teamsWithPlayers = ([1, 2, 3] as TeamNumber[]).filter(t => {
                if (t > teamCount) return false;
                const conf = confirmationsByTeam[t] || {};
                return Object.values(conf).some(v => v === 'confirmed' || v === 'maybe');
            });
            if (teamsWithPlayers.length > 0) {
                // Bypass locks here — importing a sheet is an explicit user
                // action, and a stale lock from a previous session shouldn't
                // silently swallow the new lineup.
                handleDistribute(teamsWithPlayers, true);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoDistributeToken, totalConfirmed]);

    // Sync the spreadsheet lock map for a player after a manual move so that a
    // subsequent Distribute call respects the user's manual choice. Bench (-1)
    // means "off the team" → clear the lock entirely.
    const setLockForPlayer = (name: string, zone: number) => {
        const teamLocks = { ...(lockedLanesByTeam[activeTeam] || {}) };
        if (zone === -1) {
            delete teamLocks[name];
        } else {
            teamLocks[name] = zone;
        }
        setLockedLanesByTeam({ ...lockedLanesByTeam, [activeTeam]: teamLocks });
    };

    // Move player between zones
    const movePlayerToZone = (playerName: string, fromZone: number, toZone: number) => {
        if (isActiveLocked) {
            alert(`Team ${activeTeam} is locked. Unfreeze it first.`);
            return;
        }
        const newZones = { ...suggestedZones };
        const player = newZones[fromZone].find(p => p.name === playerName);
        if (player) {
            captureSnapshot(`Move ${playerName}`);
            newZones[fromZone] = newZones[fromZone].filter(p => p.name !== playerName);
            newZones[toZone] = [...newZones[toZone], player];
            setSuggestedZones(newZones);
            setLockForPlayer(playerName, toZone);
        }
    };

    // Remove a player from all zones (distribute step)
    const removePlayerFromZones = (playerName: string) => {
        if (isActiveLocked) {
            alert(`Team ${activeTeam} is locked. Unfreeze it first.`);
            return;
        }
        captureSnapshot(`Remove ${playerName}`);
        const newZones = { ...suggestedZones };
        for (const zone of [-1, 0, 1, 2, 3]) {
            if (newZones[zone]) {
                newZones[zone] = newZones[zone].filter(p => p.name !== playerName);
            }
        }
        setSuggestedZones(newZones);
        // Also remove from confirmations for active team
        const teamConf = { ...confirmationsByTeam[activeTeam] };
        delete teamConf[playerName];
        setConfirmationsByTeam({ ...confirmationsByTeam, [activeTeam]: teamConf });
        setLockForPlayer(playerName, -1);
    };

    // Add a player directly to a zone (distribute step)
    const addPlayerToZone = (name: string, zone: number) => {
        if (isActiveLocked) {
            alert(`Team ${activeTeam} is locked. Unfreeze it first.`);
            return;
        }
        // Check not already in a zone
        const allZonePlayers = [...(suggestedZones[-1] || []), ...(suggestedZones[0] || []), ...(suggestedZones[1] || []), ...(suggestedZones[2] || []), ...(suggestedZones[3] || [])];
        if (allZonePlayers.some(p => p.name === name)) return;
        captureSnapshot(`Add ${name}`);
        const power = powerByName[name] || 0;
        const kills = killsByName[name] || 0;
        const newZones = { ...suggestedZones };
        newZones[zone] = [...(newZones[zone] || []), { name, power, kills }];
        setSuggestedZones(newZones);
        // Also add to confirmations
        const teamConf = { ...confirmationsByTeam[activeTeam], [name]: 'confirmed' as const };
        setConfirmationsByTeam({ ...confirmationsByTeam, [activeTeam]: teamConf });
        setLockForPlayer(name, zone);
    };

    // Calculate zone power totals
    const getZonePower = (zone: number) => suggestedZones[zone]?.reduce((sum, p) => sum + p.power, 0) || 0;
    const totalPower = getZonePower(1) + getZonePower(2) + getZonePower(3);

    // Reset to selection step
    const handleReset = () => {
        if (isActiveLocked) {
            alert(`Team ${activeTeam} is locked. Unfreeze it first.`);
            return;
        }
        captureSnapshot(`Reset T${activeTeam}`);
        setBuilderStep('select');
        setSuggestedZones({});
        setSelectedRallyLeads({});
        setSelectedGarrisonLeads({});
        setSelectedArkCarrier('');
        setSelectedTeleportFirst(new Set());
    };

    return (
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
            {/* Alliance & Team Selection */}
            <section className={`${theme.card} border rounded-xl mb-4 sm:mb-6 p-3 sm:p-5`}>
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
                    <h2 className={`text-sm sm:text-base font-semibold uppercase tracking-wider ${theme.textMuted}`}>
                        {t('title')}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                        {/* Alliance selection */}
                        <div className="flex items-center gap-2">
                            <span className={`text-xs sm:text-sm font-medium ${theme.text}`}>{t('alliance')}</span>
                            <select
                                value={builderAlliance}
                                onChange={(e) => setBuilderAlliance(e.target.value)}
                                className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium ${theme.input} min-w-[100px] sm:min-w-[140px] border-2 border-[#4318ff]/50`}
                                disabled={builderStep !== 'select'}
                            >
                                <option value="all">{t('all')}</option>
                                {alliances.map(a => (
                                    <option key={a} value={a}>{allianceDisplay(a)}</option>
                                ))}
                            </select>
                        </div>
                        {/* Team count selection */}
                        <div className="flex items-center gap-2">
                            <span className={`text-xs sm:text-sm font-medium ${theme.text}`}>{t('teamsLabel')}</span>
                            <div className="flex gap-1">
                                {[1, 2, 3].map((n) => (
                                    <button
                                        key={n}
                                        onClick={() => setTeamCount(n as 1 | 2 | 3)}
                                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-sm sm:text-base font-semibold transition-colors ${
                                            teamCount === n
                                                ? 'bg-[#4318ff] text-white ring-2 ring-[#4318ff]/50'
                                                : `${theme.tag} hover:opacity-80`
                                        }`}
                                        disabled={builderStep !== 'select'}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Team summary with colored badges + per-team lock toggle */}
                <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]">
                    <span className={`text-sm font-medium ${theme.textMuted}`}>{t('teamSummary')}</span>
                    {([1, 2, 3] as TeamNumber[]).slice(0, teamCount).map((teamNum) => {
                        const counts = getTeamCounts(teamNum);
                        const colors = {
                            1: { bg: 'bg-blue-600', text: 'text-blue-400', border: 'border-blue-500' },
                            2: { bg: 'bg-orange-600', text: 'text-orange-400', border: 'border-orange-500' },
                            3: { bg: 'bg-purple-600', text: 'text-purple-400', border: 'border-purple-500' },
                        }[teamNum];
                        const teamIsLocked = isTeamLocked(teamNum);
                        return (
                            <div key={teamNum} className="inline-flex items-stretch rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setActiveTeam(teamNum)}
                                    className={`px-3 py-1.5 text-sm font-medium transition-all flex items-center gap-2 ${
                                        activeTeam === teamNum
                                            ? `${colors.bg} text-white shadow-md`
                                            : `${colors.bg}/20 ${colors.text} border ${colors.border}/50 hover:${colors.bg}/30`
                                    }`}
                                    title={leagueTeamNumber === teamNum ? tlb('tabTitle') : undefined}
                                >
                                    <span className="font-bold">{leagueTeamNumber === teamNum ? tlb('tabLabel') : `T${teamNum}`}</span>
                                    {leagueTeamNumber === teamNum ? (
                                        <span
                                            className="text-[11px] sm:text-xs opacity-80 whitespace-nowrap"
                                            title={tlb('countTitle')}
                                        >
                                            {counts.confirmed - (subsByTeam[teamNum]?.size || 0)} {tlb('mainShort')} / {subsByTeam[teamNum]?.size || 0} {tlb('subShort')}
                                        </span>
                                    ) : (
                                        <span className="text-xs opacity-80 whitespace-nowrap">
                                            {counts.confirmed}✓ {counts.maybe > 0 && `+ ${counts.maybe}?`}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => toggleTeamLock(teamNum)}
                                    title={teamIsLocked ? `Unlock T${teamNum} — allow Distribute/edits` : `Lock T${teamNum} — freeze the lineup`}
                                    aria-label={teamIsLocked ? `Unlock team ${teamNum}` : `Lock team ${teamNum}`}
                                    className={`px-3 sm:px-2.5 flex items-center transition-colors border-l border-black/30 ${
                                        teamIsLocked
                                            ? 'bg-amber-500/30 text-amber-200 hover:bg-amber-500/50'
                                            : 'bg-white/5 text-white/60 hover:bg-white/15 hover:text-white'
                                    }`}
                                >
                                    {teamIsLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>
                            </div>
                        );
                    })}
                    {teamCount === 1 && (
                        <span className={`text-xs ${theme.textMuted}`}>{t('addMoreTeams')}</span>
                    )}
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-1 sm:gap-3 mb-5 text-sm flex-wrap">
                    <span className={`px-2.5 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm ${builderStep === 'select' ? 'bg-[#4318ff] text-white' : theme.tag}`}>
                        {t('step1')}
                    </span>
                    <span className={`text-base sm:text-lg ${theme.textMuted}`}>→</span>
                    <span className={`px-2.5 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm ${builderStep === 'distribute' ? 'bg-[#4318ff] text-white' : theme.tag}`}>
                        {t('step2')}
                    </span>
                </div>

                {/* Contextual hint — one line per step */}
                <p className={`text-sm ${theme.textMuted}`}>
                    {builderStep === 'select' && (
                        <>{t.rich('hintSelect', { confirmed: (chunks) => <span className="text-green-400 font-medium">{chunks}</span>, maybe: (chunks) => <span className="text-yellow-400 font-medium">{chunks}</span> })}</>
                    )}
                    {builderStep === 'distribute' && (
                        <>{t.rich('hintDistribute', { strong: (chunks) => <strong>{chunks}</strong> })}</>
                    )}
                </p>
            </section>

            {builderStep === 'select' && (
                <>
                    {/* Player Selection List */}
                    <section className={`${theme.card} border rounded-xl mb-6 p-3 sm:p-5`}>
                        <div className="mb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className={`text-base sm:text-lg font-semibold ${theme.text}`}>
                                        {t('selectPlayers')} <span className={`text-sm sm:text-base font-normal ${theme.textMuted}`}>({combinedRoster.length})</span>
                                    </h3>
                                    {scanLabel && (
                                        <p className={`text-xs ${theme.textMuted} mt-0.5`}>
                                            {t('scan')} <span className={theme.text}>{scanLabel}</span>
                                        </p>
                                    )}
                                </div>
                                <div className="hidden sm:flex items-center gap-6 text-base font-medium">
                                    <span className="text-green-400">
                                        ✓ {confirmedPlayers.length} ({formatPower(confirmedPower)})
                                    </span>
                                    <span className="text-yellow-400">
                                        ? {maybePlayers.length} ({formatPower(maybePower)})
                                    </span>
                                </div>
                            </div>
                            {/* Mobile stats row */}
                            <div className="flex sm:hidden items-center gap-4 mt-2 text-sm font-medium">
                                <span className="text-green-400">✓ {confirmedPlayers.length} ({formatPower(confirmedPower)})</span>
                                <span className="text-yellow-400">? {maybePlayers.length} ({formatPower(maybePower)})</span>
                            </div>
                        </div>

                        {/* Search input */}
                        <div className="mb-4">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={t('searchPlaceholder')}
                                className={`w-full px-4 py-3 rounded-lg text-base ${theme.input}`}
                            />
                        </div>

                        {/* Quick actions */}
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <button
                                onClick={() => setConfirmationsByTeam({ 1: {}, 2: {}, 3: {} })}
                                className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg ${theme.tag} hover:opacity-80`}
                            >
                                {t('clearAll')}
                            </button>
                            <button
                                onClick={() => setShowAddForm(!showAddForm)}
                                className={`px-3 sm:px-5 py-1.5 sm:py-2.5 text-xs sm:text-base font-semibold rounded-lg transition-colors ${
                                    showAddForm
                                        ? 'bg-[#4318ff] text-white'
                                        : 'bg-green-600 text-white hover:bg-green-500'
                                }`}
                            >
                                {t('addMember')}
                            </button>
                            {pendingAdditions.length > 0 && (
                                <button
                                    onClick={() => onSavePendingAdditions(pendingAdditions)}
                                    className="px-3 py-1.5 text-xs sm:text-sm rounded-lg bg-blue-600 text-white hover:opacity-80"
                                >
                                    {t('savePending', { count: pendingAdditions.length })}
                                </button>
                            )}
                        </div>

                        {/* Add Member Form */}
                        {showAddForm && (
                            <div className={`p-4 mb-4 rounded-lg border ${theme.border} bg-[#4318ff]/10`}>
                                <h4 className="text-sm font-medium text-[#9f7aea] mb-3">{t('addMemberTitle')}</h4>
                                <p className={`text-xs ${theme.textMuted} mb-3`}>
                                    {t('addMemberHint')}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                    {/* Name input with autocomplete */}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newMemberName}
                                            onChange={(e) => {
                                                setNewMemberName(e.target.value);
                                                setShowAutoComplete(true);
                                            }}
                                            onFocus={() => setShowAutoComplete(true)}
                                            onBlur={() => setTimeout(() => setShowAutoComplete(false), 200)}
                                            placeholder={t('namePlaceholder')}
                                            className={`w-full px-3 py-2 rounded-lg text-sm ${theme.input}`}
                                        />
                                        {/* Autocomplete dropdown */}
                                        {showAutoComplete && autocompleteSuggestions.length > 0 && (
                                            <div className={`absolute z-50 w-full mt-1 rounded-lg border ${theme.card} shadow-xl max-h-48 overflow-y-auto`}>
                                                {autocompleteSuggestions.map((member) => (
                                                    <button
                                                        key={member.name}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => handleSelectSuggestion(member)}
                                                        className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--background-hover)] flex items-center justify-between border-b ${theme.border}`}
                                                    >
                                                        <span className={theme.text}>{member.name}</span>
                                                        <span className={`text-xs ${theme.textMuted}`}>
                                                            {formatPower(member.power)} • {allianceDisplay(member.alliance)}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={newMemberPower}
                                        onChange={(e) => setNewMemberPower(e.target.value.replace(/\D/g, ''))}
                                        placeholder={t('powerPlaceholder')}
                                        className={`px-3 py-2 rounded-lg text-sm ${theme.input}`}
                                    />
                                    <input
                                        type="text"
                                        value={newMemberGovId}
                                        onChange={(e) => setNewMemberGovId(e.target.value.replace(/\D/g, ''))}
                                        placeholder={t('govIdPlaceholder')}
                                        className={`px-3 py-2 rounded-lg text-sm ${theme.input}`}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleAddMember}
                                        disabled={!newMemberName.trim()}
                                        className={`px-4 py-2 text-sm rounded-lg ${newMemberName.trim() ? 'bg-[#4318ff] text-white hover:bg-[#4318ff]/80' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                                    >
                                        {t('addMemberButton')}
                                    </button>
                                    <button
                                        onClick={() => setShowAddForm(false)}
                                        className={`px-4 py-2 text-sm rounded-lg ${theme.tag} hover:opacity-80`}
                                    >
                                        {t('cancel')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* No results message */}
                        {noResults && (
                            <div className={`p-4 mb-4 rounded-lg text-center ${theme.card} border border-dashed ${theme.border}`}>
                                <p className={`text-sm ${theme.textMuted} mb-2`}>
                                    {t('noMembersFound', { term: searchTerm })}
                                </p>
                                <button
                                    onClick={() => {
                                        setNewMemberName(searchTerm);
                                        setShowAddForm(true);
                                    }}
                                    className="px-4 py-2 text-sm rounded-lg bg-[#4318ff] text-white hover:bg-[#4318ff]/80"
                                >
                                    {t('addAsNew', { term: searchTerm })}
                                </button>
                            </div>
                        )}

                        {/* Sort & Filter Controls */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                            {/* Filter by status */}
                            <div className="flex items-center gap-2">
                                <span className={`text-xs sm:text-sm ${theme.textMuted} shrink-0`}>{t('show')}</span>
                                <div className="flex gap-1 overflow-x-auto">
                                    {(['all', 'confirmed', 'maybe', 'none'] as const).map((filter) => (
                                        <button
                                            key={filter}
                                            onClick={() => setBuilderFilter(filter)}
                                            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors whitespace-nowrap ${
                                                builderFilter === filter
                                                    ? filter === 'confirmed' ? 'bg-green-600 text-white'
                                                    : filter === 'maybe' ? 'bg-yellow-600 text-white'
                                                    : filter === 'none' ? 'bg-gray-600 text-white'
                                                    : 'bg-[#4318ff] text-white'
                                                    : 'bg-[var(--background-secondary)] text-[var(--text-muted)] hover:bg-[var(--background-hover)]'
                                            }`}
                                        >
                                            {filter === 'all' ? t('all') : filter === 'confirmed' ? '✓' : filter === 'maybe' ? '?' : t('none')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Sort dropdown */}
                            <div className="flex items-center gap-2">
                                <span className={`text-xs sm:text-sm ${theme.textMuted} shrink-0`}>{t('sort')}</span>
                                <select
                                    value={builderSort}
                                    onChange={(e) => setBuilderSort(e.target.value as typeof builderSort)}
                                    className={`px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg ${theme.input} cursor-pointer`}
                                >
                                    <option value="power">{t('sortPower')}</option>
                                    <option value="kp">{t('sortKp')}</option>
                                    <option value="t1">{t('sortT1')}</option>
                                    <option value="t2">{t('sortT2')}</option>
                                    <option value="name">{t('sortName')}</option>
                                </select>
                            </div>
                        </div>

                        {/* Player list */}
                        {/* Column headers - clickable for sorting */}
                        {/* Desktop: full grid | Mobile: compact 3-col */}
                        <div className={`hidden sm:grid grid-cols-[1fr_90px_110px_55px_55px_auto_28px] gap-3 px-3 py-2.5 text-sm font-medium ${theme.textMuted} border-b border-[var(--border)]`}>
                            <button onClick={() => setBuilderSort('name')} className={`text-left hover:text-white transition-colors ${builderSort === 'name' ? 'text-white' : ''}`}>
                                {t('name')} {builderSort === 'name' && '↑'}
                            </button>
                            <button onClick={() => setBuilderSort('power')} className={`text-right hover:text-white transition-colors ${builderSort === 'power' ? 'text-white' : ''}`}>
                                {t('power')} {builderSort === 'power' && '↓'}
                            </button>
                            <button onClick={() => setBuilderSort('kp')} className={`text-right hover:text-white transition-colors ${builderSort === 'kp' ? 'text-white' : ''}`} title={t('sortKp')}>
                                {t('kp')} {builderSort === 'kp' && '↓'}
                            </button>
                            <button onClick={() => setBuilderSort('t1')} className={`text-center hover:text-blue-300 transition-colors ${builderSort === 't1' ? 'text-blue-300' : 'text-blue-400'}`} title={t('t1Tooltip')}>
                                T1 {builderSort === 't1' && '↓'}
                            </button>
                            <button onClick={() => setBuilderSort('t2')} className={`text-center hover:text-orange-300 transition-colors ${builderSort === 't2' ? 'text-orange-300' : 'text-orange-400'}`} title={t('t2Tooltip')}>
                                T2 {builderSort === 't2' && '↓'}
                            </button>
                            <span className="text-center">{t('team')}</span>
                            <div></div>
                        </div>
                        {/* Mobile header */}
                        <div className={`sm:hidden grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-xs font-medium ${theme.textMuted} border-b border-[var(--border)]`}>
                            <span>{t('name')}</span>
                            <span>{t('power')}</span>
                            <span>{t('team')}</span>
                        </div>

                        {/* Player list. Tall viewport-based area on mobile so users
                            see ~10 rows at once instead of 6; capped at 400px on sm+. */}
                        <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto space-y-1.5 pt-1">
                            {filteredRoster.map((member) => {
                                const assignment = getPlayerTeamAssignment(member.name);
                                const isPending = 'isPending' in member && member.isPending;
                                const aooStats = eventStats.get(member.name)?.aoo;

                                // Team colors matching in-game: T1=blue, T2=orange, T3=purple
                                const teamColors: Record<TeamNumber, { bg: string; border: string; text: string }> = {
                                    1: { bg: 'bg-blue-600', border: 'border-blue-500', text: 'text-blue-400' },
                                    2: { bg: 'bg-orange-600', border: 'border-orange-500', text: 'text-orange-400' },
                                    3: { bg: 'bg-purple-600', border: 'border-purple-500', text: 'text-purple-400' },
                                };

                                const rowBg = assignment ? `${teamColors[assignment.team].bg}/20 border ${teamColors[assignment.team].border}/30` :
                                    isPending ? 'bg-blue-600/20 border border-blue-500/30 border-dashed' :
                                    'bg-[var(--background-secondary)] border border-[var(--border)]';

                                // Sub toggle for league players: a confirmed league player can be
                                // toggled between Main and Sub for the weekend. Sub is a different
                                // in-game role (not "maybe") — subs are locked to zone 0 at lane
                                // distribution and can be swapped into mains week-to-week.
                                const isLeagueConfirmedHere = leagueTeamNumber !== null
                                    && (confirmationsByTeam[leagueTeamNumber]?.[member.name] === 'confirmed');
                                const isSubHere = leagueTeamNumber !== null
                                    && !!subsByTeam[leagueTeamNumber]?.has(member.name);
                                const toggleSub = () => {
                                    if (leagueTeamNumber === null) return;
                                    const current = subsByTeam[leagueTeamNumber] || new Set<string>();
                                    const next = new Set(current);
                                    if (next.has(member.name)) next.delete(member.name);
                                    else next.add(member.name);
                                    setSubsByTeam({ ...subsByTeam, [leagueTeamNumber]: next });
                                };

                                const teamButtons = (
                                    <div className="flex items-center gap-1">
                                        {([1, 2, 3] as TeamNumber[]).slice(0, teamCount).map((team) => {
                                            const teamConf = confirmationsByTeam[team] || {};
                                            const status = teamConf[member.name] || 'none';
                                            const colors = teamColors[team];
                                            const isLeagueSlot = leagueTeamNumber === team;
                                            const teamLabel = isLeagueSlot ? 'L' : String(team);
                                            const teamTitle = isLeagueSlot ? tlb('tabLabel') : `Team ${team}`;
                                            return (
                                                <button
                                                    key={team}
                                                    onClick={() => toggleTeamConfirmation(member.name, team)}
                                                    className={`w-9 h-9 sm:w-8 sm:h-8 rounded-md text-sm font-bold transition-all ${
                                                        status === 'confirmed'
                                                            ? `${colors.bg} text-white shadow-md`
                                                            : status === 'maybe'
                                                                ? `${colors.bg}/40 ${colors.text} border-2 ${colors.border}`
                                                                : `bg-white/10 text-white/40 border border-white/20 hover:border-white/40`
                                                    }`}
                                                    title={`${teamTitle}: ${status === 'confirmed' ? '✓' : status === 'maybe' ? '?' : t('clickToAdd')}`}
                                                >
                                                    {status === 'confirmed' ? '✓' : status === 'maybe' ? '?' : teamLabel}
                                                </button>
                                            );
                                        })}
                                        {isLeagueConfirmedHere && (
                                            <button
                                                onClick={toggleSub}
                                                className={`px-2 h-9 sm:h-8 rounded-md text-xs font-bold transition-all ${
                                                    isSubHere
                                                        ? 'bg-purple-600 text-white shadow-md'
                                                        : 'bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600/30'
                                                }`}
                                                title={isSubHere ? tlb('subTitle') : tlb('mainTitle')}
                                            >
                                                {isSubHere ? tlb('sub') : tlb('main')}
                                            </button>
                                        )}
                                    </div>
                                );

                                return (
                                    <div key={member.name}>
                                        {/* Desktop row */}
                                        <div className={`hidden sm:grid w-full grid-cols-[1fr_90px_110px_55px_55px_auto_28px] gap-3 items-center px-3 py-3 rounded-lg transition-colors ${rowBg}`}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <button onClick={() => openPlayer(member.name)} className={`font-medium text-base ${theme.text} truncate hover:underline cursor-pointer text-left`} title={t('viewPlayer')}>{member.name}</button>
                                                {isPending && <span className="px-1.5 py-0.5 text-xs rounded bg-blue-600 text-white shrink-0">{t('new')}</span>}
                                            </div>
                                            <span className={`${theme.text} text-sm text-right font-semibold`}>{formatPower(member.power)}</span>
                                            <span className={`${theme.textMuted} text-sm text-right`}>{formatPower(member.kills || killsByName[member.name] || 0)}</span>
                                            <span className={`text-xs text-center font-medium ${aooStats && aooStats.team1Count > 0 ? 'text-blue-400' : theme.textMuted}`}>
                                                {aooStats && aooStats.team1Count > 0 ? `${aooStats.team1Participated}/${aooStats.team1Count}` : '—'}
                                            </span>
                                            <span className={`text-xs text-center font-medium ${aooStats && aooStats.team2Count > 0 ? 'text-orange-400' : theme.textMuted}`}>
                                                {aooStats && aooStats.team2Count > 0 ? `${aooStats.team2Participated}/${aooStats.team2Count}` : '—'}
                                            </span>
                                            {teamButtons}
                                            <div className="flex justify-center">
                                                {isPending && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setPendingAdditions(pendingAdditions.filter(p => p.name !== member.name)); }}
                                                        className="text-red-400 hover:text-red-300 text-sm w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/10"
                                                        title={t('remove')}
                                                        aria-label={t('remove')}
                                                    >✕</button>
                                                )}
                                            </div>
                                        </div>
                                        {/* Mobile row */}
                                        <div className={`sm:hidden grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2.5 rounded-lg transition-colors ${rowBg}`}>
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <button onClick={() => openPlayer(member.name)} className={`font-medium text-sm ${theme.text} truncate hover:underline cursor-pointer text-left`} title={t('viewPlayer')}>{member.name}</button>
                                                {isPending && <span className="px-1 py-0.5 text-[10px] rounded bg-blue-600 text-white shrink-0">{t('new')}</span>}
                                            </div>
                                            <span className={`${theme.textMuted} text-xs text-right tabular-nums`}>{formatPower(member.power)}</span>
                                            {teamButtons}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Distribute button. Sticky-bottom on mobile so it's reachable
                        while scrolling the player list. */}
                    {confirmedPlayers.length + maybePlayers.length > 0 ? (
                        <div className="sticky bottom-0 z-20 -mx-3 px-3 py-3 bg-[var(--background)]/95 backdrop-blur-sm border-t border-[var(--border)] sm:static sm:mx-0 sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-t-0 sm:z-auto flex justify-center items-center gap-2 mb-2 sm:mb-6">
                            {lastSnapshot && (
                                <button
                                    onClick={undoLastChange}
                                    className="flex-shrink-0 px-3 sm:px-4 py-3 rounded-lg text-sm font-medium border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                                    title={`Undo: ${lastSnapshot.label}`}
                                >
                                    ↶ Undo
                                </button>
                            )}
                            <button
                                onClick={() => handleDistribute()}
                                disabled={isActiveLocked}
                                title={isActiveLocked ? `Team ${activeTeam} is locked — unfreeze it to distribute` : ''}
                                className={`flex-1 sm:flex-none sm:w-auto px-6 sm:px-8 py-3 rounded-lg font-semibold text-white text-base sm:text-lg ${
                                    isActiveLocked ? 'bg-[#4318ff]/40 cursor-not-allowed' : 'bg-[#4318ff] hover:bg-[#4318ff]/80'
                                }`}
                            >
                                {isActiveLocked ? `🔒 T${activeTeam} Locked` : t('distributeToLanes')}
                            </button>
                        </div>
                    ) : (
                        <div className={`${theme.card} border border-dashed border-[var(--border)] rounded-xl mb-6 p-8 text-center`}>
                            <p className={`text-base ${theme.textMuted} mb-1`}>{t('noPlayersYet')}</p>
                            <p className={`text-sm ${theme.textMuted}`}>{t.rich('noPlayersHint', { confirmed: (chunks) => <span className="text-green-400 font-medium">{chunks}</span>, maybe: (chunks) => <span className="text-yellow-400 font-medium">{chunks}</span> })}</p>
                        </div>
                    )}
                </>
            )}

            {builderStep === 'distribute' && (
                <>
                    {/* Lane sizing & re-balance controls */}
                    {(() => {
                        const top = parseInt(zoneSizes[1]) || 0;
                        const mid = parseInt(zoneSizes[2]) || 0;
                        const bot = parseInt(zoneSizes[3]) || 0;
                        const laneSlots = top + mid + bot;
                        const playerTotal = confirmedPlayers.length + maybePlayers.length;
                        const subsCount = Math.max(0, playerTotal - laneSlots);
                        const overMax = laneSlots > 30;
                        const subsOverMax = subsCount > 10;
                        return (
                    <section className={`${theme.card} border rounded-xl mb-6 p-3 sm:p-4`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className={`text-xs sm:text-sm font-semibold uppercase tracking-wider ${theme.textMuted}`}>{t('laneSizes')}</h3>
                                <span className={`text-xs font-mono ${overMax ? 'text-red-400 font-semibold' : theme.textMuted}`}>
                                    <span className="text-blue-400">{top}</span>+<span className="text-orange-400">{mid}</span>+<span className="text-purple-400">{bot}</span>=<span className={overMax ? 'text-red-400' : 'text-white font-semibold'}>{laneSlots}</span>
                                </span>
                                <span className={`text-xs ${theme.textMuted}`}>+{subsCount} subs</span>
                                {overMax && <span className="text-xs font-medium text-red-400">{t('max30')}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" checked={!useCustomSizes} onChange={(e) => setUseCustomSizes(!e.target.checked)} className="rounded" />
                                    <span className={`text-xs ${theme.textMuted}`}>{t('auto')}</span>
                                </label>
                                {lastSnapshot && (
                                    <button
                                        onClick={undoLastChange}
                                        className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                                        title={`Undo: ${lastSnapshot.label}`}
                                    >
                                        ↶ Undo
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDistribute()}
                                    disabled={isActiveLocked}
                                    title={isActiveLocked ? `Team ${activeTeam} is locked — unfreeze it to redistribute` : ''}
                                    className={`flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium text-white ${
                                        isActiveLocked ? 'bg-[#4318ff]/40 cursor-not-allowed' : 'bg-[#4318ff] hover:bg-[#4318ff]/80'
                                    }`}
                                >
                                    {isActiveLocked ? '🔒 Locked' : t('reBalance')}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                            <div className={`p-2 rounded-lg border ${overMax ? 'border-red-500/50' : 'border-blue-500'} bg-[var(--background-secondary)]`}>
                                <label className="text-xs text-blue-400 font-semibold block mb-1">{t('top')}</label>
                                <input type="number" min="0" value={zoneSizes[1]} onChange={(e) => setZoneSizes({ ...zoneSizes, 1: e.target.value })} placeholder="10" className={`w-full px-2 py-1.5 rounded-lg text-center text-lg font-bold ${theme.input} border`} />
                            </div>
                            <div className={`p-2 rounded-lg border ${overMax ? 'border-red-500/50' : 'border-orange-500'} bg-[var(--background-secondary)]`}>
                                <label className="text-xs text-orange-400 font-semibold block mb-1">{t('midArk')}</label>
                                <input type="number" min="0" value={zoneSizes[2]} onChange={(e) => setZoneSizes({ ...zoneSizes, 2: e.target.value })} placeholder="10" className={`w-full px-2 py-1.5 rounded-lg text-center text-lg font-bold ${theme.input} border`} />
                            </div>
                            <div className={`p-2 rounded-lg border ${overMax ? 'border-red-500/50' : 'border-purple-500'} bg-[var(--background-secondary)]`}>
                                <label className="text-xs text-purple-400 font-semibold block mb-1">{t('bottom')}</label>
                                <input type="number" min="0" value={zoneSizes[3]} onChange={(e) => setZoneSizes({ ...zoneSizes, 3: e.target.value })} placeholder="10" className={`w-full px-2 py-1.5 rounded-lg text-center text-lg font-bold ${theme.input} border`} />
                            </div>
                            <div className={`p-2 rounded-lg border ${subsOverMax ? 'border-yellow-500/50' : 'border-gray-500'} bg-[var(--background-secondary)]`}>
                                <label className="text-xs text-gray-400 font-semibold block mb-1">{t('subsAuto')}</label>
                                <div className={`w-full px-2 py-1.5 rounded-lg text-center text-lg font-bold ${theme.text} border border-transparent`}>
                                    {subsCount}
                                </div>
                            </div>
                        </div>
                    </section>
                        );
                    })()}

                    {/* Diagnostic: confirmations exist but the active team's lanes
                        are empty. Most often this is because the team is locked or
                        the previous distribute was blocked. Surface it loudly with
                        a one-click bypass so users don't get stuck. */}
                    {(() => {
                        const activeConfTotal = confirmedPlayers.length + maybePlayers.length;
                        const zonePlayerTotal = (suggestedZones[1]?.length || 0)
                            + (suggestedZones[2]?.length || 0)
                            + (suggestedZones[3]?.length || 0)
                            + (suggestedZones[0]?.length || 0)
                            + (suggestedZones[-1]?.length || 0);
                        if (activeConfTotal > 0 && zonePlayerTotal === 0) {
                            return (
                                <section className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                    <span className="text-amber-400">
                                        ⚠ T{activeTeam} has <strong>{activeConfTotal}</strong> confirmed players but no lanes were populated.
                                        {isActiveLocked && <> The team is <strong>locked</strong>.</>}
                                    </span>
                                    <button
                                        onClick={() => handleDistribute([activeTeam], true)}
                                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border border-amber-500/40"
                                        title="Distribute T{activeTeam} ignoring the lock"
                                    >
                                        Force distribute T{activeTeam}
                                    </button>
                                </section>
                            );
                        }
                        return null;
                    })()}

                    {/* Zone Distribution */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {[1, 2, 3].map((zone) => {
                            const zoneColor = ZONE_COLORS[zone as keyof typeof ZONE_COLORS];
                            const zonePlayers = sortZonePlayers(suggestedZones[zone] || [], zone);
                            const zonePower = getZonePower(zone);
                            const balancePercent = totalPower > 0 ? ((zonePower / totalPower) * 100).toFixed(1) : '0';

                            const isMidLane = zone === 2;

                            return (
                                <section key={zone} className={`${theme.card} border-l-4 ${zoneColor.border} rounded-xl p-4`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className={`font-semibold ${zoneColor.text}`}>
                                            {ZONE_NAMES_T[zone]} ({zonePlayers.length})
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={zoneSortModes[zone] || 'default'}
                                                onChange={(e) => setZoneSortModes({ ...zoneSortModes, [zone]: e.target.value })}
                                                className={`text-xs px-2 py-1 rounded ${theme.input}`}
                                                title={t('sortOrder')}
                                            >
                                                <option value="default">{t('tpThenPower')}</option>
                                                <option value="power">{t('sortPower')}</option>
                                                <option value="kp">{t('killPoints')}</option>
                                                <option value="name">{t('sortName')}</option>
                                            </select>
                                            <div className="text-right">
                                                <span className={`text-sm ${theme.textAccent}`}>{formatPower(zonePower)}</span>
                                                <span className={`text-xs ${theme.textMuted} ml-1`}>({balancePercent}%)</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Lead selectors — always 2 rows for consistent height.
                                        The league team also gets an optional 2nd rally lead
                                        per non-mid lane (it has 30 mains across 3 lanes —
                                        two rally leaders per lane is the league norm). */}
                                    <div className="mb-3 space-y-2">
                                        <div className="p-2 rounded bg-[var(--background-secondary)]">
                                            <span className={`text-xs ${theme.textMuted}`}>{isMidLane ? t('arkCarrier') : (activeTeam === leagueTeamNumber && !isMidLane ? tlb('rallyLead1') : t('rallyLead'))}</span>
                                            <select
                                                value={isMidLane ? (selectedArkCarrier || '') : (selectedRallyLeads[zone] || '')}
                                                onChange={(e) => isMidLane ? setSelectedArkCarrier(e.target.value) : setSelectedRallyLeads({ ...selectedRallyLeads, [zone]: e.target.value })}
                                                className={`w-full mt-1 px-2 py-1 rounded text-sm ${theme.input}`}
                                            >
                                                <option value="">{isMidLane ? t('selectArkCarrier') : t('selectRallyLead')}</option>
                                                {[...zonePlayers].sort((a, b) => getRallyScore(b.name) - getRallyScore(a.name)).map(p => (
                                                    <option key={p.name} value={p.name}>
                                                        {p.name} | {formatPower(p.power)} | {t('kp')}: {formatPower(p.kills || killsByName[p.name] || 0)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {/* Optional 2nd rally lead — league team only, non-mid lanes. */}
                                        {activeTeam === leagueTeamNumber && !isMidLane && (
                                            <div className="p-2 rounded bg-[var(--background-secondary)]">
                                                <span className={`text-xs ${theme.textMuted}`}>{tlb('rallyLead2')}</span>
                                                <select
                                                    value={selectedRallyLeadsSecondary[zone] || ''}
                                                    onChange={(e) => setSelectedRallyLeadsSecondary({ ...selectedRallyLeadsSecondary, [zone]: e.target.value })}
                                                    className={`w-full mt-1 px-2 py-1 rounded text-sm ${theme.input}`}
                                                >
                                                    <option value="">{tlb('selectRallyLead2')}</option>
                                                    {[...zonePlayers]
                                                        .filter(p => p.name !== selectedRallyLeads[zone])
                                                        .sort((a, b) => getRallyScore(b.name) - getRallyScore(a.name))
                                                        .map(p => (
                                                            <option key={p.name} value={p.name}>
                                                                {p.name} | {formatPower(p.power)} | {t('kp')}: {formatPower(p.kills || killsByName[p.name] || 0)}
                                                            </option>
                                                        ))}
                                                </select>
                                            </div>
                                        )}
                                        <div className="p-2 rounded bg-[var(--background-secondary)]">
                                            {isMidLane ? (
                                                <span className={`text-xs ${theme.textMuted} block py-[11px]`}>&nbsp;</span>
                                            ) : (
                                                <>
                                                    <span className={`text-xs ${theme.textMuted}`}>{t('garrisonLead')}</span>
                                                    <select
                                                        value={selectedGarrisonLeads[zone] || ''}
                                                        onChange={(e) => setSelectedGarrisonLeads({ ...selectedGarrisonLeads, [zone]: e.target.value })}
                                                        className={`w-full mt-1 px-2 py-1 rounded text-sm ${theme.input}`}
                                                    >
                                                        <option value="">{t('selectGarrisonLead')}</option>
                                                        {[...zonePlayers].sort((a, b) => getRallyScore(b.name) - getRallyScore(a.name)).map(p => (
                                                            <option key={p.name} value={p.name}>
                                                                {p.name} | {formatPower(p.power)} | {t('kp')}: {formatPower(p.kills || killsByName[p.name] || 0)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Player List. Name gets first claim on row width;
                                        power is shown as a small pill below the name so
                                        long names don't get truncated to "B...". KP is
                                        on the row's title attr (hover) plus visible in
                                        the rally/garrison/ark dropdown options above. */}
                                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                                        {zonePlayers.map((player) => {
                                            const kp = player.kills || killsByName[player.name] || 0;
                                            return (
                                            <div
                                                key={player.name}
                                                className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[var(--background-secondary)]"
                                                title={`Power: ${formatPower(player.power)} · KP: ${formatPower(kp)}`}
                                            >
                                                {/* Teleport First (max 8 per team) */}
                                                <button
                                                    onClick={() => {
                                                        const newSet = new Set(selectedTeleportFirst);
                                                        if (newSet.has(player.name)) {
                                                            newSet.delete(player.name);
                                                        } else if (newSet.size < 8) {
                                                            newSet.add(player.name);
                                                        }
                                                        setSelectedTeleportFirst(newSet);
                                                    }}
                                                    className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs ${
                                                        selectedTeleportFirst.has(player.name) ? 'bg-[#4318ff] text-white'
                                                        : selectedTeleportFirst.size >= 8 ? 'bg-white/5 cursor-not-allowed'
                                                        : 'bg-white/20'
                                                    }`}
                                                    title={selectedTeleportFirst.has(player.name) ? t('removeFromTp') : selectedTeleportFirst.size >= 8 ? t('maxTp') : t('addToTp')}
                                                    disabled={!selectedTeleportFirst.has(player.name) && selectedTeleportFirst.size >= 8}
                                                >
                                                    {selectedTeleportFirst.has(player.name) ? '⚡' : ''}
                                                </button>
                                                {/* Name + power. Name gets flex-1 so it can use all remaining width. */}
                                                <div className="flex-1 min-w-0">
                                                    <button onClick={() => openPlayer(player.name)} title="View player details" className={`block w-full text-sm text-left truncate hover:underline cursor-pointer hover:text-[#4318ff] ${
                                                        selectedRallyLeads[zone] === player.name ? 'font-bold text-yellow-400'
                                                        : selectedRallyLeadsSecondary[zone] === player.name ? 'font-bold text-yellow-400'
                                                        : selectedGarrisonLeads[zone] === player.name ? 'font-bold text-cyan-400'
                                                        : (isMidLane && selectedArkCarrier === player.name) ? 'font-bold text-orange-400'
                                                        : theme.text
                                                    }`}>
                                                        {player.name}
                                                        {selectedRallyLeads[zone] === player.name && ' ⭐'}
                                                        {selectedRallyLeadsSecondary[zone] === player.name && ' ⭐'}
                                                        {selectedGarrisonLeads[zone] === player.name && ' 🛡️'}
                                                        {isMidLane && selectedArkCarrier === player.name && ' 📦'}
                                                    </button>
                                                    <span className={`text-[11px] tabular-nums ${theme.textMuted}`}>
                                                        {formatPower(player.power)}
                                                    </span>
                                                </div>
                                                {/* Move zone + Remove */}
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <select
                                                        value={zone}
                                                        onChange={(e) => movePlayerToZone(player.name, zone, parseInt(e.target.value))}
                                                        className={`text-xs px-1.5 sm:px-2 py-1 rounded ${theme.input} w-14 sm:w-16`}
                                                    >
                                                        <option value={0}>{t('moveZone.sub')}</option>
                                                        <option value={1}>{t('moveZone.top')}</option>
                                                        <option value={2}>{t('moveZone.mid')}</option>
                                                        <option value={3}>{t('moveZone.bot')}</option>
                                                        <option value={-1}>{t('moveZone.bench')}</option>
                                                    </select>
                                                    <button
                                                        onClick={() => removePlayerFromZones(player.name)}
                                                        className="text-red-500 hover:text-red-400 text-sm w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/10"
                                                        title={t('removeFromLanes')}
                                                        aria-label={t('removeFromLanes')}
                                                    >✕</button>
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                    </div>

                    {/* Substitutes Section */}
                    {(suggestedZones[0]?.length || 0) > 0 && (
                        <section className={`${theme.card} border-l-4 border-gray-500 rounded-xl p-4 mb-6`}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className={`font-semibold text-gray-400`}>
                                    {t('substitutes')} ({suggestedZones[0]?.length || 0})
                                </h3>
                                <span className={`text-sm ${theme.textMuted}`}>
                                    {formatPower(suggestedZones[0]?.reduce((sum, p) => sum + p.power, 0) || 0)}
                                </span>
                            </div>
                            <p className={`text-xs ${theme.textMuted} mb-3`}>
                                {t('substitutesHint')}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {(suggestedZones[0] || []).map((player) => (
                                    <div key={player.name} className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--background-secondary)]">
                                        <button onClick={() => openPlayer(player.name)} title="View player details" className={`text-sm hover:underline cursor-pointer hover:text-[#4318ff] ${theme.text}`}>{player.name}</button>
                                        <span className={`text-xs ${theme.textMuted}`}>{formatPower(player.power)}</span>
                                        <select
                                            value={0}
                                            onChange={(e) => movePlayerToZone(player.name, 0, parseInt(e.target.value))}
                                            className={`text-xs px-2 py-1 rounded ${theme.input}`}
                                        >
                                            <option value={0}>{t('moveZone.sub')}</option>
                                            <option value={1}>{t('moveZone.toTop')}</option>
                                            <option value={2}>{t('moveZone.toMid')}</option>
                                            <option value={3}>{t('moveZone.toBot')}</option>
                                            <option value={-1}>{t('moveZone.toBench')}</option>
                                        </select>
                                        <button
                                            onClick={() => removePlayerFromZones(player.name)}
                                            className="text-red-500 hover:text-red-400 text-sm w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/10"
                                            title={t('removeFromRoster')}
                                            aria-label={t('removeFromRoster')}
                                        >✕</button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Bench — registered but didn't make the active roster
                        (30 + 10 for normal teams; 30 + 15 for the league team). */}
                    {(suggestedZones[-1]?.length || 0) > 0 && (
                        <section className={`${theme.card} border-l-4 border-amber-500 rounded-xl p-4 mb-6`}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-amber-400">
                                    {t('bench')} ({suggestedZones[-1]?.length || 0})
                                </h3>
                                <span className={`text-sm ${theme.textMuted}`}>
                                    {formatPower(suggestedZones[-1]?.reduce((sum, p) => sum + p.power, 0) || 0)}
                                </span>
                            </div>
                            <p className={`text-xs ${theme.textMuted} mb-3`}>
                                {t(activeTeam === leagueTeamNumber ? 'benchHintLeague' : 'benchHint')}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {(suggestedZones[-1] || []).map((player) => (
                                    <div key={player.name} className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--background-secondary)]">
                                        <button onClick={() => openPlayer(player.name)} title="View player details" className={`text-sm hover:underline cursor-pointer hover:text-[#4318ff] ${theme.text}`}>{player.name}</button>
                                        <span className={`text-xs ${theme.textMuted}`}>{formatPower(player.power)}</span>
                                        <select
                                            value={-1}
                                            onChange={(e) => movePlayerToZone(player.name, -1, parseInt(e.target.value))}
                                            className={`text-xs px-2 py-1 rounded ${theme.input}`}
                                        >
                                            <option value={-1}>{t('bench')}</option>
                                            <option value={0}>{t('moveZone.toSub')}</option>
                                            <option value={1}>{t('moveZone.toTop')}</option>
                                            <option value={2}>{t('moveZone.toMid')}</option>
                                            <option value={3}>{t('moveZone.toBot')}</option>
                                        </select>
                                        <button
                                            onClick={() => removePlayerFromZones(player.name)}
                                            className="text-red-500 hover:text-red-400 text-sm w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/10"
                                            title={t('removeCompletely')}
                                            aria-label={t('removeCompletely')}
                                        >✕</button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Coordinators — 5 per team, can be from any lane */}
                    <section className={`${theme.card} border rounded-xl mb-6 p-4`}>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className={`text-sm font-semibold uppercase tracking-wider ${theme.textMuted}`}>
                                {t('coordinators')}
                                <span className={`font-normal ml-2 ${coordinators.size > 5 ? 'text-red-400' : coordinators.size === 5 ? 'text-green-400' : theme.textMuted}`}>
                                    {coordinators.size}/5
                                </span>
                            </h3>
                        </div>
                        <p className={`text-xs ${theme.textMuted} mb-3`}>{t('coordinatorsHint')}</p>
                        <div className="flex flex-wrap gap-1.5">
                            {[...(suggestedZones[1] || []), ...(suggestedZones[2] || []), ...(suggestedZones[3] || [])].map(p => {
                                const isCoord = coordinators.has(p.name);
                                const isLead = Object.values(selectedRallyLeads).includes(p.name) || Object.values(selectedRallyLeadsSecondary).includes(p.name) || Object.values(selectedGarrisonLeads).includes(p.name);
                                return (
                                    <button
                                        key={p.name}
                                        onClick={() => {
                                            const next = new Set(coordinators);
                                            if (next.has(p.name)) next.delete(p.name);
                                            else if (next.size < 5) next.add(p.name);
                                            setCoordinators(next);
                                        }}
                                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                                            isCoord
                                                ? 'bg-stone-600 text-white ring-2 ring-stone-400'
                                                : isLead
                                                    ? `${theme.tag} ring-1 ring-yellow-500/30`
                                                    : `${theme.tag} hover:opacity-80`
                                        }`}
                                        title={isCoord ? 'Coordinator (click to remove)' : isLead ? 'Lead — click to add as coordinator' : 'Click to add as coordinator'}
                                    >
                                        {isCoord && '★ '}{p.name}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Legend */}
                    <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mb-6 text-xs ${theme.textMuted}`}>
                        <span>⭐ {t('legendRally')}</span>
                        <span>🛡️ {t('legendGarrison')}</span>
                        <span>📦 {t('legendArk')}</span>
                        <span>★ {t('legendCoord')}</span>
                        <span>⚡ {t('legendTp')} ({selectedTeleportFirst.size}/8)</span>
                    </div>

                    {/* Add Player to lanes */}
                    <section className={`${theme.card} border rounded-xl mb-6 p-4`}>
                        <h3 className={`text-sm font-semibold uppercase tracking-wider ${theme.textMuted} mb-3`}>{t('addPlayer')}</h3>
                        {(() => {
                            const allZoneNames = new Set([
                                ...(suggestedZones[0] || []).map(p => p.name),
                                ...(suggestedZones[1] || []).map(p => p.name),
                                ...(suggestedZones[2] || []).map(p => p.name),
                                ...(suggestedZones[3] || []).map(p => p.name),
                            ]);
                            const suggestions = distributeAddSearch.trim().length >= 2
                                ? [...roster, ...pendingAdditions]
                                    .filter(m => !allZoneNames.has(m.name) && m.name.toLowerCase().includes(distributeAddSearch.toLowerCase()))
                                    .slice(0, 8)
                                : [];
                            return (
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={distributeAddSearch}
                                            onChange={(e) => setDistributeAddSearch(e.target.value)}
                                            placeholder={t('searchPlayerName')}
                                            className={`w-full px-3 py-2 rounded-lg text-sm ${theme.input} border`}
                                        />
                                        {suggestions.length > 0 && (
                                            <div className={`absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border ${theme.card} shadow-lg max-h-48 overflow-y-auto`}>
                                                {suggestions.map(m => (
                                                    <button
                                                        key={m.name}
                                                        onClick={() => {
                                                            addPlayerToZone(m.name, distributeAddZone);
                                                            setDistributeAddSearch('');
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--background-hover)] flex items-center justify-between`}
                                                    >
                                                        <span>{m.name}</span>
                                                        <span className={`text-xs ${theme.textMuted}`}>{formatPower(m.power)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <select
                                        value={distributeAddZone}
                                        onChange={(e) => setDistributeAddZone(parseInt(e.target.value))}
                                        className={`px-3 py-2 rounded-lg text-sm ${theme.input} border min-w-[120px]`}
                                    >
                                        <option value={0}>{t('addToZone.substitutes')}</option>
                                        <option value={1}>{t('addToZone.topLane')}</option>
                                        <option value={2}>{t('addToZone.midLane')}</option>
                                        <option value={3}>{t('addToZone.bottomLane')}</option>
                                        <option value={-1}>{t('addToZone.bench')}</option>
                                    </select>
                                </div>
                            );
                        })()}
                    </section>

                    {/* Mail header picker — controls the banner rendered at the top
                        of the per-team RoK mails. Per plan, persisted automatically. */}
                    <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]">
                        <span className={`text-xs sm:text-sm ${theme.textMuted}`}>Mail header:</span>
                        <select
                            value={mailHeader}
                            onChange={(e) => setMailHeader(e.target.value)}
                            className={`px-2 py-1.5 rounded-lg text-xs sm:text-sm ${theme.input} border`}
                        >
                            {Object.entries(MAIL_HEADER_PRESETS).map(([key, p]) => (
                                <option key={key} value={key}>{p.label}</option>
                            ))}
                        </select>
                        {mailHeader === 'none' && (
                            <span className={`text-[11px] ${theme.textMuted}`}>(no banner at top of mail)</span>
                        )}
                    </div>

                    {/* Action Buttons. Mobile: secondary actions wrap above, the
                        primary "Confirm for everyone" stretches full-width below.
                        Pinned to the bottom of the viewport on mobile so the save
                        action stays reachable when scrolling through long zone lists. */}
                    <div className="sticky bottom-0 z-20 -mx-3 px-3 py-3 bg-[var(--background)]/95 backdrop-blur-sm border-t border-[var(--border)] sm:static sm:mx-0 sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-t-0 sm:z-auto flex flex-col sm:flex-row sm:flex-wrap sm:justify-center gap-2 sm:gap-3">
                        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-3">
                            <button
                                onClick={handleReset}
                                className={`px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${theme.tag} hover:opacity-80`}
                            >
                                {t('back')}
                            </button>
                            <button
                                onClick={copySummaryToClipboard}
                                className={`px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                                    copiedSummary
                                        ? 'bg-green-600 text-white'
                                        : 'bg-[var(--background-secondary)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--background-hover)]'
                                }`}
                            >
                                {copiedSummary ? t('copiedText') : `📋 ${t('copyText')}`}
                            </button>
                            {/* Mail copy buttons — one per team */}
                            {([1, 2, 3] as TeamNumber[]).slice(0, teamCount).map(t => {
                                const teamColors = { 1: 'text-blue-400 border-blue-500/30 hover:bg-blue-500/10', 2: 'text-orange-400 border-orange-500/30 hover:bg-orange-500/10', 3: 'text-purple-400 border-purple-500/30 hover:bg-purple-500/10' };
                                return (
                                    <button
                                        key={t}
                                        onClick={() => copyMailToClipboard(t)}
                                        className={`px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors border ${
                                            copiedMail ? 'bg-green-600 text-white border-green-600' : teamColors[t]
                                        }`}
                                    >
                                        {copiedMail ? '✓' : `✉ T${t}`}
                                    </button>
                                );
                            })}
                            <CopyTeleportFirstButton
                                names={[...(selectedTeleportFirstByTeam[activeTeam] || [])]}
                                team={activeTeam}
                            />
                        </div>
                        <ConfirmForEveryoneButton onConfirm={onConfirm} />
                    </div>
                </>
            )}
        </div>
    );
}

function CopyTeleportFirstButton({
    names,
    team,
}: {
    names: string[];
    team: number;
}) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        if (names.length === 0) return;
        const text = `First to teleport: ${names.join(', ')}`;
        try { await navigator.clipboard.writeText(text); } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };
    return (
        <button
            onClick={handleCopy}
            className={`px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                copied
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[var(--background-secondary,#1e1e2e)] border border-[var(--border,#333)] text-[var(--text-secondary,#aaa)] hover:text-[var(--foreground,#fff)]'
            }`}
            title="Copy teleport-first list for in-game chat"
        >
            {copied ? '✓ Copied!' : (<><span className="sm:hidden">TP T{team}</span><span className="hidden sm:inline">Copy Team {team} TP First</span></>)}
        </button>
    );
}

function ConfirmForEveryoneButton({ onConfirm }: { onConfirm: () => void }) {
    const [confirmed, setConfirmed] = useState(false);
    return (
        <button
            onClick={() => {
                onConfirm();
                setConfirmed(true);
                setTimeout(() => setConfirmed(false), 2500);
            }}
            className={`w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-2 rounded-lg text-sm font-medium transition-colors ${
                confirmed
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-white bg-[#4318ff] hover:bg-[#4318ff]/80'
            }`}
            title="Save this lineup to the shared plan so anyone with the link sees the same thing"
        >
            {confirmed ? '✓ Saved!' : 'Confirm for everyone'}
        </button>
    );
}

/** The AoO planner — the AOO section of the Kingdom Planner. `officer`:
 *  signed in as officer/admin on the site (unlocks the officer tools). */
export default function AooPlanner({ officer }: { officer: boolean }) {
    const t = useTranslations('aoo');
    const ts = useTranslations('aoo.strategy');
    // URL params and router for shareable plans
    const searchParams = useSearchParams();
    const router = useRouter();
    const planIdFromUrl = searchParams.get('plan');

    // Auth for saving user selections
    const { user } = useAuth();
    const { openPlayer } = usePlayerDrawer();

    // Fetch roster from Supabase. We pull both the alliance-filtered roster
    // (used for the team builder's alliance dropdown / by-name lookups) and
    // the *unfiltered* scan maps below — the alliance filter drops players
    // with no alliance / ILLEGAL status, which would silently cause AOO power
    // lookups to miss valid kingdom members like tigergirl (210400163).
    const { roster, rosterNames, powerByName, killsByName, allianceByName, alliances: dbAlliances, loading: rosterLoading, scanLabel, scanPowerByGovId, scanKillsByGovId } = useScanRoster();
    // Use the unfiltered scan maps directly for the gov-id power lookup — every
    // player in the latest scan is reachable, regardless of alliance status.
    const powerByGovId = scanPowerByGovId;
    const killsByGovId = scanKillsByGovId;
    const [activeTab, setActiveTab] = useState<'map' | 'builder' | 'registration'>('registration');
    const [players, setPlayers] = useState<Player[]>([]);
    const [substitutes, setSubstitutes] = useState<Player[]>([]);
    const [teams, setTeams] = useState<TeamInfo[]>(DEFAULT_TEAMS);
    const [mapImage, setMapImage] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [mapAssignments, setMapAssignments] = useState<MapAssignments | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [strategyId, setStrategyId] = useState<number | null>(null);
    const strategyIdRef = useRef<number | null>(null);
    // Vision UI theme is always dark - no toggle needed
    const [strategyExpanded, setStrategyExpanded] = useState(false);
    const [eventMode, setEventMode] = useState<EventMode>('main');
    const [aooTeam, setAooTeam] = useState<AooTeam>('team1');

    // Shareable plan state
    const [shareId, setShareId] = useState<string | null>(null);
    const shareIdRef = useRef<string | null>(null);
    const [planName, setPlanName] = useState<string>('');
    const [linkCopied, setLinkCopied] = useState(false);

    // Officer login state
    const [isOfficer, setIsOfficer] = useState(officer);
    const [showOfficerPrompt, setShowOfficerPrompt] = useState(false);
    const [officerPasswordInput, setOfficerPasswordInput] = useState('');
    const handleOfficerLogin = () => {
        if (officerPasswordInput === OFFICER_PASSWORD) {
            setIsOfficer(true);
            setShowOfficerPrompt(false);
            setOfficerPasswordInput('');
        } else {
            alert(t('officer.incorrect'));
        }
    };

    // Everyone can edit shared plans (no password needed)
    const isEditor = !!shareId;

    const [playerSearch, setPlayerSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [newPlayerTeam, setNewPlayerTeam] = useState(1);
    const [newPlayerTags, setNewPlayerTags] = useState<string[]>([]);
    const [useCustomName, setUseCustomName] = useState(false);
    const [rosterSort, setRosterSort] = useState<'power' | 'teleport' | 'name'>('teleport');
    const [rosterTeamFilter, setRosterTeamFilter] = useState<'all' | 'T1' | 'T2' | 'T3'>('all');
    const [copySuccess, setCopySuccess] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const rosterGridRef = useRef<HTMLDivElement>(null);
    const rosterCanvasRef = useRef<HTMLCanvasElement>(null);

    // Team Builder state
    const [builderAlliance, setBuilderAlliance] = useState<string>('ANG');
    const [teamCount, setTeamCount] = useState<TeamNumber>(1); // Number of AoO teams to organize
    const [activeTeam, setActiveTeam] = useState<TeamNumber>(1); // Which team is being edited/distributed
    const [builderStep, setBuilderStep] = useState<'select' | 'distribute'>('select');
    const [pendingAdditions, setPendingAdditions] = useState<PendingMember[]>([]);
    const [autoDistributeToken, setAutoDistributeToken] = useState(0);

    // Per-team state
    const emptyTeamState = { 1: {}, 2: {}, 3: {} };
    const [confirmationsByTeam, setConfirmationsByTeam] = useState<ConfirmationsByTeam>({ 1: {}, 2: {}, 3: {} });
    const [suggestedZonesByTeam, setSuggestedZonesByTeam] = useState<ZonesByTeam>({ 1: {}, 2: {}, 3: {} });
    const [selectedRallyLeadsByTeam, setSelectedRallyLeadsByTeam] = useState<RallyLeadsByTeam>({ 1: {}, 2: {}, 3: {} });
    // Optional secondary rally lead per zone — used only on the league team.
    // For normal weekend teams these stay empty.
    const [selectedRallyLeadsSecondaryByTeam, setSelectedRallyLeadsSecondaryByTeam] = useState<RallyLeadsByTeam>({ 1: {}, 2: {}, 3: {} });
    const [selectedGarrisonLeadsByTeam, setSelectedGarrisonLeadsByTeam] = useState<GarrisonLeadsByTeam>({ 1: {}, 2: {}, 3: {} });
    const [selectedArkCarriersByTeam, setSelectedArkCarriersByTeam] = useState<ArkCarriersByTeam>({ 1: '', 2: '', 3: '' });
    const [selectedTeleportFirstByTeam, setSelectedTeleportFirstByTeam] = useState<TeleportFirstByTeam>({ 1: new Set(), 2: new Set(), 3: new Set() });
    const [coordinatorsByTeam, setCoordinatorsByTeam] = useState<Record<TeamNumber, Set<string>>>({ 1: new Set(), 2: new Set(), 3: new Set() });
    // Subs are confirmed players slotted into the in-game sub role (not "maybe").
    // Lane distribution locks them to zone 0 so they're benched until swapped in.
    // Officers can toggle main/sub each weekend on the league team.
    const [subsByTeam, setSubsByTeam] = useState<Record<TeamNumber, Set<string>>>({ 1: new Set(), 2: new Set(), 3: new Set() });
    // Designates which team slot is the league team. League players come from
    // the dedicated league sheet tab and are excluded from normal Team 1/Team 2.
    const [leagueTeamNumber, setLeagueTeamNumber] = useState<TeamNumber | null>(null);
    const [zoneSizesByTeam, setZoneSizesByTeam] = useState<ZoneSizesByTeam>({
        1: { 0: '', 1: '', 2: '', 3: '' },
        2: { 0: '', 1: '', 2: '', 3: '' },
        3: { 0: '', 1: '', 2: '', 3: '' }
    });
    // Spreadsheet lane locks per team: name -> forced lane (1|2|3).
    // Populated from CSV "Lane" column on registration import; honored by handleDistribute.
    const [lockedLanesByTeam, setLockedLanesByTeam] = useState<LockedLanesByTeam>({ 1: {}, 2: {}, 3: {} });
    // Teams whose lineup is frozen — user-toggled. Distribute + per-player mutations
    // refuse to touch a locked team until the user clicks the lock icon to unfreeze.
    const [lockedTeams, setLockedTeams] = useState<Set<TeamNumber>>(new Set());
    // RoK-mail alliance header preset — picked from a dropdown next to the
    // copy-mail buttons. Persisted per plan so different plans (different
    // alliances) can each render their own banner.
    const [mailHeader, setMailHeader] = useState<string>('ANG');

    // Save pending additions to Supabase for admin approval
    const handleSavePendingAdditions = async (additions: PendingMember[]) => {
        if (additions.length === 0) return;

        try {
            const supabase = (await import('@/lib/supabase/client')).createClient();
            const { error } = await supabase
                .from('pending_roster_additions')
                .insert(additions.map(a => ({
                    name: a.name,
                    power: a.power || null,
                    governor_id: a.governorId ? parseInt(a.governorId) : null,
                    alliance: builderAlliance !== 'all' ? builderAlliance : null,
                    suggested_by: user?.id || 'anonymous',
                })));

            if (error) {
                console.error('Error saving pending additions:', error);
                alert(t('builder.failedSave'));
            } else {
                alert(t('builder.membersSubmitted', { count: additions.length }));
            }
        } catch (err) {
            console.error('Error saving pending additions:', err);
        }
    };

    // Load plan by share_id from URL
    useEffect(() => {
        if (planIdFromUrl) {
            loadPlanByShareId(planIdFromUrl);
        } else {
            // No plan in URL - show landing page
            setIsLoading(false);
        }
    }, [planIdFromUrl]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Create a new plan with a unique share_id
    const createNewPlan = async () => {
        const newShareId = generateShareId();
        setIsLoading(true);

        try {
            const { data: newData, error } = await supabase
                .from('aoo_strategy')
                .insert([{
                    share_id: newShareId,
                    name: 'New AoO Plan',
                    data: {
                        players: [],
                        substitutes: [],
                        teams: DEFAULT_TEAMS,
                        mapImage: null,
                        notes: '',
                        mapAssignments: {}
                    }
                }])
                .select()
                .single();

            if (error) {
                console.error('Error creating plan:', error);
                alert(t('builder.failedCreate', { error: error.message || error.code || 'Unknown error' }));
                setIsLoading(false);
                return;
            }

            if (newData) {
                // Update URL without reload
                router.push(`/kingdom-planner?plan=${newShareId}`);
            }
        } catch (err) {
            console.error('Error creating plan:', err);
            alert(t('builder.failedCreateGeneric'));
            setIsLoading(false);
        }
    };

    // Load plan by share_id
    const loadPlanByShareId = async (planShareId: string) => {
        setIsLoading(true);
        console.log('Loading plan by share_id:', planShareId);

        try {
            const { data, error } = await supabase
                .from('aoo_strategy')
                .select('*')
                .eq('share_id', planShareId)
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('Error loading plan:', error);
                setIsLoading(false);
                return;
            }

            if (data) {
                console.log('Loaded plan:', data.id, data.share_id);
                setStrategyId(data.id);
                strategyIdRef.current = data.id;
                setShareId(data.share_id);
                shareIdRef.current = data.share_id;
                setPlanName(data.name || 'Untitled Plan');

                const strategyData = data.data as StrategyData;
                setPlayers(strategyData?.players || []);
                setSubstitutes(strategyData?.substitutes || []);
                setTeams(strategyData?.teams || DEFAULT_TEAMS);
                setMapImage(strategyData?.mapImage || null);
                setNotes(strategyData?.notes || '');
                setMapAssignments(strategyData?.mapAssignments || undefined);
                // Restore Team Builder state
                if (strategyData?.builderAlliance) setBuilderAlliance(strategyData.builderAlliance);
                if (strategyData?.teamCount) setTeamCount(strategyData.teamCount as TeamNumber);
                if (strategyData?.builderStep) {
                    // Legacy plans saved 'leads' or 'done' — both are gone now.
                    // Map them onto 'distribute' so viewers see the lane assignments
                    // instead of a blank page.
                    const step = strategyData.builderStep;
                    setBuilderStep(step === 'select' ? 'select' : 'distribute');
                }
                if (strategyData?.confirmationsByTeam) setConfirmationsByTeam(strategyData.confirmationsByTeam as ConfirmationsByTeam);
                if (strategyData?.suggestedZonesByTeam) setSuggestedZonesByTeam(strategyData.suggestedZonesByTeam as ZonesByTeam);
                if (strategyData?.selectedRallyLeadsByTeam) setSelectedRallyLeadsByTeam(strategyData.selectedRallyLeadsByTeam as RallyLeadsByTeam);
                if (strategyData?.selectedRallyLeadsSecondaryByTeam) setSelectedRallyLeadsSecondaryByTeam(strategyData.selectedRallyLeadsSecondaryByTeam as RallyLeadsByTeam);
                if (strategyData?.selectedTeleportFirstByTeam) {
                    const restored: TeleportFirstByTeam = {
                        1: new Set(strategyData.selectedTeleportFirstByTeam[1] || []),
                        2: new Set(strategyData.selectedTeleportFirstByTeam[2] || []),
                        3: new Set(strategyData.selectedTeleportFirstByTeam[3] || []),
                    };
                    setSelectedTeleportFirstByTeam(restored);
                }
                if (strategyData?.zoneSizesByTeam) setZoneSizesByTeam(strategyData.zoneSizesByTeam as ZoneSizesByTeam);
                if (strategyData?.selectedGarrisonLeadsByTeam) setSelectedGarrisonLeadsByTeam(strategyData.selectedGarrisonLeadsByTeam as GarrisonLeadsByTeam);
                if (strategyData?.selectedArkCarriersByTeam) setSelectedArkCarriersByTeam(strategyData.selectedArkCarriersByTeam as ArkCarriersByTeam);
                if (strategyData?.coordinatorsByTeam) {
                    setCoordinatorsByTeam({
                        1: new Set(strategyData.coordinatorsByTeam[1] || []),
                        2: new Set(strategyData.coordinatorsByTeam[2] || []),
                        3: new Set(strategyData.coordinatorsByTeam[3] || []),
                    });
                }
                if (strategyData?.subsByTeam) {
                    setSubsByTeam({
                        1: new Set(strategyData.subsByTeam[1] || []),
                        2: new Set(strategyData.subsByTeam[2] || []),
                        3: new Set(strategyData.subsByTeam[3] || []),
                    });
                }
                if (typeof strategyData?.leagueTeamNumber === 'number') {
                    setLeagueTeamNumber(strategyData.leagueTeamNumber as TeamNumber);
                }
                if (strategyData?.lockedLanesByTeam) {
                    setLockedLanesByTeam(strategyData.lockedLanesByTeam as LockedLanesByTeam);
                }
                if (strategyData?.lockedTeams) {
                    setLockedTeams(new Set(strategyData.lockedTeams as TeamNumber[]));
                }
                if (typeof strategyData?.mailHeader === 'string') {
                    // Normalize legacy values (e.g. 'custom', '23KK', 'EQ') back
                    // to a supported preset so the dropdown always has a match.
                    const saved = strategyData.mailHeader;
                    setMailHeader(MAIL_HEADER_PRESETS[saved] ? saved : 'ANG');
                }
                setActiveTab('builder');
                // Land shared-link viewers on the committed lane assignments view
                // whenever the plan has any distributed zones — they shouldn't have
                // to click through 'select'/'distribute' to see what was committed.
                const zonesByTeam = strategyData?.suggestedZonesByTeam as ZonesByTeam | undefined;
                const hasDistributed = !!zonesByTeam && [1, 2, 3].some(team => {
                    const z = zonesByTeam[team as TeamNumber];
                    if (!z) return false;
                    return ((z[1]?.length || 0) + (z[2]?.length || 0) + (z[3]?.length || 0)) > 0;
                });
                if (hasDistributed) setBuilderStep('distribute');
            } else {
                // Plan not found
                console.log('Plan not found:', planShareId);
                alert(t('builder.planNotFound'));
                router.push('/kingdom-planner');
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
        setIsLoading(false);
    };

    const saveData = async (updatedData: Partial<StrategyData>) => {
        // Only save if we have a valid plan loaded
        const currentShareId = shareIdRef.current;
        if (!currentShareId) {
            console.log('No plan loaded, skipping save');
            return;
        }

        const data: StrategyData = {
            players: updatedData.players ?? players,
            teams: updatedData.teams ?? teams,
            mapImage: updatedData.mapImage ?? mapImage,
            notes: updatedData.notes ?? notes,
            mapAssignments: updatedData.mapAssignments ?? mapAssignments ?? {},
            substitutes: updatedData.substitutes ?? substitutes,
            // Team Builder state
            builderAlliance: updatedData.builderAlliance ?? builderAlliance,
            teamCount: updatedData.teamCount ?? teamCount,
            builderStep: updatedData.builderStep ?? builderStep,
            confirmationsByTeam: updatedData.confirmationsByTeam ?? confirmationsByTeam,
            suggestedZonesByTeam: updatedData.suggestedZonesByTeam ?? suggestedZonesByTeam,
            selectedRallyLeadsByTeam: updatedData.selectedRallyLeadsByTeam ?? selectedRallyLeadsByTeam,
            selectedRallyLeadsSecondaryByTeam: updatedData.selectedRallyLeadsSecondaryByTeam ?? selectedRallyLeadsSecondaryByTeam,
            selectedTeleportFirstByTeam: updatedData.selectedTeleportFirstByTeam ?? {
                1: Array.from(selectedTeleportFirstByTeam[1] || []),
                2: Array.from(selectedTeleportFirstByTeam[2] || []),
                3: Array.from(selectedTeleportFirstByTeam[3] || []),
            },
            zoneSizesByTeam: updatedData.zoneSizesByTeam ?? zoneSizesByTeam,
            selectedGarrisonLeadsByTeam: updatedData.selectedGarrisonLeadsByTeam ?? selectedGarrisonLeadsByTeam,
            selectedArkCarriersByTeam: updatedData.selectedArkCarriersByTeam ?? selectedArkCarriersByTeam,
            coordinatorsByTeam: updatedData.coordinatorsByTeam ?? {
                1: Array.from(coordinatorsByTeam[1] || []),
                2: Array.from(coordinatorsByTeam[2] || []),
                3: Array.from(coordinatorsByTeam[3] || []),
            },
            subsByTeam: updatedData.subsByTeam ?? {
                1: Array.from(subsByTeam[1] || []),
                2: Array.from(subsByTeam[2] || []),
                3: Array.from(subsByTeam[3] || []),
            },
            leagueTeamNumber: updatedData.leagueTeamNumber ?? leagueTeamNumber ?? undefined,
            lockedLanesByTeam: updatedData.lockedLanesByTeam ?? lockedLanesByTeam,
            lockedTeams: updatedData.lockedTeams ?? Array.from(lockedTeams),
            mailHeader: updatedData.mailHeader ?? mailHeader,
        };

        try {
            console.log('saveData called', { currentShareId, dataKeys: Object.keys(data) });
            const { error } = await supabase
                .from('aoo_strategy')
                .update({ data, updated_at: new Date().toISOString() })
                .eq('share_id', currentShareId);
            if (error) throw error;
            console.log('Update successful');
        } catch (error) {
            console.error('Error saving data:', error);
        }
    };

    // Auto-save Team Builder state when it changes
    const builderSaveReady = useRef(false);
    useEffect(() => {
        if (isLoading || !shareIdRef.current) {
            builderSaveReady.current = false;
            return;
        }
        if (!builderSaveReady.current) {
            // First render after load — mark ready and do an initial save
            // to backfill builder state for plans saved before this feature
            builderSaveReady.current = true;
            saveData({});
            return;
        }
        saveData({});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, builderAlliance, teamCount, builderStep, confirmationsByTeam, suggestedZonesByTeam, selectedRallyLeadsByTeam, selectedRallyLeadsSecondaryByTeam, selectedTeleportFirstByTeam, zoneSizesByTeam, selectedGarrisonLeadsByTeam, selectedArkCarriersByTeam, coordinatorsByTeam, subsByTeam, leagueTeamNumber, lockedLanesByTeam, lockedTeams, mailHeader]);

    const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isEditor) return;
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const newMapImage = event.target?.result as string;
                setMapImage(newMapImage);
                saveData({ mapImage: newMapImage });
            };
            reader.readAsDataURL(file);
        }
    };

    const assignedNames = [...players, ...substitutes].map(p => p.name.toLowerCase());
    const filteredRoster = rosterNames.filter(name =>
        name.toLowerCase().includes(playerSearch.toLowerCase()) &&
        !assignedNames.includes(name.toLowerCase())
    );

    const addPlayer = (name: string) => {
        if (!isEditor || !name.trim()) return;
        if ([...players, ...substitutes].some(p => p.name.toLowerCase() === name.toLowerCase())) {
            alert(t('builder.playerAlreadyAssigned'));
            return;
        }
        const newPlayer: Player = { id: Date.now(), name: name.trim(), team: newPlayerTeam, tags: newPlayerTags, power: 0, assignments: { phase1: "", phase2: "", phase3: "", phase4: "" } };
        
        if (newPlayerTeam === 0) {
            // Add to substitutes
            const updatedSubs = [...substitutes, newPlayer];
            setSubstitutes(updatedSubs);
            saveData({ substitutes: updatedSubs });
        } else {
            // Add to players
            const updatedPlayers = [...players, newPlayer];
            setPlayers(updatedPlayers);
            saveData({ players: updatedPlayers });
        }
        
        setPlayerSearch('');
        setNewPlayerTags([]);
        setShowDropdown(false);
        setUseCustomName(false);
    };

    const removePlayer = (id: number) => {
        if (!isEditor) return;
        const updatedPlayers = players.filter(p => p.id !== id);
        setPlayers(updatedPlayers);
        saveData({ players: updatedPlayers });
    };

    const togglePlayerTag = (playerId: number, tag: string) => {
        if (!isEditor) return;
        const updatedPlayers = players.map(p => {
            if (p.id === playerId) {
                const newTags = p.tags.includes(tag) ? p.tags.filter(t => t !== tag) : [...p.tags, tag];
                return { ...p, tags: newTags };
            }
            return p;
        });
        setPlayers(updatedPlayers);
        saveData({ players: updatedPlayers });
    };

    const updateTeamDescription = (teamIndex: number, description: string) => {
        if (!isEditor) return;
        const updatedTeams = teams.map((t, i) => i === teamIndex ? { ...t, description } : t);
        setTeams(updatedTeams);
        saveData({ teams: updatedTeams });
    };

    const movePlayer = (playerId: number, newTeam: number) => {
        if (!isEditor) return;
        const updatedPlayers = players.map(p => p.id === playerId ? { ...p, team: newTeam } : p);
        setPlayers(updatedPlayers);
        saveData({ players: updatedPlayers });
    };

    const getTeamPlayers = (zoneNum: number) => {
        let zonePlayers = players.filter(p => p.team === zoneNum);
        // Filter by AoO team (T1, T2, T3) if a filter is selected
        if (rosterTeamFilter !== 'all') {
            zonePlayers = zonePlayers.filter(p => p.tags.includes(rosterTeamFilter));
        }
        return sortPlayers(zonePlayers);
    };

    const sortPlayers = (playerList: Player[]) => {
        return [...playerList].sort((a, b) => {
            // Rally Leaders always at top
            const aIsLeader = a.tags.includes('Rally Leader');
            const bIsLeader = b.tags.includes('Rally Leader');
            if (aIsLeader && !bIsLeader) return -1;
            if (!aIsLeader && bIsLeader) return 1;

            switch (rosterSort) {
                case 'power':
                    const powerA = a.power || powerByName[a.name] || 0;
                    const powerB = b.power || powerByName[b.name] || 0;
                    return powerB - powerA; // Descending
                case 'teleport':
                    // Teleport order: 1st > 2nd > none, then by power within group
                    const getTeleportOrder = (p: Player) => {
                        if (p.tags.includes('Teleport 1st')) return 0;
                        if (p.tags.includes('Teleport 2nd')) return 1;
                        return 2;
                    };
                    const orderA = getTeleportOrder(a);
                    const orderB = getTeleportOrder(b);
                    if (orderA !== orderB) return orderA - orderB;
                    // Same teleport group, sort by power
                    return (b.power || powerByName[b.name] || 0) - (a.power || powerByName[a.name] || 0);
                case 'name':
                    return a.name.localeCompare(b.name); // Alphabetical
                default:
                    return 0;
            }
        });
    };

    const handleMapSave = (newAssignments: MapAssignments) => {
        console.log('handleMapSave called', { newAssignments, strategyId, isEditor });
        setMapAssignments(newAssignments);
        saveData({ mapAssignments: newAssignments });
    };

    // Generate zone roster text for copying to clipboard (newline separated)
    const generateZoneText = useCallback((zoneNum: number) => {
        const formatPlayerTags = (p: Player) => {
            const tags: string[] = [];
            if (p.tags.includes('Rally Leader')) tags.push('Leader');
            if (p.tags.includes('Coordinator')) tags.push('Coordinator');
            if (p.tags.includes('Teleport 1st')) tags.push('1st Teleport');
            if (p.tags.includes('Teleport 2nd')) tags.push('2nd Teleport');
            return tags.length > 0 ? ` (${tags.join(', ')})` : '';
        };

        // Filter by team if filter is active
        let zonePlayers = players.filter(p => p.team === zoneNum);
        if (rosterTeamFilter !== 'all') {
            zonePlayers = zonePlayers.filter(p => p.tags.includes(rosterTeamFilter));
        }
        zonePlayers = sortPlayers(zonePlayers);

        const zoneName = teams[zoneNum - 1]?.name || `Zone ${zoneNum}`;
        const zoneDesc = teams[zoneNum - 1]?.description || '';
        const teamLabel = rosterTeamFilter !== 'all' ? ` (Team ${rosterTeamFilter.slice(1)})` : '';

        const header = `${zoneName} - ${zoneDesc}${teamLabel}`;
        const playerLines = zonePlayers.map(p => `${p.name}${formatPlayerTags(p)}`);

        return `${header}\n${playerLines.join('\n')}`;
    }, [players, teams, sortPlayers, rosterTeamFilter]);

    const copyZoneToClipboard = useCallback(async (zoneNum: number) => {
        const text = generateZoneText(zoneNum);
        try {
            await navigator.clipboard.writeText(text);
            setCopySuccess(zoneNum);
            setTimeout(() => setCopySuccess(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [generateZoneText]);

    // Generate full text summary from roster data (for strategy tab)
    const [rosterCopiedSummary, setRosterCopiedSummary] = useState(false);
    const [rosterCopiedMail, setRosterCopiedMail] = useState(false);

    const generateRosterSummary = useCallback(() => {
        const lines: string[] = [];
        lines.push('=========================================');
        lines.push('         AoO TEAM ASSIGNMENTS');
        lines.push('=========================================');
        lines.push('');

        // Detect which AoO teams exist (T1, T2, T3 tags)
        const aooTeams = new Set<string>();
        players.forEach(p => {
            p.tags.forEach(tag => { if (tag.match(/^T[123]$/)) aooTeams.add(tag); });
        });
        const teamList = [...aooTeams].sort();

        for (const teamTag of teamList.length > 0 ? teamList : ['']) {
            if (teamTag) {
                lines.push(`>> ${teamTag}`);
                lines.push('-----------------------------------------');
            }

            for (const zoneNum of [1, 2, 3]) {
                let zonePlayers = players.filter(p => p.team === zoneNum);
                if (teamTag) zonePlayers = zonePlayers.filter(p => p.tags.includes(teamTag));
                zonePlayers = sortPlayers(zonePlayers);
                if (zonePlayers.length === 0) continue;

                const zoneName = teams[zoneNum - 1]?.name || `Zone ${zoneNum}`;
                lines.push(`\n[${zoneName}] - ${zonePlayers.length} players`);

                for (const p of zonePlayers) {
                    const badges: string[] = [];
                    if (p.tags.includes('Rally Leader')) badges.push('Rally Lead');
                    if (p.tags.includes('Garrison')) badges.push('Garrison Lead');
                    if (p.tags.includes('Ark Carrier')) badges.push('Ark Carrier');
                    if (p.tags.includes('Coordinator')) badges.push('Coord');
                    if (p.tags.includes('Teleport 1st')) badges.push('TP First');
                    const badgeStr = badges.length > 0 ? ` [${badges.join(', ')}]` : '';
                    lines.push(`  - ${p.name} (${formatPower(p.power || powerByName[p.name] || 0)})${badgeStr}`);
                }
            }

            // Subs for this team
            let teamSubs = substitutes;
            if (teamTag) teamSubs = teamSubs.filter(s => s.tags.includes(teamTag));
            if (teamSubs.length > 0) {
                lines.push(`\n[Substitutes] - ${teamSubs.length}`);
                for (const p of teamSubs) {
                    lines.push(`  - ${p.name} (${formatPower(p.power || powerByName[p.name] || 0)})`);
                }
            }
            lines.push('');
        }

        lines.push('=========================================');
        return lines.join('\n');
    }, [players, substitutes, teams, sortPlayers, powerByName]);

    const generateRosterMail = useCallback((teamTag: string) => {
        const HEADER = `<size=30px><color=#4d0000>A</color><color=#660000>N</color><color=#800000>G</color><color=#990000>M</color><color=#b30000>A</color><color=#cc0000>R</color> <color=#4d0000>N</color><color=#660000>A</color><color=#800000>Z</color><color=#990000>G</color><color=#b30000>U</color><color=#cc0000>L</color> <color=#e60000>G</color><color=#ff0000>U</color><color=#ff0000>A</color><color=#cc0000>R</color><color=#990000>D</color><color=#800000>S</color></size>`;
        const DIVIDER = '►═════════❂❂❂═════════◄';
        const SECTION = '━━━━━━━━━━━━━━━━━━━━';

        const teamNum = teamTag.replace('T', '');
        const lines: string[] = [];
        lines.push(HEADER);
        lines.push(DIVIDER);
        lines.push('');
        lines.push(`<b><color=#ff3333>AoO Team ${teamNum}</color></b>`);
        lines.push('');
        lines.push('Find your name, know your lane.');
        lines.push('');
        lines.push('<b>!! NON-NEGOTIABLE RULES !!</b>');
        lines.push('- <b>Do NOT</b> teleport immediately unless you have been assigned.');
        lines.push('- The obelisk is <b>ALWAYS</b> fully garrisoned before you advance.');
        lines.push('- We attack with rallies.');
        lines.push('- Stay in your assigned lane.');
        lines.push('- <b>Do NOT</b> move down the field until your building is secured.');
        lines.push('- <b>Do NOT</b> lose an obelisk or building from poor garrisoning.');

        const zoneConfig = [
            { num: 1, label: 'TOP LANE', color: '#3399ff' },
            { num: 2, label: 'MID LANE — ARK', color: '#cc6600' },
            { num: 3, label: 'BOTTOM LANE', color: '#9933cc' },
        ];

        for (const zone of zoneConfig) {
            let zonePlayers = players.filter(p => p.team === zone.num && p.tags.includes(teamTag));
            zonePlayers = sortPlayers(zonePlayers);
            if (zonePlayers.length === 0) continue;

            const isMid = zone.num === 2;
            const rally = zonePlayers.find(p => p.tags.includes('Rally Leader'))?.name || '';
            const garrison = zonePlayers.find(p => p.tags.includes('Garrison'))?.name || '';
            const carrier = isMid ? zonePlayers.find(p => p.tags.includes('Ark Carrier'))?.name || '' : '';
            const tpPlayers = zonePlayers.filter(p => p.tags.includes('Teleport 1st'));
            const namedLeaders = new Set([rally, garrison, carrier].filter(Boolean));
            const regularPlayers = zonePlayers.filter(p => !namedLeaders.has(p.name));

            const leaderNames = isMid
                ? (carrier || 'TBD')
                : [rally, garrison].filter(Boolean).join(' & ') || 'TBD';

            lines.push('');
            lines.push(SECTION);
            lines.push(`<b><color=${zone.color}>${zone.label} (${leaderNames})</color></b>`);

            if (isMid) {
                if (carrier) lines.push(`<b>Ark Carrier:</b> ${carrier}`);
            } else {
                if (rally) lines.push(`<b>Rally Lead:</b> ${rally}`);
                if (garrison) lines.push(`<b>Garrison Lead:</b> ${garrison}`);
            }

            if (tpPlayers.length > 0) {
                lines.push(`<b>1st Teleport:</b> ${tpPlayers.map(p => p.name).join(', ')}`);
            }

            if (regularPlayers.length > 0) {
                lines.push(`<b>Team:</b> ${regularPlayers.map(p => p.name).join(', ')}`);
            }
        }

        // Subs
        const subs = substitutes.filter(s => s.tags.includes(teamTag));
        if (subs.length > 0) {
            lines.push('');
            lines.push(SECTION);
            lines.push(`<b>Subs:</b> ${subs.map(p => p.name).join(', ')}`);
        }

        lines.push('');
        lines.push(DIVIDER);

        return lines.join('\n');
    }, [players, substitutes, sortPlayers]);

    const copyRosterSummary = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(generateRosterSummary());
            setRosterCopiedSummary(true);
            setTimeout(() => setRosterCopiedSummary(false), 2000);
        } catch { /* ignore */ }
    }, [generateRosterSummary]);

    const copyRosterMail = useCallback(async (teamTag: string) => {
        const mail = generateRosterMail(teamTag);
        localStorage.setItem('rok-mail-draft', mail);
        window.open('/rok-mail', '_blank');
        setRosterCopiedMail(true);
        setTimeout(() => setRosterCopiedMail(false), 2000);
    }, [generateRosterMail]);

    const exportRosterImage = useCallback(() => {
        const canvas = rosterCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Canvas settings
        const padding = 40;
        const zoneWidth = 400;
        const playerHeight = 28;
        const headerHeight = 50;
        const zoneGap = 30;

        // Calculate dimensions - filter by team if filter is active
        const zonePlayers = [1, 2, 3].map(z => {
            let zPlayers = players.filter(p => p.team === z);
            if (rosterTeamFilter !== 'all') {
                zPlayers = zPlayers.filter(p => p.tags.includes(rosterTeamFilter));
            }
            return sortPlayers(zPlayers);
        });

        // Calculate subs for this team filter
        const exportSubs = rosterTeamFilter !== 'all'
            ? substitutes.filter(s => s.tags.includes(rosterTeamFilter))
            : substitutes;
        const subsHeight = exportSubs.length > 0 ? 60 + Math.ceil(exportSubs.length / 6) * 24 : 0;
        const maxPlayers = Math.max(...zonePlayers.map(z => z.length));
        const canvasWidth = (zoneWidth * 3) + (zoneGap * 2) + (padding * 2);
        const canvasHeight = headerHeight + (maxPlayers * playerHeight) + (padding * 2) + 60 + subsHeight;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Background
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Title - include team if filtered
        ctx.fillStyle = '#fafafa';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const teamLabel = rosterTeamFilter !== 'all' ? ` - Team ${rosterTeamFilter.slice(1)}` : '';
        const titleText = eventMode === 'training'
            ? `Ark of Osiris - Training Match${teamLabel}`
            : `Ark of Osiris - Zone Assignments${teamLabel}`;
        ctx.fillText(titleText, canvasWidth / 2, padding + 10);

        // Zone colors matching in-game (Z1=blue, Z2=orange, Z3=purple)
        const zoneHexColors: Record<number, string> = {
            1: '#2563eb', // blue-600
            2: '#ea580c', // orange-600
            3: '#9333ea', // purple-600
        };

        // Draw each zone
        [1, 2, 3].forEach((zoneNum, idx) => {
            const x = padding + (idx * (zoneWidth + zoneGap));
            const y = padding + headerHeight;
            const zonePlayersList = zonePlayers[idx];
            const zoneName = teams[zoneNum - 1]?.name || `Zone ${zoneNum}`;
            const zoneDesc = teams[zoneNum - 1]?.description || '';

            // Zone header with colored left border
            ctx.fillStyle = '#27272a';
            ctx.fillRect(x, y, zoneWidth, 36);
            // Left color stripe
            ctx.fillStyle = zoneHexColors[zoneNum];
            ctx.fillRect(x, y, 4, 36);
            ctx.fillStyle = zoneHexColors[zoneNum];
            ctx.font = 'bold 14px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${zoneName} - ${zoneDesc}`, x + 12, y + 24);
            ctx.fillStyle = '#a1a1aa';
            ctx.font = '12px system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${zonePlayersList.length} players`, x + zoneWidth - 12, y + 24);

            // Players
            zonePlayersList.forEach((p, pIdx) => {
                const py = y + 40 + (pIdx * playerHeight);

                // Alternating row background
                ctx.fillStyle = pIdx % 2 === 0 ? '#1f1f23' : '#18181b';
                ctx.fillRect(x, py, zoneWidth, playerHeight);

                // Player name
                ctx.fillStyle = '#fafafa';
                ctx.font = '13px system-ui, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(p.name, x + 12, py + 18);

                // Tags - muted colors to not compete with zone colors
                let tagX = x + 140;
                const tagColors: Record<string, string> = {
                    'Rally Leader': '#44403c',  // stone-700
                    'Coordinator': '#57534e',   // stone-600
                    'Teleport 1st': '#047857',  // emerald-700
                    'Teleport 2nd': '#059669',  // emerald-600
                };

                p.tags.forEach(tag => {
                    if (tagColors[tag]) {
                        const shortTag = tag === 'Rally Leader' ? 'Leader' :
                                        tag === 'Coordinator' ? 'Coord' :
                                        tag === 'Teleport 1st' ? '1st' :
                                        tag === 'Teleport 2nd' ? '2nd' : tag;
                        ctx.fillStyle = tagColors[tag];
                        const tagWidth = ctx.measureText(shortTag).width + 12;
                        ctx.beginPath();
                        ctx.roundRect(tagX, py + 4, tagWidth, 18, 4);
                        ctx.fill();
                        ctx.fillStyle = '#fff';
                        ctx.font = '11px system-ui, sans-serif';
                        ctx.fillText(shortTag, tagX + 6, py + 16);
                        tagX += tagWidth + 4;
                    }
                });

                // Power
                const power = p.power || powerByName[p.name] || 0;
                if (power > 0) {
                    ctx.fillStyle = '#71717a';
                    ctx.font = '11px system-ui, sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(formatPower(power), x + zoneWidth - 12, py + 18);
                }
            });
        });

        // Substitutes section (already filtered as exportSubs)
        if (exportSubs.length > 0) {
            const subsY = padding + headerHeight + (maxPlayers * playerHeight) + 60;

            // Subs header
            ctx.fillStyle = '#a1a1aa';
            ctx.font = 'bold 12px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`SUBSTITUTES (${exportSubs.length})`, padding, subsY);

            // Draw subs in a grid (6 per row)
            const subsPerRow = 6;
            const subWidth = (canvasWidth - padding * 2) / subsPerRow;
            exportSubs.forEach((sub, idx) => {
                const row = Math.floor(idx / subsPerRow);
                const col = idx % subsPerRow;
                const sx = padding + (col * subWidth);
                const sy = subsY + 16 + (row * 24);

                ctx.fillStyle = '#71717a';
                ctx.font = '12px system-ui, sans-serif';
                ctx.textAlign = 'left';
                const power = sub.power || powerByName[sub.name] || 0;
                const powerStr = power > 0 ? ` (${formatPower(power)})` : '';
                ctx.fillText(`${sub.name}${powerStr}`, sx, sy);
            });
        }

        // Download with team in filename if filtered
        const link = document.createElement('a');
        const teamSuffix = rosterTeamFilter !== 'all' ? `-${rosterTeamFilter.toLowerCase()}` : '';
        link.download = eventMode === 'training' ? `aoo-training-roster${teamSuffix}.png` : `aoo-roster${teamSuffix}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }, [players, teams, substitutes, sortPlayers, powerByName, eventMode, rosterTeamFilter]);

    // Theme using CSS variables to match the rest of the app
    const theme = {
        bg: 'bg-[var(--background)]',
        card: 'bg-[var(--background-card)] border-[var(--border)] backdrop-blur-xl',
        text: 'text-[var(--foreground)]',
        textMuted: 'text-[var(--text-secondary)]',
        textAccent: 'text-[#4318ff]',
        border: 'border-[var(--border)]',
        input: 'bg-[var(--background-card)] border-[var(--border)] text-[var(--foreground)] placeholder-[var(--text-muted)]',
        button: 'bg-[var(--background-card)] hover:opacity-80 text-[var(--foreground)] border border-[var(--border)]',
        buttonPrimary: 'bg-gradient-to-r from-[#4318ff] to-[#9f7aea] hover:opacity-90 text-white',
        tag: 'bg-[var(--background-secondary)] text-[var(--text-secondary)]',
        tagActive: 'bg-[#4318ff] text-white',
        dropdown: 'bg-[var(--background-card)] border-[var(--border)]',
        dropdownHover: 'hover:bg-[var(--background-hover)]',
        tabActive: 'text-[#4318ff] border-[#4318ff] bg-[#4318ff]/5',
        tabInactive: 'text-[var(--text-secondary)] border-transparent hover:text-[var(--foreground)] hover:bg-[var(--background-hover)]',
    };

    if (isLoading) {
        return (
                <div className={`min-h-screen ${theme.bg} ${theme.text} flex items-center justify-center`}>
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border border-[#4318ff] border-t-transparent rounded-full animate-spin"></div>
                        <span className={theme.textMuted}>{t('header.loading')}</span>
                    </div>
                </div>
        );
    }

    // Landing page - no plan selected
    if (!shareId) {
        return (
                <div className={`min-h-screen ${theme.bg} ${theme.text}`}>
                    <div className="max-w-2xl mx-auto px-6 py-20">
                        {/* Header */}
                        <div className="text-center mb-12">
                            <div className="inline-flex p-4 rounded-2xl bg-emerald-500/15 mb-6">
                                <Swords className="w-12 h-12 text-emerald-500" />
                            </div>
                            <h1 className="text-3xl font-bold mb-3">{t('landing.heading')}</h1>
                            <p className={`text-lg ${theme.textMuted}`}>
                                {t('landing.subtitle')}
                            </p>
                        </div>

                        {/* Create New Plan */}
                        <div className={`${theme.card} border rounded-xl p-8 text-center mb-8`}>
                            <h2 className="text-xl font-semibold mb-3">{t('landing.createTitle')}</h2>
                            <p className={`${theme.textMuted} mb-6`}>
                                {t('landing.createDescription')}
                            </p>
                            <button
                                onClick={createNewPlan}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
                            >
                                <Plus size={20} />
                                {t('landing.createButton')}
                            </button>
                        </div>

                        {/* How it works */}
                        <div className={`${theme.card} border rounded-xl p-6`}>
                            <h3 className={`text-sm font-semibold uppercase tracking-wider ${theme.textMuted} mb-4`}>
                                {t('landing.howItWorks')}
                            </h3>
                            <div className="space-y-4 text-sm">
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-semibold text-xs">1</span>
                                    <div>
                                        {t.rich('landing.step1', { strong: (chunks) => <strong>{chunks}</strong> })}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-semibold text-xs">2</span>
                                    <div>
                                        {t.rich('landing.step2', { strong: (chunks) => <strong>{chunks}</strong> })}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-semibold text-xs">3</span>
                                    <div>
                                        {t.rich('landing.step3', { strong: (chunks) => <strong>{chunks}</strong> })}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-semibold text-xs">4</span>
                                    <div>
                                        {t.rich('landing.step4', { strong: (chunks) => <strong>{chunks}</strong> })}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-semibold text-xs">5</span>
                                    <div>
                                        {t.rich('landing.step5', { strong: (chunks) => <strong>{chunks}</strong> })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
        );
    }

    return (
        <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors duration-200 overflow-x-hidden`}>
            {/* Header */}
            <header className="bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)] sticky top-14 lg:top-0 z-30">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="p-2.5 rounded-lg bg-emerald-500/15 flex-shrink-0">
                                <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">{t('header.title')}</h1>
                                <p className={`text-xs sm:text-sm ${theme.textMuted} hidden sm:block`}>
                                    {t('header.subtitle')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
                            {/* Officer login toggle */}
                            {!isOfficer ? (
                                <button
                                    onClick={() => setShowOfficerPrompt(true)}
                                    className={`p-2 rounded-lg ${theme.button} hover:bg-[var(--background-hover)] transition-colors`}
                                    title={t('header.officerLogin')}
                                >
                                    <Lock size={16} />
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsOfficer(false)}
                                    className="p-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                                    title={t('header.officerLogout')}
                                >
                                    <Unlock size={16} />
                                </button>
                            )}
                            {shareId && (
                                <button
                                    onClick={async () => {
                                        const url = `${window.location.origin}/kingdom-planner?plan=${shareId}`;
                                        await navigator.clipboard.writeText(url);
                                        setLinkCopied(true);
                                        setTimeout(() => setLinkCopied(false), 2000);
                                    }}
                                    className={`p-2 sm:px-4 sm:py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                                        linkCopied ? 'bg-green-600 text-white' : theme.button
                                    }`}
                                    title={t('header.copyShareableLink')}
                                >
                                    {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                                    <span className="hidden sm:inline">{linkCopied ? t('header.copied') : t('header.copyLink')}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-2 mt-4 border-b border-[var(--border)] pb-0 overflow-x-auto hide-scrollbar">
                        <button
                            onClick={() => setActiveTab('registration')}
                            className={`px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 border-b-2 -mb-[1px] ${
                                activeTab === 'registration'
                                    ? 'text-[#4318ff] border-[#4318ff] bg-[#4318ff]/5'
                                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--foreground)] hover:bg-[var(--background-hover)]'
                            }`}
                        >
                            📋 {t('tabs.registration')}
                        </button>
                        <button
                            onClick={() => setActiveTab('builder')}
                            className={`px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 border-b-2 -mb-[1px] ${
                                activeTab === 'builder'
                                    ? 'text-[#4318ff] border-[#4318ff] bg-[#4318ff]/5'
                                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--foreground)] hover:bg-[var(--background-hover)]'
                            }`}
                        >
                            🛠️ {t('tabs.teamBuilder')}
                        </button>
                    </div>
                </div>
            </header>

            {/* Collaborative Banner */}
            {shareId && (
                <div className="bg-emerald-500/10 border-b border-emerald-500/30">
                    <div className="max-w-6xl mx-auto px-4 md:px-6 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <LinkIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                <div>
                                    <p className={`text-xs ${theme.textMuted}`}>
                                        <strong className="text-emerald-400">{t('collaborative.label')}</strong> - {t('collaborative.description')}
                                    </p>
                                </div>
                            </div>
                            <code className={`text-xs px-2 py-1 rounded bg-[var(--background-secondary)] ${theme.textMuted} hidden sm:block`}>
                                ?plan={shareId}
                            </code>
                        </div>
                    </div>
                </div>
            )}

            {/* Officer Password Modal */}
            {showOfficerPrompt && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[var(--background-card)] border border-[var(--border)] shadow-lg p-6 rounded-xl max-w-sm w-full mx-4">
                        <h3 className="text-lg font-semibold mb-2">{t('officer.title')}</h3>
                        <p className={`text-sm ${theme.textMuted} mb-4`}>{t('officer.description')}</p>
                        <input
                            type="password"
                            value={officerPasswordInput}
                            onChange={(e) => setOfficerPasswordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleOfficerLogin()}
                            placeholder={t('officer.placeholder')}
                            className={`w-full px-4 py-2 rounded-lg border ${theme.input} mb-4`}
                            autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => { setShowOfficerPrompt(false); setOfficerPasswordInput(''); }}
                                className={`px-4 py-2 rounded-lg ${theme.button}`}
                            >
                                {t('officer.cancel')}
                            </button>
                            <button
                                onClick={handleOfficerLogin}
                                className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                            >
                                {t('officer.login')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Content */}
            {activeTab === 'registration' && (
                <RegistrationTab
                    theme={theme}
                    powerByGovId={powerByGovId}
                    killsByGovId={killsByGovId}
                    scanLabel={scanLabel}
                    isSignedIn={!!user}
                    onApplyToBuilder={(registrations) => {
                        // Use sheet names directly as confirmation keys (1 row = 1 entry).
                        // Gov ID is only used to look up power/kills from roster, NOT for name resolution,
                        // because incorrect gov IDs in the sheet can merge different people.
                        const rosterByGovId = new Map<number, typeof roster[0]>();
                        const rosterNameSet = new Set<string>();
                        for (const m of roster) {
                            rosterNameSet.add(m.name);
                            if (m.governor_id) rosterByGovId.set(m.governor_id, m);
                        }

                        // Auto-detect: do we have league signups, and are there normal teams
                        // signed up alongside? League always lives in the LAST slot so the
                        // visible team count stays contiguous (no empty slots in between).
                        const hasLeague = registrations.some(r => r.league && r.team1);
                        const hasNormalTeam3 = registrations.some(r => !r.league && r.team3);
                        const hasNormalTeam2 = registrations.some(r => !r.league && r.team2);
                        const hasNormalTeam1 = registrations.some(r => !r.league && r.team1);
                        const normalTeamCount = hasNormalTeam3 ? 3 : hasNormalTeam2 ? 2 : hasNormalTeam1 ? 1 : 0;
                        const detectedLeagueSlot: TeamNumber | null = hasLeague
                            ? (Math.max(1, normalTeamCount + 1) as TeamNumber)
                            : null;

                        const newConfirmations: ConfirmationsByTeam = { 1: {}, 2: {}, 3: {} };
                        const newLockedLanes: LockedLanesByTeam = { 1: {}, 2: {}, 3: {} };
                        const newRallyLeads: RallyLeadsByTeam = { 1: {}, 2: {}, 3: {} };
                        // Secondary rally leads — only populated when the sheet marks
                        // more than one rally leader for the same lane. Otherwise stays
                        // empty so the mail shows a single rally lead per lane.
                        const newRallyLeads2: RallyLeadsByTeam = { 1: {}, 2: {}, 3: {} };
                        const newGarrisonLeads: GarrisonLeadsByTeam = { 1: {}, 2: {}, 3: {} };
                        const newArkCarriers: ArkCarriersByTeam = { 1: '', 2: '', 3: '' };
                        const newCoordinators: Record<TeamNumber, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set() };
                        const newSubs: Record<TeamNumber, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set() };
                        const pendingToAdd: PendingMember[] = [];
                        const pendingNames = new Set<string>();

                        // First pass: confirmations + collect pending additions.
                        // Bucket registrations per-team so role assignments below can split
                        // rally/garrison leaders across lanes 1 and 3 in sheet order.
                        //
                        // When a row matches the alliance roster by Gov ID we override the
                        // name with the roster's version. Players often type a simplified
                        // name in the sign-up sheet, but the roster has the in-game name
                        // (which carries all the special characters like ✗, ơ, ⁿ, Đ, etc.).
                        // Using the roster name means the generated mail matches what
                        // people actually see in-game, so they can find themselves.
                        const teamRegs: Record<TeamNumber, typeof registrations> = { 1: [], 2: [], 3: [] };
                        for (const r of registrations) {
                            const rosterMember = r.govId ? rosterByGovId.get(r.govId) : undefined;
                            const name = rosterMember?.name ?? r.name;
                            // Carry the canonical name into the bucketed copy so the
                            // second pass (rally/garrison lane locks) keys by the same
                            // string the confirmations + zones use.
                            const canonical = name === r.name ? r : { ...r, name };

                            if (r.league) {
                                // League players land in the designated league slot. They're
                                // confirmed for the tournament — "Team 1" on the league tab
                                // means "in this week's league pool", not Team 1 of a normal
                                // weekend.
                                if (detectedLeagueSlot && r.team1) {
                                    newConfirmations[detectedLeagueSlot][name] = 'confirmed';
                                    teamRegs[detectedLeagueSlot].push(canonical);
                                    if (r.coordinator) newCoordinators[detectedLeagueSlot].add(name);
                                    if (r.sub) newSubs[detectedLeagueSlot].add(name);
                                }
                            } else {
                                if (r.team1) newConfirmations[1][name] = 'confirmed';
                                if (r.team2) newConfirmations[2][name] = 'confirmed';
                                if (r.team3) newConfirmations[3][name] = 'confirmed';
                                if (!r.team1 && !r.team2 && !r.team3) newConfirmations[1][name] = 'maybe';

                                const teamsForPlayer: TeamNumber[] = [];
                                if (r.team1) teamsForPlayer.push(1);
                                if (r.team2) teamsForPlayer.push(2);
                                if (r.team3) teamsForPlayer.push(3);
                                if (teamsForPlayer.length === 0) teamsForPlayer.push(1);
                                for (const teamNum of teamsForPlayer) {
                                    teamRegs[teamNum].push(canonical);
                                    if (r.coordinator) newCoordinators[teamNum].add(name);
                                    if (r.sub) newSubs[teamNum].add(name);
                                }
                            }

                            // If this exact name isn't in the roster, add as pending
                            if (!rosterNameSet.has(name) && !pendingNames.has(name)) {
                                pendingNames.add(name);
                                pendingToAdd.push({
                                    name,
                                    power: rosterMember?.power || r.power,
                                    kills: rosterMember?.kills || 0,
                                    governorId: r.govId ? String(r.govId) : undefined,
                                    isPending: true as const,
                                });
                            }
                        }

                        // Second pass: per-team role lane assignment.
                        // Priority within a row: Sub > Mid > Rally > Garrison.
                        // Rally and Garrison leaders split across lanes 1 (top) and 3 (bottom)
                        // in sheet order — first marked → top, second → bottom — unless the
                        // row has an explicit Lane value, which always wins.
                        for (const team of [1, 2, 3] as TeamNumber[]) {
                            const regs = teamRegs[team];
                            const subSet = newSubs[team];

                            // Subs → lock to zone 0 (substitutes). Use the team-level sub set
                            // (sourced from r.sub but mutable per weekend) so officer overrides
                            // on the league team take effect at distribution time.
                            for (const r of regs) {
                                if (subSet.has(r.name)) newLockedLanes[team][r.name] = 0;
                            }

                            // Mid → lane 2; first by sheet order becomes ark carrier
                            const midRegs = regs.filter(r => r.mid && !subSet.has(r.name));
                            for (const r of midRegs) {
                                newLockedLanes[team][r.name] = 2;
                            }
                            if (midRegs.length > 0 && !newArkCarriers[team]) {
                                newArkCarriers[team] = midRegs[0].name;
                            }

                            // Rally leaders → respect the sheet's stated lane.
                            // Priority: 1) rallyLeaderLane from the OL "Rally Leader: t/b"
                            // column, 2) the row's generic Lane column, 3) round-robin
                            // top/bottom in sheet order (legacy weekend sheets that have
                            // a boolean rally leader column with no lane info).
                            //
                            // When the sheet marks two rally leaders for the same lane,
                            // the first becomes primary and the second becomes secondary.
                            // Anything beyond two is locked to the lane but not assigned
                            // a labelled slot — officers can promote them manually.
                            const rallyRegs = regs.filter(r => r.rallyLeader && !subSet.has(r.name) && !r.mid);
                            const rallyLanes: number[] = [1, 3];
                            let rallyIdx = 0;
                            for (const r of rallyRegs) {
                                const explicitLeaderLane =
                                    r.rallyLeaderLane === 't' ? 1 :
                                    r.rallyLeaderLane === 'b' ? 3 : null;
                                const lane = explicitLeaderLane
                                    ?? (r.lane === 1 || r.lane === 3 ? r.lane : rallyLanes[rallyIdx++ % 2]);
                                newLockedLanes[team][r.name] = lane;
                                if (!newRallyLeads[team][lane]) {
                                    newRallyLeads[team][lane] = r.name;
                                } else if (!newRallyLeads2[team][lane]) {
                                    newRallyLeads2[team][lane] = r.name;
                                }
                            }

                            // Garrison leaders → same priority chain as rally.
                            const garrisonRegs = regs.filter(r => r.garrisonLeader && !subSet.has(r.name) && !r.mid && !r.rallyLeader);
                            const garrisonLanes: number[] = [1, 3];
                            let garrisonIdx = 0;
                            for (const r of garrisonRegs) {
                                const explicitLeaderLane =
                                    r.garrisonLeaderLane === 't' ? 1 :
                                    r.garrisonLeaderLane === 'b' ? 3 : null;
                                const lane = explicitLeaderLane
                                    ?? (r.lane === 1 || r.lane === 3 ? r.lane : garrisonLanes[garrisonIdx++ % 2]);
                                newLockedLanes[team][r.name] = lane;
                                if (!newGarrisonLeads[team][lane]) newGarrisonLeads[team][lane] = r.name;
                            }

                            // Generic Lane column lock for anyone not already locked by a role
                            for (const r of regs) {
                                if (newLockedLanes[team][r.name] !== undefined) continue;
                                if (r.lane === 1 || r.lane === 2 || r.lane === 3) {
                                    newLockedLanes[team][r.name] = r.lane;
                                }
                            }
                        }

                        setConfirmationsByTeam(newConfirmations);
                        setLockedLanesByTeam(newLockedLanes);
                        setSelectedRallyLeadsByTeam(newRallyLeads);
                        // Reset secondary so a fresh import doesn't leave a stale auto-pick
                        // from a previous distribute call. Only the sheet seeds this now.
                        setSelectedRallyLeadsSecondaryByTeam(newRallyLeads2);
                        setSelectedGarrisonLeadsByTeam(newGarrisonLeads);
                        setSelectedArkCarriersByTeam(newArkCarriers);
                        setCoordinatorsByTeam(newCoordinators);
                        setSubsByTeam(newSubs);
                        setLeagueTeamNumber(detectedLeagueSlot);

                        // Auto-detect team count. League always sits in the slot after the
                        // normal teams (or slot 1 if there are no normals), so the visible
                        // team count is the highest slot in use. Only bump up — never shrink
                        // a count the officer may have manually raised.
                        const computedCount = Math.max(
                            normalTeamCount,
                            detectedLeagueSlot ?? 0,
                            1,
                        ) as TeamNumber;
                        if (computedCount > teamCount) setTeamCount(computedCount);

                        // Add any registrants not in roster as pending additions
                        if (pendingToAdd.length > 0) {
                            setPendingAdditions(prev => {
                                const existingNames = new Set(prev.map(p => p.name));
                                const toAdd = pendingToAdd.filter(p => !existingNames.has(p.name));
                                return [...prev, ...toAdd];
                            });
                        }

                        // Switch to builder tab and auto-distribute
                        setBuilderAlliance('all');
                        setActiveTab('builder');
                        // Trigger auto-distribute (the TeamBuilderTab will handle it)
                        setAutoDistributeToken(t => t + 1);
                    }}
                    onSkipToBuilder={() => {
                        setBuilderStep('select');
                        setActiveTab('builder');
                    }}
                    isOfficer={isOfficer}
                />
            )}

            {activeTab === 'map' && (
                <AOOInteractiveMap
                    initialAssignments={mapAssignments}
                    onSave={handleMapSave}
                    isEditor={isEditor}
                    players={players}
                />
            )}

            {activeTab === 'builder' && (
                <TeamBuilderTab
                    roster={roster}
                    powerByName={powerByName}
                    killsByName={killsByName}
                    allianceByName={allianceByName}
                    alliances={dbAlliances.length > 0 ? dbAlliances : [...ALLIANCES]}
                    builderAlliance={builderAlliance}
                    setBuilderAlliance={setBuilderAlliance}
                    teamCount={teamCount}
                    setTeamCount={setTeamCount}
                    activeTeam={activeTeam}
                    setActiveTeam={setActiveTeam}
                    confirmationsByTeam={confirmationsByTeam}
                    setConfirmationsByTeam={setConfirmationsByTeam}
                    builderStep={builderStep}
                    setBuilderStep={setBuilderStep}
                    suggestedZonesByTeam={suggestedZonesByTeam}
                    setSuggestedZonesByTeam={setSuggestedZonesByTeam}
                    selectedRallyLeadsByTeam={selectedRallyLeadsByTeam}
                    setSelectedRallyLeadsByTeam={setSelectedRallyLeadsByTeam}
                    selectedRallyLeadsSecondaryByTeam={selectedRallyLeadsSecondaryByTeam}
                    setSelectedRallyLeadsSecondaryByTeam={setSelectedRallyLeadsSecondaryByTeam}
                    selectedGarrisonLeadsByTeam={selectedGarrisonLeadsByTeam}
                    setSelectedGarrisonLeadsByTeam={setSelectedGarrisonLeadsByTeam}
                    selectedArkCarriersByTeam={selectedArkCarriersByTeam}
                    setSelectedArkCarriersByTeam={setSelectedArkCarriersByTeam}
                    selectedTeleportFirstByTeam={selectedTeleportFirstByTeam}
                    setSelectedTeleportFirstByTeam={setSelectedTeleportFirstByTeam}
                    coordinatorsByTeam={coordinatorsByTeam}
                    setCoordinatorsByTeam={setCoordinatorsByTeam}
                    subsByTeam={subsByTeam}
                    setSubsByTeam={setSubsByTeam}
                    leagueTeamNumber={leagueTeamNumber}
                    zoneSizesByTeam={zoneSizesByTeam}
                    setZoneSizesByTeam={setZoneSizesByTeam}
                    lockedLanesByTeam={lockedLanesByTeam}
                    setLockedLanesByTeam={setLockedLanesByTeam}
                    lockedTeams={lockedTeams}
                    setLockedTeams={setLockedTeams}
                    mailHeader={mailHeader}
                    setMailHeader={setMailHeader}
                    pendingAdditions={pendingAdditions}
                    setPendingAdditions={setPendingAdditions}
                    onSavePendingAdditions={handleSavePendingAdditions}
                    onConfirm={() => saveData({})}
                    theme={theme}
                    formatPower={formatPower}
                    user={user}
                    scanLabel={scanLabel}
                    autoDistributeToken={autoDistributeToken}
                />
            )}

            {/* Strategy/Roster tab removed — the team builder is the canonical view.
             *  Kept the supporting state (`players`, `substitutes`, helpers) so loaded
             *  plans don't break, but no UI references them anymore. */}
            {false && (
                <div className="max-w-7xl mx-auto p-4 md:p-6">
                    <section className={`${theme.card} border border-[#4318ff] rounded-xl mb-6 p-4`}>
                        <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 text-[#9f7aea]`}>📋 {ts('overview')}</h2>

                        {/* Key Rules */}
                        <div className={`grid md:grid-cols-2 gap-4 mb-4`}>
                            <div className="p-3 rounded-lg bg-[#4318ff]/10 border border-[#4318ff]/20">
                                <h3 className="font-bold text-[#9f7aea] text-sm mb-2">📌 {ts('important')}</h3>
                                <ul className={`text-xs space-y-1 ${theme.text}`}>
                                    <li>• {ts('rules.laneAssignment')}</li>
                                    <li>• {ts('rules.rushObelisk')}</li>
                                    <li>• {ts('rules.rallyTpFirst')}</li>
                                    <li>• {ts('rules.moveAfterGarrison')}</li>
                                    <li>• {ts('rules.rallyOccupied')}</li>
                                    <li>• {ts('rules.workAsUnit')}</li>
                                </ul>
                            </div>
                            <div className="p-3 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]">
                                <h3 className={`font-bold ${theme.textMuted} text-sm mb-2`}>🎯 {ts('troopDeployment')}</h3>
                                <ul className={`text-xs space-y-1 ${theme.text}`}>
                                    <li>🐴 <strong>{ts('cavalry')}</strong> → {ts('cavalryUse')}</li>
                                    <li>🛡️ <strong>{ts('infantry')}</strong> → {ts('infantryUse')}</li>
                                    <li>🌾 <strong>{ts('else')}</strong> → {ts('elseUse')}</li>
                                </ul>
                            </div>
                        </div>

                        {/* Expandable Notes */}
                        <button
                            onClick={() => setStrategyExpanded(!strategyExpanded)}
                            className={`w-full p-2 flex items-center justify-between hover:opacity-80 transition-opacity border-t ${theme.border}`}
                        >
                            <span className={`text-xs ${theme.textMuted}`}>{isEditor ? ts('editNotes') : ts('additionalNotes')}</span>
                            <span className={`text-sm ${theme.textMuted}`}>{strategyExpanded ? '▼' : '▶'}</span>
                        </button>
                        {strategyExpanded && (
                            <div className={`pt-2`}>
                                {isEditor ? (
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        onBlur={() => saveData({ notes })}
                                        placeholder={ts('notesPlaceholder')}
                                        className={`w-full min-h-[150px] px-3 py-2 rounded-lg border ${theme.input} focus:outline-none focus:ring-2 focus:ring-[#4318ff] resize-y font-mono text-sm`}
                                    />
                                ) : (
                                    <div className={`whitespace-pre-wrap font-mono text-sm ${theme.text}`}>
                                        {notes || ts('noNotes')}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {isEditor && (
                        <section className={`${theme.card} border rounded-xl p-4 mb-6`}>
                            <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${theme.textMuted}`}>{ts('addPlayer')}</h2>
                            <div className="flex flex-wrap gap-3 items-end">
                                <div className="flex-1 min-w-[200px] relative" ref={dropdownRef}>
                                    <div className="flex gap-2 mb-2">
                                        <button onClick={() => setUseCustomName(false)} className={`text-xs px-2 py-1 rounded ${!useCustomName ? theme.tagActive : theme.tag}`}>
                                            {ts('fromRoster')}
                                        </button>
                                        <button onClick={() => setUseCustomName(true)} className={`text-xs px-2 py-1 rounded ${useCustomName ? theme.tagActive : theme.tag}`}>
                                            {ts('customName')}
                                        </button>
                                    </div>
                                    <input type="text" value={playerSearch} onChange={(e) => { setPlayerSearch(e.target.value); setShowDropdown(true); }}
                                        onFocus={() => !useCustomName && setShowDropdown(true)}
                                        placeholder={useCustomName ? ts('enterCustomName') : ts('searchRoster')}
                                        className={`w-full px-3 py-2 rounded-lg border ${theme.input} focus:outline-none focus:ring-2 focus:ring-[#4318ff]`} />
                                    {showDropdown && !useCustomName && filteredRoster.length > 0 && (
                                        <div className={`absolute z-10 w-full mt-1 ${theme.dropdown} border rounded-lg shadow-lg max-h-48 overflow-y-auto`}>
                                            {filteredRoster.slice(0, 10).map(name => (
                                                <button key={name} onClick={() => addPlayer(name)}
                                                    className={`w-full text-left px-3 py-2 text-sm ${theme.dropdownHover} ${theme.text}`}>
                                                    {name}
                                                </button>
                                            ))}
                                            {filteredRoster.length > 10 && (
                                                <div className={`px-3 py-2 text-xs ${theme.textMuted}`}>+{filteredRoster.length - 10} more...</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="w-48">
                                    <select value={newPlayerTeam} onChange={(e) => setNewPlayerTeam(Number(e.target.value))}
                                        className={`w-full px-3 py-2 rounded-lg border ${theme.input} focus:outline-none focus:ring-2 focus:ring-[#4318ff]`}>
                                        <option value={1}>{ts('topLane')} ({getTeamPlayers(1).length})</option>
                                        <option value={2}>{ts('midLane')} ({getTeamPlayers(2).length})</option>
                                        <option value={3}>{ts('bottomLane')} ({getTeamPlayers(3).length})</option>
                                        <option value={0}>{ts('substitute')} ({substitutes.length})</option>
                                    </select>
                                </div>
                                {useCustomName && (
                                    <button onClick={() => addPlayer(playerSearch)} className={`px-6 py-2 rounded-lg font-medium ${theme.buttonPrimary}`}>{ts('add')}</button>
                                )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {AVAILABLE_TAGS.map(tag => (
                                    <button key={tag} onClick={() => setNewPlayerTags(newPlayerTags.includes(tag) ? newPlayerTags.filter(t => t !== tag) : [...newPlayerTags, tag])}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${newPlayerTags.includes(tag) ? TAG_COLORS[tag] : theme.tag}`}>
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Sort Controls and Export */}
                    <div className={`flex flex-wrap items-center justify-between gap-3 mb-4`}>
                        <div className="flex items-center gap-4">
                            <h2 className={`text-sm font-semibold uppercase tracking-wider ${theme.textMuted}`}>{ts('zoneAssignments')}</h2>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                <span className={`text-xs ${theme.textMuted}`}>{ts('confirmed')}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Sort options */}
                            {/* Team filter */}
                            <div className="flex items-center gap-2">
                                <span className={`text-xs ${theme.textMuted}`}>{ts('teamLabel')}</span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setRosterTeamFilter('all')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${rosterTeamFilter === 'all' ? theme.tagActive : theme.tag}`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setRosterTeamFilter('T1')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${rosterTeamFilter === 'T1' ? 'bg-blue-600 text-white' : theme.tag}`}
                                    >
                                        T1
                                    </button>
                                    <button
                                        onClick={() => setRosterTeamFilter('T2')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${rosterTeamFilter === 'T2' ? 'bg-orange-600 text-white' : theme.tag}`}
                                    >
                                        T2
                                    </button>
                                    <button
                                        onClick={() => setRosterTeamFilter('T3')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${rosterTeamFilter === 'T3' ? 'bg-purple-600 text-white' : theme.tag}`}
                                    >
                                        T3
                                    </button>
                                </div>
                            </div>
                            {/* Sort */}
                            <div className="flex items-center gap-2">
                                <span className={`text-xs ${theme.textMuted}`}>{ts('sortLabel')}</span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setRosterSort('power')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${rosterSort === 'power' ? theme.tagActive : theme.tag}`}
                                    >
                                        Power
                                    </button>
                                    <button
                                        onClick={() => setRosterSort('teleport')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${rosterSort === 'teleport' ? theme.tagActive : theme.tag}`}
                                    >
                                        {ts('teleport')}
                                    </button>
                                    <button
                                        onClick={() => setRosterSort('name')}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${rosterSort === 'name' ? theme.tagActive : theme.tag}`}
                                    >
                                        Name
                                    </button>
                                </div>
                            </div>
                            {/* Export action */}
                            <button
                                onClick={exportRosterImage}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme.button}`}
                            >
                                📷 {ts('export')}
                            </button>
                            {/* Copy text summary */}
                            <button
                                onClick={copyRosterSummary}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    rosterCopiedSummary ? 'bg-green-600 text-white' : theme.button
                                }`}
                            >
                                {rosterCopiedSummary ? '✓ Copied!' : '📋 Text'}
                            </button>
                            {/* Mail copy buttons — one per detected AoO team */}
                            {(() => {
                                const aooTeams = new Set<string>();
                                players.forEach(p => p.tags.forEach(tag => { if (tag.match(/^T[123]$/)) aooTeams.add(tag); }));
                                const teamList = [...aooTeams].sort();
                                if (teamList.length === 0) return null;
                                const teamColorMap: Record<string, string> = {
                                    T1: 'text-blue-400 border-blue-500/30 hover:bg-blue-500/10',
                                    T2: 'text-orange-400 border-orange-500/30 hover:bg-orange-500/10',
                                    T3: 'text-purple-400 border-purple-500/30 hover:bg-purple-500/10',
                                };
                                return teamList.map(teamTag => (
                                    <button
                                        key={teamTag}
                                        onClick={() => copyRosterMail(teamTag)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                            rosterCopiedMail ? 'bg-green-600 text-white border-green-600' : teamColorMap[teamTag] || theme.button
                                        }`}
                                    >
                                        {rosterCopiedMail ? '✓' : `✉ ${teamTag}`}
                                    </button>
                                ));
                            })()}
                        </div>
                    </div>
                    {/* Hidden canvas for export */}
                    <canvas ref={rosterCanvasRef} style={{ display: 'none' }} />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {[1, 2, 3].map((teamNum) => {
                            const teamInfo = teams[teamNum - 1];
                            const teamPlayers = getTeamPlayers(teamNum);
                            const zoneTotalPower = teamPlayers.reduce((sum, p) => sum + (p.power || powerByName[p.name] || 0), 0);
                            const zoneColor = ZONE_COLORS[teamNum as keyof typeof ZONE_COLORS];
                            return (
                                <section key={teamNum} className={`${theme.card} border-l-4 ${zoneColor.border} rounded-xl p-4`}>
                                    <div className={`mb-4 pb-3 border-b ${theme.border}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <h3 className={`font-semibold ${zoneColor.text}`}>{teamInfo.name}</h3>
                                                <button
                                                    onClick={() => copyZoneToClipboard(teamNum)}
                                                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${copySuccess === teamNum ? 'bg-[#4318ff] text-white' : theme.tag} hover:opacity-80`}
                                                    title={`Copy ${teamInfo.name} roster`}
                                                >
                                                    {copySuccess === teamNum ? '✓' : '📋'}
                                                </button>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-xs ${theme.textMuted}`}>{teamPlayers.length} {ts('players')}</span>
                                                {zoneTotalPower > 0 && (
                                                    <p className={`text-xs ${theme.textAccent}`}>{formatPower(zoneTotalPower)}</p>
                                                )}
                                            </div>
                                        </div>
                                        {isEditor ? (
                                            <input type="text" value={teamInfo.description} onChange={(e) => updateTeamDescription(teamNum - 1, e.target.value)}
                                                placeholder={ts('roleDescription')} className={`mt-2 w-full px-2 py-1 rounded text-sm border ${theme.input} focus:outline-none focus:ring-1 focus:ring-[#4318ff]`} />
                                        ) : (
                                            <p className={`text-sm ${theme.textAccent} mt-1`}>{teamInfo.description || '—'}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {teamPlayers.length === 0 ? (
                                            <p className={`text-sm ${theme.textMuted} text-center py-6`}>{ts('noPlayers')}</p>
                                        ) : (
                                            teamPlayers.map((player) => (
                                                <div key={player.id} className="rounded-lg p-3 bg-[var(--background-secondary)] border border-white/5">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            {player.tags.includes('Confirmed') && (
                                                                <span className="w-2 h-2 rounded-full bg-green-500" title="Confirmed" />
                                                            )}
                                                            <button onClick={() => openPlayer(player.name)} className="font-medium text-sm hover:underline cursor-pointer hover:text-[#4318ff]" title="View player details">{player.name}</button>
                                                            {(player.power || powerByName[player.name]) && (
                                                                <span className={`text-xs ${theme.textMuted}`}>
                                                                    {formatPower(player.power || powerByName[player.name])}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isEditor && (
                                                            <div className="flex items-center gap-2">
                                                                <select value={player.team} onChange={(e) => movePlayer(player.id, Number(e.target.value))}
                                                                    className={`text-xs px-2 py-1 rounded border ${theme.input}`}>
                                                                    <option value={1}>Top</option><option value={2}>Mid</option><option value={3}>Bot</option>
                                                                </select>
                                                                <button onClick={() => removePlayer(player.id)} className="text-red-500 hover:text-red-400 text-sm">✕</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {isEditor ? (
                                                            AVAILABLE_TAGS.map(tag => (
                                                                <button key={tag} onClick={() => togglePlayerTag(player.id, tag)}
                                                                    className={`px-2 py-0.5 rounded text-xs transition-colors ${player.tags.includes(tag) ? TAG_COLORS[tag] : theme.tag}`}>
                                                                    {tag}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            player.tags.filter(tag => tag !== 'Confirmed').length > 0 ? player.tags.filter(tag => tag !== 'Confirmed').map(tag => (
                                                                <span key={tag} className={`px-2 py-0.5 rounded text-xs ${TAG_COLORS[tag]}`}>{tag}</span>
                                                            )) : <span className={`text-xs ${theme.textMuted}`}>{ts('noTags')}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </section>
                            );
                        })}
                    </div>

                    {/* Substitutes Section */}
                    <section className={`${theme.card} border rounded-xl p-4 mt-6`}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className={`text-sm font-semibold uppercase tracking-wider ${theme.textMuted}`}>{ts('substitutesTitle')}</h2>
                            <span className={`text-xs ${theme.textMuted}`}>{substitutes.length} {ts('players')}</span>
                        </div>
                        {isEditor && (
                            <div className="flex gap-2 mb-4">
                                <input 
                                    type="text" 
                                    placeholder={ts('addSubPlaceholder')}
                                    className={`flex-1 px-3 py-2 rounded-lg border ${theme.input} focus:outline-none focus:ring-2 focus:ring-[#4318ff]`}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            const input = e.target as HTMLInputElement;
                                            if (input.value.trim()) {
                                                const newSub: Player = { id: Date.now(), name: input.value.trim(), team: 0, tags: [], power: 0, assignments: { phase1: "", phase2: "", phase3: "", phase4: "" } };
                                                const updatedSubs = [...substitutes, newSub];
                                                setSubstitutes(updatedSubs);
                                                saveData({ substitutes: updatedSubs });
                                                input.value = '';
                                            }
                                        }
                                    }}
                                />
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {substitutes.length === 0 ? (
                                <p className={`text-sm ${theme.textMuted}`}>{ts('noSubstitutes')}</p>
                            ) : (
                                substitutes.map(sub => (
                                    <div key={sub.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]">
                                        <span className="text-sm">{sub.name}</span>
                                        {isEditor && (
                                            <button 
                                                onClick={() => {
                                                    const updatedSubs = substitutes.filter(s => s.id !== sub.id);
                                                    setSubstitutes(updatedSubs);
                                                    saveData({ substitutes: updatedSubs });
                                                }}
                                                className="text-red-500 hover:text-red-400 text-xs"
                                            >✕</button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <footer className={`mt-8 pt-4 border-t ${theme.border} text-center`}>
                        <p className={`text-xs ${theme.textMuted}`}>Angmar • Rise of Kingdoms</p>
                        <p className={`text-[10px] ${theme.textMuted} mt-1 opacity-50`}>🥙 Kebab (BBQ) provides the snacks • Moon provides unsolicited advice</p>
                    </footer>
                </div>
            )}

        </div>
    );
}
