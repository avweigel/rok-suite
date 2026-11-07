'use client';

// Shared role gate for protected pages. Once a password is accepted, the role
// is stashed in sessionStorage so navigating between protected pages doesn't
// keep prompting for the same password. Cleared when the tab/window closes.

import { useSyncExternalStore } from 'react';
import { ADMIN_PASSWORD, OFFICER_PASSWORD, POWER_PASSWORD } from './auth-passwords';

export type AuthRole = 'admin' | 'officer' | 'power';

const STORAGE_KEY = 'rok-auth-role';

const ROLE_RANK: Record<AuthRole, number> = { admin: 3, officer: 2, power: 1 };

/** Match a typed password against the configured roles, in admin > officer >
 *  power order. Empty / unknown returns null. */
export function passwordToRole(pw: string): AuthRole | null {
  if (!pw) return null;
  if (ADMIN_PASSWORD   && pw === ADMIN_PASSWORD)   return 'admin';
  if (OFFICER_PASSWORD && pw === OFFICER_PASSWORD) return 'officer';
  if (POWER_PASSWORD   && pw === POWER_PASSWORD)   return 'power';
  return null;
}

/** Does `have` satisfy `required`? Higher roles satisfy lower ones (admin
 *  meets officer/power; officer meets power). When `required` is an array,
 *  any match is enough. */
export function meetsRole(have: AuthRole | null, required: AuthRole | AuthRole[]): boolean {
  if (!have) return false;
  const list = Array.isArray(required) ? required : [required];
  return list.some((r) => ROLE_RANK[have] >= ROLE_RANK[r]);
}

function readStored(): AuthRole | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.sessionStorage.getItem(STORAGE_KEY);
    if (v === 'admin' || v === 'officer' || v === 'power') return v;
  } catch { /* sessionStorage may be unavailable */ }
  return null;
}

// In-process listeners so writes from this tab notify mounted subscribers
// (the native `storage` event only fires for *other* tabs).
const listeners = new Set<() => void>();

function notifyAll() {
  for (const l of listeners) l();
}

function writeStored(role: AuthRole | null) {
  if (typeof window === 'undefined') return;
  try {
    if (role) window.sessionStorage.setItem(STORAGE_KEY, role);
    else window.sessionStorage.removeItem(STORAGE_KEY);
    notifyAll();
  } catch { /* sessionStorage may be unavailable */ }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  let removeStorage: (() => void) | null = null;
  if (typeof window !== 'undefined') {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === STORAGE_KEY) callback();
    };
    window.addEventListener('storage', onStorage);
    removeStorage = () => window.removeEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(callback);
    if (removeStorage) removeStorage();
  };
}

function getSnapshot(): AuthRole | null {
  return readStored();
}

function getServerSnapshot(): AuthRole | null {
  // SSR: nothing read until the client hydrates.
  return null;
}

/**
 * The role is sourced from sessionStorage via useSyncExternalStore so it
 * stays consistent across protected pages and survives navigation. It also
 * picks up sign-in/out from other tabs through the `storage` event.
 */
export function useAuthRole() {
  const role = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    role,
    /** Try to unlock with `pw`. Returns the matched role, or null. */
    unlockWith: (pw: string): AuthRole | null => {
      const r = passwordToRole(pw);
      if (r) writeStored(r);
      return r;
    },
    signOut: () => {
      dropLegacyLogin();
      writeStored(null);
    },
  };
}

/** The War Room used to keep its own login in localStorage ('warroom-role'), which no sign-out cleared.
 *  It is the site's login now (lib/war-room-auth.tsx): whatever is left of the old one goes. */
export function dropLegacyLogin() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('warroom-role');
  } catch { /* localStorage may be unavailable */ }
}
