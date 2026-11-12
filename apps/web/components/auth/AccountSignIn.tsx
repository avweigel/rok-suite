'use client';

// Account sign-in (Supabase email + password). Accounts are made by an admin in Supabase → Authentication → Users → Add user
// (with "Auto Confirm User"); there is no sign-up form on the site. Discord sign-in is on standby (FEATURES.discordLogin).

import { useEffect, useId, useState } from 'react';
import { LogIn, X } from 'lucide-react';
import { useAuth } from '@/lib/supabase/auth-context';

export function AccountSignInForm({ onDone, autoFocus = false }: { onDone?: () => void; autoFocus?: boolean }) {
  const { signInWithPassword } = useAuth();
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    const err = await signInWithPassword(email, password).catch((x: unknown) => (x instanceof Error ? x.message : 'Could not sign in.'));
    setBusy(false);
    if (err) setError(err);
    else onDone?.();
  };

  const field =
    'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--info)]';
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={`${id}-email`} className="text-xs font-medium text-[var(--text-secondary)]">
        Email
      </label>
      <input
        id={`${id}-email`}
        type="email"
        autoComplete="username"
        autoFocus={autoFocus}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={field}
        required
      />
      <label htmlFor={`${id}-password`} className="mt-1 text-xs font-medium text-[var(--text-secondary)]">
        Password
      </label>
      <input
        id={`${id}-password`}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={field}
        required
      />
      {error && (
        <p role="alert" className="text-sm text-[var(--error)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-[#4318ff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3a14e0] disabled:opacity-60"
      >
        <LogIn size={16} aria-hidden />
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-xs text-[var(--text-muted)]">No account? Ask an admin to make one for you.</p>
    </form>
  );
}

/** The same form in a window, for places that ask for an account mid-way (e.g. saving a plan). */
export function AccountSignInDialog({ open, onClose, title = 'Sign in to your account' }: { open: boolean; onClose: () => void; title?: string }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || user) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--background-card)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--background-hover)]">
            <X size={18} />
          </button>
        </div>
        <AccountSignInForm onDone={onClose} autoFocus />
      </div>
    </div>
  );
}
