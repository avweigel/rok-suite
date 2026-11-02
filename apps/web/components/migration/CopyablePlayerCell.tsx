'use client';

import { useState } from 'react';

/** Two-row cell: player name (top) + governor id (bottom), each with a small
 *  copy-to-clipboard button. Used everywhere we display a player in a list. */
export function CopyablePlayerCell({
  name,
  govId,
  onNameClick,
  nameTitle,
}: {
  name: string;
  govId: number;
  /** Makes the name clickable. */
  onNameClick?: () => void;
  nameTitle?: string;
}) {
  const [copiedName, setCopiedName] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const copy = async (text: string, setCb: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCb(true);
    setTimeout(() => setCb(false), 1500);
  };
  const checkIcon = (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
  const copyIcon = (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
      <path d="M4 2a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2V4h8a2 2 0 0 0-2-2H4zm2 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6z" />
    </svg>
  );
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        {onNameClick ? (
          <button
            type="button"
            onClick={onNameClick}
            className="text-left text-[var(--foreground)] font-medium hover:underline decoration-dotted underline-offset-2"
            title={nameTitle}
          >
            {name}
          </button>
        ) : (
          <span className="text-[var(--foreground)] font-medium">{name}</span>
        )}
        <button
          type="button"
          onClick={() => copy(name, setCopiedName)}
          className={`p-0.5 rounded transition-colors ${
            copiedName ? 'text-emerald-400' : 'text-[var(--text-muted)]/40 hover:text-[var(--foreground)]'
          }`}
          title="Copy name"
        >
          {copiedName ? checkIcon : copyIcon}
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-[var(--text-muted)]">{govId}</span>
        <button
          type="button"
          onClick={() => copy(String(govId), setCopiedId)}
          className={`p-0.5 rounded transition-colors ${
            copiedId ? 'text-emerald-400' : 'text-[var(--text-muted)]/40 hover:text-[var(--foreground)]'
          }`}
          title="Copy Gov ID"
        >
          {copiedId ? checkIcon : copyIcon}
        </button>
      </div>
    </div>
  );
}
