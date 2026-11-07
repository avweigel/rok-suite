'use client';

import { useRef, useState } from 'react';
import type { PlanRole, PlanSummary, PlanUser, ShareMode } from '../../store/types';
import { Section, Seg, fmtTime } from '../components';

export type SaveStatus = 'idle' | 'saving' | 'error' | 'conflict';

export interface PlanPanelProps {
  hasStore: boolean;
  user: PlanUser | null | undefined;
  name: string;
  onRename(name: string): void;
  dirty: boolean;
  status: SaveStatus;
  errorText: string;
  role: PlanRole;
  via: 'own' | 'link';
  currentId: string | null;
  shareMode: ShareMode;
  shareLink: string | null;
  list: PlanSummary[];
  onNew(): void;
  onSave(): void;
  onSaveCopy(): void;
  onOpen(id: string): void;
  onDelete(): void;
  onSetSharing(mode: ShareMode): void;
  onCopyLink(): void;
  onExport(): void;
  onImport(file: File): void;
  onSignIn?: () => void;
  onSignOut?: () => void;
  /** Who signs people in ("Discord"), for the account line. */
  providerName?: string;
  /** Why saving cannot work right now (the database is not ready...), shown plainly. */
  storeProblem?: string;
  onConflictLoad(): void;
  onConflictOverwrite(): void;
}

const SHARE_TEXT: Record<ShareMode, string> = {
  private: 'Only you can open this plan.',
  view: 'Anyone with the link can look at the plan (they cannot change it).',
  edit: 'Anyone with the link can look at it AND change it, without signing in.',
};

export function PlanPanel(p: PlanPanelProps) {
  const [draft, setDraft] = useState(p.name);
  const [seen, setSeen] = useState(p.name);
  const file = useRef<HTMLInputElement>(null);
  if (p.name !== seen) {                                            // another plan was opened, or undo changed the name
    setSeen(p.name);
    setDraft(p.name);
  }
  const readOnly = p.role === 'viewer';
  const commit = (): void => {
    if (draft.trim() && draft !== p.name) p.onRename(draft);
    else setDraft(p.name);
  };

  let pill = 'Empty plan';
  let tone = 'rokp-pill';
  if (readOnly) {
    pill = 'Shared with you: view only';
  } else if (p.status === 'saving') {
    pill = 'Saving…';
  } else if (p.status === 'error') {
    pill = 'Could not save';
    tone = 'rokp-pill bad';
  } else if (p.status === 'conflict') {
    pill = 'Changed by someone else';
    tone = 'rokp-pill bad';
  } else if (p.currentId && !p.dirty) {
    pill = 'Saved';
    tone = 'rokp-pill ok';
  } else if (p.currentId) {
    pill = 'Unsaved changes';
  } else if (p.dirty) {
    pill = 'Not saved yet';
  }

  return (
    <Section title="Plan" defaultOpen>
      {p.hasStore && (
        <div className={`rokp-account${p.user ? ' on' : ''}`}>
          {p.user ? (
            <>
              <span className="rokp-grow">
                Signed in{p.providerName ? ` with ${p.providerName}` : ''} as <b>{p.user.name}</b>
              </span>
              {p.onSignOut && (
                <button type="button" className="rokp-link" onClick={p.onSignOut}>
                  Sign out
                </button>
              )}
            </>
          ) : p.user === null ? (
            <>
              <span className="rokp-grow">Not signed in: plans cannot be saved to your account.</span>
              {p.onSignIn && (
                <button type="button" className="rokp-link" onClick={p.onSignIn}>
                  Sign in{p.providerName ? ` with ${p.providerName}` : ''}
                </button>
              )}
            </>
          ) : (
            <span className="rokp-grow">Checking who you are…</span>
          )}
        </div>
      )}
      {p.storeProblem && <p className="rokp-msg bad">{p.storeProblem}</p>}
      <div className="rokp-row">
        <input className="rokp-input rokp-grow" value={draft} disabled={readOnly} maxLength={60} aria-label="Plan name" onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        <span className={tone}>{pill}</span>
      </div>
      {p.via === 'link' && !readOnly && <p className="rokp-hint">You are editing through a share link: every change you make is saved for everybody who has it.</p>}
      {p.status === 'error' && p.errorText && <p className="rokp-msg bad">{p.errorText}</p>}
      {p.status === 'conflict' && (
        <div className="rokp-msg bad">
          <p>Somebody saved this plan after you opened it.</p>
          <div className="rokp-row">
            <button type="button" onClick={p.onConflictLoad}>Load their version</button>
            <button type="button" onClick={p.onConflictOverwrite}>Overwrite with mine</button>
          </div>
        </div>
      )}
      <div className="rokp-row rokp-wrap">
        <button type="button" onClick={p.onNew}>New</button>
        {p.hasStore && !readOnly && (
          <button type="button" className="rokp-primary" disabled={p.status === 'saving' || (!!p.currentId && !p.dirty)} onClick={p.onSave}>
            Save
          </button>
        )}
        {p.hasStore && p.user && <button type="button" onClick={p.onSaveCopy} title="Save a copy under your name, and keep working on the copy">Save a copy</button>}
        <button type="button" onClick={p.onExport} title="Download the plan as a file (nothing is sent anywhere)">Export</button>
        <button type="button" onClick={() => file.current?.click()} title="Open a plan file you exported before">Import</button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) p.onImport(f);
          }}
        />
      </div>
      {!p.hasStore && <p className="rokp-hint">Plans are not stored on this site. Use Export to keep a plan and Import to open it again.</p>}
      {p.hasStore && p.user && p.currentId && p.role === 'owner' && p.via === 'own' && (
        <div className="rokp-box">
          <div className="rokp-label">Who can open it</div>
          <Seg<ShareMode>
            value={p.shareMode}
            onChange={p.onSetSharing}
            options={[{ value: 'private', label: 'Only me' }, { value: 'view', label: 'Can view' }, { value: 'edit', label: 'Can edit' }]}
          />
          <p className="rokp-hint">{SHARE_TEXT[p.shareMode]}</p>
          {p.shareLink && p.shareMode !== 'private' && (
            <div className="rokp-row">
              <input className="rokp-input rokp-grow" readOnly value={p.shareLink} onFocus={(e) => e.target.select()} aria-label="Share link" />
              <button type="button" onClick={p.onCopyLink}>Copy</button>
            </div>
          )}
        </div>
      )}
      {p.hasStore && p.user && (
        <div className="rokp-box">
          <div className="rokp-label">
            Your plans <span className="rokp-badge">{p.list.length}</span>
          </div>
          {p.list.length === 0 && <p className="rokp-hint">No saved plans yet.</p>}
          <ul className="rokp-list">
            {p.list.map((pl) => (
              <li key={pl.id} className={pl.id === p.currentId ? 'on' : ''}>
                <button type="button" onClick={() => p.onOpen(pl.id)} title="Open this plan">
                  <span className="rokp-grow">{pl.name}</span>
                  {pl.shareMode !== 'private' && <span className="rokp-tag">{pl.shareMode === 'edit' ? 'shared · edit' : 'shared · view'}</span>}
                  <small>{fmtTime(pl.updatedAt)}</small>
                </button>
              </li>
            ))}
          </ul>
          {p.currentId && p.role === 'owner' && p.via === 'own' && (
            <button type="button" className="rokp-danger" onClick={p.onDelete}>
              Delete this plan
            </button>
          )}
        </div>
      )}
    </Section>
  );
}
