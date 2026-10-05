'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Camera, X, Plus, Trash2, Send, CheckCircle2, AlertCircle,
  Swords, Shield, Info, HelpCircle,
} from 'lucide-react';
import {
  submitLeaderApplication,
  type LeaderRoleInput,
  type UnitType,
  type RoleType,
} from '@/lib/supabase/use-leader-applications';
import { useLatestScanPlayers } from '@/lib/scans/use-latest-scan-players';
import { KINGDOM_ID } from '@/lib/zero-list/scan-data';
import { CommanderPicker } from './CommanderPicker';
import { Combobox, type ComboboxSuggestion } from './Combobox';

function formatPower(power: number): string {
  if (power >= 1_000_000) return `${(power / 1_000_000).toFixed(1)}M`;
  if (power >= 1_000) return `${(power / 1_000).toFixed(0)}K`;
  return power.toString();
}

function formatScanDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type ShotSlot =
  | 'primaryGear'
  | 'primaryArmaments'
  | 'primarySkills'
  | 'secondaryGear'
  | 'secondaryArmaments'
  | 'secondarySkills';

const SHOT_SLOTS: ShotSlot[] = [
  'primaryGear',
  'primaryArmaments',
  'primarySkills',
  'secondaryGear',
  'secondaryArmaments',
  'secondarySkills',
];

/** Slots the submitter MUST provide. The secondary commander only needs its
 *  Skills screenshot — gear / armaments for the secondary are informative but
 *  optional. Reviewers still see the empty tiles in admin so applicants can't
 *  hide gaps. */
const REQUIRED_SHOT_SLOTS: ShotSlot[] = [
  'primaryGear',
  'primaryArmaments',
  'primarySkills',
  'secondarySkills',
];

const SLOT_TO_FILE_KEY: Record<ShotSlot, keyof LeaderRoleInput> = {
  primaryGear: 'primaryGearFile',
  primaryArmaments: 'primaryArmamentsFile',
  primarySkills: 'primarySkillsFile',
  secondaryGear: 'secondaryGearFile',
  secondaryArmaments: 'secondaryArmamentsFile',
  secondarySkills: 'secondarySkillsFile',
};

interface RoleEntry extends LeaderRoleInput {
  uid: string;
  previews: Record<ShotSlot, string | null>;
  /** UI-only filter for the secondary picker so applicants can pair, e.g.,
   *  an Archer main with a Leadership support. Not persisted — the secondary
   *  commander's own specialties in apply_commanders are enough for review. */
  secondaryUnitType: UnitType;
}

function newRole(): RoleEntry {
  return {
    uid: crypto.randomUUID(),
    unitType: 'infantry',
    secondaryUnitType: 'infantry',
    roleType: 'rally',
    primaryCommanderId: null,
    primaryCommanderName: null,
    secondaryCommanderId: null,
    secondaryCommanderName: null,
    primaryGearFile: null,
    primaryArmamentsFile: null,
    primarySkillsFile: null,
    secondaryGearFile: null,
    secondaryArmamentsFile: null,
    secondarySkillsFile: null,
    previews: {
      primaryGear: null,
      primaryArmaments: null,
      primarySkills: null,
      secondaryGear: null,
      secondaryArmaments: null,
      secondarySkills: null,
    },
  };
}

export function LeaderApplicationForm() {
  const t = useTranslations('apply');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [kingdom, setKingdom] = useState('');
  const [name, setName] = useState('');
  const [govId, setGovId] = useState('');
  const [discord, setDiscord] = useState('');
  const [notes, setNotes] = useState('');
  const [roles, setRoles] = useState<RoleEntry[]>([newRole()]);

  // Autofill comes from the latest location scan uploaded on /upload (CH25
  // players of our home KD). Applications are for K23 only (3923).
  const kingdomNum = /^\d+$/.test(kingdom.trim()) ? Number(kingdom.trim()) : null;
  const kingdomKnown = kingdomNum === KINGDOM_ID;
  const { players, scanAt: latestScanDate, loading: playersLoading } = useLatestScanPlayers();

  const kingdomSuggestions = useMemo<ComboboxSuggestion[]>(
    () => [{ key: String(KINGDOM_ID), label: String(KINGDOM_ID), secondary: `KD ${KINGDOM_ID}` }],
    [],
  );

  const playerSuggestions = useMemo<ComboboxSuggestion[]>(
    () =>
      players.map((p) => ({
        key: String(p.governorId),
        label: p.name,
        secondary: `ID ${p.governorId} · ${formatPower(p.power)}`,
      })),
    [players],
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const registerField = (key: string) => (el: HTMLElement | null) => {
    fieldRefs.current[key] = el;
  };
  const scrollToFirstError = (errorMap: Record<string, string>) => {
    const firstKey = Object.keys(errorMap)[0];
    if (!firstKey) return;
    const el = fieldRefs.current[firstKey];
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const updateRole = (uid: string, patch: Partial<RoleEntry>) => {
    setRoles((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  };

  const addRole = () => setRoles((prev) => [...prev, newRole()]);

  const removeRole = (uid: string) => {
    setRoles((prev) => {
      const target = prev.find((r) => r.uid === uid);
      if (target) {
        SHOT_SLOTS.forEach((slot) => {
          const url = target.previews[slot];
          if (url) URL.revokeObjectURL(url);
        });
      }
      return prev.filter((r) => r.uid !== uid);
    });
  };

  const handleFile = async (
    uid: string,
    slot: ShotSlot,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (picked.size > MAX_IMAGE_BYTES) {
      setErrors((p) => ({ ...p, [`${uid}_${slot}`]: t('errors.imageTooLarge') }));
      return;
    }

    // Snapshot the bytes NOW instead of keeping the File reference. The picked
    // File is a thin handle to a location on disk — if the applicant then
    // overwrites the source (e.g. takes a new screenshot into the same path),
    // Chrome invalidates the handle and the upload later fails with
    // net::ERR_UPLOAD_FILE_CHANGED. Wrapping an in-memory ArrayBuffer in a
    // fresh File detaches from disk and immunizes against that.
    let file: File;
    try {
      const buf = await picked.arrayBuffer();
      file = new File([buf], picked.name, {
        type: picked.type,
        lastModified: picked.lastModified,
      });
    } catch (err) {
      setErrors((p) => ({
        ...p,
        [`${uid}_${slot}`]: err instanceof Error ? err.message : 'Failed to read file',
      }));
      return;
    }

    const url = URL.createObjectURL(file);
    setRoles((prev) =>
      prev.map((r) => {
        if (r.uid !== uid) return r;
        const old = r.previews[slot];
        if (old) URL.revokeObjectURL(old);
        return {
          ...r,
          [SLOT_TO_FILE_KEY[slot]]: file,
          previews: { ...r.previews, [slot]: url },
        };
      }),
    );
    setErrors((p) => {
      const copy = { ...p };
      delete copy[`${uid}_${slot}`];
      return copy;
    });
  };

  const removeFile = (uid: string, slot: ShotSlot) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.uid !== uid) return r;
        const old = r.previews[slot];
        if (old) URL.revokeObjectURL(old);
        return {
          ...r,
          [SLOT_TO_FILE_KEY[slot]]: null,
          previews: { ...r.previews, [slot]: null },
        };
      }),
    );
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!kingdom.trim()) next.kingdom = t('errors.required');
    if (!name.trim()) next.name = t('errors.required');
    if (!govId.trim()) next.govId = t('errors.required');
    else if (!/^\d+$/.test(govId.trim())) next.govId = t('errors.govIdNumeric');

    roles.forEach((r) => {
      if (!r.primaryCommanderId) next[`${r.uid}_primaryCommander`] = t('errors.commanderRequired');
      if (!r.secondaryCommanderId) next[`${r.uid}_secondaryCommander`] = t('errors.commanderRequired');
      if (r.primaryCommanderId && r.primaryCommanderId === r.secondaryCommanderId) {
        next[`${r.uid}_secondaryCommander`] = t('errors.commanderDuplicate');
      }
      // Primary needs all three screenshots (gear, armaments, skills). Secondary
      // only needs Skills — see REQUIRED_SHOT_SLOTS for the exact set.
      REQUIRED_SHOT_SLOTS.forEach((slot) => {
        if (!r[SLOT_TO_FILE_KEY[slot]]) next[`${r.uid}_${slot}`] = t('errors.required');
      });
    });

    if (roles.length === 0) next.roles = t('errors.atLeastOneRole');

    setErrors(next);
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      scrollToFirstError(errs);
      return;
    }

    setSubmitting(true);
    const result = await submitLeaderApplication({
      kingdom,
      name,
      govId,
      discord,
      notes,
      locale,
      roles: roles.map((r) => ({
        unitType: r.unitType,
        roleType: r.roleType,
        primaryCommanderId: r.primaryCommanderId,
        primaryCommanderName: r.primaryCommanderName,
        secondaryCommanderId: r.secondaryCommanderId,
        secondaryCommanderName: r.secondaryCommanderName,
        primaryGearFile: r.primaryGearFile,
        primaryArmamentsFile: r.primaryArmamentsFile,
        primarySkillsFile: r.primarySkillsFile,
        secondaryGearFile: r.secondaryGearFile,
        secondaryArmamentsFile: r.secondaryArmamentsFile,
        secondarySkillsFile: r.secondarySkillsFile,
      })),
    });
    setSubmitting(false);

    if ('error' in result) {
      setSubmitError(result.error);
      return;
    }

    roles.forEach((r) => {
      SHOT_SLOTS.forEach((slot) => {
        const url = r.previews[slot];
        if (url) URL.revokeObjectURL(url);
      });
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-2xl bg-[var(--background-card)] border border-[var(--border)] p-6 sm:p-8 text-center">
        <div className="inline-flex p-3 rounded-full bg-emerald-500/15 text-emerald-400 mb-4">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
          {t('success.title')}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {t('success.message')}
        </p>
      </div>
    );
  }

  const inputBase =
    'w-full rounded-lg border px-3 py-2.5 text-base sm:text-sm outline-none transition-colors focus:ring-2 focus:ring-[#4318ff]/40';
  const inputStyle = {
    backgroundColor: 'var(--background-secondary)',
    borderColor: 'var(--border)',
    color: 'var(--foreground)',
  };
  const errorBorder = 'border-red-500/60';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-32 sm:pb-6" noValidate>
      {/* What you'll need — short orientation for first-time visitors */}
      <section className="rounded-2xl bg-[#4318ff]/5 border border-[#4318ff]/20 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-[#4318ff]/10 text-[#a78bfa] flex-shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[var(--foreground)] mb-1.5">
              {t('intro.title')}
            </h2>
            <ul className="space-y-1 text-xs text-[var(--text-secondary)] leading-relaxed">
              <li>• {t('intro.step1')}</li>
              <li>• {t('intro.step2')}</li>
              <li>• {t('intro.step3')}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Identity card */}
      <section className="rounded-2xl bg-[var(--background-card)] border border-[var(--border)] p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          {t('sections.identity')}
        </h2>

        <div ref={registerField('kingdom')}>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            {t('fields.kingdom')} <span className="text-red-400">*</span>
          </label>
          <Combobox
            value={kingdom}
            onChange={setKingdom}
            suggestions={kingdomSuggestions}
            placeholder={t('placeholders.kingdom')}
            invalid={!!errors.kingdom}
            inputMode="numeric"
            emptyHint={t('autofill.kingdomNotFound')}
          />
          {errors.kingdom && <p className="text-xs text-red-400 mt-1">{errors.kingdom}</p>}
        </div>

        <div ref={registerField('name')}>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            {t('fields.name')} <span className="text-red-400">*</span>
          </label>
          <Combobox
            value={name}
            onChange={setName}
            onPick={(s) => {
              setName(s.label);
              setGovId(s.key);
            }}
            suggestions={kingdomKnown ? playerSuggestions : []}
            placeholder={t('placeholders.name')}
            invalid={!!errors.name}
            loading={kingdomKnown && playersLoading && players.length === 0}
            loadingHint={t('autofill.loading')}
            emptyHint={
              kingdomKnown
                ? t('autofill.noPlayers')
                : t('autofill.pickKingdomFirst')
            }
          />
          {kingdomKnown && latestScanDate && (
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              {t('autofill.scanLabel', { date: formatScanDate(latestScanDate, locale) })}
            </p>
          )}
          {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
        </div>

        <div ref={registerField('govId')}>
          <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            {t('fields.govId')} <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={govId}
            onChange={(e) => setGovId(e.target.value)}
            placeholder={t('placeholders.govId')}
            className={`${inputBase} ${errors.govId ? errorBorder : ''}`}
            style={inputStyle}
            autoComplete="off"
          />
          <p className="flex items-start gap-1.5 text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
            <HelpCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{t('hints.govIdLocation')}</span>
          </p>
          {errors.govId && <p className="text-xs text-red-400 mt-1">{errors.govId}</p>}
        </div>
      </section>

      {/* Roles card */}
      <section className="rounded-2xl bg-[var(--background-card)] border border-[var(--border)] p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              {t('sections.roles')}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">{t('sections.rolesHint')}</p>
          </div>
        </div>

        <div className="space-y-4">
          {roles.map((role, idx) => (
            <RoleCard
              key={role.uid}
              index={idx}
              role={role}
              canRemove={roles.length > 1}
              onChangeUnit={(v) =>
                updateRole(role.uid, {
                  unitType: v,
                  // Reset the secondary filter to match — most applicants pair
                  // same-troop-type. If they want a cross-type second (e.g.,
                  // Leadership support for an Archer main) they change it after.
                  secondaryUnitType: v,
                  // Clear the primary commander — a Cavalry pick left over
                  // when the role flips to Infantry would silently submit bad
                  // data. Also clear the secondary since its filter just moved.
                  primaryCommanderId: null,
                  primaryCommanderName: null,
                  secondaryCommanderId: null,
                  secondaryCommanderName: null,
                })
              }
              onChangeSecondaryUnit={(v) =>
                updateRole(role.uid, {
                  secondaryUnitType: v,
                  // Clear only the secondary — the primary is unaffected by
                  // this filter and should stay put.
                  secondaryCommanderId: null,
                  secondaryCommanderName: null,
                })
              }
              onChangeRoleType={(v) =>
                updateRole(role.uid, {
                  roleType: v,
                  // Garrison and rally draw from different commander pools, so
                  // clear any selection to avoid silently submitting a commander
                  // that isn't valid for the newly chosen role.
                  primaryCommanderId: null,
                  primaryCommanderName: null,
                  secondaryCommanderId: null,
                  secondaryCommanderName: null,
                })
              }
              onChangeCommander={(slot, id, name) =>
                updateRole(
                  role.uid,
                  slot === 'primary'
                    ? { primaryCommanderId: id, primaryCommanderName: name }
                    : { secondaryCommanderId: id, secondaryCommanderName: name },
                )
              }
              onFile={(slot, e) => handleFile(role.uid, slot, e)}
              onRemoveFile={(slot) => removeFile(role.uid, slot)}
              onRemove={() => removeRole(role.uid)}
              errorPrimaryCommander={errors[`${role.uid}_primaryCommander`]}
              errorSecondaryCommander={errors[`${role.uid}_secondaryCommander`]}
              fileErrors={{
                primaryGear: errors[`${role.uid}_primaryGear`],
                primaryArmaments: errors[`${role.uid}_primaryArmaments`],
                primarySkills: errors[`${role.uid}_primarySkills`],
                secondaryGear: errors[`${role.uid}_secondaryGear`],
                secondaryArmaments: errors[`${role.uid}_secondaryArmaments`],
                secondarySkills: errors[`${role.uid}_secondarySkills`],
              }}
              registerCommanderField={(slot, el) => {
                fieldRefs.current[`${role.uid}_${slot}Commander`] = el;
              }}
              t={t}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addRole}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--background-secondary)] hover:text-[var(--foreground)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('addRole')}
        </button>
      </section>

      {/* Optional card */}
      <section className="rounded-2xl bg-[var(--background-card)] border border-[var(--border)] p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          {t('sections.optional')}
        </h2>

        <div>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            {t('fields.discord')}
          </label>
          <input
            type="text"
            value={discord}
            onChange={(e) => setDiscord(e.target.value)}
            placeholder={t('placeholders.discord')}
            className={inputBase}
            style={inputStyle}
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            {t('fields.notes')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('placeholders.notes')}
            rows={4}
            className={inputBase}
            style={inputStyle}
          />
        </div>
      </section>

      {submitError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 sm:py-0 bg-[var(--background)]/95 sm:bg-transparent backdrop-blur sm:backdrop-blur-none border-t sm:border-0 border-[var(--border)]">
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-[#4318ff] to-[#7c3aed] text-white font-medium text-sm shadow-lg shadow-[#4318ff]/20 hover:shadow-[#4318ff]/40 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          {submitting ? tCommon('loading') : t('submit')}
        </button>
      </div>
    </form>
  );
}

interface RoleCardProps {
  index: number;
  role: RoleEntry;
  canRemove: boolean;
  onChangeUnit: (v: UnitType) => void;
  onChangeSecondaryUnit: (v: UnitType) => void;
  onChangeRoleType: (v: RoleType) => void;
  onChangeCommander: (slot: 'primary' | 'secondary', id: string | null, name: string | null) => void;
  onFile: (slot: ShotSlot, e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (slot: ShotSlot) => void;
  onRemove: () => void;
  errorPrimaryCommander?: string;
  errorSecondaryCommander?: string;
  fileErrors: Partial<Record<ShotSlot, string>>;
  registerCommanderField?: (slot: 'primary' | 'secondary', el: HTMLElement | null) => void;
  t: ReturnType<typeof useTranslations>;
}

function RoleCard({
  index,
  role,
  canRemove,
  onChangeUnit,
  onChangeSecondaryUnit,
  onChangeRoleType,
  onChangeCommander,
  onFile,
  onRemoveFile,
  onRemove,
  errorPrimaryCommander,
  errorSecondaryCommander,
  fileErrors,
  registerCommanderField,
  t,
}: RoleCardProps) {
  const selectBase =
    'w-full rounded-lg border px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-[#4318ff]/40 appearance-none';
  const selectStyle = {
    backgroundColor: 'var(--background-secondary)',
    borderColor: 'var(--border)',
    color: 'var(--foreground)',
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)]/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {role.roleType === 'rally' ? (
            <Swords className="w-3.5 h-3.5" />
          ) : (
            <Shield className="w-3.5 h-3.5" />
          )}
          {t('roleNumber', { n: index + 1 })}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label={t('removeRole')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            {t('fields.unit')} <span className="text-red-400">*</span>
          </label>
          <select
            value={role.unitType}
            onChange={(e) => onChangeUnit(e.target.value as UnitType)}
            className={selectBase}
            style={selectStyle}
          >
            <option value="infantry">{t('units.infantry')}</option>
            <option value="archer">{t('units.archer')}</option>
            <option value="cavalry">{t('units.cavalry')}</option>
            <option value="leadership">{t('units.leadership')}</option>
          </select>
        </div>

        {/* Secondary unit filter — narrows the secondary commander picker
         *  independently, so applicants can pair, e.g., an Archer main with a
         *  Leadership support. When role type is Garrison this filter is
         *  ignored (the picker forces garrison-only) but we still show it so
         *  the UI is consistent. */}
        <div>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            {t('fields.unitSecondary')} <span className="text-red-400">*</span>
          </label>
          <select
            value={role.secondaryUnitType}
            onChange={(e) => onChangeSecondaryUnit(e.target.value as UnitType)}
            className={selectBase}
            style={selectStyle}
          >
            <option value="infantry">{t('units.infantry')}</option>
            <option value="archer">{t('units.archer')}</option>
            <option value="cavalry">{t('units.cavalry')}</option>
            <option value="leadership">{t('units.leadership')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            {t('fields.role')} <span className="text-red-400">*</span>
          </label>
          <select
            value={role.roleType}
            onChange={(e) => onChangeRoleType(e.target.value as RoleType)}
            className={selectBase}
            style={selectStyle}
          >
            <option value="rally">{t('roleTypes.rally')}</option>
            <option value="garrison">{t('roleTypes.garrison')}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div ref={(el) => registerCommanderField?.('primary', el)}>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            {t('fields.primaryCommander')} <span className="text-red-400">*</span>
          </label>
          <CommanderPicker
            value={role.primaryCommanderId}
            onChange={(id, name) => onChangeCommander('primary', id, name)}
            unitFilter={role.unitType}
            invalid={!!errorPrimaryCommander}
            placeholder={t('commander.placeholder')}
          />
          {errorPrimaryCommander && (
            <p className="text-xs text-red-400 mt-1">{errorPrimaryCommander}</p>
          )}
        </div>
        <div ref={(el) => registerCommanderField?.('secondary', el)}>
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
            {t('fields.secondaryCommander')} <span className="text-red-400">*</span>
          </label>
          <CommanderPicker
            value={role.secondaryCommanderId}
            onChange={(id, name) => onChangeCommander('secondary', id, name)}
            unitFilter={role.secondaryUnitType}
            invalid={!!errorSecondaryCommander}
            placeholder={t('commander.placeholder')}
          />
          {errorSecondaryCommander && (
            <p className="text-xs text-red-400 mt-1">{errorSecondaryCommander}</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">
          {t('upload.sectionLabel')}
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-3">{t('upload.hint')}</p>

        <CommanderShots
          heading={t('upload.primaryCommander')}
          gearLabel={t('upload.gear')}
          armamentsLabel={t('upload.armaments')}
          skillsLabel={t('upload.skills')}
          gearPreview={role.previews.primaryGear}
          armamentsPreview={role.previews.primaryArmaments}
          skillsPreview={role.previews.primarySkills}
          gearError={fileErrors.primaryGear}
          armamentsError={fileErrors.primaryArmaments}
          skillsError={fileErrors.primarySkills}
          onGearChange={(e) => onFile('primaryGear', e)}
          onArmamentsChange={(e) => onFile('primaryArmaments', e)}
          onSkillsChange={(e) => onFile('primarySkills', e)}
          onGearRemove={() => onRemoveFile('primaryGear')}
          onArmamentsRemove={() => onRemoveFile('primaryArmaments')}
          onSkillsRemove={() => onRemoveFile('primarySkills')}
          tapLabel={t('upload.tap')}
        />

        <div className="h-3" />

        <CommanderShots
          heading={t('upload.secondaryCommander')}
          gearLabel={t('upload.gear')}
          armamentsLabel={t('upload.armaments')}
          skillsLabel={t('upload.skills')}
          gearPreview={role.previews.secondaryGear}
          armamentsPreview={role.previews.secondaryArmaments}
          skillsPreview={role.previews.secondarySkills}
          gearError={fileErrors.secondaryGear}
          armamentsError={fileErrors.secondaryArmaments}
          skillsError={fileErrors.secondarySkills}
          onGearChange={(e) => onFile('secondaryGear', e)}
          onArmamentsChange={(e) => onFile('secondaryArmaments', e)}
          onSkillsChange={(e) => onFile('secondarySkills', e)}
          onGearRemove={() => onRemoveFile('secondaryGear')}
          onArmamentsRemove={() => onRemoveFile('secondaryArmaments')}
          onSkillsRemove={() => onRemoveFile('secondarySkills')}
          tapLabel={t('upload.tap')}
          optionalGearArmaments
        />
      </div>
    </div>
  );
}

interface CommanderShotsProps {
  heading: string;
  gearLabel: string;
  armamentsLabel: string;
  skillsLabel: string;
  gearPreview: string | null;
  armamentsPreview: string | null;
  skillsPreview: string | null;
  gearError?: string;
  armamentsError?: string;
  skillsError?: string;
  onGearChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onArmamentsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSkillsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGearRemove: () => void;
  onArmamentsRemove: () => void;
  onSkillsRemove: () => void;
  tapLabel: string;
  /** For the secondary commander: gear + armaments are informational only, and
   *  the ScreenshotPicker drops its "required" asterisk on those two tiles. */
  optionalGearArmaments?: boolean;
}

function CommanderShots({
  heading,
  gearLabel,
  armamentsLabel,
  skillsLabel,
  gearPreview,
  armamentsPreview,
  skillsPreview,
  gearError,
  armamentsError,
  skillsError,
  onGearChange,
  onArmamentsChange,
  onSkillsChange,
  onGearRemove,
  onArmamentsRemove,
  onSkillsRemove,
  tapLabel,
  optionalGearArmaments = false,
}: CommanderShotsProps) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background-card)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
        {heading}
      </p>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <ScreenshotPicker
          label={gearLabel}
          required={!optionalGearArmaments}
          preview={gearPreview}
          error={gearError}
          onChange={onGearChange}
          onRemove={onGearRemove}
          uploadLabel={tapLabel}
        />
        <ScreenshotPicker
          label={armamentsLabel}
          required={!optionalGearArmaments}
          preview={armamentsPreview}
          error={armamentsError}
          onChange={onArmamentsChange}
          onRemove={onArmamentsRemove}
          uploadLabel={tapLabel}
        />
        <ScreenshotPicker
          label={skillsLabel}
          required
          preview={skillsPreview}
          error={skillsError}
          onChange={onSkillsChange}
          onRemove={onSkillsRemove}
          uploadLabel={tapLabel}
        />
      </div>
    </div>
  );
}

interface ScreenshotPickerProps {
  label: string;
  required?: boolean;
  preview: string | null;
  error?: string;
  uploadLabel: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}

function ScreenshotPicker({
  label,
  required,
  preview,
  error,
  uploadLabel,
  onChange,
  onRemove,
}: ScreenshotPickerProps) {
  const tCommon = useTranslations('common');
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt={label}
            className="w-full h-24 sm:h-32 object-cover rounded-lg border border-[var(--border)]"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            aria-label={tCommon('delete')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <label
          className={`flex flex-col items-center justify-center gap-1 w-full h-24 sm:h-32 px-1 rounded-lg border border-dashed cursor-pointer hover:bg-[var(--background-secondary)] transition-colors ${
            error ? 'border-red-500/60' : 'border-[var(--border)]'
          }`}
        >
          <Camera className="w-5 h-5 text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)] text-center px-2">{uploadLabel}</span>
          <input
            type="file"
            accept="image/*"
            onChange={onChange}
            className="hidden"
          />
        </label>
      )}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
